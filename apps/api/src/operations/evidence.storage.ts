import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, parse, relative, resolve } from 'node:path';

const DEFAULT_STORAGE_DIR = '/tmp/datos-evidencias';
const DEFAULT_MAX_MB = 25;

interface FileKind {
  mime: string;
  ext: string;
}

@Injectable()
export class EvidenceStorage {
  readonly root = resolve(process.env.EVIDENCE_STORAGE_DIR ?? DEFAULT_STORAGE_DIR);
  readonly maxBytes = Number(process.env.EVIDENCE_MAX_FILE_MB ?? DEFAULT_MAX_MB) * 1024 * 1024;

  async store(input: { plantId: string; executionId: string; file: Express.Multer.File }) {
    if (!input.file) throw new BadRequestException('Evidence file is required');
    if (input.file.size <= 0) throw new BadRequestException('Evidence file is empty');
    if (input.file.size > this.maxBytes) throw new BadRequestException('Evidence file exceeds configured size limit');

    const kind = this.detectKind(input.file.buffer);
    const sha256 = createHash('sha256').update(input.file.buffer).digest('hex');
    const dir = resolve(this.root, input.plantId, input.executionId);
    const filename = `${randomUUID()}${kind.ext}`;
    const path = resolve(dir, filename);

    if (relative(this.root, path).startsWith('..')) throw new BadRequestException('Invalid evidence path');

    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path, input.file.buffer, { mode: 0o600 });

    return {
      filename,
      originalName: this.safeOriginalName(input.file.originalname),
      mime: kind.mime,
      sizeBytes: input.file.size,
      sha256,
      path,
    };
  }

  private detectKind(buffer: Buffer): FileKind {
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: '.jpg' };
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { mime: 'image/png', ext: '.png' };
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
      return { mime: 'application/pdf', ext: '.pdf' };
    }
    if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return { mime: 'video/mp4', ext: '.mp4' };
    }
    throw new BadRequestException('Unsupported evidence type');
  }

  private safeOriginalName(originalName?: string) {
    if (!originalName) return null;
    const base = basename(originalName).replace(/[^\w.\- ()]/g, '_').slice(0, 180);
    const parsed = parse(base);
    const ext = extname(base).slice(0, 12);
    const name = parsed.name.slice(0, Math.max(1, 180 - ext.length));
    return `${name}${ext}`;
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceDescriptionDto } from './operations.dto';
import { sanitizeObject } from './sanitize';
import { EvidenceStorage } from './evidence.storage';

@Injectable()
export class EvidenceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: EvidenceStorage,
  ) {}

  async upload(userId: string, executionId: string, file: Express.Multer.File, dto: EvidenceDescriptionDto, ctx: RequestContext) {
    const execution = await this.prisma.operationalExecution.findUnique({
      where: { id: executionId },
      include: { planTask: { include: { plant: true } } },
    });
    if (!execution || execution.planTask.deletedAt || execution.planTask.plant.deletedAt) {
      throw new NotFoundException('Execution not found');
    }

    const stored = await this.storage.store({ plantId: execution.planTask.plantId, executionId, file });
    const clean = sanitizeObject(dto);
    const evidence = await this.prisma.evidence.create({
      data: {
        executionId,
        filename: stored.filename,
        originalName: stored.originalName,
        mime: stored.mime,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        path: stored.path,
        description: clean.description,
        uploadedById: userId,
      },
    });

    await this.audit.record({
      userId,
      action: 'EVIDENCE_UPLOAD',
      entity: 'Evidence',
      entityId: evidence.id,
      after: { ...evidence, path: '[redacted]' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toEvidenceDto(evidence);
  }

  async openForDownload(user: { role: Role }, id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { execution: { include: { planTask: { include: { plant: true } } } } },
    });
    if (!evidence || evidence.deletedAt) throw new NotFoundException('Evidence not found');
    if (user.role === Role.VIEWER && !evidence.execution.planTask.plant.visibleToViewer) {
      throw new ForbiddenException('Evidence is not visible for viewer');
    }

    const baseDir = resolve(process.env.EVIDENCE_DIR ?? './evidence');
    let resolvedPath: string;
    try {
      resolvedPath = await realpath(evidence.path);
      await stat(resolvedPath);
    } catch {
      throw new NotFoundException('Evidence file not found');
    }
    if (!resolvedPath.startsWith(baseDir + '/') && resolvedPath !== baseDir) {
      throw new ForbiddenException('Evidence path outside storage');
    }
    return {
      stream: createReadStream(resolvedPath),
      evidence: this.toEvidenceDto(evidence),
    };
  }

  async remove(userId: string, id: string, ctx: RequestContext) {
    const before = await this.prisma.evidence.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Evidence not found');
    const after = await this.prisma.evidence.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      userId,
      action: 'EVIDENCE_DELETE',
      entity: 'Evidence',
      entityId: id,
      before: { ...before, path: '[redacted]' },
      after: { ...after, path: '[redacted]' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  private toEvidenceDto(evidence: {
    id: string;
    filename: string;
    originalName: string | null;
    mime: string;
    sizeBytes: number;
    sha256: string;
    description: string | null;
    uploadedAt: Date;
  }) {
    return {
      id: evidence.id,
      filename: evidence.filename,
      originalName: evidence.originalName,
      mime: evidence.mime,
      sizeBytes: evidence.sizeBytes,
      sha256: evidence.sha256,
      description: evidence.description,
      uploadedAt: evidence.uploadedAt,
    };
  }
}

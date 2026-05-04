import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EvidenceStorage } from './evidence.storage';

describe('EvidenceStorage', () => {
  let root: string;
  let originalStorageDir: string | undefined;

  beforeEach(async () => {
    originalStorageDir = process.env.EVIDENCE_STORAGE_DIR;
    root = await mkdtemp(join(tmpdir(), 'datos-evidence-'));
    process.env.EVIDENCE_STORAGE_DIR = root;
  });

  afterEach(async () => {
    if (originalStorageDir === undefined) delete process.env.EVIDENCE_STORAGE_DIR;
    else process.env.EVIDENCE_STORAGE_DIR = originalStorageDir;
    await rm(root, { recursive: true, force: true });
  });

  it('stores validated evidence with a safe original name', async () => {
    const storage = new EvidenceStorage();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    const stored = await storage.store({
      plantId: 'plant_1',
      executionId: 'exec_1',
      file: {
        buffer: png,
        size: png.length,
        originalname: '../evidencia prueba.png',
      } as Express.Multer.File,
    });

    expect(stored.mime).toBe('image/png');
    expect(stored.originalName).toBe('evidencia prueba.png');
    expect(await readFile(stored.path)).toEqual(png);
  });

  it('rejects unsupported content regardless of extension', async () => {
    const storage = new EvidenceStorage();
    await expect(
      storage.store({
        plantId: 'plant_1',
        executionId: 'exec_1',
        file: {
          buffer: Buffer.from('not a pdf'),
          size: 9,
          originalname: 'fake.pdf',
        } as Express.Multer.File,
      }),
    ).rejects.toThrow('Unsupported evidence type');
  });
});

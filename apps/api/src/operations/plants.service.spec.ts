jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: (input: string) => String(input ?? '') },
}));

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlantStatus, Role } from '@prisma/client';
import { PlantsService } from './plants.service';

type PlantRow = {
  id: string;
  psr: string;
  name: string;
  description: string | null;
  area: string | null;
  color: string | null;
  status: PlantStatus;
  visibleToViewer: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
};

function buildPlant(overrides: Partial<PlantRow> = {}): PlantRow {
  return {
    id: 'plant-1',
    psr: 'PSR-001',
    name: 'Planta Norte',
    description: null,
    area: 'ELEMEC',
    color: '#0aa',
    status: PlantStatus.ACTIVE,
    visibleToViewer: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdById: 'admin-1',
    updatedById: 'admin-1',
    ...overrides,
  };
}

function buildPrismaMock(initial: PlantRow[]) {
  const store = new Map<string, PlantRow>(initial.map((row) => [row.id, row]));
  return {
    store,
    plant: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; psr?: string } }) => {
        if (where.id) return store.get(where.id) ?? null;
        if (where.psr) return Array.from(store.values()).find((row) => row.psr === where.psr) ?? null;
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return Array.from(store.values()).filter((row) => {
          if (row.deletedAt) return false;
          if (where.visibleToViewer === true && !row.visibleToViewer) return false;
          return true;
        }).map((row) => ({
          ...row,
          _count: { equipment: 0, planTasks: 0 },
          planTasks: [],
        }));
      }),
      count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return Array.from(store.values()).filter((row) => {
          if (row.deletedAt) return false;
          if (where.visibleToViewer === true && !row.visibleToViewer) return false;
          return true;
        }).length;
      }),
      create: jest.fn(async ({ data }: { data: Omit<PlantRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> }) => {
        const next: PlantRow = {
          ...data,
          id: `plant-${store.size + 1}`,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PlantRow;
        store.set(next.id, next);
        return next;
      }),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
}

const ctx = { ip: '127.0.0.1', userAgent: 'jest' } as const;

describe('PlantsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let audit: { record: jest.Mock };
  let service: PlantsService;

  describe('list', () => {
    it('hides plants with visibleToViewer=false from VIEWER role', async () => {
      prisma = buildPrismaMock([
        buildPlant({ id: 'p1', psr: 'PSR-001', visibleToViewer: true }),
        buildPlant({ id: 'p2', psr: 'PSR-002', visibleToViewer: false }),
      ]);
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      const result = await service.list({ role: Role.VIEWER }, {});
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.psr).toBe('PSR-001');
    });

    it('shows all plants to SUPERADMIN regardless of visibleToViewer', async () => {
      prisma = buildPrismaMock([
        buildPlant({ id: 'p1', psr: 'PSR-001', visibleToViewer: true }),
        buildPlant({ id: 'p2', psr: 'PSR-002', visibleToViewer: false }),
      ]);
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      const result = await service.list({ role: Role.SUPERADMIN }, {});
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('byPsr', () => {
    it('throws Forbidden for VIEWER on hidden plant', async () => {
      prisma = buildPrismaMock([buildPlant({ visibleToViewer: false })]);
      prisma.plant.findUnique = jest.fn(async () => ({
        ...Array.from(prisma.store.values())[0]!,
        equipment: [],
        planTasks: [],
      })) as never;
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      await expect(service.byPsr({ role: Role.VIEWER }, 'PSR-001')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound when plant does not exist', async () => {
      prisma = buildPrismaMock([]);
      prisma.plant.findUnique = jest.fn(async () => null) as never;
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      await expect(service.byPsr({ role: Role.SUPERADMIN }, 'NOT-EXIST')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('rejects duplicate PSR with ConflictException', async () => {
      prisma = buildPrismaMock([buildPlant({ psr: 'PSR-001' })]);
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      await expect(
        service.create('admin-1', { psr: 'PSR-001', name: 'Otra planta' }, ctx),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('normalizes PSR (trim + uppercase + dash)', async () => {
      prisma = buildPrismaMock([]);
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      const created = await service.create('admin-1', { psr: '  psr 002  ', name: 'Planta Sur' }, ctx);
      expect(created.psr).toBe('PSR-002');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PLANT_CREATE', entity: 'Plant' }),
      );
    });

    it('records audit log on creation', async () => {
      prisma = buildPrismaMock([]);
      audit = { record: jest.fn() };
      service = new PlantsService(prisma as never, audit as never);

      await service.create('admin-1', { psr: 'PSR-100', name: 'Nueva' }, ctx);
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });
});

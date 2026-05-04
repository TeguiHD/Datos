jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: (input: string) => String(input ?? '') },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanFrequency } from '@prisma/client';
import { PlanService } from './plan.service';

type PlanTaskRow = {
  id: string;
  plantId: string;
  equipmentId: string | null;
  abc: string | null;
  description: string;
  frequency: PlanFrequency;
  cronExpression: string | null;
  hhPlan: number;
  responsibleId: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PlantRow = { id: string; psr: string; deletedAt: Date | null };
type EquipmentRow = { id: string; plantId: string; deletedAt: Date | null };

function buildPlant(): PlantRow {
  return { id: 'plant-1', psr: 'PSR-001', deletedAt: null };
}

function buildPrismaMock(opts: { plant: PlantRow; equipment?: EquipmentRow[]; tasks?: PlanTaskRow[] }) {
  const plants = new Map([[opts.plant.id, opts.plant]]);
  const equipment = new Map<string, EquipmentRow>((opts.equipment ?? []).map((e) => [e.id, e]));
  const tasks = new Map<string, PlanTaskRow>((opts.tasks ?? []).map((t) => [t.id, t]));
  const executions: Array<{ planTaskId: string; dueDate: Date; hhPlan: number }> = [];

  return {
    _stores: { plants, equipment, tasks },
    executions,
    plant: {
      findUnique: jest.fn(async ({ where }: { where: { psr?: string; id?: string } }) => {
        if (where.psr) return Array.from(plants.values()).find((p) => p.psr === where.psr) ?? null;
        if (where.id) return plants.get(where.id) ?? null;
        return null;
      }),
    },
    equipment: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => equipment.get(where.id) ?? null),
    },
    maintenancePlanTask: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => tasks.get(where.id) ?? null),
      findMany: jest.fn(async () => Array.from(tasks.values())),
      create: jest.fn(async ({ data }: { data: Omit<PlanTaskRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> }) => {
        const next: PlanTaskRow = {
          ...data,
          id: `task-${tasks.size + 1}`,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PlanTaskRow;
        tasks.set(next.id, next);
        return next;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<PlanTaskRow> }) => {
        const current = tasks.get(where.id);
        if (!current) throw new Error('not found');
        const next = { ...current, ...data };
        tasks.set(where.id, next);
        return next;
      }),
    },
    operationalExecution: {
      createMany: jest.fn(async ({ data }: { data: Array<{ planTaskId: string; dueDate: Date; hhPlan: number }> }) => {
        executions.push(...data);
        return { count: data.length };
      }),
    },
  };
}

const ctx = { ip: '127.0.0.1', userAgent: 'jest' } as const;

describe('PlanService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let audit: { record: jest.Mock };
  let service: PlanService;

  describe('create', () => {
    it('persists HH plan with decimal precision', async () => {
      prisma = buildPrismaMock({ plant: buildPlant() });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      const task = await service.create(
        'admin-1',
        'PSR-001',
        {
          description: 'Lubricacion bombas',
          frequency: PlanFrequency.QUARTERLY,
          hhPlan: 2.5,
        },
        ctx,
      );
      expect(task.hhPlan).toBe(2.5);
    });

    it('rejects equipment from a different plant', async () => {
      prisma = buildPrismaMock({
        plant: buildPlant(),
        equipment: [{ id: 'eq-other', plantId: 'plant-other', deletedAt: null }],
      });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      await expect(
        service.create(
          'admin-1',
          'PSR-001',
          {
            equipmentId: 'eq-other',
            description: 'Test',
            frequency: PlanFrequency.MONTHLY,
            hhPlan: 1,
          },
          ctx,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for unknown PSR', async () => {
      prisma = buildPrismaMock({ plant: buildPlant() });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      await expect(
        service.create(
          'admin-1',
          'PSR-INEXIST',
          { description: 'X', frequency: PlanFrequency.MONTHLY, hhPlan: 1 },
          ctx,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('generateExecutions', () => {
    it('generates 12 monthly occurrences for MONTHLY frequency', async () => {
      const task: PlanTaskRow = {
        id: 'task-monthly',
        plantId: 'plant-1',
        equipmentId: null,
        abc: 'A',
        description: 'Inspeccion mensual',
        frequency: PlanFrequency.MONTHLY,
        cronExpression: null,
        hhPlan: 2,
        responsibleId: null,
        active: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma = buildPrismaMock({ plant: buildPlant(), tasks: [task] });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      const result = await service.generateExecutions('admin-1', 'task-monthly', { months: 12 }, ctx);
      expect(result.created).toBe(12);
      expect(prisma.executions).toHaveLength(12);
    });

    it('generates 4 quarterly occurrences for QUARTERLY frequency over 12 months', async () => {
      const task: PlanTaskRow = {
        id: 'task-q',
        plantId: 'plant-1',
        equipmentId: null,
        abc: 'B',
        description: 'Inspeccion trimestral',
        frequency: PlanFrequency.QUARTERLY,
        cronExpression: null,
        hhPlan: 4,
        responsibleId: null,
        active: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma = buildPrismaMock({ plant: buildPlant(), tasks: [task] });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      const result = await service.generateExecutions('admin-1', 'task-q', { months: 12 }, ctx);
      expect(result.created).toBe(4);
    });

    it('generates 2 semiannual occurrences over 12 months', async () => {
      const task: PlanTaskRow = {
        id: 'task-s',
        plantId: 'plant-1',
        equipmentId: null,
        abc: 'A',
        description: 'Mantencion semestral',
        frequency: PlanFrequency.SEMIANNUAL,
        cronExpression: null,
        hhPlan: 8,
        responsibleId: null,
        active: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma = buildPrismaMock({ plant: buildPlant(), tasks: [task] });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      const result = await service.generateExecutions('admin-1', 'task-s', { months: 12 }, ctx);
      expect(result.created).toBe(2);
    });

    it('rejects CUSTOM frequency without explicit cron', async () => {
      const task: PlanTaskRow = {
        id: 'task-custom',
        plantId: 'plant-1',
        equipmentId: null,
        abc: null,
        description: 'Custom',
        frequency: PlanFrequency.CUSTOM,
        cronExpression: null,
        hhPlan: 1,
        responsibleId: null,
        active: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma = buildPrismaMock({ plant: buildPlant(), tasks: [task] });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      await expect(
        service.generateExecutions('admin-1', 'task-custom', { months: 12 }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for inactive plan task', async () => {
      const task: PlanTaskRow = {
        id: 'task-inactive',
        plantId: 'plant-1',
        equipmentId: null,
        abc: null,
        description: 'Inactive',
        frequency: PlanFrequency.MONTHLY,
        cronExpression: null,
        hhPlan: 1,
        responsibleId: null,
        active: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma = buildPrismaMock({ plant: buildPlant(), tasks: [task] });
      audit = { record: jest.fn() };
      service = new PlanService(prisma as never, audit as never);

      await expect(
        service.generateExecutions('admin-1', 'task-inactive', { months: 12 }, ctx),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

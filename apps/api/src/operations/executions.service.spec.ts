jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: (input: string) => String(input ?? '') },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExecutionOutcome, OperationalExecutionStatus, Role } from '@prisma/client';
import { ExecutionsService } from './executions.service';

type ExecutionRow = {
  id: string;
  status: OperationalExecutionStatus;
  outcome: ExecutionOutcome | null;
  hhPlan: number;
  hhActual: number | null;
  comment: string | null;
  skipReason: string | null;
  postponedTo: Date | null;
  reopenedReason: string | null;
  rejectedReason: string | null;
  rejectedById: string | null;
  rejectedAt: Date | null;
  approvedById: string | null;
  approvedAt: Date | null;
  registeredById: string | null;
  registeredAt: Date | null;
  startedAt: Date | null;
  doneDate: Date | null;
  dueDate: Date;
  createdAt: Date;
  evidence: Array<{
    id: string;
    filename: string;
    originalName: string | null;
    mime: string;
    sizeBytes: number;
    description: string | null;
    uploadedAt: Date;
    sha256: string;
  }>;
  planTask: {
    id: string;
    abc: string | null;
    description: string;
    frequency: string;
    hhPlan: number;
    deletedAt: Date | null;
    plantId: string;
    equipment: { id: string; name: string; type: string } | null;
    plant: { id: string; psr: string; name: string; area: string | null; visibleToViewer: boolean; deletedAt: Date | null };
  };
};

function buildExecution(overrides: Partial<ExecutionRow> = {}): ExecutionRow {
  return {
    id: 'exec-1',
    status: OperationalExecutionStatus.SCHEDULED,
    outcome: null,
    hhPlan: 4,
    hhActual: null,
    comment: null,
    skipReason: null,
    postponedTo: null,
    reopenedReason: null,
    rejectedReason: null,
    rejectedById: null,
    rejectedAt: null,
    approvedById: null,
    approvedAt: null,
    registeredById: null,
    registeredAt: null,
    startedAt: null,
    doneDate: null,
    dueDate: new Date('2026-06-01'),
    createdAt: new Date('2026-05-01'),
    evidence: [],
    planTask: {
      id: 'task-1',
      abc: 'A',
      description: 'Inspeccion semestral',
      frequency: 'SEMIANNUAL',
      hhPlan: 4,
      deletedAt: null,
      plantId: 'plant-1',
      equipment: { id: 'eq-1', name: 'Bomba 1', type: 'PUMP' },
      plant: { id: 'plant-1', psr: 'PSR-001', name: 'Planta Norte', area: 'ELEMEC', visibleToViewer: true, deletedAt: null },
    },
    ...overrides,
  };
}

function buildPrismaMock(initial: ExecutionRow) {
  const store = new Map<string, ExecutionRow>([[initial.id, initial]]);
  return {
    store,
    operationalExecution: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ExecutionRow> }) => {
        const current = store.get(where.id);
        if (!current) throw new Error('not found');
        const next = { ...current, ...data } as ExecutionRow;
        store.set(where.id, next);
        return next;
      }),
      findMany: jest.fn(async () => Array.from(store.values())),
      count: jest.fn(async () => store.size),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
}

const ctx = { ip: '127.0.0.1', userAgent: 'jest' } as const;

describe('ExecutionsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let audit: { record: jest.Mock };
  let service: ExecutionsService;

  beforeEach(() => {
    prisma = buildPrismaMock(buildExecution());
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ExecutionsService(prisma as never, audit as never);
  });

  describe('register', () => {
    it('requires HH real to close as DONE', async () => {
      await expect(
        service.register('user-1', 'exec-1', { outcome: ExecutionOutcome.DONE }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('requires a comment for DONE_WITH_OBSERVATIONS', async () => {
      await expect(
        service.register(
          'user-1',
          'exec-1',
          { outcome: ExecutionOutcome.DONE_WITH_OBSERVATIONS, hhActual: 3 },
          ctx,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a skip reason for NOT_DONE', async () => {
      await expect(
        service.register('user-1', 'exec-1', { outcome: ExecutionOutcome.NOT_DONE }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires postponedTo or skipWithoutReschedule for NOT_DONE', async () => {
      await expect(
        service.register(
          'user-1',
          'exec-1',
          { outcome: ExecutionOutcome.NOT_DONE, skipReason: 'Sin ventana' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks execution as pending review when autoApprove is false', async () => {
      const result = await service.register(
        'user-1',
        'exec-1',
        { outcome: ExecutionOutcome.DONE, hhActual: 5 },
        ctx,
      );
      expect(result.status).toBe(OperationalExecutionStatus.DONE_PENDING_APPROVAL);
      expect(result.hhActual).toBe(5);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPERATIONAL_EXECUTION_REGISTER', entity: 'OperationalExecution' }),
      );
    });

    it('always creates DONE_PENDING_APPROVAL — approval requires a separate explicit action', async () => {
      const result = await service.register(
        'user-1',
        'exec-1',
        { outcome: ExecutionOutcome.DONE, hhActual: 5 },
        ctx,
      );
      expect(result.status).toBe(OperationalExecutionStatus.DONE_PENDING_APPROVAL);
      expect(result.approvedAt).toBeNull();
    });

    it('records POSTPONED when NOT_DONE has postponedTo', async () => {
      const result = await service.register(
        'user-1',
        'exec-1',
        {
          outcome: ExecutionOutcome.NOT_DONE,
          skipReason: 'Equipo detenido',
          postponedTo: '2026-07-01',
        },
        ctx,
      );
      expect(result.status).toBe(OperationalExecutionStatus.POSTPONED);
      expect(result.postponedTo).toEqual(new Date('2026-07-01'));
    });

    it('records SKIPPED when NOT_DONE asks to skip without reschedule', async () => {
      const result = await service.register(
        'user-1',
        'exec-1',
        {
          outcome: ExecutionOutcome.NOT_DONE,
          skipReason: 'Repuesto descontinuado',
          skipWithoutReschedule: true,
        },
        ctx,
      );
      expect(result.status).toBe(OperationalExecutionStatus.SKIPPED);
    });
  });

  describe('approve', () => {
    it('rejects approval from SCHEDULED', async () => {
      await expect(service.approve('user-1', 'exec-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('approves a pending execution and audits the change', async () => {
      prisma.store.set(
        'exec-1',
        buildExecution({ status: OperationalExecutionStatus.DONE_PENDING_APPROVAL, hhActual: 5 }),
      );
      const result = await service.approve('user-2', 'exec-1', ctx);
      expect(result.status).toBe(OperationalExecutionStatus.APPROVED);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPERATIONAL_EXECUTION_APPROVE' }),
      );
    });

    it('approves a previously rejected execution', async () => {
      prisma.store.set(
        'exec-1',
        buildExecution({ status: OperationalExecutionStatus.REJECTED, hhActual: 5, rejectedReason: 'Falta evidencia' }),
      );
      const result = await service.approve('user-2', 'exec-1', ctx);
      expect(result.status).toBe(OperationalExecutionStatus.APPROVED);
    });
  });

  describe('start', () => {
    it('transitions SCHEDULED to IN_PROGRESS and stamps startedAt', async () => {
      const result = await service.start('user-1', 'exec-1', ctx);
      expect(result.status).toBe(OperationalExecutionStatus.IN_PROGRESS);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPERATIONAL_EXECUTION_START' }),
      );
    });

    it('rejects start when status is not SCHEDULED or POSTPONED', async () => {
      prisma.store.set('exec-1', buildExecution({ status: OperationalExecutionStatus.APPROVED }));
      await expect(service.start('user-1', 'exec-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows starting a POSTPONED execution', async () => {
      prisma.store.set('exec-1', buildExecution({ status: OperationalExecutionStatus.POSTPONED }));
      const result = await service.start('user-1', 'exec-1', ctx);
      expect(result.status).toBe(OperationalExecutionStatus.IN_PROGRESS);
    });
  });

  describe('reject', () => {
    it('records the reason and audit entry', async () => {
      prisma.store.set(
        'exec-1',
        buildExecution({ status: OperationalExecutionStatus.DONE_PENDING_APPROVAL, hhActual: 5 }),
      );
      const result = await service.reject('user-2', 'exec-1', { reason: 'Evidencia insuficiente' }, ctx);
      expect(result.status).toBe(OperationalExecutionStatus.REJECTED);
      expect(result.rejectedReason).toBe('Evidencia insuficiente');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPERATIONAL_EXECUTION_REJECT' }),
      );
    });
  });

  describe('reopen', () => {
    it('only allows reopening approved executions', async () => {
      prisma.store.set(
        'exec-1',
        buildExecution({ status: OperationalExecutionStatus.DONE_PENDING_APPROVAL }),
      );
      await expect(
        service.reopen('user-2', 'exec-1', { reason: 'Necesita repaso' }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reopens an approved execution into pending review', async () => {
      prisma.store.set(
        'exec-1',
        buildExecution({ status: OperationalExecutionStatus.APPROVED, approvedById: 'user-2', approvedAt: new Date() }),
      );
      const result = await service.reopen('user-2', 'exec-1', { reason: 'Revisar mediciones' }, ctx);
      expect(result.status).toBe(OperationalExecutionStatus.DONE_PENDING_APPROVAL);
      expect(result.reopenedReason).toBe('Revisar mediciones');
    });
  });

  describe('postpone', () => {
    it('updates the postponedTo date and audits', async () => {
      const result = await service.postpone(
        'user-1',
        'exec-1',
        { postponedTo: '2026-08-01', reason: 'Coordinacion con cliente' },
        ctx,
      );
      expect(result.status).toBe(OperationalExecutionStatus.POSTPONED);
      expect(result.postponedTo).toEqual(new Date('2026-08-01'));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPERATIONAL_EXECUTION_POSTPONE' }),
      );
    });
  });

  describe('lookup safety', () => {
    it('throws NotFoundException when the execution does not exist', async () => {
      await expect(service.approve('user-1', 'missing', ctx)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the parent plant is soft deleted', async () => {
      const row = buildExecution();
      row.planTask.plant.deletedAt = new Date();
      prisma.store.set('exec-1', row);
      await expect(service.approve('user-1', 'exec-1', ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertVisibleToViewer', () => {
    it('blocks viewers from invisible plants', () => {
      expect(() => service.assertVisibleToViewer({ role: Role.VIEWER }, false)).toThrow();
    });
    it('allows superadmin regardless of visibility flag', () => {
      expect(() => service.assertVisibleToViewer({ role: Role.SUPERADMIN }, false)).not.toThrow();
    });
  });
});

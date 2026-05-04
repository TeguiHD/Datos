import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionOutcome, OperationalExecutionStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListOperationalExecutionsDto,
  PostponeExecutionDto,
  RegisterExecutionDto,
  RejectExecutionDto,
  ReopenExecutionDto,
} from './operations.dto';
import { normalizePsr, sanitizeObject } from './sanitize';

const ACTIVE_EVIDENCE_WHERE = { deletedAt: null };

@Injectable()
export class ExecutionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(user: { role: Role }, query: ListOperationalExecutionsDto) {
    const { plantId, psr, status, abc, from, to, q, take = 50, skip = 0 } = query;
    const where: Prisma.OperationalExecutionWhereInput = {
      ...(status && { status }),
      ...(from || to
        ? {
            dueDate: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
      planTask: {
        deletedAt: null,
        ...(abc && { abc: abc.toUpperCase() }),
        plant: {
          deletedAt: null,
          ...(user.role === Role.VIEWER && { visibleToViewer: true }),
          ...(plantId && { id: plantId }),
          ...(psr && { psr: normalizePsr(psr) }),
        },
      },
      ...(q?.trim()
        ? {
            OR: [
              { planTask: { description: { contains: q.trim(), mode: 'insensitive' } } },
              { planTask: { plant: { name: { contains: q.trim(), mode: 'insensitive' } } } },
              { planTask: { plant: { psr: { contains: q.trim(), mode: 'insensitive' } } } },
              { planTask: { equipment: { name: { contains: q.trim(), mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.operationalExecution.findMany({
        where,
        take: Math.min(take, 500),
        skip,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        include: this.executionInclude(),
      }),
      this.prisma.operationalExecution.count({ where }),
    ]);

    return {
      rows: rows.map((row) => this.toExecutionDto(row)),
      total,
      take,
      skip,
    };
  }

  async start(userId: string, id: string, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    if (
      before.status !== OperationalExecutionStatus.SCHEDULED &&
      before.status !== OperationalExecutionStatus.POSTPONED
    ) {
      throw new BadRequestException('Only scheduled or postponed executions can be started');
    }

    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: OperationalExecutionStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_START',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  async register(userId: string, id: string, dto: RegisterExecutionDto, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    const clean = sanitizeObject(dto);
    const doneDate = clean.doneDate ? new Date(clean.doneDate) : new Date();

    if (clean.outcome === ExecutionOutcome.DONE || clean.outcome === ExecutionOutcome.DONE_WITH_OBSERVATIONS) {
      if (clean.hhActual === undefined || clean.hhActual === null) {
        throw new BadRequestException('HH real is required to close an execution');
      }
      if (clean.outcome === ExecutionOutcome.DONE_WITH_OBSERVATIONS && !clean.comment?.trim()) {
        throw new BadRequestException('Comment is required for executions with observations');
      }
    }

    if (clean.outcome === ExecutionOutcome.NOT_DONE) {
      if (!clean.skipReason?.trim()) throw new BadRequestException('Skip reason is required');
      if (!clean.postponedTo && !clean.skipWithoutReschedule) {
        throw new BadRequestException('Provide postponedTo or confirm skipWithoutReschedule');
      }
    }

    const nextStatus =
      clean.outcome === ExecutionOutcome.NOT_DONE
        ? clean.postponedTo
          ? OperationalExecutionStatus.POSTPONED
          : OperationalExecutionStatus.SKIPPED
        : OperationalExecutionStatus.DONE_PENDING_APPROVAL;

    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: nextStatus,
        outcome: clean.outcome,
        doneDate,
        hhActual: clean.hhActual ?? null,
        comment: clean.comment,
        skipReason: clean.skipReason,
        postponedTo: clean.postponedTo ? new Date(clean.postponedTo) : null,
        registeredById: userId,
        registeredAt: new Date(),
        approvedById: null,
        approvedAt: null,
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_REGISTER',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  async approve(userId: string, id: string, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    if (
      before.status !== OperationalExecutionStatus.DONE_PENDING_APPROVAL &&
      before.status !== OperationalExecutionStatus.REJECTED
    ) {
      throw new BadRequestException('Only pending or rejected executions can be approved');
    }

    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: OperationalExecutionStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_APPROVE',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  async reject(userId: string, id: string, dto: RejectExecutionDto, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    const clean = sanitizeObject(dto);
    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: OperationalExecutionStatus.REJECTED,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectedReason: clean.reason.trim(),
        approvedById: null,
        approvedAt: null,
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_REJECT',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  async postpone(userId: string, id: string, dto: PostponeExecutionDto, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    const clean = sanitizeObject(dto);
    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: OperationalExecutionStatus.POSTPONED,
        postponedTo: new Date(clean.postponedTo),
        comment: clean.reason.trim(),
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_POSTPONE',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  async reopen(userId: string, id: string, dto: ReopenExecutionDto, ctx: RequestContext) {
    const before = await this.findExecutionForMutation(id);
    const clean = sanitizeObject(dto);
    if (before.status !== OperationalExecutionStatus.APPROVED) {
      throw new BadRequestException('Only approved executions can be reopened');
    }

    const after = await this.prisma.operationalExecution.update({
      where: { id },
      data: {
        status: OperationalExecutionStatus.DONE_PENDING_APPROVAL,
        reopenedReason: clean.reason.trim(),
        approvedById: null,
        approvedAt: null,
      },
      include: this.executionInclude(),
    });

    await this.audit.record({
      userId,
      action: 'OPERATIONAL_EXECUTION_REOPEN',
      entity: 'OperationalExecution',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.toExecutionDto(after);
  }

  private async findExecutionForMutation(id: string) {
    const execution = await this.prisma.operationalExecution.findUnique({ where: { id }, include: this.executionInclude() });
    if (!execution || execution.planTask.deletedAt || execution.planTask.plant.deletedAt) {
      throw new NotFoundException('Execution not found');
    }
    return execution;
  }

  private executionInclude() {
    return {
      evidence: {
        where: ACTIVE_EVIDENCE_WHERE,
        orderBy: { uploadedAt: 'desc' as const },
      },
      planTask: {
        include: {
          equipment: true,
          plant: true,
        },
      },
    };
  }

  private toExecutionDto(execution: Prisma.OperationalExecutionGetPayload<{ include: ReturnType<ExecutionsService['executionInclude']> }>) {
    return {
      id: execution.id,
      dueDate: execution.dueDate,
      startedAt: execution.startedAt,
      doneDate: execution.doneDate,
      status: execution.status,
      outcome: execution.outcome,
      hhPlan: Number(execution.hhPlan),
      hhActual: execution.hhActual === null ? null : Number(execution.hhActual),
      comment: execution.comment,
      skipReason: execution.skipReason,
      postponedTo: execution.postponedTo,
      reopenedReason: execution.reopenedReason,
      rejectedReason: execution.rejectedReason,
      registeredAt: execution.registeredAt,
      approvedAt: execution.approvedAt,
      rejectedAt: execution.rejectedAt,
      evidenceCount: execution.evidence.length,
      evidence: execution.evidence.map((item) => ({
        id: item.id,
        filename: item.filename,
        originalName: item.originalName,
        mime: item.mime,
        sizeBytes: item.sizeBytes,
        description: item.description,
        uploadedAt: item.uploadedAt,
        sha256: item.sha256,
      })),
      planTask: {
        id: execution.planTask.id,
        abc: execution.planTask.abc,
        description: execution.planTask.description,
        frequency: execution.planTask.frequency,
        hhPlan: Number(execution.planTask.hhPlan),
        equipment: execution.planTask.equipment
          ? {
              id: execution.planTask.equipment.id,
              name: execution.planTask.equipment.name,
              type: execution.planTask.equipment.type,
            }
          : null,
        plant: {
          id: execution.planTask.plant.id,
          psr: execution.planTask.plant.psr,
          name: execution.planTask.plant.name,
          area: execution.planTask.plant.area,
          visibleToViewer: execution.planTask.plant.visibleToViewer,
        },
      },
    };
  }

  assertVisibleToViewer(user: { role: Role }, visibleToViewer: boolean) {
    if (user.role === Role.VIEWER && !visibleToViewer) {
      throw new ForbiddenException('Evidence is not visible for viewer');
    }
  }
}

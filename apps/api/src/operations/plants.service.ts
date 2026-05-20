import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecStatus, OperationalExecutionStatus, PlantStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { DeletePlantDto, ListPlantsDto, UpdatePlantDto, UpsertPlantDto } from './operations.dto';
import { normalizePsr, sanitizeObject } from './sanitize';
import { normalizePlantAlias } from './plant-catalog.service';

const ACTIVE_EVIDENCE_WHERE = { deletedAt: null };
const OPEN_STATUSES: OperationalExecutionStatus[] = [
  OperationalExecutionStatus.SCHEDULED,
  OperationalExecutionStatus.IN_PROGRESS,
  OperationalExecutionStatus.DONE_PENDING_APPROVAL,
  OperationalExecutionStatus.REJECTED,
  OperationalExecutionStatus.POSTPONED,
];
const EVIDENCE_REQUIRED_STATUSES: OperationalExecutionStatus[] = [
  OperationalExecutionStatus.DONE_PENDING_APPROVAL,
  OperationalExecutionStatus.APPROVED,
  OperationalExecutionStatus.REJECTED,
];

@Injectable()
export class PlantsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(user: { role: Role }, query: ListPlantsDto) {
    const { q, status, area, take = 50, skip = 0 } = query;
    const where: Prisma.PlantWhereInput = {
      deletedAt: null,
      maintenanceTasks: { some: { deletedAt: null } },
      ...(user.role === Role.VIEWER && { visibleToViewer: true }),
      ...(status && { status }),
      ...(area && { area }),
      ...(q && {
        AND: [
          {
            OR: [
          { psr: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { equipment: { some: { name: { contains: q, mode: 'insensitive' }, deletedAt: null } } },
            ],
          },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.plant.findMany({
        where,
        take: Math.min(take, 500),
        skip,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              equipment: { where: { deletedAt: null } },
              planTasks: { where: { deletedAt: null } },
              maintenanceTasks: { where: { deletedAt: null } },
            },
          },
          aliases: { orderBy: { alias: 'asc' } },
          maintenanceTasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              hhReal: true,
              schedule: { select: { year: true, month: true, hh: true } },
              executions: {
                where: { status: { in: [ExecStatus.PENDING, ExecStatus.OVERDUE] } },
                select: { dueDate: true, hhPlanned: true, status: true },
                orderBy: { dueDate: 'asc' },
                take: 1,
              },
            },
            take: 10000,
          },
          planTasks: {
            where: { deletedAt: null },
            select: {
              hhPlan: true,
              executions: {
                select: { dueDate: true, status: true },
                orderBy: { dueDate: 'asc' },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return {
      rows: rows.map((plant) => {
        const hhPlan = plant.planTasks.reduce((acc, task) => acc + Number(task.hhPlan), 0);
        const excelHhBase = plant.maintenanceTasks.reduce((acc, task) => acc + Number(task.hhReal ?? 0), 0);
        const excelScheduleHh = plant.maintenanceTasks.reduce(
          (acc, task) => acc + task.schedule.reduce((sum, item) => sum + Number(item.hh), 0),
          0,
        );
        const nextDueDate =
          [
            ...plant.planTasks
            .flatMap((task) => task.executions)
            .map((execution) => execution.dueDate),
            ...plant.maintenanceTasks
              .flatMap((task) => task.executions)
              .map((execution) => execution.dueDate),
          ]
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
        return {
          id: plant.id,
          psr: plant.psr,
          name: plant.name,
          description: plant.description,
          area: plant.area,
          color: plant.color,
          status: plant.status,
          visibleToViewer: plant.visibleToViewer,
          equipmentCount: plant._count.equipment,
          planTaskCount: plant._count.planTasks,
          maintenanceTaskCount: plant._count.maintenanceTasks,
          taskCount: plant._count.maintenanceTasks + plant._count.planTasks,
          aliases: plant.aliases.map((alias) => ({ id: alias.id, alias: alias.alias, source: alias.source })),
          hhPlan: excelHhBase || hhPlan,
          scheduleHh: excelScheduleHh,
          nextDueDate,
          createdAt: plant.createdAt,
          updatedAt: plant.updatedAt,
        };
      }),
      total,
      take,
      skip,
    };
  }

  async byPsr(user: { role: Role }, psr: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { psr: normalizePsr(psr) },
      include: {
        aliases: { orderBy: { alias: 'asc' } },
        maintenanceTasks: {
          where: { deletedAt: null },
          include: {
            schedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
            executions: { orderBy: { dueDate: 'asc' }, take: 24 },
          },
          orderBy: [{ frecuenciaCodigo: 'asc' }, { descPosicionMant: 'asc' }],
        },
        equipment: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        planTasks: {
          where: { deletedAt: null },
          include: { equipment: true, executions: { orderBy: { dueDate: 'asc' }, take: 12 } },
          orderBy: [{ abc: 'asc' }, { description: 'asc' }],
        },
      },
    });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    if (user.role === Role.VIEWER && !plant.visibleToViewer) throw new ForbiddenException('Plant not visible');
    const statusCounts = await this.prisma.taskExecution.groupBy({
      by: ['status'],
      where: { task: { plantId: plant.id, deletedAt: null } },
      _count: { _all: true },
      _sum: { hhPlanned: true, hhActual: true },
    });
    const nextDueDate =
      plant.maintenanceTasks
        .flatMap((task) => task.executions)
        .filter((execution) => execution.status === ExecStatus.PENDING || execution.status === ExecStatus.OVERDUE)
        .map((execution) => execution.dueDate)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return {
      ...plant,
      kpis: {
        maintenanceTaskCount: plant.maintenanceTasks.length,
        hhBase: plant.maintenanceTasks.reduce((sum, task) => sum + Number(task.hhReal ?? 0), 0),
        nextDueDate,
        statusCounts: statusCounts.map((row) => ({
          status: row.status,
          count: row._count._all,
          hhPlanned: Number(row._sum.hhPlanned ?? 0),
          hhActual: Number(row._sum.hhActual ?? 0),
        })),
      },
    };
  }

  async summary(user: { role: Role }, psr: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { psr: normalizePsr(psr) },
      include: {
        equipment: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        planTasks: {
          where: { deletedAt: null },
          include: { equipment: true },
          orderBy: [{ abc: 'asc' }, { description: 'asc' }],
        },
      },
    });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    if (user.role === Role.VIEWER && !plant.visibleToViewer) throw new ForbiddenException('Plant not visible');

    const taskIds = plant.planTasks.map((task) => task.id);
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const next30 = new Date(todayStart);
    next30.setUTCDate(next30.getUTCDate() + 30);

    const [executions, lastEvidence] = await this.prisma.$transaction([
      this.prisma.operationalExecution.findMany({
        where: { planTaskId: { in: taskIds } },
        include: {
          evidence: { where: ACTIVE_EVIDENCE_WHERE, orderBy: { uploadedAt: 'desc' } },
          planTask: { include: { equipment: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.evidence.findFirst({
        where: { deletedAt: null, execution: { planTask: { plantId: plant.id } } },
        orderBy: { uploadedAt: 'desc' },
        include: { execution: { include: { planTask: { include: { equipment: true } } } } },
      }),
    ]);
    const recentChanges = await this.recentAuditForPlant(plant.id, 8);

    const statusSplit = Object.fromEntries(
      Object.values(OperationalExecutionStatus).map((status) => [
        status,
        executions.filter((execution) => execution.status === status).length,
      ]),
    ) as Record<OperationalExecutionStatus, number>;

    const dueForCompliance = executions.filter(
      (execution) => execution.dueDate <= todayStart && execution.status !== OperationalExecutionStatus.SKIPPED,
    );
    const approvedDue = dueForCompliance.filter((execution) => execution.status === OperationalExecutionStatus.APPROVED).length;
    const complianceRate = dueForCompliance.length ? Math.round((approvedDue / dueForCompliance.length) * 100) : null;
    const hhPlan = plant.planTasks.reduce((acc, task) => acc + Number(task.hhPlan), 0);
    const hhActual = executions.reduce((acc, execution) => acc + Number(execution.hhActual ?? 0), 0);

    const upcoming = executions
      .filter(
        (execution) =>
          execution.dueDate >= todayStart &&
          execution.dueDate <= next30 &&
          OPEN_STATUSES.includes(execution.status),
      )
      .slice(0, 8)
      .map((execution) => ({
        id: execution.id,
        dueDate: execution.dueDate,
        status: execution.status,
        hhPlan: Number(execution.hhPlan),
        evidenceCount: execution.evidence.length,
        planTask: {
          id: execution.planTask.id,
          abc: execution.planTask.abc,
          description: execution.planTask.description,
          equipment: execution.planTask.equipment
            ? {
                id: execution.planTask.equipment.id,
                name: execution.planTask.equipment.name,
                type: execution.planTask.equipment.type,
              }
            : null,
        },
      }));

    return {
      plant: {
        id: plant.id,
        psr: plant.psr,
        name: plant.name,
        description: plant.description,
        area: plant.area,
        color: plant.color,
        status: plant.status,
        visibleToViewer: plant.visibleToViewer,
        equipmentCount: plant.equipment.length,
        planTaskCount: plant.planTasks.length,
      },
      kpis: {
        overdue: executions.filter(
          (execution) => execution.dueDate < todayStart && OPEN_STATUSES.includes(execution.status),
        ).length,
        next30: upcoming.length,
        pendingReview: statusSplit.DONE_PENDING_APPROVAL,
        rejected: statusSplit.REJECTED,
        missingEvidence: executions.filter(
          (execution) =>
            execution.evidence.length === 0 &&
            EVIDENCE_REQUIRED_STATUSES.includes(execution.status),
        ).length,
        complianceRate,
        hhPlan,
        hhActual,
      },
      statusSplit,
      lastEvidence: lastEvidence
        ? {
            id: lastEvidence.id,
            originalName: lastEvidence.originalName,
            mime: lastEvidence.mime,
            sizeBytes: lastEvidence.sizeBytes,
            uploadedAt: lastEvidence.uploadedAt,
            description: lastEvidence.description,
            executionId: lastEvidence.executionId,
            planTask: {
              id: lastEvidence.execution.planTask.id,
              description: lastEvidence.execution.planTask.description,
              equipment: lastEvidence.execution.planTask.equipment
                ? {
                    id: lastEvidence.execution.planTask.equipment.id,
                    name: lastEvidence.execution.planTask.equipment.name,
                  }
                : null,
            },
          }
        : null,
      upcoming,
      recentChanges,
    };
  }

  async history(user: { role: Role }, psr: string, take = 100) {
    const plant = await this.prisma.plant.findUnique({ where: { psr: normalizePsr(psr) } });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    if (user.role === Role.VIEWER && !plant.visibleToViewer) throw new ForbiddenException('Plant not visible');
    return this.recentAuditForPlant(plant.id, take);
  }

  async create(userId: string, dto: UpsertPlantDto, ctx: RequestContext) {
    const clean = sanitizeObject(dto);
    const psr = normalizePsr(clean.psr);
    const exists = await this.prisma.plant.findUnique({ where: { psr } });
    if (exists && !exists.deletedAt) throw new ConflictException('PSR already exists');

    const plant = await this.prisma.plant.create({
      data: {
        psr,
        name: clean.name.trim(),
        description: clean.description,
        area: clean.area,
        color: clean.color,
        status: clean.status ?? PlantStatus.ACTIVE,
        visibleToViewer: clean.visibleToViewer ?? true,
        createdById: userId,
        updatedById: userId,
      },
    });
    await this.audit.record({
      userId,
      action: 'PLANT_CREATE',
      entity: 'Plant',
      entityId: plant.id,
      after: plant,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return plant;
  }

  async update(userId: string, psr: string, dto: UpdatePlantDto, ctx: RequestContext) {
    const before = await this.prisma.plant.findUnique({
      where: { psr: normalizePsr(psr) },
      include: { aliases: true },
    });
    if (!before || before.deletedAt) throw new NotFoundException('Plant not found');
    const clean = sanitizeObject(dto);
    const { aliases, ...plantData } = clean;
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.plant.update({
        where: { id: before.id },
        data: {
          ...plantData,
          updatedById: userId,
        },
        include: { aliases: { orderBy: { alias: 'asc' } } },
      });

      if (aliases) {
        const desired = [...new Set([updated.name, ...aliases].map((alias) => alias.trim()).filter(Boolean))];
        const desiredNormalized = new Set(desired.map((alias) => normalizePlantAlias(alias)));
        await tx.plantAlias.deleteMany({
          where: {
            plantId: before.id,
            source: { in: ['USER', 'SYSTEM', 'EXCEL_CANDIDATE'] },
            normalizedAlias: { notIn: [...desiredNormalized] },
          },
        });
        for (const alias of desired) {
          const normalizedAlias = normalizePlantAlias(alias);
          if (!normalizedAlias) continue;
          await tx.plantAlias.upsert({
            where: { normalizedAlias },
            update: { plantId: before.id, alias, source: 'USER' },
            create: { plantId: before.id, alias, normalizedAlias, source: 'USER' },
          });
        }
      }

      return tx.plant.findUniqueOrThrow({
        where: { id: before.id },
        include: { aliases: { orderBy: { alias: 'asc' } } },
      });
    });
    await this.audit.record({
      userId,
      action: 'PLANT_UPDATE',
      entity: 'Plant',
      entityId: before.id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return after;
  }

  async remove(userId: string, psr: string, dto: DeletePlantDto, ctx: RequestContext) {
    const before = await this.prisma.plant.findUnique({ where: { psr: normalizePsr(psr) } });
    if (!before || before.deletedAt) throw new NotFoundException('Plant not found');
    const after = await this.prisma.plant.update({
      where: { id: before.id },
      data: {
        status: PlantStatus.INACTIVE,
        inactiveReason: sanitizeObject(dto).reason,
        deletedAt: new Date(),
        updatedById: userId,
      },
    });
    await this.audit.record({
      userId,
      action: 'PLANT_DELETE',
      entity: 'Plant',
      entityId: before.id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  private async entityIdsForPlant(plantId: string) {
    const equipment = await this.prisma.equipment.findMany({ where: { plantId }, select: { id: true } });
    const planTasks = await this.prisma.maintenancePlanTask.findMany({ where: { plantId }, select: { id: true } });
    const executions = planTasks.length
      ? await this.prisma.operationalExecution.findMany({
          where: { planTaskId: { in: planTasks.map((task) => task.id) } },
          select: { id: true },
        })
      : [];
    const evidence = executions.length
      ? await this.prisma.evidence.findMany({
          where: { executionId: { in: executions.map((execution) => execution.id) } },
          select: { id: true },
        })
      : [];

    return {
      Plant: [plantId],
      Equipment: equipment.map((item) => item.id),
      MaintenancePlanTask: planTasks.map((item) => item.id),
      OperationalExecution: executions.map((item) => item.id),
      Evidence: evidence.map((item) => item.id),
    };
  }

  private async recentAuditForPlant(plantId: string, take: number) {
    const ids = await this.entityIdsForPlant(plantId);
    const or = Object.entries(ids)
      .filter(([, values]) => values.length > 0)
      .map(([entity, values]) => ({ entity, entityId: { in: values } }));

    if (or.length === 0) return [];

    const rows = await this.prisma.auditLog.findMany({
      where: { OR: or },
      take: Math.min(Math.max(take, 1), 500),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, role: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      createdAt: row.createdAt,
      user: row.user ? { email: row.user.email, role: row.user.role } : null,
      before: row.before,
      after: row.after,
    }));
  }
}

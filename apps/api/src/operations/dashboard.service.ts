import { Injectable } from '@nestjs/common';
import { OperationalExecutionStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES: OperationalExecutionStatus[] = [
  OperationalExecutionStatus.SCHEDULED,
  OperationalExecutionStatus.IN_PROGRESS,
  OperationalExecutionStatus.DONE_PENDING_APPROVAL,
  OperationalExecutionStatus.REJECTED,
  OperationalExecutionStatus.POSTPONED,
];

const EVIDENCE_REQUIRED: OperationalExecutionStatus[] = [
  OperationalExecutionStatus.DONE_PENDING_APPROVAL,
  OperationalExecutionStatus.APPROVED,
  OperationalExecutionStatus.REJECTED,
];

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async hoy(user: { role: Role }) {
    const today = startOfUtcDay(new Date());
    const next7 = addUtcDays(today, 7);
    const last30 = addUtcDays(today, -30);

    const visibilityFilter: Prisma.OperationalExecutionWhereInput = {
      planTask: {
        deletedAt: null,
        plant: {
          deletedAt: null,
          ...(user.role === Role.VIEWER && { visibleToViewer: true }),
        },
      },
    };

    const [overdue, pendingReview, todayList, upcomingList, missingEvidence, recentApproved] =
      await this.prisma.$transaction([
        this.prisma.operationalExecution.count({
          where: {
            ...visibilityFilter,
            status: { in: OPEN_STATUSES },
            dueDate: { lt: today },
          },
        }),
        this.prisma.operationalExecution.count({
          where: { ...visibilityFilter, status: OperationalExecutionStatus.DONE_PENDING_APPROVAL },
        }),
        this.prisma.operationalExecution.findMany({
          where: {
            ...visibilityFilter,
            status: { in: OPEN_STATUSES },
            dueDate: { gte: today, lt: addUtcDays(today, 1) },
          },
          orderBy: [{ dueDate: 'asc' }],
          take: 25,
          include: this.executionInclude(),
        }),
        this.prisma.operationalExecution.findMany({
          where: {
            ...visibilityFilter,
            status: { in: OPEN_STATUSES },
            dueDate: { gte: today, lt: next7 },
          },
          orderBy: [{ dueDate: 'asc' }],
          take: 50,
          include: this.executionInclude(),
        }),
        this.prisma.operationalExecution.count({
          where: {
            ...visibilityFilter,
            status: { in: EVIDENCE_REQUIRED },
            evidence: { none: { deletedAt: null } },
          },
        }),
        this.prisma.operationalExecution.count({
          where: {
            ...visibilityFilter,
            status: OperationalExecutionStatus.APPROVED,
            approvedAt: { gte: last30 },
          },
        }),
      ]);

    const todayTotalHh = todayList.reduce((acc, row) => acc + Number(row.hhPlan), 0);

    return {
      kpis: {
        overdue,
        pendingReview,
        missingEvidence,
        recentApproved,
        todayCount: todayList.length,
        todayHhPlan: todayTotalHh,
      },
      today: todayList.map((row) => this.toRow(row)),
      upcoming: upcomingList.map((row) => this.toRow(row)),
    };
  }

  async semana(user: { role: Role }, weekOffset = 0) {
    const today = startOfUtcDay(new Date());
    const monday = startOfWeek(today, weekOffset);
    const nextMonday = addUtcDays(monday, 7);

    const rows = await this.prisma.operationalExecution.findMany({
      where: {
        planTask: {
          deletedAt: null,
          plant: {
            deletedAt: null,
            ...(user.role === Role.VIEWER && { visibleToViewer: true }),
          },
        },
        dueDate: { gte: monday, lt: nextMonday },
      },
      orderBy: [{ dueDate: 'asc' }],
      include: this.executionInclude(),
    });

    const days = Array.from({ length: 7 }).map((_, idx) => {
      const day = addUtcDays(monday, idx);
      const dayItems = rows.filter((row) => sameUtcDay(row.dueDate, day));
      return {
        date: day,
        weekday: day.getUTCDay(),
        hhPlan: dayItems.reduce((acc, row) => acc + Number(row.hhPlan), 0),
        items: dayItems.map((row) => this.toRow(row)),
      };
    });

    return {
      weekStart: monday,
      weekEnd: addUtcDays(monday, 6),
      totalHhPlan: rows.reduce((acc, row) => acc + Number(row.hhPlan), 0),
      totalItems: rows.length,
      days,
    };
  }

  private executionInclude() {
    return {
      evidence: { where: { deletedAt: null }, select: { id: true } },
      planTask: {
        include: {
          equipment: true,
          plant: { select: { id: true, psr: true, name: true, area: true, color: true, visibleToViewer: true } },
        },
      },
    };
  }

  private toRow(
    row: Prisma.OperationalExecutionGetPayload<{ include: ReturnType<DashboardService['executionInclude']> }>,
  ) {
    return {
      id: row.id,
      dueDate: row.dueDate,
      status: row.status,
      hhPlan: Number(row.hhPlan),
      hhActual: row.hhActual === null ? null : Number(row.hhActual),
      evidenceCount: row.evidence.length,
      planTask: {
        id: row.planTask.id,
        abc: row.planTask.abc,
        description: row.planTask.description,
        equipment: row.planTask.equipment
          ? { id: row.planTask.equipment.id, name: row.planTask.equipment.name, type: row.planTask.equipment.type }
          : null,
        plant: row.planTask.plant,
      },
    };
  }
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(d: Date, offset = 0) {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(addUtcDays(d, diff), offset * 7);
}

function sameUtcDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

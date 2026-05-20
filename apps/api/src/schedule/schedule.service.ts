import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ExecStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MaterializeService } from './materialize.service';
import { normalizePlantAlias } from '../operations/plant-catalog.service';
import type {
  CreateSavedViewDto,
  ExecutionExportFormat,
  ExecutionGroupField,
  ExecutionSortField,
  ExportExecutionsDto,
  GroupExecutionsDto,
  HeatmapDto,
  ListExecutionsDto,
  MatrixDto,
  PlantListDto,
  PlantSortField,
  PipelineDto,
  UpdateSavedViewDto,
} from './schedule.dto';

const TASK_SELECT = {
  id: true,
  descPosicionMant: true,
  denomObjetoTecnico: true,
  ubicacionTecnica: true,
  denomUbicacionTecnica: true,
  indicadorAbc: true,
  psr: true,
  frecuenciaCodigo: true,
  equipo: true,
  hhReal: true,
  centroPlanificacion: true,
  ptoTbjoResponsable: true,
  comentarios: true,
  plant: { select: { id: true, psr: true, name: true, status: true } },
} as const;

const EXECUTION_STATUSES: ExecStatus[] = [
  ExecStatus.PENDING,
  ExecStatus.OVERDUE,
  ExecStatus.DONE,
  ExecStatus.SKIPPED,
];

const SAVED_VIEW_FILTER_KEYS = [
  'q',
  'plantId',
  'planta',
  'status',
  'abc',
  'frecuencia',
  'psr',
  'centroPlanificacion',
  'equipo',
  'ubicacionTecnica',
  'yearFrom',
  'monthFrom',
  'yearTo',
  'monthTo',
  'sortBy',
  'sortDir',
  'groupBy',
  'take',
] as const;

type ExecutionFilterQuery = {
  q?: string;
  status?: ExecStatus;
  abc?: string;
  frecuencia?: string;
  psr?: string;
  plantId?: string;
  planta?: string;
  centroPlanificacion?: string;
  equipo?: string;
  ubicacionTecnica?: string;
  yearFrom?: number;
  monthFrom?: number;
  yearTo?: number;
  monthTo?: number;
};

type SavedViewFilterMutation = ExecutionFilterQuery & {
  sortBy?: ExecutionSortField;
  sortDir?: Prisma.SortOrder;
  groupBy?: ExecutionGroupField;
  take?: number;
};

type ExecutionListRow = Prisma.TaskExecutionGetPayload<{
  include: { task: { select: typeof TASK_SELECT } };
}>;

type PlantTaskRef = {
  id: string;
  descPosicionMant: string | null;
  denomObjetoTecnico: string | null;
  ubicacionTecnica: string | null;
  denomUbicacionTecnica: string | null;
  indicadorAbc: string | null;
  psr: string | null;
  centroPlanificacion: string | null;
  ptoTbjoResponsable: string | null;
  comentarios: string | null;
  plant: {
    id: string;
    psr: string;
    name: string;
    status: string;
  } | null;
};

type PlantAccumulator = {
  key: string;
  id: string | null;
  statusLabel: string | null;
  name: string;
  locationCode: string | null;
  centroPlanificacion: string | null;
  psr: string | null;
  executionCount: number;
  taskIds: Set<string>;
  interventionKeys: Set<string>;
  totalHhPlanned: number;
  totalHhActual: number;
  status: Record<ExecStatus, number>;
  abc: Record<'A' | 'B' | 'C' | 'otros', number>;
  abcAOverdue: number;
  reviewFlags: number;
  nextDueDate: Date | null;
  responsibleAreas: Map<string, number>;
};

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private materialize: MaterializeService,
  ) {}

  async monthly(year: number, month: number) {
    const rows = await this.prisma.monthlySchedule.findMany({
      where: { year, month, task: { deletedAt: null } },
      include: { task: { select: TASK_SELECT } },
      orderBy: [{ task: { indicadorAbc: 'asc' } }, { hh: 'desc' }],
    });
    const totalHh = rows.reduce((acc, r) => acc + Number(r.hh), 0);
    return { year, month, totalHh, count: rows.length, rows };
  }

  /**
   * Matriz cronograma estilo SAP-PM: una fila por tarea, columnas por mes,
   * celda marcada con el estado de la ejecución en ese mes.
   * Replica el artefacto central del Excel pero con estado operativo.
   */
  async matrix(query: MatrixDto) {
    await this.materialize.markOverdue();
    const yearFrom = Math.min(query.yearFrom, query.yearTo);
    const yearTo = Math.max(query.yearFrom, query.yearTo);
    const from = new Date(Date.UTC(yearFrom, 0, 1));
    const to = new Date(Date.UTC(yearTo + 1, 0, 1));

    const q = query.q?.trim();
    const taskWhere: Prisma.MaintenanceTaskWhereInput = {
      deletedAt: null,
      ...(query.plantId ? { plantId: query.plantId } : {}),
      ...(q
        ? {
            OR: [
              { descPosicionMant: { contains: q, mode: 'insensitive' } },
              { denomObjetoTecnico: { contains: q, mode: 'insensitive' } },
              { ubicacionTecnica: { contains: q, mode: 'insensitive' } },
              { equipo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const tasks = await this.prisma.maintenanceTask.findMany({
      where: taskWhere,
      select: {
        id: true,
        descPosicionMant: true,
        denomObjetoTecnico: true,
        ubicacionTecnica: true,
        equipo: true,
        indicadorAbc: true,
        frecuenciaCodigo: true,
        plant: { select: { id: true, name: true } },
        executions: {
          where: { dueDate: { gte: from, lt: to } },
          select: { dueDate: true, status: true, hhPlanned: true },
        },
      },
      orderBy: [{ plant: { name: 'asc' } }, { indicadorAbc: 'asc' }, { descPosicionMant: 'asc' }],
      take: 2000,
    });

    const rows = tasks.map((t) => {
      const cells = t.executions.map((e) => ({
        year: e.dueDate.getUTCFullYear(),
        month: e.dueDate.getUTCMonth() + 1,
        status: e.status,
        hhPlanned: Number(e.hhPlanned),
      }));
      return {
        id: t.id,
        label: t.descPosicionMant ?? t.denomObjetoTecnico ?? 'Sin descripción',
        location: t.ubicacionTecnica ?? t.equipo ?? null,
        abc: t.indicadorAbc,
        frecuencia: t.frecuenciaCodigo,
        plant: t.plant ? { id: t.plant.id, name: t.plant.name } : null,
        cells,
      };
    });

    return { yearFrom, yearTo, taskCount: rows.length, rows };
  }

  async yearSummary(year: number) {
    const rows = await this.prisma.monthlySchedule.groupBy({
      by: ['month'],
      where: { year, task: { deletedAt: null } },
      _sum: { hh: true },
      _count: { taskId: true },
    });
    return rows
      .map((r) => ({ month: r.month, totalHh: Number(r._sum.hh ?? 0), count: r._count.taskId }))
      .sort((a, b) => a.month - b.month);
  }

  async kpis() {
    const activeTaskWhere = { deletedAt: null } satisfies Prisma.MaintenanceTaskWhereInput;
    const [taskCount, plantCount, abcSplit, freqSplit, pendingCount, overdueCount, doneCount, skippedCount, discCount, plants] =
      await this.prisma.$transaction([
        this.prisma.maintenanceTask.count({ where: activeTaskWhere }),
        this.prisma.plant.count({ where: { deletedAt: null, maintenanceTasks: { some: activeTaskWhere } } }),
        this.prisma.maintenanceTask.groupBy({
          by: ['indicadorAbc'],
          where: activeTaskWhere,
          _count: { _all: true },
          orderBy: { indicadorAbc: 'asc' },
        }),
        this.prisma.maintenanceTask.groupBy({
          by: ['frecuenciaCodigo'],
          where: activeTaskWhere,
          _count: { _all: true },
          orderBy: { frecuenciaCodigo: 'asc' },
        }),
        this.prisma.taskExecution.count({ where: { status: ExecStatus.PENDING, task: activeTaskWhere } }),
        this.prisma.taskExecution.count({ where: { status: ExecStatus.OVERDUE, task: activeTaskWhere } }),
        this.prisma.taskExecution.count({ where: { status: ExecStatus.DONE, task: activeTaskWhere } }),
        this.prisma.taskExecution.count({ where: { status: ExecStatus.SKIPPED, task: activeTaskWhere } }),
        this.prisma.maintenanceTask.count({ where: { ...activeTaskWhere, hasDiscrepancy: true } }),
        this.prisma.plant.findMany({
          where: { deletedAt: null, maintenanceTasks: { some: activeTaskWhere } },
          select: {
            id: true,
            name: true,
            status: true,
            _count: { select: { maintenanceTasks: { where: activeTaskWhere } } },
          },
          orderBy: { name: 'asc' },
          take: 50,
        }),
      ]);
    return {
      taskCount,
      plantCount,
      abcSplit,
      freqSplit,
      pendingCount,
      overdueCount,
      doneCount,
      skippedCount,
      discCount,
      plantsByTasks: plants
        .map((plant) => ({ id: plant.id, name: plant.name, status: plant.status, taskCount: plant._count.maintenanceTasks }))
        .sort((a, b) => b.taskCount - a.taskCount || a.name.localeCompare(b.name)),
    };
  }

  async heatmap(query: HeatmapDto) {
    const taskWhere = this.taskWhereFromQuery(query, false);
    const rows = await this.prisma.monthlySchedule.groupBy({
      by: ['year', 'month'],
      where: {
        year: { gte: query.from, lte: query.to },
        task: { deletedAt: null },
        ...(Object.keys(taskWhere).length > 0 && { task: taskWhere }),
      },
      _sum: { hh: true },
      _count: { taskId: true },
    });
    return rows
      .map((r) => {
        const hh = Number(r._sum.hh ?? 0);
        return { year: r.year, month: r.month, totalHh: hh > 0 ? hh : r._count.taskId, count: r._count.taskId };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }

  async upcoming(days: number) {
    await this.materialize.markOverdue();
    const now = new Date();
    const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    const rows = await this.prisma.taskExecution.findMany({
      where: {
        status: ExecStatus.PENDING,
        dueDate: { gte: startOfMonth(now), lte: horizon },
        task: { deletedAt: null },
      },
      include: { task: { select: TASK_SELECT } },
      orderBy: [{ dueDate: 'asc' }, { task: { indicadorAbc: 'asc' } }],
    });
    const totalHh = rows.reduce((a, r) => a + Number(r.hhPlanned), 0);
    return { days, count: rows.length, totalHh, rows };
  }

  async overdue() {
    await this.materialize.markOverdue();
    const rows = await this.prisma.taskExecution.findMany({
      where: { status: ExecStatus.OVERDUE, task: { deletedAt: null } },
      include: { task: { select: TASK_SELECT } },
      orderBy: [{ dueDate: 'asc' }, { task: { indicadorAbc: 'asc' } }],
    });
    const totalHh = rows.reduce((a, r) => a + Number(r.hhPlanned), 0);
    return { count: rows.length, totalHh, rows };
  }

  async whatsNext() {
    await this.materialize.markOverdue();
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const twoMonthsAhead = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
    const threeMonthsAhead = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));

    const orderByPriority: Prisma.TaskExecutionOrderByWithRelationInput[] = [
      { task: { indicadorAbc: 'asc' } },
      { hhPlanned: 'desc' },
      { dueDate: 'asc' },
    ];

    const [overdue, thisMonth, nextMonth, inTwoMonths] = await this.prisma.$transaction([
      this.prisma.taskExecution.findMany({
        where: { status: ExecStatus.OVERDUE },
        include: { task: { select: TASK_SELECT } },
        orderBy: [{ dueDate: 'asc' }, { task: { indicadorAbc: 'asc' } }],
        take: 300,
      }),
      this.prisma.taskExecution.findMany({
        where: {
          status: ExecStatus.PENDING,
          dueDate: { gte: thisMonthStart, lt: nextMonthStart },
        },
        include: { task: { select: TASK_SELECT } },
        orderBy: orderByPriority,
        take: 300,
      }),
      this.prisma.taskExecution.findMany({
        where: {
          status: ExecStatus.PENDING,
          dueDate: { gte: nextMonthStart, lt: twoMonthsAhead },
        },
        include: { task: { select: TASK_SELECT } },
        orderBy: orderByPriority,
        take: 300,
      }),
      this.prisma.taskExecution.findMany({
        where: {
          status: ExecStatus.PENDING,
          dueDate: { gte: twoMonthsAhead, lt: threeMonthsAhead },
        },
        include: { task: { select: TASK_SELECT } },
        orderBy: orderByPriority,
        take: 300,
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      thisMonthLabel: monthLabel(thisMonthStart),
      nextMonthLabel: monthLabel(nextMonthStart),
      twoMonthsLabel: monthLabel(twoMonthsAhead),
      buckets: [
        makeBucket('overdue', 'Vencidas', 'danger', overdue),
        makeBucket('thisMonth', 'Este mes', 'warn', thisMonth),
        makeBucket('nextMonth', 'Próximo mes', 'brand', nextMonth),
        makeBucket('inTwoMonths', 'En 2 meses', 'ok', inTwoMonths),
      ],
    };
  }

  async plants(query: PlantListDto) {
    await this.materialize.markOverdue();
    const where = this.executionWhere(query);
    const rows = await this.prisma.taskExecution.findMany({
      where,
      select: {
        id: true,
        dueDate: true,
        status: true,
        hhPlanned: true,
        hhActual: true,
        task: {
          select: {
          id: true,
          plant: { select: { id: true, psr: true, name: true, status: true } },
          descPosicionMant: true,
            denomObjetoTecnico: true,
            ubicacionTecnica: true,
            denomUbicacionTecnica: true,
            indicadorAbc: true,
            psr: true,
            frecuenciaCodigo: true,
            equipo: true,
            centroPlanificacion: true,
            ptoTbjoResponsable: true,
            comentarios: true,
          },
        },
      },
    });

    const grouped = new Map<string, PlantAccumulator>();
    for (const row of rows) {
      const key = plantKey(row.task);
      const prev = grouped.get(key) ?? makePlantAccumulator(key, row.task);
      prev.executionCount += 1;
      prev.totalHhPlanned += Number(row.hhPlanned);
      prev.totalHhActual += Number(row.hhActual ?? 0);
      prev.taskIds.add(row.task.id);
      prev.interventionKeys.add(row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? row.task.id);
      prev.abc[row.task.indicadorAbc === 'A' || row.task.indicadorAbc === 'B' || row.task.indicadorAbc === 'C' ? row.task.indicadorAbc : 'otros'] += 1;
      prev.status[row.status] += 1;
      if (row.status === ExecStatus.OVERDUE && row.task.indicadorAbc === 'A') prev.abcAOverdue += 1;
      if (row.status === ExecStatus.PENDING && (!prev.nextDueDate || row.dueDate < prev.nextDueDate)) prev.nextDueDate = row.dueDate;
      if (row.task.ptoTbjoResponsable?.trim()) {
        const area = row.task.ptoTbjoResponsable.trim();
        prev.responsibleAreas.set(area, (prev.responsibleAreas.get(area) ?? 0) + 1);
      }
      if (/inactiv|verificar|revisar/i.test(row.task.comentarios ?? '')) prev.reviewFlags += 1;
      grouped.set(key, prev);
    }

    const plants = [...grouped.values()]
      .map((plant) => {
        const riskScore = plant.status.OVERDUE * 4 + plant.status.PENDING + plant.abcAOverdue * 3 + plant.reviewFlags * 2;
        return {
          key: plant.key,
          id: plant.id,
          name: plant.name,
          statusLabel: plant.statusLabel,
          locationCode: plant.locationCode,
          centroPlanificacion: plant.centroPlanificacion,
          psr: plant.psr,
          executionCount: plant.executionCount,
          taskCount: plant.taskIds.size,
          interventionCount: plant.interventionKeys.size,
          totalHhPlanned: round1(plant.totalHhPlanned),
          totalHhActual: round1(plant.totalHhActual),
          status: plant.status,
          abcSplit: plant.abc,
          abcAOverdue: plant.abcAOverdue,
          reviewFlags: plant.reviewFlags,
          riskScore,
          nextDueDate: plant.nextDueDate?.toISOString() ?? null,
          responsibleAreas: [...plant.responsibleAreas.entries()]
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
            .slice(0, 4),
        };
      })
      .sort(plantSorter(query.sortBy))
      .slice(0, Math.min(query.take ?? 100, 500));

    return {
      count: grouped.size,
      returned: plants.length,
      totals: {
        executions: rows.length,
        hhPlanned: round1(rows.reduce((sum, row) => sum + Number(row.hhPlanned), 0)),
        overdue: rows.filter((row) => row.status === ExecStatus.OVERDUE).length,
        pending: rows.filter((row) => row.status === ExecStatus.PENDING).length,
      },
      rows: plants,
    };
  }

  async executions(query: ListExecutionsDto) {
    await this.materialize.markOverdue();
    const where = this.executionWhere(query);
    const take = Math.min(query.take ?? 25, 500);
    const skip = query.skip ?? 0;
    const orderBy = this.resolveExecutionOrder(query.sortBy, query.sortDir ?? 'asc');

    const [rows, total, totals, pendingAgg, overdueAgg, doneAgg, skippedAgg] = await this.prisma.$transaction([
      this.prisma.taskExecution.findMany({
        where,
        take,
        skip,
        orderBy,
        include: { task: { select: TASK_SELECT } },
      }),
      this.prisma.taskExecution.count({ where }),
      this.prisma.taskExecution.aggregate({
        where,
        _sum: { hhPlanned: true, hhActual: true },
      }),
      this.prisma.taskExecution.aggregate({
        where: { ...where, status: ExecStatus.PENDING },
        _count: { _all: true },
        _sum: { hhPlanned: true, hhActual: true },
      }),
      this.prisma.taskExecution.aggregate({
        where: { ...where, status: ExecStatus.OVERDUE },
        _count: { _all: true },
        _sum: { hhPlanned: true, hhActual: true },
      }),
      this.prisma.taskExecution.aggregate({
        where: { ...where, status: ExecStatus.DONE },
        _count: { _all: true },
        _sum: { hhPlanned: true, hhActual: true },
      }),
      this.prisma.taskExecution.aggregate({
        where: { ...where, status: ExecStatus.SKIPPED },
        _count: { _all: true },
        _sum: { hhPlanned: true, hhActual: true },
      }),
    ]);

    const aggByStatus = {
      [ExecStatus.PENDING]: pendingAgg,
      [ExecStatus.OVERDUE]: overdueAgg,
      [ExecStatus.DONE]: doneAgg,
      [ExecStatus.SKIPPED]: skippedAgg,
    } as const;

    const statusSplit = EXECUTION_STATUSES.map((status) => ({
      status,
      count: aggByStatus[status]._count._all,
      totalHhPlanned: Number(aggByStatus[status]._sum.hhPlanned ?? 0),
      totalHhActual: Number(aggByStatus[status]._sum.hhActual ?? 0),
    }));

    return {
      rows,
      total,
      take,
      skip,
      totalHhPlanned: Number(totals._sum.hhPlanned ?? 0),
      totalHhActual: Number(totals._sum.hhActual ?? 0),
      statusSplit,
    };
  }

  async groupExecutions(query: GroupExecutionsDto) {
    await this.materialize.markOverdue();
    const where = this.executionWhere(query);
    const rows = await this.prisma.taskExecution.findMany({
      where,
      select: {
        status: true,
        hhPlanned: true,
        hhActual: true,
        task: {
          select: {
            indicadorAbc: true,
            frecuenciaCodigo: true,
            psr: true,
            centroPlanificacion: true,
          },
        },
      },
    });

    const grouped = new Map<string, { count: number; totalHhPlanned: number; totalHhActual: number }>();

    for (const row of rows) {
      const key = this.groupExecutionKey(query.groupBy, row);
      const prev = grouped.get(key) ?? { count: 0, totalHhPlanned: 0, totalHhActual: 0 };
      prev.count += 1;
      prev.totalHhPlanned += Number(row.hhPlanned);
      prev.totalHhActual += Number(row.hhActual ?? 0);
      grouped.set(key, prev);
    }

    return {
      groupBy: query.groupBy,
      count: rows.length,
      rows: [...grouped.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    };
  }

  async pipeline(query: PipelineDto) {
    await this.materialize.markOverdue();
    const { fromDate, toDate, fromLabel, toLabel } = this.resolveRange(query);
    const where = this.executionWhere(query);
    const taskWhere = this.taskWhereFromQuery(query, true);
    const importToDate = endOfMonth(toDate);

    const [execRows, importRuns, rebuildRuns, discrepancyCount] = await this.prisma.$transaction([
      this.prisma.taskExecution.findMany({
        where,
        select: {
          dueDate: true,
          status: true,
          hhPlanned: true,
          hhActual: true,
          task: {
            select: {
              indicadorAbc: true,
              frecuenciaCodigo: true,
            },
          },
        },
      }),
      this.prisma.importRun.findMany({
        where: {
          createdAt: {
            gte: fromDate,
            lte: importToDate,
          },
        },
        select: {
          status: true,
          rowsErr: true,
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'SCHEDULE_REBUILD',
          createdAt: {
            gte: fromDate,
            lte: importToDate,
          },
        },
      }),
      this.prisma.maintenanceTask.count({
        where: {
          hasDiscrepancy: true,
          ...taskWhere,
        },
      }),
    ]);

    const byMonthMap = new Map<string, {
      year: number;
      month: number;
      pending: number;
      overdue: number;
      done: number;
      skipped: number;
      plannedHh: number;
      actualHh: number;
    }>();

    const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
    while (cursor <= toDate) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;
      byMonthMap.set(monthKey(year, month), {
        year,
        month,
        pending: 0,
        overdue: 0,
        done: 0,
        skipped: 0,
        plannedHh: 0,
        actualHh: 0,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    let pending = 0;
    let overdue = 0;
    let done = 0;
    let skipped = 0;
    let plannedHh = 0;
    let actualHh = 0;

    const abcMap = new Map<string, number>();
    const freqMap = new Map<string, number>();

    for (const row of execRows) {
      const year = row.dueDate.getUTCFullYear();
      const month = row.dueDate.getUTCMonth() + 1;
      const hit = byMonthMap.get(monthKey(year, month));
      if (!hit) continue;

      const hhPlanned = Number(row.hhPlanned);
      const hhActual = Number(row.hhActual ?? 0);
      hit.plannedHh += hhPlanned;
      hit.actualHh += hhActual;

      plannedHh += hhPlanned;
      actualHh += hhActual;

      if (row.status === ExecStatus.PENDING) {
        hit.pending += 1;
        pending += 1;
      } else if (row.status === ExecStatus.OVERDUE) {
        hit.overdue += 1;
        overdue += 1;
      } else if (row.status === ExecStatus.DONE) {
        hit.done += 1;
        done += 1;
      } else if (row.status === ExecStatus.SKIPPED) {
        hit.skipped += 1;
        skipped += 1;
      }

      const abc = normalizeGroupKey(row.task.indicadorAbc);
      abcMap.set(abc, (abcMap.get(abc) ?? 0) + 1);

      const freq = normalizeGroupKey(row.task.frecuenciaCodigo);
      freqMap.set(freq, (freqMap.get(freq) ?? 0) + 1);
    }

    const importStats = { running: 0, success: 0, partial: 0, total: importRuns.length, rowsErr: 0 };
    for (const run of importRuns) {
      importStats.rowsErr += run.rowsErr;
      const status = run.status.toUpperCase();
      if (status === 'RUNNING') importStats.running += 1;
      else if (status === 'SUCCESS') importStats.success += 1;
      else if (status === 'PARTIAL') importStats.partial += 1;
    }

    const byMonth = [...byMonthMap.values()].map((r) => ({
      ...r,
      backlog: r.pending + r.overdue,
      closed: r.done + r.skipped,
    }));

    const totalCount = pending + overdue + done + skipped;
    const completionRate = totalCount > 0 ? Number(((done / totalCount) * 100).toFixed(1)) : 0;

    return {
      range: { from: fromLabel, to: toLabel },
      totals: {
        pending,
        overdue,
        done,
        skipped,
        plannedHh,
        actualHh,
        completionRate,
      },
      byMonth,
      abcSplit: [...abcMap.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      freqSplit: [...freqMap.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      process: {
        imports: importStats,
        rebuildRuns,
        discrepancyCount,
      },
    };
  }

  async listSavedViews(userId: string) {
    return this.prisma.scheduleSavedView.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSavedView(userId: string, dto: CreateSavedViewDto, ctx: { ip: string; userAgent: string }) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');

    const filters = this.pickSavedViewFilters(dto);
    try {
      const created = await this.prisma.scheduleSavedView.create({
        data: {
          userId,
          name,
          filters: filters as Prisma.InputJsonValue,
        },
      });

      await this.audit.record({
        userId,
        action: 'SCHEDULE_VIEW_CREATE',
        entity: 'ScheduleSavedView',
        entityId: created.id,
        after: created,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('View name already exists');
      }
      throw e;
    }
  }

  async updateSavedView(userId: string, id: string, dto: UpdateSavedViewDto, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.scheduleSavedView.findFirst({ where: { id, userId } });
    if (!before) throw new NotFoundException();

    const data: Prisma.ScheduleSavedViewUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Name is required');
      data.name = name;
    }

    if (this.hasSavedViewFilterMutation(dto)) {
      data.filters = this.pickSavedViewFilters(dto) as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) return before;

    try {
      const after = await this.prisma.scheduleSavedView.update({ where: { id }, data });
      await this.audit.record({
        userId,
        action: 'SCHEDULE_VIEW_UPDATE',
        entity: 'ScheduleSavedView',
        entityId: id,
        before,
        after,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return after;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('View name already exists');
      }
      throw e;
    }
  }

  async deleteSavedView(userId: string, id: string, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.scheduleSavedView.findFirst({ where: { id, userId } });
    if (!before) throw new NotFoundException();

    await this.prisma.scheduleSavedView.delete({ where: { id } });
    await this.audit.record({
      userId,
      action: 'SCHEDULE_VIEW_DELETE',
      entity: 'ScheduleSavedView',
      entityId: id,
      before,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true, id };
  }

  async exportExecutions(query: ExportExecutionsDto): Promise<{ filename: string; contentType: string; content: Buffer }> {
    await this.materialize.markOverdue();

    const where = this.executionWhere(query);
    const orderBy = this.resolveExecutionOrder(query.sortBy, query.sortDir ?? 'asc');
    const take = Math.min(query.take ?? 2000, 5000);

    const rows = await this.prisma.taskExecution.findMany({
      where,
      take,
      orderBy,
      include: { task: { select: TASK_SELECT } },
    });

    const format: ExecutionExportFormat = query.format ?? 'csv';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'xlsx') {
      const content = await this.toExecutionXlsx(rows);
      return {
        filename: `executions-${stamp}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content,
      };
    }

    const content = Buffer.from(this.toExecutionCsv(rows), 'utf-8');
    return {
      filename: `executions-${stamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content,
    };
  }

  private hasSavedViewFilterMutation(dto: UpdateSavedViewDto): boolean {
    const source = dto as Record<string, unknown>;
    return SAVED_VIEW_FILTER_KEYS.some((key) => source[key] !== undefined);
  }

  private pickSavedViewFilters(dto: SavedViewFilterMutation): SavedViewFilterMutation {
    const q = dto.q?.trim();
    const abc = dto.abc?.trim();
    const plantId = dto.plantId?.trim();
    const planta = dto.planta?.trim();
    const frecuencia = dto.frecuencia?.trim();
    const psr = dto.psr?.trim();
    const centroPlanificacion = dto.centroPlanificacion?.trim();
    const equipo = dto.equipo?.trim();
    const ubicacionTecnica = dto.ubicacionTecnica?.trim();

    return {
      ...(q && { q }),
      ...(dto.status && { status: dto.status }),
      ...(plantId && { plantId }),
      ...(planta && { planta }),
      ...(abc && { abc }),
      ...(frecuencia && { frecuencia }),
      ...(psr && { psr }),
      ...(centroPlanificacion && { centroPlanificacion }),
      ...(equipo && { equipo }),
      ...(ubicacionTecnica && { ubicacionTecnica }),
      ...(dto.yearFrom != null && { yearFrom: dto.yearFrom }),
      ...(dto.monthFrom != null && { monthFrom: dto.monthFrom }),
      ...(dto.yearTo != null && { yearTo: dto.yearTo }),
      ...(dto.monthTo != null && { monthTo: dto.monthTo }),
      ...(dto.sortBy && { sortBy: dto.sortBy }),
      ...(dto.sortDir && { sortDir: dto.sortDir }),
      ...(dto.groupBy && { groupBy: dto.groupBy }),
      ...(dto.take != null && { take: Math.min(Math.max(dto.take, 1), 500) }),
    };
  }

  private toExecutionCsv(rows: ExecutionListRow[]): string {
    const headers = [
      'period',
      'dueDate',
      'status',
      'abc',
      'frecuencia',
      'psr',
      'centroPlanificacion',
      'task',
      'hhPlanned',
      'hhActual',
      'operator',
      'notes',
    ];

    const out = [headers.join(',')];
    for (const row of rows) {
      const record = this.toExecutionExportRecord(row);
      out.push(headers.map((key) => csvEscape(record[key as keyof typeof record])).join(','));
    }
    return out.join('\n');
  }

  private async toExecutionXlsx(rows: ExecutionListRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Executions');

    ws.columns = [
      { header: 'Period', key: 'period', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'ABC', key: 'abc', width: 10 },
      { header: 'Frequency', key: 'frecuencia', width: 14 },
      { header: 'PSR', key: 'psr', width: 16 },
      { header: 'Centro Planificacion', key: 'centroPlanificacion', width: 20 },
      { header: 'Task', key: 'task', width: 44 },
      { header: 'HH Planned', key: 'hhPlanned', width: 12 },
      { header: 'HH Actual', key: 'hhActual', width: 12 },
      { header: 'Operator', key: 'operator', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    for (const row of rows) {
      ws.addRow(this.toExecutionExportRecord(row));
    }

    const bytes = await wb.xlsx.writeBuffer();
    return Buffer.from(bytes as ArrayBuffer);
  }

  private toExecutionExportRecord(row: ExecutionListRow) {
    const dueDate = row.dueDate.toISOString().slice(0, 10);
    const period = `${row.dueDate.getUTCFullYear()}-${String(row.dueDate.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      period,
      dueDate,
      status: row.status,
      abc: row.task.indicadorAbc ?? '',
      frecuencia: row.task.frecuenciaCodigo ?? '',
      psr: row.task.psr ?? '',
      centroPlanificacion: row.task.centroPlanificacion ?? '',
      task: row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '',
      hhPlanned: Number(row.hhPlanned),
      hhActual: Number(row.hhActual ?? 0),
      operator: row.operator ?? '',
      notes: row.notes ?? '',
    };
  }

  private executionWhere(query: ExecutionFilterQuery): Prisma.TaskExecutionWhereInput {
    const { fromDate, toDate } = this.resolveRange(query);
    const taskWhere = this.taskWhereFromQuery(query, true);
    const hasTaskFilter = Object.keys(taskWhere).length > 0;

    return {
      dueDate: { gte: fromDate, lte: toDate },
      ...(query.status && { status: query.status }),
      ...(hasTaskFilter && { task: taskWhere }),
    };
  }

  private taskWhereFromQuery(
    query: Pick<ExecutionFilterQuery, 'q' | 'plantId' | 'planta' | 'abc' | 'frecuencia' | 'psr' | 'centroPlanificacion' | 'equipo' | 'ubicacionTecnica'>,
    includeTextSearch: boolean,
  ): Prisma.MaintenanceTaskWhereInput {
    const andFilters: Prisma.MaintenanceTaskWhereInput[] = [];
    if (query.planta) {
      const normalized = normalizePlantAlias(query.planta);
      andFilters.push({
        OR: [
          { plant: { name: { contains: query.planta, mode: 'insensitive' } } },
          { plant: { psr: { contains: query.planta, mode: 'insensitive' } } },
          { plant: { aliases: { some: { normalizedAlias: { contains: normalized } } } } },
          { denomUbicacionTecnica: { contains: query.planta, mode: 'insensitive' } },
        ],
      });
    }
    if (includeTextSearch && query.q) {
      andFilters.push({
        OR: [
          { descPosicionMant: { contains: query.q, mode: 'insensitive' } },
          { denomObjetoTecnico: { contains: query.q, mode: 'insensitive' } },
          { denomUbicacionTecnica: { contains: query.q, mode: 'insensitive' } },
          { comentarios: { contains: query.q, mode: 'insensitive' } },
          { plant: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }

    return {
      deletedAt: null,
      ...(query.plantId && { plantId: query.plantId }),
      ...(query.psr && { psr: query.psr }),
      ...(query.abc && { indicadorAbc: query.abc }),
      ...(query.frecuencia && { frecuenciaCodigo: query.frecuencia }),
      ...(query.centroPlanificacion && { centroPlanificacion: query.centroPlanificacion }),
      ...(query.equipo && { equipo: { contains: query.equipo, mode: 'insensitive' } }),
      ...(query.ubicacionTecnica && { ubicacionTecnica: { contains: query.ubicacionTecnica, mode: 'insensitive' } }),
      ...(andFilters.length > 0 && { AND: andFilters }),
    };
  }

  private resolveExecutionOrder(
    sortBy: ExecutionSortField | undefined,
    sortDir: Prisma.SortOrder,
  ): Prisma.TaskExecutionOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'status':
        return [{ status: sortDir }, { dueDate: 'asc' }];
      case 'hhPlanned':
        return [{ hhPlanned: sortDir }, { dueDate: 'asc' }];
      case 'hhActual':
        return [{ hhActual: sortDir }, { dueDate: 'asc' }];
      case 'abc':
        return [{ task: { indicadorAbc: sortDir } }, { dueDate: 'asc' }];
      case 'frecuencia':
        return [{ task: { frecuenciaCodigo: sortDir } }, { dueDate: 'asc' }];
      case 'psr':
        return [{ task: { psr: sortDir } }, { dueDate: 'asc' }];
      case 'centroPlanificacion':
        return [{ task: { centroPlanificacion: sortDir } }, { dueDate: 'asc' }];
      case 'dueDate':
      default:
        return [{ dueDate: sortDir }, { task: { indicadorAbc: 'asc' } }];
    }
  }

  private groupExecutionKey(
    groupBy: ExecutionGroupField,
    row: {
      status: ExecStatus;
      task: {
        indicadorAbc: string | null;
        frecuenciaCodigo: string | null;
        psr: string | null;
        centroPlanificacion: string | null;
      };
    },
  ): string {
    if (groupBy === 'status') return row.status;
    if (groupBy === 'abc') return normalizeGroupKey(row.task.indicadorAbc);
    if (groupBy === 'frecuencia') return normalizeGroupKey(row.task.frecuenciaCodigo);
    if (groupBy === 'psr') return normalizeGroupKey(row.task.psr);
    return normalizeGroupKey(row.task.centroPlanificacion);
  }

  private resolveRange(query: ExecutionFilterQuery): {
    fromDate: Date;
    toDate: Date;
    fromLabel: string;
    toLabel: string;
  } {
    const now = new Date();
    const yearFrom = query.yearFrom ?? now.getUTCFullYear() - 1;
    const monthFrom = query.monthFrom ?? 1;
    const yearTo = query.yearTo ?? now.getUTCFullYear();
    const monthTo = query.monthTo ?? 12;

    let fromDate = toMonthStart(yearFrom, monthFrom);
    let toDate = toMonthStart(yearTo, monthTo);
    if (toDate < fromDate) {
      const swap = fromDate;
      fromDate = toDate;
      toDate = swap;
    }

    return {
      fromDate,
      toDate,
      fromLabel: `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, '0')}`,
      toLabel: `${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 1).padStart(2, '0')}`,
    };
  }

  async markExecution(
    actorId: string,
    execId: string,
    dto: {
      status?: ExecStatus;
      dueDate?: string;
      hhPlanned?: number;
      hhActual?: number;
      doneDate?: string;
      operator?: string;
      notes?: string;
    },
    ctx: { ip: string; userAgent: string },
  ) {
    const before = await this.prisma.taskExecution.findUnique({ where: { id: execId } });
    if (!before) throw new NotFoundException();

    const data: Prisma.TaskExecutionUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.hhPlanned != null) data.hhPlanned = new Prisma.Decimal(dto.hhPlanned);
    if (dto.hhActual != null) data.hhActual = new Prisma.Decimal(dto.hhActual);
    if (dto.doneDate) data.doneDate = new Date(dto.doneDate);
    if (dto.operator != null) data.operator = dto.operator;
    if (dto.notes != null) data.notes = dto.notes;
    if (dto.status === ExecStatus.DONE && !dto.doneDate) data.doneDate = new Date();
    if (dto.dueDate || dto.hhPlanned != null) data.source = 'MANUAL';

    const after = await this.prisma.taskExecution.update({ where: { id: execId }, data });
    await this.audit.record({
      userId: actorId,
      action: 'EXECUTION_UPDATE',
      entity: 'TaskExecution',
      entityId: execId,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return after;
  }

  rebuild(actorId: string, ctx: { ip: string; userAgent: string }) {
    return this.materialize.rebuildAll(actorId, ctx);
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function toMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function normalizeGroupKey(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : 'Sin dato';
}

function plantKey(task: PlantTaskRef): string {
  return task.plant?.id ?? normalizeGroupKey(task.denomUbicacionTecnica ?? task.ubicacionTecnica);
}

function makePlantAccumulator(key: string, task: PlantTaskRef): PlantAccumulator {
  return {
    key,
    id: task.plant?.id ?? null,
    name: task.plant?.name ?? (normalizeGroupKey(task.denomUbicacionTecnica) === 'Sin dato' ? key : normalizeGroupKey(task.denomUbicacionTecnica)),
    statusLabel: task.plant?.status ?? null,
    locationCode: task.ubicacionTecnica?.trim() || null,
    centroPlanificacion: task.centroPlanificacion?.trim() || null,
    psr: task.psr?.trim() || null,
    executionCount: 0,
    taskIds: new Set<string>(),
    interventionKeys: new Set<string>(),
    totalHhPlanned: 0,
    totalHhActual: 0,
    status: {
      [ExecStatus.PENDING]: 0,
      [ExecStatus.OVERDUE]: 0,
      [ExecStatus.DONE]: 0,
      [ExecStatus.SKIPPED]: 0,
    },
    abc: { A: 0, B: 0, C: 0, otros: 0 },
    abcAOverdue: 0,
    reviewFlags: 0,
    nextDueDate: null,
    responsibleAreas: new Map<string, number>(),
  };
}

function plantSorter(sortBy: PlantSortField | undefined) {
  return (
    a: { name: string; totalHhPlanned: number; status: Record<ExecStatus, number>; riskScore: number; nextDueDate: string | null },
    b: { name: string; totalHhPlanned: number; status: Record<ExecStatus, number>; riskScore: number; nextDueDate: string | null },
  ) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'hh') return b.totalHhPlanned - a.totalHhPlanned || a.name.localeCompare(b.name);
    if (sortBy === 'overdue') return b.status.OVERDUE - a.status.OVERDUE || b.riskScore - a.riskScore || a.name.localeCompare(b.name);
    if (sortBy === 'nextDueDate') {
      if (!a.nextDueDate && !b.nextDueDate) return a.name.localeCompare(b.name);
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return a.nextDueDate.localeCompare(b.nextDueDate) || a.name.localeCompare(b.name);
    }
    return b.riskScore - a.riskScore || b.totalHhPlanned - a.totalHhPlanned || a.name.localeCompare(b.name);
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function monthLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function makeBucket(
  id: 'overdue' | 'thisMonth' | 'nextMonth' | 'inTwoMonths',
  label: string,
  tone: 'danger' | 'warn' | 'brand' | 'ok',
  rows: ExecutionListRow[],
) {
  const totalHh = rows.reduce((acc, r) => acc + Number(r.hhPlanned), 0);
  const abc: Record<'A' | 'B' | 'C' | 'otros', number> = { A: 0, B: 0, C: 0, otros: 0 };
  const freq = new Map<string, number>();
  for (const r of rows) {
    const k = r.task.indicadorAbc ?? '';
    if (k === 'A' || k === 'B' || k === 'C') abc[k] += 1;
    else abc.otros += 1;
    const fc = r.task.frecuenciaCodigo ?? 'Sin frec';
    freq.set(fc, (freq.get(fc) ?? 0) + 1);
  }
  return {
    id,
    label,
    tone,
    count: rows.length,
    totalHh: Number(totalHh.toFixed(1)),
    abcSplit: abc,
    freqSplit: [...freq.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    rows,
  };
}

function csvEscape(value: string | number): string {
  const raw = String(value ?? '');
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

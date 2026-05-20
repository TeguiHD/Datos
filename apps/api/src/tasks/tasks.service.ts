import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeleteTaskDto, ListTasksDto, UpsertScheduleDto, UpsertTaskDto } from './tasks.dto';
import { normalizePlantAlias } from '../operations/plant-catalog.service';
import { MaterializeService } from '../schedule/materialize.service';

function sanitize<T extends object>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? DOMPurify.sanitize(v, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) : v;
  }
  return out as T;
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private materialize: MaterializeService,
  ) {}

  async list(query: ListTasksDto) {
    const {
      q,
      psr,
      plantId,
      planta,
      tipo,
      abc,
      frecuencia,
      centroPlanificacion,
      equipo,
      ubicacionTecnica,
      year,
      month,
      take = 50,
      skip = 0,
    } = query;

    const where: Prisma.MaintenanceTaskWhereInput = {
      ...taskWhereFromQuery({ q, psr, plantId, planta, tipo, abc, frecuencia, centroPlanificacion, equipo, ubicacionTecnica }),
      ...(year && month && { schedule: { some: { year, month } } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.maintenanceTask.findMany({
        where,
        take: Math.min(take, 500),
        skip,
        orderBy: [{ indicadorAbc: 'asc' }, { descPosicionMant: 'asc' }],
        include: {
          plant: { include: { aliases: { orderBy: { alias: 'asc' } } } },
          ...(year && month ? { schedule: { where: { year, month } } } : {}),
        },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return { rows, total, take, skip };
  }

  async plants(query: ListTasksDto) {
    const where = taskWhereFromQuery(query);
    const tasks = await this.prisma.maintenanceTask.findMany({
      where,
      take: 5000,
      select: {
        id: true,
        descPosicionMant: true,
        denomObjetoTecnico: true,
        comentarios: true,
        indicadorAbc: true,
        ubicacionTecnica: true,
        denomUbicacionTecnica: true,
        centroPlanificacion: true,
        ptoTbjoResponsable: true,
        equipo: true,
        frecuenciaCodigo: true,
        hhReal: true,
        plant: { include: { aliases: { orderBy: { alias: 'asc' } } } },
        schedule: { select: { year: true, month: true, hh: true } },
      },
    });

    const groups = new Map<string, ImportedPlantAccumulator>();
    const currentMonth = new Date();
    const currentIdx = currentMonth.getUTCFullYear() * 12 + currentMonth.getUTCMonth();

    for (const task of tasks) {
      const key = task.plant?.id ?? normalizeGroupKey(task.denomUbicacionTecnica ?? task.ubicacionTecnica);
      const group = groups.get(key) ?? makeImportedPlantAccumulator(key, task);
      group.taskCount++;
      group.hhBase += Number(task.hhReal ?? 0);
      group.monthlyHh += task.schedule.reduce((sum, item) => sum + Number(item.hh), 0);
      group.scheduleCells += task.schedule.length;
      group.abc[task.indicadorAbc === 'A' || task.indicadorAbc === 'B' || task.indicadorAbc === 'C' ? task.indicadorAbc : 'otros']++;
      if (task.equipo?.trim()) group.equipment.add(task.equipo.trim());
      if (task.frecuenciaCodigo?.trim()) group.frequencies.set(task.frecuenciaCodigo.trim(), (group.frequencies.get(task.frecuenciaCodigo.trim()) ?? 0) + 1);
      if (task.ptoTbjoResponsable?.trim()) group.responsibleAreas.set(task.ptoTbjoResponsable.trim(), (group.responsibleAreas.get(task.ptoTbjoResponsable.trim()) ?? 0) + 1);
      if (/inactiv|verificar|revisar/i.test(task.comentarios ?? '')) group.reviewFlags++;

      for (const item of task.schedule) {
        const idx = item.year * 12 + (item.month - 1);
        if (idx >= currentIdx && (!group.nextSchedule || idx < group.nextSchedule.idx)) {
          group.nextSchedule = { idx, year: item.year, month: item.month };
        }
      }

      groups.set(key, group);
    }

    const rows = [...groups.values()]
      .map((group) => ({
        key: group.key,
        id: group.id,
        psr: group.psr,
        name: group.name,
        status: group.status,
        aliases: group.aliases,
        locationCode: group.locationCode,
        centroPlanificacion: group.centroPlanificacion,
        taskCount: group.taskCount,
        equipmentCount: group.equipment.size,
        scheduleCells: group.scheduleCells,
        hhBase: round1(group.hhBase),
        monthlyHh: round1(group.monthlyHh),
        abcSplit: group.abc,
        reviewFlags: group.reviewFlags,
        nextSchedule: group.nextSchedule ? `${group.nextSchedule.year}-${String(group.nextSchedule.month).padStart(2, '0')}` : null,
        frequencies: [...group.frequencies.entries()]
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
          .slice(0, 4),
        responsibleAreas: [...group.responsibleAreas.entries()]
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
          .slice(0, 4),
      }))
      .sort((a, b) => b.reviewFlags - a.reviewFlags || b.taskCount - a.taskCount || b.monthlyHh - a.monthlyHh || a.name.localeCompare(b.name));

    return {
      count: rows.length,
      totals: {
        tasks: tasks.length,
        equipment: rows.reduce((sum, row) => sum + row.equipmentCount, 0),
        scheduleCells: rows.reduce((sum, row) => sum + row.scheduleCells, 0),
        hhBase: round1(rows.reduce((sum, row) => sum + row.hhBase, 0)),
        monthlyHh: round1(rows.reduce((sum, row) => sum + row.monthlyHh, 0)),
        reviewFlags: rows.reduce((sum, row) => sum + row.reviewFlags, 0),
      },
      rows,
    };
  }

  async facets() {
    const [plants, frequencies] = await this.prisma.$transaction([
      this.prisma.plant.findMany({
        where: { deletedAt: null, maintenanceTasks: { some: { deletedAt: null } } },
        select: { id: true, psr: true, name: true, status: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.prisma.maintenanceTask.findMany({
        where: { deletedAt: null, frecuenciaCodigo: { not: null } },
        select: { frecuenciaCodigo: true },
        distinct: ['frecuenciaCodigo'],
        orderBy: { frecuenciaCodigo: 'asc' },
      }),
    ]);

    return {
      plants,
      frequencies: frequencies.map((row) => row.frecuenciaCodigo).filter(Boolean),
      serviceTypes: [
        { value: 'mp', label: 'MP / Mantención' },
        { value: 'cal', label: 'Calibración' },
        { value: 'emr', label: 'EMR / ERM' },
        { value: 'dresser', label: 'Dresser' },
      ],
    };
  }

  async byId(id: string) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        plant: { include: { aliases: { orderBy: { alias: 'asc' } } } },
        schedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
        executions: { orderBy: { dueDate: 'asc' }, take: 24 },
      },
    });
    if (!task || task.deletedAt) throw new NotFoundException();
    return task;
  }

  async create(userId: string, data: UpsertTaskDto, ctx: { ip: string; userAgent: string }) {
    const clean = sanitize(data);
    const task = await this.prisma.maintenanceTask.create({
      data: {
        ...clean,
        hhReal: clean.hhReal ?? 0,
        manualOverride: true,
        deletedAt: null,
      } as never,
    });
    await this.audit.record({
      userId,
      action: 'TASK_CREATE',
      entity: 'MaintenanceTask',
      entityId: task.id,
      after: clean,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.materialize.rebuildAll(userId, ctx);
    return task;
  }

  async update(userId: string, id: string, data: UpsertTaskDto, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.maintenanceTask.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException();
    const clean = sanitize(data);
    const after = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { ...clean, manualOverride: true } as never,
    });
    await this.audit.record({
      userId,
      action: 'TASK_UPDATE',
      entity: 'MaintenanceTask',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.materialize.rebuildAll(userId, ctx);
    return after;
  }

  async remove(userId: string, id: string, dto: DeleteTaskDto, ctx: { ip: string; userAgent: string }) {
    if (dto.confirmation !== 'ELIMINAR') {
      throw new BadRequestException('Debes escribir ELIMINAR para desactivar la tarea');
    }
    const before = await this.prisma.maintenanceTask.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException();
    const after = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { deletedAt: new Date(), manualOverride: true },
    });
    await this.audit.record({
      userId,
      action: 'TASK_DELETE',
      entity: 'MaintenanceTask',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  async upsertSchedule(userId: string, taskId: string, dto: UpsertScheduleDto, ctx: { ip: string; userAgent: string }) {
    const task = await this.prisma.maintenanceTask.findUnique({ where: { id: taskId } });
    if (!task || task.deletedAt) throw new NotFoundException();
    const row = await this.prisma.monthlySchedule.upsert({
      where: { taskId_year_month: { taskId, year: dto.year, month: dto.month } },
      create: { taskId, year: dto.year, month: dto.month, hh: dto.hh, source: 'MANUAL' },
      update: { hh: dto.hh, source: 'MANUAL' },
    });
    await this.audit.record({
      userId,
      action: 'SCHEDULE_UPSERT',
      entity: 'MonthlySchedule',
      entityId: `${taskId}:${dto.year}-${dto.month}`,
      after: row,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.prisma.maintenanceTask.update({ where: { id: taskId }, data: { manualOverride: true } });
    await this.materialize.rebuildAll(userId, ctx);
    return row;
  }
}

function serviceTypeWhere(tipo?: string): Prisma.MaintenanceTaskWhereInput | null {
  const normalized = tipo?.trim().toLowerCase();
  if (!normalized) return null;

  const textFields = ['descPosicionMant', 'denomObjetoTecnico'] as const;
  const containsAny = (tokens: string[]): Prisma.MaintenanceTaskWhereInput => ({
    OR: textFields.flatMap((field) => tokens.map((token) => ({ [field]: { contains: token, mode: 'insensitive' as const } }))),
  });

  if (normalized === 'cal') return containsAny(['CALIBR', 'PRUEBA']);
  if (normalized === 'emr' || normalized === 'erm') return containsAny(['EMR', 'ERM']);
  if (normalized === 'dresser') return containsAny(['DRESSER']);
  if (normalized === 'mp') return containsAny(['MANTEN', 'INSPECCI']);

  return null;
}

function taskWhereFromQuery(query: Pick<ListTasksDto, 'q' | 'psr' | 'plantId' | 'planta' | 'tipo' | 'abc' | 'frecuencia' | 'centroPlanificacion' | 'equipo' | 'ubicacionTecnica'>): Prisma.MaintenanceTaskWhereInput {
  const { q, psr, plantId, planta, tipo, abc, frecuencia, centroPlanificacion, equipo, ubicacionTecnica } = query;
  const andFilters = [serviceTypeWhere(tipo)].filter(Boolean) as Prisma.MaintenanceTaskWhereInput[];
  const normalizedPlanta = normalizePlantAlias(planta);
  if (planta) {
    andFilters.push({
      OR: [
        { plant: { name: { contains: planta, mode: 'insensitive' } } },
        { plant: { psr: { contains: planta, mode: 'insensitive' } } },
        { plant: { aliases: { some: { normalizedAlias: { contains: normalizedPlanta } } } } },
        { denomUbicacionTecnica: { contains: planta, mode: 'insensitive' } },
      ],
    });
  }
  if (q) {
    andFilters.push({
      OR: [
        { descPosicionMant: { contains: q, mode: 'insensitive' } },
        { denomObjetoTecnico: { contains: q, mode: 'insensitive' } },
        { denomUbicacionTecnica: { contains: q, mode: 'insensitive' } },
        { ubicacionTecnica: { contains: q, mode: 'insensitive' } },
        { equipo: { contains: q, mode: 'insensitive' } },
        { comentarios: { contains: q, mode: 'insensitive' } },
        { plant: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }

  return {
    deletedAt: null,
    ...(psr && { psr }),
    ...(plantId && { plantId }),
    ...(abc && { indicadorAbc: abc }),
    ...(frecuencia && { frecuenciaCodigo: frecuencia }),
    ...(centroPlanificacion && { centroPlanificacion }),
    ...(equipo && { equipo: { contains: equipo, mode: 'insensitive' } }),
    ...(ubicacionTecnica && { ubicacionTecnica: { contains: ubicacionTecnica, mode: 'insensitive' } }),
    ...(andFilters.length > 0 && { AND: andFilters }),
  };
}

type ImportedPlantTask = {
  denomUbicacionTecnica: string | null;
  ubicacionTecnica: string | null;
  centroPlanificacion: string | null;
  plant: {
    id: string;
    psr: string;
    name: string;
    status: string;
    aliases: { alias: string }[];
  } | null;
};

type ImportedPlantAccumulator = {
  key: string;
  id: string | null;
  psr: string | null;
  name: string;
  status: string | null;
  aliases: string[];
  locationCode: string | null;
  centroPlanificacion: string | null;
  taskCount: number;
  equipment: Set<string>;
  scheduleCells: number;
  hhBase: number;
  monthlyHh: number;
  abc: { A: number; B: number; C: number; otros: number };
  reviewFlags: number;
  nextSchedule: { idx: number; year: number; month: number } | null;
  frequencies: Map<string, number>;
  responsibleAreas: Map<string, number>;
};

function makeImportedPlantAccumulator(key: string, task: ImportedPlantTask): ImportedPlantAccumulator {
  return {
    key,
    id: task.plant?.id ?? null,
    psr: task.plant?.psr ?? null,
    name: task.plant?.name ?? (normalizeGroupKey(task.denomUbicacionTecnica) === 'Sin dato' ? key : normalizeGroupKey(task.denomUbicacionTecnica)),
    status: task.plant?.status ?? null,
    aliases: task.plant?.aliases.map((alias) => alias.alias) ?? [],
    locationCode: task.ubicacionTecnica?.trim() || null,
    centroPlanificacion: task.centroPlanificacion?.trim() || null,
    taskCount: 0,
    equipment: new Set<string>(),
    scheduleCells: 0,
    hhBase: 0,
    monthlyHh: 0,
    abc: { A: 0, B: 0, C: 0, otros: 0 },
    reviewFlags: 0,
    nextSchedule: null,
    frequencies: new Map<string, number>(),
    responsibleAreas: new Map<string, number>(),
  };
}

function normalizeGroupKey(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : 'Sin dato';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

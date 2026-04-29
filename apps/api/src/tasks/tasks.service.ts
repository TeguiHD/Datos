import { Injectable, NotFoundException } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListTasksDto, UpsertScheduleDto, UpsertTaskDto } from './tasks.dto';

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
  ) {}

  async list(query: ListTasksDto) {
    const { q, psr, abc, frecuencia, centroPlanificacion, equipo, ubicacionTecnica, year, month, take = 50, skip = 0 } =
      query;

    const where: Prisma.MaintenanceTaskWhereInput = {
      ...(psr && { psr }),
      ...(abc && { indicadorAbc: abc }),
      ...(frecuencia && { frecuenciaCodigo: frecuencia }),
      ...(centroPlanificacion && { centroPlanificacion }),
      ...(equipo && { equipo: { contains: equipo, mode: 'insensitive' } }),
      ...(ubicacionTecnica && { ubicacionTecnica: { contains: ubicacionTecnica, mode: 'insensitive' } }),
      ...(q && {
        OR: [
          { descPosicionMant: { contains: q, mode: 'insensitive' } },
          { denomObjetoTecnico: { contains: q, mode: 'insensitive' } },
          { denomUbicacionTecnica: { contains: q, mode: 'insensitive' } },
          { comentarios: { contains: q, mode: 'insensitive' } },
        ],
      }),
      ...(year && month && { schedule: { some: { year, month, hh: { gt: 0 } } } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.maintenanceTask.findMany({
        where,
        take: Math.min(take, 500),
        skip,
        orderBy: [{ indicadorAbc: 'asc' }, { descPosicionMant: 'asc' }],
        include: year && month ? { schedule: { where: { year, month } } } : undefined,
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return { rows, total, take, skip };
  }

  async byId(id: string) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id },
      include: { schedule: { orderBy: [{ year: 'asc' }, { month: 'asc' }] } },
    });
    if (!task) throw new NotFoundException();
    return task;
  }

  async create(userId: string, data: UpsertTaskDto, ctx: { ip: string; userAgent: string }) {
    const clean = sanitize(data);
    const task = await this.prisma.maintenanceTask.create({ data: clean as never });
    await this.audit.record({
      userId,
      action: 'TASK_CREATE',
      entity: 'MaintenanceTask',
      entityId: task.id,
      after: clean,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return task;
  }

  async update(userId: string, id: string, data: UpsertTaskDto, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.maintenanceTask.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const clean = sanitize(data);
    const after = await this.prisma.maintenanceTask.update({ where: { id }, data: clean as never });
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
    return after;
  }

  async remove(userId: string, id: string, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.maintenanceTask.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    await this.prisma.maintenanceTask.delete({ where: { id } });
    await this.audit.record({
      userId,
      action: 'TASK_DELETE',
      entity: 'MaintenanceTask',
      entityId: id,
      before,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  async upsertSchedule(userId: string, taskId: string, dto: UpsertScheduleDto, ctx: { ip: string; userAgent: string }) {
    const task = await this.prisma.maintenanceTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();
    const row = await this.prisma.monthlySchedule.upsert({
      where: { taskId_year_month: { taskId, year: dto.year, month: dto.month } },
      create: { taskId, year: dto.year, month: dto.month, hh: dto.hh },
      update: { hh: dto.hh },
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
    return row;
  }
}

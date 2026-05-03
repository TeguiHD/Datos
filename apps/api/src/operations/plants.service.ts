import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PlantStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { DeletePlantDto, ListPlantsDto, UpdatePlantDto, UpsertPlantDto } from './operations.dto';
import { normalizePsr, sanitizeObject } from './sanitize';

@Injectable()
export class PlantsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(query: ListPlantsDto) {
    const { q, status, area, take = 50, skip = 0 } = query;
    const where: Prisma.PlantWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(area && { area }),
      ...(q && {
        OR: [
          { psr: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { equipment: { some: { name: { contains: q, mode: 'insensitive' }, deletedAt: null } } },
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
            },
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
        const nextDueDate =
          plant.planTasks
            .flatMap((task) => task.executions)
            .map((execution) => execution.dueDate)
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
          hhPlan,
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

  async byPsr(psr: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { psr: normalizePsr(psr) },
      include: {
        equipment: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        planTasks: {
          where: { deletedAt: null },
          include: { equipment: true, executions: { orderBy: { dueDate: 'asc' }, take: 12 } },
          orderBy: [{ abc: 'asc' }, { description: 'asc' }],
        },
      },
    });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    return plant;
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
    const before = await this.prisma.plant.findUnique({ where: { psr: normalizePsr(psr) } });
    if (!before || before.deletedAt) throw new NotFoundException('Plant not found');
    const clean = sanitizeObject(dto);
    const after = await this.prisma.plant.update({
      where: { id: before.id },
      data: {
        ...clean,
        updatedById: userId,
      },
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
}

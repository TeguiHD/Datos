import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanFrequency } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateExecutionsDto, UpsertPlanTaskDto } from './operations.dto';
import { normalizePsr, sanitizeObject } from './sanitize';

const FREQUENCY_MONTHS: Record<PlanFrequency, number | null> = {
  [PlanFrequency.MONTHLY]: 1,
  [PlanFrequency.QUARTERLY]: 3,
  [PlanFrequency.SEMIANNUAL]: 6,
  [PlanFrequency.ANNUAL]: 12,
  [PlanFrequency.CUSTOM]: null,
};

@Injectable()
export class PlanService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listByPlant(psr: string) {
    const plant = await this.findPlant(psr);
    return this.prisma.maintenancePlanTask.findMany({
      where: { plantId: plant.id, deletedAt: null },
      include: { equipment: true, executions: { orderBy: { dueDate: 'asc' }, take: 6 } },
      orderBy: [{ abc: 'asc' }, { description: 'asc' }],
    });
  }

  async create(userId: string, psr: string, dto: UpsertPlanTaskDto, ctx: RequestContext) {
    const plant = await this.findPlant(psr);
    await this.assertEquipmentBelongsToPlant(dto.equipmentId, plant.id);
    const clean = sanitizeObject(dto);
    const task = await this.prisma.maintenancePlanTask.create({
      data: {
        plantId: plant.id,
        equipmentId: clean.equipmentId || null,
        abc: clean.abc?.toUpperCase(),
        description: clean.description.trim(),
        frequency: clean.frequency,
        cronExpression: clean.cronExpression,
        hhPlan: clean.hhPlan,
        responsibleId: clean.responsibleId,
        active: clean.active ?? true,
      },
    });
    await this.audit.record({
      userId,
      action: 'PLAN_TASK_CREATE',
      entity: 'MaintenancePlanTask',
      entityId: task.id,
      after: task,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return task;
  }

  async update(userId: string, id: string, dto: UpsertPlanTaskDto, ctx: RequestContext) {
    const before = await this.prisma.maintenancePlanTask.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Plan task not found');
    await this.assertEquipmentBelongsToPlant(dto.equipmentId, before.plantId);
    const clean = sanitizeObject(dto);
    const after = await this.prisma.maintenancePlanTask.update({
      where: { id },
      data: {
        equipmentId: clean.equipmentId || null,
        abc: clean.abc?.toUpperCase(),
        description: clean.description.trim(),
        frequency: clean.frequency,
        cronExpression: clean.cronExpression,
        hhPlan: clean.hhPlan,
        responsibleId: clean.responsibleId,
        active: clean.active ?? true,
      },
    });
    await this.audit.record({
      userId,
      action: 'PLAN_TASK_UPDATE',
      entity: 'MaintenancePlanTask',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return after;
  }

  async remove(userId: string, id: string, ctx: RequestContext) {
    const before = await this.prisma.maintenancePlanTask.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Plan task not found');
    const after = await this.prisma.maintenancePlanTask.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    await this.audit.record({
      userId,
      action: 'PLAN_TASK_DELETE',
      entity: 'MaintenancePlanTask',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  async generateExecutions(userId: string, id: string, dto: GenerateExecutionsDto, ctx: RequestContext) {
    const task = await this.prisma.maintenancePlanTask.findUnique({ where: { id } });
    if (!task || task.deletedAt || !task.active) throw new NotFoundException('Plan task not found');
    const cadence = FREQUENCY_MONTHS[task.frequency];
    if (!cadence) throw new BadRequestException('CUSTOM frequency needs explicit scheduling');

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const months = dto.months ?? 12;
    const data = Array.from({ length: months })
      .map((_, index) => index)
      .filter((offset) => offset % cadence === 0)
      .map((offset) => ({
        planTaskId: task.id,
        dueDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1)),
        hhPlan: task.hhPlan,
      }));

    const result = await this.prisma.operationalExecution.createMany({ data, skipDuplicates: true });
    await this.audit.record({
      userId,
      action: 'PLAN_TASK_GENERATE_EXECUTIONS',
      entity: 'MaintenancePlanTask',
      entityId: task.id,
      after: { requestedMonths: months, created: result.count },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { created: result.count };
  }

  private async findPlant(psr: string) {
    const plant = await this.prisma.plant.findUnique({ where: { psr: normalizePsr(psr) } });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    return plant;
  }

  private async assertEquipmentBelongsToPlant(equipmentId: string | undefined, plantId: string) {
    if (!equipmentId) return;
    const equipment = await this.prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment || equipment.deletedAt || equipment.plantId !== plantId) {
      throw new BadRequestException('Equipment does not belong to this plant');
    }
  }
}

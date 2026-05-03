import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEquipmentDto } from './operations.dto';
import { normalizePsr, sanitizeObject } from './sanitize';

@Injectable()
export class EquipmentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listByPlant(psr: string) {
    const plant = await this.findPlant(psr);
    return this.prisma.equipment.findMany({
      where: { plantId: plant.id, deletedAt: null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, psr: string, dto: UpsertEquipmentDto, ctx: RequestContext) {
    const plant = await this.findPlant(psr);
    const clean = sanitizeObject(dto);
    const equipment = await this.prisma.equipment.create({
      data: { plantId: plant.id, type: clean.type, name: clean.name.trim(), model: clean.model, serial: clean.serial, notes: clean.notes },
    });
    await this.audit.record({
      userId,
      action: 'EQUIPMENT_CREATE',
      entity: 'Equipment',
      entityId: equipment.id,
      after: equipment,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return equipment;
  }

  async update(userId: string, id: string, dto: UpsertEquipmentDto, ctx: RequestContext) {
    const before = await this.prisma.equipment.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Equipment not found');
    const clean = sanitizeObject(dto);
    const after = await this.prisma.equipment.update({
      where: { id },
      data: { type: clean.type, name: clean.name.trim(), model: clean.model, serial: clean.serial, notes: clean.notes },
    });
    await this.audit.record({
      userId,
      action: 'EQUIPMENT_UPDATE',
      entity: 'Equipment',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return after;
  }

  async remove(userId: string, id: string, ctx: RequestContext) {
    const before = await this.prisma.equipment.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Equipment not found');
    const after = await this.prisma.equipment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      userId,
      action: 'EQUIPMENT_DELETE',
      entity: 'Equipment',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  private async findPlant(psr: string) {
    const plant = await this.prisma.plant.findUnique({ where: { psr: normalizePsr(psr) } });
    if (!plant || plant.deletedAt) throw new NotFoundException('Plant not found');
    return plant;
  }
}

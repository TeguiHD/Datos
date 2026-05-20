import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertHhDefaultDto } from './hh-defaults.dto';
import { HhResolverService } from './hh-resolver';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function assertScopeShape(dto: UpsertHhDefaultDto) {
  const parts = dto.scope.split('_');
  const hasPlant = parts.includes('PLANT');
  const hasFreq = parts.includes('FREQ');
  const hasAbc = parts.includes('ABC');
  if (hasPlant && !dto.plantId) throw new BadRequestException('plantId requerido para scope con PLANT');
  if (!hasPlant && dto.plantId) throw new BadRequestException('plantId no permitido para este scope');
  if (hasFreq && !dto.frecuenciaCodigo) throw new BadRequestException('frecuenciaCodigo requerido');
  if (!hasFreq && dto.frecuenciaCodigo) throw new BadRequestException('frecuenciaCodigo no permitido');
  if (hasAbc && !dto.abc) throw new BadRequestException('abc requerido');
  if (!hasAbc && dto.abc) throw new BadRequestException('abc no permitido');
}

@Injectable()
export class HhDefaultsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private resolver: HhResolverService,
  ) {}

  list() {
    return this.prisma.hhDefault.findMany({ orderBy: [{ scope: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }] });
  }

  async upsert(user: { id: string; role: Role }, dto: UpsertHhDefaultDto, ctx: RequestContext) {
    assertScopeShape(dto);
    const before = await this.prisma.hhDefault.findFirst({
      where: {
        scope: dto.scope,
        plantId: dto.plantId ?? null,
        frecuenciaCodigo: dto.frecuenciaCodigo?.toUpperCase() ?? null,
        abc: dto.abc?.toUpperCase() ?? null,
      },
    });
    const data = {
      scope: dto.scope,
      plantId: dto.plantId ?? null,
      frecuenciaCodigo: dto.frecuenciaCodigo?.toUpperCase() ?? null,
      abc: dto.abc?.toUpperCase() ?? null,
      hhPlan: dto.hhPlan,
      priority: dto.priority ?? 0,
      note: dto.note ?? null,
      createdById: user.id,
    };
    const after = before
      ? await this.prisma.hhDefault.update({ where: { id: before.id }, data })
      : await this.prisma.hhDefault.create({ data });
    this.resolver.invalidate();
    await this.audit.record({
      userId: user.id,
      action: before ? 'HH_DEFAULT_UPDATE' : 'HH_DEFAULT_CREATE',
      entity: 'HhDefault',
      entityId: after.id,
      before: before ?? undefined,
      after,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return after;
  }

  async remove(user: { id: string }, id: string, ctx: RequestContext) {
    const before = await this.prisma.hhDefault.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Regla no encontrada');
    await this.prisma.hhDefault.delete({ where: { id } });
    this.resolver.invalidate();
    await this.audit.record({
      userId: user.id,
      action: 'HH_DEFAULT_DELETE',
      entity: 'HhDefault',
      entityId: id,
      before,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  /**
   * Aplica reglas activas a todas las TaskExecution con hhPlanned=0.
   * Devuelve cuántas filas se actualizaron por regla.
   */
  /**
   * Sugerencias de HH default basadas en ejecuciones APPROVED con hhActual > 0
   * agrupadas por (plantId, frecuenciaCodigo, abc). Devuelve media, mediana,
   * desviación y n.
   */
  async suggestFromHistory(): Promise<Array<{
    plantId: string | null;
    plantName: string | null;
    frecuenciaCodigo: string | null;
    abc: string | null;
    n: number;
    mean: number;
    median: number;
    stdev: number;
  }>> {
    type Row = {
      hhActual: { toString(): string } | null;
      task: {
        plantId: string | null;
        plant: { name: string } | null;
        frecuenciaCodigo: string | null;
        indicadorAbc: string | null;
      };
    };
    const executions = (await this.prisma.taskExecution.findMany({
      where: {
        hhActual: { not: null, gt: 0 },
        task: { deletedAt: null },
      },
      select: {
        hhActual: true,
        task: {
          select: {
            plantId: true,
            plant: { select: { name: true } },
            frecuenciaCodigo: true,
            indicadorAbc: true,
          },
        },
      },
      take: 200_000,
    })) as Row[];

    type Bucket = {
      plantId: string | null;
      plantName: string | null;
      frecuenciaCodigo: string | null;
      abc: string | null;
      values: number[];
    };
    const buckets = new Map<string, Bucket>();
    for (const row of executions) {
      if (row.hhActual == null) continue;
      const v = Number(row.hhActual.toString());
      if (!Number.isFinite(v) || v <= 0) continue;
      const key = `${row.task.plantId ?? ''}|${row.task.frecuenciaCodigo ?? ''}|${row.task.indicadorAbc ?? ''}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          plantId: row.task.plantId,
          plantName: row.task.plant?.name ?? null,
          frecuenciaCodigo: row.task.frecuenciaCodigo,
          abc: row.task.indicadorAbc,
          values: [],
        };
        buckets.set(key, b);
      }
      b.values.push(v);
    }
    return Array.from(buckets.values())
      .filter((b) => b.values.length >= 3)
      .map((b) => {
        const sorted = [...b.values].sort((x, y) => x - y);
        const mean = b.values.reduce((s, x) => s + x, 0) / b.values.length;
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
        const variance = b.values.reduce((s, x) => s + (x - mean) ** 2, 0) / b.values.length;
        const stdev = Math.sqrt(variance);
        return {
          plantId: b.plantId,
          plantName: b.plantName,
          frecuenciaCodigo: b.frecuenciaCodigo,
          abc: b.abc,
          n: b.values.length,
          mean: round1(mean),
          median: round1(median),
          stdev: round1(stdev),
        };
      })
      .sort((a, b) => b.n - a.n);
  }

  async backfill(user: { id: string }, ctx: RequestContext): Promise<{ updated: number }> {
    await this.resolver.refresh();
    const executions = await this.prisma.taskExecution.findMany({
      where: { hhPlanned: 0 },
      select: {
        id: true,
        task: {
          select: {
            plantId: true,
            frecuenciaCodigo: true,
            indicadorAbc: true,
          },
        },
      },
      take: 50_000,
    });

    let updated = 0;
    for (const exec of executions) {
      const hh = await this.resolver.resolve({
        plantId: exec.task.plantId,
        frecuenciaCodigo: exec.task.frecuenciaCodigo,
        abc: exec.task.indicadorAbc,
      });
      if (hh != null && hh > 0) {
        await this.prisma.taskExecution.update({ where: { id: exec.id }, data: { hhPlanned: hh } });
        updated += 1;
      }
    }

    await this.audit.record({
      userId: user.id,
      action: 'HH_DEFAULT_BACKFILL',
      entity: 'TaskExecution',
      after: { updated, scanned: executions.length },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { updated };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ExecStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HhResolverService } from '../hh-defaults/hh-resolver';
import {
  generateOccurrences,
  resolveFrecuenciaMeses,
  ymToDate,
} from './occurrences';

const HORIZON_YEARS = Number(process.env.MAINT_HORIZON_YEARS ?? 20);
const ANCHOR_FROM_YEAR = 2022;

/**
 * Reconstruye MonthlySchedule (proyecciones) y TaskExecution (PENDING)
 * a partir de las reglas de cada MaintenanceTask. Idempotente.
 *
 * - No borra ejecuciones DONE/SKIPPED (preserva historia operacional).
 * - Marca discrepancias entre Excel y motor calculado.
 */
@Injectable()
export class MaterializeService {
  private readonly log = new Logger(MaterializeService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private hhResolver: HhResolverService,
  ) {}

  async rebuildAll(actorId: string | null, ctx: { ip: string; userAgent: string }) {
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: { deletedAt: null },
      include: { schedule: true },
    });

    await this.hhResolver.refresh();

    const now = new Date();
    const horizonYear = now.getUTCFullYear() + HORIZON_YEARS;
    const from = { year: ANCHOR_FROM_YEAR, month: 1 };
    const to = { year: horizonYear, month: 12 };

    let tasksProcessed = 0;
    let discrepancies = 0;
    let executionsCreated = 0;

    for (const task of tasks) {
      const excelSchedule = task.schedule.filter((s) => s.source === 'EXCEL');
      const meses = resolveFrecuenciaMeses(task.frecuenciaMeses, task.frecuenciaCodigo);
      const mesInicio = task.mesInicio ?? inferMesInicio(excelSchedule);
      let hhPlanned = task.hhReal != null ? Number(task.hhReal) : (inferHh(excelSchedule) ?? (excelSchedule.length > 0 ? 0 : null));
      // Si el Excel no trae HH (caso ESSC Sur), intentar resolver vía reglas HhDefault.
      if ((hhPlanned == null || hhPlanned === 0) && (meses || task.frecuenciaCodigo)) {
        const resolved = await this.hhResolver.resolve({
          plantId: task.plantId,
          frecuenciaCodigo: task.frecuenciaCodigo,
          abc: task.indicadorAbc,
        });
        if (resolved != null) hhPlanned = resolved;
      }
      const anchorYear = inferAnchorYear(excelSchedule) ?? ANCHOR_FROM_YEAR;
      if (!meses || !mesInicio || hhPlanned == null || hhPlanned < 0) continue;

      const occ = generateOccurrences(
        {
          frecuenciaMeses: meses,
          mesInicio,
          anchorYear,
          hhPlanned,
        },
        from,
        to,
      );

      const excelKeys = new Set(excelSchedule.map((s) => ymKey(s.year, s.month)));
      const hasDisc = hasDiscrepancy(excelSchedule, occ);

      await this.prisma.$transaction(async (tx) => {
        // 1) Reemplazar proyecciones CALC (preservando filas EXCEL importadas tal cual)
        await tx.monthlySchedule.deleteMany({ where: { taskId: task.id, source: 'CALC' } });
        if (occ.length > 0) {
          const projData = occ
            .filter((o) => !excelKeys.has(`${o.year}-${o.month}`))
            .map((o) => ({
              taskId: task.id,
              year: o.year,
              month: o.month,
              hh: new Prisma.Decimal(o.hhPlanned),
              source: 'CALC' as const,
            }));
          if (projData.length > 0) {
            await tx.monthlySchedule.createMany({ data: projData, skipDuplicates: true });
          }
        }

        // 2) Reconciliar TaskExecution PENDING y crear faltantes futuras.
        const existingExec = await tx.taskExecution.findMany({
          where: { taskId: task.id },
          select: { id: true, dueDate: true, status: true, hhPlanned: true, source: true },
        });

        const occAllByKey = new Map(occ.map((o) => [ymKey(o.year, o.month), o.hhPlanned]));
        const currentIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
        const futureOcc = occ.filter((o) => o.year * 12 + (o.month - 1) >= currentIdx);
        const existingByKey = new Map<string, (typeof existingExec)[number]>();

        for (const ex of existingExec) {
          if (ex.source === 'MANUAL') continue;
          const key = ymKey(ex.dueDate.getUTCFullYear(), ex.dueDate.getUTCMonth() + 1);
          existingByKey.set(key, ex);
          if (ex.status !== ExecStatus.PENDING) continue;

          const calcHh = occAllByKey.get(key);
          if (calcHh == null) {
            await tx.taskExecution.delete({ where: { id: ex.id } });
            continue;
          }

          if (!sameHh(ex.hhPlanned, calcHh)) {
            await tx.taskExecution.update({
              where: { id: ex.id },
              data: { hhPlanned: new Prisma.Decimal(calcHh) },
            });
          }
        }

        for (const o of futureOcc) {
          const key = ymKey(o.year, o.month);
          if (!existingByKey.has(key)) {
            await tx.taskExecution.create({
              data: {
                taskId: task.id,
                dueDate: ymToDate(o.year, o.month),
                hhPlanned: new Prisma.Decimal(o.hhPlanned),
                status: ExecStatus.PENDING,
                source: 'CALC',
              },
            });
            executionsCreated++;
          }
        }

        // 3) Marcar PENDING vencidas como OVERDUE
        await tx.taskExecution.updateMany({
          where: { taskId: task.id, status: ExecStatus.PENDING, dueDate: { lt: startOfMonth(now) } },
          data: { status: ExecStatus.OVERDUE },
        });

        if (task.hasDiscrepancy !== hasDisc) {
          await tx.maintenanceTask.update({
            where: { id: task.id },
            data: { hasDiscrepancy: hasDisc },
          });
        }
      });

      if (hasDisc) discrepancies++;
      tasksProcessed++;
    }

    await this.audit.record({
      userId: actorId,
      action: 'SCHEDULE_REBUILD',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { tasksProcessed, discrepancies, executionsCreated, horizonYear },
    });

    this.log.log(
      `rebuild: tasks=${tasksProcessed} discrepancies=${discrepancies} pendingCreated=${executionsCreated} horizon=${horizonYear}`,
    );

    return { tasksProcessed, discrepancies, executionsCreated, horizonYear };
  }

  /** Reconcilia OVERDUE en cada request al endpoint upcoming/overdue */
  async markOverdue() {
    const now = new Date();
    return this.prisma.taskExecution.updateMany({
      where: { status: ExecStatus.PENDING, dueDate: { lt: startOfMonth(now) } },
      data: { status: ExecStatus.OVERDUE },
    });
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function ymKey(year: number, month: number): string {
  return `${year}-${month}`;
}

function monthIdx(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function inferMesInicio(schedule: { year: number; month: number }[]): number | null {
  if (schedule.length === 0) return null;
  const first = [...schedule].sort((a, b) => a.year - b.year || a.month - b.month)[0];
  return first?.month ?? null;
}

function inferHh(schedule: { hh: Prisma.Decimal }[]): number | null {
  if (schedule.length === 0) return null;
  const max = Math.max(...schedule.map((s) => Number(s.hh)));
  return Number.isFinite(max) && max >= 0 ? max : null;
}

function inferAnchorYear(schedule: { year: number }[]): number | null {
  if (schedule.length === 0) return null;
  return Math.min(...schedule.map((s) => s.year));
}

function sameHh(dbValue: Prisma.Decimal, planned: number): boolean {
  return Math.abs(Number(dbValue) - planned) < 0.005;
}

function hasDiscrepancy(
  excel: { year: number; month: number; hh: Prisma.Decimal }[],
  occ: { year: number; month: number; hhPlanned: number }[],
): boolean {
  if (excel.length === 0) return false;

  const excelMap = new Map(excel.map((s) => [ymKey(s.year, s.month), Number(s.hh)]));
  const occMap = new Map(occ.map((o) => [ymKey(o.year, o.month), o.hhPlanned]));
  const excelMin = Math.min(...excel.map((s) => monthIdx(s.year, s.month)));
  const excelMax = Math.max(...excel.map((s) => monthIdx(s.year, s.month)));

  // Excel debe existir en cálculo y con HH consistente.
  for (const [key, hh] of excelMap) {
    const calc = occMap.get(key);
    if (calc == null || Math.abs(calc - hh) >= 0.005) return true;
  }

  // Dentro del rango temporal cubierto por Excel, no debe faltar ninguna ocurrencia esperada.
  for (const o of occ) {
    const idx = monthIdx(o.year, o.month);
    if (idx < excelMin || idx > excelMax) continue;
    if (!excelMap.has(ymKey(o.year, o.month))) return true;
  }

  return false;
}

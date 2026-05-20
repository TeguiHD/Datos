import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { plantWhereForUser, type ViewerScopeUser } from '../common/viewer-scope';

export interface ReportRequest {
  year: number;
  month: number; // 1-12
  plantId?: string;
}

interface RowSummary {
  total: number;
  approved: number;
  pendingApproval: number;
  rejected: number;
  skipped: number;
  postponed: number;
  inProgress: number;
  scheduled: number;
  hhPlan: number;
  hhActual: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private signingKey(): Buffer {
    const key = process.env.REPORT_SIGNING_KEY;
    if (!key || key.length < 32) {
      throw new Error('REPORT_SIGNING_KEY missing or weak (<32 chars)');
    }
    return Buffer.from(key, 'utf8');
  }

  async generateMonthly(
    user: { id: string; role: Role },
    body: ReportRequest,
    ctx: RequestContext,
  ): Promise<{ buffer: Buffer; filename: string; sha256: string; signature: string; reportId: string; summary: RowSummary }> {
    const { year, month } = body;
    if (year < 2020 || year > 2099) throw new BadRequestException('Año fuera de rango');
    if (month < 1 || month > 12) throw new BadRequestException('Mes inválido');

    if (body.plantId) {
      const plant = await this.prisma.plant.findUnique({
        where: { id: body.plantId },
      });
      if (!plant || plant.deletedAt) throw new NotFoundException('Planta no encontrada');
      if (user.role === Role.VIEWER && !plant.visibleToViewer) {
        throw new NotFoundException('Planta no encontrada');
      }
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const visibleUser: ViewerScopeUser = { role: user.role };
    const plantFilter = plantWhereForUser(visibleUser);
    if (body.plantId) (plantFilter as { id?: string }).id = body.plantId;

    const executions = await this.prisma.operationalExecution.findMany({
      where: {
        dueDate: { gte: monthStart, lt: monthEnd },
        planTask: { deletedAt: null, plant: plantFilter },
      },
      include: {
        planTask: {
          include: { plant: { select: { id: true, psr: true, name: true } }, equipment: true },
        },
      },
      orderBy: [{ planTask: { plant: { name: 'asc' } } }, { dueDate: 'asc' }],
    });

    const summary = executions.reduce<RowSummary>(
      (acc, row) => {
        acc.total += 1;
        switch (row.status) {
          case 'APPROVED': acc.approved += 1; break;
          case 'DONE_PENDING_APPROVAL': acc.pendingApproval += 1; break;
          case 'REJECTED': acc.rejected += 1; break;
          case 'SKIPPED': acc.skipped += 1; break;
          case 'POSTPONED': acc.postponed += 1; break;
          case 'IN_PROGRESS': acc.inProgress += 1; break;
          case 'SCHEDULED': acc.scheduled += 1; break;
        }
        acc.hhPlan += Number(row.hhPlan);
        if (row.hhActual != null) acc.hhActual += Number(row.hhActual);
        return acc;
      },
      { total: 0, approved: 0, pendingApproval: 0, rejected: 0, skipped: 0, postponed: 0, inProgress: 0, scheduled: 0, hhPlan: 0, hhActual: 0 },
    );

    const csvBuffer = renderCsv(executions, { year, month, summary });
    const sha256 = createHash('sha256').update(csvBuffer).digest('hex');
    const signature = createHmac('sha256', this.signingKey())
      .update(`${year}-${month}|${body.plantId ?? ''}|${sha256}`)
      .digest('hex');

    const slug = body.plantId ? `planta-${body.plantId.slice(0, 8)}` : 'todas';
    const filename = `mantencion-${year}-${String(month).padStart(2, '0')}-${slug}.csv`;

    const record = await this.prisma.reportRun.create({
      data: {
        generatedById: user.id,
        scope: body.plantId ? 'PLANT' : 'GLOBAL',
        params: { year, month, plantId: body.plantId ?? null } as never,
        format: 'csv',
        filename,
        sizeBytes: csvBuffer.byteLength,
        sha256,
        signature,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'REPORT_EXPORT',
      entity: 'ReportRun',
      entityId: record.id,
      after: {
        year,
        month,
        plantId: body.plantId ?? null,
        sha256,
        sizeBytes: csvBuffer.byteLength,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { buffer: csvBuffer, filename, sha256, signature, reportId: record.id, summary };
  }

  async verify(user: { role: Role }, id: string) {
    const record = await this.prisma.reportRun.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Reporte no encontrado');
    if (user.role === Role.VIEWER && record.scope === 'PLANT') {
      const params = record.params as { plantId?: string | null };
      if (params.plantId) {
        const plant = await this.prisma.plant.findUnique({ where: { id: params.plantId } });
        if (!plant || !plant.visibleToViewer) throw new ForbiddenException('No autorizado');
      }
    }
    const params = record.params as { year: number; month: number; plantId: string | null };
    const expected = createHmac('sha256', this.signingKey())
      .update(`${params.year}-${params.month}|${params.plantId ?? ''}|${record.sha256}`)
      .digest('hex');
    const ok = timingSafeEqual(expected, record.signature);
    return {
      ok,
      id: record.id,
      generatedAt: record.generatedAt,
      generatedById: record.generatedById,
      scope: record.scope,
      filename: record.filename,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      params,
    };
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const HEADERS = [
  'planta_psr',
  'planta_nombre',
  'plan_task_id',
  'descripcion',
  'abc',
  'frecuencia',
  'equipo',
  'due_date',
  'estado',
  'outcome',
  'hh_plan',
  'hh_actual',
  'aprobado_por',
  'aprobado_en',
  'rechazado_por',
  'rechazado_en',
  'comentario',
] as const;

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function renderCsv(
  rows: Array<{
    dueDate: Date;
    status: string;
    outcome: string | null;
    hhPlan: { toString(): string };
    hhActual: { toString(): string } | null;
    approvedById: string | null;
    approvedAt: Date | null;
    rejectedById: string | null;
    rejectedAt: Date | null;
    comment: string | null;
    planTask: {
      id: string;
      description: string;
      abc: string | null;
      frequency: string;
      plant: { psr: string; name: string };
      equipment: { name: string } | null;
    };
  }>,
  meta: { year: number; month: number; summary: RowSummary },
): Buffer {
  const lines: string[] = [];
  lines.push(`# datos.nicoholas.dev — reporte mensual ${meta.year}-${String(meta.month).padStart(2, '0')}`);
  lines.push(`# total=${meta.summary.total} aprobadas=${meta.summary.approved} pend_aprob=${meta.summary.pendingApproval} rechazadas=${meta.summary.rejected} omitidas=${meta.summary.skipped} postergadas=${meta.summary.postponed}`);
  lines.push(`# hh_plan=${meta.summary.hhPlan.toFixed(2)} hh_real=${meta.summary.hhActual.toFixed(2)}`);
  lines.push(HEADERS.join(','));
  for (const row of rows) {
    lines.push(
      [
        row.planTask.plant.psr,
        row.planTask.plant.name,
        row.planTask.id,
        row.planTask.description,
        row.planTask.abc ?? '',
        row.planTask.frequency,
        row.planTask.equipment?.name ?? '',
        row.dueDate.toISOString(),
        row.status,
        row.outcome ?? '',
        row.hhPlan.toString(),
        row.hhActual?.toString() ?? '',
        row.approvedById ?? '',
        row.approvedAt?.toISOString() ?? '',
        row.rejectedById ?? '',
        row.rejectedAt?.toISOString() ?? '',
        row.comment ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

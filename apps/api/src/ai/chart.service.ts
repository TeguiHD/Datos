import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ExecStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiFilter, AiFilterSchema } from './ai-filter.schema';
import {
  ChartGroupBy,
  ChartMetric,
  ChartSpec,
  ChartSpecSchema,
  CHART_SPEC_FIELDS_FOR_PROMPT,
} from './chart-spec.schema';
import { isBroadQuery, sanitizeUserPrompt } from './sanitize';
import { callLlmForChart, tryParseJson } from './llm.client';
import { AiQuotaService } from './ai-quota';

const TASK_SELECT = {
  id: true,
  indicadorAbc: true,
  psr: true,
  frecuenciaCodigo: true,
  centroPlanificacion: true,
  equipo: true,
  descPosicionMant: true,
  denomObjetoTecnico: true,
  denomUbicacionTecnica: true,
  ubicacionTecnica: true,
} as const;

type ExecRow = {
  id: string;
  dueDate: Date;
  status: ExecStatus;
  hhPlanned: Prisma.Decimal;
  hhActual: Prisma.Decimal | null;
  task: {
    id: string;
    indicadorAbc: string | null;
    psr: string | null;
    frecuenciaCodigo: string | null;
    centroPlanificacion: string | null;
    equipo: string | null;
  };
};

export interface ChartDatum {
  key: string;
  value: number;
  count: number;
}

export interface ChartResponse {
  spec: ChartSpec;
  data: ChartDatum[];
  total: { value: number; count: number };
  _meta: { model: string; latencyMs: number; parser: 'llm' | 'heuristic' };
}

@Injectable()
export class ChartBuilderService {
  private readonly log = new Logger(ChartBuilderService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private quota: AiQuotaService,
  ) {}

  async build(
    user: { id: string; role: Role },
    rawPrompt: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<ChartResponse> {
    this.quota.check(user.id, user.role, 'chart');
    const sanitized = sanitizeUserPrompt(rawPrompt);
    if (!sanitized) throw new BadRequestException('Prompt vacío');
    if (isBroadQuery(sanitized)) {
      throw new BadRequestException({
        message: 'Consulta demasiado amplia',
        hint: 'Precisa qué agrupar (ABC, PSR, mes) y una métrica (conteo, HH).',
      });
    }

    const resolved = await this.resolveSpec(sanitized, user.id, ctx);
    const spec: ChartSpec = {
      ...resolved.spec,
      filter: this.applyRolePolicy(user.role, resolved.spec.filter ?? {}),
    };

    const { data, total } = await this.runAggregate(spec, user.role);

    await this.audit.record({
      userId: user.id,
      action: 'AI_CHART',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: {
        prompt: sanitized,
        model: resolved.model,
        spec,
        resultBuckets: data.length,
        resultCount: total.count,
        outcome: resolved.outcome,
      },
    });

    return {
      spec,
      data,
      total,
      _meta: { model: resolved.model, latencyMs: resolved.latencyMs, parser: resolved.parser },
    };
  }

  private async resolveSpec(
    sanitizedPrompt: string,
    userId: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<{
    spec: ChartSpec;
    model: string;
    latencyMs: number;
    parser: 'llm' | 'heuristic';
    outcome: string;
  }> {
    try {
      const llm = await callLlmForChart(sanitizedPrompt, CHART_SPEC_FIELDS_FOR_PROMPT);
      const parsed = tryParseJson(llm.raw);
      const result = ChartSpecSchema.safeParse(parsed);

      if (result.success) {
        return {
          spec: result.data,
          model: llm.model,
          latencyMs: llm.latencyMs,
          parser: 'llm',
          outcome: 'OK',
        };
      }

      this.log.warn(`llm_chart_invalid: ${result.error.issues[0]?.message ?? 'unknown'}`);
      await this.audit.record({
        userId,
        action: 'AI_CHART',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        after: { prompt: sanitizedPrompt, model: llm.model, spec: parsed, outcome: 'ZOD_FAIL_FALLBACK' },
      });
    } catch (e) {
      this.log.warn(`llm_chart_call_failed: ${(e as Error).message}`);
      await this.audit.record({
        userId,
        action: 'AI_CHART',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        after: { prompt: sanitizedPrompt, model: 'fallback', outcome: 'PROVIDER_FAIL_FALLBACK' },
      });
    }

    const heuristic = heuristicChartSpec(sanitizedPrompt);
    const fallback = ChartSpecSchema.safeParse(heuristic);
    if (!fallback.success) {
      throw new BadRequestException({
        message: 'No se pudo interpretar la consulta de gráfico',
        hint: 'Indica qué agrupar (ABC, PSR, mes, año) y la métrica (conteo, HH planificadas).',
      });
    }
    return {
      spec: fallback.data,
      model: 'heuristic-fallback',
      latencyMs: 0,
      parser: 'heuristic',
      outcome: 'FALLBACK_OK',
    };
  }

  private applyRolePolicy(role: Role, f: AiFilter): AiFilter {
    const cap = role === Role.VIEWER ? 100 : 200;
    return { ...f, take: Math.min(f.take ?? cap, cap) };
  }

  private aggregationLimit(role: Role): number {
    return role === Role.VIEWER ? 5000 : 20000;
  }

  private async runAggregate(
    spec: ChartSpec,
    role: Role,
  ): Promise<{ data: ChartDatum[]; total: { value: number; count: number } }> {
    const f = spec.filter ?? {};
    const aggTake = this.aggregationLimit(role);
    const where: Prisma.TaskExecutionWhereInput = {
      ...(f.onlyOverdue
        ? { status: ExecStatus.OVERDUE }
        : { status: { in: [ExecStatus.PENDING, ExecStatus.DONE, ExecStatus.OVERDUE] } }),
      ...(this.hasTaskFilter(f) ? { task: this.taskWhere(f) } : {}),
    };

    if (f.yearFrom || f.yearTo) {
      const yFrom = f.yearFrom ?? 2000;
      const yTo = f.yearTo ?? 2100;
      const mFrom = f.monthFrom ?? 1;
      const mTo = f.monthTo ?? 12;
      where.dueDate = {
        gte: new Date(Date.UTC(yFrom, mFrom - 1, 1)),
        lte: new Date(Date.UTC(yTo, mTo, 0, 23, 59, 59)),
      };
    }

    if (f.onlyUpcomingDays && !f.onlyOverdue) {
      const now = new Date();
      const horizon = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + f.onlyUpcomingDays),
      );
      where.status = ExecStatus.PENDING;
      where.dueDate = {
        gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        lte: horizon,
      };
    }

    const rows = (await this.prisma.taskExecution.findMany({
      where,
      take: aggTake,
      include: { task: { select: TASK_SELECT } },
      orderBy: [{ dueDate: 'asc' }],
    })) as unknown as ExecRow[];

    const buckets = new Map<string, { value: number; count: number }>();
    let totalValue = 0;
    let totalCount = 0;

    for (const r of rows) {
      const key = groupKey(spec.groupBy, r);
      if (key === null) continue;
      const delta = metricValue(spec.metric, r);
      const prev = buckets.get(key) ?? { value: 0, count: 0 };
      prev.value += delta;
      prev.count += 1;
      buckets.set(key, prev);
      totalValue += delta;
      totalCount += 1;
    }

    const sorted = sortBuckets(spec, buckets);
    const data: ChartDatum[] = sorted.map(([key, v]) => ({
      key,
      value: round2(v.value),
      count: v.count,
    }));

    return { data, total: { value: round2(totalValue), count: totalCount } };
  }

  private hasTaskFilter(f: AiFilter): boolean {
    return Boolean(
      f.q || f.psr || f.abc || f.frecuenciaCodigo || f.centroPlanificacion || f.equipo || f.ubicacionTecnica,
    );
  }

  private taskWhere(f: AiFilter): Prisma.MaintenanceTaskWhereInput {
    return {
      ...(f.psr && { psr: f.psr }),
      ...(f.abc && { indicadorAbc: f.abc }),
      ...(f.frecuenciaCodigo && { frecuenciaCodigo: f.frecuenciaCodigo }),
      ...(f.centroPlanificacion && { centroPlanificacion: f.centroPlanificacion }),
      ...(f.equipo && { equipo: { contains: f.equipo, mode: 'insensitive' } }),
      ...(f.ubicacionTecnica && { ubicacionTecnica: { contains: f.ubicacionTecnica, mode: 'insensitive' } }),
      ...(f.q && {
        OR: [
          { descPosicionMant: { contains: f.q, mode: 'insensitive' } },
          { denomObjetoTecnico: { contains: f.q, mode: 'insensitive' } },
          { denomUbicacionTecnica: { contains: f.q, mode: 'insensitive' } },
        ],
      }),
    };
  }
}

function groupKey(groupBy: ChartGroupBy, r: ExecRow): string | null {
  switch (groupBy) {
    case 'abc':
      return r.task.indicadorAbc?.trim() || 'Sin ABC';
    case 'frecuencia':
      return r.task.frecuenciaCodigo?.trim() || 'Sin frec.';
    case 'psr':
      return r.task.psr?.trim() || 'Sin PSR';
    case 'centroPlanificacion':
      return r.task.centroPlanificacion?.trim() || 'Sin centro';
    case 'status':
      return r.status;
    case 'month': {
      const y = r.dueDate.getUTCFullYear();
      const m = String(r.dueDate.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    case 'year':
      return String(r.dueDate.getUTCFullYear());
  }
}

function metricValue(metric: ChartMetric, r: ExecRow): number {
  switch (metric) {
    case 'count':
      return 1;
    case 'hhPlanned':
      return toNum(r.hhPlanned);
    case 'hhActual':
      return toNum(r.hhActual);
  }
}

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sortBuckets(
  spec: ChartSpec,
  buckets: Map<string, { value: number; count: number }>,
): [string, { value: number; count: number }][] {
  const entries = Array.from(buckets.entries());
  if (spec.groupBy === 'month' || spec.groupBy === 'year') {
    return entries.sort(([a], [b]) => a.localeCompare(b));
  }
  if (spec.groupBy === 'abc') {
    const order = ['A', 'B', 'C'];
    return entries.sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }
  return entries.sort(([, a], [, b]) => b.value - a.value).slice(0, 20);
}

function heuristicChartSpec(prompt: string): Partial<ChartSpec> {
  const p = prompt.toLowerCase();
  const groupBy: ChartGroupBy = p.includes('mes')
    ? 'month'
    : p.includes('año') || p.includes('ano')
      ? 'year'
      : p.includes('abc')
        ? 'abc'
        : p.includes('psr')
          ? 'psr'
          : p.includes('frec')
            ? 'frecuencia'
            : 'abc';
  const metric: ChartMetric = p.includes('hh plan') || p.includes('horas plan')
    ? 'hhPlanned'
    : p.includes('hh real') || p.includes('horas real')
      ? 'hhActual'
      : 'count';
  const chartType =
    groupBy === 'month' || groupBy === 'year' ? 'line' : p.includes('torta') || p.includes('pie') ? 'pie' : 'bar';
  const filter: AiFilter = {};
  if (p.includes('vencid')) filter.onlyOverdue = true;
  return { chartType, groupBy, metric, filter };
}

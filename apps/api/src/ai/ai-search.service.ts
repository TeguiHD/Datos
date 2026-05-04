import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ExecStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiFilter, AiFilterSchema, FILTER_FIELDS_FOR_PROMPT } from './ai-filter.schema';
import { isBroadQuery, sanitizeUserPrompt } from './sanitize';
import { callLlmForFilter, tryParseJson } from './llm.client';
import { heuristicFilterFromPrompt } from './heuristic-filter';
import { AiQuotaService } from './ai-quota';

const TASK_SELECT = {
  id: true,
  descPosicionMant: true,
  denomObjetoTecnico: true,
  ubicacionTecnica: true,
  indicadorAbc: true,
  psr: true,
  frecuenciaCodigo: true,
  equipo: true,
  hhReal: true,
  centroPlanificacion: true,
} as const;

@Injectable()
export class AiSearchService {
  private readonly log = new Logger(AiSearchService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private quota: AiQuotaService,
  ) {}

  async search(
    user: { id: string; role: Role },
    rawPrompt: string,
    ctx: { ip: string; userAgent: string },
    options?: { lastFilter?: AiFilter },
  ) {
    await this.quota.check(user.id, user.role, 'search');
    const sanitized = sanitizeUserPrompt(rawPrompt);
    if (!sanitized) throw new BadRequestException('Prompt vacío');
    if (isBroadQuery(sanitized)) {
      throw new BadRequestException({
        message: 'Consulta demasiado amplia',
        hint: 'Acota por PSR, ABC, frecuencia, rango de fechas o texto.',
      });
    }

    const resolved = await this.resolveFilter(sanitized, user.id, ctx);
    const resolvedFilter = mergeSessionFilter(options?.lastFilter, resolved.filter);
    const filter = this.applyRolePolicy(user.role, resolvedFilter);
    const data = await this.runQuery(filter);

    await this.recordAudit(user.id, sanitized, resolved.model, filter, data.count, resolved.outcome, ctx);
    return {
      filter,
      ...data,
      _meta: { model: resolved.model, latencyMs: resolved.latencyMs, parser: resolved.parser },
    };
  }

  private async resolveFilter(
    sanitizedPrompt: string,
    userId: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<{ filter: AiFilter; model: string; latencyMs: number; parser: 'llm' | 'heuristic'; outcome: string }> {
    try {
      const llm = await callLlmForFilter(sanitizedPrompt, FILTER_FIELDS_FOR_PROMPT);
      const parsed = tryParseJson(llm.raw);
      const result = AiFilterSchema.safeParse(parsed);

      if (result.success) {
        return {
          filter: result.data,
          model: llm.model,
          latencyMs: llm.latencyMs,
          parser: 'llm',
          outcome: 'OK',
        };
      }

      this.log.warn(`llm_filter_invalid: ${result.error.issues[0]?.message ?? 'unknown'}`);
      await this.recordAudit(userId, sanitizedPrompt, llm.model, parsed, 0, 'ZOD_FAIL_FALLBACK', ctx);
    } catch (e) {
      this.log.warn(`llm_call_failed_fallback: ${(e as Error).message}`);
      await this.recordAudit(userId, sanitizedPrompt, 'fallback', null, 0, 'PROVIDER_FAIL_FALLBACK', ctx);
    }

    const heuristic = heuristicFilterFromPrompt(sanitizedPrompt);
    const fallback = AiFilterSchema.safeParse(heuristic);
    if (!fallback.success) {
      await this.recordAudit(userId, sanitizedPrompt, 'heuristic-fallback', heuristic, 0, 'FALLBACK_ZOD_FAIL', ctx);
      throw new BadRequestException({
        message: 'No se pudo interpretar la consulta',
        hint: 'Incluye equipo, PSR, frecuencia, vencidas o un rango temporal',
      });
    }

    return {
      filter: fallback.data,
      model: 'heuristic-fallback',
      latencyMs: 0,
      parser: 'heuristic',
      outcome: 'FALLBACK_OK',
    };
  }

  /**
   * Política por rol. VIEWER no puede usar filtros que la organización marque como sensibles.
   * Ejemplo: limita take y prohíbe búsqueda libre amplia.
   */
  private applyRolePolicy(role: Role, f: AiFilter): AiFilter {
    if (role === Role.VIEWER) {
      return { ...f, take: Math.min(f.take ?? 50, 50) };
    }
    return { ...f, take: Math.min(f.take ?? 100, 200) };
  }

  private async runQuery(f: AiFilter) {
    if (f.onlyOverdue) {
      const where: Prisma.TaskExecutionWhereInput = {
        status: ExecStatus.OVERDUE,
        ...(f.psr || f.abc || f.frecuenciaCodigo || f.equipo || f.ubicacionTecnica || f.q
          ? { task: this.taskWhere(f) }
          : {}),
      };
      const rows = await this.prisma.taskExecution.findMany({
        where,
        take: f.take,
        include: { task: { select: TASK_SELECT } },
        orderBy: [{ dueDate: 'asc' }],
      });
      return { mode: 'executions' as const, count: rows.length, rows };
    }

    if (f.onlyUpcomingDays) {
      const now = new Date();
      const horizon = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + f.onlyUpcomingDays),
      );
      const where: Prisma.TaskExecutionWhereInput = {
        status: ExecStatus.PENDING,
        dueDate: { gte: startOfMonth(now), lte: horizon },
        ...(this.hasTaskFilter(f) ? { task: this.taskWhere(f) } : {}),
      };
      const rows = await this.prisma.taskExecution.findMany({
        where,
        take: f.take,
        include: { task: { select: TASK_SELECT } },
        orderBy: [{ dueDate: 'asc' }],
      });
      return { mode: 'executions' as const, count: rows.length, rows };
    }

    const where: Prisma.TaskExecutionWhereInput = {
      ...(this.hasTaskFilter(f) ? { task: this.taskWhere(f) } : {}),
      ...(f.onlyUpcomingDays === undefined && f.onlyOverdue === undefined ? { status: { in: ['PENDING', 'DONE'] } } : {})
    };

    if (f.yearFrom || f.yearTo) {
      const yFrom = f.yearFrom || 2000;
      const yTo = f.yearTo || 2050;
      const mFrom = f.monthFrom || 1;
      const mTo = f.monthTo || 12;
      where.dueDate = {
        gte: new Date(Date.UTC(yFrom, mFrom - 1, 1)),
        lte: new Date(Date.UTC(yTo, mTo, 0))
      };
    }

    const rows = await this.prisma.taskExecution.findMany({
      where,
      take: f.take,
      include: { task: { select: TASK_SELECT } },
      orderBy: [{ dueDate: 'asc' }],
    });
    return { mode: 'executions' as const, count: rows.length, rows };
  }

  private hasTaskFilter(f: AiFilter): boolean {
    return Boolean(f.q || f.psr || f.abc || f.frecuenciaCodigo || f.centroPlanificacion || f.equipo || f.ubicacionTecnica);
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

  private recordAudit(
    userId: string,
    prompt: string,
    model: string,
    filter: unknown,
    resultCount: number,
    outcome: string,
    ctx: { ip: string; userAgent: string },
  ) {
    return this.audit.record({
      userId,
      action: 'AI_SEARCH',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { prompt, model, filter, resultCount, outcome },
    });
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function mergeSessionFilter(previous: AiFilter | undefined, next: AiFilter): AiFilter {
  if (!previous) return next;
  const merged: AiFilter = { ...previous, ...next };

  if (next.onlyUpcomingDays !== undefined) {
    delete merged.onlyOverdue;
  }
  if (next.onlyOverdue !== undefined) {
    delete merged.onlyUpcomingDays;
  }
  if (next.yearFrom !== undefined || next.yearTo !== undefined || next.monthFrom !== undefined || next.monthTo !== undefined) {
    delete merged.onlyUpcomingDays;
  }

  return AiFilterSchema.parse(merged);
}

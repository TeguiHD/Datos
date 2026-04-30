import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScheduleService } from '../schedule/schedule.service';
import { AiQuotaService } from './ai-quota';
import { callLlmForInsights, tryParseJson } from './llm.client';
import { sanitizeUserPrompt } from './sanitize';

const InsightSchema = z.object({
  summary: z.string().min(1).max(600),
  findings: z.array(z.string().min(1).max(500)).max(8),
  risks: z.array(z.string().min(1).max(500)).max(8),
  nextActions: z.array(z.string().min(1).max(500)).max(10),
  explanation: z.object({
    method: z.string().min(1).max(500),
    evidenceIds: z.array(z.string().min(1).max(80)).max(20),
  }),
});

type Insight = z.infer<typeof InsightSchema>;

@Injectable()
export class InsightsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private quota: AiQuotaService,
    private schedule: ScheduleService,
  ) {}

  async listThreads(userId: string) {
    return this.prisma.aiInsightThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 6 },
      },
    });
  }

  async generate(
    user: { id: string; role: Role },
    input: { prompt?: string; threadId?: string },
    ctx: { ip: string; userAgent: string },
  ) {
    await this.quota.check(user.id, user.role, 'insight');
    const prompt = sanitizeUserPrompt(input.prompt ?? 'Analiza el estado actual y prioriza la semana.');
    if (!prompt) throw new BadRequestException('Prompt vacío');

    const now = new Date();
    const year = now.getUTCFullYear();
    const snapshot = await this.buildSnapshot(year);
    const thread = input.threadId
      ? await this.findThread(user.id, input.threadId)
      : await this.prisma.aiInsightThread.create({
          data: {
            userId: user.id,
            title: makeTitle(prompt),
            context: { year, createdFrom: 'AI_INSIGHT' },
          },
        });

    await this.prisma.aiInsightMessage.create({
      data: { threadId: thread.id, role: 'user', content: { prompt } },
    });

    const prior = await this.prisma.aiInsightMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const resolved = await this.resolveInsight(prompt, snapshot, prior.map((message) => message.content));
    const message = await this.prisma.aiInsightMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        content: resolved.insight,
        model: resolved.model,
      },
    });

    await this.prisma.aiInsightThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'AI_INSIGHT',
      entity: 'AiInsightThread',
      entityId: thread.id,
      after: {
        prompt,
        model: resolved.model,
        parser: resolved.parser,
        evidenceIds: resolved.insight.explanation.evidenceIds,
        messageId: message.id,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return {
      threadId: thread.id,
      messageId: message.id,
      insight: resolved.insight,
      snapshot,
      _meta: { model: resolved.model, latencyMs: resolved.latencyMs, parser: resolved.parser },
    };
  }

  private async findThread(userId: string, threadId: string) {
    const thread = await this.prisma.aiInsightThread.findFirst({ where: { id: threadId, userId } });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  private async buildSnapshot(year: number) {
    const [pipeline, overdue, upcoming] = await Promise.all([
      this.schedule.pipeline({ yearFrom: year, monthFrom: 1, yearTo: year, monthTo: 12 }),
      this.schedule.overdue(),
      this.schedule.upcoming(7),
    ]);

    const criticalOverdue = overdue.rows.filter((row) => row.task.indicadorAbc === 'A');
    const peakMonth = pipeline.byMonth.reduce<(typeof pipeline.byMonth)[number] | null>(
      (acc, row) => (!acc || row.plannedHh > acc.plannedHh ? row : acc),
      null,
    );
    const topOverdue = overdue.rows.slice(0, 8).map((row, index) => ({
      evidenceId: `overdue-${index + 1}`,
      description: row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin descripción',
      abc: row.task.indicadorAbc,
      psr: row.task.psr,
      dueDate: row.dueDate,
      hhPlanned: Number(row.hhPlanned),
    }));
    const upcomingRows = upcoming.rows.slice(0, 8).map((row, index) => ({
      evidenceId: `upcoming-${index + 1}`,
      description: row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin descripción',
      abc: row.task.indicadorAbc,
      psr: row.task.psr,
      dueDate: row.dueDate,
      hhPlanned: Number(row.hhPlanned),
    }));

    return {
      generatedAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'totals',
          totals: pipeline.totals,
        },
        {
          evidenceId: 'critical-overdue',
          count: criticalOverdue.length,
          totalHh: criticalOverdue.reduce((sum, row) => sum + Number(row.hhPlanned), 0),
        },
        ...(peakMonth
          ? [{
              evidenceId: 'peak-month',
              year: peakMonth.year,
              month: peakMonth.month,
              plannedHh: peakMonth.plannedHh,
              overdue: peakMonth.overdue,
              pending: peakMonth.pending,
            }]
          : []),
        ...topOverdue,
        ...upcomingRows,
      ],
      pipeline,
      overdueCount: overdue.count,
      upcomingCount: upcoming.count,
      upcomingHh: upcoming.totalHh,
    };
  }

  private async resolveInsight(prompt: string, snapshot: unknown, priorMessages: unknown[]) {
    try {
      const payload = JSON.stringify({ prompt, snapshot, priorMessages });
      const llm = await callLlmForInsights(payload);
      const result = InsightSchema.safeParse(tryParseJson(llm.raw));
      if (result.success) {
        return { insight: result.data, model: llm.model, latencyMs: llm.latencyMs, parser: 'llm' as const };
      }
    } catch {
      // Fallback determinístico abajo.
    }

    return {
      insight: deterministicInsight(snapshot as Awaited<ReturnType<InsightsService['buildSnapshot']>>),
      model: 'deterministic-fallback',
      latencyMs: 0,
      parser: 'heuristic' as const,
    };
  }
}

function deterministicInsight(snapshot: Awaited<ReturnType<InsightsService['buildSnapshot']>>): Insight {
  const totals = snapshot.pipeline.totals;
  const critical = snapshot.evidence.find((item) => item.evidenceId === 'critical-overdue') as { count: number; totalHh: number } | undefined;
  const peak = snapshot.evidence.find((item) => item.evidenceId === 'peak-month') as { year: number; month: number; plannedHh: number } | undefined;

  return {
    summary: `Backlog actual: ${totals.overdue} vencidas, ${totals.pending} pendientes y ${totals.completionRate.toFixed(1)}% de cumplimiento.`,
    findings: [
      `Hay ${critical?.count ?? 0} vencidas ABC-A con ${(critical?.totalHh ?? 0).toFixed(1)} HH planificadas.`,
      `Los próximos 7 días concentran ${snapshot.upcomingHh.toFixed(1)} HH en ${snapshot.upcomingCount} ejecuciones.`,
      peak ? `El pico de carga está en ${String(peak.month).padStart(2, '0')}/${peak.year}: ${peak.plannedHh.toFixed(1)} HH plan.` : 'No hay pico mensual detectable.',
    ],
    risks: [
      totals.overdue > 0 ? 'El backlog vencido puede contaminar la capacidad semanal si no se bloquea agenda para cierre.' : 'Sin vencidas relevantes detectadas en el snapshot.',
      (critical?.count ?? 0) > 0 ? 'Las vencidas ABC-A deben tratarse como riesgo operacional prioritario.' : 'No hay cola crítica ABC-A según el snapshot.',
    ],
    nextActions: [
      'Cerrar primero vencidas ABC-A y asignar responsable PSR antes de trabajo B/C.',
      'Reservar capacidad semanal igual o superior a las HH próximas 7 días.',
      'Revisar el mes de mayor carga y redistribuir si supera disponibilidad real.',
    ],
    explanation: {
      method: 'Fallback determinístico basado en totales, cola ABC-A, próximos 7 días y pico mensual.',
      evidenceIds: ['totals', 'critical-overdue', 'peak-month'],
    },
  };
}

function makeTitle(prompt: string) {
  return prompt.length > 56 ? `${prompt.slice(0, 53)}…` : prompt;
}

'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AiInsightResponse, AiInsightThread, ChartResponse, ExecutionList, ExecutionRow, PipelineResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartPanel } from '../_components/ChartPanel';
import { KpiCard } from '../_components/KpiCard';
import { StatusBadge } from '../_components/StatusBadge';

const HH_FORMAT = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUMBER_FORMAT = new Intl.NumberFormat('es-CL');
const MONTH_FORMAT = new Intl.DateTimeFormat('es-CL', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

const PROMPTS = [
  'gráfico de HH plan por mes para vencidas ABC A',
  'conteo por PSR de tareas vencidas',
  'HH real por frecuencia este año',
  'distribución por centro de planificación',
];

export default function GraficosIaPage() {
  const nowYear = new Date().getUTCFullYear();
  const [prompt, setPrompt] = useState(PROMPTS[0] ?? '');
  const [insightPrompt, setInsightPrompt] = useState('Analiza riesgo operacional, vencidas ABC-A, HH próximas 7 días y próximos pasos.');
  const [threadId, setThreadId] = useState<string | undefined>();
  const NEW_THREAD = '__new__';

  const pipelineQuery = useQuery({
    queryKey: ['ai-insights-pipeline', nowYear],
    queryFn: () => api<PipelineResult>(`/api/schedule/pipeline?yearFrom=${nowYear}&monthFrom=1&yearTo=${nowYear}&monthTo=12`),
    refetchInterval: 60_000,
  });
  const upcomingQuery = useQuery({
    queryKey: ['ai-insights-upcoming'],
    queryFn: () => api<ExecutionList>('/api/schedule/upcoming?days=7'),
    refetchInterval: 60_000,
  });
  const overdueQuery = useQuery({
    queryKey: ['ai-insights-overdue'],
    queryFn: () => api<ExecutionList>('/api/schedule/overdue'),
    refetchInterval: 60_000,
  });
  const threadsQuery = useQuery({
    queryKey: ['ai-insight-threads'],
    queryFn: () => api<AiInsightThread[]>('/api/ai/insights/threads'),
  });

  const chartMutation = useMutation({
    mutationFn: (nextPrompt: string) =>
      api<ChartResponse>('/api/ai/chart', { method: 'POST', body: JSON.stringify({ prompt: nextPrompt }) }),
  });
  const insightMutation = useMutation({
    mutationFn: (payload: { prompt: string; threadId?: string }) =>
      api<AiInsightResponse>('/api/ai/insights', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      setThreadId(data.threadId);
      threadsQuery.refetch();
    },
  });

  const pipeline = pipelineQuery.data;
  const upcoming = upcomingQuery.data;
  const overdue = overdueQuery.data;

  const localInsights = useMemo(() => buildNarrativeInsights(pipeline, overdue?.rows ?? [], upcoming?.rows ?? []), [pipeline, overdue, upcoming]);
  const insight = insightMutation.data?.insight;
  const weeklyPlan = useMemo(() => buildWeeklyPlan(overdue?.rows ?? [], upcoming?.rows ?? []), [overdue, upcoming]);
  const activeThread = useMemo(
    () => (threadId ? (threadsQuery.data ?? []).find((t) => t.id === threadId) : undefined),
    [threadId, threadsQuery.data],
  );
  const threadHistory = useMemo(() => {
    if (!activeThread) return [];
    return activeThread.messages
      .filter((m) => m.role === 'assistant' && m.content)
      .map((m) => m.content as AiInsightResponse['insight']);
  }, [activeThread]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (clean.length >= 2) chartMutation.mutate(clean);
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">IA operacional</p>
          <h1 className="text-2xl font-semibold text-text">Insights, gráficos y plan semanal</h1>
        </div>
        <div className="rounded-full border border-ds-accent/30 bg-accent-dim px-3 py-1 text-xs font-medium text-ds-accent">
          IA activa
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vencidas críticas ABC-A" value={NUMBER_FORMAT.format(localInsights.criticalOverdue)} tone={localInsights.criticalOverdue ? 'danger' : 'ok'} loading={overdueQuery.isLoading} />
        <KpiCard title="HH próximas 7 días" value={`${HH_FORMAT.format(upcoming?.totalHh ?? 0)} HH`} tone="accent" loading={upcomingQuery.isLoading} />
        <KpiCard title="Backlog total" value={pipeline ? NUMBER_FORMAT.format(pipeline.totals.overdue) : '—'} tone="danger" loading={pipelineQuery.isLoading} />
        <KpiCard title="Cumplimiento año" value={pipeline ? `${HH_FORMAT.format(pipeline.totals.completionRate)}%` : '—'} tone="ok" loading={pipelineQuery.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-ds-accent" />
            <h2 className="text-sm font-semibold text-text">Insight narrativo auditable</h2>
          </div>
          <div className="flex flex-col gap-3">
            <textarea
              value={insightPrompt}
              onChange={(event) => setInsightPrompt(event.target.value)}
              maxLength={500}
              rows={3}
              className="min-h-24 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text"
              placeholder="Pide un análisis narrativo con foco en riesgo, HH, PSR o centros…"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => insightMutation.mutate({ prompt: insightPrompt.trim(), threadId })}
                disabled={insightMutation.isPending || insightPrompt.trim().length < 2}
              >
                {insightMutation.isPending ? 'Analizando…' : 'Generar insight auditado'}
              </Button>
              <Select value={threadId ?? NEW_THREAD} onValueChange={(value) => setThreadId(value === NEW_THREAD ? undefined : value)}>
                <SelectTrigger className="h-9 w-52 text-sm" aria-label="Seleccionar hilo de análisis IA">
                  <SelectValue placeholder="Nuevo hilo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_THREAD}>Nuevo hilo</SelectItem>
                  {(threadsQuery.data ?? []).map((thread) => (
                    <SelectItem key={thread.id} value={thread.id}>
                      {thread.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {insightMutation.isError && (
              <p className="rounded-lg bg-danger-dim px-3 py-2 text-sm text-danger">
                {insightMutation.error instanceof ApiError
                  ? (insightMutation.error.body as { message?: string })?.message ?? 'No se pudo generar el insight.'
                  : 'No se pudo generar el insight.'}
              </p>
            )}
            {threadHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ds-muted">Historial del hilo</p>
                {threadHistory.slice(0, -1).map((msg, index) => (
                  <div key={index} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 opacity-70">
                    <p className="text-sm font-medium text-text">{msg.summary}</p>
                  </div>
                ))}
              </div>
            )}
            {insightMutation.data ? (
              <InsightCard result={insightMutation.data} />
            ) : threadHistory.length > 0 ? (
              <InsightFromHistory insight={threadHistory.at(-1)!} />
            ) : (
              <div className="space-y-2">
                {localInsights.messages.map((message) => (
                  <p key={message} className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm leading-6 text-text">
                    {message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="size-4 text-ds-accent" />
            <h2 className="text-sm font-semibold text-text">Generador de gráficos IA</h2>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              className="min-h-10 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-text"
              placeholder="Ej: HH por mes de vencidas ABC A…"
            />
            <Button type="submit" disabled={chartMutation.isPending || prompt.trim().length < 2}>
              {chartMutation.isPending ? 'Generando…' : 'Generar'}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setPrompt(sample);
                  chartMutation.mutate(sample);
                }}
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-ds-muted transition-colors hover:border-ds-accent hover:text-text"
              >
                {sample}
              </button>
            ))}
          </div>
          {chartMutation.isError && (
            <p className="mt-3 rounded-lg bg-danger-dim px-3 py-2 text-sm text-danger">
              {chartMutation.error instanceof ApiError
                ? (chartMutation.error.body as { message?: string; hint?: string })?.hint ??
                  (chartMutation.error.body as { message?: string })?.message ??
                  'La IA no pudo interpretar el gráfico.'
                : 'La IA no pudo interpretar el gráfico.'}
            </p>
          )}
        </section>
      </div>

      {chartMutation.data && (
        <ChartPanel
          title={chartMutation.data.spec.title ?? 'Gráfico generado por IA'}
          subtitle={`Agrupado por ${chartMutation.data.spec.groupBy} · métrica ${chartMutation.data.spec.metric} · ${chartMutation.data._meta.model}`}
        >
          <AiChart result={chartMutation.data} />
        </ChartPanel>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">Planificador semanal priorizado</h2>
          <span className="text-xs text-ds-muted">{weeklyPlan.length} acciones</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {weeklyPlan.map((row) => (
            <article key={row.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text">Prioridad {priorityLabel(row)}</span>
                <StatusBadge status={row.status} />
              </div>
              <p className="line-clamp-2 text-sm font-medium text-text">{row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin descripción'}</p>
              <p className="mt-2 text-xs text-ds-muted">
                {formatPeriod(row.dueDate)} · ABC {row.task.indicadorAbc ?? '—'} · {HH_FORMAT.format(Number(row.hhPlanned))} HH · {row.task.psr ?? 'Sin PSR'}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AiChart({ result }: { result: ChartResponse }) {
  const data = result.data.map((row) => ({ ...row, label: row.key || 'Sin dato' }));
  const metricLabel = result.spec.metric === 'count' ? 'Cantidad' : result.spec.metric === 'hhActual' ? 'HH real' : 'HH plan';

  if (result.spec.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Tooltip formatter={(value) => HH_FORMAT.format(Number(value))} />
          <Legend />
          <Pie data={data} dataKey="value" nameKey="label" outerRadius={120} label>
            {data.map((row, index) => (
              <Cell key={row.key} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const Chart = result.spec.chartType === 'line' ? LineChart : result.spec.chartType === 'area' ? AreaChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <Chart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip formatter={(value) => HH_FORMAT.format(Number(value))} />
        <Legend />
        {result.spec.chartType === 'line' && <Line type="monotone" dataKey="value" name={metricLabel} stroke="#2563eb" strokeWidth={2} />}
        {result.spec.chartType === 'area' && <Area type="monotone" dataKey="value" name={metricLabel} stroke="#2563eb" fill="#bfdbfe" />}
        {result.spec.chartType === 'bar' && <Bar dataKey="value" name={metricLabel} fill="#2563eb" />}
      </Chart>
    </ResponsiveContainer>
  );
}

function InsightFromHistory({ insight }: { insight: AiInsightResponse['insight'] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <p className="mb-3 text-sm font-semibold text-text">{insight.summary}</p>
      <InsightList title="Hallazgos" items={insight.findings} />
      <InsightList title="Riesgos" items={insight.risks} />
      <InsightList title="Siguientes acciones" items={insight.nextActions} />
    </div>
  );
}

function InsightCard({ result }: { result: AiInsightResponse }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">{result.insight.summary}</p>
        <span className="rounded-md bg-accent-dim px-2 py-1 text-[11px] font-medium text-ds-accent">
          {result._meta.model} · {result._meta.parser}
        </span>
      </div>
      <InsightList title="Hallazgos" items={result.insight.findings} />
      <InsightList title="Riesgos" items={result.insight.risks} />
      <InsightList title="Siguientes acciones" items={result.insight.nextActions} />
      <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <p className="text-xs font-semibold text-text">Explicación auditable</p>
        <p className="mt-1 text-xs leading-5 text-ds-muted">{result.insight.explanation.method}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {result.insight.explanation.evidenceIds.map((id) => (
            <span key={id} className="rounded bg-[var(--color-surface-2)] px-2 py-0.5 font-mono text-[11px] text-ds-muted">
              {id}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ds-muted">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-text">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildNarrativeInsights(pipeline: PipelineResult | undefined, overdue: ExecutionRow[], upcoming: ExecutionRow[]) {
  const criticalOverdue = overdue.filter((row) => row.task.indicadorAbc === 'A').length;
  const upcomingHh = upcoming.reduce((sum, row) => sum + Number(row.hhPlanned), 0);
  const peakMonth = pipeline?.byMonth.reduce<PipelineResult['byMonth'][number] | null>(
    (acc, row) => (!acc || row.plannedHh > acc.plannedHh ? row : acc),
    null,
  );

  const messages = [
    criticalOverdue > 0
      ? `Hay ${NUMBER_FORMAT.format(criticalOverdue)} mantenciones ABC-A vencidas. Conviene tratarlas como cola crítica antes de abrir trabajo preventivo de menor impacto.`
      : 'No aparecen mantenciones ABC-A vencidas en este corte. Es una buena ventana para reducir pendientes B/C y cerrar trazabilidad.',
    `La semana móvil concentra ${HH_FORMAT.format(upcomingHh)} HH planificadas. Usa este número como capacidad mínima a reservar antes de aceptar trabajo correctivo no planificado.`,
    peakMonth
      ? `El mes de mayor carga es ${formatMonth(peakMonth.year, peakMonth.month)} con ${HH_FORMAT.format(peakMonth.plannedHh)} HH planificadas. Revisa disponibilidad de PSR y ventanas de intervención.`
      : 'Aún no hay datos mensuales suficientes para detectar el mes de mayor carga.',
  ];

  return { criticalOverdue, messages };
}

function buildWeeklyPlan(overdue: ExecutionRow[], upcoming: ExecutionRow[]) {
  const map = new Map<string, ExecutionRow>();
  for (const row of [...overdue, ...upcoming]) map.set(row.id, row);
  return [...map.values()].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 9);
}

function priorityScore(row: ExecutionRow) {
  const abc = row.task.indicadorAbc === 'A' ? 60 : row.task.indicadorAbc === 'B' ? 30 : 10;
  const status = row.status === 'OVERDUE' ? 120 : row.status === 'PENDING' ? 40 : 0;
  return status + abc + Number(row.hhPlanned);
}

function priorityLabel(row: ExecutionRow) {
  const score = priorityScore(row);
  if (score >= 170) return 'crítica';
  if (score >= 100) return 'alta';
  return 'media';
}

function formatMonth(year: number, month: number) {
  return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
}

function formatPeriod(iso: string) {
  const d = new Date(iso);
  return formatMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

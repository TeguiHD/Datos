'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import type { ExecutionAnalyticsList, ExecutionRow, PipelineMonthPoint, PipelineResult } from '@/lib/types';
import { ChartPanel } from '../_components/ChartPanel';
import { KpiCard } from '../_components/KpiCard';
import { StatusBadge } from '../_components/StatusBadge';

const HH_FORMAT = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUMBER_FORMAT = new Intl.NumberFormat('es-CL');
const MONTH_FORMAT = new Intl.DateTimeFormat('es-CL', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  DONE: 'Hecha',
  SKIPPED: 'Omitida',
} as const;

const HEATMAP_STATUSES = ['OVERDUE', 'PENDING', 'DONE', 'SKIPPED'] as const;
const HEATMAP_COLORS = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'];
const TREEMAP_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#64748b', '#dc2626'];
// Relative luminance threshold — colors above 0.35 get dark text
const HEATMAP_DARK_TEXT = new Set(['#eff6ff', '#bfdbfe', '#60a5fa', '#e2e8f0']);

export default function AnalyticsPage() {
  const now = new Date();
  const [yearFrom, setYearFrom] = useState(now.getUTCFullYear() - 1);
  const [yearTo, setYearTo] = useState(now.getUTCFullYear());

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('yearFrom', String(yearFrom));
    p.set('monthFrom', '1');
    p.set('yearTo', String(yearTo));
    p.set('monthTo', '12');
    return p.toString();
  }, [yearFrom, yearTo]);

  const pipelineQuery = useQuery({
    queryKey: ['analytics-pipeline', params],
    queryFn: () => api<PipelineResult>(`/api/schedule/pipeline?${params}`),
    refetchInterval: 60_000,
  });

  const executionsQuery = useQuery({
    queryKey: ['analytics-executions', params],
    queryFn: () => api<ExecutionAnalyticsList>(`/api/schedule/executions?${params}&take=5000&skip=0&sortBy=dueDate&sortDir=asc`),
    refetchInterval: 60_000,
  });

  const pipeline = pipelineQuery.data;
  const executions = executionsQuery.data;

  const monthRows = useMemo(
    () =>
      (pipeline?.byMonth ?? []).map((row) => ({
        ...row,
        period: formatMonth(row.year, row.month),
        riskScore: row.overdue * 3 + row.pending,
      })),
    [pipeline],
  );

  const forecastRows = useMemo(() => buildForecast(monthRows), [monthRows]);
  const anomalies = useMemo(() => buildAnomalies(monthRows, executions?.rows ?? []), [executions, monthRows]);
  const treemapRows = useMemo(() => buildTreemap(executions?.rows ?? []), [executions]);

  const worstMonth = monthRows.reduce<PipelineMonthPoint & { period: string; riskScore: number } | null>(
    (acc, row) => (!acc || row.riskScore > acc.riskScore ? row : acc),
    null,
  );

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Analytics operacional</p>
          <h1 className="text-2xl font-semibold text-text">Riesgo, carga HH y anomalías</h1>
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <Field label="Desde">
            <input
              type="number"
              min={2000}
              max={2100}
              value={yearFrom}
              onChange={(event) => setYearFrom(Number(event.target.value) || now.getUTCFullYear() - 1)}
              className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="number"
              min={2000}
              max={2100}
              value={yearTo}
              onChange={(event) => setYearTo(Number(event.target.value) || now.getUTCFullYear())}
              className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <KpiCard title="HH plan período" value={pipeline ? HH_FORMAT.format(pipeline.totals.plannedHh) : '—'} tone="accent" loading={pipelineQuery.isLoading} />
        <KpiCard title="HH real período" value={pipeline ? HH_FORMAT.format(pipeline.totals.actualHh) : '—'} tone="ok" loading={pipelineQuery.isLoading} />
        <KpiCard title="Mes más riesgoso" value={worstMonth?.period ?? '—'} tone="danger" loading={pipelineQuery.isLoading} />
        <KpiCard title="Anomalías detectadas" value={anomalies.length} tone={anomalies.length ? 'warn' : 'ok'} loading={pipelineQuery.isLoading || executionsQuery.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Forecast HH plan" subtitle="Proyección 3 meses con tendencia móvil" loading={pipelineQuery.isLoading}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => HH_FORMAT.format(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="plannedHh" name="HH histórica" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="forecastHh" name="Forecast" stroke="#d97706" strokeWidth={2} strokeDasharray="6 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Heatmap riesgo mensual" subtitle="Vencidas pesan 3x, pendientes 1x" loading={pipelineQuery.isLoading}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[var(--color-surface)] px-2 py-1 text-left text-ds-muted">Estado</th>
                  {monthRows.map((row) => (
                    <th key={`${row.year}-${row.month}`} className="px-2 py-1 text-center font-medium text-ds-muted">
                      {row.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_STATUSES.map((status) => (
                  <tr key={status}>
                    <th className="sticky left-0 bg-[var(--color-surface)] px-2 py-1 text-left font-medium text-text">
                      {STATUS_LABELS[status]}
                    </th>
                    {monthRows.map((row) => {
                      const statusKey = status.toLowerCase() as 'overdue' | 'pending' | 'done' | 'skipped';
                      const value = row[statusKey];
                      return (
                        <td
                          key={`${status}-${row.year}-${row.month}`}
                          className="h-9 min-w-16 rounded-md text-center font-mono text-xs"
                          style={{ backgroundColor: heatColor(value, maxStatusValue(monthRows, statusKey)), color: heatTextColor(value, maxStatusValue(monthRows, statusKey)) }}
                          title={`${STATUS_LABELS[status]} ${row.period}: ${NUMBER_FORMAT.format(value)}`}
                        >
                          {value > 0 ? NUMBER_FORMAT.format(value) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>

        <ChartPanel title="Treemap ABC × HH" subtitle="Tamaño por HH planificada filtrada" loading={executionsQuery.isLoading}>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={treemapRows}
              dataKey="size"
              nameKey="name"
              aspectRatio={4 / 3}
              content={<TreemapCell colors={TREEMAP_COLORS} />}
            />
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Backlog acumulado" subtitle="Comparación de vencidas vs cierre" loading={pipelineQuery.isLoading}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="backlog" name="Backlog" stroke="#dc2626" fill="#fecaca" />
              <Area type="monotone" dataKey="closed" name="Cerradas" stroke="#059669" fill="#bbf7d0" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <h2 className="text-sm font-semibold text-text">Anomalías y focos</h2>
          </div>
          <div className="space-y-2">
            {anomalies.length === 0 ? (
              <p className="rounded-lg bg-ok-dim px-3 py-2 text-sm text-ok">Sin anomalías relevantes en el rango.</p>
            ) : (
              anomalies.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <p className="text-sm font-medium text-text">{item.title}</p>
                  <p className="mt-1 text-xs text-ds-muted">{item.detail}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <ChartPanel title="Distribución por estado" subtitle="Volumen y HH real" loading={executionsQuery.isLoading}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={executions?.statusSplit ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tickFormatter={(value) => STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Cantidad" fill="#2563eb" />
              <Bar dataKey="totalHhActual" name="HH real" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-4 text-ds-accent" />
          <h2 className="text-sm font-semibold text-text">Top acciones sugeridas por datos</h2>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {(executions?.rows ?? [])
            .filter((row) => row.status === 'OVERDUE' || row.status === 'PENDING')
            .sort((a, b) => priorityScore(b) - priorityScore(a))
            .slice(0, 6)
            .map((row) => (
              <article key={row.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text">ABC {row.task.indicadorAbc ?? '—'}</span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="line-clamp-2 text-sm text-text">{row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin descripción'}</p>
                <p className="mt-2 text-xs text-ds-muted">
                  {formatPeriod(row.dueDate)} · {HH_FORMAT.format(Number(row.hhPlanned))} HH · {row.task.psr ?? 'Sin PSR'}
                </p>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ds-muted">
      {label}
      {children}
    </label>
  );
}

function formatMonth(year: number, month: number) {
  return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
}

function formatPeriod(iso: string) {
  const d = new Date(iso);
  return formatMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function buildForecast(rows: Array<PipelineMonthPoint & { period: string }>) {
  if (rows.length === 0) return [];
  const last = rows.at(-1)!;
  const window = rows.slice(-6);
  const avg = window.reduce((sum, row) => sum + row.plannedHh, 0) / window.length;
  const trend = window.length > 1 ? (window.at(-1)!.plannedHh - window[0]!.plannedHh) / (window.length - 1) : 0;
  const forecast = Array.from({ length: 3 }, (_, index) => {
    const totalMonths = last.year * 12 + last.month + index;
    const year = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;
    return {
      period: formatMonth(year, month),
      forecastHh: Math.max(0, avg + trend * (index + 1)),
    };
  });
  return [
    ...rows.map((row, index) => ({ ...row, forecastHh: index === rows.length - 1 ? row.plannedHh : null })),
    ...forecast,
  ];
}

function buildAnomalies(rows: Array<PipelineMonthPoint & { period: string }>, executions: ExecutionRow[]) {
  const planned = rows.map((row) => row.plannedHh);
  const avg = planned.length ? planned.reduce((sum, value) => sum + value, 0) / planned.length : 0;
  const sd = Math.sqrt(planned.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(1, planned.length));
  const monthAnomalies = rows
    .filter((row) => row.plannedHh > avg + sd * 1.4 && row.plannedHh > 0)
    .map((row) => ({
      id: `month-${row.year}-${row.month}`,
      title: `Carga HH inusual en ${row.period}`,
      detail: `${HH_FORMAT.format(row.plannedHh)} HH planificadas, sobre el patrón promedio del período.`,
    }));

  const executionAnomalies = executions
    .filter((row) => row.status === 'DONE' && Number(row.hhActual ?? 0) > Number(row.hhPlanned) * 2.5 && Number(row.hhPlanned) > 0)
    .slice(0, 5)
    .map((row) => ({
      id: `exec-${row.id}`,
      title: `HH real alta: ${row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Tarea sin descripción'}`,
      detail: `${HH_FORMAT.format(Number(row.hhActual ?? 0))} HH reales vs ${HH_FORMAT.format(Number(row.hhPlanned))} HH planificadas.`,
    }));

  const criticalOverdue = executions
    .filter((row) => row.status === 'OVERDUE' && row.task.indicadorAbc === 'A')
    .slice(0, 5)
    .map((row) => ({
      id: `critical-${row.id}`,
      title: `ABC-A vencida: ${row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Tarea sin descripción'}`,
      detail: `${formatPeriod(row.dueDate)} · ${row.task.psr ?? 'Sin PSR'} · ${HH_FORMAT.format(Number(row.hhPlanned))} HH plan.`,
    }));

  return [...criticalOverdue, ...executionAnomalies, ...monthAnomalies];
}

function buildTreemap(rows: ExecutionRow[]) {
  const groups = new Map<string, number>();
  for (const row of rows) {
    const key = `ABC ${row.task.indicadorAbc ?? 'S/C'} · ${row.task.frecuenciaCodigo ?? 'Sin frecuencia'}`;
    groups.set(key, (groups.get(key) ?? 0) + Number(row.hhPlanned));
  }
  return [...groups.entries()]
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 18);
}

function heatColor(value: number, max: number) {
  if (value <= 0 || max <= 0) return '#e2e8f0';
  const index = Math.min(HEATMAP_COLORS.length - 1, Math.ceil((value / max) * (HEATMAP_COLORS.length - 1)));
  return HEATMAP_COLORS[index] ?? '#2563eb';
}

function heatTextColor(value: number, max: number) {
  return HEATMAP_DARK_TEXT.has(heatColor(value, max)) ? '#0f172a' : '#ffffff';
}

function maxStatusValue(rows: Array<PipelineMonthPoint & { period: string }>, status: keyof Pick<PipelineMonthPoint, 'overdue' | 'pending' | 'done' | 'skipped'>) {
  return Math.max(0, ...rows.map((row) => row[status]));
}

function TreemapCell({ x, y, width, height, name, root, depth, index, colors }: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; root?: boolean; depth?: number; index?: number; colors?: string[];
}) {
  if (root || depth === 0 || !width || !height || width < 2 || height < 2) return null;
  const fill = (colors ?? TREEMAP_COLORS)[(index ?? 0) % (colors ?? TREEMAP_COLORS).length];
  const showLabel = width > 60 && height > 30;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {showLabel && (
        <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) + (height ?? 0) / 2} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={Math.min(13, width / 8)} fontWeight={500} style={{ pointerEvents: 'none' }}>
          <tspan x={(x ?? 0) + (width ?? 0) / 2} dy="-0.5em">{(name ?? '').length > 20 ? name!.slice(0, 18) + '…' : name}</tspan>
        </text>
      )}
    </g>
  );
}

function priorityScore(row: ExecutionRow) {
  const abc = row.task.indicadorAbc === 'A' ? 50 : row.task.indicadorAbc === 'B' ? 25 : 10;
  const status = row.status === 'OVERDUE' ? 100 : 30;
  return status + abc + Number(row.hhPlanned);
}

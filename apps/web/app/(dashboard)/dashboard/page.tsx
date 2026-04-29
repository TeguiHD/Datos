'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type {
  ExecutionAnalyticsList,
  ExecutionGroupResult,
  ExecutionRow,
  ExecutionViewFilters,
  ExecStatus,
  PipelineResult,
  SavedExecutionView,
} from '@/lib/types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UpcomingWeekWidget } from './_components/UpcomingWeekWidget';
import { ChevronDown, Filter as FilterIcon } from 'lucide-react';

interface Kpis {
  taskCount: number;
  abcSplit: { indicadorAbc: string | null; _count: { _all: number } }[];
  freqSplit: { frecuenciaCodigo: string | null; _count: { _all: number } }[];
  pendingCount: number;
  overdueCount: number;
  discCount: number;
}

type SortField =
  | 'dueDate'
  | 'status'
  | 'hhPlanned'
  | 'hhActual'
  | 'abc'
  | 'frecuencia'
  | 'psr'
  | 'centroPlanificacion';
type GroupField = ExecutionGroupResult['groupBy'];

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'dueDate', label: 'Periodo' },
  { value: 'status', label: 'Estado' },
  { value: 'hhPlanned', label: 'HH plan' },
  { value: 'hhActual', label: 'HH real' },
  { value: 'abc', label: 'ABC' },
  { value: 'frecuencia', label: 'Frecuencia' },
  { value: 'psr', label: 'PSR' },
  { value: 'centroPlanificacion', label: 'Centro' },
];

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: 'status', label: 'Estado' },
  { value: 'abc', label: 'ABC' },
  { value: 'frecuencia', label: 'Frecuencia' },
  { value: 'psr', label: 'PSR' },
  { value: 'centroPlanificacion', label: 'Centro' },
];

export default function DashboardHome() {
  const nowYear = new Date().getUTCFullYear();
  const qc = useQueryClient();

  const [yearFrom, setYearFrom] = useState(nowYear - 1);
  const [monthFrom, setMonthFrom] = useState(1);
  const [yearTo, setYearTo] = useState(nowYear);
  const [monthTo, setMonthTo] = useState(12);
  const [status, setStatus] = useState<ExecStatus | ''>('');
  const [abc, setAbc] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [psr, setPsr] = useState('');
  const [centroPlanificacion, setCentroPlanificacion] = useState('');
  const [q, setQ] = useState('');

  const [groupBy, setGroupBy] = useState<GroupField>('status');
  const [sortBy, setSortBy] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [take, setTake] = useState(25);
  const [page, setPage] = useState(0);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [viewName, setViewName] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);

  const baseParams = useMemo(
    () =>
      buildParams({
        yearFrom,
        monthFrom,
        yearTo,
        monthTo,
        status: status || undefined,
        abc: abc.trim() || undefined,
        frecuencia: frecuencia.trim() || undefined,
        psr: psr.trim() || undefined,
        centroPlanificacion: centroPlanificacion.trim() || undefined,
        q: q.trim() || undefined,
      }),
    [yearFrom, monthFrom, yearTo, monthTo, status, abc, frecuencia, psr, centroPlanificacion, q],
  );

  const executionsParams = useMemo(() => {
    const next = new URLSearchParams(baseParams);
    next.set('take', String(take));
    next.set('skip', String(page * take));
    next.set('sortBy', sortBy);
    next.set('sortDir', sortDir);
    return next.toString();
  }, [baseParams, take, page, sortBy, sortDir]);

  const groupParams = useMemo(() => {
    const next = new URLSearchParams(baseParams);
    next.set('groupBy', groupBy);
    return next.toString();
  }, [baseParams, groupBy]);

  const currentViewFilters = useMemo<ExecutionViewFilters>(
    () => ({
      yearFrom,
      monthFrom,
      yearTo,
      monthTo,
      ...(status ? { status } : {}),
      ...(abc.trim() ? { abc: abc.trim() } : {}),
      ...(frecuencia.trim() ? { frecuencia: frecuencia.trim() } : {}),
      ...(psr.trim() ? { psr: psr.trim() } : {}),
      ...(centroPlanificacion.trim() ? { centroPlanificacion: centroPlanificacion.trim() } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      groupBy,
      sortBy,
      sortDir,
      take,
    }),
    [yearFrom, monthFrom, yearTo, monthTo, status, abc, frecuencia, psr, centroPlanificacion, q, groupBy, sortBy, sortDir, take],
  );

  const kpisQuery = useQuery({ queryKey: ['kpis'], queryFn: () => api<Kpis>('/api/schedule/kpis') });
  const pipelineQuery = useQuery({
    queryKey: ['schedule-pipeline', baseParams],
    queryFn: () => api<PipelineResult>(`/api/schedule/pipeline?${baseParams}`),
    refetchInterval: 60_000,
  });
  const executionsQuery = useQuery({
    queryKey: ['schedule-executions', executionsParams],
    queryFn: () => api<ExecutionAnalyticsList>(`/api/schedule/executions?${executionsParams}`),
    refetchInterval: 60_000,
  });
  const groupQuery = useQuery({
    queryKey: ['schedule-group', groupParams],
    queryFn: () => api<ExecutionGroupResult>(`/api/schedule/executions/group?${groupParams}`),
    refetchInterval: 60_000,
  });
  const savedViewsQuery = useQuery({
    queryKey: ['schedule-views'],
    queryFn: () => api<SavedExecutionView[]>('/api/schedule/views'),
  });

  const kpis = kpisQuery.data;
  const pipeline = pipelineQuery.data;
  const executions = executionsQuery.data;
  const grouped = groupQuery.data;
  const savedViews = savedViewsQuery.data ?? [];

  const chartRows = useMemo(
    () =>
      (pipeline?.byMonth ?? []).map((r) => ({
        ...r,
        period: `${String(r.month).padStart(2, '0')}/${String(r.year).slice(-2)}`,
      })),
    [pipeline],
  );

  const updateExecution = useMutation({
    mutationFn: ({ id, status: nextStatus, hhPlanned }: { id: string; status: ExecStatus; hhPlanned: string }) =>
      api(`/api/schedule/executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          ...(nextStatus === 'DONE' ? { hhActual: Number(hhPlanned) } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-executions'] });
      qc.invalidateQueries({ queryKey: ['schedule-group'] });
      qc.invalidateQueries({ queryKey: ['schedule-pipeline'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });

  const saveViewMutation = useMutation({
    mutationFn: (payload: { name: string; filters: ExecutionViewFilters }) =>
      api<SavedExecutionView>('/api/schedule/views', {
        method: 'POST',
        body: JSON.stringify({ name: payload.name, ...payload.filters }),
      }),
    onSuccess: () => {
      setViewName('');
      setActionsError(null);
      qc.invalidateQueries({ queryKey: ['schedule-views'] });
    },
    onError: (err) => {
      setActionsError(err instanceof ApiError ? err.message : 'No se pudo guardar la vista.');
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; id: string }>(`/api/schedule/views/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      if (selectedViewId === id) setSelectedViewId('');
      setActionsError(null);
      qc.invalidateQueries({ queryKey: ['schedule-views'] });
    },
    onError: (err) => {
      setActionsError(err instanceof ApiError ? err.message : 'No se pudo eliminar la vista.');
    },
  });

  const applySavedView = (filters: ExecutionViewFilters) => {
    setYearFrom(filters.yearFrom ?? nowYear - 1);
    setMonthFrom(filters.monthFrom ?? 1);
    setYearTo(filters.yearTo ?? nowYear);
    setMonthTo(filters.monthTo ?? 12);
    setStatus(filters.status ?? '');
    setAbc(filters.abc ?? '');
    setFrecuencia(filters.frecuencia ?? '');
    setPsr(filters.psr ?? '');
    setCentroPlanificacion(filters.centroPlanificacion ?? '');
    setQ(filters.q ?? '');
    setGroupBy(filters.groupBy ?? 'status');
    setSortBy(filters.sortBy ?? 'dueDate');
    setSortDir(filters.sortDir ?? 'asc');
    setTake(filters.take ?? 25);
    setPage(0);
  };

  const exportExecutions = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    setActionsError(null);
    try {
      const params = new URLSearchParams(baseParams);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      params.set('take', '5000');
      params.set('format', format);

      const res = await fetch(`/api/schedule/executions/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        let msg = 'No se pudo exportar.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) msg = body.message;
        } catch {
          // ignore json parse errors
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = parseDownloadFilename(res.headers.get('content-disposition')) ?? `executions.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : 'No se pudo exportar.');
    } finally {
      setExporting(null);
    }
  };

  const firstError = [kpisQuery.error, pipelineQuery.error, executionsQuery.error, groupQuery.error].find(Boolean);
  const is2faError =
    firstError instanceof ApiError &&
    firstError.status === 403 &&
    (firstError.body as { message?: string })?.message === '2FA required';

  const totalRows = executions?.total ?? 0;
  const firstRow = totalRows === 0 ? 0 : page * take + 1;
  const lastRow = Math.min((page + 1) * take, totalRows);
  const canPrev = page > 0;
  const canNext = (page + 1) * take < totalRows;

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Planificación SAP PM</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Mantenciones · tablero en tiempo real</h1>
        </div>
        <p className="text-xs text-slate-500">
          {new Date().toISOString().slice(0, 10)} · refresco automático 60s
        </p>
      </div>

      {is2faError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Debes completar verificación 2FA para cargar el tablero.
        </div>
      )}

      <UpcomingWeekWidget />

      <details className="group rounded-xl border bg-white p-4 open:shadow-sm" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <FilterIcon className="h-3.5 w-3.5" />
            Filtros dinámicos
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <Field label="Año desde">
            <input
              type="number"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={yearFrom}
              onChange={(e) => {
                setYearFrom(Number(e.target.value) || nowYear - 1);
                setPage(0);
              }}
            />
          </Field>
          <Field label="Mes desde">
            <select
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={monthFrom}
              onChange={(e) => {
                setMonthFrom(Number(e.target.value));
                setPage(0);
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Año hasta">
            <input
              type="number"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={yearTo}
              onChange={(e) => {
                setYearTo(Number(e.target.value) || nowYear);
                setPage(0);
              }}
            />
          </Field>
          <Field label="Mes hasta">
            <select
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={monthTo}
              onChange={(e) => {
                setMonthTo(Number(e.target.value));
                setPage(0);
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ExecStatus | '');
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="OVERDUE">Vencida</option>
              <option value="DONE">Hecha</option>
              <option value="SKIPPED">Omitida</option>
            </select>
          </Field>
          <Field label="ABC">
            <input
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={abc}
              onChange={(e) => {
                setAbc(e.target.value);
                setPage(0);
              }}
              placeholder="A / B / C"
            />
          </Field>
          <Field label="Frecuencia">
            <input
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={frecuencia}
              onChange={(e) => {
                setFrecuencia(e.target.value);
                setPage(0);
              }}
              placeholder="1M, 6M, 1A"
            />
          </Field>
          <Field label="PSR / texto">
            <input
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="bomba, horno, etc"
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Vista guardada">
              <select
                className="min-w-[14rem] rounded-md border px-2 py-1.5 text-sm"
                value={selectedViewId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedViewId(id);
                  if (!id) return;
                  const selected = savedViews.find((view) => view.id === id);
                  if (!selected) return;
                  applySavedView(normalizeSavedViewFilters(selected.filters));
                }}
              >
                <option value="">Seleccionar</option>
                {savedViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={!selectedViewId || deleteViewMutation.isPending}
              onClick={() => deleteViewMutation.mutate(selectedViewId)}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 disabled:opacity-50"
            >
              {deleteViewMutation.isPending ? 'Eliminando...' : 'Eliminar vista'}
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Guardar vista actual">
              <input
                className="min-w-[14rem] rounded-md border px-2 py-1.5 text-sm"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Nombre de vista"
              />
            </Field>
            <button
              type="button"
              disabled={saveViewMutation.isPending}
              onClick={() => {
                const name = viewName.trim();
                if (!name) {
                  setActionsError('Nombre de vista requerido.');
                  return;
                }
                saveViewMutation.mutate({ name, filters: currentViewFilters });
              }}
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-900 disabled:opacity-50"
            >
              {saveViewMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exporting != null}
              onClick={() => exportExecutions('csv')}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {exporting === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              disabled={exporting != null}
              onClick={() => exportExecutions('xlsx')}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {exporting === 'xlsx' ? 'Exportando XLSX...' : 'Exportar XLSX'}
            </button>
          </div>
        </div>

        {savedViewsQuery.isError && (
          <p className="mt-2 text-xs text-amber-700">No se pudieron cargar las vistas guardadas.</p>
        )}
        {actionsError && <p className="mt-2 text-xs text-red-700">{actionsError}</p>}
      </details>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-6">
        <Card title="Tareas catálogo" value={kpis?.taskCount ?? '—'} loading={kpisQuery.isLoading} />
        <Card title="Pendientes" value={pipeline?.totals.pending ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <Card title="Vencidas" value={pipeline?.totals.overdue ?? '—'} tone="danger" loading={pipelineQuery.isLoading} />
        <Card title="Hechas" value={pipeline?.totals.done ?? '—'} tone="ok" loading={pipelineQuery.isLoading} />
        <Card title="Omitidas" value={pipeline?.totals.skipped ?? '—'} loading={pipelineQuery.isLoading} />
        <Card
          title="Cumplimiento"
          value={pipeline ? `${pipeline.totals.completionRate.toFixed(1)}%` : '—'}
          tone="ok"
          loading={pipelineQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Discrepancias" value={pipeline?.process.discrepancyCount ?? kpis?.discCount ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <Card title="Imports total" value={pipeline?.process.imports.total ?? '—'} loading={pipelineQuery.isLoading} />
        <Card title="Imports parciales" value={pipeline?.process.imports.partial ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <Card title="Rebuilds período" value={pipeline?.process.rebuildRuns ?? '—'} loading={pipelineQuery.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Carga HH por mes" subtitle="Planificadas vs reales">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="plannedHh" name="HH plan" stroke="#1d4ed8" fill="#93c5fd" />
              <Area type="monotone" dataKey="actualHh" name="HH real" stroke="#047857" fill="#86efac" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Estado por mes" subtitle="Pipeline operacional">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pending" stackId="s" fill="#f59e0b" name="Pendiente" />
              <Bar dataKey="overdue" stackId="s" fill="#dc2626" name="Vencida" />
              <Bar dataKey="done" stackId="s" fill="#059669" name="Hecha" />
              <Bar dataKey="skipped" stackId="s" fill="#64748b" name="Omitida" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Backlog vs cerrado" subtitle="Seguimiento de proceso">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="backlog" stroke="#b91c1c" name="Backlog" strokeWidth={2} />
              <Line type="monotone" dataKey="closed" stroke="#0369a1" name="Cerradas" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Distribución ABC" subtitle="Ejecuciones filtradas">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipeline?.abcSplit ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="key" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Distribución Frecuencia" subtitle="Ejecuciones filtradas">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipeline?.freqSplit ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="key" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Tabla dinámica por</h2>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupField)}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {groupQuery.isLoading ? (
            <ExecutionTableSkeleton rows={6} />
          ) : grouped && grouped.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Grupo</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">HH plan</th>
                    <th className="px-3 py-2 text-right">HH real</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.rows.slice(0, 12).map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="px-3 py-2">{row.key}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.totalHhPlanned.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.totalHhActual.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Sin datos para el agrupador seleccionado.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-medium">Tabla dinámica de ejecuciones</h2>
            <p className="text-xs text-slate-500">
              {executions
                ? `${firstRow}–${lastRow} de ${totalRows} · HH plan ${executions.totalHhPlanned.toFixed(1)} · HH real ${executions.totalHhActual.toFixed(1)}`
                : 'Cargando...'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortField);
                setPage(0);
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Orden: {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setPage(0);
              }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              {sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
            </button>
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={take}
              onChange={(e) => {
                setTake(Number(e.target.value));
                setPage(0);
              }}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / página
                </option>
              ))}
            </select>
          </div>
        </div>

        {executionsQuery.isLoading ? (
          <ExecutionTableSkeleton rows={8} />
        ) : executionsQuery.isError ? (
          <p className="text-sm text-red-700 py-8 text-center">No se pudo cargar la tabla dinámica.</p>
        ) : executions && executions.rows.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Periodo</th>
                    <th className="px-3 py-2 text-left">ABC</th>
                    <th className="px-3 py-2 text-left">Tarea</th>
                    <th className="px-3 py-2 text-left">PSR</th>
                    <th className="px-3 py-2 text-left">Frec.</th>
                    <th className="px-3 py-2 text-left">Centro</th>
                    <th className="px-3 py-2 text-right">HH plan</th>
                    <th className="px-3 py-2 text-right">HH real</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.rows.map((row) => (
                    <DynamicRow
                      key={row.id}
                      row={row}
                      busy={updateExecution.isPending && updateExecution.variables?.id === row.id}
                      onDone={() =>
                        updateExecution.mutate({
                          id: row.id,
                          status: 'DONE',
                          hhPlanned: row.hhPlanned,
                        })
                      }
                      onSkip={() =>
                        updateExecution.mutate({
                          id: row.id,
                          status: 'SKIPPED',
                          hhPlanned: row.hhPlanned,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-200">
              {executions.rows.map((row) => (
                <MobileExecCard
                  key={row.id}
                  row={row}
                  busy={updateExecution.isPending && updateExecution.variables?.id === row.id}
                  onDone={() =>
                    updateExecution.mutate({ id: row.id, status: 'DONE', hhPlanned: row.hhPlanned })
                  }
                  onSkip={() =>
                    updateExecution.mutate({ id: row.id, status: 'SKIPPED', hhPlanned: row.hhPlanned })
                  }
                />
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-slate-500">
                Página {page + 1} · rango {firstRow}-{lastRow}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">No hay ejecuciones para los filtros seleccionados.</p>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  tone,
  loading,
}: {
  title: string;
  value: number | string;
  tone?: 'danger' | 'warn' | 'ok';
  loading?: boolean;
}) {
  const ring =
    tone === 'danger'
      ? 'border-rose-300 bg-gradient-to-br from-rose-50 to-white'
      : tone === 'warn'
        ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white'
        : tone === 'ok'
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white'
          : 'border-slate-200 bg-white';
  return (
    <div
      className={`min-w-[150px] shrink-0 snap-start rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:min-w-0 sm:shrink ${ring}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {loading ? <span className="skeleton inline-block h-8 w-20 rounded-md" /> : value}
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-2">
        <h2 className="font-medium">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ExecutionTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-9 w-full rounded-md" />
      ))}
    </div>
  );
}

function DynamicRow({
  row,
  busy,
  onDone,
  onSkip,
}: {
  row: ExecutionRow;
  busy: boolean;
  onDone: () => void;
  onSkip: () => void;
}) {
  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="px-3 py-2 font-mono text-xs">{formatPeriod(row.dueDate)}</td>
      <td className="px-3 py-2">{row.task.indicadorAbc ?? '—'}</td>
      <td className="px-3 py-2">{row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '—'}</td>
      <td className="px-3 py-2">{row.task.psr ?? '—'}</td>
      <td className="px-3 py-2">{row.task.frecuenciaCodigo ?? '—'}</td>
      <td className="px-3 py-2">{row.task.centroPlanificacion ?? '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(row.hhPlanned).toFixed(1)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(row.hhActual ?? 0).toFixed(1)}</td>
      <td className="px-3 py-2">
        <StatusPill status={row.status} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex gap-1">
          <button
            type="button"
            disabled={busy || row.status === 'DONE'}
            onClick={onDone}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 disabled:opacity-50"
          >
            Hecha
          </button>
          <button
            type="button"
            disabled={busy || row.status === 'SKIPPED'}
            onClick={onSkip}
            className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          >
            Omitir
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileExecCard({
  row,
  busy,
  onDone,
  onSkip,
}: {
  row: ExecutionRow;
  busy: boolean;
  onDone: () => void;
  onSkip: () => void;
}) {
  const desc = row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin denominación';
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-900" title={desc}>
          {desc}
        </p>
        <StatusPill status={row.status} />
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono">{formatPeriod(row.dueDate)}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">ABC {row.task.indicadorAbc ?? '—'}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">{row.task.frecuenciaCodigo ?? '—'}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">{Number(row.hhPlanned).toFixed(1)} HH</span>
        {row.task.psr && <span className="rounded-md bg-slate-100 px-2 py-0.5 truncate max-w-[8rem]">PSR {row.task.psr}</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || row.status === 'DONE'}
          onClick={onDone}
          className="flex-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800 disabled:opacity-50"
        >
          Hecha
        </button>
        <button
          type="button"
          disabled={busy || row.status === 'SKIPPED'}
          onClick={onSkip}
          className="flex-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ExecStatus }) {
  const cls = {
    PENDING: 'bg-amber-100 text-amber-800',
    OVERDUE: 'bg-red-100 text-red-800',
    DONE: 'bg-emerald-100 text-emerald-800',
    SKIPPED: 'bg-slate-200 text-slate-700',
  }[status];
  const label = {
    PENDING: 'Pendiente',
    OVERDUE: 'Vencida',
    DONE: 'Hecha',
    SKIPPED: 'Omitida',
  }[status];
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-slate-600 flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}

function formatPeriod(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear().toString().slice(-2)}`;
}

function buildParams(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    params.set(key, text);
  }
  return params.toString();
}

function normalizeSavedViewFilters(input: ExecutionViewFilters | null | undefined): ExecutionViewFilters {
  if (!input) return {};
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.abc ? { abc: input.abc } : {}),
    ...(input.frecuencia ? { frecuencia: input.frecuencia } : {}),
    ...(input.psr ? { psr: input.psr } : {}),
    ...(input.centroPlanificacion ? { centroPlanificacion: input.centroPlanificacion } : {}),
    ...(input.equipo ? { equipo: input.equipo } : {}),
    ...(input.ubicacionTecnica ? { ubicacionTecnica: input.ubicacionTecnica } : {}),
    ...(input.yearFrom != null ? { yearFrom: input.yearFrom } : {}),
    ...(input.monthFrom != null ? { monthFrom: input.monthFrom } : {}),
    ...(input.yearTo != null ? { yearTo: input.yearTo } : {}),
    ...(input.monthTo != null ? { monthTo: input.monthTo } : {}),
    ...(input.sortBy ? { sortBy: input.sortBy } : {}),
    ...(input.sortDir ? { sortDir: input.sortDir } : {}),
    ...(input.groupBy ? { groupBy: input.groupBy } : {}),
    ...(input.take != null ? { take: input.take } : {}),
  };
}

function parseDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return match?.[1] ?? null;
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ChevronDown, Filter as FilterIcon, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChartPanel } from './_components/ChartPanel';
import { FilterChips } from './_components/FilterChips';
import { KpiCard } from './_components/KpiCard';
import { Pagination } from './_components/Pagination';
import { StatusBadge } from './_components/StatusBadge';

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

const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Santiago',
});
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('es-CL', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const NUMBER_FORMAT = new Intl.NumberFormat('es-CL');
const HH_FORMAT = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [yearFrom, setYearFrom] = useState(() => readInt(searchParams, 'yearFrom', nowYear - 1, 2000, 2100));
  const [monthFrom, setMonthFrom] = useState(() => readInt(searchParams, 'monthFrom', 1, 1, 12));
  const [yearTo, setYearTo] = useState(() => readInt(searchParams, 'yearTo', nowYear, 2000, 2100));
  const [monthTo, setMonthTo] = useState(() => readInt(searchParams, 'monthTo', 12, 1, 12));
  const [status, setStatus] = useState<ExecStatus | ''>(() => readStatus(searchParams.get('status')));
  const [abc, setAbc] = useState(() => searchParams.get('abc') ?? '');
  const [frecuencia, setFrecuencia] = useState(() => searchParams.get('frecuencia') ?? '');
  const [psr, setPsr] = useState(() => searchParams.get('psr') ?? '');
  const [centroPlanificacion, setCentroPlanificacion] = useState(() => searchParams.get('centroPlanificacion') ?? '');
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');

  const [groupBy, setGroupBy] = useState<GroupField>(() => readGroup(searchParams.get('groupBy')));
  const [sortBy, setSortBy] = useState<SortField>(() => readSort(searchParams.get('sortBy')));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'));
  const [take, setTake] = useState(() => readInt(searchParams, 'take', 25, 1, 500));
  const [page, setPage] = useState(() => readInt(searchParams, 'page', 1, 1, 9999) - 1);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [viewName, setViewName] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [viewToDelete, setViewToDelete] = useState<SavedExecutionView | null>(null);

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

  const dashboardUrlParams = useMemo(() => {
    const next = new URLSearchParams(baseParams);
    next.set('groupBy', groupBy);
    next.set('sortBy', sortBy);
    next.set('sortDir', sortDir);
    next.set('take', String(take));
    next.set('page', String(page + 1));
    return next.toString();
  }, [baseParams, groupBy, page, sortBy, sortDir, take]);

  useEffect(() => {
    router.replace(`/dashboard?${dashboardUrlParams}`, { scroll: false });
  }, [dashboardUrlParams, router]);

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
      setViewToDelete(null);
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
  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Planificación SAP PM</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Mantenciones · tablero en tiempo real</h1>
        </div>
        <p className="text-xs text-slate-500">
          {DATE_FORMAT.format(new Date())} · refresco automático 60s
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
              placeholder="A / B / C…"
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
              placeholder="1M, 6M, 1A…"
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
              placeholder="bomba, horno, etc…"
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
              onClick={() => {
                const selected = savedViews.find((view) => view.id === selectedViewId);
                if (selected) setViewToDelete(selected);
              }}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 disabled:opacity-50"
            >
              {deleteViewMutation.isPending ? 'Eliminando…' : 'Eliminar vista'}
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Guardar vista actual">
              <input
                className="min-w-[14rem] rounded-md border px-2 py-1.5 text-sm"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Nombre de vista…"
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
              {saveViewMutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exporting != null}
              onClick={() => exportExecutions('csv')}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {exporting === 'csv' ? 'Exportando CSV…' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              disabled={exporting != null}
              onClick={() => exportExecutions('xlsx')}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {exporting === 'xlsx' ? 'Exportando XLSX…' : 'Exportar XLSX'}
            </button>
          </div>
        </div>

        {savedViewsQuery.isError && (
          <p className="mt-2 text-xs text-amber-700">No se pudieron cargar las vistas guardadas.</p>
        )}
        {actionsError && <p className="mt-2 text-xs text-red-700">{actionsError}</p>}
      </details>

      <FilterChips
        chips={[
          ...(status
            ? [{ key: 'status', label: 'Estado', value: status, onRemove: () => { setStatus(''); setPage(0); } }]
            : []),
          ...(abc.trim()
            ? [{ key: 'abc', label: 'ABC', value: abc.trim(), onRemove: () => { setAbc(''); setPage(0); } }]
            : []),
          ...(frecuencia.trim()
            ? [{
                key: 'frecuencia',
                label: 'Frecuencia',
                value: frecuencia.trim(),
                onRemove: () => { setFrecuencia(''); setPage(0); },
              }]
            : []),
          ...(psr.trim()
            ? [{ key: 'psr', label: 'PSR', value: psr.trim(), onRemove: () => { setPsr(''); setPage(0); } }]
            : []),
          ...(centroPlanificacion.trim()
            ? [{
                key: 'centro',
                label: 'Centro',
                value: centroPlanificacion.trim(),
                onRemove: () => { setCentroPlanificacion(''); setPage(0); },
              }]
            : []),
          ...(q.trim()
            ? [{ key: 'q', label: 'Texto', value: q.trim(), onRemove: () => { setQ(''); setPage(0); } }]
            : []),
        ]}
        onClearAll={() => {
          setStatus('');
          setAbc('');
          setFrecuencia('');
          setPsr('');
          setCentroPlanificacion('');
          setQ('');
          setPage(0);
        }}
      />

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-6">
        <KpiCard title="Tareas catálogo" value={kpis?.taskCount ?? '—'} loading={kpisQuery.isLoading} tone="accent" />
        <KpiCard title="Pendientes" value={pipeline?.totals.pending ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <KpiCard title="Vencidas" value={pipeline?.totals.overdue ?? '—'} tone="danger" loading={pipelineQuery.isLoading} />
        <KpiCard title="Hechas" value={pipeline?.totals.done ?? '—'} tone="ok" loading={pipelineQuery.isLoading} />
        <KpiCard title="Omitidas" value={pipeline?.totals.skipped ?? '—'} loading={pipelineQuery.isLoading} />
        <KpiCard
          title="Cumplimiento"
          value={pipeline ? `${pipeline.totals.completionRate.toFixed(1)}%` : '—'}
          tone="ok"
          loading={pipelineQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Discrepancias" value={pipeline?.process.discrepancyCount ?? kpis?.discCount ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <KpiCard title="Imports total" value={pipeline?.process.imports.total ?? '—'} loading={pipelineQuery.isLoading} />
        <KpiCard title="Imports parciales" value={pipeline?.process.imports.partial ?? '—'} tone="warn" loading={pipelineQuery.isLoading} />
        <KpiCard title="Rebuilds período" value={pipeline?.process.rebuildRuns ?? '—'} loading={pipelineQuery.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Carga HH por mes" subtitle="Planificadas vs reales" loading={pipelineQuery.isLoading}>
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

        <ChartPanel title="Estado por mes" subtitle="Pipeline operacional" loading={pipelineQuery.isLoading}>
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

        <ChartPanel title="Backlog vs cerrado" subtitle="Seguimiento de proceso" loading={pipelineQuery.isLoading}>
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

        <ChartPanel title="Distribución ABC" subtitle="Ejecuciones filtradas" loading={pipelineQuery.isLoading}>
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

        <ChartPanel title="Distribución Frecuencia" subtitle="Ejecuciones filtradas" loading={pipelineQuery.isLoading}>
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
                      <td className="px-3 py-2 text-right tabular-nums">{NUMBER_FORMAT.format(row.count)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{HH_FORMAT.format(row.totalHhPlanned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{HH_FORMAT.format(row.totalHhActual)}</td>
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
                ? `${NUMBER_FORMAT.format(firstRow)}–${NUMBER_FORMAT.format(lastRow)} de ${NUMBER_FORMAT.format(totalRows)} · HH plan ${HH_FORMAT.format(executions.totalHhPlanned)} · HH real ${HH_FORMAT.format(executions.totalHhActual)}`
                : 'Cargando…'}
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
            <Pagination page={page} take={take} total={totalRows} onPage={setPage} />
          </>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">No hay ejecuciones para los filtros seleccionados.</p>
        )}
      </div>

      <Dialog open={Boolean(viewToDelete)} onOpenChange={(open) => !open && setViewToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar vista guardada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-ds-muted">
            <p>
              Vas a eliminar la vista{' '}
              <span className="font-semibold text-text">{viewToDelete?.name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setViewToDelete(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!viewToDelete || deleteViewMutation.isPending}
                onClick={() => viewToDelete && deleteViewMutation.mutate(viewToDelete.id)}
              >
                {deleteViewMutation.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      <td className="px-3 py-2 text-right tabular-nums">{formatHh(row.hhPlanned)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatHh(row.hhActual ?? 0)}</td>
      <td className="px-3 py-2">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" disabled={busy} aria-label="Acciones">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={busy || row.status === 'DONE'}
                onClick={onDone}
                className="text-ok focus:bg-ok-dim focus:text-ok"
              >
                Marcar hecha
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy || row.status === 'SKIPPED'} onClick={onSkip}>
                Omitir
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <StatusBadge status={row.status} />
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono">{formatPeriod(row.dueDate)}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">ABC {row.task.indicadorAbc ?? '—'}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">{row.task.frecuenciaCodigo ?? '—'}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5">{formatHh(row.hhPlanned)} HH</span>
        {row.task.psr && <span className="rounded-md bg-slate-100 px-2 py-0.5 truncate max-w-[8rem]">PSR {row.task.psr}</span>}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || row.status === 'DONE'}
          onClick={onDone}
          className="flex-1 border-ok/30 bg-ok-dim text-xs font-medium text-ok hover:bg-ok-dim/80 hover:text-ok disabled:opacity-50"
        >
          Hecha
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || row.status === 'SKIPPED'}
          onClick={onSkip}
          className="flex-1 text-xs font-medium disabled:opacity-50"
        >
          Omitir
        </Button>
      </div>
    </div>
  );
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
  return MONTH_YEAR_FORMAT.format(d).replace('.', '');
}

function formatHh(value: string | number | null): string {
  return HH_FORMAT.format(Number(value ?? 0));
}

function readInt(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const value = Number(params.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function readStatus(value: string | null): ExecStatus | '' {
  if (value === 'PENDING' || value === 'DONE' || value === 'OVERDUE' || value === 'SKIPPED') return value;
  return '';
}

function readSort(value: string | null): SortField {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as SortField) : 'dueDate';
}

function readGroup(value: string | null): GroupField {
  return GROUP_OPTIONS.some((option) => option.value === value) ? (value as GroupField) : 'status';
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

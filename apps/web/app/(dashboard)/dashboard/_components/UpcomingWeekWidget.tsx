'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Flame,
  RefreshCw,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type {
  ExecutionRow,
  WhatsNextBucket,
  WhatsNextBucketId,
  WhatsNextResult,
} from '@/lib/types';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const TONE_CLS: Record<WhatsNextBucket['tone'], { ring: string; chip: string; glow: string; accent: string }> = {
  danger: {
    ring: 'from-rose-500/20 via-red-400/10 to-transparent border-rose-300/60',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    glow: 'shadow-[0_12px_40px_-20px_rgba(244,63,94,0.55)]',
    accent: 'text-rose-600',
  },
  warn: {
    ring: 'from-amber-400/20 via-orange-300/10 to-transparent border-amber-300/60',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    glow: 'shadow-[0_12px_40px_-20px_rgba(245,158,11,0.5)]',
    accent: 'text-amber-600',
  },
  brand: {
    ring: 'from-sky-500/25 via-indigo-400/10 to-transparent border-sky-300/60',
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
    glow: 'shadow-[0_12px_40px_-20px_rgba(37,99,235,0.45)]',
    accent: 'text-sky-600',
  },
  ok: {
    ring: 'from-emerald-500/20 via-teal-300/10 to-transparent border-emerald-300/60',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    glow: 'shadow-[0_12px_40px_-20px_rgba(16,185,129,0.45)]',
    accent: 'text-emerald-600',
  },
};

const BUCKET_ICON: Record<WhatsNextBucketId, ReactElement> = {
  overdue: <Flame className="h-4 w-4" />,
  thisMonth: <AlarmClock className="h-4 w-4" />,
  nextMonth: <CalendarClock className="h-4 w-4" />,
  inTwoMonths: <CalendarDays className="h-4 w-4" />,
};

export function UpcomingWeekWidget() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<WhatsNextBucketId>('thisMonth');
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['whats-next'],
    queryFn: () => api<WhatsNextResult>('/api/schedule/whats-next'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markExecution = useMutation({
    mutationFn: ({ id, status, hhActual }: { id: string; status: 'DONE' | 'SKIPPED'; hhActual?: number }) =>
      api(`/api/schedule/executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(status === 'DONE' && hhActual != null ? { hhActual } : {}) }),
      }),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['whats-next'] });
      qc.invalidateQueries({ queryKey: ['schedule-executions'] });
      qc.invalidateQueries({ queryKey: ['schedule-pipeline'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo actualizar la ejecución.');
    },
  });

  const buckets = q.data?.buckets ?? [];
  const active = buckets.find((b) => b.id === activeId) ?? buckets[0];
  const freshness = q.dataUpdatedAt ? Math.round((Date.now() - q.dataUpdatedAt) / 1000) : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-sm shadow-[0_8px_40px_-25px_rgba(3,35,69,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/5 via-white to-indigo-500/5" />
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[inset_0_1px_rgba(255,255,255,0.3)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Qué toca</p>
              <h2 className="text-lg font-semibold text-slate-900">Radar de mantención</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-flex h-2 w-2 rounded-full ${q.isFetching ? 'bg-sky-500 animate-ping' : 'bg-emerald-500'}`} />
            <span>
              {q.isLoading
                ? 'Cargando…'
                : freshness == null
                  ? 'Sin datos'
                  : freshness < 5
                    ? 'al día'
                    : `hace ${freshness}s`}
            </span>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="ml-1 grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              aria-label="Refrescar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {(buckets.length > 0 ? buckets : placeholderBuckets()).map((b) => {
            const isActive = b.id === active?.id;
            const tone = TONE_CLS[b.tone];
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveId(b.id)}
                className={`group relative flex-1 min-w-[10rem] rounded-xl border px-3.5 py-3 text-left transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-br ${tone.ring} ${tone.glow} scale-[1.01]`
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-sm'
                }`}
              >
                <span className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${isActive ? tone.accent : 'text-slate-500'}`}>
                  {BUCKET_ICON[b.id]}
                  {b.label}
                </span>
                <span className="mt-1 flex items-baseline gap-2">
                  {q.isLoading ? (
                    <span className="skeleton h-6 w-14 rounded" />
                  ) : (
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">{b.count}</span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    {q.isLoading ? '' : `${b.totalHh.toFixed(1)} HH`}
                  </span>
                </span>
                {!q.isLoading && (
                  <span className="mt-2 flex flex-wrap gap-1">
                    {(['A', 'B', 'C'] as const).map((abc) => (
                      <span
                        key={abc}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${abcCls(abc)}`}
                      >
                        {abc}·{b.abcSplit[abc] ?? 0}
                      </span>
                    ))}
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-b bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />
                )}
              </button>
            );
          })}
        </nav>

        {q.isError && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            No se pudo cargar el radar. Intenta refrescar.
          </p>
        )}

        {actionError && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{actionError}</p>
        )}

        {active && active.rows.length === 0 && !q.isLoading && (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <CheckCircle2 className={`h-8 w-8 ${TONE_CLS[active.tone].accent}`} />
            <p className="mt-2 text-sm font-medium text-slate-700">Cero pendientes en esta ventana</p>
            <p className="text-xs text-slate-500">
              Nada se está escapando del plan. Refresca si acabas de importar datos.
            </p>
          </div>
        )}

        {active && active.rows.length > 0 && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {(expanded ? active.rows : active.rows.slice(0, 6)).map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  busy={markExecution.isPending && markExecution.variables?.id === row.id}
                  onDone={() =>
                    markExecution.mutate({ id: row.id, status: 'DONE', hhActual: Number(row.hhPlanned) })
                  }
                  onSkip={() => markExecution.mutate({ id: row.id, status: 'SKIPPED' })}
                />
              ))}
            </div>

            {active.rows.length > 6 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300"
              >
                {expanded ? 'Ver menos' : `Ver las ${active.rows.length - 6} restantes`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </>
        )}

        {q.isLoading && active == null && <SkeletonList />}
      </div>
    </section>
  );
}

function TaskRow({
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
  const due = new Date(row.dueDate);
  const period = `${MESES[due.getUTCMonth()]}-${String(due.getUTCFullYear()).slice(-2)}`;
  const abc = row.task.indicadorAbc ?? '?';
  const freq = row.task.frecuenciaCodigo ?? '—';
  const psr = row.task.psr ?? '—';
  const desc = row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin denominación';

  return (
    <article className="group relative flex min-h-[110px] flex-col justify-between rounded-xl border border-slate-200 bg-white/90 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t ${abcStripe(abc)}`}
        aria-hidden
      />
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900" title={desc}>
            {desc}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {row.task.ubicacionTecnica ? `${row.task.ubicacionTecnica} · ` : ''}
            {row.task.equipo ?? '—'}
          </p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${abcCls(abc)}`}>
          ABC {abc}
        </span>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono">
          <Clock className="h-3 w-3" />
          {period}
        </span>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-medium">{freq}</span>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-medium">
          {Number(row.hhPlanned).toFixed(1)} HH
        </span>
        <span className="truncate text-slate-500" title={psr}>
          · {psr}
        </span>
      </div>

      <footer className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
        >
          <CheckCircle2 className="h-3 w-3" /> Hecha
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <SkipForward className="h-3 w-3" /> Omitir
        </button>
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-400">
          {row.status === 'OVERDUE' ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
              <CircleAlert className="h-3 w-3" /> Vencida
            </span>
          ) : (
            <>
              Detalle <ArrowRight className="h-3 w-3" />
            </>
          )}
        </span>
      </footer>
    </article>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-[110px] rounded-xl" />
      ))}
    </div>
  );
}

function placeholderBuckets(): WhatsNextBucket[] {
  return (
    [
      { id: 'overdue', label: 'Vencidas', tone: 'danger' },
      { id: 'thisMonth', label: 'Este mes', tone: 'warn' },
      { id: 'nextMonth', label: 'Próximo mes', tone: 'brand' },
      { id: 'inTwoMonths', label: 'En 2 meses', tone: 'ok' },
    ] as const
  ).map((b) => ({
    ...b,
    count: 0,
    totalHh: 0,
    abcSplit: { A: 0, B: 0, C: 0, otros: 0 },
    freqSplit: [],
    rows: [],
  }));
}

function abcCls(abc: string): string {
  switch ((abc ?? '').toUpperCase()) {
    case 'A':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'B':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'C':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function abcStripe(abc: string): string {
  switch ((abc ?? '').toUpperCase()) {
    case 'A':
      return 'bg-gradient-to-r from-rose-500 to-pink-500';
    case 'B':
      return 'bg-gradient-to-r from-amber-500 to-orange-500';
    case 'C':
      return 'bg-gradient-to-r from-emerald-500 to-teal-500';
    default:
      return 'bg-gradient-to-r from-slate-300 to-slate-400';
  }
}

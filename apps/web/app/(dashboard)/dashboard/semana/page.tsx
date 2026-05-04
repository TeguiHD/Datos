'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Factory } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type OperationalExecutionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE_PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'POSTPONED';

interface ExecutionRow {
  id: string;
  dueDate: string;
  status: OperationalExecutionStatus;
  hhPlan: number;
  hhActual: number | null;
  evidenceCount: number;
  planTask: {
    id: string;
    abc: string | null;
    description: string;
    equipment: { id: string; name: string; type: string } | null;
    plant: { id: string; psr: string; name: string; area: string | null; color: string | null; visibleToViewer: boolean };
  };
}

interface DashboardSemana {
  weekStart: string;
  weekEnd: string;
  totalHhPlan: number;
  totalItems: number;
  days: Array<{
    date: string;
    weekday: number;
    hhPlan: number;
    items: ExecutionRow[];
  }>;
}

const DAY_LONG = new Intl.DateTimeFormat('es-CL', { weekday: 'long' });
const DATE_SHORT = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });
const RANGE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const STATUS_TONE: Record<OperationalExecutionStatus, string> = {
  SCHEDULED: 'border-[var(--color-border)] text-ds-muted',
  IN_PROGRESS: 'border-ds-accent/30 bg-accent-dim text-ds-accent',
  DONE_PENDING_APPROVAL: 'border-warn/30 bg-warn-dim text-warn',
  APPROVED: 'border-ok/30 bg-ok-dim text-ok',
  REJECTED: 'border-danger/30 bg-danger-dim text-danger',
  SKIPPED: 'border-neutral-300 text-ds-muted',
  POSTPONED: 'border-warn/30 bg-warn-dim text-warn',
};

export default function DashboardSemanaPage() {
  const [offset, setOffset] = useState(0);
  const params = useMemo(() => new URLSearchParams({ offset: String(offset) }).toString(), [offset]);

  const data = useQuery({
    queryKey: ['dashboard-semana', offset],
    queryFn: () => api<DashboardSemana>(`/api/dashboard/semana?${params}`),
    refetchInterval: 60_000,
  });

  const headerLabel =
    data.data && `${RANGE.format(new Date(data.data.weekStart))} – ${RANGE.format(new Date(data.data.weekEnd))}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-dim text-ds-accent">
            <CalendarDays aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Semana</h1>
            <p className="text-sm text-ds-muted">
              {headerLabel ?? 'Cargando...'}
              {data.data ? (
                <span className="ml-2">
                  · {data.data.totalItems} ejecuciones · {HH.format(data.data.totalHhPlan)} HH
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </Button>
          <Button size="sm" variant={offset === 0 ? 'default' : 'outline'} onClick={() => setOffset(0)}>
            Esta semana
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOffset(offset + 1)}>
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      {data.isLoading ? (
        <DaySkeletons />
      ) : data.isError ? (
        <ErrorBox onRetry={() => data.refetch()} />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-7">
          {data.data!.days.map((day) => (
            <DayColumn key={day.date} day={day} />
          ))}
        </section>
      )}
    </div>
  );
}

function DayColumn({ day }: { day: DashboardSemana['days'][number] }) {
  const date = new Date(day.date);
  const isWeekend = day.weekday === 0 || day.weekday === 6;
  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 ${
        isWeekend ? 'bg-[var(--color-surface-2)]' : 'bg-[var(--color-surface-1)]'
      }`}
    >
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase text-ds-muted">{DAY_LONG.format(date)}</p>
          <p className="text-sm font-semibold">{DATE_SHORT.format(date)}</p>
        </div>
        <Badge variant="outline" className="text-xs tabular-nums">
          {HH.format(day.hhPlan)} HH
        </Badge>
      </header>
      <div className="flex flex-col gap-1.5">
        {day.items.length === 0 ? (
          <p className="text-xs text-ds-muted/70">—</p>
        ) : (
          day.items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/plantas/${encodeURIComponent(item.planTask.plant.psr)}`}
              className="group flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs transition-colors hover:border-ds-accent/40"
            >
              <div className="flex items-center justify-between gap-1">
                <Badge variant="outline" className={`${STATUS_TONE[item.status]} text-[10px]`}>
                  {item.planTask.abc ?? '—'}
                </Badge>
                <span className="tabular-nums text-ds-muted">{HH.format(item.hhPlan)}h</span>
              </div>
              <p className="line-clamp-2 font-medium text-text">{item.planTask.description}</p>
              <p className="inline-flex items-center gap-1 truncate text-ds-muted group-hover:text-ds-accent">
                <Factory className="h-3 w-3" aria-hidden />
                {item.planTask.plant.name}
              </p>
            </Link>
          ))
        )}
      </div>
    </article>
  );
}

function DaySkeletons() {
  return (
    <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-64 rounded-lg" />
      ))}
    </section>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger-dim p-4 text-sm text-danger">
      <p className="font-medium">Error cargando la semana.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

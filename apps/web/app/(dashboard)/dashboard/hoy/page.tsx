'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileImage,
  Sun,
  TrendingUp,
} from 'lucide-react';
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

interface DashboardHoy {
  kpis: {
    overdue: number;
    pendingReview: number;
    missingEvidence: number;
    recentApproved: number;
    todayCount: number;
    todayHhPlan: number;
  };
  today: ExecutionRow[];
  upcoming: ExecutionRow[];
}

const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });
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
const STATUS_LABEL: Record<OperationalExecutionStatus, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  DONE_PENDING_APPROVAL: 'Pendiente revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  SKIPPED: 'Omitida',
  POSTPONED: 'Postergada',
};

export default function DashboardHoyPage() {
  const data = useQuery({
    queryKey: ['dashboard-hoy'],
    queryFn: () => api<DashboardHoy>('/api/dashboard/hoy'),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-dim text-ds-accent">
            <Sun aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Hoy</h1>
            <p className="text-sm text-ds-muted">Mantenciones del día y alertas operacionales</p>
          </div>
        </div>
      </header>

      {data.isLoading ? (
        <KpiSkeletons />
      ) : data.isError ? (
        <ErrorBox onRetry={() => data.refetch()} />
      ) : (
        <KpiGrid kpis={data.data!.kpis} />
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Programadas para hoy" icon={CalendarClock} count={data.data?.today.length}>
          {data.isLoading ? (
            <RowSkeletons />
          ) : (data.data?.today ?? []).length === 0 ? (
            <Empty title="No hay mantenciones para hoy" detail="Todo bajo control. Revisa la semana o las atrasadas." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.data!.today.map((row) => (
                <ExecutionItem key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Próximos 7 días" icon={TrendingUp} count={data.data?.upcoming.length}>
          {data.isLoading ? (
            <RowSkeletons />
          ) : (data.data?.upcoming ?? []).length === 0 ? (
            <Empty title="Semana sin programación" detail="No hay ejecuciones programadas en los próximos 7 días." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.data!.upcoming.slice(0, 12).map((row) => (
                <ExecutionItem key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: DashboardHoy['kpis'] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={AlertTriangle}
        tone={kpis.overdue > 0 ? 'danger' : 'muted'}
        label="Atrasadas"
        value={kpis.overdue}
        href="/dashboard/revisiones"
        cta={kpis.overdue > 0 ? 'Resolver' : undefined}
      />
      <KpiTile
        icon={ClipboardCheck}
        tone={kpis.pendingReview > 0 ? 'warn' : 'muted'}
        label="Pendientes revisión"
        value={kpis.pendingReview}
        href="/dashboard/revisiones"
        cta={kpis.pendingReview > 0 ? 'Aprobar' : undefined}
      />
      <KpiTile
        icon={FileImage}
        tone={kpis.missingEvidence > 0 ? 'warn' : 'muted'}
        label="Sin evidencia"
        value={kpis.missingEvidence}
      />
      <KpiTile
        icon={CheckCircle2}
        tone="ok"
        label="Aprobadas 30d"
        value={kpis.recentApproved}
      />
    </section>
  );
}

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  href,
  cta,
}: {
  icon: typeof AlertTriangle;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  label: string;
  value: number;
  href?: string;
  cta?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-danger/30 bg-danger-dim text-danger'
      : tone === 'warn'
        ? 'border-warn/30 bg-warn-dim text-warn'
        : tone === 'ok'
          ? 'border-ok/30 bg-ok-dim text-ok'
          : 'border-[var(--color-border)] text-ds-muted';
  return (
    <article className={`flex flex-col gap-2 rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {href && cta ? (
        <Link
          href={href}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          {cta} →
        </Link>
      ) : null}
    </article>
  );
}

function Card({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof CalendarClock;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
      <header className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-ds-muted" aria-hidden />
          {title}
        </h2>
        {typeof count === 'number' ? (
          <Badge variant="outline" className="text-xs">
            {count}
          </Badge>
        ) : null}
      </header>
      {children}
    </article>
  );
}

function ExecutionItem({ row }: { row: ExecutionRow }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ds-muted">
          <span className="inline-flex items-center gap-1 font-medium">
            <CalendarClock className="h-3 w-3" aria-hidden />
            {DATE.format(new Date(row.dueDate))}
          </span>
          <Badge variant="outline" className={STATUS_TONE[row.status]}>
            {STATUS_LABEL[row.status]}
          </Badge>
          {row.planTask.abc ? <Badge variant="outline">{row.planTask.abc}</Badge> : null}
        </div>
        <p className="truncate text-sm font-medium">{row.planTask.description}</p>
        <Link
          href={`/dashboard/plantas/${encodeURIComponent(row.planTask.plant.psr)}`}
          className="inline-flex items-center gap-1 text-xs text-ds-muted hover:text-ds-accent"
        >
          <Factory className="h-3 w-3" aria-hidden />
          {row.planTask.plant.name}
          {row.planTask.equipment ? <span className="opacity-70">· {row.planTask.equipment.name}</span> : null}
        </Link>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-md border border-[var(--color-border)] px-2 py-1 tabular-nums text-ds-muted">
          {HH.format(row.hhPlan)} HH plan
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/plantas/${encodeURIComponent(row.planTask.plant.psr)}`}>Abrir</Link>
        </Button>
      </div>
    </li>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md border border-dashed border-[var(--color-border)] p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-ds-muted">{detail}</p>
    </div>
  );
}

function KpiSkeletons() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </section>
  );
}

function RowSkeletons() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-md" />
      ))}
    </ul>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger-dim p-4 text-sm text-danger">
      <p className="font-medium">Error cargando el dashboard.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

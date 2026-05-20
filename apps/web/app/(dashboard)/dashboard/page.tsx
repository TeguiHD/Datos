'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ClipboardList, Factory } from 'lucide-react';
import { api } from '@/lib/api';
import { hh, int } from '@/lib/i18n/formatters';
import { plantStatusLabels } from '@datos/shared-types';
import { ComplianceGauge } from './_components/ComplianceGauge';
import { AbcDonut } from './_components/AbcDonut';
import { ForecastStrip } from './_components/ForecastStrip';

interface Kpis {
  taskCount: number;
  pendingCount: number;
  overdueCount: number;
  doneCount: number;
  skippedCount: number;
  discCount: number;
  tipoSplit?: Array<{ tipo: string; _count: { _all: number } }>;
}

const TIPO_META: Record<string, { label: string; color: string }> = {
  PREVENTIVA: { label: 'Preventiva', color: '#2563eb' },
  CORRECTIVA: { label: 'Correctiva', color: '#d97706' },
  PREDICTIVA: { label: 'Predictiva', color: '#7c3aed' },
};

interface PlantList {
  rows: Array<{
    id: string;
    name: string;
    status: string;
    maintenanceTaskCount: number;
    hhPlan: number;
    nextDueDate: string | null;
  }>;
  total: number;
}

interface Upcoming {
  count: number;
  totalHh: number;
}

export default function DashboardHome() {
  const kpis = useQuery({ queryKey: ['kpis'], queryFn: () => api<Kpis>('/api/schedule/kpis') });
  const plants = useQuery({ queryKey: ['plantas-panel'], queryFn: () => api<PlantList>('/api/plantas?take=6') });
  const upcoming = useQuery({ queryKey: ['upcoming-30'], queryFn: () => api<Upcoming>('/api/schedule/upcoming?days=30') });

  const k = kpis.data;
  const dueExecutions = k ? k.doneCount + k.pendingCount + k.overdueCount : 0;
  const compliance = dueExecutions > 0 ? (k!.doneCount + (k!.skippedCount ?? 0)) / (dueExecutions + (k!.skippedCount ?? 0)) : 0;
  const onTime = dueExecutions > 0 ? k!.doneCount / dueExecutions : 0;

  const tipoSlices = (k?.tipoSplit ?? []).map((row) => {
    const meta = TIPO_META[row.tipo];
    return {
      key: row.tipo,
      label: meta?.label ?? row.tipo,
      value: row._count._all,
      color: meta?.color ?? '#64748b',
    };
  });

  return (
    <div className="flex flex-col gap-5 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">SAP PM</p>
        <h1 className="text-2xl font-semibold text-text">Panel</h1>
        <p className="mt-1 max-w-3xl text-sm text-ds-muted">Vista operativa mínima: plantas reales, tareas importadas y próximas HH planificadas.</p>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Card title="Plantas" value={int(plants.data?.total ?? 0)} icon={<Factory className="size-4" />} />
        <Card title="Tareas" value={int(kpis.data?.taskCount ?? 0)} icon={<ClipboardList className="size-4" />} />
        <Card title="Próx. 30 días" value={int(upcoming.data?.count ?? 0)} detail={`${hh(upcoming.data?.totalHh ?? 0)} HH`} icon={<CalendarClock className="size-4" />} />
        <Card title="Vencidas" value={int(kpis.data?.overdueCount ?? 0)} detail={`${int(kpis.data?.discCount ?? 0)} discrepancias`} tone="danger" icon={<AlertTriangle className="size-4" />} />
      </section>

      <ForecastStrip />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-text">Plantas principales</h2>
            <Link href="/dashboard/plantas" className="text-sm font-medium text-ds-accent">Ver todas</Link>
          </div>
          <div className="mt-3 divide-y divide-[var(--color-border)]">
            {(plants.data?.rows ?? []).map((plant) => (
              <Link key={plant.id} href={`/dashboard/tareas?plantId=${plant.id}`} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <p className="font-medium text-text">{plant.name}</p>
                  <p className="text-xs text-ds-muted">{plantStatusLabels[plant.status as keyof typeof plantStatusLabels] ?? plant.status}</p>
                </div>
                <span className="text-sm text-ds-muted">{int(plant.maintenanceTaskCount)} tareas</span>
                <span className="text-sm font-medium text-text">{hh(plant.hhPlan)} HH</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="font-semibold text-text">Cumplimiento</h2>
            <p className="text-xs text-ds-muted">Ejecutadas vs vencidas + pendientes.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ComplianceGauge value={onTime} label="A tiempo" detail={k ? `${int(k.doneCount)}/${int(dueExecutions)}` : '—'} />
              <ComplianceGauge value={compliance} label="Global" detail={k ? `${int(k.doneCount + (k.skippedCount ?? 0))}/${int(dueExecutions + (k.skippedCount ?? 0))}` : '—'} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link href="/dashboard/hoy" className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-surface-2)] min-h-[32px]">Hoy</Link>
              <Link href="/dashboard/semana" className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-surface-2)] min-h-[32px]">Semana</Link>
              <Link href="/dashboard/tareas?estado=OVERDUE" className="rounded-md border border-danger/40 bg-danger-dim px-2.5 py-1.5 text-danger min-h-[32px]">Vencidas</Link>
              <Link href="/dashboard/analytics" className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-surface-2)] min-h-[32px]">Analítica</Link>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="font-semibold text-text">Tipo de mantención</h2>
            <p className="text-xs text-ds-muted">Preventiva, correctiva y predictiva.</p>
            <div className="mt-3 flex justify-center">
              <AbcDonut slices={tipoSlices} centerLabel="mantenciones" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <article
      className={`rounded-xl border bg-[var(--color-surface)] p-3 sm:p-4 ${
        tone === 'danger' ? 'border-danger/30' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-ds-muted">
        <p className="text-[10px] uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">{title}</p>
        {icon}
      </div>
      <p
        className={`mt-2 text-xl font-semibold tabular-nums sm:mt-4 sm:text-2xl ${
          tone === 'danger' ? 'text-danger' : 'text-text'
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-ds-muted sm:mt-1 sm:text-sm">{detail}</p>}
    </article>
  );
}

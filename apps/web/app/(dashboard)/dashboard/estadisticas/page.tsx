'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Clock, Factory, SkipForward } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface Kpis {
  taskCount: number;
  plantCount: number;
  pendingCount: number;
  overdueCount: number;
  doneCount: number;
  skippedCount: number;
  freqSplit: Array<{ frecuenciaCodigo: string | null; _count: { _all: number } }>;
  plantsByTasks: Array<{ id: string; name: string; status: string; taskCount: number }>;
}

const NUMBER = new Intl.NumberFormat('es-CL');

export default function EstadisticasPage() {
  const kpis = useQuery({ queryKey: ['schedule-kpis'], queryFn: () => api<Kpis>('/api/schedule/kpis') });
  const data = kpis.data;
  const freq = (data?.freqSplit ?? []).map((row) => ({
    name: labelFrequency(row.frecuenciaCodigo),
    tareas: row._count._all,
  }));

  return (
    <div className="flex flex-col gap-5 fade-up">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Operación</p>
        <h1 className="text-2xl font-semibold text-text">Estadísticas</h1>
        <p className="max-w-3xl text-sm text-ds-muted">
          Mediciones simples para entender carga, avance y plantas con mayor volumen de tareas.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Metric title="Plantas" value={NUMBER.format(data?.plantCount ?? 0)} icon={<Factory className="size-4" />} />
        <Metric title="Tareas" value={NUMBER.format(data?.taskCount ?? 0)} icon={<BarChart3 className="size-4" />} />
        <Metric title="Pendientes" value={NUMBER.format((data?.pendingCount ?? 0) + (data?.overdueCount ?? 0))} icon={<Clock className="size-4" />} />
        <Metric title="Completadas" value={NUMBER.format(data?.doneCount ?? 0)} icon={<CheckCircle2 className="size-4" />} />
        <Metric title="Omitidas" value={NUMBER.format(data?.skippedCount ?? 0)} icon={<SkipForward className="size-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-text">Tareas por planta</h2>
            <Badge variant="outline">Ranking</Badge>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.plantsByTasks ?? []} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="taskCount" name="Tareas" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-text">Carga por frecuencia</h2>
            <Badge variant="outline">Excel</Badge>
          </div>
          <div className="grid gap-3">
            {freq.map((item) => (
              <div key={item.name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-text">{item.name}</span>
                  <span className="tabular-nums text-ds-muted">{NUMBER.format(item.tareas)} tareas</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-2 rounded-full bg-ds-accent"
                    style={{ width: `${Math.min(100, (item.tareas / Math.max(1, data?.taskCount ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!kpis.isLoading && freq.length === 0 && <p className="text-sm text-ds-muted">Sin frecuencias cargadas.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 text-ds-muted">
        <p className="text-[10px] uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-semibold text-text tabular-nums sm:mt-4 sm:text-2xl">{value}</p>
    </article>
  );
}

function labelFrequency(value: string | null) {
  if (value === '1M') return 'Mensual';
  if (value === '6M') return 'Semestral';
  if (value === '1A') return 'Anual';
  if (value === '5A') return 'Quinquenal';
  return value ?? 'Sin frecuencia';
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

interface Task {
  id: string;
  descPosicionMant: string | null;
  denomObjetoTecnico: string | null;
  ubicacionTecnica: string | null;
  indicadorAbc: string | null;
  psr: string | null;
  frecuenciaCodigo: string | null;
  hhReal: string | null;
  equipo: string | null;
}

interface TaskList {
  rows: Task[];
  total: number;
  take: number;
  skip: number;
}

export default function TareasPage() {
  const [q, setQ] = useState('');
  const [abc, setAbc] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [month, setMonth] = useState<number | ''>('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', q, abc, year, month],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (abc) params.set('abc', abc);
      if (year) params.set('year', String(year));
      if (month) params.set('month', String(month));
      params.set('take', '100');
      return api<TaskList>(`/api/tasks?${params.toString()}`);
    },
  });

  const is2faError =
    error instanceof ApiError &&
    error.status === 403 &&
    (error.body as { message?: string })?.message === '2FA required';

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-semibold">Tareas</h1>

      {is2faError && (
        <div className="rounded-xl border border-warn/30 bg-warn-dim px-4 py-3 text-sm text-warn">
          Debes completar verificación 2FA para consultar tareas.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <Field label="Buscar">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text" placeholder="descripción, equipo..." />
        </Field>
        <Field label="ABC">
          <select value={abc} onChange={(e) => setAbc(e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text">
            <option value="">Todos</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </Field>
        <Field label="Año">
          <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text" />
        </Field>
        <Field label="Mes">
          <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : '')} className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text" />
        </Field>
        <span className="ml-auto text-sm text-ds-muted">{data?.total ?? 0} resultados</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow duration-200 hover:shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-text">
            <tr>
              <th className="px-3 py-2 text-left">ABC</th>
              <th className="px-3 py-2 text-left">Ubic. técnica</th>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-left">Equipo</th>
              <th className="px-3 py-2 text-left">Frec.</th>
              <th className="px-3 py-2 text-right">HH</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t">
                  <td colSpan={6} className="px-3 py-2">
                    <div className="skeleton h-8 w-full rounded-md" />
                  </td>
                </tr>
              ))
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-danger">
                  No se pudo cargar el listado de tareas.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ds-muted">
                  Sin resultados para los filtros aplicados.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.rows.map((t) => (
              <tr key={t.id} className="border-t border-[var(--color-border)] hover:bg-accent-dim/40">
                <td className="px-3 py-2 font-medium">
                  <Badge variant="outline" className="bg-[var(--color-surface-2)] text-text">
                    {t.indicadorAbc ?? '—'}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{t.ubicacionTecnica ?? '—'}</td>
                <td className="px-3 py-2">{t.descPosicionMant ?? t.denomObjetoTecnico ?? '—'}</td>
                <td className="px-3 py-2">{t.equipo ?? '—'}</td>
                <td className="px-3 py-2">{t.frecuenciaCodigo ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.hhReal ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

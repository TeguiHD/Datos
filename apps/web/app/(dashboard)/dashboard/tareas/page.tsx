'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

interface Task {
  id: string;
  plant: { id: string; name: string; status: string } | null;
  descPosicionMant: string | null;
  denomObjetoTecnico: string | null;
  ubicacionTecnica: string | null;
  denomUbicacionTecnica: string | null;
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

interface TaskFacets {
  plants: Array<{ id: string; psr: string; name: string; status: string }>; 
  frequencies: string[];
  serviceTypes: Array<{ value: string; label: string }>;
}

export default function TareasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [plantId, setPlantId] = useState(() => searchParams.get('plantId') ?? '');
  const [tipo, setTipo] = useState(() => searchParams.get('tipo') ?? '');
  const [abc, setAbc] = useState(() => searchParams.get('abc') ?? '');
  const [frecuencia, setFrecuencia] = useState(() => searchParams.get('frecuencia') ?? '');
  const [year, setYear] = useState<number | ''>(() => readNumberFilter(searchParams.get('year'), 2000, 2100));
  const [month, setMonth] = useState<number | ''>(() => readNumberFilter(searchParams.get('month'), 1, 12));

  const urlParams = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (plantId.trim()) params.set('plantId', plantId.trim());
    if (tipo.trim()) params.set('tipo', tipo.trim());
    if (abc.trim()) params.set('abc', abc.trim());
    if (frecuencia.trim()) params.set('frecuencia', frecuencia.trim());
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return params.toString();
  }, [abc, frecuencia, month, plantId, q, tipo, year]);

  useEffect(() => {
    router.replace(urlParams ? `/dashboard/tareas?${urlParams}` : '/dashboard/tareas', { scroll: false });
  }, [router, urlParams]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', q, plantId, tipo, abc, frecuencia, year, month],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (plantId) params.set('plantId', plantId);
      if (tipo) params.set('tipo', tipo);
      if (abc) params.set('abc', abc);
      if (frecuencia) params.set('frecuencia', frecuencia);
      if (year) params.set('year', String(year));
      if (month) params.set('month', String(month));
      params.set('take', '100');
      return api<TaskList>(`/api/tasks?${params.toString()}`);
    },
  });

  const facets = useQuery({
    queryKey: ['task-facets'],
    queryFn: () => api<TaskFacets>('/api/tasks/facets'),
  });

  function clearFilters() {
    setQ('');
    setPlantId('');
    setTipo('');
    setAbc('');
    setFrecuencia('');
    setYear('');
    setMonth('');
  }

  const hasFilters = Boolean(q || plantId || tipo || abc || frecuencia || year || month);

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

      <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-[minmax(180px,1.3fr)_minmax(180px,1fr)_repeat(5,minmax(92px,auto))_auto] md:items-end">
        <Field label="Buscar">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            className="h-9 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text"
            placeholder="Descripción, equipo…"
          />
        </Field>
        <Field label="Planta">
          <select
            name="planta"
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="h-9 min-w-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text"
          >
            <option value="">Todas</option>
            {(facets.data?.plants ?? []).map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}{plant.status === 'STANDBY' ? ' (Standby)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ABC">
          <select name="abc" value={abc} onChange={(e) => setAbc(e.target.value)} className="h-9 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text">
            <option value="">Todos</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </Field>
        <Field label="Frecuencia">
          <select
            name="frecuencia"
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value)}
            className="h-9 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text"
          >
            <option value="">Todas</option>
            {(facets.data?.frequencies ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text">
            <option value="">Todos</option>
            {(facets.data?.serviceTypes ?? []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Año">
          <input name="year" type="number" min={2000} max={2100} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} className="h-9 w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text" />
        </Field>
        <Field label="Mes">
          <input name="month" type="number" min={1} max={12} inputMode="numeric" value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : '')} className="h-9 w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-text" />
        </Field>
        <div className="flex items-center gap-3 md:justify-end">
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="h-9 rounded border border-[var(--color-border)] px-3 text-sm font-medium text-text hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Limpiar
            </button>
          )}
          <span className="whitespace-nowrap text-sm text-ds-muted">{data?.total ?? 0} resultados</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow duration-200 hover:shadow-sm">
        <table className="min-w-[980px] text-sm">
          <thead className="bg-[var(--color-surface-2)] text-text">
            <tr>
              <th className="px-3 py-2 text-left">ABC</th>
              <th className="px-3 py-2 text-left">Planta</th>
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
                  <td colSpan={7} className="px-3 py-2">
                    <div className="skeleton h-8 w-full rounded-md" />
                  </td>
                </tr>
              ))
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-danger">
                  No se pudo cargar el listado de tareas.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ds-muted">
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
                <td className="max-w-[260px] px-3 py-2 font-medium text-text">
                  <span className="block truncate" title={t.plant?.name ?? t.denomUbicacionTecnica ?? undefined}>
                    {t.plant?.name ?? t.denomUbicacionTecnica ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ds-muted">{t.ubicacionTecnica ?? '—'}</td>
                <td className="max-w-[340px] px-3 py-2">
                  <span className="block truncate" title={t.descPosicionMant ?? t.denomObjetoTecnico ?? undefined}>
                    {t.descPosicionMant ?? t.denomObjetoTecnico ?? '—'}
                  </span>
                </td>
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

function readNumberFilter(value: string | null, min: number, max: number): number | '' {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const parsed = Math.trunc(n);
  return parsed >= min && parsed <= max ? parsed : '';
}

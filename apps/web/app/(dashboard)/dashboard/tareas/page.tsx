'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';

type MaintType = 'PREVENTIVA' | 'CORRECTIVA' | 'PREDICTIVA';

interface Task {
  id: string;
  plant: { id: string; name: string } | null;
  titulo: string | null;
  descPosicionMant: string | null;
  posicionMant: string | null;
  tipo: MaintType;
  equipo: string | null;
  frecuenciaCodigo: string | null;
  hhReal: string | number | null;
  responsable: string | null;
}

interface TaskList {
  rows: Task[];
  total: number;
}

interface TaskFacets {
  plants: Array<{ id: string; psr: string; name: string }>;
  frequencies: string[];
}

const FREQ_LABEL: Record<string, string> = {
  '1M': 'Mensual',
  '3M': 'Trimestral',
  '6M': 'Semestral',
  '1A': 'Anual',
  '5A': 'Quinquenal',
};
const TYPE_META: Record<MaintType, { label: string; cls: string }> = {
  PREVENTIVA: { label: 'Preventiva', cls: 'bg-blue-100 text-blue-800' },
  CORRECTIVA: { label: 'Correctiva', cls: 'bg-amber-100 text-amber-800' },
  PREDICTIVA: { label: 'Predictiva', cls: 'bg-violet-100 text-violet-800' },
};

export default function TareasPage() {
  const [q, setQ] = useState('');
  const [plantId, setPlantId] = useState('');
  const [tipo, setTipo] = useState('');
  const [frecuencia, setFrecuencia] = useState('');

  const facets = useQuery({ queryKey: ['task-facets'], queryFn: () => api<TaskFacets>('/api/tasks/facets') });
  const tasks = useQuery({
    queryKey: ['tasks-list', q, plantId, frecuencia],
    queryFn: () => {
      const p = new URLSearchParams({ take: '500' });
      if (q.trim()) p.set('q', q.trim());
      if (plantId) p.set('plantId', plantId);
      if (frecuencia) p.set('frecuencia', frecuencia);
      return api<TaskList>(`/api/tasks?${p.toString()}`);
    },
  });

  const psrById = useMemo(
    () => new Map((facets.data?.plants ?? []).map((p) => [p.id, p.psr])),
    [facets.data],
  );

  const rows = useMemo(
    () => (tasks.data?.rows ?? []).filter((t) => !tipo || t.tipo === tipo),
    [tasks.data, tipo],
  );

  return (
    <div className="flex flex-col gap-4 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">SAP PM</p>
        <h1 className="text-2xl font-semibold text-text">Mantenciones</h1>
        <p className="mt-1 text-sm text-ds-muted">Todas las mantenciones de todas las plantas.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ds-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar título, equipo, ID…" className="pl-8" />
        </div>
        <Filter value={plantId} onChange={setPlantId} placeholder="Todas las plantas">
          {(facets.data?.plants ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Filter>
        <Filter value={tipo} onChange={setTipo} placeholder="Todo tipo">
          <option value="PREVENTIVA">Preventiva</option>
          <option value="CORRECTIVA">Correctiva</option>
          <option value="PREDICTIVA">Predictiva</option>
        </Filter>
        <Filter value={frecuencia} onChange={setFrecuencia} placeholder="Toda frecuencia">
          {(facets.data?.frequencies ?? []).map((f) => (
            <option key={f} value={f}>{FREQ_LABEL[f] ?? f}</option>
          ))}
        </Filter>
        <span className="pl-1 text-xs text-ds-muted">{int(rows.length)} mantenciones</span>
      </div>

      {tasks.isLoading ? (
        <div className="skeleton h-72 rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="font-semibold text-text">Sin resultados</p>
          <p className="mt-1 text-sm text-ds-muted">Ajusta la búsqueda o los filtros.</p>
        </div>
      ) : (
        <ul className="grid gap-2" role="list">
          {rows.map((t) => {
            const psr = t.plant ? psrById.get(t.plant.id) : undefined;
            const meta = TYPE_META[t.tipo] ?? TYPE_META.PREVENTIVA;
            const card = (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-ds-accent/50 hover:bg-[var(--color-surface-2)]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.posicionMant && <span className="font-mono text-[11px] text-ds-muted">#{t.posicionMant}</span>}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                  {t.plant && <span className="text-[11px] text-ds-muted">· {t.plant.name}</span>}
                </div>
                <p className="mt-1 truncate font-medium text-text">
                  {t.titulo || t.descPosicionMant || 'Mantención'}
                </p>
                <p className="mt-0.5 truncate text-xs text-ds-muted">
                  {FREQ_LABEL[t.frecuenciaCodigo ?? ''] ?? t.frecuenciaCodigo ?? 'Sin frecuencia'} · {fmtHh(t.hhReal)} HH
                  {t.responsable ? ` · ${t.responsable}` : ''}
                  {t.equipo ? ` · ${t.equipo}` : ''}
                </p>
              </div>
            );
            return (
              <li key={t.id}>
                {psr ? <Link href={`/dashboard/plantas/${encodeURIComponent(psr)}`}>{card}</Link> : card}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Filter({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm ${
        value ? 'text-text' : 'text-ds-muted'
      }`}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

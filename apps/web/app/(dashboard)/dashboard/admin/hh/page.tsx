'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plus, Trash2, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';

type Scope =
  | 'GLOBAL'
  | 'ABC'
  | 'FREQ'
  | 'FREQ_ABC'
  | 'PLANT'
  | 'PLANT_ABC'
  | 'PLANT_FREQ'
  | 'PLANT_FREQ_ABC';

// El usuario elige Planta / Frecuencia / Criticidad (cada uno con "Todas").
// El alcance técnico se deriva de qué campos se especificaron.
function deriveScope(plantId: string, freq: string, abc: string): Scope {
  const p = !!plantId;
  const f = !!freq;
  const a = !!abc;
  if (p && f && a) return 'PLANT_FREQ_ABC';
  if (p && f) return 'PLANT_FREQ';
  if (p && a) return 'PLANT_ABC';
  if (p) return 'PLANT';
  if (f && a) return 'FREQ_ABC';
  if (f) return 'FREQ';
  if (a) return 'ABC';
  return 'GLOBAL';
}

const FREQ_OPTIONS = ['1M', '3M', '6M', '1A', '5A'];

interface HhRule {
  id: string;
  scope: Scope;
  plantId: string | null;
  frecuenciaCodigo: string | null;
  abc: string | null;
  hhPlan: string;
  priority: number;
  note: string | null;
  createdAt: string;
}

interface PlantRow {
  id: string;
  name: string;
  psr: string;
}

interface Suggestion {
  plantId: string | null;
  plantName: string | null;
  frecuenciaCodigo: string | null;
  abc: string | null;
  n: number;
  mean: number;
  median: number;
  stdev: number;
}

export default function HhDefaultsPage() {
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: ['hh-defaults'],
    queryFn: () => api<HhRule[]>('/api/hh-defaults'),
  });
  const plants = useQuery({
    queryKey: ['plantas-light'],
    queryFn: () => api<{ rows: PlantRow[] }>('/api/plantas?take=500'),
  });
  const suggestions = useQuery({
    queryKey: ['hh-defaults-suggestions'],
    queryFn: () => api<Suggestion[]>('/api/hh-defaults/suggestions'),
    staleTime: 60_000,
  });

  const [plantId, setPlantId] = useState('');
  const [freq, setFreq] = useState('');
  const [abc, setAbc] = useState('');
  const [hh, setHh] = useState('');
  const [priority, setPriority] = useState('0');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const upsert = useMutation({
    mutationFn: () =>
      api('/api/hh-defaults', {
        method: 'POST',
        body: JSON.stringify({
          scope: deriveScope(plantId, freq, abc),
          plantId: plantId || undefined,
          frecuenciaCodigo: freq || undefined,
          abc: abc || undefined,
          hhPlan: Number(hh),
          priority: Number(priority) || 0,
          note: note || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hh-defaults'] });
      setHh('');
      setNote('');
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/hh-defaults/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hh-defaults'] }),
  });

  const applySuggestion = useMutation({
    mutationFn: (s: Suggestion) => {
      const hasPlant = s.plantId != null;
      const hasFreq = s.frecuenciaCodigo != null;
      const hasAbc = s.abc != null;
      const scope = (
        hasPlant && hasFreq && hasAbc ? 'PLANT_FREQ_ABC'
        : hasPlant && hasFreq ? 'PLANT_FREQ'
        : hasPlant ? 'PLANT'
        : hasFreq && hasAbc ? 'FREQ_ABC'
        : hasFreq ? 'FREQ'
        : hasAbc ? 'ABC'
        : 'GLOBAL'
      );
      return api('/api/hh-defaults', {
        method: 'POST',
        body: JSON.stringify({
          scope,
          plantId: s.plantId ?? undefined,
          frecuenciaCodigo: s.frecuenciaCodigo ?? undefined,
          abc: s.abc ?? undefined,
          hhPlan: s.median, // mediana es más robusta que media frente a outliers
          priority: 0,
          note: `Sugerido desde ${s.n} ejecuciones aprobadas (media ${s.mean}, σ ${s.stdev})`,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hh-defaults'] });
    },
  });

  const backfill = useMutation({
    mutationFn: () => api<{ updated: number }>('/api/hh-defaults/backfill', { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['kpis'] });
      qc.invalidateQueries({ queryKey: ['upcoming-30'] });
      alert(`Backfill aplicado: ${data.updated} ejecuciones actualizadas`);
    },
  });

  return (
    <div className="space-y-5 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Administración</p>
        <h1 className="text-2xl font-semibold text-text">HH por defecto</h1>
        <p className="mt-1 max-w-3xl text-sm text-ds-muted">
          Define cuántas horas-hombre (HH) asignar a una tarea cuando el Excel no las trae.
          Eliges a qué tareas aplica la regla; si dejas un campo en <span className="text-text">Todas</span>,
          la regla cubre todas las opciones de ese campo. Cuando varias reglas coinciden, gana la más específica.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-semibold text-text">Nueva regla</h2>
        <p className="text-xs text-ds-muted">Aplica esta regla a:</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_6rem_6rem_auto]">
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Planta
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            >
              <option value="">Todas las plantas</option>
              {(plants.data?.rows ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Frecuencia
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            >
              <option value="">Todas las frecuencias</option>
              {FREQ_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Criticidad
            <select
              value={abc}
              onChange={(e) => setAbc(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            >
              <option value="">Todas</option>
              <option value="A">A · crítica</option>
              <option value="B">B · importante</option>
              <option value="C">C · estándar</option>
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            HH a asignar
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={hh}
              onChange={(e) => setHh(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] tabular-nums"
            />
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Prioridad
            <input
              type="number"
              inputMode="numeric"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              title="Si dos reglas igual de específicas coinciden, gana la de mayor prioridad."
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] tabular-nums"
            />
          </label>
          <button
            type="button"
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || !hh}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ds-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[44px] self-end"
          >
            <Plus className="size-4" aria-hidden />
            Guardar
          </button>
        </div>
        <label className="text-xs text-ds-muted flex flex-col gap-1">
          Nota (opcional)
          <input
            value={note}
            maxLength={512}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
          />
        </label>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      </section>

      {(suggestions.data?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-warn/40 bg-warn-dim/40 p-4 space-y-2">
          <h2 className="font-semibold text-text flex items-center gap-2"><Lightbulb className="size-4" aria-hidden />Sugerencias desde histórico</h2>
          <p className="text-xs text-ds-muted">Calculadas con ejecuciones aprobadas (hhActual&gt;0, mínimo 3 muestras). Mediana es más robusta que media.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-ds-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Planta</th>
                  <th className="px-2 py-1 text-left">Frec.</th>
                  <th className="px-2 py-1 text-left">ABC</th>
                  <th className="px-2 py-1 text-right">n</th>
                  <th className="px-2 py-1 text-right">Mediana</th>
                  <th className="px-2 py-1 text-right">Media</th>
                  <th className="px-2 py-1 text-right">σ</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.data!.slice(0, 20).map((s, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1.5 text-xs">{s.plantName ?? '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{s.frecuenciaCodigo ?? '—'}</td>
                    <td className="px-2 py-1.5">{s.abc ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{int(s.n)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-text">{fmtHh(s.median)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtHh(s.mean)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtHh(s.stdev)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => applySuggestion.mutate(s)}
                        disabled={applySuggestion.isPending}
                        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-surface)] disabled:opacity-50 min-h-[28px]"
                      >
                        Aplicar mediana
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] p-3">
          <h2 className="font-semibold text-text">Reglas activas <span className="text-ds-muted text-xs">({int(rules.data?.length ?? 0)})</span></h2>
          <button
            type="button"
            onClick={() => backfill.mutate()}
            disabled={backfill.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-50 min-h-[40px]"
            title="Aplica las reglas sobre ejecuciones con HH=0"
          >
            <Wand2 className="size-4" aria-hidden />
            {backfill.isPending ? 'Aplicando…' : 'Backfill HH=0'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-ds-muted">
              <tr>
                <th className="px-3 py-2 text-left">Planta</th>
                <th className="px-3 py-2 text-left">Frecuencia</th>
                <th className="px-3 py-2 text-left">Criticidad</th>
                <th className="px-3 py-2 text-right">HH</th>
                <th className="px-3 py-2 text-right">Prio</th>
                <th className="px-3 py-2 text-left">Nota</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-ds-muted">Cargando…</td></tr>
              )}
              {rules.data?.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-ds-muted">Sin reglas configuradas.</td></tr>
              )}
              {rules.data?.map((r) => {
                const plant = plants.data?.rows.find((p) => p.id === r.plantId);
                return (
                  <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="px-3 py-2 text-xs">{plant?.name ?? (r.plantId ? r.plantId : 'Todas')}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.frecuenciaCodigo ?? 'Todas'}</td>
                    <td className="px-3 py-2">{r.abc ?? 'Todas'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtHh(r.hhPlan)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.priority}</td>
                    <td className="px-3 py-2 text-xs text-ds-muted">{r.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => { if (confirm('¿Eliminar regla?')) remove.mutate(r.id); }}
                        className="inline-flex items-center gap-1 rounded-md border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-danger-dim min-h-[32px]"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

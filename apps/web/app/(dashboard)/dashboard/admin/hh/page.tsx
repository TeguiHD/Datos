'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plus, Trash2, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';

const SCOPES = [
  'GLOBAL',
  'ABC',
  'FREQ',
  'FREQ_ABC',
  'PLANT',
  'PLANT_FREQ',
  'PLANT_FREQ_ABC',
] as const;
type Scope = (typeof SCOPES)[number];

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

function scopeRequires(scope: Scope) {
  const parts = scope.split('_');
  return {
    plant: parts.includes('PLANT'),
    freq: parts.includes('FREQ'),
    abc: parts.includes('ABC'),
  };
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

  const [scope, setScope] = useState<Scope>('FREQ');
  const [plantId, setPlantId] = useState('');
  const [freq, setFreq] = useState('');
  const [abc, setAbc] = useState('');
  const [hh, setHh] = useState('');
  const [priority, setPriority] = useState('0');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const requires = scopeRequires(scope);

  const upsert = useMutation({
    mutationFn: () =>
      api('/api/hh-defaults', {
        method: 'POST',
        body: JSON.stringify({
          scope,
          plantId: requires.plant ? plantId || undefined : undefined,
          frecuenciaCodigo: requires.freq ? freq || undefined : undefined,
          abc: requires.abc ? abc || undefined : undefined,
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
          Reglas que asignan HH plan cuando el Excel no las trae (ej. ESSC Sur). Las más específicas ganan:
          <span className="font-mono"> PLANT_FREQ_ABC &gt; PLANT_FREQ &gt; PLANT &gt; FREQ_ABC &gt; FREQ &gt; ABC &gt; GLOBAL</span>.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-semibold text-text">Nueva regla</h2>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr_1fr_6rem_6rem_auto]">
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Alcance
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            >
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Planta {requires.plant && <span className="text-danger">·</span>}
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              disabled={!requires.plant}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] disabled:opacity-50"
            >
              <option value="">—</option>
              {(plants.data?.rows ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.psr})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Frecuencia
            <input
              value={freq}
              disabled={!requires.freq}
              onChange={(e) => setFreq(e.target.value.toUpperCase())}
              placeholder="1M, 6M, 1A…"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] disabled:opacity-50 font-mono"
            />
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            ABC
            <select
              value={abc}
              disabled={!requires.abc}
              onChange={(e) => setAbc(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] disabled:opacity-50"
            >
              <option value="">—</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            HH plan
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
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] tabular-nums"
            />
          </label>
          <button
            type="button"
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || !hh}
            className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[44px]"
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
                <th className="px-3 py-2 text-left">Alcance</th>
                <th className="px-3 py-2 text-left">Planta</th>
                <th className="px-3 py-2 text-left">Frec.</th>
                <th className="px-3 py-2 text-left">ABC</th>
                <th className="px-3 py-2 text-right">HH</th>
                <th className="px-3 py-2 text-right">Prio</th>
                <th className="px-3 py-2 text-left">Nota</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.isLoading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-ds-muted">Cargando…</td></tr>
              )}
              {rules.data?.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-ds-muted">Sin reglas configuradas.</td></tr>
              )}
              {rules.data?.map((r) => {
                const plant = plants.data?.rows.find((p) => p.id === r.plantId);
                return (
                  <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="px-3 py-2 font-mono text-xs">{r.scope}</td>
                    <td className="px-3 py-2 text-xs">{plant?.name ?? r.plantId ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.frecuenciaCodigo ?? '—'}</td>
                    <td className="px-3 py-2">{r.abc ?? '—'}</td>
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

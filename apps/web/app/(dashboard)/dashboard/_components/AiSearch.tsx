'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { ExecutionRow, TaskBrief } from '@/lib/types';

interface AiResult {
  filter: Record<string, unknown>;
  mode: 'tasks' | 'executions';
  count: number;
  rows: TaskBrief[] | ExecutionRow[];
  _meta: { model: string; latencyMs: number };
}

export function AiSearch() {
  const [prompt, setPrompt] = useState('');
  const search = useMutation({
    mutationFn: (p: string) =>
      api<AiResult>('/api/ai/search', { method: 'POST', body: JSON.stringify({ prompt: p }) }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim().length < 2) return;
    search.mutate(prompt.trim());
  }

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <h2 className="font-medium">Búsqueda inteligente</h2>
      <p className="text-xs text-slate-500">
        Ej: <em>qué hay vencido del PSR Pérez</em>, <em>próximos 30 días equipo bomba</em>,{' '}
        <em>tareas anuales del centro 1234 en 2027</em>.
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          placeholder="Pregunta en español…"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={search.isPending || prompt.trim().length < 2}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {search.isPending ? '…' : 'Buscar'}
        </button>
      </form>

      {search.isError && (
        <p className="text-sm text-red-700">
          {search.error instanceof ApiError
            ? `Error ${search.error.status}: ${(search.error.body as { message?: string })?.message ?? search.error.message}`
            : 'Error desconocido'}
        </p>
      )}

      {search.data && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500">
              {search.data.count} resultados · {search.data.mode} · modelo {search.data._meta.model} ·{' '}
              {search.data._meta.latencyMs} ms
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500">filtros:</span>
            {Object.entries(search.data.filter).map(([k, v]) => (
              <span key={k} className="bg-slate-100 px-2 py-0.5 rounded font-mono">
                {k}={String(v)}
              </span>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto border rounded">
            <ResultTable result={search.data} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResultTable({ result }: { result: AiResult }) {
  if (result.mode === 'tasks') {
    const rows = result.rows as TaskBrief[];
    if (rows.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">Sin coincidencias</p>;
    return (
      <table className="min-w-full text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-2 py-1 text-left">ABC</th>
            <th className="px-2 py-1 text-left">Ubic.</th>
            <th className="px-2 py-1 text-left">Descripción</th>
            <th className="px-2 py-1 text-left">PSR</th>
            <th className="px-2 py-1 text-left">Frec</th>
            <th className="px-2 py-1 text-right">HH</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-2 py-1">{t.indicadorAbc ?? '—'}</td>
              <td className="px-2 py-1 font-mono">{t.ubicacionTecnica ?? '—'}</td>
              <td className="px-2 py-1">{t.descPosicionMant ?? t.denomObjetoTecnico ?? '—'}</td>
              <td className="px-2 py-1">{t.psr ?? '—'}</td>
              <td className="px-2 py-1">{t.frecuenciaCodigo ?? '—'}</td>
              <td className="px-2 py-1 text-right tabular-nums">{t.hhReal ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const rows = result.rows as ExecutionRow[];
  if (rows.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">Sin coincidencias</p>;
  return (
    <table className="min-w-full text-xs">
      <thead className="bg-slate-100">
        <tr>
          <th className="px-2 py-1 text-left">Vence</th>
          <th className="px-2 py-1 text-left">ABC</th>
          <th className="px-2 py-1 text-left">Descripción</th>
          <th className="px-2 py-1 text-left">PSR</th>
          <th className="px-2 py-1 text-right">HH</th>
          <th className="px-2 py-1 text-left">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-2 py-1 font-mono">{r.dueDate.slice(0, 7)}</td>
            <td className="px-2 py-1">{r.task.indicadorAbc ?? '—'}</td>
            <td className="px-2 py-1">{r.task.descPosicionMant ?? '—'}</td>
            <td className="px-2 py-1">{r.task.psr ?? '—'}</td>
            <td className="px-2 py-1 text-right tabular-nums">{Number(r.hhPlanned).toFixed(1)}</td>
            <td className="px-2 py-1">{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

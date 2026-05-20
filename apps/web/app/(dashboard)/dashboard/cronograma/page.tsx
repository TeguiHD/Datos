'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';
import { CronogramaMatrix, type MatrixRow } from '../_components/CronogramaMatrix';

interface TaskFacets {
  plants: Array<{ id: string; name: string; status: string }>;
}

interface ExecutionRow {
  id: string;
  dueDate: string;
  status: string;
  hhPlanned: string;
  hhActual: string | null;
  task: {
    plant: { id: string; name: string } | null;
    descPosicionMant: string | null;
    denomObjetoTecnico: string | null;
    frecuenciaCodigo: string | null;
  };
}

interface ExecutionList {
  rows: ExecutionRow[];
  total: number;
}

interface MatrixResponse {
  yearFrom: number;
  yearTo: number;
  taskCount: number;
  rows: MatrixRow[];
}

const NOW_YEAR = new Date().getUTCFullYear();

export default function Cronograma() {
  const [year, setYear] = useState(NOW_YEAR);
  const [plantId, setPlantId] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ExecutionRow | null>(null);
  const queryClient = useQueryClient();

  const facets = useQuery({
    queryKey: ['task-facets'],
    queryFn: () => api<TaskFacets>('/api/tasks/facets'),
  });

  const matrix = useQuery({
    queryKey: ['matrix', year, plantId, q],
    queryFn: () =>
      api<MatrixResponse>(
        `/api/schedule/matrix?yearFrom=${year}&yearTo=${year}` +
          (plantId ? `&plantId=${plantId}` : '') +
          (q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''),
      ),
  });

  const executions = useQuery({
    queryKey: ['schedule-executions', year, plantId],
    queryFn: () =>
      api<ExecutionList>(
        `/api/schedule/executions?yearFrom=${year}&monthFrom=1&yearTo=${year}&monthTo=12&take=12${plantId ? `&plantId=${plantId}` : ''}`,
      ),
  });

  const is2faError =
    matrix.error instanceof ApiError &&
    matrix.error.status === 403 &&
    (matrix.error.body as { message?: string })?.message === '2FA required';

  return (
    <div className="space-y-4 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Planificación</p>
        <h1 className="text-2xl font-semibold text-text">Cronograma</h1>
        <p className="mt-1 max-w-2xl text-sm text-ds-muted">
          Matriz tarea × mes. Cada celda marca el mes en que la tarea vence, con su estado operativo.
        </p>
      </header>

      {is2faError && (
        <div className="rounded-xl border border-warn/40 bg-warn-dim px-4 py-3 text-sm text-warn">
          Debes completar verificación 2FA para consultar el cronograma.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Año anterior"
            className="grid size-9 place-items-center rounded-md hover:bg-[var(--color-surface-2)]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-text">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Año siguiente"
            className="grid size-9 place-items-center rounded-md hover:bg-[var(--color-surface-2)]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-ds-muted">
          Planta
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="min-h-[40px] min-w-[12rem] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text"
          >
            <option value="">Todas las plantas</option>
            {(facets.data?.plants ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === 'STANDBY' ? ' (Standby)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs text-ds-muted sm:flex-none">
          Buscar tarea
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ds-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Descripción, equipo, ubicación…"
              className="min-h-[40px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-2 text-sm text-text sm:w-72"
            />
          </div>
        </label>

        {matrix.data && (
          <span className="pb-2 text-xs text-ds-muted">{int(matrix.data.taskCount)} tareas</span>
        )}
      </div>

      <CronogramaMatrix rows={matrix.data?.rows ?? []} year={year} loading={matrix.isLoading} />

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-3">
          <h2 className="font-semibold text-text">Ajuste manual de ejecuciones</h2>
          <span className="text-xs text-ds-muted">{int(executions.data?.total ?? 0)} en {year}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[680px] text-sm">
            <thead className="bg-[var(--color-surface-2)] text-ds-muted">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Planta</th>
                <th className="px-3 py-2 text-left">Tarea</th>
                <th className="px-3 py-2 text-left">Frec.</th>
                <th className="px-3 py-2 text-right">HH plan</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(executions.data?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-mono text-xs">{row.dueDate.slice(0, 10)}</td>
                  <td className="px-3 py-2">{row.task.plant?.name ?? 'Sin planta'}</td>
                  <td className="max-w-[280px] truncate px-3 py-2">
                    {row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '—'}
                  </td>
                  <td className="px-3 py-2">{row.task.frecuenciaCodigo ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtHh(row.hhPlanned)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className="min-h-[32px] rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface-2)]"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!executions.isLoading && (executions.data?.rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ds-muted">
                    Sin ejecuciones en {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <ExecutionEditor
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['schedule-executions'] });
            queryClient.invalidateQueries({ queryKey: ['matrix'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExecutionEditor({ row, onClose, onSaved }: { row: ExecutionRow; onClose: () => void; onSaved: () => void }) {
  const [dueDate, setDueDate] = useState(row.dueDate.slice(0, 10));
  const [hhPlanned, setHhPlanned] = useState(String(row.hhPlanned));
  const save = useMutation({
    mutationFn: () =>
      api(`/api/schedule/executions/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueDate, hhPlanned: Number(hhPlanned) }),
      }),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <form
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-semibold text-text">Editar ejecución</h2>
        <label className="mt-4 flex flex-col gap-1 text-sm text-ds-muted">
          Fecha planificada
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-text"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm text-ds-muted">
          HH planificada
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={hhPlanned}
            onChange={(event) => setHhPlanned(event.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-text"
          />
        </label>
        {save.isError && <p className="mt-3 text-sm text-danger">No se pudo guardar la edición manual.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-md border border-[var(--color-border)] px-3 text-sm hover:bg-[var(--color-surface-2)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="min-h-[44px] rounded-md bg-ds-accent px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

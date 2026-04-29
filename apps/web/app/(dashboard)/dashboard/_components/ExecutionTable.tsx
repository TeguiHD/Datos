'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExecutionRow, ExecStatus } from '@/lib/types';

interface Props {
  rows: ExecutionRow[];
  emptyText: string;
  highlightOverdue?: boolean;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDue(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear().toString().slice(-2)}`;
}

export function ExecutionTable({ rows, emptyText, highlightOverdue }: Props) {
  if (rows.length === 0) return <p className="text-sm text-slate-500 py-6 text-center">{emptyText}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left">Vence</th>
            <th className="px-3 py-2 text-left">ABC</th>
            <th className="px-3 py-2 text-left">Ubicación</th>
            <th className="px-3 py-2 text-left">Descripción</th>
            <th className="px-3 py-2 text-left">PSR</th>
            <th className="px-3 py-2 text-left">Frec.</th>
            <th className="px-3 py-2 text-right">HH</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} highlightOverdue={!!highlightOverdue} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, highlightOverdue }: { row: ExecutionRow; highlightOverdue: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hhActual, setHhActual] = useState<string>(row.hhPlanned);
  const [operator, setOperator] = useState(row.operator ?? '');
  const [notes, setNotes] = useState(row.notes ?? '');

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/schedule/executions/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      setOpen(false);
    },
  });

  const isOverdue = row.status === 'OVERDUE' && highlightOverdue;
  return (
    <>
      <tr className={`border-t hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
        <td className="px-3 py-2 font-mono text-xs">{formatDue(row.dueDate)}</td>
        <td className="px-3 py-2 font-medium">{row.task.indicadorAbc ?? '—'}</td>
        <td className="px-3 py-2 font-mono text-xs">{row.task.ubicacionTecnica ?? '—'}</td>
        <td className="px-3 py-2">{row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '—'}</td>
        <td className="px-3 py-2">{row.task.psr ?? '—'}</td>
        <td className="px-3 py-2">{row.task.frecuenciaCodigo ?? '—'}</td>
        <td className="px-3 py-2 text-right tabular-nums">{Number(row.hhPlanned).toFixed(1)}</td>
        <td className="px-3 py-2">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-3 py-2">
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-blue-700 hover:underline"
          >
            {open ? 'cerrar' : 'gestionar'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t bg-slate-50">
          <td colSpan={9} className="px-3 py-3">
            <div className="flex flex-wrap gap-2 items-end">
              <Field label="HH real">
                <input
                  type="number"
                  step="0.1"
                  value={hhActual}
                  onChange={(e) => setHhActual(e.target.value)}
                  className="border rounded px-2 py-1 w-24"
                />
              </Field>
              <Field label="Operador">
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  maxLength={128}
                  className="border rounded px-2 py-1 w-48"
                />
              </Field>
              <Field label="Notas">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1024}
                  className="border rounded px-2 py-1 w-72"
                />
              </Field>
              <button
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    status: 'DONE' as ExecStatus,
                    hhActual: Number(hhActual),
                    operator: operator || undefined,
                    notes: notes || undefined,
                  })
                }
                className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                Marcar hecha
              </button>
              <button
                disabled={update.isPending}
                onClick={() => update.mutate({ status: 'SKIPPED' as ExecStatus, notes: notes || undefined })}
                className="bg-slate-600 text-white text-sm px-3 py-1.5 rounded hover:bg-slate-700 disabled:opacity-50"
              >
                Omitir
              </button>
              {update.isError && <span className="text-xs text-red-600">Error al guardar</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: ExecStatus }) {
  const cls = {
    PENDING: 'bg-amber-100 text-amber-800',
    OVERDUE: 'bg-red-100 text-red-800',
    DONE: 'bg-emerald-100 text-emerald-800',
    SKIPPED: 'bg-slate-200 text-slate-700',
  }[status];
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-slate-600 flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}

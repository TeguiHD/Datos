'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { enqueue, makeIdempotencyKey } from '@/lib/offline/outbox';
import { useOnline } from '@/lib/offline/useOnline';
import type { ExecutionRow, ExecStatus } from '@/lib/types';
import { execStatusLabels } from '@datos/shared-types';
import { hh as fmtHh } from '@/lib/i18n/formatters';

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
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ds-muted py-6 text-center" role="status">
        {emptyText}
      </p>
    );
  }

  return (
    <>
      {/* móvil: lista de cards */}
      <ul className="md:hidden grid gap-2" role="list">
        {rows.map((r) => (
          <CardRow key={r.id} row={r} highlightOverdue={!!highlightOverdue} />
        ))}
      </ul>

      {/* tablet/desktop: tabla */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm" role="table">
          <thead className="bg-[var(--color-surface-2)] text-ds-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">Vence</th>
              <th scope="col" className="px-3 py-2 text-left">ABC</th>
              <th scope="col" className="px-3 py-2 text-left">Ubicación</th>
              <th scope="col" className="px-3 py-2 text-left">Descripción</th>
              <th scope="col" className="px-3 py-2 text-left">PSR</th>
              <th scope="col" className="px-3 py-2 text-left">Frec.</th>
              <th scope="col" className="px-3 py-2 text-right">HH</th>
              <th scope="col" className="px-3 py-2 text-left">Estado</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <DesktopRow key={r.id} row={r} highlightOverdue={!!highlightOverdue} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function useExecutionUpdate(row: ExecutionRow, onSuccess: () => void) {
  const qc = useQueryClient();
  const online = useOnline();

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const idempotencyKey = makeIdempotencyKey();
      const url = `/api/schedule/executions/${row.id}`;
      const serialized = JSON.stringify(body);

      if (!online) {
        await enqueue({
          id: idempotencyKey,
          url,
          method: 'PATCH',
          headers: {},
          body: serialized,
        });
        return { queued: true } as const;
      }

      return api(url, {
        method: 'PATCH',
        body: serialized,
        headers: { 'idempotency-key': idempotencyKey },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      onSuccess();
    },
  });
}

function CardRow({ row, highlightOverdue }: { row: ExecutionRow; highlightOverdue: boolean }) {
  const [open, setOpen] = useState(false);
  const isOverdue = row.status === 'OVERDUE' && highlightOverdue;
  const desc = row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '—';

  return (
    <li
      className={`rounded-xl border bg-[var(--color-surface)] p-3 ${
        isOverdue ? 'border-danger/40 bg-danger-dim' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-ds-muted">
            <span className="font-mono">{formatDue(row.dueDate)}</span>
            <span>·</span>
            <span className="font-medium text-text">ABC {row.task.indicadorAbc ?? '—'}</span>
            <span>·</span>
            <span className="font-mono">{row.task.psr ?? '—'}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-text">{desc}</p>
          <p className="mt-0.5 truncate text-xs font-mono text-ds-muted">{row.task.ubicacionTecnica ?? '—'}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ds-muted">
        <span>HH plan: <span className="tabular-nums text-text">{fmtHh(row.hhPlanned)}</span></span>
        <span>Frec: {row.task.frecuenciaCodigo ?? '—'}</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-[var(--color-border)] text-sm font-medium text-text hover:bg-[var(--color-surface-2)]"
      >
        {open ? 'Cerrar' : 'Gestionar'}
      </button>
      {open && <EditPanel row={row} onClose={() => setOpen(false)} />}
    </li>
  );
}

function DesktopRow({ row, highlightOverdue }: { row: ExecutionRow; highlightOverdue: boolean }) {
  const [open, setOpen] = useState(false);
  const isOverdue = row.status === 'OVERDUE' && highlightOverdue;
  return (
    <>
      <tr className={`border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] ${isOverdue ? 'bg-danger-dim' : ''}`}>
        <td className="px-3 py-2 font-mono text-xs">{formatDue(row.dueDate)}</td>
        <td className="px-3 py-2 font-medium">{row.task.indicadorAbc ?? '—'}</td>
        <td className="px-3 py-2 font-mono text-xs">{row.task.ubicacionTecnica ?? '—'}</td>
        <td className="px-3 py-2">{row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? '—'}</td>
        <td className="px-3 py-2">{row.task.psr ?? '—'}</td>
        <td className="px-3 py-2">{row.task.frecuenciaCodigo ?? '—'}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtHh(row.hhPlanned)}</td>
        <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-xs font-medium text-ds-accent hover:underline min-h-[32px] px-1"
          >
            {open ? 'cerrar' : 'gestionar'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <td colSpan={9} className="px-3 py-3">
            <EditPanel row={row} onClose={() => setOpen(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditPanel({ row, onClose }: { row: ExecutionRow; onClose: () => void }) {
  const [hhActual, setHhActual] = useState<string>(row.hhPlanned);
  const [operator, setOperator] = useState(row.operator ?? '');
  const [notes, setNotes] = useState(row.notes ?? '');
  const update = useExecutionUpdate(row, onClose);

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_1fr_auto_auto] sm:items-end">
      <label className="text-xs text-ds-muted flex flex-col gap-1">
        HH real
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={hhActual}
          onChange={(e) => setHhActual(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
        />
      </label>
      <label className="text-xs text-ds-muted flex flex-col gap-1">
        Operador
        <input
          value={operator}
          autoComplete="name"
          onChange={(e) => setOperator(e.target.value)}
          maxLength={128}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
        />
      </label>
      <label className="text-xs text-ds-muted flex flex-col gap-1">
        Notas
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1024}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
        />
      </label>
      <button
        type="button"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({
            status: 'DONE' as ExecStatus,
            hhActual: Number(hhActual),
            operator: operator || undefined,
            notes: notes || undefined,
          })
        }
        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]"
      >
        Marcar hecha
      </button>
      <button
        type="button"
        disabled={update.isPending}
        onClick={() => update.mutate({ status: 'SKIPPED' as ExecStatus, notes: notes || undefined })}
        className="rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 min-h-[44px]"
      >
        Omitir
      </button>
      {update.isError && (
        <p role="alert" className="text-xs text-danger sm:col-span-5">Error al guardar.</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ExecStatus }) {
  const cls = {
    PENDING: 'bg-amber-100 text-amber-800',
    OVERDUE: 'bg-red-100 text-red-800',
    DONE: 'bg-emerald-100 text-emerald-800',
    SKIPPED: 'bg-slate-200 text-slate-700',
  }[status];
  return <span className={`text-xs px-2 py-0.5 rounded ${cls} whitespace-nowrap`}>{execStatusLabels[status]}</span>;
}

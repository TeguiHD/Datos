'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ExecStatus = 'PENDING' | 'OVERDUE' | 'DONE' | 'SKIPPED';
type MaintType = 'PREVENTIVA' | 'CORRECTIVA' | 'PREDICTIVA';

interface Row {
  id: string;
  dueDate: string;
  status: ExecStatus;
  hhPlanned: string | number;
  task: {
    titulo: string | null;
    descPosicionMant: string | null;
    tipo: MaintType;
    frecuenciaCodigo: string | null;
    plant: { psr: string; name: string } | null;
  };
}

interface ExecList {
  rows: Row[];
  total: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TYPE_CLS: Record<MaintType, string> = {
  PREVENTIVA: 'bg-blue-100 text-blue-800',
  CORRECTIVA: 'bg-amber-100 text-amber-800',
  PREDICTIVA: 'bg-violet-100 text-violet-800',
};

const NOW = new Date();

export default function AgendaPage() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ row: Row; action: 'DONE' | 'SKIPPED' } | null>(null);

  const data = useQuery({
    queryKey: ['agenda'],
    queryFn: () =>
      api<ExecList>(
        `/api/schedule/executions?yearFrom=${NOW.getUTCFullYear()}&monthFrom=1&yearTo=${NOW.getUTCFullYear() + 1}&monthTo=12&take=500`,
      ),
  });

  const mutate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'DONE' | 'SKIPPED' }) =>
      api(`/api/schedule/executions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      toast(v.status === 'DONE' ? 'Mantención completada' : 'Mantención omitida');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      setConfirm(null);
    },
    onError: () => toast('No se pudo guardar', 'error'),
  });

  const groups = useMemo(() => {
    const pend = (data.data?.rows ?? []).filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE');
    pend.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
    const map = new Map<string, { label: string; rows: Row[] }>();
    for (const r of pend) {
      const d = new Date(r.dueDate);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (!map.has(key)) map.set(key, { label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()];
  }, [data.data]);

  const allRows = groups.flatMap((g) => g.rows);
  const overdue = allRows.filter((r) => r.status === 'OVERDUE').length;
  const pending = allRows.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-4 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Operación</p>
        <h1 className="text-2xl font-semibold text-text">Agenda</h1>
        <p className="mt-1 text-sm text-ds-muted">Mantenciones pendientes y vencidas de todas las plantas.</p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <article className="rounded-xl border border-danger/30 bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between text-ds-muted">
            <p className="text-[10px] uppercase tracking-[0.16em]">Vencidas</p>
            <AlertTriangle className="size-4" />
          </div>
          <p className="mt-2 text-xl font-semibold tabular-nums text-danger">{int(overdue)}</p>
        </article>
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between text-ds-muted">
            <p className="text-[10px] uppercase tracking-[0.16em]">Pendientes</p>
            <CalendarClock className="size-4" />
          </div>
          <p className="mt-2 text-xl font-semibold tabular-nums text-text">{int(pending)}</p>
        </article>
      </div>

      {data.isLoading ? (
        <div className="skeleton h-72 rounded-xl" />
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="font-semibold text-text">Todo al día</p>
          <p className="mt-1 text-sm text-ds-muted">No hay mantenciones pendientes ni vencidas.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="grid gap-2">
            <h2 className="text-sm font-semibold text-ds-muted">{g.label}</h2>
            {g.rows.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border bg-[var(--color-surface)] p-3 ${
                  r.status === 'OVERDUE' ? 'border-danger/40' : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      r.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.status === 'OVERDUE' ? 'Vencida' : 'Pendiente'}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_CLS[r.task.tipo] ?? TYPE_CLS.PREVENTIVA}`}
                  >
                    {r.task.tipo === 'CORRECTIVA'
                      ? 'Correctiva'
                      : r.task.tipo === 'PREDICTIVA'
                        ? 'Predictiva'
                        : 'Preventiva'}
                  </span>
                  {r.task.plant && <span className="text-[11px] text-ds-muted">· {r.task.plant.name}</span>}
                </div>
                {r.task.plant ? (
                  <Link
                    href={`/dashboard/plantas/${encodeURIComponent(r.task.plant.psr)}`}
                    className="mt-1 block truncate font-medium text-text hover:underline"
                  >
                    {r.task.titulo || r.task.descPosicionMant || 'Mantención'}
                  </Link>
                ) : (
                  <p className="mt-1 truncate font-medium text-text">
                    {r.task.titulo || r.task.descPosicionMant || 'Mantención'}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-ds-muted">{fmtHh(r.hhPlanned)} HH</p>
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-ok/40 text-ok hover:bg-ok-dim"
                    onClick={() => setConfirm({ row: r, action: 'DONE' })}
                  >
                    <CheckCircle2 className="size-4" /> Completar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirm({ row: r, action: 'SKIPPED' })}>
                    Omitir
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === 'DONE' ? '¿Marcar como completada?' : '¿Omitir esta mantención?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ds-muted">
            {confirm?.action === 'DONE'
              ? 'Se registrará como ejecutada hoy.'
              : 'Quedará marcada como omitida para ese período.'}
          </p>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutate.isPending}
              onClick={() => confirm && mutate.mutate({ id: confirm.row.id, status: confirm.action })}
            >
              {mutate.isPending ? 'Procesando…' : confirm?.action === 'DONE' ? 'Completar' : 'Omitir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

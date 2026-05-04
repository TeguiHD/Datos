'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  Paperclip,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ExecutionOutcome = 'DONE' | 'DONE_WITH_OBSERVATIONS' | 'NOT_DONE';
type OperationalExecutionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE_PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'POSTPONED';

interface EvidenceRow {
  id: string;
  filename: string;
  originalName: string | null;
  mime: string;
  sizeBytes: number;
  description: string | null;
  uploadedAt: string;
  sha256: string;
}

interface OperationalExecution {
  id: string;
  dueDate: string;
  doneDate: string | null;
  status: OperationalExecutionStatus;
  outcome: ExecutionOutcome | null;
  hhPlan: number;
  hhActual: number | null;
  comment: string | null;
  skipReason: string | null;
  postponedTo: string | null;
  rejectedReason: string | null;
  evidenceCount: number;
  evidence: EvidenceRow[];
  planTask: {
    id: string;
    abc: string | null;
    description: string;
    frequency: string;
    equipment: { id: string; name: string; type: string } | null;
    plant: { id: string; psr: string; name: string; area: string | null };
  };
}

interface OperationalExecutionList {
  rows: OperationalExecution[];
  total: number;
  take: number;
  skip: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const STATUS_COPY: Record<OperationalExecutionStatus, { label: string; tone: string; icon: typeof Clock3 }> = {
  SCHEDULED: { label: 'Programada', tone: 'border-[var(--color-border)] text-ds-muted', icon: Clock3 },
  IN_PROGRESS: { label: 'En curso', tone: 'border-ds-accent/30 bg-accent-dim text-ds-accent', icon: Clock3 },
  DONE_PENDING_APPROVAL: { label: 'Pendiente revision', tone: 'border-warn/30 bg-warn-dim text-warn', icon: FileCheck2 },
  APPROVED: { label: 'Aprobada', tone: 'border-ok/30 bg-ok-dim text-ok', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', tone: 'border-danger/30 bg-danger-dim text-danger', icon: XCircle },
  SKIPPED: { label: 'Omitida', tone: 'border-neutral-300 text-ds-muted', icon: RotateCcw },
  POSTPONED: { label: 'Postergada', tone: 'border-warn/30 bg-warn-dim text-warn', icon: RotateCcw },
};

const OUTCOME_COPY: Record<ExecutionOutcome, string> = {
  DONE: 'Hecha',
  DONE_WITH_OBSERVATIONS: 'Con observaciones',
  NOT_DONE: 'No realizada',
};

export function ExecutionPanel({ psr, canWrite }: { psr: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OperationalExecutionStatus | ''>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<OperationalExecution | null>(null);

  const params = useMemo(() => {
    const next = new URLSearchParams();
    next.set('psr', psr);
    next.set('take', '200');
    if (status) next.set('status', status);
    if (q.trim()) next.set('q', q.trim());
    return next.toString();
  }, [psr, q, status]);

  const executions = useQuery({
    queryKey: ['operational-executions', params],
    queryFn: () => api<OperationalExecutionList>(`/api/ejecuciones?${params}`),
    refetchInterval: 60_000,
  });

  const rows = executions.data?.rows ?? [];
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.hhPlan += row.hhPlan;
          acc.pendingReview += row.status === 'DONE_PENDING_APPROVAL' ? 1 : 0;
          acc.missingEvidence += row.evidenceCount === 0 && row.status !== 'SCHEDULED' ? 1 : 0;
          return acc;
        },
        { hhPlan: 0, pendingReview: 0, missingEvidence: 0 },
      ),
    [rows],
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['operational-executions'] });
    queryClient.invalidateQueries({ queryKey: ['plant-detail'] });
    queryClient.invalidateQueries({ queryKey: ['plants-operational'] });
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryPill label="Ejecuciones" value={executions.data?.total ?? rows.length} />
        <SummaryPill label="HH plan" value={HH.format(totals.hhPlan)} />
        <SummaryPill label="Revision/evidencia" value={`${totals.pendingReview}/${totals.missingEvidence}`} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-muted" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar intervencion o equipo" className="pl-9" />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as OperationalExecutionStatus | '')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_COPY).map(([value, item]) => (
            <option key={value} value={value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {executions.isError ? (
        <ErrorBox error={executions.error} />
      ) : executions.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
          <p className="text-sm font-medium text-text">Sin ejecuciones para este filtro</p>
          <p className="mt-1 text-sm text-ds-muted">Genera ejecuciones desde el plan de mantencion para comenzar a registrar trabajo real.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((execution) => (
            <ExecutionCard
              key={execution.id}
              execution={execution}
              canWrite={canWrite}
              selected={selected?.id === execution.id}
              onSelect={() => setSelected((current) => (current?.id === execution.id ? null : execution))}
            />
          ))}
        </div>
      )}

      {selected && (
        <ExecutionWorkPanel
          execution={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refresh();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ds-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text tabular-nums">{value}</p>
    </div>
  );
}

function ExecutionCard({
  execution,
  canWrite,
  selected,
  onSelect,
}: {
  execution: OperationalExecution;
  canWrite: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = STATUS_COPY[execution.status];
  const StateIcon = state.icon;
  return (
    <article className={`rounded-xl border bg-[var(--color-surface)] p-4 transition-colors ${selected ? 'border-ds-accent' : 'border-[var(--color-border)]'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={state.tone}>
              <StateIcon data-icon="inline-start" />
              {state.label}
            </Badge>
            <Badge variant="outline">ABC {execution.planTask.abc || '-'}</Badge>
            {execution.evidenceCount === 0 && execution.status !== 'SCHEDULED' && (
              <Badge variant="outline" className="border-warn/30 bg-warn-dim text-warn">
                <AlertTriangle data-icon="inline-start" />
                Evidencia faltante
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-text">{execution.planTask.description}</h3>
          <p className="mt-1 text-xs text-ds-muted">
            {execution.planTask.equipment?.name || 'Sin equipo especifico'} · vence {DATE.format(new Date(execution.dueDate))}
          </p>
          {execution.rejectedReason && <p className="mt-2 text-xs text-danger">Rechazo: {execution.rejectedReason}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="text-right text-sm">
            <p className="font-semibold text-text">{HH.format(execution.hhActual ?? execution.hhPlan)} HH</p>
            <p className="text-xs text-ds-muted">plan {HH.format(execution.hhPlan)}</p>
          </div>
          <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} onClick={onSelect}>
            {canWrite ? <FileCheck2 data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            {canWrite ? 'Operar' : 'Ver'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ExecutionWorkPanel({
  execution,
  canWrite,
  onClose,
  onChanged,
}: {
  execution: OperationalExecution;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [outcome, setOutcome] = useState<ExecutionOutcome>('DONE');
  const [doneDate, setDoneDate] = useState(toInputDate(new Date()));
  const [hhActual, setHhActual] = useState(String(execution.hhActual ?? execution.hhPlan));
  const [comment, setComment] = useState(execution.comment ?? '');
  const [skipReason, setSkipReason] = useState(execution.skipReason ?? '');
  const [postponedTo, setPostponedTo] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setOutcome(execution.outcome ?? 'DONE');
    setDoneDate(toInputDate(execution.doneDate ? new Date(execution.doneDate) : new Date()));
    setHhActual(String(execution.hhActual ?? execution.hhPlan));
    setComment(execution.comment ?? '');
    setSkipReason(execution.skipReason ?? '');
    setPostponedTo(execution.postponedTo ? toInputDate(new Date(execution.postponedTo)) : '');
    setFiles([]);
    setRejectReason('');
  }, [execution]);

  const register = useMutation({
    mutationFn: async () => {
      await api(`/api/ejecuciones/${execution.id}/registrar`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          doneDate,
          hhActual: outcome === 'NOT_DONE' ? undefined : Number(hhActual),
          comment: comment.trim() || undefined,
          skipReason: outcome === 'NOT_DONE' ? skipReason.trim() || undefined : undefined,
          postponedTo: outcome === 'NOT_DONE' && postponedTo ? postponedTo : undefined,
          skipWithoutReschedule: outcome === 'NOT_DONE' && !postponedTo ? true : undefined,
        }),
      });

      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        if (comment.trim()) body.append('description', comment.trim());
        await api(`/api/ejecuciones/${execution.id}/evidencias`, { method: 'POST', body });
      }
    },
    onSuccess: onChanged,
  });

  const start = useMutation({
    mutationFn: () => api(`/api/ejecuciones/${execution.id}/iniciar`, { method: 'POST' }),
    onSuccess: onChanged,
  });

  const approve = useMutation({
    mutationFn: () => api(`/api/ejecuciones/${execution.id}/aprobar`, { method: 'POST' }),
    onSuccess: onChanged,
  });

  const reject = useMutation({
    mutationFn: () =>
      api(`/api/ejecuciones/${execution.id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      }),
    onSuccess: onChanged,
  });

  const reopen = useMutation({
    mutationFn: () =>
      api(`/api/ejecuciones/${execution.id}/reabrir`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason || 'Reabierta desde UI para nueva revision' }),
      }),
    onSuccess: onChanged,
  });

  const removeEvidence = useMutation({
    mutationFn: (evidenceId: string) => api(`/api/evidencias/${evidenceId}`, { method: 'DELETE' }),
    onSuccess: onChanged,
  });

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  return (
    <section className="rounded-xl border border-ds-accent/30 bg-accent-dim/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ds-muted">Registro de ejecucion</p>
          <h3 className="text-base font-semibold text-text">{execution.planTask.description}</h3>
          <p className="mt-1 text-sm text-ds-muted">
            {execution.planTask.plant.name} · {execution.planTask.equipment?.name || 'Sin equipo'} · {HH.format(execution.hhPlan)} HH plan
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {execution.evidence.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="text-xs font-medium text-ds-muted">Evidencia cargada</p>
          <div className="flex flex-col gap-2">
            {execution.evidence.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
                <a
                  href={`${API_URL}/api/evidencias/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-xs text-text transition-colors hover:text-ds-accent"
                >
                  <Paperclip data-icon="inline-start" />
                  <span className="truncate">{item.originalName || item.filename}</span>
                </a>
                {canWrite && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger-dim"
                    disabled={removeEvidence.isPending}
                    onClick={() => {
                      if (confirm(`Eliminar evidencia "${item.originalName ?? item.filename}"? Quedara registrado en auditoria.`)) {
                        removeEvidence.mutate(item.id);
                      }
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Eliminar
                  </Button>
                )}
              </div>
            ))}
          </div>
          {removeEvidence.isError && <ErrorBox error={removeEvidence.error} />}
        </div>
      )}

      {canWrite ? (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            register.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(['DONE', 'DONE_WITH_OBSERVATIONS', 'NOT_DONE'] as ExecutionOutcome[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  outcome === value
                    ? 'border-ds-accent bg-[var(--color-surface)] text-ds-accent'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-ds-muted hover:text-text'
                }`}
              >
                {OUTCOME_COPY[value]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fecha real">
              <Input type="date" value={doneDate} onChange={(event) => setDoneDate(event.target.value)} required />
            </Field>
            <Field label="HH real">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={hhActual}
                onChange={(event) => setHhActual(event.target.value)}
                disabled={outcome === 'NOT_DONE'}
                required={outcome !== 'NOT_DONE'}
              />
            </Field>
            <Field label="Evidencia">
              <Input type="file" accept="image/*,application/pdf,video/mp4" multiple onChange={onFiles} />
            </Field>
          </div>

          {outcome === 'NOT_DONE' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Motivo">
                <Input value={skipReason} onChange={(event) => setSkipReason(event.target.value)} required placeholder="Sin ventana, equipo detenido, repuesto pendiente..." />
              </Field>
              <Field label="Reprogramar para">
                <Input type="date" value={postponedTo} onChange={(event) => setPostponedTo(event.target.value)} />
              </Field>
            </div>
          )}

          <Field label={outcome === 'DONE_WITH_OBSERVATIONS' ? 'Comentario obligatorio' : 'Comentario'}>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required={outcome === 'DONE_WITH_OBSERVATIONS'}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Observaciones, causa, condicion encontrada o descripcion de evidencia"
            />
          </Field>

          {outcome !== 'NOT_DONE' && (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-ds-muted">
              Al guardar, la ejecución queda como <span className="font-medium text-text">pendiente de revisión</span>. La aprobación es una acción explícita posterior desde la bandeja Revisiones.
            </p>
          )}

          {files.length > 0 && (
            <p className="text-xs text-ds-muted">
              {files.length} archivo(s) seleccionados. Se suben despues de guardar el registro.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={register.isPending}>
              <FileCheck2 data-icon="inline-start" />
              {register.isPending ? 'Guardando...' : 'Guardar registro'}
            </Button>
          </div>
          {register.isError && <ErrorBox error={register.error} />}
        </form>
      ) : (
        <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-ds-muted">
          Tu rol actual permite revisar esta ejecucion, pero no modificarla.
        </p>
      )}

      {canWrite && (execution.status === 'SCHEDULED' || execution.status === 'POSTPONED') && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ds-muted">
            ¿La cuadrilla ya está en terreno? Marca <span className="font-medium text-text">en curso</span> para visibilidad operacional.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => start.mutate()} disabled={start.isPending}>
            <Clock3 data-icon="inline-start" />
            {start.isPending ? 'Iniciando...' : 'Iniciar ejecución'}
          </Button>
        </div>
      )}

      {canWrite && (execution.status === 'DONE_PENDING_APPROVAL' || execution.status === 'REJECTED' || execution.status === 'APPROVED') && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="text-sm font-semibold text-text">Revision</p>
          <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Motivo para rechazar o reabrir" />
          <div className="flex flex-wrap gap-2">
            {(execution.status === 'DONE_PENDING_APPROVAL' || execution.status === 'REJECTED') && (
              <Button type="button" size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                <CheckCircle2 data-icon="inline-start" />
                Aprobar
              </Button>
            )}
            {execution.status === 'DONE_PENDING_APPROVAL' && (
              <Button type="button" size="sm" variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending || !rejectReason.trim()}>
                <XCircle data-icon="inline-start" />
                Rechazar
              </Button>
            )}
            {execution.status === 'APPROVED' && (
              <Button type="button" size="sm" variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
                <RotateCcw data-icon="inline-start" />
                Reabrir
              </Button>
            )}
          </div>
          {approve.isError && <ErrorBox error={approve.error} />}
          {reject.isError && <ErrorBox error={reject.error} />}
          {reopen.isError && <ErrorBox error={reopen.error} />}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ds-muted">{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError && typeof error.body === 'object' && error.body && 'message' in error.body
      ? String((error.body as { message?: unknown }).message)
      : 'No se pudo completar la accion.';
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileCheck2,
  Paperclip,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ReviewBucket = 'PENDING' | 'REJECTED' | 'APPROVED';

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
  uploadedAt: string;
  sha256: string;
}

interface ReviewExecution {
  id: string;
  dueDate: string;
  doneDate: string | null;
  status: OperationalExecutionStatus;
  hhPlan: number;
  hhActual: number | null;
  comment: string | null;
  rejectedReason: string | null;
  registeredAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  evidenceCount: number;
  evidence: EvidenceRow[];
  planTask: {
    id: string;
    abc: string | null;
    description: string;
    equipment: { id: string; name: string } | null;
    plant: { id: string; psr: string; name: string; area: string | null };
  };
}

interface ReviewList {
  rows: ReviewExecution[];
  total: number;
}

interface MeResponse {
  role: string;
}

const BUCKET_TO_STATUS: Record<ReviewBucket, OperationalExecutionStatus> = {
  PENDING: 'DONE_PENDING_APPROVAL',
  REJECTED: 'REJECTED',
  APPROVED: 'APPROVED',
};

const BUCKET_LABEL: Record<ReviewBucket, string> = {
  PENDING: 'Pendientes',
  REJECTED: 'Rechazadas',
  APPROVED: 'Aprobadas recientes',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function RevisionesPage() {
  const queryClient = useQueryClient();
  const [bucket, setBucket] = useState<ReviewBucket>('PENDING');
  const [q, setQ] = useState('');
  const [abc, setAbc] = useState('');
  const [onlyMissingEvidence, setOnlyMissingEvidence] = useState(false);
  const [minDeviationPct, setMinDeviationPct] = useState<string>('');

  const me = useQuery({
    queryKey: ['me-revisiones'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
  });
  const canWrite = me.data?.role === 'SUPERADMIN';

  const params = useMemo(() => {
    const next = new URLSearchParams();
    next.set('status', BUCKET_TO_STATUS[bucket]);
    next.set('take', '200');
    if (q.trim()) next.set('q', q.trim());
    if (abc.trim()) next.set('abc', abc.trim().toUpperCase());
    return next.toString();
  }, [bucket, q, abc]);

  const list = useQuery({
    queryKey: ['review-queue', params],
    queryFn: () => api<ReviewList>(`/api/ejecuciones?${params}`),
    refetchInterval: 60_000,
  });

  const rows = list.data?.rows ?? [];

  const filtered = useMemo(() => {
    const minPct = Number(minDeviationPct);
    return rows.filter((row) => {
      if (onlyMissingEvidence && row.evidenceCount > 0) return false;
      if (Number.isFinite(minPct) && minPct > 0) {
        if (row.hhActual === null || row.hhPlan === 0) return false;
        const pct = Math.abs(row.hhActual - row.hhPlan) / row.hhPlan * 100;
        if (pct < minPct) return false;
      }
      return true;
    });
  }, [rows, onlyMissingEvidence, minDeviationPct]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.hhPlan += row.hhPlan;
        acc.hhActual += row.hhActual ?? 0;
        acc.missingEvidence += row.evidenceCount === 0 ? 1 : 0;
        return acc;
      },
      { hhPlan: 0, hhActual: 0, missingEvidence: 0 },
    );
  }, [filtered]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    queryClient.invalidateQueries({ queryKey: ['operational-executions'] });
    queryClient.invalidateQueries({ queryKey: ['plant-detail'] });
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ds-muted">Control operacional</p>
        <h1 className="text-xl font-semibold text-text">Bandeja de revisiones</h1>
        <p className="text-sm text-ds-muted">
          Aprueba, rechaza o reabre cierres operacionales con motivo. Cada accion deja registro en auditoria.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-4">
        <SummaryPill label="En bandeja" value={list.data?.total ?? rows.length} />
        <SummaryPill label="Visibles" value={filtered.length} />
        <SummaryPill label="Sin evidencia" value={totals.missingEvidence} tone={totals.missingEvidence > 0 ? 'warn' : undefined} />
        <SummaryPill label="HH plan / real" value={`${HH.format(totals.hhPlan)} / ${HH.format(totals.hhActual)}`} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['PENDING', 'REJECTED', 'APPROVED'] as ReviewBucket[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBucket(value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                bucket === value
                  ? 'border-ds-accent bg-accent-dim text-ds-accent'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-ds-muted hover:text-text'
              }`}
            >
              {BUCKET_LABEL[value]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-muted" />
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar planta, PSR, intervencion o equipo" className="pl-9" />
          </label>
          <select
            value={abc}
            onChange={(event) => setAbc(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">ABC: todos</option>
            <option value="A">ABC A</option>
            <option value="B">ABC B</option>
            <option value="C">ABC C</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
            <input
              type="checkbox"
              className="size-4"
              checked={onlyMissingEvidence}
              onChange={(event) => setOnlyMissingEvidence(event.target.checked)}
            />
            Solo sin evidencia
          </label>
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
            Desviacion HH minima %
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="5"
              value={minDeviationPct}
              onChange={(event) => setMinDeviationPct(event.target.value)}
              className="h-8 w-20"
            />
          </label>
        </div>
      </div>

      {list.isError ? (
        <ErrorBox error={list.error} />
      ) : list.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState bucket={bucket} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => (
            <ReviewRow key={row.id} execution={row} canWrite={canWrite} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone === 'warn' ? 'border-warn/30 bg-warn-dim' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ds-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'warn' ? 'text-warn' : 'text-text'}`}>{value}</p>
    </div>
  );
}

function EmptyState({ bucket }: { bucket: ReviewBucket }) {
  const message =
    bucket === 'PENDING'
      ? 'Sin cierres pendientes de revision con los filtros actuales.'
      : bucket === 'REJECTED'
        ? 'Sin ejecuciones rechazadas con los filtros actuales.'
        : 'Sin aprobaciones recientes con los filtros actuales.';
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
      <ClipboardCheck className="mx-auto size-6 text-ds-muted" />
      <p className="mt-2 text-sm font-medium text-text">Bandeja vacia</p>
      <p className="mt-1 text-sm text-ds-muted">{message}</p>
    </div>
  );
}

function ReviewRow({
  execution,
  canWrite,
  onChanged,
}: {
  execution: ReviewExecution;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState('');

  const approve = useMutation({
    mutationFn: () => api(`/api/ejecuciones/${execution.id}/aprobar`, { method: 'POST' }),
    onSuccess: onChanged,
  });
  const reject = useMutation({
    mutationFn: () =>
      api(`/api/ejecuciones/${execution.id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: onChanged,
  });
  const reopen = useMutation({
    mutationFn: () =>
      api(`/api/ejecuciones/${execution.id}/reabrir`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || 'Reabierta para nueva revision' }),
      }),
    onSuccess: onChanged,
  });

  const deviationPct =
    execution.hhActual !== null && execution.hhPlan > 0
      ? Math.round(((execution.hhActual - execution.hhPlan) / execution.hhPlan) * 100)
      : null;

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">PSR {execution.planTask.plant.psr}</Badge>
            <Badge variant="outline">ABC {execution.planTask.abc || '-'}</Badge>
            {execution.evidenceCount === 0 && (
              <Badge variant="outline" className="border-warn/30 bg-warn-dim text-warn">
                <AlertTriangle data-icon="inline-start" />
                Evidencia faltante
              </Badge>
            )}
            {deviationPct !== null && Math.abs(deviationPct) >= 20 && (
              <Badge variant="outline" className="border-danger/30 bg-danger-dim text-danger">
                Desviacion {deviationPct}%
              </Badge>
            )}
            {execution.status === 'REJECTED' && (
              <Badge variant="outline" className="border-danger/30 bg-danger-dim text-danger">
                <XCircle data-icon="inline-start" />
                Rechazada
              </Badge>
            )}
            {execution.status === 'APPROVED' && (
              <Badge variant="outline" className="border-ok/30 bg-ok-dim text-ok">
                <CheckCircle2 data-icon="inline-start" />
                Aprobada
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-text">{execution.planTask.description}</h3>
          <p className="mt-1 text-xs text-ds-muted">
            {execution.planTask.plant.name}
            {execution.planTask.plant.area ? ` · ${execution.planTask.plant.area}` : ''}
            {execution.planTask.equipment?.name ? ` · ${execution.planTask.equipment.name}` : ''}
          </p>
          <p className="mt-1 text-xs text-ds-muted">
            Vence {DATE.format(new Date(execution.dueDate))}
            {execution.doneDate ? ` · ejecutada ${DATE.format(new Date(execution.doneDate))}` : ''}
            {execution.registeredAt ? ` · registrada ${DATE.format(new Date(execution.registeredAt))}` : ''}
          </p>
          {execution.comment && <p className="mt-2 text-xs text-ds-muted"><span className="font-medium text-text">Comentario:</span> {execution.comment}</p>}
          {execution.rejectedReason && <p className="mt-1 text-xs text-danger"><span className="font-medium">Rechazo previo:</span> {execution.rejectedReason}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right text-sm">
            <p className="font-semibold text-text">
              {execution.hhActual === null ? '-' : HH.format(execution.hhActual)} HH real
            </p>
            <p className="text-xs text-ds-muted">plan {HH.format(execution.hhPlan)}</p>
          </div>
        </div>
      </div>

      {execution.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {execution.evidence.map((item) => (
            <a
              key={item.id}
              href={`${API_URL}/api/evidencias/${item.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 text-xs text-text transition-colors hover:border-ds-accent"
            >
              <Paperclip data-icon="inline-start" />
              {item.originalName || item.filename}
            </a>
          ))}
        </div>
      )}

      {canWrite ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:flex-row sm:items-center">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              execution.status === 'APPROVED'
                ? 'Motivo para reabrir'
                : 'Motivo para rechazar (obligatorio si rechazas)'
            }
            className="flex-1"
          />
          <div className="flex flex-wrap gap-2">
            {(execution.status === 'DONE_PENDING_APPROVAL' || execution.status === 'REJECTED') && (
              <Button type="button" size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                <CheckCircle2 data-icon="inline-start" />
                Aprobar
              </Button>
            )}
            {execution.status === 'DONE_PENDING_APPROVAL' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => reject.mutate()}
                disabled={reject.isPending || !reason.trim()}
              >
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
        </div>
      ) : (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-ds-muted">
          <Eye data-icon="inline-start" />
          Tu rol permite ver, no modificar.
        </p>
      )}

      {(approve.isError || reject.isError || reopen.isError) && (
        <ErrorBox error={approve.error ?? reject.error ?? reopen.error} />
      )}
      {approve.isSuccess || reject.isSuccess || reopen.isSuccess ? (
        <p role="status" className="mt-2 inline-flex items-center gap-2 rounded-md border border-ok/30 bg-ok-dim px-3 py-1.5 text-xs text-ok">
          <FileCheck2 data-icon="inline-start" />
          Cambio registrado en auditoria.
        </p>
      ) : null}
    </article>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError && typeof error.body === 'object' && error.body && 'message' in error.body
      ? String((error.body as { message?: unknown }).message)
      : 'No se pudo completar la accion.';
  return (
    <p role="alert" className="mt-2 rounded-md border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

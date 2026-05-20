'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { KpiCard } from '../_components/KpiCard';

const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const NUMBER_FORMAT = new Intl.NumberFormat('es-CL');

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string;
  userAgent: string;
  prevHash: string;
  hash: string;
  createdAt: string;
}

interface AuditVerify {
  ok: boolean;
  count?: number;
  brokenAt?: string;
}

interface AuditPage {
  items: AuditRow[];
  nextCursor: string | null;
}

const ACTIONS = [
  '',
  'AI_INSIGHT',
  'AI_CHART',
  'AI_SEARCH',
  'EXCEL_IMPORT',
  'SCHEDULE_REBUILD',
  'TOTP_VERIFY_FAIL',
  'TOTP_VERIFY_OK',
  'PASSWORD_CHANGED',
];

export default function AuditoriaPage() {
  const [action, setAction] = useState('');
  const [take, setTake] = useState(100);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('take', String(take));
    if (action) p.set('action', action);
    return p;
  }, [action, take]);

  const auditQuery = useInfiniteQuery({
    queryKey: ['audit', baseParams.toString()],
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      const p = new URLSearchParams(baseParams);
      if (pageParam) p.set('cursor', pageParam);
      return api<AuditPage>(`/api/audit?${p.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const auditItems = useMemo(
    () => auditQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [auditQuery.data],
  );
  const verifyQuery = useQuery({
    queryKey: ['audit-verify'],
    queryFn: () => api<AuditVerify>('/api/audit/verify'),
    refetchInterval: 60_000,
  });

  const isForbidden =
    auditQuery.error instanceof ApiError &&
    (auditQuery.error.status === 401 || auditQuery.error.status === 403);

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Auditoría</p>
          <h1 className="text-2xl font-semibold text-text">Trazabilidad hash-chain</h1>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <label className="flex flex-col gap-1 text-xs text-ds-muted">
            Acción
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-text"
            >
              {ACTIONS.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item || 'Todas'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ds-muted">
            Límite
            <select
              value={take}
              onChange={(event) => setTake(Number(event.target.value))}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-text"
            >
              {[50, 100, 250, 500].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          title="Integridad cadena"
          value={verifyQuery.data?.ok ? 'OK' : verifyQuery.data ? 'Rota' : '—'}
          tone={verifyQuery.data?.ok ? 'ok' : verifyQuery.data ? 'danger' : 'neutral'}
          loading={verifyQuery.isLoading}
        />
        <KpiCard title="Eventos verificados" value={verifyQuery.data?.count != null ? NUMBER_FORMAT.format(verifyQuery.data.count) : '—'} tone="accent" loading={verifyQuery.isLoading} />
        <KpiCard title="Eventos listados" value={auditQuery.data ? NUMBER_FORMAT.format(auditItems.length) : '—'} loading={auditQuery.isLoading} />
      </div>

      {verifyQuery.data && !verifyQuery.data.ok && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
          <ShieldAlert className="mt-0.5 size-4" />
          Cadena de auditoría rota en evento {verifyQuery.data.brokenAt ?? 'desconocido'}.
        </div>
      )}

      {verifyQuery.data?.ok && (
        <div className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok-dim px-4 py-3 text-sm text-ok">
          <ShieldCheck className="mt-0.5 size-4" />
          La cadena hash está consistente desde `GENESIS` hasta el último evento.
        </div>
      )}

      {isForbidden && (
        <div className="rounded-xl border border-warn/30 bg-warn-dim px-4 py-3 text-sm text-warn">
          Tu rol no tiene permiso para ver auditoría. Requiere ADMIN o SUPERADMIN.
        </div>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-ds-muted">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2 text-left">Entidad</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Hash</th>
              </tr>
            </thead>
            <tbody>
              {auditQuery.isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-ds-muted">Cargando…</td></tr>
              )}
              {!auditQuery.isLoading && !auditQuery.isError && auditItems.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-ds-muted">Sin eventos para el filtro seleccionado.</td></tr>
              )}
              {!auditQuery.isLoading && !auditQuery.isError && auditItems.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-border)] hover:bg-accent-dim/40">
                  <td className="whitespace-nowrap px-3 py-2">{DATE_FORMAT.format(new Date(row.createdAt))}</td>
                  <td className="px-3 py-2 font-medium text-text">{row.action}</td>
                  <td className="px-3 py-2 text-ds-muted">{row.entity ?? '—'} {row.entityId ? `· ${row.entityId.slice(0, 8)}` : ''}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.userId?.slice(0, 10) ?? 'Sistema'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.ip}</td>
                  <td className="px-3 py-2 font-mono text-xs" title={row.hash}>{row.hash.slice(0, 14)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditQuery.hasNextPage && (
          <div className="border-t border-[var(--color-border)] p-3 text-center">
            <button
              type="button"
              onClick={() => auditQuery.fetchNextPage()}
              disabled={auditQuery.isFetchingNextPage}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50 min-h-[40px]"
            >
              {auditQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

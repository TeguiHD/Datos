'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

interface ImportRun {
  id: string;
  filename: string;
  rowsTotal: number;
  rowsOk: number;
  rowsErr: number;
  status: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export default function AdminPage() {
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: ['imports'],
    queryFn: () => api<ImportRun[]>('/api/admin/imports'),
  });
  const totpFailQuery = useQuery({
    queryKey: ['audit-2fa-fail'],
    queryFn: () => api<AuditRow[]>('/api/audit?action=TOTP_VERIFY_FAIL&take=20'),
  });
  const totpOkQuery = useQuery({
    queryKey: ['audit-2fa-ok'],
    queryFn: () => api<AuditRow[]>('/api/audit?action=TOTP_VERIFY_OK&take=20'),
  });
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const is2faError =
    error instanceof ApiError &&
    error.status === 403 &&
    (error.body as { message?: string })?.message === '2FA required';

  const auditEvents = [...(totpFailQuery.data ?? []), ...(totpOkQuery.data ?? [])]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 20);
  const failCount = totpFailQuery.data?.length ?? 0;
  const okCount = totpOkQuery.data?.length ?? 0;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const json = await api<{ ok: number; err: number }>('/api/admin/import', {
        method: 'POST',
        body: fd,
      });
      setMsg(`OK: ${json.ok} filas (${json.err} errores)`);
      refetch();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setMsg('Sesión o CSRF inválido, recarga la página');
      else setMsg('Error al importar');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-semibold">Administración</h1>
      {is2faError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Debes completar verificación 2FA para usar herramientas administrativas.
        </div>
      )}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Importar Excel SAP PM</h2>
        <input type="file" accept=".xlsx" onChange={handleUpload} disabled={uploading} />
        {uploading && <p className="text-sm text-slate-500">Procesando…</p>}
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Recalcular planificación</h2>
        <p className="text-xs text-slate-500">
          Regenera proyecciones y ejecuciones futuras a partir de las reglas de frecuencia (mesInicio + frecuenciaMeses).
          Idempotente. Marca discrepancias entre Excel y motor calculado.
        </p>
        <button
          onClick={async () => {
            setMsg(null);
            try {
              const r = await api<{ tasksProcessed: number; discrepancies: number; executionsCreated: number; horizonYear: number }>(
                '/api/schedule/rebuild',
                { method: 'POST' },
              );
              setMsg(
                `Rebuild OK · ${r.tasksProcessed} tareas · ${r.executionsCreated} ejecuciones nuevas · ${r.discrepancies} discrepancias · horizonte ${r.horizonYear}`,
              );
            } catch (e) {
              setMsg(e instanceof ApiError ? `Error ${e.status}` : 'Error desconocido');
            }
          }}
          className="bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700"
        >
          Recalcular ahora
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Intentos 2FA recientes</h2>
          <span className="text-xs text-slate-500">OK: {okCount} · FAIL: {failCount}</span>
        </div>

        {(totpFailQuery.isLoading || totpOkQuery.isLoading) && <p className="text-sm text-slate-500">Cargando auditoría 2FA...</p>}

        {(totpFailQuery.isError || totpOkQuery.isError) && (
          <p className="text-sm text-red-700">No se pudo cargar auditoría de intentos 2FA.</p>
        )}

        {!totpFailQuery.isLoading && !totpOkQuery.isLoading && !totpFailQuery.isError && !totpOkQuery.isError && auditEvents.length === 0 && (
          <p className="text-sm text-slate-500">Sin intentos recientes registrados.</p>
        )}

        {!totpFailQuery.isError && !totpOkQuery.isError && auditEvents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Resultado</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((evt) => (
                  <tr key={evt.id} className="border-t">
                    <td className="px-3 py-2">{new Date(evt.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          evt.action === 'TOTP_VERIFY_OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {evt.action === 'TOTP_VERIFY_OK' ? 'OK' : 'FAIL'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{evt.ip}</td>
                    <td className="px-3 py-2 font-mono text-xs">{evt.userId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto transition-shadow duration-200 hover:shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Archivo</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">OK</th>
              <th className="px-3 py-2 text-right">Err</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t">
                  <td colSpan={6} className="px-3 py-2">
                    <div className="skeleton h-8 w-full rounded-md" />
                  </td>
                </tr>
              ))}
            {!isLoading && isError && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-red-700">
                  No se pudieron cargar corridas de importación.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Sin importaciones registradas.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.filename}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.rowsTotal}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700">{r.rowsOk}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700">{r.rowsErr}</td>
                <td className="px-3 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

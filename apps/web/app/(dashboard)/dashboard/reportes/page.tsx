'use client';

import { useState } from 'react';
import { FileDown, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { makeIdempotencyKey } from '@/lib/offline/outbox';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function csrfHeader(): Promise<Record<string, string>> {
  const res = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) return {};
  const data = (await res.json()) as { token?: string };
  return data.token ? { 'x-csrf-token': data.token } : {};
}

interface VerifyResult {
  ok: boolean;
  id: string;
  generatedAt: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  scope: string;
  params: { year: number; month: number; plantId: string | null };
}

export default function ReportesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [plantId, setPlantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<{ id: string; sha256: string; signature: string; filename: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'idempotency-key': makeIdempotencyKey(),
        ...(await csrfHeader()),
      };
      const res = await fetch(`${API_URL}/api/reports/monthly`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ year, month, plantId: plantId || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new ApiError(res.status, body.message ?? 'Error generando reporte', body);
      }
      const id = res.headers.get('x-report-id') ?? '';
      const sha256 = res.headers.get('x-report-sha256') ?? '';
      const signature = res.headers.get('x-report-signature') ?? '';
      const blob = await res.blob();
      const filename = (res.headers.get('content-disposition') ?? '').match(/filename="([^"]+)"/)?.[1] ?? `report-${year}-${month}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setLastReport({ id, sha256, signature, filename });
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status} · ${e.message}` : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!verifyId) return;
    setVerifying(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/reports/${verifyId}/verify`, { credentials: 'include' });
      if (!res.ok) {
        setVerifyResult(null);
        throw new ApiError(res.status, 'No se pudo verificar');
      }
      setVerifyResult(await res.json());
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status} · ${e.message}` : 'Error desconocido');
    } finally {
      setVerifying(false);
    }
  }

  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];

  return (
    <div className="space-y-5 fade-up">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Reportería</p>
        <h1 className="text-2xl font-semibold text-text">Informes firmados</h1>
        <p className="mt-1 max-w-2xl text-sm text-ds-muted">
          Genera un CSV firmado por mes/planta. El archivo incluye SHA-256 + HMAC para verificar autenticidad después.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Año
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.getUTCFullYear())}
              min={2020}
              max={2099}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Mes
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px]"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ds-muted flex flex-col gap-1">
            Planta (opcional, ID)
            <input
              value={plantId}
              onChange={(e) => setPlantId(e.target.value.trim())}
              placeholder="todas"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] font-mono"
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            <FileDown className="size-4" aria-hidden />
            {busy ? 'Generando…' : 'Generar y descargar'}
          </button>
        </div>

        {err && <p role="alert" className="rounded-md border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">{err}</p>}

        {lastReport && (
          <div className="rounded-md border border-ok/30 bg-ok-dim px-3 py-2 text-sm text-ok">
            <p className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden />Reporte <span className="font-mono">{lastReport.filename}</span> descargado.</p>
            <p className="mt-1 text-xs font-mono break-all">id: {lastReport.id}</p>
            <p className="mt-0.5 text-xs font-mono break-all">sha256: {lastReport.sha256}</p>
            <p className="mt-0.5 text-xs font-mono break-all">sig: {lastReport.signature}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-semibold text-text">Verificar reporte previo</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-ds-muted flex flex-col gap-1">
            ID del reporte
            <input
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value.trim())}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm min-h-[44px] font-mono"
              placeholder="cln..."
            />
          </label>
          <button
            type="button"
            onClick={verify}
            disabled={verifying || !verifyId}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50 min-h-[44px]"
          >
            {verifying ? 'Verificando…' : 'Verificar firma'}
          </button>
        </div>
        {verifyResult && (
          <div className={`rounded-md border px-3 py-2 text-sm ${verifyResult.ok ? 'border-ok/30 bg-ok-dim text-ok' : 'border-danger/30 bg-danger-dim text-danger'}`}>
            <p className="flex items-center gap-2 font-medium">
              {verifyResult.ok ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />}
              {verifyResult.ok ? 'Firma válida' : 'Firma inválida o sha256 no coincide'}
            </p>
            <p className="mt-1 text-xs">Generado: {new Date(verifyResult.generatedAt).toLocaleString('es-CL')}</p>
            <p className="text-xs">Archivo: <span className="font-mono">{verifyResult.filename}</span> · {(verifyResult.sizeBytes / 1024).toFixed(1)} KB</p>
            <p className="text-xs font-mono break-all">sha256: {verifyResult.sha256}</p>
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { KpiCard } from '../_components/KpiCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const NUMBER_FORMAT = new Intl.NumberFormat('es-CL');
const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface ImportPreview {
  filename: string;
  fileHash: string;
  totalRows: number;
  scheduleCells: number;
  existingRows: number;
  newRows: number;
  duplicateRowsInFile: number;
  issues: string[];
  sample: Array<{
    psr: string | null;
    centroPlanificacion: string | null;
    indicadorAbc: string | null;
    frecuenciaCodigo: string | null;
    hhReal: number | null;
    descripcion: string | null;
    scheduleCount: number;
  }>;
}

interface ImportRun {
  id: string;
  filename: string;
  rowsTotal: number;
  rowsOk: number;
  rowsErr: number;
  status: string;
  createdAt: string;
}

const MAPPING = [
  ['PSR', 'psr'],
  ['Centro planificación', 'centroPlanificacion'],
  ['Indicador ABC', 'indicadorAbc'],
  ['Frecuencia', 'frecuenciaCodigo / frecuenciaMeses'],
  ['HH Real', 'hhReal'],
  ['ene-26, feb-26…', 'MonthlySchedule por mes'],
];

export default function ImportacionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | 'template' | 'export' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ['imports'],
    queryFn: () => api<ImportRun[]>('/api/admin/imports'),
  });

  const lastRun = runsQuery.data?.[0];
  const diffReady = preview && preview.totalRows > 0;

  const health = useMemo(() => {
    if (!preview) return 'Esperando archivo';
    if (preview.issues.length > 0) return 'Revisar advertencias';
    return 'Listo para importar';
  }, [preview]);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setPreview(null);
    setMessage(null);
  }

  async function runPreview() {
    if (!file) return;
    setBusy('preview');
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await api<ImportPreview>('/api/admin/import/preview', { method: 'POST', body: fd });
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof ApiError ? `Error ${error.status}: no se pudo previsualizar.` : 'No se pudo previsualizar.');
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (!file || !preview) return;
    setBusy('import');
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await api<{ ok: number; err: number; total: number }>('/api/admin/import', { method: 'POST', body: fd });
      setMessage(`Importación completada: ${NUMBER_FORMAT.format(result.ok)} OK, ${NUMBER_FORMAT.format(result.err)} errores.`);
      runsQuery.refetch();
    } catch (error) {
      setMessage(error instanceof ApiError ? `Error ${error.status}: no se pudo importar.` : 'No se pudo importar.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadTemplate() {
    setBusy('template');
    try {
      await downloadBlob('/api/admin/import/template', 'plantilla-datos-nicoholas.xlsx');
    } finally {
      setBusy(null);
    }
  }

  async function exportExecutions(format: 'csv' | 'xlsx') {
    setBusy('export');
    try {
      const year = new Date().getUTCFullYear();
      await downloadBlob(
        `/api/schedule/executions/export?yearFrom=${year}&monthFrom=1&yearTo=${year}&monthTo=12&take=5000&format=${format}`,
        `ejecuciones-${year}.${format}`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Importación / Exportación</p>
          <h1 className="text-2xl font-semibold text-text">Plantilla, dry-run y diff preview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={downloadTemplate} disabled={busy != null}>
            <Download className="size-4" />
            Plantilla XLSX
          </Button>
          <Button type="button" variant="outline" onClick={() => exportExecutions('xlsx')} disabled={busy != null}>
            Exportar XLSX
          </Button>
          <Button type="button" variant="outline" onClick={() => exportExecutions('csv')} disabled={busy != null}>
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Estado dry-run" value={health} tone={preview?.issues.length ? 'warn' : preview ? 'ok' : 'neutral'} />
        <KpiCard title="Filas nuevas" value={preview ? NUMBER_FORMAT.format(preview.newRows) : '—'} tone="accent" />
        <KpiCard title="Filas actualizadas" value={preview ? NUMBER_FORMAT.format(preview.existingRows) : '—'} tone="warn" />
        <KpiCard title="Celdas mensuales" value={preview ? NUMBER_FORMAT.format(preview.scheduleCells) : '—'} tone="ok" />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <UploadCloud className="size-5 text-ds-accent" />
            <h2 className="text-sm font-semibold text-text">Subir Excel con validación previa</h2>
          </div>
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <input type="file" accept=".xlsx" onChange={onFile} className="w-full text-sm text-ds-muted" />
            <p className="mt-2 text-xs text-ds-muted">
              Solo `.xlsx`, máximo 10 MB. Primero ejecuta dry-run; la importación real queda bloqueada hasta tener preview válido.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={runPreview} disabled={!file || busy != null}>
              {busy === 'preview' ? 'Analizando…' : 'Dry-run / preview'}
            </Button>
            <Button type="button" variant="default" onClick={runImport} disabled={!diffReady || busy != null}>
              {busy === 'import' ? 'Importando…' : 'Importar cambios'}
            </Button>
          </div>
          {message && <p className="mt-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-text">{message}</p>}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-ds-accent" />
            <h2 className="text-sm font-semibold text-text">Mapper de columnas esperado</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-ds-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Columna plantilla</th>
                  <th className="px-3 py-2 text-left">Campo interno</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map(([source, target]) => (
                  <tr key={source} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium text-text">{source}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ds-muted">{target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {preview && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text">Diff preview</h2>
              <p className="text-xs text-ds-muted">
                {preview.filename} · hash {preview.fileHash.slice(0, 12)} · {NUMBER_FORMAT.format(preview.totalRows)} filas válidas
              </p>
            </div>
            {preview.duplicateRowsInFile > 0 && (
              <span className="rounded-md bg-warn-dim px-2 py-1 text-xs font-medium text-warn">
                {NUMBER_FORMAT.format(preview.duplicateRowsInFile)} duplicadas internas
              </span>
            )}
          </div>
          {preview.issues.length > 0 && (
            <div className="mb-3 space-y-1">
              {preview.issues.map((issue) => (
                <p key={issue} className="rounded-lg bg-warn-dim px-3 py-2 text-sm text-warn">{issue}</p>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-ds-muted">
                <tr>
                  <th className="px-3 py-2 text-left">ABC</th>
                  <th className="px-3 py-2 text-left">PSR</th>
                  <th className="px-3 py-2 text-left">Centro</th>
                  <th className="px-3 py-2 text-left">Frecuencia</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right">Meses con HH</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row, index) => (
                  <tr key={`${row.descripcion}-${index}`} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">{row.indicadorAbc ?? '—'}</td>
                    <td className="px-3 py-2">{row.psr ?? '—'}</td>
                    <td className="px-3 py-2">{row.centroPlanificacion ?? '—'}</td>
                    <td className="px-3 py-2">{row.frecuenciaCodigo ?? '—'}</td>
                    <td className="px-3 py-2">{row.descripcion ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{NUMBER_FORMAT.format(row.scheduleCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-text">Últimas importaciones</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-ds-muted">
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
              {runsQuery.isLoading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-ds-muted">Cargando…</td></tr>
              )}
              {!runsQuery.isLoading && (runsQuery.data ?? []).map((run) => (
                <tr key={run.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">{DATE_FORMAT.format(new Date(run.createdAt))}</td>
                  <td className="px-3 py-2 font-mono text-xs">{run.filename}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{NUMBER_FORMAT.format(run.rowsTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ok">{NUMBER_FORMAT.format(run.rowsOk)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">{NUMBER_FORMAT.format(run.rowsErr)}</td>
                  <td className="px-3 py-2">{run.status}</td>
                </tr>
              ))}
              {!runsQuery.isLoading && !lastRun && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-ds-muted">Sin importaciones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function downloadBlob(path: string, fallbackName: string) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = parseDownloadFilename(response.headers.get('content-disposition')) ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function parseDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return match?.[1] ?? null;
}

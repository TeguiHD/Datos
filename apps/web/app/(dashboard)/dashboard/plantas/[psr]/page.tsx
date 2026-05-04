'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  History,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Video,
  Wrench,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExecutionPanel } from '../_components/ExecutionPanel';

type PlantStatus = 'ACTIVE' | 'INACTIVE';
type EquipmentType = 'MOTOR' | 'PUMP' | 'FILTER' | 'PANEL' | 'OTHER';
type PlanFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';
type OperationalExecutionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE_PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'POSTPONED';

interface MeResponse {
  role: string;
}

interface Equipment {
  id: string;
  type: EquipmentType;
  name: string;
  model: string | null;
  serial: string | null;
  notes: string | null;
}

interface PlanTask {
  id: string;
  equipmentId: string | null;
  equipment?: Equipment | null;
  abc: string | null;
  description: string;
  frequency: PlanFrequency;
  cronExpression: string | null;
  hhPlan: string | number;
  active: boolean;
  executions?: { id: string; dueDate: string; status: OperationalExecutionStatus }[];
}

interface PlantDetail {
  id: string;
  psr: string;
  name: string;
  description: string | null;
  area: string | null;
  color: string | null;
  status: PlantStatus;
  visibleToViewer: boolean;
  equipment: Equipment[];
  planTasks: PlanTask[];
}

interface AuditRow {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  user: { email: string; role: string } | null;
}

interface PlantSummary {
  plant: {
    id: string;
    psr: string;
    name: string;
    description: string | null;
    area: string | null;
    color: string | null;
    status: PlantStatus;
    visibleToViewer: boolean;
    equipmentCount: number;
    planTaskCount: number;
  };
  kpis: {
    overdue: number;
    next30: number;
    pendingReview: number;
    rejected: number;
    missingEvidence: number;
    complianceRate: number | null;
    hhPlan: number;
    hhActual: number;
  };
  statusSplit: Record<OperationalExecutionStatus, number>;
  lastEvidence: {
    id: string;
    originalName: string | null;
    mime: string;
    sizeBytes: number;
    uploadedAt: string;
    description: string | null;
    executionId: string;
    planTask: {
      id: string;
      description: string;
      equipment: { id: string; name: string } | null;
    };
  } | null;
  upcoming: {
    id: string;
    dueDate: string;
    status: OperationalExecutionStatus;
    hhPlan: number;
    evidenceCount: number;
    planTask: {
      id: string;
      abc: string | null;
      description: string;
      equipment: { id: string; name: string; type: EquipmentType } | null;
    };
  }[];
  recentChanges: AuditRow[];
}

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

interface ExecutionRow {
  id: string;
  dueDate: string;
  status: OperationalExecutionStatus;
  hhPlan: number;
  hhActual: number | null;
  evidenceCount: number;
  evidence: EvidenceRow[];
  planTask: {
    id: string;
    abc: string | null;
    description: string;
    equipment: { id: string; name: string; type: EquipmentType } | null;
    plant: { id: string; psr: string; name: string; area: string | null };
  };
}

interface ExecutionList {
  rows: ExecutionRow[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const DATETIME = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  MOTOR: 'Motor',
  PUMP: 'Bomba',
  FILTER: 'Filtro',
  PANEL: 'Tablero',
  OTHER: 'Otro',
};

const FREQUENCY_LABELS: Record<PlanFrequency, string> = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Custom',
};

const STATUS_LABELS: Record<OperationalExecutionStatus, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  DONE_PENDING_APPROVAL: 'Pendiente revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  SKIPPED: 'Omitida',
  POSTPONED: 'Postergada',
};

const ACTION_LABELS: Record<string, string> = {
  PLANT_CREATE: 'Planta creada',
  PLANT_UPDATE: 'Planta actualizada',
  PLANT_DELETE: 'Planta desactivada',
  EQUIPMENT_CREATE: 'Equipo creado',
  EQUIPMENT_UPDATE: 'Equipo actualizado',
  EQUIPMENT_DELETE: 'Equipo eliminado',
  PLAN_TASK_CREATE: 'Tarea creada',
  PLAN_TASK_UPDATE: 'Tarea actualizada',
  PLAN_TASK_DELETE: 'Tarea eliminada',
  PLAN_TASK_GENERATE_EXECUTIONS: 'Ejecuciones generadas',
  OPERATIONAL_EXECUTION_REGISTER: 'Ejecución registrada',
  OPERATIONAL_EXECUTION_APPROVE: 'Ejecución aprobada',
  OPERATIONAL_EXECUTION_REJECT: 'Ejecución rechazada',
  OPERATIONAL_EXECUTION_REOPEN: 'Ejecución reabierta',
  EVIDENCE_UPLOAD: 'Evidencia cargada',
  EVIDENCE_DELETE: 'Evidencia eliminada',
};

export default function PlantDetailPage() {
  const params = useParams<{ psr: string }>();
  const psr = decodeURIComponent(params.psr ?? '');
  const encodedPsr = encodeURIComponent(psr);

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
  });
  const canWrite = me.data?.role === 'SUPERADMIN';

  const detail = useQuery({
    queryKey: ['plant-detail', psr],
    queryFn: () => api<PlantDetail>(`/api/plantas/${encodedPsr}`),
    enabled: Boolean(psr),
  });

  const summary = useQuery({
    queryKey: ['plant-summary', psr],
    queryFn: () => api<PlantSummary>(`/api/plantas/${encodedPsr}/resumen`),
    enabled: Boolean(psr),
    refetchInterval: 60_000,
  });

  const executions = useQuery({
    queryKey: ['plant-evidence-executions', psr],
    queryFn: () => api<ExecutionList>(`/api/ejecuciones?psr=${encodedPsr}&take=300`),
    enabled: Boolean(psr),
    refetchInterval: 60_000,
  });

  const history = useQuery({
    queryKey: ['plant-history', psr],
    queryFn: () => api<AuditRow[]>(`/api/plantas/${encodedPsr}/historico?take=120`),
    enabled: Boolean(psr),
  });

  const plant = detail.data;
  const summaryPlant = summary.data?.plant;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/plantas">
              <ArrowLeft data-icon="inline-start" />
              Plantas
            </Link>
          </Button>
          <div className="mt-4 flex min-w-0 items-start gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white"
              style={{ backgroundColor: plant?.color ?? summaryPlant?.color ?? '#0ea5e9' }}
            >
              {(plant?.name ?? summaryPlant?.name ?? psr).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold text-text">{plant?.name ?? summaryPlant?.name ?? psr}</h1>
                <Badge variant="outline" className={(plant?.status ?? summaryPlant?.status) === 'INACTIVE' ? 'border-neutral-300 text-ds-muted' : 'border-ok/30 bg-ok-dim text-ok'}>
                  {(plant?.status ?? summaryPlant?.status) === 'INACTIVE' ? 'Inactiva' : 'Activa'}
                </Badge>
                {(plant?.visibleToViewer ?? summaryPlant?.visibleToViewer) && (
                  <Badge variant="outline" className="border-ds-accent/30 bg-accent-dim text-ds-accent">
                    <ShieldCheck data-icon="inline-start" />
                    Visible
                  </Badge>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-ds-muted">{psr}</p>
              <p className="mt-2 max-w-3xl text-sm text-ds-muted">{plant?.description ?? plant?.area ?? 'Sin descripción operacional.'}</p>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:min-w-[420px]">
          <HeaderStat label="Equipos" value={summaryPlant?.equipmentCount ?? plant?.equipment.length ?? 0} />
          <HeaderStat label="Plan" value={summaryPlant?.planTaskCount ?? plant?.planTasks.length ?? 0} />
          <HeaderStat label="Cumplimiento" value={summary.data?.kpis.complianceRate === null || summary.data?.kpis.complianceRate === undefined ? '-' : `${PCT.format(summary.data.kpis.complianceRate)}%`} />
        </div>
      </header>

      {detail.error instanceof ApiError && detail.error.status === 403 ? (
        <PanelState title="Segundo factor requerido" detail="Completa 2FA para consultar esta planta." tone="danger" />
      ) : detail.isError || summary.isError ? (
        <PanelState title="No se pudo cargar la planta" detail="Revisa sesión, permisos o disponibilidad del API." tone="danger" />
      ) : detail.isLoading || summary.isLoading ? (
        <LoadingLayout />
      ) : (
        <Tabs defaultValue="resumen" className="flex flex-col gap-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="plan">Plan y equipos</TabsTrigger>
            <TabsTrigger value="ejecuciones">Ejecuciones</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="m-0">
            <SummaryTab summary={summary.data} historyRows={summary.data?.recentChanges ?? []} />
          </TabsContent>

          <TabsContent value="plan" className="m-0">
            {plant && <PlanAndEquipmentTab psr={psr} plant={plant} canWrite={canWrite} />}
          </TabsContent>

          <TabsContent value="ejecuciones" className="m-0">
            <ExecutionPanel psr={psr} canWrite={canWrite} />
          </TabsContent>

          <TabsContent value="evidencias" className="m-0">
            <EvidenceTab executions={executions.data?.rows ?? []} loading={executions.isLoading} error={executions.error} />
          </TabsContent>

          <TabsContent value="historico" className="m-0">
            <HistoryTimeline rows={history.data ?? []} loading={history.isLoading} error={history.error} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ds-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text tabular-nums">{value}</p>
    </div>
  );
}

function SummaryTab({ summary, historyRows }: { summary?: PlantSummary; historyRows: AuditRow[] }) {
  if (!summary) return null;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="flex flex-col gap-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Vencidas" value={summary.kpis.overdue} tone={summary.kpis.overdue > 0 ? 'danger' : 'neutral'} icon={<AlertTriangle data-icon="inline-start" />} />
          <KpiCard title="Próximos 30d" value={summary.kpis.next30} tone="brand" icon={<CalendarClock data-icon="inline-start" />} />
          <KpiCard title="Pendientes revisión" value={summary.kpis.pendingReview} tone={summary.kpis.pendingReview > 0 ? 'warn' : 'neutral'} icon={<ClipboardList data-icon="inline-start" />} />
          <KpiCard title="Sin evidencia" value={summary.kpis.missingEvidence} tone={summary.kpis.missingEvidence > 0 ? 'warn' : 'neutral'} icon={<Paperclip data-icon="inline-start" />} />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricBand label="HH plan base" value={HH.format(summary.kpis.hhPlan)} />
          <MetricBand label="HH real capturada" value={HH.format(summary.kpis.hhActual)} />
          <MetricBand label="Cumplimiento" value={summary.kpis.complianceRate === null ? '-' : `${PCT.format(summary.kpis.complianceRate)}%`} />
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text">Ventana operacional</h2>
              <p className="text-sm text-ds-muted">Próximas ejecuciones abiertas de la planta.</p>
            </div>
            <Badge variant="outline">{summary.upcoming.length} abiertas</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {summary.upcoming.length === 0 ? (
              <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-ds-muted">
                Sin ejecuciones abiertas en la ventana de 30 días.
              </p>
            ) : (
              summary.upcoming.map((execution) => (
                <div key={execution.id} className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{execution.planTask.description}</p>
                    <p className="mt-1 text-xs text-ds-muted">
                      {execution.planTask.equipment?.name ?? 'Sin equipo'} · {DATE.format(new Date(execution.dueDate))}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">ABC {execution.planTask.abc ?? '-'}</Badge>
                    <Badge variant="outline">{STATUS_LABELS[execution.status]}</Badge>
                    <span className="text-sm font-semibold text-text tabular-nums">{HH.format(execution.hhPlan)} HH</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-base font-semibold text-text">Última evidencia</h2>
          {summary.lastEvidence ? (
            <a
              href={`${API_URL}/api/evidencias/${summary.lastEvidence.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 transition-colors hover:border-ds-accent/50"
            >
              {iconForMime(summary.lastEvidence.mime)}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">{summary.lastEvidence.originalName ?? 'Evidencia'}</span>
                <span className="mt-1 block text-xs text-ds-muted">
                  {summary.lastEvidence.planTask.description} · {DATETIME.format(new Date(summary.lastEvidence.uploadedAt))}
                </span>
              </span>
              <ExternalLink data-icon="inline-start" />
            </a>
          ) : (
            <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-ds-muted">
              Sin evidencia cargada.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2">
            <History data-icon="inline-start" />
            <h2 className="text-base font-semibold text-text">Últimos cambios</h2>
          </div>
          <HistoryTimeline rows={historyRows} compact />
        </section>
      </div>
    </div>
  );
}

function PlanAndEquipmentTab({ psr, plant, canWrite }: { psr: string; plant: PlantDetail; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [equipmentForm, setEquipmentForm] = useState({ type: 'OTHER' as EquipmentType, name: '', model: '', serial: '', notes: '' });
  const [taskForm, setTaskForm] = useState({
    equipmentId: '',
    abc: 'B',
    description: '',
    frequency: 'MONTHLY' as PlanFrequency,
    hhPlan: '1',
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['plant-detail', psr] });
    queryClient.invalidateQueries({ queryKey: ['plant-summary', psr] });
    queryClient.invalidateQueries({ queryKey: ['plants-operational'] });
  }

  const createEquipment = useMutation({
    mutationFn: () => api(`/api/plantas/${encodeURIComponent(psr)}/equipos`, { method: 'POST', body: JSON.stringify(equipmentForm) }),
    onSuccess: () => {
      setEquipmentForm({ type: 'OTHER', name: '', model: '', serial: '', notes: '' });
      refresh();
    },
  });

  const createTask = useMutation({
    mutationFn: () =>
      api(`/api/plantas/${encodeURIComponent(psr)}/plan`, {
        method: 'POST',
        body: JSON.stringify({
          ...taskForm,
          equipmentId: taskForm.equipmentId || undefined,
          hhPlan: Number(taskForm.hhPlan),
        }),
      }),
    onSuccess: () => {
      setTaskForm({ equipmentId: '', abc: 'B', description: '', frequency: 'MONTHLY', hhPlan: '1' });
      refresh();
    },
  });

  const generate = useMutation({
    mutationFn: (taskId: string) => api(`/api/tareas-programadas/${taskId}/generar-ejecuciones`, { method: 'POST', body: JSON.stringify({ months: 12 }) }),
    onSuccess: refresh,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">Equipos</h2>
            <p className="text-sm text-ds-muted">{plant.equipment.length} activos</p>
          </div>
          <Wrench data-icon="inline-start" />
        </div>

        {canWrite && (
          <form
            className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              createEquipment.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <Field label="Tipo">
                <select
                  value={equipmentForm.type}
                  onChange={(event) => setEquipmentForm((current) => ({ ...current, type: event.target.value as EquipmentType }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre">
                <Input value={equipmentForm.name} onChange={(event) => setEquipmentForm((current) => ({ ...current, name: event.target.value }))} required placeholder="Bomba P-201" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Modelo">
                <Input value={equipmentForm.model} onChange={(event) => setEquipmentForm((current) => ({ ...current, model: event.target.value }))} placeholder="Opcional" />
              </Field>
              <Field label="Serial">
                <Input value={equipmentForm.serial} onChange={(event) => setEquipmentForm((current) => ({ ...current, serial: event.target.value }))} placeholder="Opcional" />
              </Field>
            </div>
            <Field label="Notas">
              <Input value={equipmentForm.notes} onChange={(event) => setEquipmentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ubicación o condición" />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={createEquipment.isPending}>
                <Plus data-icon="inline-start" />
                Agregar equipo
              </Button>
            </div>
            {createEquipment.isError && <ErrorText error={createEquipment.error} />}
          </form>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {plant.equipment.length === 0 ? (
            <EmptyMini text="Sin equipos asociados." />
          ) : (
            plant.equipment.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{item.name}</p>
                    <p className="mt-1 text-xs text-ds-muted">
                      {EQUIPMENT_LABELS[item.type]} {item.model ? `· ${item.model}` : ''} {item.serial ? `· ${item.serial}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">{EQUIPMENT_LABELS[item.type]}</Badge>
                </div>
                {item.notes && <p className="mt-2 text-xs text-ds-muted">{item.notes}</p>}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">Plan de mantención</h2>
            <p className="text-sm text-ds-muted">{plant.planTasks.length} tareas activas</p>
          </div>
          <ClipboardList data-icon="inline-start" />
        </div>

        {canWrite && (
          <form
            className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              createTask.mutate();
            }}
          >
            <div className="grid gap-3 md:grid-cols-[90px_1fr_150px_110px]">
              <Field label="ABC">
                <select value={taskForm.abc} onChange={(event) => setTaskForm((current) => ({ ...current, abc: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </Field>
              <Field label="Descripción">
                <Input value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} required placeholder="Cambio sello mecánico" />
              </Field>
              <Field label="Frecuencia">
                <select
                  value={taskForm.frequency}
                  onChange={(event) => setTaskForm((current) => ({ ...current, frequency: event.target.value as PlanFrequency }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="HH plan">
                <Input type="number" min="0" step="0.1" value={taskForm.hhPlan} onChange={(event) => setTaskForm((current) => ({ ...current, hhPlan: event.target.value }))} required />
              </Field>
            </div>
            <Field label="Equipo">
              <select value={taskForm.equipmentId} onChange={(event) => setTaskForm((current) => ({ ...current, equipmentId: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sin equipo específico</option>
                {plant.equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={createTask.isPending}>
                <Plus data-icon="inline-start" />
                Agregar tarea
              </Button>
            </div>
            {createTask.isError && <ErrorText error={createTask.error} />}
          </form>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {plant.planTasks.length === 0 ? (
            <EmptyMini text="Sin tareas de mantención." />
          ) : (
            plant.planTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">ABC {task.abc ?? '-'}</Badge>
                      <Badge variant="outline">{FREQUENCY_LABELS[task.frequency]}</Badge>
                      <span className="text-sm font-semibold text-text tabular-nums">{HH.format(Number(task.hhPlan))} HH</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-text">{task.description}</p>
                    <p className="mt-1 text-xs text-ds-muted">{task.equipment?.name ?? 'Sin equipo específico'}</p>
                  </div>
                  {canWrite && task.frequency !== 'CUSTOM' && (
                    <Button type="button" size="sm" variant="outline" disabled={generate.isPending} onClick={() => generate.mutate(task.id)}>
                      <CalendarClock data-icon="inline-start" />
                      Generar 12m
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {generate.isError && <div className="mt-3"><ErrorText error={generate.error} /></div>}
      </section>
    </div>
  );
}

function EvidenceTab({ executions, loading, error }: { executions: ExecutionRow[]; loading: boolean; error: unknown }) {
  const [kind, setKind] = useState<'all' | 'image' | 'pdf' | 'video' | 'other'>('all');
  const [q, setQ] = useState('');
  const evidence = useMemo(
    () =>
      executions.flatMap((execution) =>
        execution.evidence.map((item) => ({
          ...item,
          executionId: execution.id,
          dueDate: execution.dueDate,
          task: execution.planTask.description,
          equipment: execution.planTask.equipment?.name ?? null,
          abc: execution.planTask.abc,
        })),
      ),
    [executions],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return evidence.filter((item) => {
      if (kind !== 'all' && mimeKind(item.mime) !== kind) return false;
      if (!needle) return true;
      return [item.originalName, item.filename, item.description, item.task, item.equipment, item.abc]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [evidence, kind, q]);

  if (error) return <ErrorPanel error={error} />;
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-muted" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar evidencia, equipo o tarea" className="pl-9" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'image', 'pdf', 'video', 'other'] as const).map((value) => (
            <FilterChip key={value} active={kind === value} onClick={() => setKind(value)}>
              {value === 'all' ? 'Todas' : value === 'image' ? 'Imagen' : value === 'pdf' ? 'PDF' : value === 'video' ? 'Video' : 'Otros'}
            </FilterChip>
          ))}
        </div>
      </section>

      {filtered.length === 0 ? (
        <PanelState title="Sin evidencias" detail="No hay archivos activos para los filtros actuales." />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={`${API_URL}/api/evidencias/${item.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-ds-accent/50"
            >
              <div className="flex items-start gap-3">
                {iconForMime(item.mime)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{item.originalName ?? item.filename}</p>
                  <p className="mt-1 text-xs text-ds-muted">{item.task}</p>
                </div>
                <ExternalLink data-icon="inline-start" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ds-muted">
                <Badge variant="outline">ABC {item.abc ?? '-'}</Badge>
                <span>{item.equipment ?? 'Sin equipo'}</span>
                <span>{DATE.format(new Date(item.uploadedAt))}</span>
              </div>
              {item.description && <p className="mt-3 line-clamp-2 text-sm text-ds-muted">{item.description}</p>}
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

function HistoryTimeline({ rows, loading, error, compact = false }: { rows: AuditRow[]; loading?: boolean; error?: unknown; compact?: boolean }) {
  if (error) return <ErrorPanel error={error} />;
  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: compact ? 3 : 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <p className="mt-3 text-sm text-ds-muted">Sin eventos auditados asociados.</p>;

  return (
    <div className={compact ? 'mt-3 flex flex-col gap-2' : 'flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4'}>
      {rows.map((row) => (
        <div key={row.id} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-dim text-ds-accent">
            <History data-icon="inline-start" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-text">{ACTION_LABELS[row.action] ?? row.action}</p>
              {row.entity && <Badge variant="outline">{row.entity}</Badge>}
            </div>
            <p className="mt-1 text-xs text-ds-muted">
              {DATETIME.format(new Date(row.createdAt))} {row.user?.email ? `· ${row.user.email}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ title, value, icon, tone }: { title: string; value: string | number; icon: React.ReactNode; tone: 'brand' | 'warn' | 'danger' | 'neutral' }) {
  const toneClass = {
    brand: 'border-ds-accent/30 bg-accent-dim text-ds-accent',
    warn: 'border-warn/30 bg-warn-dim text-warn',
    danger: 'border-danger/30 bg-danger-dim text-danger',
    neutral: 'border-[var(--color-border)] bg-[var(--color-surface)] text-text',
  }[tone];
  return (
    <article className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] opacity-75">{title}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function MetricBand({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ds-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text tabular-nums">{value}</p>
    </div>
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full border px-3 text-sm transition-colors ${
        active
          ? 'border-ds-accent bg-accent-dim text-ds-accent'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-ds-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-ds-muted">{text}</p>;
}

function PanelState({ title, detail, tone = 'normal' }: { title: string; detail: string; tone?: 'normal' | 'danger' }) {
  return (
    <section className={`rounded-xl border p-8 text-center ${tone === 'danger' ? 'border-danger/30 bg-danger-dim' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-ds-muted">{detail}</p>
    </section>
  );
}

function LoadingLayout() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function ErrorPanel({ error }: { error: unknown }) {
  return <PanelState title="No se pudo cargar" detail={messageFromError(error)} tone="danger" />;
}

function ErrorText({ error }: { error: unknown }) {
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
      {messageFromError(error)}
    </p>
  );
}

function messageFromError(error: unknown) {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body && 'message' in error.body) {
    return String((error.body as { message?: unknown }).message);
  }
  return 'No se pudo completar la acción.';
}

function mimeKind(mime: string): 'image' | 'pdf' | 'video' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

function iconForMime(mime: string) {
  const kind = mimeKind(mime);
  const className = 'mt-0.5 shrink-0 text-ds-accent';
  if (kind === 'image') return <FileImage data-icon="inline-start" className={className} />;
  if (kind === 'pdf') return <FileText data-icon="inline-start" className={className} />;
  if (kind === 'video') return <Video data-icon="inline-start" className={className} />;
  return <FileArchive data-icon="inline-start" className={className} />;
}

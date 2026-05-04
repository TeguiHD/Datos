'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  CalendarClock,
  CirclePlus,
  ClipboardList,
  Eye,
  Factory,
  Pencil,
  Search,
  Settings2,
  Wrench,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExecutionPanel } from './_components/ExecutionPanel';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type PlantStatus = 'ACTIVE' | 'INACTIVE';
type EquipmentType = 'MOTOR' | 'PUMP' | 'FILTER' | 'PANEL' | 'OTHER';
type PlanFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';

interface MeResponse {
  role: string;
}

interface PlantRow {
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
  hhPlan: number;
  nextDueDate: string | null;
  updatedAt: string;
}

interface PlantList {
  rows: PlantRow[];
  total: number;
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
  hhPlan: string;
  active: boolean;
  executions?: { id: string; dueDate: string; status: string }[];
}

interface PlantDetail extends Omit<PlantRow, 'equipmentCount' | 'planTaskCount' | 'hhPlan' | 'nextDueDate'> {
  equipment: Equipment[];
  planTasks: PlanTask[];
}

const NUMBER = new Intl.NumberFormat('es-CL');
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

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

const DEFAULT_COLOR = '#0ea5e9';

export default function PlantasPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPsr, setSelectedPsr] = useState<string | null>(null);

  const canWrite = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
    select: (me) => me.role === 'SUPERADMIN',
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('take', '200');
    if (q.trim()) p.set('q', q.trim());
    if (status) p.set('status', status);
    return p.toString();
  }, [q, status]);

  const plants = useQuery({
    queryKey: ['plants-operational', params],
    queryFn: () => api<PlantList>(`/api/plantas?${params}`),
    refetchInterval: 60_000,
  });

  const rows = plants.data?.rows ?? [];
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, plant) => {
        acc.active += plant.status === 'ACTIVE' ? 1 : 0;
        acc.inactive += plant.status === 'INACTIVE' ? 1 : 0;
        acc.equipment += plant.equipmentCount;
        acc.tasks += plant.planTaskCount;
        acc.hh += plant.hhPlan;
        return acc;
      },
      { active: 0, inactive: 0, equipment: 0, tasks: 0, hh: 0 },
    );
  }, [rows]);

  function openCreate() {
    setSelectedPsr(null);
    setDrawerOpen(true);
  }

  function openEdit(psr: string) {
    setSelectedPsr(psr);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-5 fade-up">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Operación</p>
          <h1 className="text-2xl font-semibold text-text">Plantas</h1>
          <p className="mt-1 max-w-3xl text-sm text-ds-muted">
            Crea plantas manuales, asocia equipos y arma su plan de mantención con HH, frecuencia y responsable operativo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/dashboard?tab=analisis">Ver análisis</a>
          </Button>
          {canWrite.data && (
            <Button onClick={openCreate}>
              <CirclePlus data-icon="inline-start" />
              Nueva planta
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Activas" value={NUMBER.format(totals.active)} tone="ok" icon={<Factory className="size-4" />} />
        <MetricCard title="Equipos" value={NUMBER.format(totals.equipment)} tone="brand" icon={<Wrench className="size-4" />} />
        <MetricCard title="Tareas en plan" value={NUMBER.format(totals.tasks)} tone="warn" icon={<ClipboardList className="size-4" />} />
        <MetricCard title="HH plan base" value={HH.format(totals.hh)} tone="neutral" icon={<Activity className="size-4" />} />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ds-muted" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar por nombre, PSR, área o equipo"
              className="pl-9"
            />
          </label>
          <div className="flex gap-2">
            <FilterChip active={!status} onClick={() => setStatus('')}>
              Todas
            </FilterChip>
            <FilterChip active={status === 'ACTIVE'} onClick={() => setStatus('ACTIVE')}>
              Activas
            </FilterChip>
            <FilterChip active={status === 'INACTIVE'} onClick={() => setStatus('INACTIVE')}>
              Desactivadas
            </FilterChip>
          </div>
        </div>
      </section>

      {plants.error instanceof ApiError && plants.error.status === 403 ? (
        <PanelState title="Segundo factor requerido" detail="Completa 2FA para consultar plantas operacionales." />
      ) : plants.isError ? (
        <PanelState title="No se pudo cargar plantas" detail="Revisa sesión, permisos o disponibilidad del API." tone="danger" />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plants.isLoading
            ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-56 rounded-xl" />)
            : rows.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  canWrite={Boolean(canWrite.data)}
                  onOpen={() => openEdit(plant.psr)}
                />
              ))}
        </section>
      )}

      {!plants.isLoading && rows.length === 0 && !plants.isError && (
        <PanelState
          title="Sin plantas operacionales"
          detail={canWrite.data ? 'Crea la primera planta para comenzar a cargar equipos y plan de mantención.' : 'Aún no hay plantas visibles.'}
          action={canWrite.data ? <Button onClick={openCreate}>Crear primera planta</Button> : null}
        />
      )}

      <PlantDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        psr={selectedPsr}
        canWrite={Boolean(canWrite.data)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['plants-operational'] });
        }}
      />
    </div>
  );
}

function MetricCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: 'brand' | 'ok' | 'warn' | 'neutral' }) {
  const toneClass = {
    brand: 'border-ds-accent/30 bg-accent-dim text-ds-accent',
    ok: 'border-ok/30 bg-ok-dim text-ok',
    warn: 'border-warn/30 bg-warn-dim text-warn',
    neutral: 'border-[var(--color-border)] bg-[var(--color-surface)] text-text',
  }[tone];
  return (
    <article className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] opacity-75">{title}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </article>
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

function PlantCard({ plant, canWrite, onOpen }: { plant: PlantRow; canWrite: boolean; onOpen: () => void }) {
  const inactive = plant.status === 'INACTIVE';
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-ds-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: plant.color || DEFAULT_COLOR }}
          >
            {plant.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">{plant.name}</h2>
            <p className="truncate font-mono text-xs text-ds-muted">{plant.psr}</p>
          </div>
        </div>
        <Badge variant="outline" className={inactive ? 'border-neutral-300 text-ds-muted' : 'border-ok/30 bg-ok-dim text-ok'}>
          {inactive ? 'Inactiva' : 'Activa'}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-ds-muted">
        {plant.description || plant.area || 'Sin descripción operacional.'}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <MiniStat label="Equipos" value={plant.equipmentCount} />
        <MiniStat label="Plan" value={plant.planTaskCount} />
        <MiniStat label="HH" value={HH.format(plant.hhPlan)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-xs text-ds-muted">
        <span className="flex min-w-0 items-center gap-1">
          <CalendarClock className="size-3.5" />
          {plant.nextDueDate ? DATE.format(new Date(plant.nextDueDate)) : 'Sin ejecuciones'}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/dashboard/plantas/${encodeURIComponent(plant.psr)}`}>Detalle</a>
          </Button>
          <Button size="sm" variant={canWrite ? 'default' : 'outline'} onClick={onOpen}>
            {canWrite ? <Pencil data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            {canWrite ? 'Gestionar' : 'Ver'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ds-muted">{label}</p>
      <p className="mt-1 font-semibold text-text tabular-nums">{value}</p>
    </div>
  );
}

function PanelState({ title, detail, action, tone = 'normal' }: { title: string; detail: string; action?: React.ReactNode; tone?: 'normal' | 'danger' }) {
  return (
    <section className={`rounded-xl border p-8 text-center ${tone === 'danger' ? 'border-danger/30 bg-danger-dim' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-ds-muted">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

function PlantDrawer({
  open,
  onOpenChange,
  psr,
  canWrite,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  psr: string | null;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(psr);
  const [tab, setTab] = useState<'general' | 'equipment' | 'plan' | 'executions'>('general');
  const [form, setForm] = useState({
    psr: '',
    name: '',
    description: '',
    area: '',
    color: DEFAULT_COLOR,
    status: 'ACTIVE' as PlantStatus,
    visibleToViewer: true,
  });

  const detail = useQuery({
    queryKey: ['plant-detail', psr],
    queryFn: () => api<PlantDetail>(`/api/plantas/${psr}`),
    enabled: open && Boolean(psr),
  });

  useEffect(() => {
    if (!open) return;
    setTab('general');
    if (!psr) {
      setForm({
        psr: '',
        name: '',
        description: '',
        area: '',
        color: DEFAULT_COLOR,
        status: 'ACTIVE',
        visibleToViewer: true,
      });
    }
  }, [open, psr]);

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      psr: detail.data.psr,
      name: detail.data.name,
      description: detail.data.description ?? '',
      area: detail.data.area ?? '',
      color: detail.data.color ?? DEFAULT_COLOR,
      status: detail.data.status,
      visibleToViewer: detail.data.visibleToViewer,
    });
  }, [detail.data]);

  const savePlant = useMutation({
    mutationFn: () => {
      const body = JSON.stringify(form);
      if (isEditing) return api(`/api/plantas/${psr}`, { method: 'PATCH', body });
      return api('/api/plantas', { method: 'POST', body });
    },
    onSuccess: (plant: unknown) => {
      onSaved();
      queryClient.invalidateQueries({ queryKey: ['plant-detail'] });
      const created = plant as { psr?: string };
      if (!isEditing && created.psr) {
        onOpenChange(false);
      }
    },
  });

  const disablePlant = useMutation({
    mutationFn: () => api(`/api/plantas/${psr}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Desactivada desde UI' }) }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  const equipment = detail.data?.equipment ?? [];
  const planTasks = detail.data?.planTasks ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-8">
          <SheetTitle>{isEditing ? form.name || 'Editar planta' : 'Nueva planta'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Administra datos, equipos y plan de mantención de esta planta.' : 'Primero guarda la planta; luego podrás asociar equipos y tareas.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-2">
          <TabButton active={tab === 'general'} onClick={() => setTab('general')} icon={<Settings2 className="size-4" />}>
            General
          </TabButton>
          <TabButton active={tab === 'equipment'} onClick={() => setTab('equipment')} disabled={!isEditing} icon={<Wrench className="size-4" />}>
            Equipos {isEditing ? `(${equipment.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'plan'} onClick={() => setTab('plan')} disabled={!isEditing} icon={<ClipboardList className="size-4" />}>
            Plan {isEditing ? `(${planTasks.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'executions'} onClick={() => setTab('executions')} disabled={!isEditing} icon={<CalendarClock className="size-4" />}>
            Ejecuciones
          </TabButton>
        </div>

        {detail.isLoading && isEditing ? (
          <div className="mt-6 space-y-3">
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-40 rounded-lg" />
          </div>
        ) : (
          <>
            {tab === 'general' && (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  savePlant.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="PSR">
                    <Input
                      value={form.psr}
                      disabled={isEditing || !canWrite}
                      onChange={(event) => setForm((current) => ({ ...current, psr: event.target.value }))}
                      placeholder="PSR-CON-A"
                      required
                    />
                  </Field>
                  <Field label="Nombre">
                    <Input
                      value={form.name}
                      disabled={!canWrite}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Concentradora A"
                      required
                    />
                  </Field>
                </div>
                <Field label="Descripción">
                  <textarea
                    value={form.description}
                    disabled={!canWrite}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    placeholder="Ubicación, criticidad, alcance del plan..."
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Área responsable">
                    <Input
                      value={form.area}
                      disabled={!canWrite}
                      onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
                      placeholder="ELEMEC"
                    />
                  </Field>
                  <Field label="Color">
                    <input
                      type="color"
                      value={form.color}
                      disabled={!canWrite}
                      onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background p-1 disabled:opacity-50"
                    />
                  </Field>
                  <Field label="Estado">
                    <select
                      value={form.status}
                      disabled={!canWrite}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PlantStatus }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                    >
                      <option value="ACTIVE">Activa</option>
                      <option value="INACTIVE">Inactiva</option>
                    </select>
                  </Field>
                </div>
                <label className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-text">Visible para invitado</span>
                    <span className="block text-xs text-ds-muted">El rol de lectura podrá verla en demo.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.visibleToViewer}
                    disabled={!canWrite}
                    onChange={(event) => setForm((current) => ({ ...current, visibleToViewer: event.target.checked }))}
                    className="size-4"
                  />
                </label>
                {canWrite && (
                  <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--color-border)] pt-4">
                    <div>
                      {isEditing && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (window.confirm('¿Desactivar esta planta? Quedará fuera de listados operativos.')) disablePlant.mutate();
                          }}
                          disabled={disablePlant.isPending}
                          className="text-danger"
                        >
                          <Archive data-icon="inline-start" />
                          Desactivar
                        </Button>
                      )}
                    </div>
                    <Button type="submit" disabled={savePlant.isPending}>
                      {savePlant.isPending ? 'Guardando...' : 'Guardar planta'}
                    </Button>
                  </div>
                )}
                {savePlant.isError && <ErrorText error={savePlant.error} />}
                {disablePlant.isError && <ErrorText error={disablePlant.error} />}
              </form>
            )}

            {tab === 'equipment' && psr && (
              <EquipmentPanel psr={psr} equipment={equipment} canWrite={canWrite} onChanged={() => detail.refetch()} />
            )}

            {tab === 'plan' && psr && (
              <PlanPanel psr={psr} equipment={equipment} tasks={planTasks} canWrite={canWrite} onChanged={() => detail.refetch()} />
            )}

            {tab === 'executions' && psr && <ExecutionPanel psr={psr} canWrite={canWrite} />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TabButton({ active, onClick, disabled, icon, children }: { active: boolean; onClick: () => void; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-ds-accent bg-accent-dim text-ds-accent'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-ds-muted hover:text-text'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ds-muted">{label}</span>
      {children}
    </label>
  );
}

function EquipmentPanel({ psr, equipment, canWrite, onChanged }: { psr: string; equipment: Equipment[]; canWrite: boolean; onChanged: () => void }) {
  const [form, setForm] = useState({ type: 'OTHER' as EquipmentType, name: '', model: '', serial: '', notes: '' });
  const create = useMutation({
    mutationFn: () => api(`/api/plantas/${psr}/equipos`, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ type: 'OTHER', name: '', model: '', serial: '', notes: '' });
      onChanged();
    },
  });

  return (
    <div className="mt-5 space-y-4">
      {canWrite && (
        <form
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
            <Field label="Tipo">
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EquipmentType }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required placeholder="Bomba P-201" />
            </Field>
            <Field label="Modelo">
              <Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="Opcional" />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <Field label="Serial">
              <Input value={form.serial} onChange={(event) => setForm((current) => ({ ...current, serial: event.target.value }))} placeholder="Opcional" />
            </Field>
            <Field label="Notas">
              <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ubicación, condición, observaciones" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                Agregar
              </Button>
            </div>
          </div>
          {create.isError && <ErrorText error={create.error} />}
        </form>
      )}

      <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
        {equipment.length === 0 ? (
          <p className="p-4 text-sm text-ds-muted">Sin equipos asociados todavía.</p>
        ) : (
          equipment.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-text">{item.name}</p>
                <p className="text-sm text-ds-muted">
                  {EQUIPMENT_LABELS[item.type]} {item.model ? `· ${item.model}` : ''} {item.serial ? `· ${item.serial}` : ''}
                </p>
                {item.notes && <p className="mt-1 text-xs text-ds-muted">{item.notes}</p>}
              </div>
              <Badge variant="outline">{EQUIPMENT_LABELS[item.type]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PlanPanel({ psr, equipment, tasks, canWrite, onChanged }: { psr: string; equipment: Equipment[]; tasks: PlanTask[]; canWrite: boolean; onChanged: () => void }) {
  const [form, setForm] = useState({
    equipmentId: '',
    abc: 'B',
    description: '',
    frequency: 'MONTHLY' as PlanFrequency,
    hhPlan: '1',
  });
  const create = useMutation({
    mutationFn: () =>
      api(`/api/plantas/${psr}/plan`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          equipmentId: form.equipmentId || undefined,
          hhPlan: Number(form.hhPlan),
        }),
      }),
    onSuccess: () => {
      setForm({ equipmentId: '', abc: 'B', description: '', frequency: 'MONTHLY', hhPlan: '1' });
      onChanged();
    },
  });

  const generate = useMutation({
    mutationFn: (id: string) => api(`/api/tareas-programadas/${id}/generar-ejecuciones`, { method: 'POST', body: JSON.stringify({ months: 12 }) }),
    onSuccess: onChanged,
  });

  return (
    <div className="mt-5 space-y-4">
      {canWrite && (
        <form
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[120px_1fr_150px_120px]">
            <Field label="ABC">
              <select value={form.abc} onChange={(event) => setForm((current) => ({ ...current, abc: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </Field>
            <Field label="Descripción">
              <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required placeholder="Cambio sello mecánico" />
            </Field>
            <Field label="Frecuencia">
              <select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as PlanFrequency }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="HH plan">
              <Input type="number" min="0" step="0.1" value={form.hhPlan} onChange={(event) => setForm((current) => ({ ...current, hhPlan: event.target.value }))} required />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Equipo asociado">
              <select value={form.equipmentId} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sin equipo específico</option>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                Agregar tarea
              </Button>
            </div>
          </div>
          {create.isError && <ErrorText error={create.error} />}
        </form>
      )}

      <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
        {tasks.length === 0 ? (
          <p className="p-4 text-sm text-ds-muted">Sin tareas en el plan todavía.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">ABC {task.abc || '-'}</Badge>
                  <Badge variant="outline">{FREQUENCY_LABELS[task.frequency]}</Badge>
                  <span className="text-sm font-semibold text-text">{HH.format(Number(task.hhPlan))} HH</span>
                </div>
                <p className="mt-2 font-medium text-text">{task.description}</p>
                <p className="text-sm text-ds-muted">{task.equipment?.name || 'Sin equipo específico'}</p>
              </div>
              {canWrite && task.frequency !== 'CUSTOM' && (
                <Button variant="outline" size="sm" onClick={() => generate.mutate(task.id)} disabled={generate.isPending}>
                  Generar 12 meses
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      {generate.isError && <ErrorText error={generate.error} />}
    </div>
  );
}

function ErrorText({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError && typeof error.body === 'object' && error.body && 'message' in error.body
      ? String((error.body as { message?: unknown }).message)
      : 'No se pudo completar la acción.';
  return <p className="mt-3 rounded-md border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">{message}</p>;
}

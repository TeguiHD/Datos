'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CalendarClock, ClipboardList, Download, Factory, Pencil, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { downloadFile } from '@/lib/download';
import { toast } from '@/lib/toast';

type PlantStatus = 'ACTIVE' | 'STANDBY' | 'INACTIVE';

interface PlantRow {
  id: string;
  psr: string;
  name: string;
  description: string | null;
  status: PlantStatus;
  maintenanceTaskCount: number;
  taskCount: number;
  aliases: Array<{ id: string; alias: string; source: string }>;
  hhPlan: number;
  scheduleHh: number;
  nextDueDate: string | null;
}

interface PlantList {
  rows: PlantRow[];
  total: number;
}

const NUMBER = new Intl.NumberFormat('es-CL');
const HH = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PlantasPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<PlantRow | null>(null);

  const params = useMemo(() => {
    const out = new URLSearchParams();
    if (q.trim()) out.set('q', q.trim());
    if (status) out.set('status', status);
    out.set('take', '500');
    return out.toString();
  }, [q, status]);

  const plants = useQuery({
    queryKey: ['plantas', params],
    queryFn: () => api<PlantList>(`/api/plantas?${params}`),
  });

  const rows = plants.data?.rows ?? [];
  const totals = useMemo(
    () => ({
      active: rows.filter((row) => row.status === 'ACTIVE').length,
      standby: rows.filter((row) => row.status === 'STANDBY').length,
      tasks: rows.reduce((sum, row) => sum + row.maintenanceTaskCount, 0),
      hh: rows.reduce((sum, row) => sum + row.hhPlan, 0),
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-5 fade-up">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">SAP PM</p>
        <h1 className="text-2xl font-semibold text-text">Plantas</h1>
        <p className="max-w-3xl text-sm text-ds-muted">
          Catálogo operativo derivado del Excel ESSC Sur. Entra a una planta para revisar tareas, periodos, HH y estados.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Activas" value={NUMBER.format(totals.active)} icon={<Factory className="size-4" />} />
        <Metric title="Standby" value={NUMBER.format(totals.standby)} icon={<CalendarClock className="size-4" />} />
        <Metric title="Tareas" value={NUMBER.format(totals.tasks)} icon={<ClipboardList className="size-4" />} />
        <Metric title="HH base" value={HH.format(totals.hh)} icon={<Activity className="size-4" />} />
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <label className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ds-muted" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar CEMIN, GOODYEAR, alias o PSR" className="pl-9" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="STANDBY">Standby</option>
          <option value="INACTIVE">Inactivas</option>
        </select>
        <button
          type="button"
          onClick={async () => {
            try {
              await downloadFile('/api/export/mantenciones');
              toast('Excel exportado');
            } catch {
              toast('No se pudo exportar', 'error');
            }
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 text-sm font-medium text-text hover:bg-[var(--color-surface-2)]"
        >
          <Download className="size-4" />
          Exportar Excel
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plants.isLoading
          ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-60 rounded-xl" />)
          : rows.map((plant) => <PlantCard key={plant.id} plant={plant} onEdit={() => setEditing(plant)} />)}
      </section>

      {!plants.isLoading && rows.length === 0 && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <h2 className="font-semibold text-text">Sin plantas para los filtros aplicados</h2>
          <p className="mt-2 text-sm text-ds-muted">Ajusta la búsqueda o importa el Excel actualizado.</p>
        </section>
      )}

      {editing && <EditPlantDialog plant={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-2 text-ds-muted">
        <p className="text-[11px] uppercase tracking-[0.18em]">{title}</p>
        {icon}
      </div>
      <p className="mt-4 text-2xl font-semibold text-text tabular-nums">{value}</p>
    </article>
  );
}

function PlantCard({ plant, onEdit }: { plant: PlantRow; onEdit: () => void }) {
  const router = useRouter();
  const next = plant.nextDueDate ? DATE.format(new Date(plant.nextDueDate)) : 'Sin fecha futura';
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/dashboard/plantas/${encodeURIComponent(plant.psr)}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') router.push(`/dashboard/plantas/${encodeURIComponent(plant.psr)}`);
      }}
      className="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-ds-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-text" title={plant.name}>{plant.name}</h2>
          <p className="mt-1 text-xs text-ds-muted">{plant.psr}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={plant.status} />
          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEdit(); }} className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--color-border)] text-ds-muted hover:bg-[var(--color-surface-2)]" title="Editar planta">
            <Pencil className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Stat label="Tareas" value={NUMBER.format(plant.maintenanceTaskCount)} />
        <Stat label="HH base" value={HH.format(plant.hhPlan)} />
        <Stat label="HH plan" value={HH.format(plant.scheduleHh)} />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-ds-muted"><CalendarClock className="size-4" />Próxima</span>
          <span className="font-medium text-text">{next}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plant.aliases.slice(0, 6).map((item) => <Badge key={item.id} variant="outline">{item.alias}</Badge>)}
        {plant.aliases.length > 6 && <Badge variant="outline">+{plant.aliases.length - 6}</Badge>}
      </div>
    </article>
  );
}

function EditPlantDialog({ plant, onClose }: { plant: PlantRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plant.name);
  const [status, setStatus] = useState<PlantStatus>(plant.status);
  const [aliases, setAliases] = useState(plant.aliases.map((item) => item.alias).join('\n'));

  const save = useMutation({
    mutationFn: () =>
      api(`/api/plantas/${plant.psr}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          status,
          aliases: aliases.split('\n').map((item) => item.trim()).filter(Boolean),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plantas'] });
      await queryClient.invalidateQueries({ queryKey: ['task-facets'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <form className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <h2 className="text-lg font-semibold text-text">Editar planta</h2>
        <label className="mt-4 flex flex-col gap-1 text-sm text-ds-muted">
          Nombre visible
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm text-ds-muted">
          Estado
          <select value={status} onChange={(event) => setStatus(event.target.value as PlantStatus)} className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text">
            <option value="ACTIVE">Activa</option>
            <option value="STANDBY">Standby</option>
            <option value="INACTIVE">Inactiva</option>
          </select>
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm text-ds-muted">
          Aliases, uno por línea
          <textarea value={aliases} onChange={(event) => setAliases(event.target.value)} rows={8} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text" />
        </label>
        {save.isError && <p className="mt-3 text-sm text-danger">No se pudo guardar. Revisa permisos o aliases duplicados.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-[var(--color-border)] px-3 text-sm text-text hover:bg-[var(--color-surface-2)]">Cancelar</button>
          <button type="submit" disabled={save.isPending} className="h-9 rounded-md bg-ds-accent px-3 text-sm font-medium text-white disabled:opacity-60">{save.isPending ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: PlantStatus }) {
  const styles = {
    ACTIVE: 'border-ok/30 bg-ok-dim text-ok',
    STANDBY: 'border-warn/30 bg-warn-dim text-warn',
    INACTIVE: 'border-danger/30 bg-danger-dim text-danger',
  }[status];
  const label = status === 'ACTIVE' ? 'Activa' : status === 'STANDBY' ? 'Standby' : 'Inactiva';
  return <Badge variant="outline" className={styles}>{label}</Badge>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <p className="text-xs text-ds-muted">{label}</p>
      <p className="mt-1 font-semibold text-text tabular-nums">{value}</p>
    </div>
  );
}

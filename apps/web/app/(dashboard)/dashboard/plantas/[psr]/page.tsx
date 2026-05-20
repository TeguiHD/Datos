'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { hh as fmtHh, int, dateFormat } from '@/lib/i18n/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PlantStatus = 'ACTIVE' | 'STANDBY' | 'INACTIVE';
type ExecStatus = 'PENDING' | 'OVERDUE' | 'DONE' | 'SKIPPED';
type MaintType = 'PREVENTIVA' | 'CORRECTIVA' | 'PREDICTIVA';

interface ExecutionRow {
  id: string;
  dueDate: string;
  status: ExecStatus;
  hhPlanned: string | number;
  hhActual: string | number | null;
}

interface TaskRow {
  id: string;
  posicionMant: string | null;
  titulo: string | null;
  descripcion: string | null;
  tipo: MaintType;
  responsable: string | null;
  descPosicionMant: string | null;
  denomObjetoTecnico: string | null;
  equipo: string | null;
  frecuenciaCodigo: string | null;
  frecuenciaMeses: number | null;
  mesInicio: number | null;
  hhReal: string | number | null;
  executions: ExecutionRow[];
}

interface PlantDetail {
  id: string;
  psr: string;
  name: string;
  status: PlantStatus;
  maintenanceTasks: TaskRow[];
  kpis: {
    maintenanceTaskCount: number;
    hhBase: number;
    statusCounts: Array<{ status: ExecStatus; count: number }>;
  };
}

const FREQUENCIES = [
  { code: '1M', label: 'Mensual', months: 1 },
  { code: '3M', label: 'Trimestral', months: 3 },
  { code: '6M', label: 'Semestral', months: 6 },
  { code: '1A', label: 'Anual', months: 12 },
  { code: '5A', label: 'Quinquenal', months: 60 },
];

const TYPE_META: Record<MaintType, { label: string; cls: string }> = {
  PREVENTIVA: { label: 'Preventiva', cls: 'bg-blue-100 text-blue-800' },
  CORRECTIVA: { label: 'Correctiva', cls: 'bg-amber-100 text-amber-800' },
  PREDICTIVA: { label: 'Predictiva', cls: 'bg-violet-100 text-violet-800' },
};

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function freqLabel(code: string | null): string {
  return FREQUENCIES.find((f) => f.code === code)?.label ?? code ?? 'Sin frecuencia';
}

function taskTitle(t: TaskRow): string {
  return t.titulo || t.descPosicionMant || t.descripcion || 'Mantención sin título';
}

function nextDue(t: TaskRow): ExecutionRow | null {
  const pend = t.executions
    .filter((e) => e.status === 'PENDING' || e.status === 'OVERDUE')
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  return pend[0] ?? null;
}

export default function PlantDetailPage() {
  const params = useParams<{ psr: string }>();
  const psr = decodeURIComponent(params.psr);
  const qc = useQueryClient();

  const [tab, setTab] = useState<'mantenciones' | 'proximas'>('mantenciones');
  const [search, setSearch] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fFrec, setFFrec] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [editing, setEditing] = useState<TaskRow | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const plant = useQuery({
    queryKey: ['plant-detail', psr],
    queryFn: () => api<PlantDetail>(`/api/plantas/${encodeURIComponent(psr)}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['plant-detail', psr] });
    qc.invalidateQueries({ queryKey: ['plantas-panel'] });
  };

  const row = plant.data;
  const tasks = useMemo(() => {
    const all = row?.maintenanceTasks ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (fTipo && t.tipo !== fTipo) return false;
      if (fFrec && t.frecuenciaCodigo !== fFrec) return false;
      if (fEstado) {
        const nd = nextDue(t);
        const st = nd?.status ?? 'DONE';
        if (fEstado === 'pendientes' && !(st === 'PENDING' || st === 'OVERDUE')) return false;
        if (fEstado === 'vencidas' && st !== 'OVERDUE') return false;
        if (fEstado === 'aldia' && (st === 'PENDING' || st === 'OVERDUE')) return false;
      }
      if (q) {
        const hay = `${taskTitle(t)} ${t.posicionMant ?? ''} ${t.responsable ?? ''} ${t.equipo ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [row, search, fTipo, fFrec, fEstado]);

  const upcoming = useMemo(() => {
    return (row?.maintenanceTasks ?? [])
      .flatMap((t) => t.executions.filter((e) => e.status === 'PENDING' || e.status === 'OVERDUE').map((e) => ({ e, t })))
      .sort((a, b) => +new Date(a.e.dueDate) - +new Date(b.e.dueDate))
      .slice(0, 40);
  }, [row]);

  if (plant.isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (!row) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="font-semibold text-text">No se pudo cargar la planta</p>
        <p className="mt-1 text-sm text-ds-muted">Revisa tu sesión o permisos.</p>
      </div>
    );
  }

  const counts = Object.fromEntries(row.kpis.statusCounts.map((s) => [s.status, s.count])) as Partial<
    Record<ExecStatus, number>
  >;
  const overdue = counts.OVERDUE ?? 0;
  const proximas = counts.PENDING ?? 0;

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* Cabecera */}
      <header className="flex flex-col gap-3">
        <Link href="/dashboard/plantas" className="inline-flex w-fit items-center gap-1.5 text-sm text-ds-muted hover:text-text">
          <ArrowLeft className="size-4" /> Plantas
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-text">{row.name}</h1>
            <PlantStatusChip status={row.status} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> Ajustes
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kpi label="Mantenciones" value={int(row.kpis.maintenanceTaskCount)} icon={<ClipboardList className="size-4" />} />
          <Kpi label="Vencidas" value={int(overdue)} icon={<AlertTriangle className="size-4" />} tone={overdue ? 'danger' : undefined} />
          <Kpi label="Próximas" value={int(proximas)} icon={<CalendarClock className="size-4" />} />
          <Kpi label="Completadas" value={int(counts.DONE ?? 0)} icon={<CheckCircle2 className="size-4" />} />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        <TabBtn active={tab === 'mantenciones'} onClick={() => setTab('mantenciones')}>
          Mantenciones
        </TabBtn>
        <TabBtn active={tab === 'proximas'} onClick={() => setTab('proximas')}>
          Próximas {upcoming.length > 0 && <span className="ml-1 text-xs text-ds-muted">({upcoming.length})</span>}
        </TabBtn>
      </div>

      {tab === 'mantenciones' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ds-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, ID, responsable…"
                className="pl-8"
              />
            </div>
            <FilterSelect value={fTipo} onChange={setFTipo} placeholder="Todo tipo">
              <option value="PREVENTIVA">Preventiva</option>
              <option value="CORRECTIVA">Correctiva</option>
              <option value="PREDICTIVA">Predictiva</option>
            </FilterSelect>
            <FilterSelect value={fFrec} onChange={setFFrec} placeholder="Toda frecuencia">
              {FREQUENCIES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={fEstado} onChange={setFEstado} placeholder="Todo estado">
              <option value="pendientes">Pendientes</option>
              <option value="vencidas">Vencidas</option>
              <option value="aldia">Al día</option>
            </FilterSelect>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Nueva mantención
            </Button>
          </div>

          {/* Lista */}
          {tasks.length === 0 ? (
            <EmptyState
              title={row.maintenanceTasks.length === 0 ? 'Esta planta no tiene mantenciones' : 'Sin resultados'}
              detail={
                row.maintenanceTasks.length === 0
                  ? 'Crea la primera con "Nueva mantención".'
                  : 'Ajusta la búsqueda o los filtros.'
              }
            />
          ) : (
            <ul className="grid gap-2" role="list">
              {tasks.map((t) => (
                <MaintenanceCard key={t.id} task={t} onOpen={() => setEditing(t)} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'proximas' && (
        <ProximasList
          rows={upcoming}
          onOpenTask={(t) => setEditing(t)}
          onChanged={refresh}
        />
      )}

      {editing && (
        <MaintenanceDialog
          plantId={row.id}
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
      {settingsOpen && (
        <PlantSettingsDialog
          plant={row}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            refresh();
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Card ---------- */

function MaintenanceCard({ task, onOpen }: { task: TaskRow; onOpen: () => void }) {
  const nd = nextDue(task);
  const status: ExecStatus = nd?.status ?? 'DONE';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-ds-accent/50 hover:bg-[var(--color-surface-2)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {task.posicionMant && (
                <span className="font-mono text-[11px] text-ds-muted">#{task.posicionMant}</span>
              )}
              <TypeChip tipo={task.tipo} />
            </div>
            <p className="mt-1 truncate font-medium text-text">{taskTitle(task)}</p>
            <p className="mt-0.5 truncate text-xs text-ds-muted">
              {freqLabel(task.frecuenciaCodigo)} · {fmtHh(task.hhReal)} HH
              {task.responsable ? ` · ${task.responsable}` : ''}
              {task.equipo ? ` · ${task.equipo}` : ''}
            </p>
          </div>
          <ExecChip status={status} dueDate={nd?.dueDate} />
        </div>
      </button>
    </li>
  );
}

/* ---------- Próximas ---------- */

function ProximasList({
  rows,
  onOpenTask,
  onChanged,
}: {
  rows: Array<{ e: ExecutionRow; t: TaskRow }>;
  onOpenTask: (t: TaskRow) => void;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState<{ exec: ExecutionRow; action: 'DONE' | 'SKIPPED' } | null>(null);

  const mutate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'DONE' | 'SKIPPED' }) =>
      api(`/api/schedule/executions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      toast(v.status === 'DONE' ? 'Mantención marcada como completada' : 'Mantención omitida');
      onChanged();
      setConfirm(null);
    },
    onError: () => toast('No se pudo guardar el cambio', 'error'),
  });

  if (rows.length === 0) {
    return <EmptyState title="Sin mantenciones próximas" detail="No hay nada pendiente ni vencido en esta planta." />;
  }

  return (
    <>
      <ul className="grid gap-2" role="list">
        {rows.map(({ e, t }) => (
          <li
            key={e.id}
            className={`rounded-xl border bg-[var(--color-surface)] p-3 ${
              e.status === 'OVERDUE' ? 'border-danger/40' : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpenTask(t)} className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <ExecChip status={e.status} dueDate={e.dueDate} />
                  <TypeChip tipo={t.tipo} />
                </div>
                <p className="mt-1 truncate font-medium text-text hover:underline">{taskTitle(t)}</p>
                <p className="mt-0.5 text-xs text-ds-muted">
                  {freqLabel(t.frecuenciaCodigo)} · {fmtHh(e.hhPlanned)} HH
                </p>
              </button>
            </div>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-ok/40 text-ok hover:bg-ok-dim"
                onClick={() => setConfirm({ exec: e, action: 'DONE' })}
              >
                <CheckCircle2 className="size-4" /> Completar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirm({ exec: e, action: 'SKIPPED' })}
              >
                Omitir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === 'DONE' ? '¿Marcar como completada?' : '¿Omitir esta mantención?'}
        detail={
          confirm?.action === 'DONE'
            ? 'Se registrará como ejecutada en la fecha de hoy.'
            : 'Quedará marcada como omitida para ese período.'
        }
        confirmLabel={confirm?.action === 'DONE' ? 'Completar' : 'Omitir'}
        pending={mutate.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && mutate.mutate({ id: confirm.exec.id, status: confirm.action })}
      />
    </>
  );
}

/* ---------- Editor / detalle ---------- */

function MaintenanceDialog({
  plantId,
  task,
  onClose,
  onSaved,
}: {
  plantId: string;
  task: TaskRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = task === null;
  const [titulo, setTitulo] = useState(task?.titulo ?? task?.descPosicionMant ?? '');
  const [descripcion, setDescripcion] = useState(task?.descripcion ?? '');
  const [tipo, setTipo] = useState<MaintType>(task?.tipo ?? 'PREVENTIVA');
  const [frecuencia, setFrecuencia] = useState(task?.frecuenciaCodigo ?? '1A');
  const [mesInicio, setMesInicio] = useState(String(task?.mesInicio ?? 1));
  const [hh, setHh] = useState(String(task?.hhReal ?? 0));
  const [responsable, setResponsable] = useState(task?.responsable ?? '');
  const [confirmDel, setConfirmDel] = useState(false);

  const freq = FREQUENCIES.find((f) => f.code === frecuencia) ?? { code: '1A', label: 'Anual', months: 12 };

  const save = useMutation({
    mutationFn: () =>
      api(isNew ? '/api/tasks' : `/api/tasks/${task.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify({
          plantId,
          titulo: titulo.trim(),
          descPosicionMant: titulo.trim(),
          descripcion: descripcion.trim() || undefined,
          tipo,
          responsable: responsable.trim() || undefined,
          frecuenciaCodigo: frecuencia,
          frecuenciaMeses: freq.months,
          mesInicio: Number(mesInicio),
          hhReal: Number(hh) || 0,
        }),
      }),
    onSuccess: () => {
      toast(isNew ? 'Mantención creada' : 'Mantención actualizada');
      onSaved();
    },
    onError: () => toast('No se pudo guardar la mantención', 'error'),
  });

  const del = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task!.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation: 'ELIMINAR' }) }),
    onSuccess: () => {
      toast('Mantención eliminada');
      onSaved();
    },
    onError: () => toast('No se pudo eliminar', 'error'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nueva mantención' : 'Editar mantención'}</DialogTitle>
        </DialogHeader>
        {!isNew && task.posicionMant && (
          <p className="-mt-2 font-mono text-xs text-ds-muted">ID #{task.posicionMant}</p>
        )}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (titulo.trim()) save.mutate();
          }}
        >
          <Labeled label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ej. Calibración válvula de seguridad" />
          </Labeled>
          <Labeled label="Descripción (opcional)">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text"
              placeholder="Detalles, instrucciones, observaciones…"
            />
          </Labeled>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Tipo">
              <NativeSelect value={tipo} onChange={(v) => setTipo(v as MaintType)}>
                <option value="PREVENTIVA">Preventiva</option>
                <option value="CORRECTIVA">Correctiva</option>
                <option value="PREDICTIVA">Predictiva</option>
              </NativeSelect>
            </Labeled>
            <Labeled label="Frecuencia">
              <NativeSelect value={frecuencia} onChange={setFrecuencia}>
                {FREQUENCIES.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </Labeled>
            <Labeled label="Mes de inicio">
              <NativeSelect value={mesInicio} onChange={setMesInicio}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
            </Labeled>
            <Labeled label="HH estimadas">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={hh}
                onChange={(e) => setHh(e.target.value)}
              />
            </Labeled>
          </div>
          <Labeled label="Responsable (opcional)">
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del responsable" />
          </Labeled>

          <DialogFooter className="mt-1 gap-2">
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto border-danger/40 text-danger hover:bg-danger-dim"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !titulo.trim()}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {!isNew && (
        <ConfirmDialog
          open={confirmDel}
          title="¿Eliminar esta mantención?"
          detail="Quedará desactivada y recuperable desde auditoría."
          confirmLabel="Eliminar"
          danger
          pending={del.isPending}
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => del.mutate()}
        />
      )}
    </Dialog>
  );
}

/* ---------- Ajustes ---------- */

function PlantSettingsDialog({
  plant,
  onClose,
  onSaved,
}: {
  plant: PlantDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plant.name);
  const [status, setStatus] = useState<PlantStatus>(plant.status);
  const save = useMutation({
    mutationFn: () =>
      api(`/api/plantas/${plant.psr}`, { method: 'PATCH', body: JSON.stringify({ name, status }) }),
    onSuccess: () => {
      toast('Ajustes guardados');
      onSaved();
    },
    onError: () => toast('No se pudo guardar', 'error'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustes de la planta</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Labeled label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Labeled>
          <Labeled label="Estado">
            <NativeSelect value={status} onChange={(v) => setStatus(v as PlantStatus)}>
              <option value="ACTIVE">Activa</option>
              <option value="STANDBY">Standby</option>
              <option value="INACTIVE">Inactiva</option>
            </NativeSelect>
          </Labeled>
          <DialogFooter className="mt-1 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Confirm ---------- */

function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel,
  danger,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ds-muted">{detail}</p>
        <DialogFooter className="mt-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending}
            className={danger ? 'bg-danger text-white hover:bg-danger/90' : undefined}
            onClick={onConfirm}
          >
            {pending ? 'Procesando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- UI bits ---------- */

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <article
      className={`rounded-xl border bg-[var(--color-surface)] p-3 ${
        tone === 'danger' ? 'border-danger/30' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-ds-muted">
        <p className="text-[10px] uppercase tracking-[0.16em]">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-text'}`}>
        {value}
      </p>
    </article>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'border-ds-accent text-text' : 'border-transparent text-ds-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm ${
        value ? 'text-text' : 'text-ds-muted'
      }`}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text"
    >
      {children}
    </select>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-ds-muted">
      {label}
      {children}
    </label>
  );
}

function TypeChip({ tipo }: { tipo: MaintType }) {
  const m = TYPE_META[tipo];
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

function ExecChip({ status, dueDate }: { status: ExecStatus; dueDate?: string }) {
  const meta: Record<ExecStatus, { label: string; cls: string }> = {
    OVERDUE: { label: 'Vencida', cls: 'bg-red-100 text-red-800' },
    PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
    DONE: { label: 'Al día', cls: 'bg-emerald-100 text-emerald-800' },
    SKIPPED: { label: 'Omitida', cls: 'bg-slate-200 text-slate-700' },
  };
  const m = meta[status];
  return (
    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
      {m.label}
      {dueDate && (status === 'PENDING' || status === 'OVERDUE') ? ` · ${dateFormat.format(new Date(dueDate))}` : ''}
    </span>
  );
}

function PlantStatusChip({ status }: { status: PlantStatus }) {
  const m: Record<PlantStatus, { label: string; cls: string }> = {
    ACTIVE: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-800' },
    STANDBY: { label: 'Standby', cls: 'bg-amber-100 text-amber-800' },
    INACTIVE: { label: 'Inactiva', cls: 'bg-slate-200 text-slate-700' },
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${m[status].cls}`}>{m[status].label}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
      <p className="font-semibold text-text">{title}</p>
      <p className="mt-1 text-sm text-ds-muted">{detail}</p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Pencil, Plus, SkipForward, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hh as fmtHh, int, dateFormat } from '@/lib/i18n/formatters';
import { plantStatusLabels } from '@datos/shared-types';
import { PlantCalendarHeatmap } from '../../_components/PlantCalendarHeatmap';

type PlantStatus = 'ACTIVE' | 'STANDBY' | 'INACTIVE';
type ExecStatus = 'PENDING' | 'OVERDUE' | 'DONE' | 'SKIPPED';

interface PlantDetail {
  id: string;
  psr: string;
  name: string;
  status: PlantStatus;
  aliases: Array<{ id: string; alias: string; source: string }>;
  maintenanceTasks: TaskRow[];
  kpis: {
    maintenanceTaskCount: number;
    hhBase: number;
    nextDueDate: string | null;
    statusCounts: Array<{ status: ExecStatus; count: number; hhPlanned: number; hhActual: number }>;
  };
}

interface TaskRow {
  id: string;
  plantId: string | null;
  descPosicionMant: string | null;
  denomUbicacionTecnica: string | null;
  equipo: string | null;
  denomObjetoTecnico: string | null;
  frecuenciaCodigo: string | null;
  frecuenciaMeses: number | null;
  mesInicio: number | null;
  hhReal: string | number | null;
  manualOverride: boolean;
  schedule: Array<{ year: number; month: number; hh: string | number; source: string }>;
  executions: Array<{ id: string; dueDate: string; status: ExecStatus; hhPlanned: string | number; hhActual: string | number | null; notes: string | null }>;
}

const DATE = dateFormat;

const FREQUENCIES = [
  { code: '1M', label: 'Mensual', months: 1 },
  { code: '6M', label: 'Semestral', months: 6 },
  { code: '1A', label: 'Anual', months: 12 },
  { code: '5A', label: 'Quinquenal', months: 60 },
];

export default function PlantDetailPage() {
  const params = useParams<{ psr: string }>();
  const psr = decodeURIComponent(params.psr);
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<TaskRow | 'new' | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskRow | null>(null);

  const plant = useQuery({
    queryKey: ['plant-detail', psr],
    queryFn: () => api<PlantDetail>(`/api/plantas/${encodeURIComponent(psr)}`),
  });

  const row = plant.data;
  const status = statusMap(row?.kpis.statusCounts ?? []);
  const upcoming = useMemo(
    () =>
      (row?.maintenanceTasks ?? [])
        .flatMap((task) => task.executions.map((execution) => ({ ...execution, task })))
        .filter((execution) => execution.status === 'PENDING' || execution.status === 'OVERDUE')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 12),
    [row],
  );

  if (plant.isLoading) return <div className="skeleton h-80 rounded-xl" />;
  if (!row) return <PanelState title="No se pudo cargar la planta" detail="Revisa sesión, permisos o disponibilidad del API." />;

  return (
    <div className="flex flex-col gap-5 fade-up">
      <header className="flex flex-col gap-3">
        <Link href="/dashboard/plantas" className="inline-flex w-fit items-center gap-2 text-sm text-ds-muted hover:text-text">
          <ArrowLeft className="size-4" />
          Plantas
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-text">{row.name}</h1>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-sm text-ds-muted">
              <span className="font-mono">{row.psr}</span> · {row.aliases.length} alias{row.aliases.length === 1 ? '' : 'es'} · {int(row.maintenanceTasks.length)} tareas
            </p>
            <p className="mt-0.5 text-xs text-ds-muted">{plantStatusLabels[row.status] ?? row.status}</p>
          </div>
          <Button onClick={() => setEditingTask('new')}>
            <Plus className="size-4" />
            Agregar tarea
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Tareas" value={int(row.kpis.maintenanceTaskCount)} icon={<ClipboardList className="size-4" />} />
        <Metric title="HH base" value={fmtHh(row.kpis.hhBase)} icon={<Pencil className="size-4" />} />
        <Metric title="Pendientes" value={int((status.PENDING ?? 0) + (status.OVERDUE ?? 0))} icon={<CalendarClock className="size-4" />} />
        <Metric title="Completadas" value={int(status.DONE ?? 0)} icon={<CheckCircle2 className="size-4" />} />
        <Metric title="Omitidas" value={int(status.SKIPPED ?? 0)} icon={<SkipForward className="size-4" />} />
      </section>

      <Tabs defaultValue="tareas">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="resumen" className="min-h-[40px]">Resumen</TabsTrigger>
            <TabsTrigger value="tareas" className="min-h-[40px]">Tareas</TabsTrigger>
            <TabsTrigger value="cronograma" className="min-h-[40px]">Cronograma</TabsTrigger>
            <TabsTrigger value="ajustes" className="min-h-[40px]">Ajustes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="mt-4">
          <div className="mb-4">
            <PlantCalendarHeatmap
              executions={row.maintenanceTasks.flatMap((t) =>
                t.executions.map((e) => ({
                  id: e.id,
                  dueDate: e.dueDate,
                  status: e.status,
                  hhPlanned: e.hhPlanned,
                })),
              )}
            />
          </div>
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold text-text">Frecuencias</h2>
              <div className="mt-3 grid gap-2">
                {FREQUENCIES.map((freq) => {
                  const count = row.maintenanceTasks.filter((task) => task.frecuenciaCodigo === freq.code).length;
                  return <StatLine key={freq.code} label={freq.label} value={`${int(count)} tareas`} />;
                })}
              </div>
            </article>
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold text-text">Próximas actividades</h2>
              <div className="mt-3 grid gap-2">
                {upcoming.slice(0, 6).map((execution) => (
                  <div key={execution.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-text">{execution.task.descPosicionMant ?? 'Sin descripción'}</p>
                      <ExecutionBadge status={execution.status} />
                    </div>
                    <p className="mt-1 text-xs text-ds-muted">{DATE.format(new Date(execution.dueDate))} · {labelFrequency(execution.task.frecuenciaCodigo)}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </TabsContent>

        <TabsContent value="tareas" className="mt-4">
          <section className="grid gap-3">
            {row.maintenanceTasks.map((task) => (
              <TaskCard key={task.id} task={task} onEdit={() => setEditingTask(task)} onDelete={() => setDeletingTask(task)} />
            ))}
          </section>
        </TabsContent>

        <TabsContent value="cronograma" className="mt-4">
          <section className="grid gap-3">
            {upcoming.map((execution) => (
              <ExecutionCard key={execution.id} execution={execution} onSaved={() => queryClient.invalidateQueries({ queryKey: ['plant-detail', psr] })} />
            ))}
            {upcoming.length === 0 && <PanelState title="Sin ejecuciones próximas" detail="Agrega tareas o revisa la frecuencia/mes de inicio." />}
          </section>
        </TabsContent>

        <TabsContent value="ajustes" className="mt-4">
          <PlantSettings plant={row} onSaved={() => queryClient.invalidateQueries({ queryKey: ['plant-detail', psr] })} />
        </TabsContent>
      </Tabs>

      {editingTask && (
        <TaskEditor
          plant={row}
          task={editingTask === 'new' ? null : editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['plant-detail', psr] });
            queryClient.invalidateQueries({ queryKey: ['plantas'] });
            setEditingTask(null);
          }}
        />
      )}
      {deletingTask && (
        <DeleteTaskDialog
          task={deletingTask}
          onClose={() => setDeletingTask(null)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['plant-detail', psr] });
            queryClient.invalidateQueries({ queryKey: ['plantas'] });
            setDeletingTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete }: { task: TaskRow; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-text">{task.descPosicionMant ?? 'Sin descripción'}</h2>
            <Badge variant="outline">{labelFrequency(task.frecuenciaCodigo)}</Badge>
            {task.manualOverride && <Badge variant="outline">Manual</Badge>}
          </div>
          <p className="mt-1 text-sm text-ds-muted">{task.denomUbicacionTecnica ?? 'Sin ubicación'} · {task.equipo ?? 'Sin equipo'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="size-4" />Editar</Button>
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="size-4" />Eliminar</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <StatBox label="HH base" value={fmtHh(Number(task.hhReal ?? 0))} />
        <StatBox label="Mes inicio" value={task.mesInicio ? String(task.mesInicio) : '—'} />
        <StatBox label="Eventos" value={int(task.schedule.length)} />
        <StatBox label="Próximas" value={int(task.executions.length)} />
      </div>
    </article>
  );
}

function ExecutionCard({ execution, onSaved }: { execution: TaskRow['executions'][number] & { task: TaskRow }; onSaved: () => void }) {
  const save = useMutation({
    mutationFn: (status: ExecStatus) =>
      api(`/api/schedule/executions/${execution.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: onSaved,
  });
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium text-text">{execution.task.descPosicionMant ?? 'Sin descripción'}</p>
          <p className="mt-1 text-sm text-ds-muted">{DATE.format(new Date(execution.dueDate))} · {labelFrequency(execution.task.frecuenciaCodigo)} · {fmtHh(Number(execution.hhPlanned))} HH</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExecutionBadge status={execution.status} />
          <Button variant="outline" size="sm" onClick={() => save.mutate('DONE')} disabled={save.isPending}>Completar</Button>
          <Button variant="outline" size="sm" onClick={() => save.mutate('SKIPPED')} disabled={save.isPending}>Omitir</Button>
        </div>
      </div>
    </article>
  );
}

function TaskEditor({ plant, task, onClose, onSaved }: { plant: PlantDetail; task: TaskRow | null; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(task?.descPosicionMant ?? '');
  const [location, setLocation] = useState(task?.denomUbicacionTecnica ?? '');
  const [equipment, setEquipment] = useState(task?.equipo ?? '');
  const [frequency, setFrequency] = useState(task?.frecuenciaCodigo ?? '1A');
  const [startMonth, setStartMonth] = useState(String(task?.mesInicio ?? 1));
  const [hh, setHh] = useState(String(task?.hhReal ?? 0));
  const selected = FREQUENCIES.find((item) => item.code === frequency) ?? FREQUENCIES[2];
  const save = useMutation({
    mutationFn: () =>
      api(task ? `/api/tasks/${task.id}` : '/api/tasks', {
        method: task ? 'PATCH' : 'POST',
        body: JSON.stringify({
          plantId: plant.id,
          descPosicionMant: description,
          denomUbicacionTecnica: location || plant.name,
          ubicacionTecnica: location || plant.name,
          equipo: equipment,
          denomObjetoTecnico: equipment,
          frecuenciaCodigo: frequency,
          frecuenciaMeses: selected?.months ?? 12,
          mesInicio: Number(startMonth),
          hhReal: Number(hh),
        }),
      }),
    onSuccess: onSaved,
  });
  return (
    <Modal title={task ? 'Editar tarea' : 'Agregar tarea'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Field label="Descripción"><Input value={description} onChange={(event) => setDescription(event.target.value)} required /></Field>
        <Field label="Ubicación"><Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={plant.name} /></Field>
        <Field label="Equipo"><Input value={equipment} onChange={(event) => setEquipment(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Frecuencia">
            <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text">
              {FREQUENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Mes inicio"><Input type="number" min={1} max={12} value={startMonth} onChange={(event) => setStartMonth(event.target.value)} /></Field>
          <Field label="HH base"><Input type="number" min={0} step="0.1" value={hh} onChange={(event) => setHh(event.target.value)} /></Field>
        </div>
        {save.isError && <p className="text-sm text-danger">No se pudo guardar la tarea.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteTaskDialog({ task, onClose, onDeleted }: { task: TaskRow; onClose: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const remove = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      }),
    onSuccess: onDeleted,
  });
  return (
    <Modal title="Eliminar tarea" onClose={onClose}>
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
        <p className="text-sm text-ds-muted">La tarea se desactivará y quedará recuperable en auditoría. Escribe <strong className="text-text">ELIMINAR</strong> para confirmar.</p>
        <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="ELIMINAR" />
        {remove.isError && <p className="text-sm text-danger">Confirmación inválida o sin permisos.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={confirmation !== 'ELIMINAR' || remove.isPending}>Eliminar</Button>
        </div>
      </form>
    </Modal>
  );
}

function PlantSettings({ plant, onSaved }: { plant: PlantDetail; onSaved: () => void }) {
  const [name, setName] = useState(plant.name);
  const [status, setStatus] = useState<PlantStatus>(plant.status);
  const [aliases, setAliases] = useState(plant.aliases.map((item) => item.alias).join('\n'));
  const save = useMutation({
    mutationFn: () =>
      api(`/api/plantas/${plant.psr}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, status, aliases: aliases.split('\n').map((item) => item.trim()).filter(Boolean) }),
      }),
    onSuccess: onSaved,
  });
  return (
    <form className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
      <Field label="Nombre visible"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Estado">
        <select value={status} onChange={(event) => setStatus(event.target.value as PlantStatus)} className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-text">
          <option value="ACTIVE">Activa</option>
          <option value="STANDBY">Standby</option>
          <option value="INACTIVE">Inactiva</option>
        </select>
      </Field>
      <Field label="Aliases">
        <textarea value={aliases} onChange={(event) => setAliases(event.target.value)} rows={7} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text" />
      </Field>
      <div><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar ajustes'}</Button></div>
    </form>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
      <section className="w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm text-ds-muted">{label}{children}</label>;
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="flex items-center justify-between gap-2 text-ds-muted"><p className="text-[11px] uppercase tracking-[0.18em]">{title}</p>{icon}</div><p className="mt-4 text-2xl font-semibold text-text tabular-nums">{value}</p></article>;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"><p className="text-xs text-ds-muted">{label}</p><p className="mt-1 font-semibold text-text tabular-nums">{value}</p></div>;
}

function StatLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm"><span className="font-medium text-text">{label}</span><span className="text-ds-muted">{value}</span></div>;
}

function PanelState({ title, detail }: { title: string; detail: string }) {
  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center"><h2 className="font-semibold text-text">{title}</h2><p className="mt-2 text-sm text-ds-muted">{detail}</p></section>;
}

function StatusBadge({ status }: { status: PlantStatus }) {
  const label = status === 'ACTIVE' ? 'Activa' : status === 'STANDBY' ? 'Standby' : 'Inactiva';
  return <Badge variant="outline">{label}</Badge>;
}

function ExecutionBadge({ status }: { status: ExecStatus }) {
  const label = status === 'DONE' ? 'Completada' : status === 'SKIPPED' ? 'Omitida' : status === 'OVERDUE' ? 'Vencida' : 'Pendiente';
  return <Badge variant="outline">{label}</Badge>;
}

function statusMap(rows: PlantDetail['kpis']['statusCounts']) {
  return Object.fromEntries(rows.map((row) => [row.status, row.count])) as Partial<Record<ExecStatus, number>>;
}

function labelFrequency(value: string | null) {
  if (value === '1M') return 'Mensual';
  if (value === '6M') return 'Semestral';
  if (value === '1A') return 'Anual';
  if (value === '5A') return 'Quinquenal';
  return value ?? 'Sin frecuencia';
}

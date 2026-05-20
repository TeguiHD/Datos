'use client';

import { useMemo } from 'react';
import { dateFormat, int } from '@/lib/i18n/formatters';
import { execStatusLabels } from '@datos/shared-types';

type ExecStatus = 'PENDING' | 'OVERDUE' | 'DONE' | 'SKIPPED';

interface Execution {
  id: string;
  dueDate: string;
  status: ExecStatus;
  hhPlanned: string | number;
}

interface Props {
  executions: Execution[];
  days?: number;
}

const STATUS_RANK: Record<ExecStatus, number> = {
  OVERDUE: 4,
  PENDING: 3,
  DONE: 2,
  SKIPPED: 1,
};

const STATUS_COLOR: Record<ExecStatus, string> = {
  OVERDUE: 'var(--color-danger, #dc2626)',
  PENDING: 'var(--color-warn, #d97706)',
  DONE: 'var(--color-ok, #059669)',
  SKIPPED: 'var(--color-border, #94a3b8)',
};

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function PlantCalendarHeatmap({ executions, days = 90 }: Props) {
  const grid = useMemo(() => {
    const today = startOfUtcDay(new Date());
    const cells: Array<{
      date: Date;
      key: string;
      executions: Execution[];
    }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() + i);
      cells.push({ date: d, key: dayKey(d), executions: [] });
    }
    const map = new Map(cells.map((c) => [c.key, c]));
    for (const exec of executions) {
      const d = startOfUtcDay(new Date(exec.dueDate));
      const cell = map.get(dayKey(d));
      if (cell) cell.executions.push(exec);
    }
    return cells;
  }, [executions, days]);

  const maxCount = Math.max(1, ...grid.map((c) => c.executions.length));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-text">Calendario {days} días</h2>
        <p className="text-xs text-ds-muted">Color por estado dominante · tamaño por nº ejecuciones</p>
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(days, 30)}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Heatmap calendario próximos días"
      >
        {grid.map((cell) => {
          const dominant = cell.executions.reduce<ExecStatus | null>((acc, e) => {
            if (!acc) return e.status;
            return STATUS_RANK[e.status] > STATUS_RANK[acc] ? e.status : acc;
          }, null);
          const color = dominant ? STATUS_COLOR[dominant] : 'var(--color-surface-2, #f1f5f9)';
          const intensity = cell.executions.length / maxCount;
          const opacity = cell.executions.length === 0 ? 0.3 : 0.4 + 0.6 * intensity;
          const breakdown = cell.executions.reduce<Record<ExecStatus, number>>(
            (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
            { OVERDUE: 0, PENDING: 0, DONE: 0, SKIPPED: 0 },
          );
          const title = [
            dateFormat.format(cell.date),
            cell.executions.length > 0
              ? Object.entries(breakdown)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => `${execStatusLabels[k as ExecStatus]} ${int(n)}`)
                  .join(' · ')
              : 'Sin actividad',
          ].join(' — ');
          return (
            <div
              key={cell.key}
              role="gridcell"
              title={title}
              aria-label={title}
              className="aspect-square rounded-sm"
              style={{ backgroundColor: color, opacity }}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-ds-muted">
        {(Object.keys(STATUS_COLOR) as ExecStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden />
            {execStatusLabels[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

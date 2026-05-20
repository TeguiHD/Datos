'use client';

import { Fragment, useMemo } from 'react';
import { execStatusLabels } from '@datos/shared-types';

type ExecStatus = 'PENDING' | 'OVERDUE' | 'DONE' | 'SKIPPED';

interface Cell {
  year: number;
  month: number;
  status: ExecStatus;
  hhPlanned: number;
}

export interface MatrixRow {
  id: string;
  label: string;
  location: string | null;
  abc: string | null;
  frecuencia: string | null;
  plant: { id: string; name: string } | null;
  cells: Cell[];
}

interface Props {
  rows: MatrixRow[];
  year: number;
  loading?: boolean;
}

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS_FULL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATUS_STYLE: Record<ExecStatus, string> = {
  OVERDUE: 'bg-danger text-white',
  PENDING: 'bg-warn text-white',
  DONE: 'bg-ok text-white',
  SKIPPED: 'bg-[var(--color-border)] text-ds-muted',
};

const STATUS_DOT: Record<ExecStatus, string> = {
  OVERDUE: 'bg-danger',
  PENDING: 'bg-warn',
  DONE: 'bg-ok',
  SKIPPED: 'bg-[var(--color-border)]',
};

function cellMap(cells: Cell[], year: number): Map<number, Cell> {
  const m = new Map<number, Cell>();
  for (const c of cells) {
    if (c.year === year) m.set(c.month, c);
  }
  return m;
}

export function CronogramaMatrix({ rows, year, loading }: Props) {
  const groups = useMemo(() => {
    const byPlant = new Map<string, { name: string; rows: MatrixRow[] }>();
    for (const row of rows) {
      const key = row.plant?.id ?? '__none__';
      const name = row.plant?.name ?? 'Sin planta';
      if (!byPlant.has(key)) byPlant.set(key, { name, rows: [] });
      byPlant.get(key)!.rows.push(row);
    }
    return [...byPlant.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (loading) {
    return <div className="skeleton h-72 w-full rounded-xl" />;
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-center text-sm text-ds-muted">
        Sin tareas para el filtro seleccionado.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Desktop: tabla matriz */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--color-surface-2)]">
              <th className="sticky left-0 z-10 bg-[var(--color-surface-2)] px-3 py-2 text-left font-medium text-ds-muted">
                Tarea
              </th>
              {MONTHS_FULL.map((m, i) => (
                <th key={i} className="w-12 px-1 py-2 text-center font-medium text-ds-muted">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.name}>
                <tr>
                  <td
                    colSpan={13}
                    className="sticky left-0 bg-[var(--color-surface-2)]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ds-muted"
                  >
                    {group.name} · {group.rows.length}
                  </td>
                </tr>
                {group.rows.map((row) => {
                  const map = cellMap(row.cells, year);
                  return (
                    <tr key={row.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50">
                      <td className="sticky left-0 z-10 max-w-[18rem] bg-[var(--color-surface)] px-3 py-1.5">
                        <p className="truncate font-medium text-text" title={row.label}>{row.label}</p>
                        <p className="truncate text-[11px] text-ds-muted">
                          {row.abc ? `ABC ${row.abc} · ` : ''}{row.frecuencia ?? '—'}{row.location ? ` · ${row.location}` : ''}
                        </p>
                      </td>
                      {MONTHS.map((_, i) => {
                        const cell = map.get(i + 1);
                        return (
                          <td key={i} className="px-1 py-1.5 text-center">
                            {cell ? (
                              <span
                                className={`mx-auto flex h-6 w-9 items-center justify-center rounded text-[10px] font-semibold ${STATUS_STYLE[cell.status]}`}
                                title={`${MONTHS_FULL[i]} ${year} · ${execStatusLabels[cell.status]}`}
                              >
                                {row.frecuencia ?? '•'}
                              </span>
                            ) : (
                              <span className="mx-auto block h-6 w-9 rounded bg-[var(--color-surface-2)]/40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards por tarea con tira de 12 meses */}
      <ul className="divide-y divide-[var(--color-border)] md:hidden" role="list">
        {groups.map((group) => (
          <Fragment key={group.name}>
            <li className="bg-[var(--color-surface-2)]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
              {group.name} · {group.rows.length}
            </li>
            {group.rows.map((row) => {
              const map = cellMap(row.cells, year);
              return (
                <li key={row.id} className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-text" title={row.label}>{row.label}</p>
                  <p className="truncate text-[11px] text-ds-muted">
                    {row.abc ? `ABC ${row.abc} · ` : ''}{row.frecuencia ?? '—'}{row.location ? ` · ${row.location}` : ''}
                  </p>
                  <div className="mt-1.5 grid grid-cols-12 gap-0.5" aria-label={`Cronograma ${year}`}>
                    {MONTHS.map((m, i) => {
                      const cell = map.get(i + 1);
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-ds-muted">{m}</span>
                          <span
                            className={`h-4 w-full rounded-sm ${cell ? STATUS_DOT[cell.status] : 'bg-[var(--color-surface-2)]'}`}
                            title={cell ? `${MONTHS_FULL[i]} · ${execStatusLabels[cell.status]}` : MONTHS_FULL[i]}
                          />
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </Fragment>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] p-3 text-xs text-ds-muted">
        {(Object.keys(STATUS_DOT) as ExecStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm ${STATUS_DOT[s]}`} aria-hidden />
            {execStatusLabels[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

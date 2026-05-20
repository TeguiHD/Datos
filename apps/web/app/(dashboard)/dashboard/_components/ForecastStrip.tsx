'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { hh as fmtHh, int } from '@/lib/i18n/formatters';

interface Upcoming {
  count: number;
  totalHh: number;
}

function useForecast(days: number) {
  return useQuery({
    queryKey: ['forecast', days],
    queryFn: () => api<Upcoming>(`/api/schedule/upcoming?days=${days}`),
  });
}

export function ForecastStrip() {
  const seven = useForecast(7);
  const thirty = useForecast(30);
  const ninety = useForecast(90);

  const items = [
    { days: 7, q: seven },
    { days: 30, q: thirty },
    { days: 90, q: ninety },
  ];
  const maxCount = Math.max(1, ...items.map((it) => it.q.data?.count ?? 0));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-text">Carga prevista</h2>
        <p className="text-xs text-ds-muted">Próximos días</p>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3" role="list">
        {items.map(({ days, q }) => {
          const count = q.data?.count ?? 0;
          const totalHh = q.data?.totalHh ?? 0;
          const pct = (count / maxCount) * 100;
          return (
            <li
              key={days}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 sm:p-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.16em] text-ds-muted">{days}d</span>
                <span className="hidden text-xs text-ds-muted sm:inline">{q.isLoading ? '…' : fmtHh(totalHh)} HH</span>
              </div>
              <p className="mt-1 text-xl font-semibold text-text tabular-nums sm:text-2xl">
                {q.isLoading ? '—' : int(count)}
              </p>
              <p className="text-[11px] text-ds-muted sm:text-xs">ejec. · {q.isLoading ? '…' : fmtHh(totalHh)} HH</p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-valuenow={count}
                aria-label={`Carga ${days} días`}
              >
                <div
                  className="h-full rounded-full bg-ds-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

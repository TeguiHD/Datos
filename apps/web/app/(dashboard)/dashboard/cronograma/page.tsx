'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

interface HeatCell {
  year: number;
  month: number;
  totalHh: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const NOW_YEAR = new Date().getUTCFullYear();

function shade(hh: number, max: number) {
  if (hh <= 0 || max <= 0) return 'bg-slate-50';
  const t = Math.min(1, hh / max);
  if (t < 0.2) return 'bg-blue-100';
  if (t < 0.4) return 'bg-blue-200';
  if (t < 0.6) return 'bg-blue-400 text-white';
  if (t < 0.8) return 'bg-blue-600 text-white';
  return 'bg-blue-800 text-white';
}

export default function Cronograma() {
  const [from, setFrom] = useState(2022);
  const [to, setTo] = useState(NOW_YEAR + 10);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['heatmap', from, to],
    queryFn: () => api<HeatCell[]>(`/api/schedule/heatmap?from=${from}&to=${to}`),
  });

  const is2faError =
    error instanceof ApiError &&
    error.status === 403 &&
    (error.body as { message?: string })?.message === '2FA required';

  const max = Math.max(1, ...(data?.map((c) => c.totalHh) ?? [0]));
  const lookup = new Map<string, number>();
  for (const c of data ?? []) lookup.set(`${c.year}-${c.month}`, c.totalHh);

  const years: number[] = [];
  for (let y = from; y <= to; y++) years.push(y);

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-semibold">Cronograma</h1>
      {is2faError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Debes completar verificación 2FA para consultar cronograma.
        </div>
      )}
      <p className="text-sm text-slate-600">
        Carga mensual de HH planificadas (Excel + proyecciones calculadas). Intensidad proporcional al máximo del rango.
      </p>
      <div className="flex gap-3 items-end">
        <label className="text-xs text-slate-600 flex flex-col">
          Desde
          <input
            type="number"
            min={2000}
            max={2100}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>
        <label className="text-xs text-slate-600 flex flex-col">
          Hasta
          <input
            type="number"
            min={2000}
            max={2100}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>
      </div>

      <div className="bg-white border rounded-xl p-4 overflow-x-auto transition-shadow duration-200 hover:shadow-sm">
        {isError ? (
          <p className="text-sm text-red-700 py-6 text-center">No se pudo cargar el cronograma para este rango.</p>
        ) : (
        <table className="text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left"></th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-1 font-medium text-slate-500">
                  {m}
                </th>
              ))}
              <th className="px-2 py-1 font-medium text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`sk-${idx}`}>
                    <td className="px-2 py-1">
                      <div className="skeleton h-5 w-10 rounded" />
                    </td>
                    {MONTHS.map((m) => (
                      <td key={`${idx}-${m}`} className="px-2 py-1">
                        <div className="skeleton h-6 w-10 rounded" />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <div className="skeleton h-5 w-12 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              : years.map((y) => {
              const rowTotal = MONTHS.reduce((acc, _, i) => acc + (lookup.get(`${y}-${i + 1}`) ?? 0), 0);
              return (
                <tr key={y}>
                  <td className={`px-2 py-1 font-semibold ${y === NOW_YEAR ? 'text-blue-700' : ''}`}>{y}</td>
                  {MONTHS.map((_, i) => {
                    const hh = lookup.get(`${y}-${i + 1}`) ?? 0;
                    return (
                      <td
                        key={i}
                        className={`px-2 py-2 text-center tabular-nums rounded-sm ${shade(hh, max)}`}
                        title={`${y}-${i + 1}: ${hh} HH`}
                      >
                        {hh > 0 ? hh.toFixed(0) : ''}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 font-semibold text-right">{rowTotal.toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils/cn';

type Tone = 'danger' | 'warn' | 'ok' | 'accent' | 'neutral';

const TONE_CLASSES: Record<Tone, { border: string; value: string; stroke: string }> = {
  danger: { border: 'border-l-danger', value: 'text-danger', stroke: 'var(--color-danger)' },
  warn: { border: 'border-l-warn', value: 'text-warn', stroke: 'var(--color-warn)' },
  ok: { border: 'border-l-ok', value: 'text-ok', stroke: 'var(--color-ok)' },
  accent: { border: 'border-l-ds-accent', value: 'text-ds-accent', stroke: 'var(--color-accent)' },
  neutral: { border: 'border-l-[var(--color-border)]', value: 'text-text', stroke: 'var(--color-text-muted)' },
};

interface KpiCardProps {
  title: string;
  value: number | string;
  tone?: Tone;
  loading?: boolean;
  delta?: number;
  sparkline?: number[];
}

export function KpiCard({ title, value, tone = 'neutral', loading, delta, sparkline }: KpiCardProps) {
  const toneConfig = TONE_CLASSES[tone];
  const sparkData = (sparkline ?? []).map((point, index) => ({ index, value: point }));
  const deltaSign = delta !== undefined && delta > 0 ? '+' : '';
  const deltaColor = delta === undefined ? '' : delta > 0 ? 'text-ok' : delta < 0 ? 'text-danger' : 'text-ds-muted';

  return (
    <div
      className={cn(
        'relative min-w-[140px] shrink-0 rounded-xl border border-l-4 border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:min-w-0 sm:shrink',
        toneConfig.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase leading-none tracking-wide text-ds-muted">{title}</p>
        {delta !== undefined && !loading && (
          <span className={cn('text-[10px] font-semibold tabular-nums', deltaColor)}>
            {deltaSign}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={cn('text-2xl font-semibold tabular-nums', toneConfig.value)}>
          {loading ? <span className="skeleton inline-block h-8 w-16 rounded-md" /> : value}
        </div>

        {sparkData.length > 0 && !loading && (
          <div className="h-8 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="value" stroke={toneConfig.stroke} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

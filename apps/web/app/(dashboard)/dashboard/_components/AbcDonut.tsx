'use client';

import { cn } from '@/lib/utils/cn';
import { int } from '@/lib/i18n/formatters';

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

// Donut SVG sin dependencias. Maneja 0 valores con anillo gris.
export function AbcDonut({ slices, size = 160, thickness = 22, centerLabel, centerValue, className }: Props) {
  const total = slices.reduce((acc, s) => acc + (s.value > 0 ? s.value : 0), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Distribución ABC, total ${int(total)}`}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-border, #e2e8f0)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            slices.map((s) => {
              if (s.value <= 0) return null;
              const length = (s.value / total) * circumference;
              const dashArray = `${length} ${circumference - length}`;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  strokeLinecap="butt"
                />
              );
            })}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-text font-semibold tabular-nums"
            fontSize={size > 140 ? 24 : 18}
          >
            {centerValue ?? int(total)}
          </text>
          {centerLabel && (
            <text x={cx} y={cy + 16} textAnchor="middle" className="fill-current text-ds-muted" fontSize={11}>
              {centerLabel}
            </text>
          )}
        </svg>
      </div>
      <ul className="grid w-full grid-cols-2 gap-1.5 text-xs">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.key} className="flex items-center gap-2 min-w-0">
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="truncate text-text">{s.label}</span>
              <span className="ml-auto tabular-nums text-ds-muted">
                {int(s.value)} · {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

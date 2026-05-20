'use client';

import { cn } from '@/lib/utils/cn';
import { percentFormat } from '@/lib/i18n/formatters';

interface Props {
  value: number; // 0..1
  label: string;
  detail?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Gauge semicircular SVG sin dependencias.
// Color por tramos: <70% danger, 70-90% warn, >=90% ok.
export function ComplianceGauge({ value, label, detail, size = 'md', className }: Props) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const dims = size === 'sm' ? { w: 120, h: 70, sw: 10, r: 50 } : size === 'lg' ? { w: 220, h: 130, sw: 16, r: 96 } : { w: 160, h: 95, sw: 12, r: 70 };
  const cx = dims.w / 2;
  const cy = dims.h - dims.sw / 2;
  const r = dims.r;
  const arc = (start: number, end: number) => describeArc(cx, cy, r, start, end);
  const sweep = -180 * clamped; // semicirculo izq->der
  const color = clamped < 0.7 ? 'var(--color-danger, #dc2626)' : clamped < 0.9 ? 'var(--color-warn, #d97706)' : 'var(--color-ok, #059669)';
  const tone = clamped < 0.7 ? 'text-danger' : clamped < 0.9 ? 'text-warn' : 'text-ok';

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <svg
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        width={dims.w}
        height={dims.h}
        role="img"
        aria-label={`${label}: ${percentFormat.format(clamped)}`}
      >
        <path
          d={arc(-180, 0)}
          fill="none"
          stroke="var(--color-border, #e2e8f0)"
          strokeWidth={dims.sw}
          strokeLinecap="round"
        />
        {clamped > 0 && (
          <path
            d={arc(-180, -180 + 180 * clamped)}
            fill="none"
            stroke={color}
            strokeWidth={dims.sw}
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" className={cn('fill-current font-semibold tabular-nums', tone)} fontSize={size === 'lg' ? 28 : size === 'md' ? 22 : 16}>
          {percentFormat.format(clamped)}
        </text>
      </svg>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-ds-muted">{detail}</p>}
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

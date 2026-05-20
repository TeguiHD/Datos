'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/estadisticas', label: 'Estadísticas' },
  { href: '/dashboard/analytics', label: 'Tendencias' },
  { href: '/dashboard/graficos', label: 'Gráficos IA' },
];

// Pestañas que unifican las tres vistas de análisis bajo una sola sección.
export function AnalysisTabs() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 overflow-x-auto border-b border-[var(--color-border)] px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 sm:w-auto">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'border-ds-accent text-text' : 'border-transparent text-ds-muted hover:text-text'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

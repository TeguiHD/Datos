'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ClipboardList, Factory, Layers, Sun } from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
};

const ITEMS: Item[] = [
  { href: '/dashboard/hoy', label: 'Hoy', icon: Sun, match: (p) => p.startsWith('/dashboard/hoy') },
  { href: '/dashboard/semana', label: 'Semana', icon: CalendarClock, match: (p) => p.startsWith('/dashboard/semana') },
  { href: '/dashboard/tareas', label: 'Tareas', icon: ClipboardList, match: (p) => p.startsWith('/dashboard/tareas') },
  { href: '/dashboard/plantas', label: 'Plantas', icon: Factory, match: (p) => p.startsWith('/dashboard/plantas') },
  { href: '/dashboard', label: 'Más', icon: Layers, match: (p) => p === '/dashboard' || p.startsWith('/dashboard/analytics') || p.startsWith('/dashboard/admin') || p.startsWith('/dashboard/auditoria') },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación inferior"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom,0)]"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-ds-accent' : 'text-ds-muted hover:text-text'
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

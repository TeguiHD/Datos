'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, Factory, ListTodo, Menu, Sun } from 'lucide-react';
import { MoreSheet } from './MoreSheet';

const TABS = [
  { href: '/dashboard/hoy', label: 'Hoy', icon: Sun },
  { href: '/dashboard/semana', label: 'Semana', icon: CalendarClock },
  { href: '/dashboard/tareas', label: 'Tareas', icon: ListTodo },
  { href: '/dashboard/plantas', label: 'Plantas', icon: Factory },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const onMainTab = TABS.some((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));

  return (
    <>
      <nav
        aria-label="Navegación"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom,0)]"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                    active ? 'text-ds-accent' : 'text-ds-muted hover:text-text'
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                !onMainTab ? 'text-ds-accent' : 'text-ds-muted hover:text-text'
              }`}
            >
              <Menu className="size-5" aria-hidden />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}

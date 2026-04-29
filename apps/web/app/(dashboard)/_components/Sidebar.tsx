'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSidebarCollapsed } from '@/lib/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils/cn';
import { SidebarNav } from './SidebarNav';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-col border-r border-[var(--color-border)]',
          'bg-[var(--color-surface)] transition-all duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-[52px] shrink-0 items-center border-b border-[var(--color-border)] px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-ds-accent text-sm font-bold text-accent-fg shadow-sm">
              d.
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase leading-none tracking-[0.18em] text-ds-muted">Panel</p>
                <p className="truncate text-sm font-semibold text-text">datos.nicoholas</p>
              </div>
            )}
          </div>
        </div>

        <SidebarNav collapsed={collapsed} />

        <div
          className={cn(
            'flex shrink-0 border-t border-[var(--color-border)] p-2',
            collapsed ? 'justify-center' : 'justify-end',
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-ds-muted hover:text-text"
            onClick={toggle}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent side="left" className="w-60 bg-[var(--color-surface)] p-0">
          <SheetHeader>
            <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          </SheetHeader>
          <div className="flex h-[52px] items-center border-b border-[var(--color-border)] px-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-grid size-8 place-items-center rounded-lg bg-ds-accent text-sm font-bold text-accent-fg">
                d.
              </span>
              <div>
                <p className="text-[10px] uppercase leading-none tracking-[0.18em] text-ds-muted">Panel</p>
                <p className="text-sm font-semibold text-text">datos.nicoholas</p>
              </div>
            </div>
          </div>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </>
  );
}

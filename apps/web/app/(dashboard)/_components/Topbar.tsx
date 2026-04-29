'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { DensityToggle } from './DensityToggle';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Resumen',
  '/dashboard/tareas': 'Tareas',
  '/dashboard/cronograma': 'Cronograma',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/graficos': 'Gráficos IA',
  '/dashboard/importacion': 'Importación',
  '/dashboard/admin': 'Admin',
  '/dashboard/auditoria': 'Auditoría',
};

interface TopbarProps {
  email: string;
  role: string;
  onMenuClick?: () => void;
}

export function Topbar({ email, role, onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const crumb = BREADCRUMB_MAP[pathname] ?? 'Dashboard';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-[var(--color-border)]',
        'bg-[var(--color-surface)]/90 px-4 backdrop-blur-sm',
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase leading-none tracking-[0.16em] text-ds-muted">SAP PM</p>
        <h1 className="truncate text-sm font-semibold text-text">{crumb}</h1>
      </div>

      <button
        type="button"
        className={cn(
          'hidden items-center gap-2 rounded-md border border-[var(--color-border)]',
          'bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-ds-muted',
          'transition-colors hover:border-ds-accent hover:text-text md:flex',
        )}
        aria-label="Búsqueda rápida próximamente"
        disabled
      >
        <span>Buscar...</span>
        <kbd className="rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">Cmd K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <DensityToggle />
        <ThemeToggle />
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}

'use client';

import { Menu, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { CommandPalette } from './CommandPalette';
import { DensityToggle } from './DensityToggle';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Resumen',
  '/dashboard/hoy': 'Hoy',
  '/dashboard/semana': 'Semana',
  '/dashboard/tareas': 'Tareas',
  '/dashboard/cronograma': 'Cronograma',
  '/dashboard/revisiones': 'Revisiones',
  '/dashboard/plantas': 'Plantas',
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
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
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
            'transition-colors hover:border-ds-accent hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex',
          )}
          onClick={() => setCommandOpen(true)}
          aria-label="Abrir búsqueda rápida"
        >
          <Search className="size-3.5" />
          <span>Buscar…</span>
          <kbd className="rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">⌘ K</kbd>
        </button>

        <div className="flex items-center gap-1">
          <DensityToggle />
          <ThemeToggle />
          <UserMenu email={email} role={role} />
        </div>
      </header>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}

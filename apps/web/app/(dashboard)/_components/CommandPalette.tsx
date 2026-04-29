'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BrainCircuit,
  Calendar,
  FileUp,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTES = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/tareas', label: 'Tareas', icon: ListTodo },
  { href: '/dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/graficos', label: 'Gráficos IA', icon: BrainCircuit },
  { href: '/dashboard/importacion', label: 'Importación', icon: FileUp },
  { href: '/dashboard/admin', label: 'Admin', icon: Settings },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const encodedQuery = useMemo(() => encodeURIComponent(query.trim()), [query]);

  const run = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogTitle className="sr-only">Búsqueda rápida</DialogTitle>
        <Command shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar módulo, tarea, PSR, equipo…"
          />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Navegación">
              {ROUTES.map((route) => {
                const Icon = route.icon;
                return (
                  <CommandItem key={route.href} value={route.label} onSelect={() => run(route.href)}>
                    <Icon className="size-4" />
                    {route.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Búsqueda contextual">
              <CommandItem
                value={`buscar tareas ${query}`}
                disabled={query.trim().length < 2}
                onSelect={() => run(`/dashboard/tareas?q=${encodedQuery}`)}
              >
                <Search className="size-4" />
                Buscar en tareas
                {query.trim() && <CommandShortcut>{query.trim()}</CommandShortcut>}
              </CommandItem>
              <CommandItem
                value={`filtrar dashboard ${query}`}
                disabled={query.trim().length < 2}
                onSelect={() => run(`/dashboard?q=${encodedQuery}&page=1`)}
              >
                <Search className="size-4" />
                Filtrar tablero
                {query.trim() && <CommandShortcut>{query.trim()}</CommandShortcut>}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

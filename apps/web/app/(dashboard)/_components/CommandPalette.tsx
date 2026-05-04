'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BrainCircuit,
  Calendar,
  ClipboardCheck,
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
import { api } from '@/lib/api';
import type { TaskBrief } from '@/lib/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTES = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/tareas', label: 'Tareas', icon: ListTodo },
  { href: '/dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/dashboard/revisiones', label: 'Revisiones', icon: ClipboardCheck },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/graficos', label: 'Gráficos IA', icon: BrainCircuit },
  { href: '/dashboard/importacion', label: 'Importación', icon: FileUp },
  { href: '/dashboard/admin', label: 'Admin', icon: Settings },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [taskResults, setTaskResults] = useState<TaskBrief[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setTaskResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setTaskResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await api<{ rows: TaskBrief[] }>(`/api/tasks?q=${encodeURIComponent(trimmed)}&take=5`);
        setTaskResults(result.rows ?? []);
      } catch {
        setTaskResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const encodedQuery = useMemo(() => encodeURIComponent(query.trim()), [query]);

  const run = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogTitle className="sr-only">Búsqueda rápida</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar módulo, tarea, PSR, equipo…"
          />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Navegación">
              {ROUTES.filter((r) =>
                !query.trim() || r.label.toLowerCase().includes(query.trim().toLowerCase()),
              ).map((route) => {
                const Icon = route.icon;
                return (
                  <CommandItem key={route.href} value={route.label} onSelect={() => run(route.href)}>
                    <Icon className="size-4" />
                    {route.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {taskResults.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tareas">
                  {taskResults.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={task.id}
                      onSelect={() => run(`/dashboard/tareas?q=${encodedQuery}`)}
                    >
                      <Search className="size-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {task.descPosicionMant ?? task.denomObjetoTecnico ?? 'Sin descripción'}
                      </span>
                      {task.indicadorAbc && (
                        <CommandShortcut>ABC {task.indicadorAbc}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
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

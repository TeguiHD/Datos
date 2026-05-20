import {
  Calendar,
  CalendarClock,
  ChartColumn,
  ClipboardCheck,
  Clock,
  Factory,
  FileSignature,
  FileUp,
  LayoutDashboard,
  ListTodo,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  exactMatch?: boolean;
}

export interface NavSection {
  label: string;
  items: NavEntry[];
}

// Fuente única de verdad de la navegación. La usan el sidebar (desktop)
// y la hoja "Más" (mobile) — así ninguna ruta queda huérfana.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Planificación',
    items: [
      { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, exactMatch: true },
      { href: '/dashboard/plantas', label: 'Plantas', icon: Factory },
      { href: '/dashboard/tareas', label: 'Tareas', icon: ListTodo },
      { href: '/dashboard/cronograma', label: 'Cronograma', icon: Calendar },
    ],
  },
  {
    label: 'Operación',
    items: [
      { href: '/dashboard/hoy', label: 'Hoy', icon: Sun },
      { href: '/dashboard/semana', label: 'Semana', icon: CalendarClock },
      { href: '/dashboard/revisiones', label: 'Revisiones', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/dashboard/estadisticas', label: 'Estadísticas', icon: ChartColumn },
      { href: '/dashboard/analytics', label: 'Analítica', icon: TrendingUp },
      { href: '/dashboard/graficos', label: 'Gráficos IA', icon: Sparkles },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/dashboard/importacion', label: 'Importación', icon: FileUp },
      { href: '/dashboard/reportes', label: 'Reportes firmados', icon: FileSignature },
      { href: '/dashboard/admin/hh', label: 'HH por defecto', icon: Clock },
      { href: '/dashboard/auditoria', label: 'Auditoría', icon: ShieldCheck },
      { href: '/dashboard/admin/usuarios', label: 'Usuarios', icon: Users },
    ],
  },
];

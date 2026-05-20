import {
  Calendar,
  ClipboardCheck,
  Clock,
  FileSignature,
  FileUp,
  Factory,
  LayoutDashboard,
  ShieldCheck,
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

// Fuente única de verdad de la navegación — sidebar (desktop) y hoja "Más" (mobile).
// Sidebar simplificado: el flujo real es Panel → Plantas → mantenciones → reportes.
// Se retiran de la navegación las páginas redundantes o de la capa operacional
// descartada (Hoy/Semana/Revisiones/Tareas global/Estadísticas/Gráficos IA).
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operación',
    items: [
      { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, exactMatch: true },
      { href: '/dashboard/plantas', label: 'Plantas', icon: Factory },
      { href: '/dashboard/cronograma', label: 'Cronograma', icon: Calendar },
      { href: '/dashboard/analytics', label: 'Análisis', icon: TrendingUp },
      { href: '/dashboard/reportes', label: 'Reportes', icon: FileSignature },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/dashboard/importacion', label: 'Importación', icon: FileUp },
      { href: '/dashboard/admin/hh', label: 'HH por defecto', icon: Clock },
      { href: '/dashboard/admin/usuarios', label: 'Usuarios', icon: Users },
      { href: '/dashboard/auditoria', label: 'Auditoría', icon: ShieldCheck },
    ],
  },
];

// Accesos del bottom nav en mobile (4 + "Más").
export const BOTTOM_NAV: NavEntry[] = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, exactMatch: true },
  { href: '/dashboard/plantas', label: 'Plantas', icon: Factory },
  { href: '/dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/dashboard/reportes', label: 'Reportes', icon: ClipboardCheck },
];

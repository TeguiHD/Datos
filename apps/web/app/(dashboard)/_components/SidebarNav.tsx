import {
  Calendar,
  ChartColumn,
  Clock,
  FileSignature,
  FileUp,
  Factory,
  LayoutDashboard,
  ListTodo,
  Users,
} from 'lucide-react';
import { NavItem } from './NavItem';
import { SidebarSection } from './SidebarSection';

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed }: SidebarNavProps) {
  return (
    <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto py-2">
      <SidebarSection label="Planificación" collapsed={collapsed}>
        <NavItem href="/dashboard" label="Panel" icon={LayoutDashboard} collapsed={collapsed} exactMatch />
        <NavItem href="/dashboard/plantas" label="Plantas" icon={Factory} collapsed={collapsed} />
        <NavItem href="/dashboard/tareas" label="Tareas" icon={ListTodo} collapsed={collapsed} />
        <NavItem href="/dashboard/cronograma" label="Cronograma" icon={Calendar} collapsed={collapsed} />
        <NavItem href="/dashboard/estadisticas" label="Estadísticas" icon={ChartColumn} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Gestión" collapsed={collapsed}>
        <NavItem href="/dashboard/importacion" label="Importación" icon={FileUp} collapsed={collapsed} />
        <NavItem href="/dashboard/reportes" label="Reportes firmados" icon={FileSignature} collapsed={collapsed} />
        <NavItem href="/dashboard/admin/hh" label="HH por defecto" icon={Clock} collapsed={collapsed} />
        <NavItem href="/dashboard/admin/usuarios" label="Usuarios" icon={Users} collapsed={collapsed} />
      </SidebarSection>
    </nav>
  );
}

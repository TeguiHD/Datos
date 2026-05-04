import {
  BarChart3,
  BrainCircuit,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  FileUp,
  Factory,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Settings,
  Sun,
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
      <SidebarSection label="Operación" collapsed={collapsed}>
        <NavItem href="/dashboard/hoy" label="Hoy" icon={Sun} collapsed={collapsed} />
        <NavItem href="/dashboard/semana" label="Semana" icon={CalendarDays} collapsed={collapsed} />
        <NavItem href="/dashboard/revisiones" label="Revisiones" icon={ClipboardCheck} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Planificación" collapsed={collapsed}>
        <NavItem href="/dashboard" label="Resumen" icon={LayoutDashboard} collapsed={collapsed} exactMatch />
        <NavItem href="/dashboard/plantas" label="Plantas" icon={Factory} collapsed={collapsed} />
        <NavItem href="/dashboard/tareas" label="Tareas" icon={ListTodo} collapsed={collapsed} />
        <NavItem href="/dashboard/cronograma" label="Cronograma" icon={Calendar} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Análisis" collapsed={collapsed}>
        <NavItem href="/dashboard/analytics" label="Analytics" icon={BarChart3} collapsed={collapsed} />
        <NavItem href="/dashboard/graficos" label="Gráficos IA" icon={BrainCircuit} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Gestión" collapsed={collapsed}>
        <NavItem href="/dashboard/importacion" label="Importación" icon={FileUp} collapsed={collapsed} />
        <NavItem href="/dashboard/admin" label="Admin" icon={Settings} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Sistema" collapsed={collapsed}>
        <NavItem href="/dashboard/auditoria" label="Auditoría" icon={ScrollText} collapsed={collapsed} />
        <NavItem href="/dashboard/admin/usuarios" label="Usuarios" icon={Users} collapsed={collapsed} />
      </SidebarSection>
    </nav>
  );
}

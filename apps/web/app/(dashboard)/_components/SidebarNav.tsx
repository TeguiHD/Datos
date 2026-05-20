import { NavItem } from './NavItem';
import { SidebarSection } from './SidebarSection';
import { NAV_SECTIONS } from './nav-config';

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed }: SidebarNavProps) {
  return (
    <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto py-2">
      {NAV_SECTIONS.map((section) => (
        <SidebarSection key={section.label} label={section.label} collapsed={collapsed}>
          {section.items.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              exactMatch={item.exactMatch}
            />
          ))}
        </SidebarSection>
      ))}
    </nav>
  );
}

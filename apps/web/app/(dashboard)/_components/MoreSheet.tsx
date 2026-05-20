'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NavItem } from './NavItem';
import { NAV_SECTIONS } from './nav-config';

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Menú completo para mobile: el tab "Más" del bottom nav abre esta hoja
// con todas las secciones. Reemplaza al drawer lateral.
export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] p-0"
      >
        <SheetHeader className="border-b border-[var(--color-border)] px-4 py-3 text-left">
          <SheetTitle className="text-base text-text">Menú</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 p-4 pb-[calc(env(safe-area-inset-bottom,0)+16px)]">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-muted">
                {section.label}
              </p>
              <div className="grid gap-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    exactMatch={item.exactMatch}
                    onNavigate={() => onOpenChange(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

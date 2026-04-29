'use client';

import { useRef, useState } from 'react';
import { Expand, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ChartPanel({ title, subtitle, loading, children, className }: ChartPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    if (!contentRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(contentRef.current, { backgroundColor: null });
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const header = (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ds-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-ds-muted hover:text-text"
          onClick={() => setFullscreen(true)}
          aria-label="Pantalla completa"
        >
          <Expand className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-ds-muted hover:text-text"
              aria-label="Opciones del gráfico"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={exportPng}>Exportar PNG</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn('rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4', className)}
        ref={contentRef}
      >
        {header}
        {loading ? <div className="skeleton h-[260px] w-full rounded-lg" /> : children}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            {subtitle && <p className="text-xs text-ds-muted">{subtitle}</p>}
          </DialogHeader>
          <div className="min-h-0 flex-1">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

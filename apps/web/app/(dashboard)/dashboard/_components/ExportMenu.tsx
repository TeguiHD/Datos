'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadFile } from '@/lib/download';
import { toast } from '@/lib/toast';

// Menú de exportación de mantenciones (Excel / PDF), por planta o todas.
export function ExportMenu({ plantId, label = 'Exportar' }: { plantId?: string; label?: string }) {
  const scope = plantId ? `plantId=${plantId}&` : '';
  async function go(format: 'xlsx' | 'pdf') {
    try {
      await downloadFile(`/api/export/mantenciones?${scope}format=${format}`);
      toast(format === 'pdf' ? 'PDF exportado' : 'Excel exportado');
    } catch {
      toast('No se pudo exportar', 'error');
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => go('xlsx')}>
          <FileSpreadsheet className="size-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go('pdf')}>
          <FileText className="size-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

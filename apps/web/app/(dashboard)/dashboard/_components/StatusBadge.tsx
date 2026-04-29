import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { ExecStatus } from '@/lib/types';

const STATUS_CONFIG: Record<ExecStatus, { label: string; classes: string }> = {
  PENDING: {
    label: 'Pendiente',
    classes: 'border-warn/30 bg-warn-dim text-warn',
  },
  OVERDUE: {
    label: 'Vencida',
    classes: 'border-danger/30 bg-danger-dim text-danger',
  },
  DONE: {
    label: 'Hecha',
    classes: 'border-ok/30 bg-ok-dim text-ok',
  },
  SKIPPED: {
    label: 'Omitida',
    classes: 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-ds-muted',
  },
};

export function StatusBadge({ status }: { status: ExecStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn('rounded-md px-2 py-0.5 text-xs font-medium', config.classes)}>
      {config.label}
    </Badge>
  );
}

'use client';

import { X } from 'lucide-react';

interface Chip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: Chip[];
  onClearAll?: () => void;
}

export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-text"
        >
          <span className="text-ds-muted">{chip.label}:</span>
          <span className="font-medium">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded text-ds-muted transition-colors hover:text-danger"
            aria-label={`Quitar filtro ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length >= 2 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-ds-muted underline underline-offset-2 transition-colors hover:text-danger"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}

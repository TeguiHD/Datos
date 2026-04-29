'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface PaginationProps {
  page: number;
  take: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, take, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / take));
  const firstRow = total === 0 ? 0 : page * take + 1;
  const lastRow = Math.min((page + 1) * take, total);
  const canPrev = page > 0;
  const canNext = (page + 1) * take < total;
  const pages = buildPageList(page, totalPages);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
      <span className="text-xs text-ds-muted">
        {total === 0 ? 'Sin resultados' : `${firstRow}-${lastRow} de ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canPrev}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pages.map((pageItem, index) =>
          pageItem === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-ds-muted">
              ...
            </span>
          ) : (
            <Button
              key={pageItem}
              variant={pageItem === page ? 'default' : 'ghost'}
              size="icon"
              className={cn(
                'size-7 text-xs',
                pageItem === page && 'bg-ds-accent text-accent-fg hover:bg-ds-accent/90',
              )}
              onClick={() => onPage(pageItem)}
            >
              {pageItem + 1}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);

  const result: (number | '...')[] = [];
  const add = (page: number) => {
    if (!result.includes(page)) result.push(page);
  };

  add(0);
  if (current > 2) result.push('...');
  for (let index = Math.max(1, current - 1); index <= Math.min(total - 2, current + 1); index++) {
    add(index);
  }
  if (current < total - 3) result.push('...');
  add(total - 1);
  return result;
}

'use client';

import { Rows2, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDensity } from '@/lib/hooks/useDensity';

export function DensityToggle() {
  const { density, toggle } = useDensity();
  const isCompact = density === 'compact';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggle}
            aria-label={isCompact ? 'Densidad cómoda' : 'Densidad compacta'}
          >
            {isCompact ? <Rows3 className="size-4" /> : <Rows2 className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isCompact ? 'Vista cómoda' : 'Vista compacta'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

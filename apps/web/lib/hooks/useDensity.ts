'use client';

import { useContext } from 'react';
import { DensityContext } from '@/lib/providers/DensityProvider';

export type Density = 'comfortable' | 'compact';

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
}

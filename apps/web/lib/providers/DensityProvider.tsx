'use client';

import { createContext, useEffect, useState } from 'react';
import type { Density } from '@/lib/hooks/useDensity';

interface DensityContextValue {
  density: Density;
  setDensity: (density: Density) => void;
  toggle: () => void;
}

export const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    const stored = localStorage.getItem('datos-density') as Density | null;
    if (stored === 'comfortable' || stored === 'compact') {
      setDensityState(stored);
      document.documentElement.setAttribute('data-density', stored);
    }
  }, []);

  const setDensity = (nextDensity: Density) => {
    setDensityState(nextDensity);
    localStorage.setItem('datos-density', nextDensity);
    document.documentElement.setAttribute('data-density', nextDensity);
  };

  const toggle = () => setDensity(density === 'comfortable' ? 'compact' : 'comfortable');

  return (
    <DensityContext.Provider value={{ density, setDensity, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

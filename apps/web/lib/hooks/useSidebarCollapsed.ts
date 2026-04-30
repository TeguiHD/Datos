'use client';

import { useState } from 'react';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('datos-sidebar-collapsed') === 'true',
  );

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem('datos-sidebar-collapsed', String(value));
  };

  const toggle = () => setCollapsed(!collapsed);

  return { collapsed, toggle, setCollapsed };
}

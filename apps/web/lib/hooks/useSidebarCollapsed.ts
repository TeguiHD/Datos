'use client';

import { useEffect, useState } from 'react';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('datos-sidebar-collapsed');
    if (stored === 'true') setCollapsedState(true);
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem('datos-sidebar-collapsed', String(value));
  };

  const toggle = () => setCollapsed(!collapsed);

  return { collapsed, toggle, setCollapsed };
}

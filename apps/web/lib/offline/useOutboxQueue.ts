'use client';
import { useEffect, useState } from 'react';
import { drain, size } from './outbox';
import { useOnline } from './useOnline';

export function useOutboxQueue() {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const n = await size();
        if (mounted) setPending(n);
      } catch {
        // IDB not available — no-op
      }
    };
    refresh();
    const i = setInterval(refresh, 5000);
    const onMsg = (ev: MessageEvent) => {
      if ((ev.data as { type?: string })?.type === 'OUTBOX_DRAIN') void run();
    };
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onMsg);
    }
    return () => {
      mounted = false;
      clearInterval(i);
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
  }, []);

  async function run() {
    if (draining) return;
    setDraining(true);
    try {
      await drain();
      setPending(await size());
    } finally {
      setDraining(false);
    }
  }

  useEffect(() => {
    if (online) void run();
  }, [online]);

  return { online, pending, draining, run };
}

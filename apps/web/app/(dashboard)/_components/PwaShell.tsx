'use client';

import { useEffect, useState } from 'react';
import { CloudOff, Download, RefreshCw } from 'lucide-react';
import { useOutboxQueue } from '@/lib/offline/useOutboxQueue';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'datos-pwa-install-dismissed';

export function PwaShell() {
  const { online, pending, draining, run } = useOutboxQueue();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISSED_KEY) === '1');
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  return (
    <>
      {(!online || pending > 0) && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
        >
          <span className="flex items-center gap-2">
            <CloudOff className="size-4" aria-hidden />
            {!online
              ? `Modo offline${pending ? ` · ${pending} cambio${pending === 1 ? '' : 's'} en cola` : ''}`
              : `Sincronizando ${pending} cambio${pending === 1 ? '' : 's'}…`}
          </span>
          {online && pending > 0 && (
            <button
              type="button"
              onClick={() => void run()}
              disabled={draining}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${draining ? 'animate-spin' : ''}`} aria-hidden />
              Reintentar
            </button>
          )}
        </div>
      )}

      {!installDismissed && !isStandalone && installEvent && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-text">
          <span className="flex items-center gap-2">
            <Download className="size-4" aria-hidden />
            Instalar la app para uso en planta.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-ds-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 min-h-[36px]"
              onClick={async () => {
                await installEvent.prompt();
                const choice = await installEvent.userChoice;
                if (choice.outcome === 'accepted') {
                  localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
                  setInstallDismissed(true);
                }
                setInstallEvent(null);
              }}
            >
              Instalar
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs text-ds-muted hover:bg-[var(--color-surface-2)] min-h-[36px]"
              onClick={() => {
                localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
                setInstallDismissed(true);
              }}
            >
              Más tarde
            </button>
          </div>
        </div>
      )}
    </>
  );
}

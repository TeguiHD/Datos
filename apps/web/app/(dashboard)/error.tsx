'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] error boundary:', error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <h1 className="text-lg font-semibold text-text">Algo salió mal en esta vista</h1>
        <p className="mt-1.5 text-sm text-ds-muted">
          El error quedó contenido — el resto de la app sigue funcionando. Puedes reintentar.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-md bg-ds-accent px-4 text-sm font-medium text-white hover:opacity-90"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reintentar
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Check, Info, X } from 'lucide-react';

type Tone = 'ok' | 'error' | 'info';
interface Toast {
  id: number;
  msg: string;
  tone: Tone;
}

let items: Toast[] = [];
let listeners: Array<() => void> = [];
let seq = 0;

function emit() {
  for (const l of listeners) l();
}

export function toast(msg: string, tone: Tone = 'ok') {
  const id = ++seq;
  items = [...items, { id, msg, tone }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3800);
}

const TONE: Record<Tone, { cls: string; icon: typeof Check }> = {
  ok: { cls: 'border-ok/40 bg-ok-dim text-ok', icon: Check },
  error: { cls: 'border-danger/40 bg-danger-dim text-danger', icon: X },
  info: { cls: 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-text', icon: Info },
};

export function Toaster() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const { cls, icon: Icon } = TONE[t.tone];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg ${cls}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

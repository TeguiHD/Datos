'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { FloatingAiChat } from './_components/FloatingAiChat';
import { Sidebar } from './_components/Sidebar';
import { Topbar } from './_components/Topbar';

interface MeResponse {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  mustChangePass: boolean;
  lastLoginAt: string | null;
  tfa: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      router.replace('/login');
      return;
    }

    if (!me.data || me.data.tfa) return;
    const target = me.data.totpEnabled ? '/verify-2fa' : '/setup-2fa';
    if (pathname !== target) router.replace(target);
  }, [me.data, me.error, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (me.isLoading) {
    return <GateState title="Validando sesión" detail="Comprobando autenticación y segundo factor." />;
  }

  if (me.error) {
    return <GateState title="Sesión no disponible" detail="Redirigiendo a inicio de sesión." tone="error" />;
  }

  if (me.data && !me.data.tfa) {
    return (
      <GateState
        title="Segundo factor requerido"
        detail={me.data.totpEnabled ? 'Redirigiendo a verificación 2FA.' : 'Redirigiendo a configuración inicial 2FA.'}
      />
    );
  }

  if (me.data?.mustChangePass) {
    return <MustChangePasswordGate email={me.data.email} />;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          email={me.data?.email ?? ''}
          role={me.data?.role ?? ''}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">{children}</div>
        </main>
      </div>
      <FloatingAiChat />
    </div>
  );
}

function Nav({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  const pathname = usePathname();
  const active = href === '/dashboard' ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;

  return (
    <Link
      href={href}
      className={`block rounded-md text-sm transition-all duration-200 ${
        compact
          ? `px-3 py-1.5 border whitespace-nowrap ${
              active
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`
          : active
            ? 'px-3 py-2 bg-brand-50 text-brand-900 shadow-sm'
            : 'px-3 py-2 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}

function GateState({
  title,
  detail,
  tone = 'normal',
}: {
  title: string;
  detail: string;
  tone?: 'normal' | 'error';
}) {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div
        className={`panel w-full max-w-lg p-6 text-center space-y-3 ${
          tone === 'error' ? 'border-red-200 bg-red-50/80' : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="mx-auto h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full w-1/2 bg-brand-500 animate-pulse" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function SessionActions({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'forget' | 'logout' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onForgetDevice = async () => {
    setBusy('forget');
    setStatus(null);
    try {
      await api('/api/auth/trusted-device/forget', { method: 'POST' });
      setStatus('Este dispositivo ya no está marcado como confiable.');
    } catch {
      setStatus('No se pudo olvidar este dispositivo.');
    } finally {
      setBusy(null);
    }
  };

  const onLogout = async () => {
    setBusy('logout');
    setStatus(null);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore and redirect anyway to force a clean local state.
    } finally {
      router.replace('/login');
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onForgetDevice}
            disabled={busy !== null}
          >
            {busy === 'forget' ? 'Olvidando…' : 'Olvidar dispositivo'}
          </button>
          <button
            type="button"
            className="text-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onLogout}
            disabled={busy !== null}
          >
            {busy === 'logout' ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
        {status && <p className="text-[11px] text-slate-600">{status}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        onClick={onForgetDevice}
        disabled={busy !== null}
      >
        {busy === 'forget' ? 'Olvidando dispositivo…' : 'Olvidar este dispositivo'}
      </button>
      <button
        type="button"
        className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        onClick={onLogout}
        disabled={busy !== null}
      >
        {busy === 'logout' ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      {status && <p className="text-xs text-slate-600">{status}</p>}
    </div>
  );
}

function MustChangePasswordGate({ email }: { email: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (newPassword !== confirmPassword) {
      setErr('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setOk('Contraseña actualizada. Redirigiendo al login...');
      setTimeout(() => router.replace('/login'), 600);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErr('Contraseña actual inválida.');
      } else {
        setErr('No se pudo actualizar la contraseña.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={onSubmit} className="panel w-full max-w-lg p-6 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Seguridad obligatoria</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Cambio inicial de contraseña</h1>
          <p className="mt-1 text-sm text-slate-600">
            Usuario: <span className="font-medium">{email}</span>. Debes cambiar la contraseña temporal antes de continuar.
          </p>
        </div>

        <label className="block text-sm text-slate-700">
          Contraseña actual
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          Nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          Confirmar nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border px-3 py-2"
          />
        </label>

        <p className="text-xs text-slate-500">Requisito: 12+ caracteres, mayúscula, minúscula, número y símbolo.</p>

        {err && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        {ok && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
        >
          {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

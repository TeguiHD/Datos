'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [totpErr, setTotpErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyingTotp, setVerifyingTotp] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const lastAutoCodeRef = useRef('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setTotpErr(null);
    setLoading(true);
    try {
      const res = await api<{ requiresTotpEnroll: boolean; requiresTotp: boolean; mustChangePass: boolean }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      if (res.requiresTotpEnroll) router.push('/setup-2fa');
      else if (res.requiresTotp) {
        setTotpCode('');
        setShowTotpModal(true);
      }
      else router.push('/dashboard');
    } catch (error) {
      setErr(error instanceof ApiError && error.status === 401 ? 'Credenciales inválidas' : 'Error de login');
    } finally {
      setLoading(false);
    }
  }

  async function verifyTotpCode(codeToVerify: string) {
    setVerifyingTotp(true);
    try {
      await api('/api/auth/totp/verify', {
        method: 'POST',
        body: JSON.stringify({ code: codeToVerify, rememberDevice }),
      });
      router.push('/dashboard');
    } catch {
      setTotpErr('Código inválido');
      setTotpCode('');
      lastAutoCodeRef.current = '';
    } finally {
      setVerifyingTotp(false);
    }
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setTotpErr(null);

    if (totpCode.length !== 6) {
      setTotpErr('Ingresa un código de 6 dígitos');
      return;
    }

    await verifyTotpCode(totpCode);
  }

  useEffect(() => {
    if (!showTotpModal) return;
    if (verifyingTotp) return;
    if (totpCode.length !== 6) return;
    if (lastAutoCodeRef.current === totpCode) return;

    lastAutoCodeRef.current = totpCode;
    setTotpErr(null);
    void verifyTotpCode(totpCode);
  }, [showTotpModal, totpCode, verifyingTotp]);

  const disableLogin = loading || showTotpModal;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-20 -top-12 h-64 w-64 rounded-full bg-[#99c9ff]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[#79ddcf]/35 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <form onSubmit={submit} className="panel w-full p-6 sm:p-7">
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Acceso</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-600">Ingresa con tus credenciales internas.</p>
          </div>

          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border bg-white pl-9 pr-3 py-2.5 text-sm outline-none ring-brand-500/20 transition focus:border-brand-500 focus:ring-4"
              />
            </div>
          </label>

          <label className="mt-4 block text-sm">
            <span className="text-slate-700">Contraseña</span>
            <div className="relative mt-1.5">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border bg-white pl-9 pr-11 py-2.5 text-sm outline-none ring-brand-500/20 transition focus:border-brand-500 focus:ring-4"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {err && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </p>
          )}

          <button
            disabled={disableLogin}
            className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">Acceso protegido por segundo factor (2FA) obligatorio.</p>
        </form>
      </div>

      {showTotpModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="totp-title">
          <form onSubmit={verifyTotp} className="w-full max-w-sm rounded-xl border bg-white p-5 shadow-xl">
            <h3 id="totp-title" className="text-lg font-semibold text-slate-900">
              Verificación 2FA
            </h3>
            <p className="mt-1 text-sm text-slate-600">Ingresa código de 6 dígitos para continuar.</p>

            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-4 w-full rounded-md border px-3 py-2 tracking-widest text-center text-lg"
              placeholder="123456"
            />

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Recordar este dispositivo por 7 días
            </label>

            {totpErr && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{totpErr}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTotpModal(false);
                  setTotpCode('');
                  setTotpErr(null);
                  lastAutoCodeRef.current = '';
                }}
                className="w-1/3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={verifyingTotp}
                className="w-2/3 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
              >
                {verifyingTotp ? 'Verificando…' : 'Verificar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

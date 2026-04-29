'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Verify2FA() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const lastAutoCodeRef = useRef('');

  async function verifyCode(codeToVerify: string) {
    setVerifying(true);
    setErr(null);
    try {
      await api('/api/auth/totp/verify', { method: 'POST', body: JSON.stringify({ code: codeToVerify, rememberDevice }) });
      router.push('/dashboard');
    } catch {
      setErr('Código inválido');
      setCode('');
      lastAutoCodeRef.current = '';
    } finally {
      setVerifying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setErr('Ingresa un código de 6 dígitos');
      return;
    }

    await verifyCode(code);
  }

  useEffect(() => {
    if (verifying) return;
    if (code.length !== 6) return;
    if (lastAutoCodeRef.current === code) return;

    lastAutoCodeRef.current = code;
    void verifyCode(code);
  }, [code, verifying, rememberDevice]);

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl p-6 border space-y-4">
        <h1 className="text-xl font-semibold">Verificación 2FA</h1>
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-md border px-3 py-2 tracking-widest text-center text-lg"
          placeholder="123456"
          autoFocus
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Recordar este dispositivo por 7 días
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={verifying} className="w-full rounded-md bg-brand-600 hover:bg-brand-900 text-white py-2 disabled:opacity-60">
          {verifying ? 'Verificando...' : 'Verificar'}
        </button>
      </form>
    </div>
  );
}

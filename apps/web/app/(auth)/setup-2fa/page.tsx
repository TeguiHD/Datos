'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Setup2FA() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState<string[] | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ qr: string; uri: string }>('/api/auth/totp/enroll/start', { method: 'POST' })
      .then((r) => setQr(r.qr))
      .catch(() => setErr('No se pudo iniciar enrolamiento'));
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api<{ backupCodes: string[] }>('/api/auth/totp/enroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setBackup(r.backupCodes);
    } catch {
      setErr('Código inválido');
    }
  }

  async function proceed() {
    await api('/api/auth/totp/verify', { method: 'POST', body: JSON.stringify({ code, rememberDevice }) });
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl p-6 border space-y-4">
        <h1 className="text-xl font-semibold">Configurar 2FA (TOTP)</h1>
        <p className="text-sm text-slate-600">
          Escanea este código con Google Authenticator / Authy / 1Password y luego ingresa el código de 6 dígitos.
        </p>
        {qr && <img alt="QR 2FA" src={qr} className="mx-auto h-48 w-48" />}
        {!backup ? (
          <form onSubmit={confirm} className="space-y-3">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border px-3 py-2 tracking-widest text-center text-lg"
              placeholder="123456"
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="w-full rounded-md bg-brand-600 hover:bg-brand-900 text-white py-2">Confirmar</button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Guarda estos códigos de respaldo en un lugar seguro:</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-slate-100 p-3 rounded">
              {backup.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Recordar este dispositivo por 7 días
            </label>
            <button onClick={proceed} className="w-full rounded-md bg-brand-600 hover:bg-brand-900 text-white py-2">
              Continuar al dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

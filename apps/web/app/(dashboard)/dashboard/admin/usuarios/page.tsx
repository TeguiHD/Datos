'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Unlock, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface AppUser {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  lockedUntil: string | null;
  mustChangePass: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLES = ['SUPERADMIN', 'ADMIN', 'VIEWER'];
const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('ADMIN');
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<AppUser[]>('/api/users'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      api('/api/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setCreateOk(`Usuario ${createEmail} creado. Recibirá la contraseña temporal por correo.`);
      setCreateEmail('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => {
      setCreateErr(e instanceof ApiError ? `Error ${e.status}` : 'No se pudo crear el usuario.');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => api(`/api/users/${id}/unlock`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const totpMutation = useMutation({
    mutationFn: (id: string) => api(`/api/users/${id}/totp/reset`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr(null);
    setCreateOk(null);
    if (!createEmail.trim()) return;
    createMutation.mutate({ email: createEmail.trim(), role: createRole });
  };

  return (
    <div className="space-y-5 fade-up">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ds-muted">Sistema</p>
        <h1 className="text-2xl font-semibold text-text">Gestión de usuarios</h1>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="size-4 text-ds-accent" />
          <h2 className="text-sm font-semibold text-text">Crear usuario</h2>
        </div>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input
            type="email"
            required
            placeholder="correo@ejemplo.com"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            className="flex-1 min-w-52 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text"
          />
          <select
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-text"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creando…' : 'Crear'}
          </Button>
        </form>
        {createErr && <p className="mt-2 rounded-md bg-danger-dim px-3 py-2 text-sm text-danger">{createErr}</p>}
        {createOk && <p className="mt-2 rounded-md bg-ok-dim px-3 py-2 text-sm text-ok">{createOk}</p>}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-text">Usuarios registrados</h2>
        {usersQuery.isLoading && <p className="text-sm text-ds-muted">Cargando…</p>}
        {usersQuery.isError && <p className="text-sm text-danger">No se pudieron cargar los usuarios.</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-ds-muted">
              <tr>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-center">2FA</th>
                <th className="px-3 py-2 text-center">Estado</th>
                <th className="px-3 py-2 text-left">Último acceso</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data ?? []).map((user) => (
                <tr key={user.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-medium text-text">{user.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={user.role}
                      onChange={(e) => roleMutation.mutate({ id: user.id, role: e.target.value })}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-text"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {user.totpEnabled
                      ? <span className="text-xs font-medium text-ok">Activo</span>
                      : <span className="text-xs text-ds-muted">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {user.lockedUntil
                      ? <span className="text-xs font-medium text-danger">Bloqueado</span>
                      : user.mustChangePass
                        ? <span className="text-xs text-warn">Clave temp.</span>
                        : <span className="text-xs text-ok">OK</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-ds-muted">
                    {user.lastLoginAt ? DATE_FORMAT.format(new Date(user.lastLoginAt)) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {user.lockedUntil && (
                        <button
                          type="button"
                          onClick={() => unlockMutation.mutate(user.id)}
                          title="Desbloquear"
                          className="rounded p-1.5 text-ds-muted hover:bg-[var(--color-surface-2)] hover:text-text"
                        >
                          <Unlock className="size-4" />
                        </button>
                      )}
                      {user.totpEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Resetear 2FA de ${user.email}?`)) totpMutation.mutate(user.id);
                          }}
                          title="Resetear 2FA"
                          className="rounded p-1.5 text-ds-muted hover:bg-[var(--color-surface-2)] hover:text-text"
                        >
                          <KeyRound className="size-4" />
                        </button>
                      )}
                      <span title="Superadmin" className="rounded p-1.5 text-ds-muted">
                        {user.role === 'SUPERADMIN' && <ShieldCheck className="size-4 text-ds-accent" />}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

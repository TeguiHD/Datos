'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface UserMenuProps {
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Visualizador',
};

export function UserMenu({ email, role }: UserMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  const forgetDevice = useMutation({
    mutationFn: () => api('/api/auth/trusted-device/forget', { method: 'POST' }),
  });

  const initials = (email || 'DN').slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Menú de usuario"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-ds-accent text-xs font-semibold text-accent-fg">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-xs font-semibold">{email}</p>
          <p className="mt-0.5 text-xs text-ds-muted">{ROLE_LABELS[role] ?? role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => forgetDevice.mutate()}
            disabled={forgetDevice.isPending || logout.isPending}
            className="cursor-pointer"
          >
            <ShieldOff className="size-4" />
            {forgetDevice.isPending ? 'Olvidando dispositivo…' : 'Olvidar dispositivo'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="cursor-pointer text-danger focus:bg-danger-dim focus:text-danger"
          >
            <LogOut className="size-4" />
            {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

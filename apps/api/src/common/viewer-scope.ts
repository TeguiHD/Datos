import { Role } from '@prisma/client';

export interface ViewerScopeUser {
  role: Role;
}

export function plantWhereForUser(user: ViewerScopeUser, extra: Record<string, unknown> = {}) {
  if (user.role === Role.VIEWER) {
    return { ...extra, deletedAt: null, visibleToViewer: true };
  }
  return { ...extra, deletedAt: null };
}

export function planTaskCountFilterForUser(user: ViewerScopeUser) {
  if (user.role === Role.VIEWER) {
    return { where: { deletedAt: null, plant: { visibleToViewer: true } } } as const;
  }
  return { where: { deletedAt: null } } as const;
}

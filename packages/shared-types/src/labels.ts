// Labels localizados es-CL para enums del dominio.
// Mantener sincronizado con prisma/schema.prisma.

export const execStatusLabels = {
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  DONE: 'Hecha',
  SKIPPED: 'Omitida',
} as const;

export const opExecStatusLabels = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  DONE_PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  SKIPPED: 'Omitida',
  POSTPONED: 'Postergada',
} as const;

export const opExecOutcomeLabels = {
  DONE: 'Hecha',
  DONE_WITH_OBSERVATIONS: 'Hecha con observaciones',
  NOT_DONE: 'No realizada',
} as const;

export const planFrequencyLabels = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
} as const;

export const plantStatusLabels = {
  ACTIVE: 'Activa',
  STANDBY: 'Standby',
  INACTIVE: 'Inactiva',
} as const;

export const roleLabels = {
  SUPERADMIN: 'Super admin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Sólo lectura',
} as const;

export const abcLabels = {
  A: 'A · crítica',
  B: 'B · importante',
  C: 'C · estándar',
} as const;

import { z } from 'zod';

// ---------- Auth ----------

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email muy corto')
  .max(254, 'Email muy largo')
  .email('Email inválido');

// Para verificar una contraseña EXISTENTE (login, currentPassword): laxa.
// No aplica la política de fortaleza — una contraseña bootstrap puede ser corta.
export const existingPasswordSchema = z
  .string()
  .min(1, 'Ingresa tu contraseña')
  .max(256, 'Máximo 256 caracteres');

// Para DEFINIR una contraseña nueva: exige la política completa.
export const passwordSchema = z
  .string()
  .min(12, 'Mínimo 12 caracteres')
  .max(256, 'Máximo 256 caracteres');

export const strongPasswordSchema = passwordSchema
  .regex(/[a-z]/, 'Debe incluir minúscula')
  .regex(/[A-Z]/, 'Debe incluir mayúscula')
  .regex(/[0-9]/, 'Debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo');

export const totpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Código TOTP de 6 dígitos');

export const backupCodeSchema = z
  .string()
  .trim()
  .min(8, 'Código de respaldo muy corto')
  .max(20, 'Código de respaldo muy largo');

export const loginSchema = z.object({
  email: emailSchema,
  password: existingPasswordSchema,
  rememberDevice: z.boolean().optional(),
});

export const totpVerifySchema = z.object({
  code: z.union([totpCodeSchema, backupCodeSchema]),
  rememberDevice: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: existingPasswordSchema,
  newPassword: strongPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------- Tareas / filtros ----------

export const execStatusSchema = z.enum(['PENDING', 'OVERDUE', 'DONE', 'SKIPPED']);
export const planFrequencySchema = z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM']);
export const abcSchema = z.enum(['A', 'B', 'C']);

export const monthSchema = z.coerce
  .number()
  .int()
  .min(1, 'Mes inválido')
  .max(12, 'Mes inválido');

export const yearSchema = z.coerce
  .number()
  .int()
  .min(2020, 'Año fuera de rango')
  .max(2099, 'Año fuera de rango');

export const tasksFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  plantId: z.string().cuid().optional().or(z.literal('').transform(() => undefined)),
  tipo: z.string().trim().max(60).optional(),
  abc: abcSchema.optional(),
  frecuencia: z.string().trim().max(20).optional(),
  year: yearSchema.optional(),
  month: monthSchema.optional(),
  estado: execStatusSchema.optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().min(1).optional(),
});

export type TasksFilter = z.infer<typeof tasksFilterSchema>;

// ---------- Ejecuciones (operacional) ----------

export const executionUpdateSchema = z.object({
  status: execStatusSchema.optional(),
  hhActual: z.coerce.number().min(0).max(9999).optional(),
  operator: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(1024).optional(),
});

export type ExecutionUpdateInput = z.infer<typeof executionUpdateSchema>;

// ---------- Reportes ----------

export const reportFormatSchema = z.enum(['pdf', 'xlsx']);

export const monthlyReportSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  plantId: z.string().cuid().optional(),
  format: reportFormatSchema.default('pdf'),
});

export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;

// ---------- Idempotency ----------

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._~-]{16,128}$/, 'Idempotency-Key inválida');

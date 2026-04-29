import { z } from 'zod';

/**
 * Esquema Zod estricto: única superficie por la que el LLM puede influir en la query.
 * Rechazamos campos desconocidos. Los strings se acotan en longitud.
 */
const STRING = z.string().trim().min(1).max(128);

export const AiFilterSchema = z
  .object({
    q: STRING.optional(),
    psr: STRING.optional(),
    abc: z.enum(['A', 'B', 'C']).optional(),
    frecuenciaCodigo: STRING.regex(/^[0-9A-Z]{1,6}$/).optional(),
    centroPlanificacion: STRING.optional(),
    equipo: STRING.optional(),
    ubicacionTecnica: STRING.optional(),
    yearFrom: z.number().int().min(2000).max(2100).optional(),
    yearTo: z.number().int().min(2000).max(2100).optional(),
    monthFrom: z.number().int().min(1).max(12).optional(),
    monthTo: z.number().int().min(1).max(12).optional(),
    onlyOverdue: z.boolean().optional(),
    onlyUpcomingDays: z.number().int().min(1).max(365).optional(),
    take: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export type AiFilter = z.infer<typeof AiFilterSchema>;

export const FILTER_FIELDS_FOR_PROMPT = [
  'q (texto libre — busca en descripción/equipo/ubicación)',
  'psr (string)',
  'abc ("A"|"B"|"C")',
  'frecuenciaCodigo (ej: "1A","6M","5A","3M")',
  'centroPlanificacion (string)',
  'equipo (string)',
  'ubicacionTecnica (string)',
  'yearFrom, yearTo (int 2000..2100)',
  'monthFrom, monthTo (int 1..12)',
  'onlyOverdue (boolean) — sólo ejecuciones vencidas',
  'onlyUpcomingDays (int 1..365) — sólo próximas N días',
  'take (int 1..200, default 50)',
] as const;

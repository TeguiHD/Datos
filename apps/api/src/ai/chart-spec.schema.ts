import { z } from 'zod';
import { AiFilterSchema } from './ai-filter.schema';

export const CHART_TYPES = ['bar', 'line', 'area', 'pie'] as const;
export const CHART_GROUP_BY = [
  'abc',
  'frecuencia',
  'psr',
  'centroPlanificacion',
  'status',
  'month',
  'year',
] as const;
export const CHART_METRICS = ['count', 'hhPlanned', 'hhActual'] as const;

export type ChartType = (typeof CHART_TYPES)[number];
export type ChartGroupBy = (typeof CHART_GROUP_BY)[number];
export type ChartMetric = (typeof CHART_METRICS)[number];

export const ChartSpecSchema = z
  .object({
    chartType: z.enum(CHART_TYPES),
    groupBy: z.enum(CHART_GROUP_BY),
    metric: z.enum(CHART_METRICS),
    title: z.string().trim().min(1).max(80).optional(),
    filter: AiFilterSchema.optional(),
  })
  .strict();

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export const CHART_SPEC_FIELDS_FOR_PROMPT = [
  `chartType (${CHART_TYPES.map((t) => `"${t}"`).join('|')})`,
  `groupBy (${CHART_GROUP_BY.map((t) => `"${t}"`).join('|')}) — eje categórico`,
  `metric (${CHART_METRICS.map((t) => `"${t}"`).join('|')}) — eje numérico/valor agregado`,
  'title (string breve ≤80, opcional)',
  'filter (objeto opcional con los mismos campos del AiFilter estándar: q, psr, abc, frecuenciaCodigo, centroPlanificacion, equipo, ubicacionTecnica, yearFrom, yearTo, monthFrom, monthTo, onlyOverdue, onlyUpcomingDays, take)',
] as const;

import { z } from 'zod';
import { AiFilterSchema } from '../ai-filter.schema';

export const AskRequestSchema = z.object({
  prompt: z.string().max(500),
  sessionContext: z
    .object({
      lastFilter: AiFilterSchema.optional(),
      lastMode: z.enum(['search', 'chart']).optional(),
    })
    .optional(),
  override: z.enum(['search', 'chart']).optional(),
}).strict();

export type AskRequest = z.infer<typeof AskRequestSchema>;

export const SuggestionSchema = z.union([
  z.object({
    type: z.literal('prompt'),
    label: z.string(),
    prompt: z.string(),
  }),
  z.object({
    type: z.literal('filterDelta'),
    label: z.string(),
    filterDelta: AiFilterSchema.partial(),
    count: z.number().int().nonnegative(),
  }),
]);
export type Suggestion = z.infer<typeof SuggestionSchema>;

const MetaSchema = z.object({
  model: z.string(),
  latencyMs: z.number().int().nonnegative(),
  parser: z.enum(['heuristic', 'llm']),
  classifier: z.enum(['heuristic', 'llm']),
  requestId: z.string(),
});

const GreetingPayload = z.object({ message: z.string(), suggestions: z.array(SuggestionSchema) });
const ClarifyPayload = GreetingPayload;
const SearchPayload = z.object({
  count: z.number().int().nonnegative(),
  rows: z.array(z.any()),
  filter: AiFilterSchema,
  truncated: z.boolean().optional(),
  suggestions: z.array(SuggestionSchema).optional(),
});
const ChartPayload = z.object({
  spec: z.any(),
  data: z.array(z.any()),
  total: z.object({ count: z.number().int().nonnegative() }),
  suggestions: z.array(SuggestionSchema).optional(),
});

export const AskResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('greeting'), payload: GreetingPayload, meta: MetaSchema }),
  z.object({ kind: z.literal('clarify'),  payload: ClarifyPayload,  meta: MetaSchema }),
  z.object({ kind: z.literal('search'),   payload: SearchPayload, mode: z.enum(['detected','forced']), meta: MetaSchema }),
  z.object({ kind: z.literal('chart'),    payload: ChartPayload,  mode: z.enum(['detected','forced']), meta: MetaSchema }),
  z.object({ kind: z.literal('error'),    payload: z.object({ message: z.string(), code: z.string(), hint: z.string().optional() }), meta: MetaSchema }),
]);
export type AskResponse = z.infer<typeof AskResponseSchema>;

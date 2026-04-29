import type { AiFilter } from './ai-filter.schema';

const STOP_WORDS = new Set([
  'que',
  'qué',
  'hay',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'en',
  'para',
  'por',
  'con',
  'sin',
  'al',
  'un',
  'una',
  'unos',
  'unas',
  'se',
  'me',
  'mi',
  'mis',
  'tu',
  'sus',
  'y',
  'o',
  'u',
  'this',
  'week',
  'next',
  'tareas',
  'tarea',
  'mantencion',
  'mantenciones',
  'mantenimiento',
  'mantenimientos',
  'proximo',
  'proxima',
  'próximo',
  'próxima',
  'semana',
  'dias',
  'días',
  'dia',
  'día',
  'vencido',
  'vencida',
  'vencidos',
  'vencidas',
  'atrasado',
  'atrasada',
  'atrasados',
  'atrasadas',
  'buscar',
  'busca',
]);

export function heuristicFilterFromPrompt(prompt: string): AiFilter {
  const out: AiFilter = { take: 50 };
  const lower = prompt.toLowerCase();

  if (/(vencid|atrasad|overdue)/i.test(lower)) {
    out.onlyOverdue = true;
  }

  const days = parseUpcomingDays(lower);
  if (days && !out.onlyOverdue) out.onlyUpcomingDays = days;

  const freq = parseFrequency(prompt);
  if (freq) out.frecuenciaCodigo = freq;

  const abc = firstGroup(prompt, /\babc\s*[:=]?\s*([abc])\b/i) ?? firstGroup(prompt, /\b([abc])\s*abc\b/i);
  if (abc) out.abc = abc.toUpperCase() as 'A' | 'B' | 'C';

  const years = Array.from(prompt.matchAll(/\b20\d{2}\b/g)).map((m) => Number(m[0]));
  if (years.length === 1) {
    out.yearFrom = years[0];
    out.yearTo = years[0];
  } else if (years.length >= 2) {
    out.yearFrom = Math.min(...years);
    out.yearTo = Math.max(...years);
  }

  const psr = firstGroup(prompt, /\bpsr\s*[:=]?\s*([\p{L}0-9 ._\/-]{2,64})/iu);
  if (psr) out.psr = cleanValue(psr);

  const centro =
    firstGroup(prompt, /\bcentro(?:\s+de)?\s+planificaci[oó]n\s*[:=]?\s*([\p{L}0-9 ._\/-]{2,64})/iu) ??
    firstGroup(prompt, /\bcentro\s*[:=]?\s*([\p{L}0-9 ._\/-]{2,64})/iu);
  if (centro) out.centroPlanificacion = cleanValue(centro);

  const equipo = firstGroup(prompt, /\bequipo\s*[:=]?\s*([\p{L}0-9 ._\/-]{2,64})/iu);
  if (equipo) out.equipo = cleanValue(equipo);

  const ubicacion = firstGroup(prompt, /\bubicaci[oó]n\s*t[eé]cnica\s*[:=]?\s*([\p{L}0-9 ._\/-]{2,64})/iu);
  if (ubicacion) out.ubicacionTecnica = cleanValue(ubicacion);

  const q = extractSearchTerms(prompt);
  if (q) out.q = q;

  return out;
}

function parseUpcomingDays(lower: string): number | null {
  const byDays = lower.match(/(?:pr[oó]xim(?:o|a|os|as)?|en)\s+(\d{1,3})\s*d[ií]as?/i);
  if (byDays) {
    const n = Number(byDays[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 365) return n;
  }

  if (/(esta semana|siguiente semana|pr[oó]xima semana)/i.test(lower)) return 7;
  if (/(pr[oó]ximo mes|proximo mes|30\s*d[ií]as)/i.test(lower)) return 30;
  return null;
}

function parseFrequency(prompt: string): string | null {
  const code = prompt.toUpperCase().match(/\b(10|[1-9])\s*([MA])\b/);
  if (code) return `${code[1]}${code[2]}`;

  const lower = prompt.toLowerCase();
  if (/(quinquenal|cada\s*5\s*a[nñ]os?)/i.test(lower)) return '5A';
  if (/(semestral|cada\s*6\s*meses?)/i.test(lower)) return '6M';
  if (/(trimestral|cada\s*3\s*meses?)/i.test(lower)) return '3M';
  if (/(bimensual|cada\s*2\s*meses?)/i.test(lower)) return '2M';
  if (/(mensual|cada\s*mes)/i.test(lower)) return '1M';
  if (/(anual|cada\s*a[nñ]o)/i.test(lower)) return '1A';
  return null;
}

function firstGroup(input: string, re: RegExp): string | null {
  const m = input.match(re);
  if (!m?.[1]) return null;
  return m[1].trim();
}

function cleanValue(v: string): string {
  return v.replace(/[;,|]+$/g, '').trim().slice(0, 128);
}

function extractSearchTerms(prompt: string): string | undefined {
  const tokens = prompt
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}0-9]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter((t) => !STOP_WORDS.has(t))
    .filter((t) => !/^20\d{2}$/.test(t))
    .slice(0, 8);

  if (tokens.length === 0) return undefined;
  const q = tokens.join(' ').slice(0, 96).trim();
  return q.length >= 2 ? q : undefined;
}

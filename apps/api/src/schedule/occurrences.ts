/**
 * Generador determinista de ocurrencias de mantención.
 *
 * Reglas:
 *  - frecuenciaMeses define el período en meses (1A=12, 6M=6, 5A=60, 3M=3, etc).
 *  - mesInicio (1..12) = mes calendario de la primera ocurrencia conocida.
 *  - anchorYear = año de la primera ocurrencia conocida.
 *  - hhPlanned = hhReal de la tarea.
 *  - Genera todas las ocurrencias entre [from, to].
 */

export interface OccurrenceInput {
  frecuenciaMeses: number;
  mesInicio: number;
  anchorYear: number;
  hhPlanned: number;
}

export interface Occurrence {
  year: number;
  month: number;
  hhPlanned: number;
}

export function generateOccurrences(
  input: OccurrenceInput,
  from: { year: number; month: number },
  to: { year: number; month: number },
): Occurrence[] {
  const { frecuenciaMeses, mesInicio, anchorYear, hhPlanned } = input;
  if (!Number.isInteger(frecuenciaMeses) || frecuenciaMeses <= 0) return [];
  if (!Number.isInteger(mesInicio) || mesInicio < 1 || mesInicio > 12) return [];
  if (!Number.isInteger(anchorYear)) return [];

  const out: Occurrence[] = [];
  const fromIdx = from.year * 12 + (from.month - 1);
  const toIdx = to.year * 12 + (to.month - 1);
  const anchorIdx = anchorYear * 12 + (mesInicio - 1);

  // Avanza desde el anchor hasta llegar a >= fromIdx en pasos de frecuenciaMeses
  let idx = anchorIdx;
  if (idx < fromIdx) {
    const delta = fromIdx - idx;
    const k = Math.ceil(delta / frecuenciaMeses);
    idx += k * frecuenciaMeses;
  } else if (idx > fromIdx) {
    // Retrocede hasta justo antes de fromIdx, luego avanza un paso
    const delta = idx - fromIdx;
    const k = Math.floor(delta / frecuenciaMeses);
    idx -= k * frecuenciaMeses;
  }

  while (idx <= toIdx) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push({ year: y, month: m, hhPlanned });
    idx += frecuenciaMeses;
  }

  return out;
}

/**
 * Mapeo de códigos de frecuencia → meses (fallback si frecuenciaMeses está vacío).
 * Cubre los códigos SAP-PM más comunes en el Excel.
 */
export const FRECUENCIA_CODIGO_TO_MESES: Record<string, number> = {
  '1M': 1,
  '2M': 2,
  '3M': 3,
  '4M': 4,
  '6M': 6,
  '1A': 12,
  '2A': 24,
  '3A': 36,
  '4A': 48,
  '5A': 60,
  '10A': 120,
};

export function resolveFrecuenciaMeses(
  frecuenciaMeses: number | null | undefined,
  frecuenciaCodigo: string | null | undefined,
): number | null {
  if (frecuenciaMeses && frecuenciaMeses > 0) return frecuenciaMeses;
  if (frecuenciaCodigo) {
    const norm = frecuenciaCodigo.trim().toUpperCase().replace(/\s+/g, '');
    if (FRECUENCIA_CODIGO_TO_MESES[norm]) return FRECUENCIA_CODIGO_TO_MESES[norm];
  }
  return null;
}

/**
 * Convierte (year, month) → fecha del primer día del mes (UTC).
 */
export function ymToDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

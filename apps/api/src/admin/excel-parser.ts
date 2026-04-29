import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';

export interface ParsedTask {
  task: Record<string, unknown>;
  schedule: { year: number; month: number; hh: number }[];
  sourceRowHash: string;
}

interface MonthCol {
  col: number;
  year: number;
  month: number;
}

const CORE_COLS: Record<number, string> = {
  1: 'andamios',
  2: 'materiales',
  3: 'comentarios',
  4: 'psr',
  5: 'centroPlanificacion',
  6: 'claseActividadPm',
  7: 'claseOrden',
  8: 'campoClasificacion',
  9: 'planMantPreventivo',
  10: 'estrategiaMantenim',
  11: 'descPosicionMant',
  12: 'ultimaOrden',
  13: 'indicadorAbc',
  14: 'ubicacionTecnica',
  15: 'denomUbicacionTecnica',
  16: 'posicionMant',
  17: 'ptoTbjoResponsable',
  18: 'equipo',
  19: 'denomObjetoTecnico',
  20: 'tipoHojaRuta',
  21: 'grupoHojasRuta',
  22: 'contGrupoHRuta',
  23: 'hojaRuta',
  24: 'creadoEl',
  25: 'claveModelo',
  26: 'frecuenciaCodigo',
  27: 'hhReal',
  28: 'frecuenciaMeses',
  29: 'mesInicio',
};

const MONTHLY_START_COL = 30; // column 30 = AD
const MONTHLY_FALLBACK_COUNT = 84; // ene-22 → dic-28 (retrocompatibilidad)
const MAX_MONTH_COL_SCAN = 360; // hasta 30 años de columnas mensuales
const MONTH_SCAN_BREAK_STREAK = 12;
const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;

const MONTH_MAP: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  jan: 1,
  apr: 4,
  aug: 8,
  dec: 12,
};

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (typeof v === 'object' && 'text' in (v as object)) return (v as { text: string }).text;
  if (typeof v === 'object' && 'result' in (v as object)) return (v as { result: unknown }).result;
  return v;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  const n = toNumber(v);
  if (n != null) {
    // Excel serial date
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + n * 86400000);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseHeaderMonth(v: unknown): { year: number; month: number } | null {
  const d = toDate(v);
  if (d) {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  const m = s.match(/^([a-z]{3})[-\/_\s]?(\d{2,4})$/i);
  if (!m) return null;

  const month = MONTH_MAP[m[1]!.toLowerCase()];
  if (!month) return null;
  let year = Number(m[2]);
  if (!Number.isFinite(year)) return null;
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2100) return null;
  return { year, month };
}

function deriveMonthColumns(headerRow: ExcelJS.Row): MonthCol[] {
  const cols: MonthCol[] = [];
  let missStreak = 0;

  for (let i = 0; i < MAX_MONTH_COL_SCAN; i++) {
    const col = MONTHLY_START_COL + i;
    const parsed = parseHeaderMonth(cellValue(headerRow.getCell(col).value));
    if (!parsed) {
      if (cols.length > 0) {
        missStreak++;
        if (missStreak >= MONTH_SCAN_BREAK_STREAK) break;
      }
      continue;
    }

    missStreak = 0;
    cols.push({ col, year: parsed.year, month: parsed.month });
  }

  if (cols.length > 0) return cols;

  // Fallback histórico si encabezados no vienen parseables.
  const fallback: MonthCol[] = [];
  for (let i = 0; i < MONTHLY_FALLBACK_COUNT; i++) {
    const total = 2022 * 12 + i;
    fallback.push({
      col: MONTHLY_START_COL + i,
      year: Math.floor(total / 12),
      month: (total % 12) + 1,
    });
  }
  return fallback;
}

export async function parseExcelBuffer(buffer: Buffer): Promise<{ tasks: ParsedTask[] }> {
  if (buffer.byteLength > MAX_EXCEL_BYTES) {
    throw new Error('Excel exceeds size limit');
  }

  const wb = new ExcelJS.Workbook();
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet');

  // Month columns: derive year/month from row 8 (serial date or label like ene-22).
  const headerRow = ws.getRow(8);
  const monthCols = deriveMonthColumns(headerRow);

  const tasks: ParsedTask[] = [];
  const lastRow = ws.actualRowCount;
  if (lastRow > MAX_ROWS) {
    throw new Error(`Excel has too many rows (${lastRow})`);
  }

  for (let r = 9; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const task: Record<string, unknown> = {};
    let hasData = false;

    for (const [colStr, field] of Object.entries(CORE_COLS)) {
      const col = Number(colStr);
      const raw = cellValue(row.getCell(col).value);
      if (field === 'creadoEl') task[field] = toDate(raw);
      else if (field === 'hhReal') task[field] = toNumber(raw);
      else if (field === 'frecuenciaMeses' || field === 'mesInicio') task[field] = toInt(raw);
      else task[field] = toStr(raw);
      if (task[field] != null) hasData = true;
    }
    if (!hasData) continue;

    const schedule: { year: number; month: number; hh: number }[] = [];
    for (const meta of monthCols) {
      const hh = toNumber(cellValue(row.getCell(meta.col).value));
      if (hh != null && hh > 0) {
        schedule.push({ year: meta.year, month: meta.month, hh });
      }
    }

    const hash = createHash('sha256').update(JSON.stringify(task)).digest('hex');
    tasks.push({ task, schedule, sourceRowHash: hash });
  }

  return { tasks };
}

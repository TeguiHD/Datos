import { generateOccurrences, resolveFrecuenciaMeses } from './occurrences';

describe('generateOccurrences', () => {
  it('genera anual desde anchor 2022 hasta 2030', () => {
    const occ = generateOccurrences(
      { frecuenciaMeses: 12, mesInicio: 3, anchorYear: 2022, hhPlanned: 8 },
      { year: 2022, month: 1 },
      { year: 2030, month: 12 },
    );
    expect(occ).toHaveLength(9);
    expect(occ[0]).toEqual({ year: 2022, month: 3, hhPlanned: 8 });
    expect(occ.at(-1)).toEqual({ year: 2030, month: 3, hhPlanned: 8 });
  });

  it('genera 6M correctamente', () => {
    const occ = generateOccurrences(
      { frecuenciaMeses: 6, mesInicio: 1, anchorYear: 2024, hhPlanned: 4 },
      { year: 2024, month: 1 },
      { year: 2025, month: 12 },
    );
    expect(occ.map((o) => `${o.year}-${o.month}`)).toEqual(['2024-1', '2024-7', '2025-1', '2025-7']);
  });

  it('genera quinquenal 5A', () => {
    const occ = generateOccurrences(
      { frecuenciaMeses: 60, mesInicio: 6, anchorYear: 2022, hhPlanned: 100 },
      { year: 2022, month: 1 },
      { year: 2050, month: 12 },
    );
    expect(occ.map((o) => o.year)).toEqual([2022, 2027, 2032, 2037, 2042, 2047]);
    expect(occ.every((o) => o.month === 6)).toBe(true);
  });

  it('respeta from cuando es posterior al anchor', () => {
    const occ = generateOccurrences(
      { frecuenciaMeses: 12, mesInicio: 1, anchorYear: 2020, hhPlanned: 1 },
      { year: 2026, month: 6 },
      { year: 2028, month: 12 },
    );
    expect(occ.map((o) => o.year)).toEqual([2027, 2028]);
  });

  it('rechaza inputs inválidos', () => {
    expect(generateOccurrences({ frecuenciaMeses: 0, mesInicio: 1, anchorYear: 2022, hhPlanned: 1 }, { year: 2022, month: 1 }, { year: 2030, month: 12 })).toEqual([]);
    expect(generateOccurrences({ frecuenciaMeses: 12, mesInicio: 13, anchorYear: 2022, hhPlanned: 1 }, { year: 2022, month: 1 }, { year: 2030, month: 12 })).toEqual([]);
  });
});

describe('resolveFrecuenciaMeses', () => {
  it('prefiere frecuenciaMeses', () => {
    expect(resolveFrecuenciaMeses(6, '1A')).toBe(6);
  });
  it('mapea códigos comunes', () => {
    expect(resolveFrecuenciaMeses(null, '1A')).toBe(12);
    expect(resolveFrecuenciaMeses(null, '5A')).toBe(60);
    expect(resolveFrecuenciaMeses(null, '6m')).toBe(6);
    expect(resolveFrecuenciaMeses(null, ' 3M ')).toBe(3);
  });
  it('null para desconocido', () => {
    expect(resolveFrecuenciaMeses(null, 'XYZ')).toBeNull();
    expect(resolveFrecuenciaMeses(null, null)).toBeNull();
  });
});

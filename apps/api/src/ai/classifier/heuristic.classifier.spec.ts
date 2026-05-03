import { HeuristicClassifier } from './heuristic.classifier';

describe('HeuristicClassifier', () => {
  const c = new HeuristicClassifier();

  it.each([
    ['hola', 'greeting'],
    ['Hola Bernardo', 'greeting'],
    ['gracias', 'greeting'],
    ['ok', 'greeting'],
    ['buenas tardes', 'greeting'],
    ['', 'greeting'],
  ])('classifies "%s" as greeting', (input, expected) => {
    expect(c.classify(input)).toBe(expected);
  });

  it.each([
    ['vencidas mes', 'search'],
    ['PSR Pérez próximas', 'search'],
    ['preventivos PM01', 'search'],
    ['HH planificadas 2026', 'search'],
  ])('classifies "%s" as search', (input, expected) => {
    expect(c.classify(input)).toBe(expected);
  });

  it.each([
    ['gráfico HH por mes', 'chart'],
    ['tendencia ejecución', 'chart'],
    ['compara PSR', 'chart'],
    ['distribución ABC', 'chart'],
    ['evolución 2026', 'chart'],
  ])('classifies "%s" as chart', (input, expected) => {
    expect(c.classify(input)).toBe(expected);
  });

  it.each([
    ['y los del próximo trimestre', 'unknown'],
    ['🤔', 'unknown'],
    ['xyz qwerty', 'unknown'],
  ])('classifies "%s" as unknown', (input, expected) => {
    expect(c.classify(input)).toBe(expected);
  });

  it('chart wins over search if both keywords match', () => {
    expect(c.classify('gráfico de vencidas')).toBe('chart');
  });
});

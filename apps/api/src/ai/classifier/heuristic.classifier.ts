import { Injectable } from '@nestjs/common';

export type Intent = 'greeting' | 'search' | 'chart' | 'unknown';

const GREETING_RE = /^(hola|holi|holis|buenas|hey|hi|hello|gracias|chao|ok|listo|dale)\b/i;
const CHART_KW    = /\b(grafico|gráfico|tendencia|compara|distribuci|evoluci|histograma|pie|barras|por (mes|año|psr|abc))\b/i;
const DOMAIN_KW   = /\b(vencid|psr|hh|preventiv|manto|equipo|pm0\d|2026|2027|abc|ejecutad|planificad|denomi|posici|ticket|antic)/i;

@Injectable()
export class HeuristicClassifier {
  classify(prompt: string): Intent {
    const p = (prompt ?? '').trim().toLowerCase();
    if (!p) return 'greeting';
    if (GREETING_RE.test(p) && p.length < 30) return 'greeting';
    if (CHART_KW.test(p)) return 'chart';
    if (DOMAIN_KW.test(p)) return 'search';
    return 'unknown';
  }
}

/**
 * Sanitiza prompt de usuario contra inyección al LLM.
 * No es 100% blindaje (ningún sanitizer lo es), pero reduce vectores comunes.
 * La defensa real es: el LLM solo emite JSON validado por Zod, nunca SQL ni acción.
 */
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) (instructions|prompts?)/gi,
  /disregard (the )?(system|previous|safety)/gi,
  /(you are|act as|pretend to be) (now )?(a |an )?(different|new|dan|developer|god|admin|root)/gi,
  /jailbreak/gi,
  /system\s*(prompt|instructions?|message)\s*:/gi,
  /assistant\s*:/gi,
  /\brole\s*:\s*(system|assistant|developer|user)\b/gi,
  /<\|.*?\|>/g,
  /\[\s*(INST|SYS|system|assistant|user)\s*\]/gi,
  /\u202E/g, // RTL override
  /\u200B|\u200C|\u200D|\uFEFF/g, // zero-width chars
  /\bbase64\s*:/gi,
  /(drop|truncate|delete|update|insert)\s+(table|from|into)/gi,
  /(\bEOS\b|\bEOT\b|END_OF_(PROMPT|SYSTEM))/g,
];

const DENY_PATTERNS = [
  /\b(prompt|system|instructions?)\s+(leak|dump|reveal|show|print|expose)/gi,
  /reveal (your|the) (prompt|instructions?|system)/gi,
  /what (are|is) your (prompt|instructions?|system)/gi,
];

const MAX_LEN = 500;

export function sanitizeUserPrompt(input: string): string {
  let s = input.normalize('NFKC').slice(0, MAX_LEN);
  for (const p of INJECTION_PATTERNS) s = s.replace(p, '[REDACTED]');
  for (const p of DENY_PATTERNS) s = s.replace(p, '[REDACTED]');
  // Quita backticks que el LLM podría confundir con bloques de instrucción
  s = s.replace(/```[\s\S]*?```/g, '[CODE_REDACTED]');
  // Control chars fuera de tab/newline básicos
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ');
  // Colapsa whitespace excesivo
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Detecta consultas demasiado amplias/sin sentido de negocio.
 * Útil para evitar dumps masivos cuando no hay filtro del LLM.
 */
export function isBroadQuery(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  if (p.length < 3) return true;
  const BROAD = ['todo', 'todos', 'listar todo', 'dame todo', 'muestra todo', '*', 'all', 'everything'];
  return BROAD.includes(p);
}

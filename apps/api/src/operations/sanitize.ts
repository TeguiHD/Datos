import DOMPurify from 'isomorphic-dompurify';

export function sanitizeObject<T extends object>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = typeof value === 'string' ? DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) : value;
  }
  return out as T;
}

export function normalizePsr(psr: string): string {
  return psr.trim().replace(/\s+/g, '-').toUpperCase();
}

import { AskRequestSchema, AskResponseSchema } from './ask.dto';

describe('AskRequestSchema', () => {
  it('accepts minimal request', () => {
    const r = AskRequestSchema.safeParse({ prompt: 'vencidas' });
    expect(r.success).toBe(true);
  });
  it('accepts request with sessionContext', () => {
    const r = AskRequestSchema.safeParse({
      prompt: 'y próximo mes',
      sessionContext: { lastFilter: { psr: 'Pérez' }, lastMode: 'search' },
    });
    expect(r.success).toBe(true);
  });
  it('rejects empty prompt longer than 500 chars', () => {
    expect(AskRequestSchema.safeParse({ prompt: 'a'.repeat(501) }).success).toBe(false);
  });
  it('accepts empty prompt (greeting trigger)', () => {
    expect(AskRequestSchema.safeParse({ prompt: '' }).success).toBe(true);
  });
  it('rejects invalid override', () => {
    expect(AskRequestSchema.safeParse({ prompt: 'x', override: 'foo' }).success).toBe(false);
  });
});

describe('AskResponseSchema', () => {
  it('accepts greeting kind', () => {
    const r = AskResponseSchema.safeParse({
      kind: 'greeting',
      payload: { message: 'Hola', suggestions: [] },
      meta: { model: 'heuristic', latencyMs: 5, parser: 'heuristic', classifier: 'heuristic', requestId: 'r1' },
    });
    expect(r.success).toBe(true);
  });
  it('accepts search kind', () => {
    const r = AskResponseSchema.safeParse({
      kind: 'search',
      payload: { count: 0, rows: [], filter: {} },
      mode: 'detected',
      meta: { model: 'gpt', latencyMs: 100, parser: 'llm', classifier: 'heuristic', requestId: 'r2' },
    });
    expect(r.success).toBe(true);
  });
});

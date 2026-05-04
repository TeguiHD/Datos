import { Role } from '@prisma/client';
import { AiAskService } from './ai-ask.service';
import { HeuristicClassifier } from './classifier/heuristic.classifier';

describe('AiAskService', () => {
  const user = { id: 'u1', role: Role.ADMIN };
  const ctx = { ip: '127.0.0.1', userAgent: 'jest' };

  function makeService(overrides: Partial<Record<'llm' | 'greeting' | 'search' | 'chart', unknown>> = {}) {
    const llm = overrides.llm ?? { classify: jest.fn() };
    const greeting = overrides.greeting ?? {
      build: jest.fn().mockResolvedValue({ message: 'Hola', suggestions: [] }),
    };
    const search = overrides.search ?? {
      search: jest.fn().mockResolvedValue({
        filter: { onlyOverdue: true },
        mode: 'executions',
        count: 1,
        rows: [{ id: 'e1' }],
        _meta: { model: 'heuristic-fallback', latencyMs: 0, parser: 'heuristic' },
      }),
    };
    const chart = overrides.chart ?? {
      build: jest.fn().mockResolvedValue({
        spec: { chartType: 'bar', groupBy: 'abc', metric: 'count' },
        data: [{ key: 'A', value: 1, count: 1 }],
        total: { value: 1, count: 1 },
        _meta: { model: 'heuristic-fallback', latencyMs: 0, parser: 'heuristic' },
      }),
    };

    return {
      service: new AiAskService(
        new HeuristicClassifier(),
        llm as never,
        greeting as never,
        search as never,
        chart as never,
      ),
      llm,
      greeting,
      search,
      chart,
    };
  }

  it('returns greeting without calling search or chart', async () => {
    const { service, greeting, search, chart } = makeService();

    const result = await service.ask(user, { prompt: 'hola' }, ctx);

    expect(result.kind).toBe('greeting');
    expect((greeting as { build: jest.Mock }).build).toHaveBeenCalledTimes(1);
    expect((search as { search: jest.Mock }).search).not.toHaveBeenCalled();
    expect((chart as { build: jest.Mock }).build).not.toHaveBeenCalled();
  });

  it('routes domain prompts to search', async () => {
    const { service, search } = makeService();

    const result = await service.ask(user, { prompt: 'vencidas PSR Perez' }, ctx);

    expect(result.kind).toBe('search');
    expect((search as { search: jest.Mock }).search).toHaveBeenCalledWith(user, 'vencidas PSR Perez', ctx, {
      lastFilter: undefined,
    });
  });

  it('uses override to force chart', async () => {
    const { service, chart } = makeService();

    const result = await service.ask(user, { prompt: 'vencidas', override: 'chart' }, ctx);

    expect(result.kind).toBe('chart');
    expect((chart as { build: jest.Mock }).build).toHaveBeenCalledWith(user, 'vencidas', ctx, {
      lastFilter: undefined,
    });
  });

  it('uses LLM classifier for unknown followups', async () => {
    const llm = { classify: jest.fn().mockResolvedValue('search') };
    const { service, search } = makeService({ llm });

    const result = await service.ask(
      user,
      { prompt: 'y el próximo mes', sessionContext: { lastFilter: { psr: 'Perez' }, lastMode: 'search' } },
      ctx,
    );

    expect(result.kind).toBe('search');
    expect(llm.classify).toHaveBeenCalledTimes(1);
    expect((search as { search: jest.Mock }).search).toHaveBeenCalledWith(user, 'y el próximo mes', ctx, {
      lastFilter: { psr: 'Perez' },
    });
  });
});

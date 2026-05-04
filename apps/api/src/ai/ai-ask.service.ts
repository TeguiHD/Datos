import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ChartBuilderService } from './chart.service';
import { AiSearchService } from './ai-search.service';
import { HeuristicClassifier, type Intent } from './classifier/heuristic.classifier';
import { LlmClassifier } from './classifier/llm.classifier';
import { AskRequest, AskRequestSchema, AskResponse, Suggestion } from './dto/ask.dto';
import { GreetingService } from './templates/greeting.service';

type RequestContext = { ip: string; userAgent: string };
type UserContext = { id: string; role: Role };

@Injectable()
export class AiAskService {
  private readonly log = new Logger(AiAskService.name);

  constructor(
    private readonly classifier: HeuristicClassifier,
    private readonly llmClassifier: LlmClassifier,
    private readonly greeting: GreetingService,
    private readonly searchService: AiSearchService,
    private readonly chartService: ChartBuilderService,
  ) {}

  async ask(user: UserContext, rawBody: unknown, ctx: RequestContext): Promise<AskResponse> {
    const requestId = randomUUID();
    const started = Date.now();
    const parsed = AskRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return this.error('INPUT_INVALID', 'Consulta inválida.', started, requestId, parsed.error.issues[0]?.message);
    }

    const body = parsed.data;
    const prompt = body.prompt.trim();
    const heuristicIntent = this.classifier.classify(prompt);
    const forced = body.override && heuristicIntent !== 'greeting';
    let intent: Intent | 'clarify' = forced ? body.override! : heuristicIntent;
    let classifier: 'heuristic' | 'llm' = 'heuristic';

    if (intent === 'greeting') {
      const payload = await this.greeting.build();
      return {
        kind: 'greeting',
        payload,
        meta: this.meta(started, requestId, 'heuristic', classifier, 'heuristic'),
      };
    }

    if (intent === 'unknown') {
      classifier = 'llm';
      try {
        intent = await this.llmClassifier.classify(prompt, body.sessionContext);
      } catch (e) {
        this.log.warn(`llm_classifier_failed: ${(e as Error).message}`);
        intent = 'clarify';
      }
    }

    if (intent === 'clarify') {
      return {
        kind: 'clarify',
        payload: {
          message: 'No tengo suficiente contexto para consultar la planificación. Prueba con un PSR, rango, equipo o pide un gráfico.',
          suggestions: clarifySuggestions(),
        },
        meta: this.meta(started, requestId, 'heuristic', classifier, 'heuristic'),
      };
    }

    try {
      if (intent === 'chart') {
        const result = await this.chartService.build(user, prompt, ctx, {
          lastFilter: body.sessionContext?.lastFilter,
        });
        return {
          kind: 'chart',
          payload: {
            spec: result.spec,
            data: result.data,
            total: result.total,
            suggestions: result.data.length === 0 ? noResultSuggestions() : undefined,
          },
          mode: forced ? 'forced' : 'detected',
          meta: this.meta(started, requestId, result._meta.model, classifier, result._meta.parser),
        };
      }

      const result = await this.searchService.search(user, prompt, ctx, {
        lastFilter: body.sessionContext?.lastFilter,
      });
      return {
        kind: 'search',
        payload: {
          count: result.count,
          rows: result.rows,
          filter: result.filter,
          truncated: result.count > result.rows.length,
          suggestions: result.count === 0 ? noResultSuggestions() : undefined,
        },
        mode: forced ? 'forced' : 'detected',
        meta: this.meta(started, requestId, result._meta.model, classifier, result._meta.parser),
      };
    } catch (e) {
      return this.fromException(e, started, requestId, classifier);
    }
  }

  private fromException(
    e: unknown,
    started: number,
    requestId: string,
    classifier: 'heuristic' | 'llm',
  ): AskResponse {
    if (e instanceof HttpException) {
      const response = e.getResponse();
      const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
      return this.error(
        `HTTP_${e.getStatus()}`,
        String(body.message ?? e.message ?? 'No se pudo procesar la consulta.'),
        started,
        requestId,
        typeof body.hint === 'string' ? body.hint : undefined,
        classifier,
      );
    }

    this.log.error(`ask_failed: ${(e as Error).message}`, (e as Error).stack);
    return this.error('AI_ASK_FAILED', 'Error temporal procesando la consulta.', started, requestId, undefined, classifier);
  }

  private error(
    code: string,
    message: string,
    started: number,
    requestId: string,
    hint?: string,
    classifier: 'heuristic' | 'llm' = 'heuristic',
  ): AskResponse {
    return {
      kind: 'error',
      payload: { code, message, hint },
      meta: this.meta(started, requestId, 'system', classifier, 'heuristic'),
    };
  }

  private meta(
    started: number,
    requestId: string,
    model: string,
    classifier: 'heuristic' | 'llm',
    parser: 'heuristic' | 'llm',
  ): AskResponse['meta'] {
    return {
      model,
      latencyMs: Math.max(0, Date.now() - started),
      parser,
      classifier,
      requestId,
    };
  }
}

function clarifySuggestions(): Suggestion[] {
  return [
    { type: 'prompt', label: 'Vencidas', prompt: 'vencidas' },
    { type: 'prompt', label: 'Próximos 30 días', prompt: 'próximos 30 días' },
    { type: 'prompt', label: 'HH por mes 2026', prompt: 'gráfico HH planificadas por mes 2026' },
  ];
}

function noResultSuggestions(): Suggestion[] {
  return [
    { type: 'prompt', label: 'Quitar filtros específicos', prompt: 'vencidas' },
    { type: 'prompt', label: 'Próximos 30 días', prompt: 'próximos 30 días' },
    { type: 'prompt', label: 'Gráfico por PSR', prompt: 'gráfico por PSR' },
  ];
}

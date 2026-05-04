import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { AskRequest } from '../dto/ask.dto';
import { callLlmForClassifier, tryParseJson } from '../llm.client';

export type LlmIntent = 'search' | 'chart' | 'clarify';

const LlmClassifierSchema = z.object({
  kind: z.enum(['search', 'chart', 'clarify']),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class LlmClassifier {
  private readonly log = new Logger(LlmClassifier.name);

  async classify(prompt: string, sessionContext?: AskRequest['sessionContext']): Promise<LlmIntent> {
    const payload = JSON.stringify({
      prompt,
      sessionContext: sessionContext ?? {},
    });

    const llm = await callLlmForClassifier(payload);
    const parsed = LlmClassifierSchema.safeParse(tryParseJson(llm.raw));
    if (!parsed.success) {
      this.log.warn(`llm_classifier_invalid: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
      return 'clarify';
    }

    if (parsed.data.confidence < 0.6) return 'clarify';
    return parsed.data.kind;
  }
}

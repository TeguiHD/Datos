/**
 * Cuota por usuario y por tipo de acción IA.
 * Contador en memoria con ventana deslizante simple.
 * Adecuado para despliegue single-process; migrable a Redis si se escala horizontalmente.
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';

interface Bucket {
  windowStart: number;
  count: number;
}

export type AiAction = 'search' | 'chart' | 'insight';

const WINDOW_MS = 60 * 60 * 1000; // 1h
const LIMITS: Record<Role, Record<AiAction, number>> = {
  SUPERADMIN: { search: 400, chart: 200, insight: 120 },
  ADMIN: { search: 300, chart: 150, insight: 80 },
  EDITOR: { search: 200, chart: 100, insight: 50 },
  VIEWER: { search: 80, chart: 30, insight: 15 },
};

@Injectable()
export class AiQuotaService {
  private readonly log = new Logger(AiQuotaService.name);
  private readonly buckets = new Map<string, Bucket>();

  check(userId: string, role: Role, action: AiAction): void {
    const limit = LIMITS[role]?.[action] ?? 30;
    const key = `${userId}:${action}`;
    const now = Date.now();
    const b = this.buckets.get(key);

    if (!b || now - b.windowStart >= WINDOW_MS) {
      this.buckets.set(key, { windowStart: now, count: 1 });
      return;
    }

    if (b.count >= limit) {
      const retryMs = WINDOW_MS - (now - b.windowStart);
      this.log.warn(`ai_quota_exceeded user=${userId} action=${action} limit=${limit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Has alcanzado el límite de ${limit} consultas por hora para ${action}. Reintenta en ${Math.ceil(retryMs / 60_000)} min.`,
          retryAfterMs: retryMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    b.count += 1;
  }

  /**
   * Estadística opcional; útil para /me/ai-usage si se expone a la UI.
   */
  snapshot(userId: string, role: Role, action: AiAction): { used: number; limit: number; resetInMs: number } {
    const limit = LIMITS[role]?.[action] ?? 30;
    const b = this.buckets.get(`${userId}:${action}`);
    if (!b || Date.now() - b.windowStart >= WINDOW_MS) {
      return { used: 0, limit, resetInMs: WINDOW_MS };
    }
    return { used: b.count, limit, resetInMs: Math.max(0, WINDOW_MS - (Date.now() - b.windowStart)) };
  }
}

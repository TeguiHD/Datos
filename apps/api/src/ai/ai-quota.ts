/**
 * Cuota por usuario y por tipo de acción IA.
 * Usa Redis cuando REDIS_URL está disponible para mantener límites consistentes
 * entre réplicas; cae a memoria local si Redis no está configurado o falla.
 */
import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Role } from '@prisma/client';
import Redis from 'ioredis';

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
export class AiQuotaService implements OnModuleDestroy {
  private readonly log = new Logger(AiQuotaService.name);
  private readonly buckets = new Map<string, Bucket>();
  private readonly redis: Redis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        })
      : null;
  }

  async onModuleDestroy() {
    if (!this.redis) return;
    await this.redis.quit().catch(() => undefined);
  }

  async check(userId: string, role: Role, action: AiAction): Promise<void> {
    if (this.redis) {
      try {
        await this.checkRedis(userId, role, action);
        return;
      } catch (e) {
        if (e instanceof HttpException) throw e;
        this.log.warn(`ai_quota_redis_fallback action=${action} error=${(e as Error).message}`);
      }
    }
    this.checkMemory(userId, role, action);
  }

  private async checkRedis(userId: string, role: Role, action: AiAction): Promise<void> {
    const limit = LIMITS[role]?.[action] ?? 30;
    const key = `datos:ai-quota:${userId}:${action}`;
    const count = await this.redis!.incr(key);

    if (count === 1) {
      await this.redis!.pexpire(key, WINDOW_MS);
      return;
    }

    if (count > limit) {
      const ttl = await this.redis!.pttl(key);
      const retryMs = ttl > 0 ? ttl : WINDOW_MS;
      this.log.warn(`ai_quota_exceeded provider=redis user=${userId} action=${action} limit=${limit}`);
      throwQuota(action, limit, retryMs);
    }
  }

  private checkMemory(userId: string, role: Role, action: AiAction): void {
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
      this.log.warn(`ai_quota_exceeded provider=memory user=${userId} action=${action} limit=${limit}`);
      throwQuota(action, limit, retryMs);
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

function throwQuota(action: AiAction, limit: number, retryMs: number): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: `Has alcanzado el límite de ${limit} consultas por hora para ${action}. Reintenta en ${Math.ceil(retryMs / 60_000)} min.`,
      retryAfterMs: retryMs,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

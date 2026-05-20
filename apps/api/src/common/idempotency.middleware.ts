import { Injectable, NestMiddleware } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const TTL_DAYS = 7;
const KEY_HEADER = 'idempotency-key';
const KEY_REGEX = /^[A-Za-z0-9._~-]{16,128}$/;
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

interface AuthRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: AuthRequest, res: Response, next: NextFunction) {
    if (!MUTATING.has(req.method)) return next();

    const key = req.header(KEY_HEADER);
    if (!key) return next();
    if (!KEY_REGEX.test(key)) {
      res.status(400).json({ message: 'Invalid Idempotency-Key' });
      return;
    }

    const userId = req.user?.id ?? null;
    const scope = `${req.method} ${req.originalUrl.split('?')[0]}`;
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(req.body ?? null))
      .digest('hex');

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.prisma.idempotencyRecord.delete({ where: { key } }).catch(() => undefined);
      } else {
        if (existing.scope !== scope || existing.bodyHash !== bodyHash || existing.userId !== userId) {
          res.status(409).json({ message: 'Idempotency-Key reused with different request' });
          return;
        }
        res.status(existing.statusCode).json(existing.response);
        return;
      }
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        this.prisma.idempotencyRecord
          .create({
            data: {
              key,
              userId,
              scope,
              bodyHash,
              response: body as never,
              statusCode: status,
              expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
            },
          })
          .catch(() => undefined);
      }
      return originalJson(body);
    };

    next();
  }
}

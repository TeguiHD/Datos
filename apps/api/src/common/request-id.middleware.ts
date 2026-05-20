import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';
const MAX_LEN = 128;
const SAFE_ID = /^[A-Za-z0-9._~-]{8,128}$/;

export function readRequestId(req: Request): string | undefined {
  const value = (req as Request & { id?: string | number }).id;
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(HEADER);
    const id = incoming && SAFE_ID.test(incoming) ? incoming.slice(0, MAX_LEN) : randomUUID();
    (req as Request & { id?: string }).id = id;
    res.setHeader(HEADER, id);
    next();
  }
}

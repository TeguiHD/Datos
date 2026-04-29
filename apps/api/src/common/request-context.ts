import type { Request } from 'express';

export interface RequestContext {
  ip: string;
  userAgent: string;
}

export function requestIp(req: Request): string {
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress ?? 'unknown';
}

export function requestUserAgent(req: Request): string {
  const userAgent = req.headers['user-agent'];
  if (typeof userAgent !== 'string' || userAgent.trim().length === 0) return 'unknown';
  return userAgent.slice(0, 512);
}

export function requestContext(req: Request): RequestContext {
  return {
    ip: requestIp(req),
    userAgent: requestUserAgent(req),
  };
}

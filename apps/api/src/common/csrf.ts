import { doubleCsrf } from 'csrf-csrf';
import type { NextFunction, Request, Response } from 'express';

function csrfSecret(): string {
  const secret = process.env.CSRF_SECRET ?? process.env.COOKIE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'dev-only-csrf-secret-change-me';
  throw new Error('CSRF_SECRET or COOKIE_SECRET is required in production');
}

function sessionIdentifier(req: Request): string {
  const refresh = req.cookies?.['refresh_token'];
  if (typeof refresh === 'string' && refresh.length > 0) return `rt:${refresh}`;

  const access = req.cookies?.['access_token'];
  if (typeof access === 'string' && access.length > 0) return `at:${access}`;

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 128) : 'unknown';
  return `anon:${ip}:${ua}`;
}

const isProd = process.env.NODE_ENV === 'production';

const { doubleCsrfProtection, generateToken, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => csrfSecret(),
  getSessionIdentifier: sessionIdentifier,
  cookieName: 'datos_csrf',
  cookieOptions: {
    path: '/',
    sameSite: 'strict',
    secure: isProd,
    httpOnly: true,
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => {
    const token = req.headers['x-csrf-token'];
    if (typeof token === 'string') return token;
    if (Array.isArray(token)) return token[0];
    return undefined;
  },
  errorConfig: {
    statusCode: 403,
    message: 'Invalid CSRF token',
    code: 'EBADCSRFTOKEN',
  },
  skipCsrfProtection: (req) => {
    if (req.path === '/api/auth/csrf') return true;
    return !(req.cookies?.['access_token'] || req.cookies?.['refresh_token']);
  },
});

export const csrfProtection = doubleCsrfProtection;

export function generateCsrfToken(req: Request, res: Response): string {
  // Rotate CSRF cookie on explicit token requests so session identifier changes
  // (e.g. after login/refresh) cannot keep an old, now-invalid token/cookie pair.
  if (req.cookies && typeof req.cookies === 'object') {
    delete req.cookies['datos_csrf'];
  }
  res.clearCookie('datos_csrf', {
    path: '/',
    sameSite: 'strict',
    secure: isProd,
    httpOnly: true,
  });
  return generateToken(req, res);
}

export function csrfErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err === invalidCsrfTokenError) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'EBADCSRFTOKEN') {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  next(err as Error);
}

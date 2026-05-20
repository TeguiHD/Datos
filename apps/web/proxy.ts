import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== 'production';
  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;
  const hasSession = Boolean(accessToken || refreshToken);
  const { pathname } = req.nextUrl;

  if (!hasSession && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (accessToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  const connectSrc = [
    `'self'`,
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    isDev ? 'http://localhost:3000' : '',
    isDev ? 'ws://localhost:3000' : '',
    isDev ? 'ws:' : '',
    isDev ? 'wss:' : '',
    'https://cloudflareinsights.com',
  ]
    .filter(Boolean)
    .join(' ');

  const csp = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `img-src 'self' data:`,
    `media-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `style-src 'self' 'unsafe-inline'`,
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ''}`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);
  // Next.js lee el nonce desde el header Content-Security-Policy del request
  // y lo aplica a todos sus <script> inline/chunk. Sin esto, sus scripts
  // quedan sin nonce y el navegador los bloquea.
  reqHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('x-nonce', nonce);
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

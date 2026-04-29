const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CSRF_PATH = '/api/auth/csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfTokenCache: string | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

function methodOf(init: RequestInit): string {
  return (init.method ?? 'GET').toUpperCase();
}

function needsCsrf(path: string, method: string): boolean {
  return !SAFE_METHODS.has(method) && path !== CSRF_PATH;
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers ?? {});
  const body = init.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!headers.has('Content-Type') && body != null && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function fetchCsrfToken(force = false): Promise<string | null> {
  if (!force && csrfTokenCache) return csrfTokenCache;

  const res = await fetch(`${API_URL}${CSRF_PATH}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { token?: string };
  if (!body?.token) return null;

  csrfTokenCache = body.token;
  return csrfTokenCache;
}

async function refreshSession(): Promise<boolean> {
  const token = await fetchCsrfToken();
  const headers = new Headers();
  if (token) headers.set('x-csrf-token', token);

  const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers,
    cache: 'no-store',
  });
  if (refreshed.ok) return true;

  if (refreshed.status === 403) {
    const renewed = await fetchCsrfToken(true);
    if (!renewed) return false;
    const retried = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': renewed },
      cache: 'no-store',
    });
    return retried.ok;
  }

  return false;
}

async function request(path: string, init: RequestInit, canRetryAuth: boolean, canRetryCsrf: boolean): Promise<Response> {
  const method = methodOf(init);
  const headers = buildHeaders(init);

  if (needsCsrf(path, method) && !headers.has('x-csrf-token')) {
    const token = await fetchCsrfToken();
    if (token) headers.set('x-csrf-token', token);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
    cache: 'no-store',
  });

  if (res.status === 401 && canRetryAuth && path !== '/api/auth/refresh' && path !== '/api/auth/login') {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, init, false, canRetryCsrf);
  }

  if (res.status === 403 && canRetryCsrf && needsCsrf(path, method)) {
    const renewed = await fetchCsrfToken(true);
    if (renewed) {
      return request(
        path,
        {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            'x-csrf-token': renewed,
          },
        },
        canRetryAuth,
        false,
      );
    }
  }

  return res;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init, true, true);

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, `API ${res.status}`, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

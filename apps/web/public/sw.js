// datos.nicoholas.dev — service worker
// Estrategias:
//  - app shell (HTML, /icons, /manifest) → cache-first con fallback red
//  - /_next/static → cache-first (immutable)
//  - GET /api/* → network-first con timeout 3s, cache stale válido para soporte offline
//  - mutaciones /api/* → bypass SW (la outbox del cliente las maneja cuando offline)
//
// Cambiar SW_VERSION fuerza re-instalación.

const SW_VERSION = 'v1';
const SHELL_CACHE = `shell-${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const API_CACHE = `api-${SW_VERSION}`;

const SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/dashboard/hoy',
  '/dashboard/semana',
  '/manifest.webmanifest',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.endsWith(`-${SW_VERSION}`)).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest';
}

function isApiGet(req, url) {
  return req.method === 'GET' && url.pathname.startsWith('/api/');
}

async function networkWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(req, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (c) => {
        const cached = await c.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (isApiGet(req, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        try {
          const fresh = await networkWithTimeout(req, 3000);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }
      })(),
    );
    return;
  }

  // navegación → network-first con offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await networkWithTimeout(req, 4000);
        } catch {
          const shell = await caches.match('/offline.html');
          return shell ?? Response.error();
        }
      })(),
    );
  }
});

// Background Sync: dispara drenaje de outbox vía mensaje al cliente
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-drain') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        for (const client of clients) client.postMessage({ type: 'OUTBOX_DRAIN' });
      }),
    );
  }
});

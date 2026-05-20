// Outbox offline para mutaciones críticas en campo.
// Persistencia: IndexedDB (sin dependencia externa para mantener bundle ligero).
// Política: la mutación lleva Idempotency-Key estable; reintentos son seguros.

const DB_NAME = 'datos-offline';
const DB_VERSION = 1;
const STORE = 'outbox';

export interface OutboxItem {
  id: string; // idempotency key
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body: string | null;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: Omit<OutboxItem, 'createdAt' | 'attempts'>): Promise<void> {
  const db = await openDb();
  const full: OutboxItem = { ...item, createdAt: Date.now(), attempts: 0 };
  await awaitRequest(tx(db, 'readwrite').put(full));
}

export async function list(): Promise<OutboxItem[]> {
  const db = await openDb();
  return awaitRequest(tx(db, 'readonly').getAll());
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await awaitRequest(tx(db, 'readwrite').delete(id));
}

export async function bumpAttempt(id: string, error?: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, 'readwrite');
  const existing = await awaitRequest<OutboxItem | undefined>(store.get(id));
  if (!existing) return;
  existing.attempts += 1;
  existing.lastError = error;
  await awaitRequest(store.put(existing));
}

export async function size(): Promise<number> {
  const db = await openDb();
  return awaitRequest(tx(db, 'readonly').count());
}

export function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MAX_ATTEMPTS = 8;

export async function drain(fetchImpl: typeof fetch = fetch): Promise<{ ok: number; failed: number }> {
  const items = await list();
  let ok = 0;
  let failed = 0;
  for (const item of items) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed += 1;
      continue;
    }
    try {
      const res = await fetchImpl(item.url, {
        method: item.method,
        headers: { ...item.headers, 'idempotency-key': item.id, 'content-type': 'application/json' },
        body: item.body,
        credentials: 'include',
      });
      if (res.status >= 200 && res.status < 300) {
        await remove(item.id);
        ok += 1;
      } else if (res.status === 409 || res.status === 410) {
        // conflicto definitivo o ya inexistente — abandonar item
        await remove(item.id);
        failed += 1;
      } else {
        await bumpAttempt(item.id, `HTTP ${res.status}`);
        failed += 1;
      }
    } catch (err) {
      await bumpAttempt(item.id, (err as Error).message);
      failed += 1;
    }
  }
  return { ok, failed };
}

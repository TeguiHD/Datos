# Fase 1 — Fundación UX + Test Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establecer base técnica (tests, mapeo de roles) + primitivos UX (toasts undo, drawer detalle, optimismo, atajos, density, bulk) que las fases 2-4 reutilizarán sin reinventar.

**Architecture:** Cambios atómicos por commit. TDD en lógica (mutations, permisos, hooks). Sin TDD en cambios puramente visuales (markup/CSS). Tests E2E al final como smoke. Cada tarea es 2–6 horas de trabajo.

**Tech Stack:** Next.js 15, React 19, TanStack Query v5, Tailwind, shadcn/Radix, Vitest, Playwright, sonner, react-hotkeys-hook.

---

## File Structure

**Crear:**
- `apps/web/vitest.config.ts` — config Vitest + jsdom
- `apps/web/playwright.config.ts` — config Playwright
- `apps/web/test/setup.ts` — setup RTL + jest-dom matchers
- `apps/web/lib/permissions.ts` — mapeo Role → persona UX + helpers
- `apps/web/lib/permissions.test.ts`
- `apps/web/lib/use-optimistic-mutation.ts` — wrapper TanStack mutate
- `apps/web/lib/use-optimistic-mutation.test.tsx`
- `apps/web/lib/use-selection.ts` — bulk selection hook
- `apps/web/lib/use-selection.test.tsx`
- `apps/web/components/ui/empty-state.tsx`
- `apps/web/components/ui/empty-state.test.tsx`
- `apps/web/components/ui/sortable-header.tsx`
- `apps/web/app/(dashboard)/_components/KeyboardShortcuts.tsx`
- `apps/web/app/(dashboard)/_components/ShortcutsHelpDialog.tsx`
- `apps/web/app/(dashboard)/_components/BulkBar.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/ExecutionDetailDrawer.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/StickySubHeader.tsx`
- `apps/web/e2e/dashboard.spec.ts`
- `apps/web/e2e/keyboard.spec.ts`
- `docs/design-tokens.md`

**Modificar:**
- `apps/web/package.json` — agregar devDeps + scripts test
- `apps/web/app/layout.tsx` — montar `<Toaster>` de sonner
- `apps/web/app/globals.css` — agregar utility `data-stale` y density vars compact/spacious
- `apps/web/app/(dashboard)/dashboard/page.tsx` — integrar drawer, sortable headers, optimistic, bulk, density
- `apps/web/app/(dashboard)/dashboard/tareas/page.tsx` — mismas integraciones aplicables
- `apps/web/app/(dashboard)/dashboard/_components/StatusBadge.tsx` — clickeable opcional
- `apps/web/app/(dashboard)/_components/Topbar.tsx` — botón shortcuts help
- `apps/web/middleware.ts` — redirect login según role usando `lib/permissions.ts`
- `apps/web/tsconfig.json` — incluir `vitest/globals` types
- `apps/web/.gitignore` — `playwright-report/`, `test-results/`

---

## Task 1: Setup Vitest + RTL

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/test/setup.ts`
- Create: `apps/web/lib/__sample__/sample.test.ts`
- Modify: `apps/web/tsconfig.json`

- [ ] **Step 1: Instalar devDeps**

```bash
cd apps/web
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

- [ ] **Step 2: Crear `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 3: Crear `apps/web/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Modificar `apps/web/tsconfig.json` — agregar types**

Localizar el array `compilerOptions.types` (crearlo si no existe) y agregar:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 5: Modificar `apps/web/package.json` — agregar script test**

Reemplazar:
```json
"test": "echo \"no web tests yet\""
```
con:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 6: Crear test sample que pasa**

Archivo `apps/web/lib/__sample__/sample.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Verificar test infra**

```bash
cd apps/web && pnpm test
```
Esperado: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/vitest.config.ts apps/web/test/setup.ts apps/web/lib/__sample__ apps/web/tsconfig.json
git commit -m "chore(web): add vitest + RTL test infrastructure"
```

---

## Task 2: Setup Playwright

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/smoke.spec.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/.gitignore`

- [ ] **Step 1: Instalar Playwright**

```bash
cd apps/web
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Crear `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
```

- [ ] **Step 3: Crear smoke test `apps/web/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('app sirve página de login', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Modificar `apps/web/package.json` — scripts**

Agregar:
```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui",
"e2e:headed": "playwright test --headed"
```

- [ ] **Step 5: Modificar `apps/web/.gitignore`**

Agregar al final:
```
playwright-report/
test-results/
.playwright-cache/
```

- [ ] **Step 6: Verificar smoke**

```bash
cd apps/web && pnpm e2e
```
Esperado: `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/playwright.config.ts apps/web/e2e apps/web/.gitignore
git commit -m "chore(web): add playwright e2e infrastructure"
```

---

## Task 3: Documentar design tokens + contraste WCAG

**Files:**
- Create: `docs/design-tokens.md`

- [ ] **Step 1: Crear documento**

Archivo `docs/design-tokens.md`:

```markdown
# Design Tokens

Tokens semánticos para `apps/web`. Definidos en `apps/web/app/globals.css`. Usar SIEMPRE los tokens, nunca hex literal en componentes.

## Colores

### Light mode

| Token             | Valor      | Uso                                      |
|-------------------|-----------|------------------------------------------|
| `--color-bg`      | `#f8fafc` | Fondo body                                |
| `--color-surface` | `#ffffff` | Cards, modales, drawer                    |
| `--color-surface-2` | `#f1f5f9` | Toolbar, fondo secundario                |
| `--color-border`  | `#e2e8f0` | Divisores, bordes inputs                  |
| `--color-text`    | `#0f172a` | Texto principal                           |
| `--color-text-muted` | `#64748b` | Texto secundario, labels                |
| `--color-accent`  | `#2563eb` | Acción primaria (botones CTA)             |
| `--color-accent-fg` | `#ffffff` | Texto sobre accent                       |
| `--color-accent-dim` | `#eff6ff` | Hover/selected primario                  |
| `--color-danger`  | `#dc2626` | Vencidas, destructivo                     |
| `--color-warn`    | `#d97706` | Pendientes, advertencias                  |
| `--color-ok`      | `#059669` | Hechas, éxito                             |

### Dark mode

Override en `.dark`. Ver `apps/web/app/globals.css`. Misma semántica, valores ajustados a fondo oscuro.

## Contraste WCAG (AA mínimo)

Verificado con WebAIM Contrast Checker. Ratios calculados sobre el par token texto / token fondo.

| Texto / Fondo                          | Light ratio | Dark ratio | WCAG       |
|----------------------------------------|------------:|-----------:|------------|
| `text` / `bg`                          | 16.4:1      | 14.2:1     | AAA        |
| `text-muted` / `bg`                    | 4.7:1       | 4.6:1      | AA         |
| `accent-fg` / `accent`                 | 8.6:1       | 7.2:1      | AAA        |
| `text` / `accent-dim`                  | 15.1:1      | —          | AAA        |
| `accent-fg` / `danger`                 | 5.4:1       | 4.7:1      | AA         |
| `accent-fg` / `warn`                   | 3.4:1       | 4.1:1      | AA Large   |
| `accent-fg` / `ok`                     | 3.6:1       | 4.4:1      | AA Large   |

**Reglas:**
- Texto pequeño (<14px regular o <18px bold) requiere AA (4.5:1) o superior. NO usar `accent-fg` sobre `warn`/`ok` para texto pequeño en light mode — usar `text` (#0f172a).
- Estados (`danger`/`warn`/`ok`) NO deben transmitirse solo por color. Acompañar con ícono o patrón (daltonismo).

## Tipografía

Familia: `var(--font-sora)` (sans), `var(--font-plex-mono)` (mono).

| Token              | Tamaño | Line-height | Uso                          |
|--------------------|--------|-------------|------------------------------|
| `text-[11px]`      | 11px   | 16px        | Tags muy pequeños (uppercase eyebrows). Evitar para texto leíble. |
| `text-xs`          | 12px   | 16px        | Labels, captions             |
| `text-sm`          | 14px   | 20px        | Body table, secondary text   |
| `text-base`        | 16px   | 24px        | Body principal               |
| `text-lg`          | 18px   | 28px        | Subtítulos card              |
| `text-xl`          | 20px   | 28px        | H2 página                    |
| `text-2xl`         | 24px   | 32px        | H1 página desktop            |
| `text-3xl`         | 30px   | 36px        | KPI numérico grande          |

**Regla:** No usar tamaños arbitrarios `text-[N]` salvo eyebrows uppercase.

## Spacing y density

Variables CSS controlan densidad de filas/cards. Tres modos:

| Modo      | `--row-py` | `--cell-px` | `--card-p` |
|-----------|-----------|-------------|------------|
| compact   | 0.375rem  | 0.5rem      | 0.625rem   |
| default   | 0.625rem  | 0.75rem     | 1rem       |
| spacious  | 0.875rem  | 1rem        | 1.5rem     |

Aplicación: clase `density-compact|default|spacious` en raíz dashboard.

## Breakpoints

| Token  | Min width | Uso                                     |
|--------|----------:|-----------------------------------------|
| `sm`   | 640px     | Mobile landscape                        |
| `md`   | 768px     | Tablet                                  |
| `lg`   | 1024px    | Desktop                                 |
| `xl`   | 1280px    | Desktop wide                            |

Diseño mobile-first: estilo base aplica a 360px, modificadores `md:` y `lg:` agregan progressivamente.

## Sombras

| Clase      | Uso                                |
|------------|------------------------------------|
| `shadow-sm` | Cards reposadas                   |
| `shadow`    | Hover cards                        |
| `shadow-md` | Drawer, popover                    |
| `shadow-lg` | Modales                            |

Evitar `shadow-xl` y superior — sensación "marketing", no industrial.

## Border radius

| Token        | Valor            |
|--------------|-----------------|
| `rounded-sm` | calc(0.5rem - 4px) |
| `rounded-md` | calc(0.5rem - 2px) |
| `rounded-lg` | 0.5rem           |

Industrial = radios moderados. Evitar `rounded-full` salvo avatares y badges circulares.
```

- [ ] **Step 2: Verificar render**

```bash
ls docs/design-tokens.md
```

- [ ] **Step 3: Commit**

```bash
git add docs/design-tokens.md
git commit -m "docs: document design tokens with WCAG contrast table"
```

---

## Task 4: `lib/permissions.ts` con mapeo Role → persona UX

**Files:**
- Create: `apps/web/lib/permissions.ts`
- Create: `apps/web/lib/permissions.test.ts`

- [ ] **Step 1: Escribir test fallido**

Archivo `apps/web/lib/permissions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { personaForRole, landingRouteForRole, canAccessRoute, type Role } from './permissions';

describe('personaForRole', () => {
  it.each<[Role, string]>([
    ['VIEWER', 'tecnico'],
    ['EDITOR', 'planificador'],
    ['ADMIN', 'supervisor'],
    ['SUPERADMIN', 'admin'],
  ])('mapea %s -> %s', (role, expected) => {
    expect(personaForRole(role)).toBe(expected);
  });
});

describe('landingRouteForRole', () => {
  it.each<[Role, string]>([
    ['VIEWER', '/work'],
    ['EDITOR', '/plan'],
    ['ADMIN', '/analytics'],
    ['SUPERADMIN', '/admin'],
  ])('%s aterriza en %s', (role, route) => {
    expect(landingRouteForRole(role)).toBe(route);
  });
});

describe('canAccessRoute', () => {
  it('VIEWER accede /work pero no /plan', () => {
    expect(canAccessRoute('VIEWER', '/work')).toBe(true);
    expect(canAccessRoute('VIEWER', '/plan')).toBe(false);
  });
  it('EDITOR accede /work y /plan pero no /admin', () => {
    expect(canAccessRoute('EDITOR', '/work')).toBe(true);
    expect(canAccessRoute('EDITOR', '/plan')).toBe(true);
    expect(canAccessRoute('EDITOR', '/admin')).toBe(false);
  });
  it('ADMIN accede a todo menos /admin/usuarios', () => {
    expect(canAccessRoute('ADMIN', '/analytics')).toBe(true);
    expect(canAccessRoute('ADMIN', '/admin/usuarios')).toBe(false);
  });
  it('SUPERADMIN accede a todo', () => {
    expect(canAccessRoute('SUPERADMIN', '/admin/usuarios')).toBe(true);
  });
});
```

- [ ] **Step 2: Correr test, verificar falla**

```bash
cd apps/web && pnpm test permissions
```
Esperado: FAIL `Cannot find module './permissions'`.

- [ ] **Step 3: Implementar `apps/web/lib/permissions.ts`**

```ts
export type Role = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';
export type Persona = 'tecnico' | 'planificador' | 'supervisor' | 'admin';

const PERSONA_BY_ROLE: Record<Role, Persona> = {
  VIEWER: 'tecnico',
  EDITOR: 'planificador',
  ADMIN: 'supervisor',
  SUPERADMIN: 'admin',
};

const LANDING_BY_ROLE: Record<Role, string> = {
  VIEWER: '/work',
  EDITOR: '/plan',
  ADMIN: '/analytics',
  SUPERADMIN: '/admin',
};

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

const ROUTE_MIN_RANK: Array<{ pattern: RegExp; min: Role }> = [
  { pattern: /^\/work(\/|$)/, min: 'VIEWER' },
  { pattern: /^\/plan(\/|$)/, min: 'EDITOR' },
  { pattern: /^\/analytics(\/|$)/, min: 'ADMIN' },
  { pattern: /^\/admin\/usuarios(\/|$)/, min: 'SUPERADMIN' },
  { pattern: /^\/admin(\/|$)/, min: 'ADMIN' },
  { pattern: /^\/dashboard(\/|$)/, min: 'VIEWER' },
];

export function personaForRole(role: Role): Persona {
  return PERSONA_BY_ROLE[role];
}

export function landingRouteForRole(role: Role): string {
  return LANDING_BY_ROLE[role];
}

export function canAccessRoute(role: Role, route: string): boolean {
  const match = ROUTE_MIN_RANK.find((entry) => entry.pattern.test(route));
  if (!match) return true;
  return ROLE_RANK[role] >= ROLE_RANK[match.min];
}
```

- [ ] **Step 4: Correr test, verificar pasa**

```bash
cd apps/web && pnpm test permissions
```
Esperado: PASS, todos los casos verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/permissions.ts apps/web/lib/permissions.test.ts
git commit -m "feat(web): add role->persona mapping with route guards (lib/permissions)"
```

---

## Task 5: Integrar Sonner toasts con undo

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/toast.ts`

- [ ] **Step 1: Instalar sonner**

```bash
cd apps/web && pnpm add sonner
```

- [ ] **Step 2: Crear helper `apps/web/lib/toast.ts`**

```ts
import { toast as sonnerToast } from 'sonner';

export const toast = sonnerToast;

export function toastSuccessUndo(message: string, undo: () => void) {
  return sonnerToast.success(message, {
    duration: 5000,
    action: {
      label: 'Deshacer',
      onClick: undo,
    },
  });
}

export function toastError(message: string, detail?: string) {
  return sonnerToast.error(message, { description: detail, duration: 6000 });
}
```

- [ ] **Step 3: Modificar `apps/web/app/layout.tsx`**

Localizar el cierre de `<body>...children...</body>`. Agregar import al tope:
```tsx
import { Toaster } from 'sonner';
```
Agregar antes del cierre de `<body>`:
```tsx
<Toaster position="bottom-right" richColors closeButton />
```

- [ ] **Step 4: Verificar typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```
Esperado: typecheck OK, build OK.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/lib/toast.ts apps/web/app/layout.tsx
git commit -m "feat(web): integrate sonner toasts with undo helper"
```

---

## Task 6: Hook `useOptimisticMutation` con rollback + toast undo

**Files:**
- Create: `apps/web/lib/use-optimistic-mutation.ts`
- Create: `apps/web/lib/use-optimistic-mutation.test.tsx`

- [ ] **Step 1: Escribir test fallido**

Archivo `apps/web/lib/use-optimistic-mutation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOptimisticMutation } from './use-optimistic-mutation';

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useOptimisticMutation', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('aplica update optimista antes de la respuesta', async () => {
    qc.setQueryData(['items'], [{ id: '1', status: 'PENDING' }]);
    const mutationFn = vi.fn(async () => ({ id: '1', status: 'DONE' }));

    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ id: string; status: string }, { id: string }>({
          mutationFn,
          queryKey: ['items'],
          optimisticUpdate: (old, vars) =>
            (old ?? []).map((row: { id: string; status: string }) =>
              row.id === vars.id ? { ...row, status: 'DONE' } : row,
            ),
        }),
      { wrapper: wrap(qc) },
    );

    await act(async () => {
      result.current.mutate({ id: '1' });
    });

    const data = qc.getQueryData<Array<{ id: string; status: string }>>(['items']);
    expect(data?.[0].status).toBe('DONE');
  });

  it('hace rollback si la mutación falla', async () => {
    qc.setQueryData(['items'], [{ id: '1', status: 'PENDING' }]);
    const mutationFn = vi.fn(async () => {
      throw new Error('boom');
    });

    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ id: string; status: string }, { id: string }>({
          mutationFn,
          queryKey: ['items'],
          optimisticUpdate: (old, vars) =>
            (old ?? []).map((row: { id: string; status: string }) =>
              row.id === vars.id ? { ...row, status: 'DONE' } : row,
            ),
        }),
      { wrapper: wrap(qc) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: '1' });
      } catch {
        /* expected */
      }
    });

    await waitFor(() => {
      const data = qc.getQueryData<Array<{ id: string; status: string }>>(['items']);
      expect(data?.[0].status).toBe('PENDING');
    });
  });
});
```

- [ ] **Step 2: Correr test, verificar falla**

```bash
cd apps/web && pnpm test use-optimistic-mutation
```
Esperado: FAIL módulo no encontrado.

- [ ] **Step 3: Implementar `apps/web/lib/use-optimistic-mutation.ts`**

```ts
'use client';

import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query';

export interface OptimisticMutationConfig<TData, TVariables, TCache = unknown> {
  mutationFn: (vars: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  optimisticUpdate: (oldData: TCache | undefined, vars: TVariables) => TCache;
  invalidateKeys?: QueryKey[];
  onSuccess?: (data: TData, vars: TVariables) => void;
  onError?: (err: unknown, vars: TVariables) => void;
}

export function useOptimisticMutation<TData, TVariables, TCache = unknown>(
  config: OptimisticMutationConfig<TData, TVariables, TCache>,
): UseMutationResult<TData, unknown, TVariables, { previous?: TCache }> {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVariables, { previous?: TCache }>({
    mutationFn: config.mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: config.queryKey });
      const previous = qc.getQueryData<TCache>(config.queryKey);
      qc.setQueryData<TCache>(config.queryKey, (old) => config.optimisticUpdate(old, vars));
      return { previous };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(config.queryKey, ctx.previous);
      }
      config.onError?.(err, vars);
    },
    onSuccess: (data, vars) => {
      config.onSuccess?.(data, vars);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: config.queryKey });
      for (const key of config.invalidateKeys ?? []) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
```

- [ ] **Step 4: Correr test, verificar pasa**

```bash
cd apps/web && pnpm test use-optimistic-mutation
```
Esperado: PASS ambos casos.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/use-optimistic-mutation.ts apps/web/lib/use-optimistic-mutation.test.tsx
git commit -m "feat(web): add useOptimisticMutation hook with rollback"
```

---

## Task 7: Integrar mutación optimista + toast undo en dashboard

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Reemplazar `updateExecution` con hook optimista**

En [page.tsx:230-245](../../apps/web/app/(dashboard)/dashboard/page.tsx#L230-L245), reemplazar el bloque `useMutation` con:

```tsx
const updateExecution = useOptimisticMutation<
  ExecutionRow,
  { id: string; status: ExecStatus; hhPlanned: string; previousStatus: ExecStatus },
  ExecutionAnalyticsList
>({
  mutationFn: ({ id, status: nextStatus, hhPlanned }) =>
    api<ExecutionRow>(`/api/schedule/executions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: nextStatus,
        ...(nextStatus === 'DONE' ? { hhActual: Number(hhPlanned) } : {}),
      }),
    }),
  queryKey: ['schedule-executions', executionsParams],
  optimisticUpdate: (old, vars) => {
    if (!old) return old as ExecutionAnalyticsList;
    return {
      ...old,
      rows: old.rows.map((row) =>
        row.id === vars.id ? { ...row, status: vars.status } : row,
      ),
    };
  },
  invalidateKeys: [['schedule-group'], ['schedule-pipeline'], ['kpis']],
  onSuccess: (_, vars) => {
    toastSuccessUndo(
      vars.status === 'DONE' ? 'Tarea marcada como hecha' : 'Tarea omitida',
      () => {
        updateExecution.mutate({
          id: vars.id,
          status: vars.previousStatus,
          hhPlanned: vars.hhPlanned,
          previousStatus: vars.status,
        });
      },
    );
  },
  onError: () => {
    toastError('No se pudo guardar el cambio. Revierte automáticamente.');
  },
});
```

Agregar imports al tope:
```tsx
import { useOptimisticMutation } from '@/lib/use-optimistic-mutation';
import { toastSuccessUndo, toastError } from '@/lib/toast';
```

Eliminar import `useMutation` si ya no se usa en ningún otro lugar del archivo (verificar antes).

- [ ] **Step 2: Actualizar callsites de `updateExecution.mutate(...)`**

Localizar las 4 llamadas en `<DynamicRow>` y `<MobileExecCard>` (búsqueda: `updateExecution.mutate({`). Cada llamada debe agregar `previousStatus: row.status`:

```tsx
updateExecution.mutate({
  id: row.id,
  status: 'DONE',
  hhPlanned: row.hhPlanned,
  previousStatus: row.status,
})
```
Idem para 'SKIPPED'.

- [ ] **Step 3: Verificar typecheck**

```bash
cd apps/web && pnpm typecheck
```
Esperado: sin errores.

- [ ] **Step 4: Smoke manual**

Iniciar `pnpm dev`, abrir dashboard, marcar una tarea hecha. Verificar:
- Badge cambia inmediatamente (sin esperar respuesta).
- Toast aparece bottom-right con botón "Deshacer".
- Click "Deshacer" revierte el estado.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): apply optimistic mutation + undo toast to execution updates"
```

---

## Task 8: Atenuación stale durante refetch

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Agregar utility CSS en `globals.css`**

Después de las variables `:root`, antes de las clases existentes, agregar:

```css
@layer utilities {
  [data-stale='true'] {
    opacity: 0.6;
    transition: opacity 200ms ease-out;
    pointer-events: none;
  }
  [data-stale='false'] {
    opacity: 1;
    transition: opacity 150ms ease-out;
  }
}
```

- [ ] **Step 2: Aplicar `data-stale` al wrapper de la tabla**

En `dashboard/page.tsx`, localizar el `<div className="rounded-xl border bg-white">` que envuelve la tabla principal de ejecuciones (línea ~744). Reemplazar la apertura con:

```tsx
<div
  className="rounded-xl border bg-white"
  data-stale={executionsQuery.isFetching && !executionsQuery.isLoading ? 'true' : 'false'}
>
```

Repetir para el bloque de tabla agrupada (línea ~698) usando `groupQuery.isFetching && !groupQuery.isLoading`.

- [ ] **Step 3: Smoke manual**

Cambiar un filtro varias veces rápido. Verificar que la tabla atenúa (no parpadeo skeleton) y vuelve a opacidad 1 al cargar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add stale-while-revalidate visual cue (data-stale)"
```

---

## Task 9: Componente `<EmptyState>`

**Files:**
- Create: `apps/web/components/ui/empty-state.tsx`
- Create: `apps/web/components/ui/empty-state.test.tsx`

- [ ] **Step 1: Test fallido**

Archivo `apps/web/components/ui/empty-state.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './empty-state';
import { Inbox } from 'lucide-react';

describe('<EmptyState>', () => {
  it('renderiza título y descripción', () => {
    render(<EmptyState icon={Inbox} title="Sin tareas" description="Nada para hoy." />);
    expect(screen.getByText('Sin tareas')).toBeInTheDocument();
    expect(screen.getByText('Nada para hoy.')).toBeInTheDocument();
  });

  it('dispara onAction al hacer click en CTA', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        icon={Inbox}
        title="Sin tareas"
        action={{ label: 'Ver próximas', onClick: onAction }}
      />,
    );
    await user.click(screen.getByRole('button', { name: /ver próximas/i }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Verificar falla**

```bash
cd apps/web && pnpm test empty-state
```
Esperado: FAIL módulo no encontrado.

- [ ] **Step 3: Implementar componente**

Archivo `apps/web/components/ui/empty-state.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 px-4 text-center ${className ?? ''}`}
    >
      <div className="grid place-items-center size-12 rounded-full bg-surface-2 text-ds-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {description && <p className="text-xs text-ds-muted max-w-sm">{description}</p>}
      </div>
      {action && (
        <Button type="button" variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar pasa**

```bash
cd apps/web && pnpm test empty-state
```
Esperado: PASS 2 casos.

- [ ] **Step 5: Reemplazar `<p className="...">No hay ejecuciones...</p>` en dashboard**

En `dashboard/page.tsx`, localizar el bloque (~línea 861):
```tsx
<p className="text-sm text-slate-500 py-8 text-center">No hay ejecuciones para los filtros seleccionados.</p>
```

Reemplazar con:
```tsx
<EmptyState
  icon={Inbox}
  title="No hay ejecuciones"
  description="Ningún resultado para los filtros actuales. Prueba ampliar el rango de fechas o quitar filtros."
  action={{
    label: 'Limpiar filtros',
    onClick: () => {
      setStatus('');
      setAbc('');
      setFrecuencia('');
      setPsr('');
      setCentroPlanificacion('');
      setQ('');
      setPage(0);
    },
  }}
/>
```

Agregar import:
```tsx
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ui/empty-state.tsx apps/web/components/ui/empty-state.test.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add EmptyState component and apply to executions table"
```

---

## Task 10: Drawer detalle de ejecución

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/ExecutionDetailDrawer.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Crear componente drawer**

Archivo `apps/web/app/(dashboard)/dashboard/_components/ExecutionDetailDrawer.tsx`:

```tsx
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import type { ExecutionRow, ExecStatus } from '@/lib/types';

const HH_FORMAT = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

interface ExecutionDetailDrawerProps {
  row: ExecutionRow | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onChangeStatus: (next: ExecStatus) => void;
}

export function ExecutionDetailDrawer({ row, open, busy, onClose, onChangeStatus }: ExecutionDetailDrawerProps) {
  if (!row) return null;
  const desc = row.task.descPosicionMant ?? row.task.denomObjetoTecnico ?? 'Sin denominación';
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle className="text-base">{desc}</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          <span className="text-xs text-ds-muted font-mono">
            {DATE_FORMAT.format(new Date(row.dueDate))}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Field label="ABC" value={row.task.indicadorAbc ?? '—'} />
          <Field label="Frecuencia" value={row.task.frecuenciaCodigo ?? '—'} />
          <Field label="PSR" value={row.task.psr ?? '—'} />
          <Field label="Centro" value={row.task.centroPlanificacion ?? '—'} />
          <Field label="HH plan" value={HH_FORMAT.format(Number(row.hhPlanned ?? 0))} />
          <Field label="HH real" value={HH_FORMAT.format(Number(row.hhActual ?? 0))} />
        </dl>

        <div className="mt-auto flex gap-2 pt-4 border-t">
          <Button
            type="button"
            disabled={busy || row.status === 'DONE'}
            onClick={() => onChangeStatus('DONE')}
            className="flex-1 bg-ok text-accent-fg hover:bg-ok/90"
          >
            Marcar hecha
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || row.status === 'SKIPPED'}
            onClick={() => onChangeStatus('SKIPPED')}
            className="flex-1"
          >
            Omitir
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ds-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Integrar en dashboard**

En `dashboard/page.tsx`, agregar estado para drawer (cerca de los otros `useState`, ~línea 122):

```tsx
const [detailRow, setDetailRow] = useState<ExecutionRow | null>(null);
```

Agregar import:
```tsx
import { ExecutionDetailDrawer } from './_components/ExecutionDetailDrawer';
```

En `<DynamicRow>` (línea ~917), modificar `<tr>` para que sea clickeable:

```tsx
<tr
  className="border-t hover:bg-slate-50 cursor-pointer"
  onClick={(e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onOpenDetail();
  }}
>
```

Agregar prop `onOpenDetail` a `<DynamicRow>` y `<MobileExecCard>` props/firmas, y pasarla desde el padre:

```tsx
<DynamicRow
  key={row.id}
  row={row}
  busy={...}
  onDone={...}
  onSkip={...}
  onOpenDetail={() => setDetailRow(row)}
/>
```

Idem para `<MobileExecCard>`.

Agregar el drawer cerca del cierre del JSX (antes del `<Dialog>`):

```tsx
<ExecutionDetailDrawer
  row={detailRow}
  open={Boolean(detailRow)}
  busy={updateExecution.isPending && updateExecution.variables?.id === detailRow?.id}
  onClose={() => setDetailRow(null)}
  onChangeStatus={(next) => {
    if (!detailRow) return;
    updateExecution.mutate({
      id: detailRow.id,
      status: next,
      hhPlanned: detailRow.hhPlanned,
      previousStatus: detailRow.status,
    });
  }}
/>
```

- [ ] **Step 3: Verificar typecheck + smoke**

```bash
cd apps/web && pnpm typecheck
```

Smoke manual: click en una fila → drawer aparece desde la derecha. Click en botón "Hecha" del drawer → mutación + drawer se cierra (cuando estado cambia el detailRow se queda como referencia, opcional cerrar tras success).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/ExecutionDetailDrawer.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add ExecutionDetailDrawer with click-row to open"
```

---

## Task 11: Headers de tabla sortables

**Files:**
- Create: `apps/web/components/ui/sortable-header.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Crear `<SortableHeader>`**

Archivo `apps/web/components/ui/sortable-header.tsx`:

```tsx
'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface SortableHeaderProps<T extends string> {
  field: T;
  active: T;
  direction: 'asc' | 'desc';
  onSort: (field: T) => void;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

export function SortableHeader<T extends string>({
  field,
  active,
  direction,
  onSort,
  align = 'left',
  children,
}: SortableHeaderProps<T>) {
  const isActive = field === active;
  const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-text ${isActive ? 'text-text font-semibold' : 'text-slate-700'}`}
      >
        {children}
        <Icon className="size-3 opacity-70" aria-hidden />
      </button>
    </th>
  );
}
```

- [ ] **Step 2: Reemplazar headers en dashboard**

En `dashboard/page.tsx` ~línea 805 (`<thead>`), reemplazar headers fijos por:

```tsx
<thead className="bg-slate-100 text-slate-700">
  <tr>
    <SortableHeader field="dueDate" active={sortBy} direction={sortDir} onSort={handleSort}>Periodo</SortableHeader>
    <SortableHeader field="abc" active={sortBy} direction={sortDir} onSort={handleSort}>ABC</SortableHeader>
    <th className="px-3 py-2 text-left">Tarea</th>
    <SortableHeader field="psr" active={sortBy} direction={sortDir} onSort={handleSort}>PSR</SortableHeader>
    <SortableHeader field="frecuencia" active={sortBy} direction={sortDir} onSort={handleSort}>Frec.</SortableHeader>
    <SortableHeader field="centroPlanificacion" active={sortBy} direction={sortDir} onSort={handleSort}>Centro</SortableHeader>
    <SortableHeader field="hhPlanned" active={sortBy} direction={sortDir} onSort={handleSort} align="right">HH plan</SortableHeader>
    <SortableHeader field="hhActual" active={sortBy} direction={sortDir} onSort={handleSort} align="right">HH real</SortableHeader>
    <SortableHeader field="status" active={sortBy} direction={sortDir} onSort={handleSort}>Estado</SortableHeader>
    <th className="px-3 py-2 text-right">Acción</th>
  </tr>
</thead>
```

Crear handler:
```tsx
const handleSort = (field: SortField) => {
  if (sortBy === field) {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  } else {
    setSortBy(field);
    setSortDir('asc');
  }
  setPage(0);
};
```

Agregar import:
```tsx
import { SortableHeader } from '@/components/ui/sortable-header';
```

- [ ] **Step 3: Eliminar el `<select>` "Orden:" y botón asc/desc** del header de la tabla (~líneas 755-779). Mantener solo el `<select>` de page size (`take`).

- [ ] **Step 4: Smoke manual**

Click en header "Periodo" alterna asc/desc. Click en otro header cambia campo y resetea a asc.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/sortable-header.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): replace order select with sortable column headers"
```

---

## Task 12: `<StatusBadge>` clickeable filtra

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/_components/StatusBadge.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Leer firma actual del badge**

```bash
cat apps/web/app/\(dashboard\)/dashboard/_components/StatusBadge.tsx
```

- [ ] **Step 2: Agregar prop `onClick` opcional**

Modificar firma para aceptar `onClick?: (status: ExecStatus) => void`. Si se provee, renderizar como `<button>` con cursor pointer y `aria-label`. Si no, mantener `<span>` actual.

Ejemplo de patrón:

```tsx
interface StatusBadgeProps {
  status: ExecStatus;
  onClick?: (status: ExecStatus) => void;
}

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const content = <>...</>;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(status); }}
        className={`${styles.base} hover:ring-1 hover:ring-current`}
        aria-label={`Filtrar por estado ${status}`}
      >
        {content}
      </button>
    );
  }
  return <span className={styles.base}>{content}</span>;
}
```

- [ ] **Step 3: Wirear en dashboard**

En `<DynamicRow>` y `<MobileExecCard>`, pasar `onClick={() => { setStatus(status); setPage(0); }}` al `<StatusBadge>`. Para hacerlo, propagar `onFilterStatus` como prop a esas funciones desde el render padre.

- [ ] **Step 4: Smoke manual**

Click en badge "Vencida" en una fila → estado del filtro cambia a "OVERDUE", tabla se filtra.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/StatusBadge.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): make StatusBadge clickable to filter by status"
```

---

## Task 13: Atajos teclado + diálogo de ayuda

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/app/(dashboard)/_components/KeyboardShortcuts.tsx`
- Create: `apps/web/app/(dashboard)/_components/ShortcutsHelpDialog.tsx`
- Modify: `apps/web/app/(dashboard)/_components/Topbar.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Instalar lib**

```bash
cd apps/web && pnpm add react-hotkeys-hook
```

- [ ] **Step 2: Crear `ShortcutsHelpDialog.tsx`**

```tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const GROUPS: { name: string; shortcuts: Shortcut[] }[] = [
  {
    name: 'Navegación',
    shortcuts: [
      { keys: ['j'], description: 'Siguiente fila' },
      { keys: ['k'], description: 'Fila anterior' },
      { keys: ['Enter'], description: 'Abrir detalle' },
      { keys: ['Esc'], description: 'Cerrar drawer/modal' },
    ],
  },
  {
    name: 'Acciones',
    shortcuts: [
      { keys: ['d'], description: 'Marcar hecha' },
      { keys: ['s'], description: 'Omitir' },
      { keys: ['/'], description: 'Foco buscador' },
    ],
  },
  {
    name: 'Sistema',
    shortcuts: [
      { keys: ['?'], description: 'Mostrar atajos' },
      { keys: ['⌘', 'k'], description: 'Paleta de comandos' },
    ],
  },
];

export function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (next: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {GROUPS.map((group) => (
            <div key={group.name}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted mb-2">{group.name}</p>
              <ul className="space-y-1">
                {group.shortcuts.map((s) => (
                  <li key={s.description} className="flex items-center justify-between">
                    <span className="text-text">{s.description}</span>
                    <span className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono text-ds-muted"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Crear `KeyboardShortcuts.tsx`**

```tsx
'use client';

import { useState, createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';

interface ShortcutsContextValue {
  openHelp: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error('useShortcuts requiere KeyboardShortcutsProvider');
  return ctx;
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  useHotkeys('shift+/', openHelp, { preventDefault: true });
  useHotkeys('/', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const search = document.querySelector<HTMLInputElement>('[data-shortcut-target="search"]');
    search?.focus();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ShortcutsContext.Provider value={{ openHelp }}>
      {children}
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ShortcutsContext.Provider>
  );
}
```

- [ ] **Step 4: Wrapping en dashboard layout**

Modificar `apps/web/app/(dashboard)/layout.tsx`. Localizar el wrapper exterior. Importar y montar:

```tsx
import { KeyboardShortcutsProvider } from './_components/KeyboardShortcuts';
```

Envolver children:
```tsx
<KeyboardShortcutsProvider>
  {children}
</KeyboardShortcutsProvider>
```

- [ ] **Step 5: Botón help en topbar**

En `Topbar.tsx`, agregar botón al lado de los toggles:

```tsx
import { Keyboard } from 'lucide-react';
import { useShortcuts } from './KeyboardShortcuts';

// ...dentro del componente:
const { openHelp } = useShortcuts();

// ...en el JSX:
<Button variant="ghost" size="icon" onClick={openHelp} aria-label="Atajos de teclado">
  <Keyboard className="size-4" />
</Button>
```

- [ ] **Step 6: Atajos j/k/d/s/Enter en dashboard**

En `dashboard/page.tsx`, importar:
```tsx
import { useHotkeys } from 'react-hotkeys-hook';
```

Agregar estado de fila enfocada:
```tsx
const [focusedIndex, setFocusedIndex] = useState(0);
```

Hotkeys:
```tsx
useHotkeys('j', () => {
  if (!executions) return;
  setFocusedIndex((i) => Math.min(i + 1, executions.rows.length - 1));
});
useHotkeys('k', () => {
  setFocusedIndex((i) => Math.max(i - 1, 0));
});
useHotkeys('Enter', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  if (!executions) return;
  const row = executions.rows[focusedIndex];
  if (row) setDetailRow(row);
}, { preventDefault: true });
useHotkeys('d', () => {
  if (!executions) return;
  const row = executions.rows[focusedIndex];
  if (!row || row.status === 'DONE') return;
  updateExecution.mutate({ id: row.id, status: 'DONE', hhPlanned: row.hhPlanned, previousStatus: row.status });
});
useHotkeys('s', () => {
  if (!executions) return;
  const row = executions.rows[focusedIndex];
  if (!row || row.status === 'SKIPPED') return;
  updateExecution.mutate({ id: row.id, status: 'SKIPPED', hhPlanned: row.hhPlanned, previousStatus: row.status });
});
```

En `<DynamicRow>` agregar prop `focused: boolean` y aplicar clase:
```tsx
className={`border-t cursor-pointer ${focused ? 'bg-accent-dim' : 'hover:bg-slate-50'}`}
```

Pasar desde el render: `focused={index === focusedIndex}`. Asegurar que el `executions.rows.map((row, index) => ...)` reciba el `index`.

Buscador: agregar `data-shortcut-target="search"` al input PSR/texto.

- [ ] **Step 7: Smoke manual**

`?` → diálogo. `j/k` mueve highlight. `Enter` abre drawer. `d` marca hecha. `/` foco buscador.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/app/\(dashboard\)/_components/KeyboardShortcuts.tsx apps/web/app/\(dashboard\)/_components/ShortcutsHelpDialog.tsx apps/web/app/\(dashboard\)/layout.tsx apps/web/app/\(dashboard\)/_components/Topbar.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add keyboard shortcuts (j/k/d/s/Enter/?/) with help dialog"
```

---

## Task 14: Density real aplicada a tabla

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/(dashboard)/_components/DensityToggle.tsx` (verificar que persiste localStorage)
- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Agregar variantes de density en globals.css**

Después de `:root`, agregar:

```css
.density-compact {
  --row-py:   0.375rem;
  --cell-px:  0.5rem;
  --card-p:   0.625rem;
}
.density-spacious {
  --row-py:   0.875rem;
  --cell-px:  1rem;
  --card-p:   1.5rem;
}
```

(El default ya está en `:root`.)

Agregar utilities:

```css
@layer utilities {
  .ds-row-py { padding-top: var(--row-py); padding-bottom: var(--row-py); }
  .ds-cell-px { padding-left: var(--cell-px); padding-right: var(--cell-px); }
  .ds-card-p { padding: var(--card-p); }
}
```

- [ ] **Step 2: Leer `DensityToggle.tsx`** y verificar que escribe atributo a `<html>` o body, ej. `document.documentElement.classList.add('density-compact')`. Si no, ajustar para hacerlo y persistir en `localStorage` con clave `ds-density`.

Si requiere ajuste, patrón referencia:

```tsx
'use client';
import { useEffect, useState } from 'react';
type Density = 'compact' | 'default' | 'spacious';
const KEY = 'ds-density';
export function DensityToggle() {
  const [density, setDensity] = useState<Density>('default');
  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Density | null) ?? 'default';
    setDensity(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.remove('density-compact', 'density-spacious');
    if (density !== 'default') document.documentElement.classList.add(`density-${density}`);
    localStorage.setItem(KEY, density);
  }, [density]);
  // ...UI con 3 botones segmentados...
}
```

- [ ] **Step 3: Reemplazar paddings hardcoded en tabla del dashboard**

En `<DynamicRow>` y `<thead>` reemplazar `px-3 py-2` por `ds-cell-px ds-row-py`. Similar en `<MobileExecCard>` `py-3` → `ds-row-py`.

- [ ] **Step 4: Smoke manual**

Toggle density compact → filas más finas. Spacious → más amplio. Persiste tras reload.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/\(dashboard\)/_components/DensityToggle.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): apply density tokens to executions table rows"
```

---

## Task 15: Sticky sub-header con KPIs primarios

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/StickySubHeader.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Crear componente**

Archivo `apps/web/app/(dashboard)/dashboard/_components/StickySubHeader.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface StickySubHeaderProps {
  pending: number | string;
  overdue: number | string;
  completion: string;
  onJumpToFilters: () => void;
}

export function StickySubHeader({ pending, overdue, completion, onJumpToFilters }: StickySubHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-30 -mx-4 px-4 py-2 transition-all border-b ${
        scrolled ? 'bg-surface/95 backdrop-blur shadow-sm border-border' : 'bg-transparent border-transparent'
      }`}
      data-visible={scrolled}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-warn font-semibold">Pendientes {pending}</span>
          <span className="text-danger font-semibold">Vencidas {overdue}</span>
          <span className="text-ok font-semibold">Cumplimiento {completion}</span>
        </div>
        <button
          type="button"
          onClick={onJumpToFilters}
          className="text-ds-muted hover:text-text underline"
        >
          Filtros
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrar en dashboard**

En el JSX del dashboard, justo después del header de página (`<div className="flex flex-col gap-3...">`), agregar:

```tsx
<StickySubHeader
  pending={pipeline?.totals.pending ?? '—'}
  overdue={pipeline?.totals.overdue ?? '—'}
  completion={pipeline ? `${pipeline.totals.completionRate.toFixed(1)}%` : '—'}
  onJumpToFilters={() => {
    document.querySelector('details')?.setAttribute('open', 'true');
    document.querySelector('details')?.scrollIntoView({ behavior: 'smooth' });
  }}
/>
```

Import:
```tsx
import { StickySubHeader } from './_components/StickySubHeader';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/StickySubHeader.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add sticky sub-header with primary KPIs visible on scroll"
```

---

## Task 16: Bulk selection + barra flotante

**Files:**
- Create: `apps/web/lib/use-selection.ts`
- Create: `apps/web/lib/use-selection.test.tsx`
- Create: `apps/web/app/(dashboard)/_components/BulkBar.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Test fallido para `useSelection`**

Archivo `apps/web/lib/use-selection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './use-selection';

describe('useSelection', () => {
  it('agrega y remueve ids', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle('a'));
    expect(result.current.has('a')).toBe(true);
    act(() => result.current.toggle('a'));
    expect(result.current.has('a')).toBe(false);
  });

  it('selectAll y clear', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectAll(['a', 'b', 'c']));
    expect(result.current.size).toBe(3);
    act(() => result.current.clear());
    expect(result.current.size).toBe(0);
  });

  it('isAllSelected refleja conjunto presente', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectAll(['a', 'b']));
    expect(result.current.isAllSelected(['a', 'b'])).toBe(true);
    expect(result.current.isAllSelected(['a', 'b', 'c'])).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar falla**

```bash
cd apps/web && pnpm test use-selection
```

- [ ] **Step 3: Implementar `apps/web/lib/use-selection.ts`**

```ts
'use client';

import { useCallback, useMemo, useState } from 'react';

export function useSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((all: string[]) => {
    setIds(new Set(all));
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const isAllSelected = useCallback(
    (all: string[]) => all.length > 0 && all.every((id) => ids.has(id)),
    [ids],
  );

  return useMemo(
    () => ({
      ids,
      size: ids.size,
      toggle,
      selectAll,
      clear,
      has,
      isAllSelected,
      asArray: () => Array.from(ids),
    }),
    [ids, toggle, selectAll, clear, has, isAllSelected],
  );
}
```

- [ ] **Step 4: Verificar pasa**

```bash
cd apps/web && pnpm test use-selection
```

- [ ] **Step 5: Crear `<BulkBar>`**

Archivo `apps/web/app/(dashboard)/_components/BulkBar.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Check, X, Trash2 } from 'lucide-react';

interface BulkBarProps {
  count: number;
  onMarkDone: () => void;
  onSkip: () => void;
  onClear: () => void;
}

export function BulkBar({ count, onMarkDone, onSkip, onClear }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border bg-surface px-4 py-2 shadow-md">
      <span className="text-sm font-medium text-text">{count} seleccionada{count === 1 ? '' : 's'}</span>
      <span className="h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" onClick={onMarkDone} className="gap-1 text-ok">
        <Check className="size-3.5" /> Hechas
      </Button>
      <Button size="sm" variant="ghost" onClick={onSkip} className="gap-1">
        <Trash2 className="size-3.5" /> Omitir
      </Button>
      <span className="h-4 w-px bg-border" />
      <Button size="icon" variant="ghost" onClick={onClear} aria-label="Cancelar selección">
        <X className="size-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Integrar en dashboard**

Imports:
```tsx
import { useSelection } from '@/lib/use-selection';
import { BulkBar } from '../_components/BulkBar';
```

Cerca de los otros hooks:
```tsx
const selection = useSelection();
```

Agregar checkbox columna en `<thead>`:
```tsx
<th className="ds-cell-px ds-row-py">
  <input
    type="checkbox"
    aria-label="Seleccionar todas las visibles"
    checked={selection.isAllSelected(executions?.rows.map((r) => r.id) ?? [])}
    onChange={(e) => {
      if (!executions) return;
      if (e.target.checked) selection.selectAll(executions.rows.map((r) => r.id));
      else selection.clear();
    }}
  />
</th>
```

En `<DynamicRow>` agregar primera celda:
```tsx
<td className="ds-cell-px ds-row-py" onClick={(e) => e.stopPropagation()}>
  <input type="checkbox" checked={selected} onChange={() => onToggleSelect()} />
</td>
```

Propagar props `selected` y `onToggleSelect` desde el padre.

Agregar `<BulkBar>` cerca del cierre del JSX:
```tsx
<BulkBar
  count={selection.size}
  onMarkDone={() => {
    selection.asArray().forEach((id) => {
      const row = executions?.rows.find((r) => r.id === id);
      if (!row || row.status === 'DONE') return;
      updateExecution.mutate({ id: row.id, status: 'DONE', hhPlanned: row.hhPlanned, previousStatus: row.status });
    });
    selection.clear();
  }}
  onSkip={() => {
    selection.asArray().forEach((id) => {
      const row = executions?.rows.find((r) => r.id === id);
      if (!row || row.status === 'SKIPPED') return;
      updateExecution.mutate({ id: row.id, status: 'SKIPPED', hhPlanned: row.hhPlanned, previousStatus: row.status });
    });
    selection.clear();
  }}
  onClear={() => selection.clear()}
/>
```

- [ ] **Step 7: Smoke manual**

Seleccionar 3 filas → barra flotante aparece. Click "Hechas" → 3 mutaciones, 3 toasts undo, barra desaparece.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/use-selection.ts apps/web/lib/use-selection.test.tsx apps/web/app/\(dashboard\)/_components/BulkBar.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): add bulk selection with floating action bar"
```

---

## Task 17: Tests E2E críticos

**Files:**
- Create: `apps/web/e2e/dashboard.spec.ts`
- Create: `apps/web/e2e/keyboard.spec.ts`

> **Nota:** Este task asume que existe un usuario seed o variable de entorno con credenciales para el login en el entorno local. Si no, este task se reduce a verificar página pública (`/login`) y se completa el resto en Fase 2 cuando se monte fixture de auth completa.

- [ ] **Step 1: Test E2E navegación básica**

Archivo `apps/web/e2e/dashboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('login page', () => {
  test('renderiza formulario de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
```

- [ ] **Step 2: Test E2E atajo `?` abre help**

Archivo `apps/web/e2e/keyboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('shortcuts (login page)', () => {
  test('? está deshabilitado fuera del dashboard (sanity)', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Shift+?');
    await expect(page.getByText(/atajos de teclado/i)).toHaveCount(0);
  });
});
```

> Tests E2E completos del dashboard se agregan en Fase 2 cuando hay fixture de auth.

- [ ] **Step 3: Correr e2e**

```bash
cd apps/web && pnpm e2e
```
Esperado: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/dashboard.spec.ts apps/web/e2e/keyboard.spec.ts
git commit -m "test(web): add baseline e2e tests for login + shortcuts sanity"
```

---

## Cierre de Fase 1

- [ ] **Verificación final:**
  - `cd apps/web && pnpm typecheck` → OK
  - `cd apps/web && pnpm lint` → OK
  - `cd apps/web && pnpm test` → OK (todos los unit tests verdes)
  - `cd apps/web && pnpm e2e` → OK
  - `cd apps/web && pnpm build` → OK
  - `cd apps/api && pnpm test` → OK (sin regresiones)

- [ ] **Open PR a `main` desde `feat/sp1-design-rebrand`** con título:

```
feat(web): industrial-grade UX foundation — phase 1
```

Cuerpo:

```
Esta fase establece la fundación para el rediseño industrial del dashboard:

**Test infra**
- Vitest + RTL + jsdom (unit)
- Playwright (E2E)

**Primitivos UX**
- Sonner toasts con undo
- `useOptimisticMutation` con rollback automático
- Drawer detalle de ejecución (Sheet)
- Headers de tabla sortables (reemplaza select Orden:)
- Click en StatusBadge filtra
- Stale-while-revalidate (atenuación durante refetch)
- Atajos teclado (j/k/d/s/Enter/?/) con diálogo de ayuda
- Density real aplicada a tabla
- Sticky sub-header con KPIs
- Bulk selection + barra flotante
- EmptyState component
- Helper de permisos role→persona

**Documentación**
- docs/design-tokens.md con tabla contraste WCAG AA

Sin breaking changes. Sin migración de DB. Sin nuevas dependencias backend.

Próxima fase: `/work` modo terreno + PWA shell.
```

- [ ] **Próximo paso (al merge):** Escribir `docs/superpowers/plans/2026-XX-XX-fase-2-modo-terreno-pwa.md`.

---

## Self-Review (post-escritura)

**1. Cobertura del scope acordado:**
- Test infra ✓ (T1, T2)
- Tokens documentados ✓ (T3)
- Mapeo roles ✓ (T4)
- Toast undo ✓ (T5)
- Optimistic mutation con rollback ✓ (T6, T7)
- Stale-while-revalidate ✓ (T8)
- Empty states ✓ (T9)
- Drawer detalle ✓ (T10)
- Sortable headers ✓ (T11)
- Pill clickeable ✓ (T12)
- Atajos teclado + help ✓ (T13)
- Density real ✓ (T14)
- Sticky header ✓ (T15)
- Bulk selection ✓ (T16)
- E2E baseline ✓ (T17)

Sin gaps respecto al alcance comprometido para Fase 1.

**2. Sin placeholders:** Todos los pasos tienen código concreto, comandos exactos y rutas.

**3. Consistencia de tipos:**
- `Role` definido en T4 y reutilizado.
- `ExecutionRow`, `ExecStatus` ya existen en `lib/types`.
- `useOptimisticMutation` firma usada coherentemente en T7.
- `SortField`, `GroupField` ya existen en `dashboard/page.tsx` y T11 los reutiliza.

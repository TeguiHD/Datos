# Industrial-Grade UX Overhaul — Roadmap Maestro

**Fecha:** 2026-04-30
**Branch base:** `feat/sp1-design-rebrand`
**Objetivo:** Llevar `datos.nicoholas.dev` a estándar de aplicación industrial CMMS/EAM (referentes: SAP Fiori, IBM Maximo, Infor EAM, Fiix, UpKeep). Foco: agilidad operativa para personal de terreno, sin perder potencia para planificadores y supervisores.

---

## Visión

La aplicación actual mezcla 4 personas (técnico terreno, planificador, analista, admin) en una pantalla. La sobrecarga visual hace que terreno — el usuario más numeroso — no la use eficientemente.

**Estado objetivo:**
- **Técnico (rol VIEWER)** abre la app en celular, ve tareas de hoy/semana, marca hechas con un toque, sube foto en WebP. Funciona offline en planta.
- **Planificador (EDITOR)** ve calendario heatmap mes×equipo, reprograma con drag, exporta.
- **Supervisor (ADMIN)** ve KPIs, tendencias, comparativas año-año, audita.
- **Superadmin** gestiona usuarios, importación, integraciones.

## Mapeo de roles → personas UX

> El enum `Role` no se modifica. Se mapea a personas UX en frontend.

| Role enum | Persona UX | Ruta de aterrizaje | Permisos |
|-----------|-----------|--------------------|---------|
| VIEWER    | Técnico    | `/work`             | Ver tareas, marcar hecha/omitida, subir foto |
| EDITOR    | Planificador | `/plan`           | Todo VIEWER + reprogramar, editar HH, vistas guardadas |
| ADMIN     | Supervisor | `/analytics`        | Todo EDITOR + KPIs, exports masivos, auditoría |
| SUPERADMIN | Admin      | `/admin`            | Todo ADMIN + usuarios, importación Excel, integraciones |

## Constraints duros

- **VPS limitado:** fotos resize a 1280px max, calidad WebP 0.7, máx 3 fotos/ejecución, almacén filesystem `apps/api/uploads/<execId>/<uuid>.webp`.
- **Sin tocar enum `Role`:** mapeo en helpers `lib/permissions.ts`.
- **Sin sustituir online por offline:** TanStack Query sigue siendo fuente. Outbox solo cuando red caída.
- **Sin breaking changes en API:** endpoints actuales siguen funcionando. Nuevos endpoints con prefijo `/api/v2/...` solo si necesario.
- **Coexistencia 2 semanas:** rutas viejas (`/dashboard`) accesibles vía `?legacy=1` durante migración.

## Stack ya disponible

- Next.js 15 + React 19 + Tailwind + Radix (Dialog, DropdownMenu, Tooltip, Sheet, Collapsible, Select)
- TanStack Query v5
- Recharts (gráficos)
- Tokens semánticos en `globals.css` (`--color-accent`, `--color-ok`, `--row-py`, etc.)
- shadcn-style components (`button`, `badge`, `card`, etc.)
- Auth con cookies + 2FA TOTP middleware

## Stack a agregar

| Librería | Propósito | Tamaño bundle |
|----------|----------|--------------|
| `vitest` + `@testing-library/react` + `jsdom` | Unit tests web (devDep) | — |
| `@playwright/test` | E2E tests (devDep) | — |
| `sonner` | Toast con undo | ~3 KB |
| `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister` + `idb-keyval` | Persistir cache en IndexedDB | ~6 KB |
| `next-pwa` o configuración manual de Workbox | Service worker, manifest, install prompt | ~10 KB SW |
| `react-hotkeys-hook` | Atajos teclado declarativos | ~2 KB |
| `browser-image-compression` | Resize + convert a WebP en cliente | ~12 KB |

Total bundle agregado estimado: **~35 KB gzip**.

---

## Fases

### Fase 1 — Fundación UX + Test Infra
**Plan:** [`2026-04-30-fase-1-fundacion-ux.md`](2026-04-30-fase-1-fundacion-ux.md)
**Duración estimada:** 8–12 días
**Output:**
- Test infra web (Vitest, Playwright, RTL)
- Tokens documentados en `docs/design-tokens.md` con tabla contraste WCAG AA
- Toasts con undo (`sonner`)
- Mutaciones optimistas con rollback
- Drawer detalle de ejecución (`<ExecutionDetailDrawer>`)
- Headers de tabla sortables (reemplaza select "Orden:")
- Click en pill estado filtra
- Stale-while-revalidate UX (datos atenuados durante refetch)
- Atajos teclado (`j/k/d/s/Enter/?/`)
- Empty states con CTA
- Density real aplicada a tabla
- Sticky sub-header con KPIs primarios
- Bulk selection + barra flotante
- Helper `lib/permissions.ts` con mapeo role→persona

**Sin esto, fases 2-4 reinventan primitivos.** Fase 1 es bloqueante.

### Fase 2 — `/work` Modo Terreno + PWA Shell
**Plan:** *(se escribe al cerrar Fase 1)*
**Duración estimada:** 8–10 días
**Output:**
- Ruta `/work` con tabs segmentados pre-computados servidor (`Hoy`, `Esta semana`, `Vencidas`, `Mis equipos`)
- Endpoint `/api/schedule/segments/:segment` que retorna conteos + filas
- Componente `<WorkCard>` para layout celular-first
- Swipe gestures en mobile (lib `framer-motion` ya común; o `@use-gesture/react`)
- Captura de foto: cliente comprime con `browser-image-compression`, sube WebP
- Endpoint `POST /api/schedule/executions/:id/attachments` (multipart o JSON+base64)
- Migración Prisma: tabla `Attachment` (id, executionId, path, mime, sizeBytes, createdAt, createdBy)
- Service worker con Workbox: cache shell + `stale-while-revalidate` para `/api/schedule/executions*`
- Manifest PWA + iconos + install prompt
- Redirect login según role (`loginRedirectByRole`)

### Fase 3 — Offline-First Outbox + Sync
**Plan:** *(se escribe al cerrar Fase 2)*
**Duración estimada:** 8–12 días
**Output:**
- Persister IndexedDB para TanStack Query (cache cargado al boot, `stale-while-revalidate` automático)
- Outbox: tabla IDB `mutations_outbox` con (id, endpoint, method, body, idempotencyKey, attempts, lastError)
- Helper `enqueueMutation` con replay automático al volver online (Network Information API + `online` event)
- Backend: middleware idempotency-key (Redis 24h TTL) en endpoints de mutación. Devuelve mismo payload si llega 2× con misma key.
- Indicador en topbar: `🟢 Online` / `🟠 3 cambios pendientes` / `🔴 Sin red`
- Reconciliación de conflictos: `last-write-wins` por timestamp servidor; conflictos visibles en banner ("Tu cambio fue sobrescrito por <usuario> el <fecha>")
- Tests E2E offline: `page.context().setOffline(true)` en Playwright

### Fase 4 — `/plan` Cronograma Heatmap + `/analytics` Supervisor
**Plan:** *(se escribe al cerrar Fase 3)*
**Duración estimada:** 8–12 días
**Output:**
- Ruta `/plan`: tabs Cronograma, Tareas, Vistas guardadas
- Componente `<HeatmapCalendar>` custom CSS grid: filas equipo (PSR), columnas mes, celdas color por estado (pendiente warn / vencida danger / hecha ok / mixto). Click celda abre lista filtrada.
- Drag-and-drop reprogramación (lib `@dnd-kit/core`): mover ejecución de un mes a otro → llama PATCH dueDate
- Ruta `/analytics`: gráficos actuales (HH, ABC, frecuencia, backlog) + nuevas comparativas year-over-year
- Audit trail visible en drawer detalle: tab "Historia" con `audit/` events filtrados por executionId
- Ruta `/admin`: usuarios, importación, auditoría como tabs
- Sidebar reducido a 4 items: Mi trabajo, Planificación, Análisis, Admin (visibles según role)
- Eliminación rutas legacy una vez migradas

---

## Ejecución

Cada fase = un plan ejecutable independiente vía `superpowers:subagent-driven-development`.

**Después de cada fase:**
- Tests pasan, build limpio
- PR a `main` con review humano
- Deploy a staging
- 2-3 días de uso real con usuario antes de pasar a fase siguiente

**Total calendario estimado:** 6–9 semanas (con buffer para revisiones, deploy, ajustes).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Service worker cachea respuesta vieja con bug | Versionado SW (`workbox.precaching.PrecacheController`), invalidación on update + skipWaiting |
| Outbox queue corrupta tras crash navegador | Schema validado al leer (Zod), si entry corrupta → cuarentena en `mutations_quarantine` y log |
| Foto WebP grande llena VPS | Cap servidor 500 KB/foto, máx 3/ejecución, cron limpia ejecuciones SKIPPED >1 año |
| `last-write-wins` pierde cambio offline | Banner visible al usuario ofreciendo reaplicar; logs auditables vía `audit/` |
| Migración rompe usuarios actuales | Coexistencia 2 sem (`?legacy=1`) + feature flag por usuario en Redis |
| Custom heatmap performance con 545×84 celdas | Virtualización (react-virtual) si >40k celdas; benchmark en Fase 4 |

## Métricas de éxito

Tras completar las 4 fases, medir antes/después:
- **Time-to-mark-done** (tiempo desde abrir app hasta marcar tarea hecha) — objetivo <8s en mobile
- **Bundle size** página `/work` — objetivo <250 KB gzip
- **Lighthouse PWA score** — objetivo ≥95
- **Lighthouse Performance** mobile — objetivo ≥90
- **WCAG contraste** — todos los pares color/fondo con AA mínimo, AAA donde posible
- **Offline functional coverage** — marcar hecha/omitida + ver lista de hoy + ver detalle = 100%

---

## Próximo paso

Iniciar Fase 1 con plan `2026-04-30-fase-1-fundacion-ux.md`.

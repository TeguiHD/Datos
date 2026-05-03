# Plan de implementación — Plataforma operacional de mantención

> **Continuidad de sesión:** este plan toma la spec aprobada en `docs/superpowers/specs/2026-05-03-rediseno-uxux-plataforma-mantencion-design.md` y la convierte en trabajo ejecutable por fases.  
> **Estado:** implementación iniciada. Fase 1 completa y Fase 2 base completa para plantas/equipos/plan.  
> **Regla principal:** cada fase debe dejar el sistema usable y verificable, sin romper la visualización Excel existente hasta que el reemplazo esté completo.

## Objetivo

Convertir `datos.nicoholas.dev` desde dashboard de Excel a herramienta operacional de mantención preventiva:

- plantas creadas y editadas manualmente;
- equipos por planta;
- plan de mantención por planta con HH plan;
- ejecuciones con HH real, evidencia local en VPS y aprobación simple;
- dashboard Hoy/Semana/Análisis/IA consumiendo ese modelo nuevo;
- rol actual simplificado: `SUPERADMIN` todo, `INVITADO` lectura/demo, dejando preparada la estructura para roles futuros.

## Principios de implementación

- Mantener las rutas actuales vivas mientras nacen las nuevas pantallas.
- No borrar el modelo `MaintenanceTask` todavía: queda como fuente de bootstrap/importación y compatibilidad con analytics existentes.
- Crear un modelo operacional paralelo (`Plant`, `Equipment`, `MaintenancePlanTask`, `OperationalExecution`, `Evidence`) y migrar UI por fases.
- Todo endpoint de escritura debe tener `@Roles(Role.SUPERADMIN)` y audit log.
- `INVITADO` ve pantallas, pero no ve CTAs de escritura.
- UI final usa lucide-react para iconos, no emojis.
- Evidencia se guarda en VPS local y se sirve por API con JWT, nunca como ruta pública de Caddy.
- Cada fase incluye pruebas mínimas antes de pasar a la siguiente.

## Fase 0 — Preparación y limpieza de continuidad

**Objetivo:** dejar el repo orientado antes de tocar arquitectura pesada.

**Archivos:**
- `docs/superpowers/specs/2026-05-03-rediseno-uxux-plataforma-mantencion-design.md`
- `docs/superpowers/plans/2026-05-03-operational-maintenance-implementation.md`
- `.gitignore`

**Tareas:**
- [x] Revisar y conservar la spec aprobada.
- [x] Mantener `.superpowers/` ignorado para no versionar mockups temporales.
- [ ] Confirmar qué cambios sueltos del worktree pertenecen a iteraciones anteriores antes de hacer commits.
- [ ] Crear rama de trabajo, recomendado: `feat/operational-maintenance-platform`.

**Validación:**
- [ ] `git status --short` entendido y sin archivos temporales no deseados.

## Fase 1 — Modelo operacional Prisma

**Objetivo:** agregar las entidades nuevas sin romper las tablas actuales.

**Archivos principales:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_operational_maintenance/migration.sql`
- `apps/api/src/app.module.ts`

**Cambios de schema:**
- [x] Agregar enums:
  - `PlantStatus { ACTIVE, INACTIVE }`
  - `EquipmentType { MOTOR, PUMP, FILTER, PANEL, OTHER }`
  - `PlanFrequency { MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, CUSTOM }`
  - `OperationalExecutionStatus { SCHEDULED, IN_PROGRESS, DONE_PENDING_APPROVAL, APPROVED, REJECTED, SKIPPED, POSTPONED }`
  - `ExecutionOutcome { DONE, DONE_WITH_OBSERVATIONS, NOT_DONE }`
- [x] Agregar modelos:
  - `Plant`
  - `Equipment`
  - `MaintenancePlanTask`
  - `OperationalExecution`
  - `Evidence`
- [x] Extender `User` con relaciones hacia registros/aprobaciones/evidencias si Prisma lo requiere.
- [x] Mantener `Role` existente por ahora (`SUPERADMIN`, `ADMIN`, `EDITOR`, `VIEWER`) y mapear `VIEWER` como `INVITADO` en UI/permisos, para evitar migración destructiva inmediata.

**Decisión táctica sobre roles:**
El usuario pidió `SUPERADMIN` e `INVITADO`. El schema actual ya tiene `VIEWER`. Para no romper seed, guards y código existente, fase 1 usa:

```ts
SUPERADMIN = escritura total
VIEWER = invitado/read-only
ADMIN/EDITOR = compatibilidad temporal, se pueden mapear como SUPERADMIN mientras dure transición
```

Luego, si se quiere literal `INVITADO`, se hace migración dedicada renombrando `VIEWER`.

**Validación:**
- [x] `pnpm --filter @datos/api exec prisma generate`
- [ ] `pnpm --filter @datos/api prisma migrate dev`
- [x] `pnpm --filter @datos/api typecheck`

## Fase 2 — API Plantas, equipos y plan de mantención

**Objetivo:** CRUD operacional básico con auditoría.

**Crear:**
- `apps/api/src/operations/operations.module.ts`
- `apps/api/src/operations/plants.controller.ts`
- `apps/api/src/operations/plants.service.ts`
- `apps/api/src/operations/operations.dto.ts`
- `apps/api/src/operations/sanitize.ts`
- `apps/api/src/operations/equipment.controller.ts`
- `apps/api/src/operations/equipment.service.ts`
- `apps/api/src/operations/plan.controller.ts`
- `apps/api/src/operations/plan.service.ts`

**Endpoints:**
- [x] `GET /api/plantas`
- [x] `POST /api/plantas`
- [x] `GET /api/plantas/:psr`
- [x] `PATCH /api/plantas/:psr`
- [x] `DELETE /api/plantas/:psr` soft delete con motivo.
- [x] `GET/POST /api/plantas/:psr/equipos`
- [x] `PATCH/DELETE /api/equipos/:id`
- [x] `GET/POST /api/plantas/:psr/plan`
- [x] `PATCH/DELETE /api/tareas-programadas/:id`
- [x] `POST /api/tareas-programadas/:id/generar-ejecuciones`

**Reglas:**
- [x] Sanitizar strings como en `TasksService`.
- [x] Validar `psr` único y normalizado.
- [x] `DELETE` no borra físicamente: marca `deletedAt` o `status=INACTIVE`.
- [x] Cada mutación registra audit log con `before`/`after`.

**Tests sugeridos:**
- [ ] Crear planta.
- [ ] Rechazar PSR duplicado.
- [ ] Crear equipo asociado.
- [ ] Crear tarea de plan con HH decimal.
- [ ] Generar ejecuciones próximas 12 meses.
- [ ] VIEWER no puede escribir.

## Fase 3 — API de ejecuciones y evidencia local VPS

**Objetivo:** soportar el flujo más valioso: registrar HH real + evidencia + aprobación.

**Crear:**
- `apps/api/src/operations/executions.controller.ts`
- `apps/api/src/operations/executions.service.ts`
- `apps/api/src/operations/evidence.controller.ts`
- `apps/api/src/operations/evidence.service.ts`
- `apps/api/src/operations/evidence.storage.ts`

**Infra/config:**
- [ ] Agregar env `EVIDENCE_STORAGE_DIR=/var/lib/datos/evidencias`.
- [ ] Agregar env `EVIDENCE_MAX_FILE_MB=25`.
- [ ] Documentar permisos de carpeta en `infra/`.

**Endpoints:**
- [ ] `GET /api/ejecuciones` con filtros `plantId`, `status`, `abc`, `from`, `to`, `q`.
- [ ] `POST /api/ejecuciones/:id/registrar`
- [ ] `POST /api/ejecuciones/:id/aprobar`
- [ ] `POST /api/ejecuciones/:id/rechazar`
- [ ] `POST /api/ejecuciones/:id/postergar`
- [ ] `POST /api/ejecuciones/:id/reabrir`
- [ ] `POST /api/ejecuciones/:id/evidencias` multipart.
- [ ] `GET /api/evidencias/:id` con JWT + permiso.
- [ ] `DELETE /api/evidencias/:id`

**Reglas:**
- [ ] `HH real` requerido para `DONE` y `DONE_WITH_OBSERVATIONS`.
- [ ] Comentario requerido para `DONE_WITH_OBSERVATIONS`, `NOT_DONE`, rechazo y reapertura.
- [ ] `SUPERADMIN` puede guardar y aprobar en el mismo paso.
- [ ] Calcular `sha256` al subir evidencia.
- [ ] Validar MIME por contenido, no solo extensión.
- [ ] Guardar archivo en `{plantId}/{executionId}/{uuid}.{ext}`.

**Validación:**
- [ ] Unit tests de máquina de estados.
- [ ] Unit tests de validación evidencia.
- [ ] `pnpm --filter @datos/api test`

## Fase 4 — UI Plantas operacional

**Objetivo:** reemplazar la página de plantas actual por una experiencia CRUD real.

**Archivos principales:**
- `apps/web/app/(dashboard)/dashboard/plantas/page.tsx`
- `apps/web/app/(dashboard)/dashboard/plantas/[psr]/page.tsx`
- `apps/web/app/(dashboard)/dashboard/plantas/_components/PlantGrid.tsx`
- `apps/web/app/(dashboard)/dashboard/plantas/_components/PlantDrawer.tsx`
- `apps/web/app/(dashboard)/dashboard/plantas/_components/PlantDetailTabs.tsx`
- `apps/web/lib/types.ts`
- `apps/web/lib/permissions.ts`

**UI listado:**
- [ ] Header compacto con contador activas/desactivadas.
- [ ] Botón `Nueva planta` solo para escritura.
- [ ] Búsqueda por nombre/PSR/equipo.
- [ ] Chips por riesgo.
- [ ] Toggle grid/tabla.
- [ ] Cards con equipos, tareas, próxima ejecución, cumplimiento 6m.

**UI drawer crear/editar:**
- [ ] General.
- [ ] Equipos.
- [ ] Plan de mantención.
- [ ] Permisos: visible para invitado.

**Detalle planta:**
- [ ] Header sticky.
- [ ] Tabs: Resumen, Plan & Equipos, Ejecuciones, Evidencias, Histórico.
- [ ] CTA `Registrar ejecución` visible en todos los tabs si puede escribir.

**Validación visual:**
- [ ] Desktop 1440.
- [ ] Tablet 768.
- [ ] Mobile 375.
- [ ] No horizontal scroll.

## Fase 5 — Drawer registro de ejecución

**Objetivo:** que el usuario pueda cerrar una tarea útil en menos de 60 segundos.

**Crear:**
- `apps/web/app/(dashboard)/dashboard/_components/ExecutionRegisterDrawer.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/EvidenceUploader.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/ApprovalToggle.tsx`

**Interacciones:**
- [ ] Outcome: Hecha, Con observaciones, No realizada.
- [ ] Fecha real default hoy.
- [ ] HH real default HH plan, step 0.1, controles +/-.
- [ ] Evidencia drag and drop en desktop.
- [ ] Botón cámara/subir en mobile.
- [ ] Preview con eliminar.
- [ ] Toggle aprobar al guardar para SUPERADMIN.
- [ ] Optimistic UI con toast undo cuando sea reversible.

**Validación:**
- [ ] Guardar ejecución hecha con HH real.
- [ ] Guardar ejecución con observaciones exige comentario.
- [ ] No realizada exige motivo y fecha de reprogramación.
- [ ] Subida de evidencia muestra progreso/error.

## Fase 6 — Dashboard tabs Hoy/Semana/Análisis/IA

**Objetivo:** hacer que el home sea una herramienta diaria, no un mural de gráficos.

**Archivos:**
- `apps/web/app/(dashboard)/dashboard/page.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/DashboardTabs.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/TodayTab.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/WeekTab.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/AnalysisTab.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/AiTemplatesTab.tsx`
- `apps/api/src/operations/dashboard.controller.ts`
- `apps/api/src/operations/dashboard.service.ts`

**Endpoints:**
- [ ] `GET /api/dashboard/hoy`
- [ ] `GET /api/dashboard/semana`
- [ ] `GET /api/dashboard/analisis`

**Tab Hoy:**
- [ ] 4 KPIs accionables.
- [ ] Radar global con registrar/postergar.
- [ ] Pendientes aprobación.
- [ ] Plantas alto riesgo.

**Tab Semana:**
- [ ] Calendario L-D.
- [ ] Total HH por día y semana.
- [ ] Click tarea abre drawer.
- [ ] Reprogramación con motivo.

**Tab Análisis:**
- [ ] Filtros en URL.
- [ ] HH plan vs real 12m.
- [ ] Cumplimiento por planta.
- [ ] Heatmap mes x año.
- [ ] Distribución estados.
- [ ] Tabla resultados.

**Tab IA:**
- [ ] Templates guiados.
- [ ] Prompt libre colapsado.
- [ ] Resultado con metadata auditable.

## Fase 7 — Importación como bootstrap + diff

**Objetivo:** el Excel deja de mandar al producto, pero sigue siendo útil.

**Archivos:**
- `apps/api/src/admin/import.service.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/web/app/(dashboard)/dashboard/importacion/page.tsx`

**Flujo:**
- [ ] Subir archivo.
- [ ] Mapear columnas.
- [ ] Revisar diff: nuevas, actualizadas, conflictos, sin match.
- [ ] Aplicar por selección.
- [ ] Guardar mapping por hash de headers.

**Regla clave:**
- [ ] Nunca sobrescribir cambios manuales sin confirmación fila por fila.

## Fase 8 — Mobile, offline mínimo y polish

**Objetivo:** que la demo se sienta profesional en celular.

**Tareas:**
- [ ] Bottom tab bar en `<768px`: Hoy, Semana, Plantas, Análisis.
- [ ] FAB por pantalla con CTA principal.
- [ ] Tablas a cards stacked.
- [ ] Drawers a sheets/bottom sheets.
- [ ] Cámara nativa con `capture="environment"`.
- [ ] IndexedDB queue para registro ejecución y evidencia.
- [ ] Banner de registros pendientes por sincronizar.
- [ ] Atajos teclado desktop.
- [ ] Onboarding breve.
- [ ] Empty/error/loading states consistentes.

## Fase 9 — QA, performance y despliegue

**Tests mínimos antes de deploy:**
- [ ] `pnpm --filter @datos/api typecheck`
- [ ] `pnpm --filter @datos/api test`
- [ ] `pnpm --filter @datos/web typecheck`
- [ ] `pnpm --filter @datos/web test`
- [ ] `pnpm --filter @datos/web e2e`
- [ ] `pnpm build`

**Playwright crítico:**
- [ ] Login + 2FA.
- [ ] Crear planta.
- [ ] Crear equipo.
- [ ] Crear tarea de plan.
- [ ] Generar ejecución.
- [ ] Registrar HH real + evidencia.
- [ ] Aprobar.
- [ ] VIEWER/INVITADO no ve CTAs.

**Deploy:**
- [ ] Backup DB antes de migración.
- [ ] Crear directorio `/var/lib/datos/evidencias`.
- [ ] Verificar permisos del usuario del contenedor/API.
- [ ] Ejecutar migraciones.
- [ ] Smoke test producción: health, login, plantas, subir evidencia pequeña.

## Orden recomendado para empezar ahora

1. Fase 1: schema Prisma y migración.
2. Fase 2: API plantas/equipos/plan.
3. Fase 4 parcial: UI plantas listado + drawer.
4. Fase 3: ejecuciones/evidencia.
5. Fase 5: drawer registro.

Ese orden entrega utilidad visible rápido: primero puedes crear una planta, asociar equipos, armar su plan y recién después cerrar ejecuciones con evidencia.

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Duplicar conceptos entre `MaintenanceTask` y `MaintenancePlanTask` | Documentar `MaintenanceTask` como legacy/import y `MaintenancePlanTask` como operacional. |
| Migración de roles rompe guards existentes | Mantener enum actual y mapear `VIEWER` como invitado inicialmente. |
| Evidencias llenan VPS | Límite 25 MB por archivo, cuota por planta futura, backup y alertas. |
| Re-import pisa data manual | Diff obligatorio, nunca apply automático. |
| UI vuelve a ser densa | Tabs por intención, KPIs clicleables, detalle progresivo, mobile first. |

## Definición de terminado

La plataforma se considera lista para demo cuando:

- se puede crear una planta desde UI;
- se puede asociar al menos un equipo;
- se puede crear una tarea de mantención con frecuencia y HH plan;
- se generan ejecuciones;
- se registra una ejecución con HH real y evidencia;
- el dashboard Hoy refleja esa ejecución;
- `INVITADO/VIEWER` puede ver sin modificar;
- tests principales pasan.

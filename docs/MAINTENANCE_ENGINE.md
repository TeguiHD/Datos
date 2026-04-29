# Motor de mantenciones — diseño y operación

## Por qué existe

El Excel SAP-PM contiene un grid fijo 2022–2028 con celdas precomputadas mes×mes.
Importar tal cual rompía dos cosas críticas:

1. **Drift post-2028**: nada después de dic-2028.
2. **Sin valor accionable**: la tabla se ve, pero no responde "¿qué toca esta semana?".

Este motor reemplaza el grid fijo por un **generador determinista** y agrega un
**modelo operacional** (`TaskExecution`) para gestionar el ciclo de vida de cada ocurrencia.

## Modelo

- `MaintenanceTask` — definición SAP-PM de la tarea.
  - `frecuenciaMeses` (int) y `mesInicio` (1..12) son las **reglas de generación**.
  - `frecuenciaCodigo` (1A, 6M, 5A…) es fallback si `frecuenciaMeses` viene vacío.
  - `hasDiscrepancy` (bool) — true si el grid Excel ≠ ocurrencias calculadas.
- `MonthlySchedule` — proyecciones mensuales materializadas. `source ∈ {EXCEL, CALC}`.
  - EXCEL: importadas tal cual del archivo (preservadas para auditoría).
  - CALC: generadas por el motor para meses que el Excel no cubre.
- `TaskExecution` — **una fila por ocurrencia futura**. Estado: PENDING / DONE / OVERDUE / SKIPPED.
  - Único `(taskId, dueDate)`.
  - Aquí se cierra el ciclo operacional: HH real, operador, notas.

## Generación

`apps/api/src/schedule/occurrences.ts::generateOccurrences()`

Determinista, libre de side-effects. Tomado un `(frecuenciaMeses, mesInicio, anchorYear, hhPlanned)`
emite todas las ocurrencias en el rango `[from, to]`. Cubierto por tests
`occurrences.spec.ts`.

## Materialización

`apps/api/src/schedule/materialize.service.ts::rebuildAll()`

Para cada `MaintenanceTask`:

1. Calcula ocurrencias hasta `now + MAINT_HORIZON_YEARS` (default 20).
2. Reemplaza `MonthlySchedule.source = CALC` (preserva EXCEL).
3. Crea `TaskExecution(PENDING)` para meses futuros que aún no existen.
4. Marca PENDING vencidas como `OVERDUE`.
5. Setea `hasDiscrepancy` si Excel y motor difieren.

**Cuándo se ejecuta:**
- Automático al final de cada `POST /api/admin/import`.
- Manual: `POST /api/schedule/rebuild` (SUPERADMIN/ADMIN).
- En cada `GET /upcoming|overdue` se recorre `markOverdue()` (rápido).

## Endpoints clave

| Método | Ruta | Quién | Qué |
|--------|------|-------|-----|
| GET | `/api/schedule/upcoming?days=N` | Cualquier rol | Tareas pendientes próximas N días |
| GET | `/api/schedule/overdue` | Cualquier rol | Tareas vencidas |
| PATCH | `/api/schedule/executions/:id` | EDITOR+ | Marcar DONE/SKIPPED, registrar HH real |
| POST | `/api/schedule/rebuild` | ADMIN+ | Regenera proyecciones (idempotente) |
| GET | `/api/schedule/kpis` | Cualquier rol | counts: total, pendientes, vencidas, discrepancias |
| POST | `/api/ai/search` | Cualquier rol | Búsqueda NL → filtros JSON validados |

## Búsqueda IA — modelo de amenaza

**No NL→SQL.** El LLM nunca emite SQL ni código. Su única salida es un objeto JSON
acotado por `AiFilterSchema` (Zod). Si Zod falla → 400.

Defensas:
- `sanitizeUserPrompt()` redacta patrones comunes de jailbreak antes de pasar al LLM.
- Prompt de sistema inmutable, con delimitadores `<<<>>>` para encerrar input.
- `response_format: json_object` + `temperature: 0`.
- Timeout 15 s, max_tokens 256.
- Rate limit 10/min/usuario (`@nestjs/throttler`).
- VIEWER: `take` máximo 50.
- Toda llamada se audita en `AuditLog` (action `AI_SEARCH`) con prompt, modelo, filtro y outcome.

Provider configurable (Groq por defecto, OpenRouter como fallback).
Modelo recomendado: `openai/gpt-oss-120b` vía Groq.

## Operación

```bash
# Migración
cd apps/api && pnpm db:migrate

# Recálculo manual (también disponible vía UI)
curl -X POST https://datos.nicoholas.dev/api/schedule/rebuild \
  -H "Cookie: access_token=…" -H "x-csrf-token: …"
```

## Reglas no-negociables

1. Nunca borrar `TaskExecution` con status `DONE` o `SKIPPED` (historial operacional).
2. Nunca borrar `MonthlySchedule.source = EXCEL` salvo en re-import del mismo task.
3. `hasDiscrepancy = true` debe revisarse: indica que el Excel original tiene celdas
   que el motor calculado no espera (o viceversa). No bloquea, pero es señal.

# Re-import dataset ESSC Sur (17-04-2026)

Procedimiento para reemplazar el dataset principal por el Excel
`Copia de Posiciones de mantenimiento ESSC Sur (17-04-2026).xlsx`.

## Validación previa (sin DB)

```bash
cd apps/api
pnpm tsx scripts/import-excel.ts \
  --file "../../../Copia de Posiciones de mantenimiento ESSC Sur (17-04-2026).xlsx" \
  --check
```

Salida esperada (verificada 2026-05-19):

```
[import] parsed 280 tasks from ...
[check] tasksWithSchedule=247 scheduleRows=3037
[check] sample task keys: [ 'psr', 'planMantPreventivo', 'hojaRuta',
  'ubicacionTecnica', 'denomUbicacionTecnica', 'equipo', 'denomObjetoTecnico',
  'posicionMant', 'descPosicionMant', 'frecuenciaCodigo', 'claveModelo',
  'frecuenciaMeses', 'mesInicio', 'comentarios' ]
```

## Pre-flight obligatorio

1. **Snapshot DB**: ver [SNAPSHOT.md](./SNAPSHOT.md) — `pg_dump -Fc` + sha256 + age cifrado a R2.
2. **Verificar audit chain**: `curl https://datos.nicoholas.dev/api/audit/verify -H "Cookie: $SESSION"` debe retornar `{ ok: true }`.
3. **Anotar conteo previo** para comparación:
   ```sql
   SELECT COUNT(*) FROM "MaintenanceTask" WHERE "deletedAt" IS NULL;
   SELECT COUNT(*) FROM "MonthlySchedule";
   SELECT COUNT(*) FROM "OperationalExecution";
   ```

## Import real (planta de servicio detenida o ventana de mantenimiento)

```bash
ssh deploy@45.55.214.153
cd /opt/datos
docker compose -f infra/docker-compose.yml --env-file .env stop web
docker compose -f infra/docker-compose.yml --env-file .env exec -T api \
  pnpm tsx scripts/import-excel.ts \
  --file "/opt/datos/data/Copia de Posiciones de mantenimiento ESSC Sur (17-04-2026).xlsx" \
  --replace
```

`--replace` borra `MaintenanceTask` no-manual + `MonthlySchedule` + `TaskExecution` asociadas
antes de importar. Conserva entradas con `manualOverride = true`.

Salida esperada:

```
[replace] deleted non-manual tasks=<n> schedules=<n> executions=<n>
[import] ok=280 err=0 total=280
[rebuild] tasks=280 executionsCreated=~3300 discrepancies=<n> horizon=2028
```

## Post-import

```bash
# 1. Verificar audit chain integro
curl -fsS https://datos.nicoholas.dev/api/audit/verify -H "Cookie: $SESSION"

# 2. Confirmar conteos post-import
docker compose exec db psql -U datos datos -c \
  'SELECT (SELECT COUNT(*) FROM "MaintenanceTask" WHERE "deletedAt" IS NULL) AS tasks,
          (SELECT COUNT(*) FROM "MonthlySchedule") AS schedule_rows,
          (SELECT COUNT(*) FROM "OperationalExecution") AS executions;'

# 3. Restaurar tráfico web
docker compose -f infra/docker-compose.yml --env-file .env start web
```

## Rollback

```bash
# Restaurar snapshot pre-import
docker compose stop api web
docker compose exec -T db \
  pg_restore -U datos -d datos --clean --if-exists \
  < /opt/datos/backups/datos-<TS-pre-import>.dump
docker compose start api web
```

## Notas

- Aliases PSR (PlantAlias) se preservan; nuevas plantas detectadas en el Excel se crean automáticamente vía `PlantCatalogService`.
- Tareas con `manualOverride=true` no se tocan — útil para entradas ad-hoc fuera del Excel.
- El job emite `ImportRun` con `rowsTotal/rowsOk/rowsErr/fileHash` para trazabilidad y dedupe (importar el mismo archivo dos veces se detecta por hash).
- Audit log queda con `action=EXCEL_IMPORT` enlazado al `ImportRun.id`.

# Snapshot DB + restore

Procedimiento de snapshot pre-import / pre-migración. Obligatorio antes de:

- ejecutar `pnpm import:excel -- --replace`
- correr `prisma migrate deploy` con cambios destructivos
- rotar `KEK_BASE64` (los blobs cifrados quedan ilegibles si la rotación falla a medias)

## Snapshot

```bash
ssh deploy@45.55.214.153
cd /opt/datos
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f infra/docker-compose.yml --env-file .env exec -T db \
  pg_dump -U datos -Fc -d datos > "backups/datos-${TS}.dump"
sha256sum "backups/datos-${TS}.dump" > "backups/datos-${TS}.dump.sha256"
```

Cifrar antes de subir:

```bash
age -r "$(cat /opt/datos/secrets/backup.age.pub)" \
  -o "backups/datos-${TS}.dump.age" "backups/datos-${TS}.dump"
rclone copy "backups/datos-${TS}.dump.age" r2:datos-backups/
```

Retención: 30 días. Backups locales sin cifrar se borran tras la subida.

## Verificación

```bash
ls -lh backups/ | tail
sha256sum -c "backups/datos-${TS}.dump.sha256"
```

## Restore

```bash
docker compose -f infra/docker-compose.yml --env-file .env stop api web
docker compose -f infra/docker-compose.yml --env-file .env exec -T db \
  pg_restore -U datos -d datos --clean --if-exists < "backups/datos-${TS}.dump"
docker compose -f infra/docker-compose.yml --env-file .env start api web
curl -fsS -H 'Host: datos.nicoholas.dev' http://127.0.0.1/api/health
```

Tras restore: verificar audit chain.

```bash
curl -fsS https://datos.nicoholas.dev/api/audit/verify -H "Cookie: $SESSION"
```

## Automatización diaria

Ver `infra/backup.sh` (ya en cron). Este documento describe snapshots ad-hoc adicionales.

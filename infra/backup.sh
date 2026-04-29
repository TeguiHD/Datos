#!/usr/bin/env bash
# Backup Postgres + Caddy volumes, cifrado con age, sube a S3/R2.
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/tmp/datos-backup-$TS.sql.gz.age"

docker compose -f /opt/datos/infra/docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip | age -r "$AGE_RECIPIENT" > "$OUT"

aws --endpoint-url "$S3_ENDPOINT" s3 cp "$OUT" "s3://$S3_BUCKET/datos/$TS.sql.gz.age"
rm -f "$OUT"
echo "[backup] $TS uploaded"

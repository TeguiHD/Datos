#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-.env}"
DOMAIN="${2:-datos.nicoholas.dev}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[error] env file not found: $ENV_FILE"
  echo "[hint] cp infra/.env.example .env"
  exit 1
fi

ENV_ABS="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export APP_DOMAIN="${APP_DOMAIN:-$DOMAIN}"
export DATOS_ENV_FILE="$ENV_ABS"

APP_DOMAIN="$APP_DOMAIN" DATOS_ENV_FILE="$DATOS_ENV_FILE" ./infra/check-env.sh "$ENV_FILE"

compose() {
  docker compose -f infra/docker-compose.yml --env-file "$ENV_FILE" "$@"
}

echo "[1/7] Pull/build and start data services"
compose up -d --build postgres redis

echo "[2/7] Prepare evidence volume"
compose run --rm evidence-init

echo "[3/7] Start app services"
compose up -d --build api web
compose build ops

echo "[4/7] Apply Prisma migrations"
compose run --rm --user root ops sh -lc 'node_modules/.bin/prisma migrate deploy'

echo "[5/7] Ensure bootstrap superadmins exist"
missing_admins=$(compose run --rm --user root ops node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); const emails=[process.env.SEED_SUPERADMIN_EMAIL, process.env.SEED_SUPERADMIN_EMAIL_2].map((e)=>String(e||'').trim().toLowerCase()); (async()=>{const users=await p.user.findMany({where:{email:{in:emails}},select:{email:true}}); const found=new Set(users.map((u)=>u.email.toLowerCase())); const missing=emails.filter((e)=>e && !found.has(e)); console.log(missing.join(','));})().catch((e)=>{console.error(e); process.exit(1);}).finally(()=>p.\$disconnect());" | tr -d '\r')
if [[ -n "$missing_admins" ]]; then
  compose run --rm --user root ops sh -lc 'node_modules/.bin/tsx prisma/seed.ts'
  echo "[info] seed executed (created missing: $missing_admins)"
else
  echo "[info] bootstrap superadmins already present, skipping seed"
fi

echo "[6/7] Start edge proxy"
compose up -d --build caddy

echo "[7/7] Status + health checks"
compose ps

if curl -fsS --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/api/health >/tmp/datos-health.json; then
  echo "[ok] local edge health check passed"
  cat /tmp/datos-health.json
else
  echo "[warn] local edge health check failed. Check: docker compose logs caddy api --tail=100"
fi

root_status=$(curl -sS -o /tmp/datos-root.html -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/ || true)
if [[ "$root_status" =~ ^[23][0-9][0-9]$ ]]; then
  echo "[ok] local web route check passed (status=$root_status)"
elif [[ "$root_status" =~ ^30[1278]$ ]]; then
  echo "[ok] local web route redirects as expected (status=$root_status)"
else
  echo "[warn] local web route check unexpected status=$root_status. Check: docker compose logs caddy web --tail=100"
fi

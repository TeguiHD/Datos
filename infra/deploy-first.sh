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

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  NODE_ENV
  PORT
  WEB_ORIGIN
  NEXT_PUBLIC_API_URL
  JWT_SECRET
  COOKIE_SECRET
  CSRF_SECRET
  PASSWORD_PEPPER
  KEK_BASE64
  CLOUDFLARE_API_TOKEN
  ACME_EMAIL
  SEED_SUPERADMIN_EMAIL
  SEED_SUPERADMIN_PASSWORD
  SEED_SUPERADMIN_EMAIL_2
  SEED_SUPERADMIN_PASSWORD_2
)

placeholder_patterns=(
  "replace-with"
  "change-me"
  "CHANGE-THIS"
  "example.com"
)

for key in "${required_vars[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "[error] missing required env var: $key"
    exit 1
  fi
  for pat in "${placeholder_patterns[@]}"; do
    if [[ "$value" == *"$pat"* ]]; then
      echo "[error] env var looks like placeholder: $key"
      exit 1
    fi
  done
done

if [[ "${SEED_SUPERADMIN_EMAIL,,}" == "${SEED_SUPERADMIN_EMAIL_2,,}" ]]; then
  echo "[error] superadmin emails must be different"
  exit 1
fi

if [[ "${#JWT_SECRET}" -lt 32 ]]; then
  echo "[error] JWT_SECRET too short (< 32 chars)"
  exit 1
fi
if [[ "${#COOKIE_SECRET}" -lt 32 ]]; then
  echo "[error] COOKIE_SECRET too short (< 32 chars)"
  exit 1
fi
if [[ "${#CSRF_SECRET}" -lt 32 ]]; then
  echo "[error] CSRF_SECRET too short (< 32 chars)"
  exit 1
fi
if [[ "${#PASSWORD_PEPPER}" -lt 32 ]]; then
  echo "[error] PASSWORD_PEPPER too short (< 32 chars)"
  exit 1
fi

if ! decoded_kek_len=$(printf '%s' "$KEK_BASE64" | base64 -d 2>/dev/null | wc -c | tr -d ' '); then
  echo "[error] KEK_BASE64 is not valid base64"
  exit 1
fi
if [[ "$decoded_kek_len" != "32" ]]; then
  echo "[error] KEK_BASE64 must decode to exactly 32 bytes"
  exit 1
fi

compose() {
  docker compose -f infra/docker-compose.yml --env-file "$ENV_FILE" "$@"
}

echo "[1/6] Pull/build and start data services"
compose up -d --build postgres redis

echo "[2/6] Start app services"
compose up -d --build api web
compose build ops

echo "[3/6] Apply Prisma migrations"
compose run --rm --user root ops sh -lc 'node_modules/.bin/prisma migrate deploy'

echo "[4/6] Ensure bootstrap superadmins exist"
missing_admins=$(compose run --rm --user root ops node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); const emails=[process.env.SEED_SUPERADMIN_EMAIL, process.env.SEED_SUPERADMIN_EMAIL_2].map((e)=>String(e||'').trim().toLowerCase()); (async()=>{const users=await p.user.findMany({where:{email:{in:emails}},select:{email:true}}); const found=new Set(users.map((u)=>u.email.toLowerCase())); const missing=emails.filter((e)=>e && !found.has(e)); console.log(missing.join(','));})().catch((e)=>{console.error(e); process.exit(1);}).finally(()=>p.\$disconnect());" | tr -d '\r')
if [[ -n "$missing_admins" ]]; then
  compose run --rm --user root ops sh -lc 'node_modules/.bin/tsx prisma/seed.ts'
  echo "[info] seed executed (created missing: $missing_admins)"
else
  echo "[info] bootstrap superadmins already present, skipping seed"
fi

echo "[5/6] Start edge proxy"
compose up -d --build caddy

echo "[6/6] Status + health checks"
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

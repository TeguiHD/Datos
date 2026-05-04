#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

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
  APP_DOMAIN
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  REDIS_URL
  NODE_ENV
  PORT
  WEB_ORIGIN
  NEXT_PUBLIC_API_URL
  TRUST_PROXY
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

errors=0

error() {
  echo "[error] $*"
  errors=$((errors + 1))
}

warn() {
  echo "[warn] $*"
}

for key in "${required_vars[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    error "missing required env var: $key"
    continue
  fi
  for pat in "${placeholder_patterns[@]}"; do
    if [[ "$value" == *"$pat"* ]]; then
      error "env var looks like placeholder: $key"
      break
    fi
  done
done

if [[ "${SEED_SUPERADMIN_EMAIL:-}" && "${SEED_SUPERADMIN_EMAIL_2:-}" ]]; then
  if [[ "${SEED_SUPERADMIN_EMAIL,,}" == "${SEED_SUPERADMIN_EMAIL_2,,}" ]]; then
    error "superadmin emails must be different"
  fi
fi

if [[ "${JWT_SECRET:-}" && "${#JWT_SECRET}" -lt 32 ]]; then
  error "JWT_SECRET too short (< 32 chars)"
fi
if [[ "${COOKIE_SECRET:-}" && "${#COOKIE_SECRET}" -lt 32 ]]; then
  error "COOKIE_SECRET too short (< 32 chars)"
fi
if [[ "${CSRF_SECRET:-}" && "${#CSRF_SECRET}" -lt 32 ]]; then
  error "CSRF_SECRET too short (< 32 chars)"
fi
if [[ "${PASSWORD_PEPPER:-}" && "${#PASSWORD_PEPPER}" -lt 32 ]]; then
  error "PASSWORD_PEPPER too short (< 32 chars)"
fi

if [[ "${KEK_BASE64:-}" ]]; then
  if ! decoded_kek_len=$(printf '%s' "$KEK_BASE64" | base64 -d 2>/dev/null | wc -c | tr -d ' '); then
    error "KEK_BASE64 is not valid base64"
  elif [[ "$decoded_kek_len" != "32" ]]; then
    error "KEK_BASE64 must decode to exactly 32 bytes"
  fi
fi

if [[ "${WEB_ORIGIN:-}" && "${NEXT_PUBLIC_API_URL:-}" && "$WEB_ORIGIN" != "$NEXT_PUBLIC_API_URL" ]]; then
  warn "WEB_ORIGIN and NEXT_PUBLIC_API_URL differ; this is valid only if API and web use different public origins"
fi

for optional_secret in NVIDIA_API_KEY GROQ_API_KEY OPENROUTER_API_KEY; do
  if [[ -z "${!optional_secret:-}" ]]; then
    warn "$optional_secret is empty; IA provider fallback may skip it"
  fi
done

for backup_var in AGE_RECIPIENT S3_ENDPOINT S3_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!backup_var:-}" ]]; then
    warn "$backup_var is empty; infra/backup.sh is not ready"
  fi
done

if [[ "$errors" -gt 0 ]]; then
  echo "[fail] $ENV_FILE is not production-ready ($errors issue/s)"
  exit 1
fi

echo "[ok] $ENV_FILE is production-ready for deploy checks"

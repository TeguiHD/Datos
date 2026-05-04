#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="${1:-.env}"
APP_DOMAIN="${APP_DOMAIN:-datos.nicoholas.dev}"
ACME_EMAIL="${ACME_EMAIL:-admin@${APP_DOMAIN}}"
POSTGRES_USER="${POSTGRES_USER:-datos}"
POSTGRES_DB="${POSTGRES_DB:-datos}"
SEED_SUPERADMIN_EMAIL="${SEED_SUPERADMIN_EMAIL:-}"
SEED_SUPERADMIN_EMAIL_2="${SEED_SUPERADMIN_EMAIL_2:-}"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "[error] set CLOUDFLARE_API_TOKEN in the shell before running this script"
  exit 1
fi
if [[ -z "$SEED_SUPERADMIN_EMAIL" || -z "$SEED_SUPERADMIN_EMAIL_2" ]]; then
  echo "[error] set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_EMAIL_2 before running this script"
  exit 1
fi
if [[ "${SEED_SUPERADMIN_EMAIL,,}" == "${SEED_SUPERADMIN_EMAIL_2,,}" ]]; then
  echo "[error] superadmin emails must be different"
  exit 1
fi
if [[ -e "$OUT_FILE" && "${FORCE:-0}" != "1" ]]; then
  echo "[error] $OUT_FILE already exists. Set FORCE=1 to overwrite"
  exit 1
fi

rand_b64() {
  openssl rand -base64 32
}

rand_password() {
  openssl rand -base64 36 | tr -d '\n'
}

POSTGRES_PASSWORD="$(rand_password)"
SEED_SUPERADMIN_PASSWORD="${SEED_SUPERADMIN_PASSWORD:-$(rand_password)}"
SEED_SUPERADMIN_PASSWORD_2="${SEED_SUPERADMIN_PASSWORD_2:-$(rand_password)}"

umask 077
cat > "$OUT_FILE" <<EOF
# --- Postgres ---
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB
DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB?schema=public

# --- Redis ---
REDIS_URL=redis://redis:6379

# --- API ---
NODE_ENV=production
PORT=4000
APP_DOMAIN=$APP_DOMAIN
WEB_ORIGIN=https://$APP_DOMAIN
TRUST_PROXY=1

# --- Secrets ---
JWT_SECRET=$(rand_b64)
COOKIE_SECRET=$(rand_b64)
CSRF_SECRET=$(rand_b64)
PASSWORD_PEPPER=$(rand_b64)
KEK_BASE64=$(rand_b64)
LOG_LEVEL=info

# --- Mantencion ---
MAINT_HORIZON_YEARS=20

# --- Seed first boot ---
SEED_SUPERADMIN_EMAIL=$SEED_SUPERADMIN_EMAIL
SEED_SUPERADMIN_PASSWORD=$SEED_SUPERADMIN_PASSWORD
SEED_SUPERADMIN_EMAIL_2=$SEED_SUPERADMIN_EMAIL_2
SEED_SUPERADMIN_PASSWORD_2=$SEED_SUPERADMIN_PASSWORD_2

# --- IA busqueda ---
AI_PROVIDER=${AI_PROVIDER:-}
AI_MODEL=${AI_MODEL:-}
AI_PROVIDER_ORDER=${AI_PROVIDER_ORDER:-nvidia,groq,openrouter}
AI_MODELS_NVIDIA=${AI_MODELS_NVIDIA:-z-ai/glm-5.1,deepseek-ai/deepseek-v4-pro,z-ai/glm4.7,minimaxai/minimax-m2.7,mistralai/mistral-medium-3.5-128b}
AI_MODELS_GROQ=${AI_MODELS_GROQ:-openai/gpt-oss-120b}
AI_MODELS_OPENROUTER=${AI_MODELS_OPENROUTER:-z-ai/glm-4.5-air:free,openai/gpt-oss-120b:free}
NVIDIA_API_KEY=${NVIDIA_API_KEY:-}
GROQ_API_KEY=${GROQ_API_KEY:-}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}

# --- Web ---
NEXT_PUBLIC_API_URL=https://$APP_DOMAIN

# --- Cloudflare ---
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN
ACME_EMAIL=$ACME_EMAIL

# --- Backups opcionales a S3/R2 ---
AGE_RECIPIENT=${AGE_RECIPIENT:-}
S3_ENDPOINT=${S3_ENDPOINT:-}
S3_BUCKET=${S3_BUCKET:-}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
EOF

chmod 600 "$OUT_FILE"
echo "[ok] wrote $OUT_FILE with mode 600"
echo "[next] ./infra/check-env.sh $OUT_FILE"

#!/usr/bin/env bash
# Rota secretos críticos: COOKIE_SECRET, CSRF_SECRET, PASSWORD_PEPPER, KEK_BASE64,
# JWT_SECRET, REPORT_SIGNING_KEY. Genera valores fuertes y los escribe a un .env.new
# que el operador debe revisar antes de reemplazar el .env activo.
#
# Tras rotar y reiniciar la API, todas las sesiones JWT/refresh quedan invalidadas
# y los TOTP secrets re-cifrados deben ser regenerados por usuario (re-enroll).
#
# Uso:
#   ./infra/rotate-secrets.sh /opt/datos/.env
#
# Comportamiento:
#   - lee el .env actual; preserva todo lo que no esté en la lista de rotación
#   - genera nuevas claves y produce <env>.new
#   - imprime instrucciones de despliegue
#
# Requiere: openssl, awk

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE no existe" >&2
  exit 1
fi

ROTATE_KEYS=(
  COOKIE_SECRET
  CSRF_SECRET
  PASSWORD_PEPPER
  JWT_SECRET
  KEK_BASE64
  REPORT_SIGNING_KEY
)

gen_hex64()    { openssl rand -hex 32; }
gen_b64_32()   { openssl rand -base64 32 | tr -d '\n'; }

declare -A NEW
NEW[COOKIE_SECRET]="$(gen_hex64)"
NEW[CSRF_SECRET]="$(gen_hex64)"
NEW[PASSWORD_PEPPER]="$(gen_hex64)"
NEW[JWT_SECRET]="$(gen_hex64)"
NEW[KEK_BASE64]="$(gen_b64_32)"
NEW[REPORT_SIGNING_KEY]="$(gen_hex64)"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

awk -v keys="${ROTATE_KEYS[*]}" '
  BEGIN { split(keys, arr, " "); for (k in arr) rk[arr[k]] = 1 }
  /^[A-Z_][A-Z0-9_]*=/ {
    split($0, kv, "=")
    if (kv[1] in rk) next
  }
  { print }
' "$ENV_FILE" > "$TMP"

{
  cat "$TMP"
  echo ""
  echo "# rotated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for k in "${ROTATE_KEYS[@]}"; do
    printf '%s=%s\n' "$k" "${NEW[$k]}"
  done
} > "${ENV_FILE}.new"

chmod 600 "${ENV_FILE}.new"

cat <<EOF
Rotación generada en: ${ENV_FILE}.new (modo 600)

Próximos pasos:
  1. Revisar ${ENV_FILE}.new (diff contra ${ENV_FILE}).
  2. mv ${ENV_FILE} ${ENV_FILE}.bak.\$(date +%s)
  3. mv ${ENV_FILE}.new ${ENV_FILE}
  4. docker compose -f infra/docker-compose.yml --env-file ${ENV_FILE} up -d --force-recreate api
  5. Revocar todas las sesiones activas (refresh tokens) — el cambio de JWT_SECRET ya las invalida.
  6. Los usuarios con 2FA habilitado deben re-enrolar TOTP (KEK rotada → backup codes y secretos previos quedan ilegibles).
  7. Anotar la rotación en audit log manualmente:
     docker compose exec api node -e "require('./dist/src/audit/cli').recordRotation()" || true

Claves rotadas: ${ROTATE_KEYS[*]}
EOF

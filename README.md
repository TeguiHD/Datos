# datos.nicoholas.dev

Dashboard de planificación de mantenimiento preventivo (SAP PM). Reemplazo a medida de Power BI con CRUD, filtros mensuales, cronograma dinámico multi-año, auditoría inmutable, 2FA TOTP obligatorio.

## Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind + shadcn/ui + TanStack Query
- **Backend**: NestJS 10 + Prisma + Zod
- **DB**: PostgreSQL 16 + Redis 7
- **Infra**: Docker Compose + Caddy 2 + Cloudflare

## Desarrollo local

```bash
pnpm install
cp infra/.env.example .env
docker compose -f infra/docker-compose.dev.yml up -d     # postgres(5433) + redis(6380)
export DATABASE_URL='postgresql://datos:datos@localhost:5433/datos?schema=public'
export PASSWORD_PEPPER='dev-pepper-change-me'
export CSRF_SECRET='dev-csrf-secret-change-me'
export TRUST_PROXY=1
export SEED_SUPERADMIN_EMAIL='bernardojesus008@gmail.com'
export SEED_SUPERADMIN_PASSWORD='change-me'
export SEED_SUPERADMIN_EMAIL_2='nikoholas.lopetegui@gmail.com'
export SEED_SUPERADMIN_PASSWORD_2='change-me-2'
pnpm --filter @datos/api prisma migrate dev
pnpm --filter @datos/api db:seed
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:4000

## Importar Excel

```bash
pnpm import:excel -- --file "./EXCEL DATOS.xlsx"
```

## Seguridad

Ver [docs/SECURITY.md](docs/SECURITY.md). Checklist OWASP/NIST/CISA/MITRE aplicado. 2FA TOTP obligatorio, Argon2id + pepper, JWT HS256, CSRF double-submit, CSP con nonce, audit log hash-chained.

## Deploy

```bash
ssh deploy@45.55.214.153
cd /opt/datos
git pull
APP_DOMAIN=datos.nicoholas.dev \
ACME_EMAIL=admin@datos.nicoholas.dev \
CLOUDFLARE_API_TOKEN='paste-rotated-cloudflare-token-here' \
SEED_SUPERADMIN_EMAIL='admin1@example.com' \
SEED_SUPERADMIN_EMAIL_2='admin2@example.com' \
./infra/generate-prod-env.sh .env
./infra/check-env.sh .env
./infra/deploy-first.sh .env datos.nicoholas.dev
```

Post-checks:

```bash
docker compose -f infra/docker-compose.yml --env-file .env ps
curl -fsS -H 'Host: datos.nicoholas.dev' http://127.0.0.1/api/health
curl -I https://datos.nicoholas.dev
```

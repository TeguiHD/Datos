# Seguridad — datos.nicoholas.dev

Alineado a OWASP ASVS v4.0.3, NIST SP 800-63B (auth), CISA SCuBA, MITRE ATT&CK (abril 2026).

## Autenticación

- **Hashing**: Argon2id, memoryCost=64 MiB, timeCost=3, parallelism=4; pepper desde `PASSWORD_PEPPER` (variable de entorno, nunca en DB).
- **2FA**: TOTP obligatorio (RFC 6238, SHA-1, 6 dígitos, 30s, ventana ±1). Secreto TOTP cifrado AES-256-GCM con KEK en `KEK_BASE64`.
- **Backup codes**: 10 por usuario, hasheados con Argon2id. Consumo único.
- **Lockout progresivo**: 5 fallos→15m, 10→1h, 20→lock duro (requiere `POST /users/:id/unlock`).
- **Sesiones**: Access JWT HS256 TTL 15m; refresh token rotativo 7d con detección de reuse (revoca familia entera). Cookies `HttpOnly; Secure; SameSite=Strict`.
- **CSRF**: Doble submit cookie (`csrf-csrf`) para métodos mutantes cuando existe cookie de sesión. Header requerido `x-csrf-token`; endpoint de bootstrap `GET /api/auth/csrf`.

## Transporte

- Cloudflare DNS + proxy. Origin protegido por token Caddy DNS-01 (Let's Encrypt).
- Token Cloudflare con mínimo privilegio: limitar a la zona objetivo y scopes DNS:Edit + Zone:Read.
- TLS 1.3, HSTS `max-age=63072000; includeSubDomains; preload`.
- CSP con nonce por request (middleware Next.js), `default-src 'self'`, sin `unsafe-inline` en producción.
- Headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictiva.
- `trust proxy` explícito en API (`TRUST_PROXY`) para evitar confiar headers de cliente no-proxy.

## Inyección / input

- Prisma → queries parametrizadas.
- `class-validator` + `ValidationPipe({ whitelist, forbidNonWhitelisted })`.
- DOMPurify server-side para comentarios.
- Upload Excel: extensión + magic bytes (PK ZIP) + límite 10 MB + single-file.

## Rate limiting

- Global: 100 req/min/IP (throttler).
- `/auth/login`: 5/min.
- `/auth/totp/verify`: 8/min.

## Audit log

- Append-only con hash-chain SHA-256 (`prevHash || payload → hash`), `GET /api/audit/verify` valida la cadena.
- Acciones: LOGIN_OK/FAIL, ACCOUNT_LOCKED, REFRESH_REUSE_DETECTED, PASSWORD_CHANGED, USER_CREATE/ROLE_CHANGE/UNLOCK, TASK_CREATE/UPDATE/DELETE, SCHEDULE_UPSERT, EXCEL_IMPORT.

## Datos en reposo

- Postgres volume en disco VPS (recomendado LUKS).
- TOTP secret + backup codes cifrados AES-256-GCM.
- Backups diarios cifrados con `age`, subidos a Cloudflare R2 (`infra/backup.sh`), retención 30d.

## Red / VPS

- SSH en puerto no-estándar, solo keys, `PermitRootLogin no`.
- UFW/firewalld: 22-alt/80/443.
- fail2ban + unattended-upgrades.
- Docker: `no-new-privileges`, `read_only` donde aplique, `cap_drop: ALL` en API.

## MITRE ATT&CK (cobertura explícita)

| Técnica | Mitigación |
|---------|-----------|
| T1110 Brute Force | Lockout progresivo + 2FA + rate-limit /login |
| T1078 Valid Accounts | Audit log + detección de refresh reuse + lastLoginIp |
| T1190 Exploit Public App | WAF Cloudflare + CSP nonce + deps escaneadas en CI + CodeQL |
| T1505.003 Web Shell | API container `read_only` + cap_drop + no exec upload |
| T1555 Credentials from Stores | Secrets en env (rotables), no en repo |
| T1040 Network Sniffing | TLS 1.3 only + HSTS preload |
| T1565.001 Stored Data Manipulation | Audit log hash-chained + verify endpoint |

## Rotación obligatoria

Antes del primer deploy, **rotar**:
1. Token Cloudflare expuesto en `idea.txt`
2. Password SSH root del VPS
3. Password inicial de `bernardojesus008@gmail.com`
4. Password inicial de `nikoholas.lopetegui@gmail.com`
5. `OPENROUTER_API_KEY` (si fue compartida fuera de un vault)
6. `GROQ_API_KEY` (si fue compartida fuera de un vault)
7. `NVIDIA_API_KEY` (si fue compartida fuera de un vault)
8. Cualquier credencial publicada en chats, tickets o documentos no cifrados

Generar secrets:
```bash
openssl rand -base64 32  # JWT_SECRET, COOKIE_SECRET, CSRF_SECRET, PASSWORD_PEPPER, KEK_BASE64
```

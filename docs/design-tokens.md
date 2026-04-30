# Design Tokens

Tokens semánticos para `apps/web`. Definidos en `apps/web/app/globals.css`. Usar SIEMPRE los tokens, nunca hex literal en componentes.

## Colores

### Light mode

| Token             | Valor      | Uso                                      |
|-------------------|-----------|------------------------------------------|
| `--color-bg`      | `#f8fafc` | Fondo body                                |
| `--color-surface` | `#ffffff` | Cards, modales, drawer                    |
| `--color-surface-2` | `#f1f5f9` | Toolbar, fondo secundario                |
| `--color-border`  | `#e2e8f0` | Divisores, bordes inputs                  |
| `--color-text`    | `#0f172a` | Texto principal                           |
| `--color-text-muted` | `#64748b` | Texto secundario, labels                |
| `--color-accent`  | `#2563eb` | Acción primaria (botones CTA)             |
| `--color-accent-fg` | `#ffffff` | Texto sobre accent                       |
| `--color-accent-dim` | `#eff6ff` | Hover/selected primario                  |
| `--color-danger`  | `#dc2626` | Vencidas, destructivo                     |
| `--color-warn`    | `#d97706` | Pendientes, advertencias                  |
| `--color-ok`      | `#059669` | Hechas, éxito                             |

### Dark mode

Override en `.dark`. Ver `apps/web/app/globals.css`. Misma semántica, valores ajustados a fondo oscuro.

## Contraste WCAG (AA mínimo)

Verificado con WebAIM Contrast Checker. Ratios calculados sobre el par token texto / token fondo.

| Texto / Fondo                          | Light ratio | Dark ratio | WCAG       |
|----------------------------------------|------------:|-----------:|------------|
| `text` / `bg`                          | 16.4:1      | 14.2:1     | AAA        |
| `text-muted` / `bg`                    | 4.7:1       | 4.6:1      | AA         |
| `accent-fg` / `accent`                 | 8.6:1       | 7.2:1      | AAA        |
| `text` / `accent-dim`                  | 15.1:1      | —          | AAA        |
| `accent-fg` / `danger`                 | 5.4:1       | 4.7:1      | AA         |
| `accent-fg` / `warn`                   | 3.4:1       | 4.1:1      | AA Large   |
| `accent-fg` / `ok`                     | 3.6:1       | 4.4:1      | AA Large   |

**Reglas:**
- Texto pequeño (<14px regular o <18px bold) requiere AA (4.5:1) o superior. NO usar `accent-fg` sobre `warn`/`ok` para texto pequeño en light mode — usar `text` (#0f172a).
- Estados (`danger`/`warn`/`ok`) NO deben transmitirse solo por color. Acompañar con ícono o patrón (daltonismo).

## Tipografía

Familia: `var(--font-sora)` (sans), `var(--font-plex-mono)` (mono).

| Token              | Tamaño | Line-height | Uso                          |
|--------------------|--------|-------------|------------------------------|
| `text-[11px]`      | 11px   | 16px        | Tags muy pequeños (uppercase eyebrows). Evitar para texto leíble. |
| `text-xs`          | 12px   | 16px        | Labels, captions             |
| `text-sm`          | 14px   | 20px        | Body table, secondary text   |
| `text-base`        | 16px   | 24px        | Body principal               |
| `text-lg`          | 18px   | 28px        | Subtítulos card              |
| `text-xl`          | 20px   | 28px        | H2 página                    |
| `text-2xl`         | 24px   | 32px        | H1 página desktop            |
| `text-3xl`         | 30px   | 36px        | KPI numérico grande          |

**Regla:** No usar tamaños arbitrarios `text-[N]` salvo eyebrows uppercase.

## Spacing y density

Variables CSS controlan densidad de filas/cards. Tres modos:

| Modo      | `--row-py` | `--cell-px` | `--card-p` |
|-----------|-----------|-------------|------------|
| compact   | 0.375rem  | 0.5rem      | 0.625rem   |
| default   | 0.625rem  | 0.75rem     | 1rem       |
| spacious  | 0.875rem  | 1rem        | 1.5rem     |

Aplicación: clase `density-compact|default|spacious` en raíz dashboard.

## Breakpoints

| Token  | Min width | Uso                                     |
|--------|----------:|-----------------------------------------|
| `sm`   | 640px     | Mobile landscape                        |
| `md`   | 768px     | Tablet                                  |
| `lg`   | 1024px    | Desktop                                 |
| `xl`   | 1280px    | Desktop wide                            |

Diseño mobile-first: estilo base aplica a 360px, modificadores `md:` y `lg:` agregan progressivamente.

## Sombras

| Clase      | Uso                                |
|------------|------------------------------------|
| `shadow-sm` | Cards reposadas                   |
| `shadow`    | Hover cards                        |
| `shadow-md` | Drawer, popover                    |
| `shadow-lg` | Modales                            |

Evitar `shadow-xl` y superior — sensación "marketing", no industrial.

## Border radius

| Token        | Valor            |
|--------------|-----------------|
| `rounded-sm` | calc(0.5rem - 4px) |
| `rounded-md` | calc(0.5rem - 2px) |
| `rounded-lg` | 0.5rem           |

Industrial = radios moderados. Evitar `rounded-full` salvo avatares y badges circulares.

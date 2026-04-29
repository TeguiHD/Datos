# SP1 — Design system + visual rebrand

**Fecha:** 2026-04-29  
**Proyecto:** datos.nicoholas.dev  
**Alcance:** Sub-proyecto 1 de 5 — solo capa visual, sin tocar lógica de negocio, autenticación, NestJS, Prisma ni queries TanStack.

---

## Contexto

Dashboard SAP PM actualmente desplegado en `datos.nicoholas.dev`. Stack: Next.js 16 + Tailwind + shadcn/ui (referenciado pero no configurado) + TanStack Query + Recharts. El diseño actual usa slate plano sin jerarquía visual, sidebar fijo sin colapso, sin dark mode, sin density toggle. El objetivo es un rediseño total de la capa visual manteniendo toda la funcionalidad.

---

## Decisiones clave

| Decisión | Valor |
|---|---|
| Tema | Dual mode: light (default) + dark, toggle en topbar |
| Acento | Azul industrial — `#2563eb` light / `#3b82f6` dark |
| Densidad | Comfortable (default) + compact, toggle en topbar |
| Sidebar | Secciones colapsables, colapso total a 64px iconos |
| Layout | Topbar sticky 52px + sidebar 240px/64px + content area |
| Enfoque | Enfoque C: shadcn primitivos + design tokens custom encima |
| Fuentes | Sora (UI) + IBM Plex Mono (datos numéricos) — sin cambio |

---

## 1. Design tokens

### CSS variables en `globals.css`

```css
:root {
  /* Superficies */
  --color-bg:         #f8fafc;
  --color-surface:    #ffffff;
  --color-surface-2:  #f1f5f9;
  --color-border:     #e2e8f0;

  /* Texto */
  --color-text:       #0f172a;
  --color-text-muted: #64748b;

  /* Acento azul industrial */
  --color-accent:     #2563eb;
  --color-accent-fg:  #ffffff;
  --color-accent-dim: #eff6ff;

  /* Semánticos */
  --color-danger:     #dc2626;
  --color-danger-dim: #fef2f2;
  --color-warn:       #d97706;
  --color-warn-dim:   #fffbeb;
  --color-ok:         #059669;
  --color-ok-dim:     #f0fdf4;

  /* Density */
  --row-py:   0.625rem;
  --cell-px:  0.75rem;
  --card-p:   1rem;
}

.dark {
  --color-bg:         #0d1117;
  --color-surface:    #161b22;
  --color-surface-2:  #1c2128;
  --color-border:     #30363d;
  --color-text:       #e6edf3;
  --color-text-muted: #8b949e;
  --color-accent:     #3b82f6;
  --color-accent-fg:  #ffffff;
  --color-accent-dim: #1e3a8a;
  --color-danger:     #f87171;
  --color-danger-dim: #450a0a;
  --color-warn:       #fbbf24;
  --color-warn-dim:   #451a03;
  --color-ok:         #34d399;
  --color-ok-dim:     #064e3b;
}

[data-density="compact"] {
  --row-py:  0.375rem;
  --cell-px: 0.5rem;
  --card-p:  0.625rem;
}
```

### Tailwind config

Extender `tailwind.config.ts` para mapear las CSS variables a clases utilitarias:

```ts
colors: {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  surface2:'var(--color-surface-2)',
  border:  'var(--color-border)',
  text:    'var(--color-text)',
  muted:   'var(--color-text-muted)',
  accent:  'var(--color-accent)',
  'accent-fg':  'var(--color-accent-fg)',
  'accent-dim': 'var(--color-accent-dim)',
  danger:  'var(--color-danger)',
  'danger-dim': 'var(--color-danger-dim)',
  warn:    'var(--color-warn)',
  'warn-dim':   'var(--color-warn-dim)',
  ok:      'var(--color-ok)',
  'ok-dim':     'var(--color-ok-dim)',
}
```

---

## 2. Theming: dark mode + density

### Dark mode

- Paquete: `next-themes` (`ThemeProvider` wrapping `<body>`)
- `attribute="class"` — alterna clase `.dark` en `<html>`
- `defaultTheme="light"`, `enableSystem={false}`
- `suppressHydrationWarning` en `<html>` para evitar flash
- Toggle en topbar: ícono Sun/Moon (Lucide), switch animado

### Density toggle

- Atributo `data-density` en `<html>` via `useEffect` + `localStorage`
- Hook `useDensity()` expone `density` y `setDensity`
- Toggle en topbar: ícono Rows (Lucide)
- Todas las tablas y cards usan `py-[--row-py]` y `px-[--cell-px]` (Tailwind arbitrary values)

---

## 3. Layout shell

### Estructura de archivos nuevos/modificados

```
apps/web/
├── app/
│   ├── layout.tsx                    ← añade ThemeProvider, DensityProvider
│   ├── globals.css                   ← design tokens completos
│   └── (dashboard)/
│       ├── layout.tsx                ← nueva shell completa
│       └── _components/
│           ├── Topbar.tsx            ← nuevo
│           ├── Sidebar.tsx           ← reemplaza sidebar inline actual
│           ├── SidebarNav.tsx        ← secciones colapsables
│           ├── SidebarSection.tsx    ← Radix Collapsible wrapper
│           ├── NavItem.tsx           ← item individual con tooltip en modo colapsado
│           ├── UserMenu.tsx          ← avatar + dropdown
│           ├── ThemeToggle.tsx       ← Sun/Moon switch
│           └── DensityToggle.tsx     ← Rows toggle
└── lib/
    ├── hooks/
    │   ├── useDensity.ts             ← nuevo
    │   └── useSidebarCollapsed.ts    ← nuevo
    └── providers/
        └── DensityProvider.tsx       ← nuevo
```

### Topbar (52px sticky, `z-50`)

```
[☰ mobile] [breadcrumb dinámico]    [⌘K placeholder]    [sync●] [density] [theme] [avatar▾]
```

- Breadcrumb: derivado de `usePathname()`, mapa de rutas a labels en español
- Sync indicator: punto verde parpadeante si hay refetch activo (TanStack `isFetching`)
- Avatar menu (Radix DropdownMenu): nombre, email, rol, separador, "Cerrar sesión"

### Sidebar (240px expanded, 64px collapsed)

Secciones con Radix `Collapsible`:

| Sección | Rutas |
|---|---|
| PLANIFICACIÓN | Resumen, Tareas, Cronograma |
| ANÁLISIS | Analytics (SP3), Gráficos IA (SP3+SP4) |
| GESTIÓN | Importación (SP5), Admin |
| SISTEMA | Auditoría, Usuarios |

- Estado colapso total persistido en `localStorage` via `useSidebarCollapsed`
- Modo colapsado: solo iconos 20px + Radix `Tooltip` al hover con el label
- Botón toggle `⟨/⟩` al top del sidebar
- Active state: fondo `accent-dim`, texto `accent`, borde izquierdo 2px `accent`
- Mobile: Radix `Sheet` abre desde izquierda, mismo `SidebarNav` inside

### Content area

```
<main className="min-h-screen flex-1 bg-bg overflow-auto">
  <div className="mx-auto max-w-screen-2xl px-6 py-5">
    {children}
  </div>
</main>
```

---

## 4. Componentes rediseñados

### KPI Card

```
┌─────────────────────────────┐
│ ← 4px accent border-left   │
│                             │
│ TÍTULO CARD          Δ+12% │
│ 1,234                ▁▃▅▇  │  ← sparkline 12m (recharts tiny)
└─────────────────────────────┘
```

- Border-left 4px con color semántico (accent/warn/danger/ok/neutral)
- Delta badge: `+X%` verde o `-X%` rojo vs mes anterior
- Sparkline: `<LineChart>` mínimo 12 puntos, `height=32`, sin ejes, sin tooltip, `strokeWidth=1.5`
- Hover: `translateY(-2px)` + `shadow-md`

### StatusBadge (reemplaza StatusPill)

```tsx
const STATUS_MAP = {
  PENDING: { label: 'Pendiente', variant: 'warn' },
  OVERDUE: { label: 'Vencida',   variant: 'danger' },
  DONE:    { label: 'Hecha',     variant: 'ok' },
  SKIPPED: { label: 'Omitida',   variant: 'neutral' },
}
```

shadcn `Badge` con variantes mapeadas a CSS variables semánticas.

### ChartPanel

```
┌──────────────────────────────────────────────┐
│ Título              Subtítulo         [⛶][⋯] │  ← fullscreen + menu
│──────────────────────────────────────────────│
│                                              │
│              [chart content]                 │
│                                              │
└──────────────────────────────────────────────┘
```

- Menú `[⋯]`: "Exportar PNG", "Ver datos tabla"
- Fullscreen: Dialog de Radix que ocupa 95vw × 90vh con el mismo chart escalado
- Skeleton shimmer mientras carga (reemplaza skeleton actual)

### ExecutionTable

- Sticky header con `bg-surface-2`
- Columnas fijas: Periodo, ABC, Tarea (truncate + tooltip), PSR, Frec, Centro, HH plan, HH real, Estado, Acciones
- Acciones en Radix `DropdownMenu` por fila: "Marcar hecha", "Omitir", "Ver detalle"
- Row highlight: `hover:bg-accent-dim/40`
- Paginación: componente `Pagination` con pages visibles (1 … 4 5 6 … 12)

### FilterBar

- Chips visuales de filtros activos debajo del panel de filtros
- Cada chip: `[label: valor ×]` para limpiar individualmente
- "Limpiar todo" si hay 2+ chips activos

---

## 5. Rutas nuevas (scaffolded vacías en SP1)

| Ruta | Módulo futuro |
|---|---|
| `/dashboard/analytics` | SP3: Charts avanzados |
| `/dashboard/graficos` | SP3+SP4: Gráficos IA |
| `/dashboard/importacion` | SP5: Import/Export pro |
| `/dashboard/auditoria` | Nueva UI sobre lógica existente |

Cada ruta retorna un placeholder `<ComingSoon label="Analytics" />` hasta su SP.

---

## 6. Archivos a crear / modificar

### Crear (nuevos)

- `apps/web/lib/hooks/useDensity.ts`
- `apps/web/lib/hooks/useSidebarCollapsed.ts`
- `apps/web/lib/providers/DensityProvider.tsx`
- `apps/web/app/(dashboard)/_components/Topbar.tsx`
- `apps/web/app/(dashboard)/_components/Sidebar.tsx`
- `apps/web/app/(dashboard)/_components/SidebarNav.tsx`
- `apps/web/app/(dashboard)/_components/SidebarSection.tsx`
- `apps/web/app/(dashboard)/_components/NavItem.tsx`
- `apps/web/app/(dashboard)/_components/UserMenu.tsx`
- `apps/web/app/(dashboard)/_components/ThemeToggle.tsx`
- `apps/web/app/(dashboard)/_components/DensityToggle.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/KpiCard.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/StatusBadge.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/ChartPanel.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/Pagination.tsx`
- `apps/web/app/(dashboard)/dashboard/_components/FilterChips.tsx`
- `apps/web/app/(dashboard)/dashboard/analytics/page.tsx` (placeholder)
- `apps/web/app/(dashboard)/dashboard/graficos/page.tsx` (placeholder)
- `apps/web/app/(dashboard)/dashboard/importacion/page.tsx` (placeholder)
- `apps/web/app/(dashboard)/dashboard/auditoria/page.tsx`

### Modificar (sin tocar lógica)

- `apps/web/app/layout.tsx` — ThemeProvider + DensityProvider wrapping
- `apps/web/app/globals.css` — design tokens completos
- `apps/web/tailwind.config.ts` — colores semánticos via CSS vars
- `apps/web/app/(dashboard)/layout.tsx` — nueva shell (Topbar + Sidebar)
- `apps/web/app/(dashboard)/dashboard/page.tsx` — usar KpiCard, ChartPanel, StatusBadge, Pagination, FilterChips
- `apps/web/app/(dashboard)/dashboard/tareas/page.tsx` — StatusBadge + DropdownMenu actions
- `apps/web/app/(dashboard)/dashboard/cronograma/page.tsx` — tokens semánticos

### Dependencias a instalar

```bash
pnpm --filter @datos/web add next-themes
pnpm dlx shadcn@latest init  # en apps/web — seleccionar CSS variables
pnpm dlx shadcn@latest add button badge card input select dialog sheet collapsible tooltip dropdown-menu skeleton separator command
```

---

## 7. Restricciones

- No modificar ningún archivo en `apps/api/`
- No modificar `packages/shared-types/`
- No cambiar rutas de API ni contratos de TanStack Query
- No tocar lógica de autenticación / 2FA
- No modificar `infra/` ni `docker-compose`
- Todos los colores nuevos deben usar CSS variables — prohibido hardcodear hex en JSX

---

## 8. Criterios de éxito

- [ ] Light/dark toggle funcional, sin flash al cargar
- [ ] Density toggle funcional en tabla principal (comfortable vs compact)
- [ ] Sidebar colapsa a iconos con tooltips accesibles
- [ ] Sidebar mobile funciona como Sheet
- [ ] KPI cards muestran sparkline + delta
- [ ] ChartPanels tienen fullscreen y menú export PNG
- [ ] ExecutionTable usa DropdownMenu para acciones
- [ ] FilterChips muestran filtros activos con opción de limpiar
- [ ] Todas las rutas placeholder `/analytics`, `/graficos`, `/importacion`, `/auditoria` resuelven sin error
- [ ] `pnpm build` sin errores TypeScript
- [ ] Contraste WCAG AA en ambos temas (verificar con herramienta)

---

## Sub-proyectos siguientes (referencia)

| SP | Tema |
|---|---|
| SP2 | Búsqueda avanzada: Cmd+K palette, faceted search, URL state |
| SP3 | Charts avanzados: heatmap, treemap, drill-down, sparklines en tabla |
| SP4 | IA expandida: insights narrativos, anomaly detection, planificador semanal, hilos |
| SP5 | Import/Export pro: plantilla, dry-run, diff preview, column mapper |

# SP1 — Design System + Visual Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseño visual completo de datos.nicoholas.dev — design tokens semánticos, dark/light mode, density toggle, sidebar seccional colapsable, topbar sticky, y componentes KpiCard / ChartPanel / StatusBadge / ExecutionTable / FilterChips / Pagination rediseñados — sin tocar lógica de negocio, autenticación ni API.

**Architecture:** Enfoque C — shadcn/ui como capa de primitivos accesibles, CSS variables semánticas encima para identidad visual, `next-themes` para dark mode. Migración no destructiva: se reemplaza capa visual archivo a archivo sin cambiar queries TanStack ni contratos de API.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v3, shadcn/ui, Radix UI, next-themes, Lucide React, Recharts (existente)

**Estado 2026-04-29:** plan histórico ejecutado y superado. Las secciones de tareas mantienen el registro original de implementación; el estado final autoritativo está en los addendums de cierre al final del documento.

---

## File Map

### Crear (nuevos)

```
apps/web/lib/
  hooks/useDensity.ts                                   ← density state + localStorage
  hooks/useSidebarCollapsed.ts                          ← sidebar collapse state + localStorage
  providers/DensityProvider.tsx                         ← context provider para density
  utils/cn.ts                                           ← clsx + tailwind-merge helper

apps/web/app/(dashboard)/_components/
  Topbar.tsx                                            ← topbar sticky 52px
  ThemeToggle.tsx                                       ← Sun/Moon toggle
  DensityToggle.tsx                                     ← Rows2/Rows3 toggle
  UserMenu.tsx                                          ← avatar dropdown
  Sidebar.tsx                                           ← sidebar shell + mobile sheet
  SidebarNav.tsx                                        ← árbol de navegación completo
  SidebarSection.tsx                                    ← sección colapsable Radix
  NavItem.tsx                                           ← ítem individual con tooltip

apps/web/app/(dashboard)/dashboard/_components/
  KpiCard.tsx                                           ← card con sparkline + delta
  StatusBadge.tsx                                       ← badge semántico de estado
  ChartPanel.tsx                                        ← panel con fullscreen + export
  FilterChips.tsx                                       ← chips de filtros activos
  Pagination.tsx                                        ← paginación con páginas visibles
  ComingSoon.tsx                                        ← eliminado tras reemplazar placeholders por pantallas reales

apps/web/app/(dashboard)/dashboard/
  analytics/page.tsx                                    ← implementado: forecast, heatmap, treemap, anomalías
  graficos/page.tsx                                     ← implementado: IA gráfica + insight narrativo persistente
  importacion/page.tsx                                  ← implementado: plantilla, dry-run, diff preview, mapper
  auditoria/page.tsx                                    ← implementado: auditoría hash-chain
```

### Modificar (sin cambiar lógica)

```
apps/web/app/layout.tsx                                 ← añade ThemeProvider + DensityProvider
apps/web/app/globals.css                                ← design tokens semánticos completos
apps/web/tailwind.config.ts                             ← colores semánticos via CSS vars
apps/web/app/(dashboard)/layout.tsx                     ← nueva shell Topbar + Sidebar
apps/web/app/(dashboard)/dashboard/page.tsx             ← usa nuevos componentes
apps/web/app/(dashboard)/dashboard/tareas/page.tsx      ← StatusBadge + DropdownMenu actions
```

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Instalar next-themes**

```bash
cd /home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas
pnpm --filter @datos/web add next-themes
```

Expected output: `+ next-themes X.X.X`

- [ ] **Step 2: Inicializar shadcn/ui con CSS variables**

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

Cuando pregunte:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**
- Tailwind config path: `tailwind.config.ts`
- Components path: `@/components`
- Utils path: `@/lib/utils`
- RSC: **Yes**

- [ ] **Step 3: Instalar componentes shadcn necesarios**

```bash
pnpm dlx shadcn@latest add button badge card input select dialog sheet collapsible tooltip dropdown-menu skeleton separator command
```

Expected: crea `apps/web/components/ui/` con los archivos de cada componente.

- [ ] **Step 4: Verificar instalación**

```bash
cd /home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas
pnpm --filter @datos/web typecheck
```

Expected: sin errores de tipos (puede haber warnings si shadcn generó `lib/utils.ts` que colisiona — se resuelve en Task 2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components apps/web/lib/utils.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): install next-themes and shadcn/ui with CSS variables"
```

---

## Task 2: cn utility + design tokens (globals.css + tailwind.config.ts)

**Files:**
- Create: `apps/web/lib/utils/cn.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Crear cn utility**

Si shadcn ya creó `apps/web/lib/utils.ts`, renómbralo:

```bash
mv apps/web/lib/utils.ts apps/web/lib/utils/cn.ts 2>/dev/null || true
```

Crear/reemplazar `apps/web/lib/utils/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Actualizar todos los imports de `@/lib/utils` en `components/ui/` para que apunten a `@/lib/utils/cn`:

```bash
find apps/web/components/ui -name "*.tsx" -exec sed -i 's|@/lib/utils|@/lib/utils/cn|g' {} \;
```

- [ ] **Step 2: Reemplazar globals.css completo**

Reemplazar el contenido de `apps/web/app/globals.css` con lo siguiente (mantiene todas las animaciones existentes, añade sistema de tokens semánticos y dark mode):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Design tokens semánticos ─────────────────────────────────────── */
:root {
  /* Superficies */
  --color-bg:          #f8fafc;
  --color-surface:     #ffffff;
  --color-surface-2:   #f1f5f9;
  --color-border:      #e2e8f0;

  /* Texto */
  --color-text:        #0f172a;
  --color-text-muted:  #64748b;

  /* Acento azul industrial */
  --color-accent:      #2563eb;
  --color-accent-fg:   #ffffff;
  --color-accent-dim:  #eff6ff;

  /* Semánticos */
  --color-danger:      #dc2626;
  --color-danger-dim:  #fef2f2;
  --color-warn:        #d97706;
  --color-warn-dim:    #fffbeb;
  --color-ok:          #059669;
  --color-ok-dim:      #f0fdf4;

  /* Density */
  --row-py:   0.625rem;
  --cell-px:  0.75rem;
  --card-p:   1rem;

  /* shadcn compat (mapear a nuestro sistema) */
  --background:        240 100% 99%;
  --foreground:        222 47% 11%;
  --card:              0 0% 100%;
  --card-foreground:   222 47% 11%;
  --popover:           0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary:           221 83% 53%;
  --primary-foreground: 0 0% 100%;
  --secondary:         214 32% 91%;
  --secondary-foreground: 222 47% 11%;
  --muted:             214 32% 91%;
  --muted-foreground:  215 16% 47%;
  --accent:            214 32% 91%;
  --accent-foreground: 222 47% 11%;
  --destructive:       0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border:            214 32% 91%;
  --input:             214 32% 91%;
  --ring:              221 83% 53%;
  --radius:            0.5rem;
}

.dark {
  /* Superficies */
  --color-bg:          #0d1117;
  --color-surface:     #161b22;
  --color-surface-2:   #1c2128;
  --color-border:      #30363d;

  /* Texto */
  --color-text:        #e6edf3;
  --color-text-muted:  #8b949e;

  /* Acento */
  --color-accent:      #3b82f6;
  --color-accent-fg:   #ffffff;
  --color-accent-dim:  #1e3a8a;

  /* Semánticos */
  --color-danger:      #f87171;
  --color-danger-dim:  #450a0a;
  --color-warn:        #fbbf24;
  --color-warn-dim:    #451a03;
  --color-ok:          #34d399;
  --color-ok-dim:      #064e3b;

  /* shadcn compat dark */
  --background:        222 47% 5%;
  --foreground:        210 40% 92%;
  --card:              217 33% 9%;
  --card-foreground:   210 40% 92%;
  --popover:           217 33% 9%;
  --popover-foreground: 210 40% 92%;
  --primary:           217 91% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary:         217 33% 15%;
  --secondary-foreground: 210 40% 92%;
  --muted:             217 33% 15%;
  --muted-foreground:  215 20% 56%;
  --accent:            217 33% 15%;
  --accent-foreground: 210 40% 92%;
  --destructive:       0 63% 56%;
  --destructive-foreground: 0 0% 100%;
  --border:            217 33% 18%;
  --input:             217 33% 18%;
  --ring:              217 91% 60%;
}

[data-density="compact"] {
  --row-py:  0.375rem;
  --cell-px: 0.5rem;
  --card-p:  0.625rem;
}

/* ── Base ─────────────────────────────────────────────────────────── */
html, body { min-height: 100%; }

body {
  color: var(--color-text);
  background-color: var(--color-bg);
  font-family: var(--font-sora), 'Trebuchet MS', 'Segoe UI', sans-serif;
  transition: background-color 0.2s ease, color 0.2s ease;
}

* { border-color: var(--color-border); }

/* Grid de fondo sutil — solo light mode */
body:not(.dark body)::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.15;
  background-image:
    linear-gradient(to right, rgba(27, 71, 117, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(27, 71, 117, 0.08) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: radial-gradient(circle at center, black 35%, transparent 90%);
  z-index: -1;
}

/* ── Utilidades de componentes ────────────────────────────────────── */
.mono {
  font-family: var(--font-plex-mono), 'Courier New', monospace;
}

.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(140%) blur(14px);
  -webkit-backdrop-filter: saturate(140%) blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.dark .glass {
  background: rgba(22, 27, 34, 0.82);
  border: 1px solid rgba(48, 54, 61, 0.6);
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 8px 40px -25px rgba(3, 35, 69, 0.2);
}

.dark .panel {
  box-shadow: 0 8px 40px -25px rgba(0, 0, 0, 0.5);
}

.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--color-surface-2);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.dark .skeleton::after {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 999px;
}
.custom-scrollbar { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }

/* ── Animaciones ──────────────────────────────────────────────────── */
.fade-up  { animation: fade-up  320ms ease-out both; }
.fade-in  { animation: fade-in  260ms ease-out both; }
.slide-in-right { animation: slide-in-right 360ms cubic-bezier(0.22, 1, 0.36, 1) both; }

.typing-dots::after {
  content: '…';
  display: inline-block;
  animation: typing-dots 1.4s steps(3, end) infinite;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes skeleton-shimmer {
  100% { transform: translateX(100%); }
}
@keyframes typing-dots {
  0%   { content: ''; }
  33%  { content: '·'; }
  66%  { content: '··'; }
  100% { content: '···'; }
}
@keyframes pulse-ring {
  0%   { transform: scale(0.85); opacity: 0.65; }
  80%  { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}

.pulse-ring { position: relative; }
.pulse-ring::before, .pulse-ring::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid currentColor;
  opacity: 0;
  animation: pulse-ring 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  pointer-events: none;
}
.pulse-ring::after { animation-delay: 0.9s; }

@media (prefers-reduced-motion: reduce) {
  .fade-up, .fade-in, .slide-in-right, .skeleton::after,
  .pulse-ring::before, .pulse-ring::after { animation: none !important; }
}
```

- [ ] **Step 3: Actualizar tailwind.config.ts**

Reemplazar `apps/web/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Tokens semánticos propios */
        bg:           'var(--color-bg)',
        surface:      'var(--color-surface)',
        'surface-2':  'var(--color-surface-2)',
        text:         'var(--color-text)',
        muted:        'var(--color-text-muted)',
        'ds-accent':  'var(--color-accent)',
        'accent-fg':  'var(--color-accent-fg)',
        'accent-dim': 'var(--color-accent-dim)',
        danger:       'var(--color-danger)',
        'danger-dim': 'var(--color-danger-dim)',
        warn:         'var(--color-warn)',
        'warn-dim':   'var(--color-warn-dim)',
        ok:           'var(--color-ok)',
        'ok-dim':     'var(--color-ok-dim)',
        /* shadcn HSL tokens */
        border:       'hsl(var(--border))',
        input:        'hsl(var(--input))',
        ring:         'hsl(var(--ring))',
        background:   'hsl(var(--background))',
        foreground:   'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        /* brand legacy (mantener compat con código no migrado) */
        brand: {
          50:  '#eef7ff',
          500: '#2563eb',
          600: '#1d4ed8',
          900: '#0b2a6e',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sora)', 'Trebuchet MS', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

- [ ] **Step 4: Instalar tailwindcss-animate (requerido por shadcn)**

```bash
pnpm --filter @datos/web add -D tailwindcss-animate
```

- [ ] **Step 5: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/tailwind.config.ts apps/web/lib/utils/ apps/web/components/ui/ pnpm-lock.yaml
git commit -m "feat(web): design tokens, dark mode CSS variables, tailwind semantic colors"
```

---

## Task 3: ThemeProvider (dark mode)

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Actualizar root layout con ThemeProvider**

Reemplazar `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Sora } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'datos.nicoholas.dev',
  description: 'Planificación de mantenimiento preventivo',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} ${plexMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="datos-theme"
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): add next-themes ThemeProvider for dark/light mode"
```

---

## Task 4: Density system (hook + provider)

**Files:**
- Create: `apps/web/lib/hooks/useDensity.ts`
- Create: `apps/web/lib/providers/DensityProvider.tsx`

- [ ] **Step 1: Crear hook useDensity**

Crear `apps/web/lib/hooks/useDensity.ts`:

```ts
'use client';

import { useContext } from 'react';
import { DensityContext } from '@/lib/providers/DensityProvider';

export type Density = 'comfortable' | 'compact';

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
}
```

- [ ] **Step 2: Crear DensityProvider**

Crear `apps/web/lib/providers/DensityProvider.tsx`:

```tsx
'use client';

import { createContext, useEffect, useState } from 'react';
import type { Density } from '@/lib/hooks/useDensity';

interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  toggle: () => void;
}

export const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    const stored = localStorage.getItem('datos-density') as Density | null;
    if (stored === 'comfortable' || stored === 'compact') {
      setDensityState(stored);
      document.documentElement.setAttribute('data-density', stored);
    }
  }, []);

  const setDensity = (d: Density) => {
    setDensityState(d);
    localStorage.setItem('datos-density', d);
    document.documentElement.setAttribute('data-density', d);
  };

  const toggle = () => setDensity(density === 'comfortable' ? 'compact' : 'comfortable');

  return (
    <DensityContext.Provider value={{ density, setDensity, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}
```

- [ ] **Step 3: Añadir DensityProvider al root layout**

Modificar `apps/web/app/layout.tsx` — añadir import y wrapping:

```tsx
import { DensityProvider } from '@/lib/providers/DensityProvider';

// dentro del return, dentro de ThemeProvider:
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="datos-theme">
  <DensityProvider>
    <QueryProvider>{children}</QueryProvider>
  </DensityProvider>
</ThemeProvider>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/hooks/useDensity.ts apps/web/lib/providers/DensityProvider.tsx apps/web/app/layout.tsx
git commit -m "feat(web): density system — comfortable/compact toggle with localStorage"
```

---

## Task 5: useSidebarCollapsed hook

**Files:**
- Create: `apps/web/lib/hooks/useSidebarCollapsed.ts`

- [ ] **Step 1: Crear hook**

Crear `apps/web/lib/hooks/useSidebarCollapsed.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('datos-sidebar-collapsed');
    if (stored === 'true') setCollapsedState(true);
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem('datos-sidebar-collapsed', String(v));
  };

  const toggle = () => setCollapsed(!collapsed);

  return { collapsed, toggle, setCollapsed };
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/hooks/useSidebarCollapsed.ts
git commit -m "feat(web): useSidebarCollapsed hook with localStorage"
```

---

## Task 6: NavItem y SidebarSection

**Files:**
- Create: `apps/web/app/(dashboard)/_components/NavItem.tsx`
- Create: `apps/web/app/(dashboard)/_components/SidebarSection.tsx`

- [ ] **Step 1: Crear NavItem**

Crear `apps/web/app/(dashboard)/_components/NavItem.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
  exactMatch?: boolean;
}

export function NavItem({ href, label, icon: Icon, collapsed, exactMatch }: NavItemProps) {
  const pathname = usePathname();
  const isActive = exactMatch ? pathname === href : pathname.startsWith(href);

  const item = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent-dim hover:text-ds-accent',
        isActive
          ? 'bg-accent-dim text-ds-accent border-l-2 border-ds-accent pl-[10px]'
          : 'text-text-muted border-l-2 border-transparent',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (!collapsed) return item;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Crear SidebarSection**

Crear `apps/web/app/(dashboard)/_components/SidebarSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';

interface SidebarSectionProps {
  label: string;
  collapsed?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SidebarSection({
  label,
  collapsed,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        <Separator className="my-2" />
        {children}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors">
        {label}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components/NavItem.tsx apps/web/app/\(dashboard\)/_components/SidebarSection.tsx
git commit -m "feat(web): NavItem and SidebarSection components"
```

---

## Task 7: SidebarNav + ThemeToggle + DensityToggle + UserMenu

**Files:**
- Create: `apps/web/app/(dashboard)/_components/SidebarNav.tsx`
- Create: `apps/web/app/(dashboard)/_components/ThemeToggle.tsx`
- Create: `apps/web/app/(dashboard)/_components/DensityToggle.tsx`
- Create: `apps/web/app/(dashboard)/_components/UserMenu.tsx`

- [ ] **Step 1: Crear ThemeToggle**

Crear `apps/web/app/(dashboard)/_components/ThemeToggle.tsx`:

```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Crear DensityToggle**

Crear `apps/web/app/(dashboard)/_components/DensityToggle.tsx`:

```tsx
'use client';

import { Rows2, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDensity } from '@/lib/hooks/useDensity';

export function DensityToggle() {
  const { density, toggle } = useDensity();
  const isCompact = density === 'compact';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggle}
            aria-label={isCompact ? 'Densidad cómoda' : 'Densidad compacta'}
          >
            {isCompact ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isCompact ? 'Vista cómoda' : 'Vista compacta'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 3: Crear UserMenu**

Crear `apps/web/app/(dashboard)/_components/UserMenu.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

interface UserMenuProps {
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Visualizador',
};

export function UserMenu({ email, role }: UserMenuProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
      router.replace('/login');
    },
  });

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          aria-label="Menú de usuario"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-accent text-accent-fg text-xs font-semibold">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs font-semibold truncate">{email}</p>
          <p className="text-xs text-muted mt-0.5">{ROLE_LABELS[role] ?? role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-danger focus:text-danger focus:bg-danger-dim cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Crear SidebarNav**

Crear `apps/web/app/(dashboard)/_components/SidebarNav.tsx`:

```tsx
import {
  BarChart3,
  BrainCircuit,
  Calendar,
  FileUp,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import { NavItem } from './NavItem';
import { SidebarSection } from './SidebarSection';

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed }: SidebarNavProps) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto py-2 custom-scrollbar">
      <SidebarSection label="Planificación" collapsed={collapsed}>
        <NavItem href="/dashboard" label="Resumen" icon={LayoutDashboard} collapsed={collapsed} exactMatch />
        <NavItem href="/dashboard/tareas" label="Tareas" icon={ListTodo} collapsed={collapsed} />
        <NavItem href="/dashboard/cronograma" label="Cronograma" icon={Calendar} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Análisis" collapsed={collapsed}>
        <NavItem href="/dashboard/analytics" label="Analytics" icon={BarChart3} collapsed={collapsed} />
        <NavItem href="/dashboard/graficos" label="Gráficos IA" icon={BrainCircuit} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Gestión" collapsed={collapsed}>
        <NavItem href="/dashboard/importacion" label="Importación" icon={FileUp} collapsed={collapsed} />
        <NavItem href="/dashboard/admin" label="Admin" icon={Settings} collapsed={collapsed} />
      </SidebarSection>

      <SidebarSection label="Sistema" collapsed={collapsed}>
        <NavItem href="/dashboard/auditoria" label="Auditoría" icon={ScrollText} collapsed={collapsed} />
        <NavItem href="/dashboard/admin/usuarios" label="Usuarios" icon={Users} collapsed={collapsed} />
      </SidebarSection>
    </nav>
  );
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components/
git commit -m "feat(web): ThemeToggle, DensityToggle, UserMenu, SidebarNav components"
```

---

## Task 8: Topbar + Sidebar shell

**Files:**
- Create: `apps/web/app/(dashboard)/_components/Topbar.tsx`
- Create: `apps/web/app/(dashboard)/_components/Sidebar.tsx`

- [ ] **Step 1: Crear Topbar**

Crear `apps/web/app/(dashboard)/_components/Topbar.tsx`:

```tsx
'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { DensityToggle } from './DensityToggle';
import { UserMenu } from './UserMenu';
import { cn } from '@/lib/utils/cn';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard':             'Resumen',
  '/dashboard/tareas':      'Tareas',
  '/dashboard/cronograma':  'Cronograma',
  '/dashboard/analytics':   'Analytics',
  '/dashboard/graficos':    'Gráficos IA',
  '/dashboard/importacion': 'Importación',
  '/dashboard/admin':       'Admin',
  '/dashboard/auditoria':   'Auditoría',
};

interface TopbarProps {
  email: string;
  role: string;
  onMenuClick?: () => void;
}

export function Topbar({ email, role, onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const crumb = BREADCRUMB_MAP[pathname] ?? 'Dashboard';

  return (
    <header className={cn(
      'sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-[var(--color-border)]',
      'bg-[var(--color-surface)]/90 backdrop-blur-sm px-4',
    )}>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted leading-none">
          SAP PM
        </p>
        <h1 className="text-sm font-semibold text-text truncate">{crumb}</h1>
      </div>

      {/* ⌘K placeholder — implementado en SP2 */}
      <button
        type="button"
        className={cn(
          'hidden md:flex items-center gap-2 rounded-md border border-[var(--color-border)]',
          'bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-muted',
          'hover:border-ds-accent hover:text-text transition-colors',
        )}
        aria-label="Búsqueda rápida (próximamente)"
        disabled
      >
        <span>Buscar…</span>
        <kbd className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </button>

      {/* Controles */}
      <div className="flex items-center gap-1">
        <DensityToggle />
        <ThemeToggle />
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Crear Sidebar**

Crear `apps/web/app/(dashboard)/_components/Sidebar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SidebarNav } from './SidebarNav';
import { useSidebarCollapsed } from '@/lib/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils/cn';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-col border-r border-[var(--color-border)]',
          'bg-[var(--color-surface)] transition-all duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex h-[52px] shrink-0 items-center border-b border-[var(--color-border)] px-4',
          collapsed && 'justify-center px-2',
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ds-accent text-accent-fg text-sm font-bold shadow-sm">
              d.
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted leading-none">Panel</p>
                <p className="text-sm font-semibold text-text truncate">datos.nicoholas</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <SidebarNav collapsed={collapsed} />

        {/* Collapse toggle */}
        <div className={cn(
          'flex shrink-0 border-t border-[var(--color-border)] p-2',
          collapsed ? 'justify-center' : 'justify-end',
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted hover:text-text"
            onClick={toggle}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </Button>
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={(v) => !v && onMobileClose()}>
        <SheetContent side="left" className="w-60 p-0 bg-[var(--color-surface)]">
          <div className="flex h-[52px] items-center border-b border-[var(--color-border)] px-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-grid h-8 w-8 place-items-center rounded-lg bg-ds-accent text-accent-fg text-sm font-bold">
                d.
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted leading-none">Panel</p>
                <p className="text-sm font-semibold text-text">datos.nicoholas</p>
              </div>
            </div>
          </div>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components/Topbar.tsx apps/web/app/\(dashboard\)/_components/Sidebar.tsx
git commit -m "feat(web): Topbar and Sidebar shell with collapsible and mobile sheet"
```

---

## Task 9: Nueva dashboard layout shell

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Reemplazar layout con nueva shell**

Reemplazar la sección del `return` en `apps/web/app/(dashboard)/layout.tsx`. El archivo completo queda así (mantiene toda la lógica de auth/2FA existente, solo reemplaza el JSX del layout):

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { FloatingAiChat } from './_components/FloatingAiChat';
import { Topbar } from './_components/Topbar';
import { Sidebar } from './_components/Sidebar';

interface MeResponse {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  mustChangePass: boolean;
  lastLoginAt: string | null;
  tfa: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      router.replace('/login');
      return;
    }
    if (!me.data || me.data.tfa) return;
    const target = me.data.totpEnabled ? '/verify-2fa' : '/setup-2fa';
    if (pathname !== target) router.replace(target);
  }, [me.data, me.error, pathname, router]);

  // Cerrar mobile sidebar al navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (me.isLoading) {
    return <GateState title="Validando sesión" detail="Comprobando autenticación y segundo factor." />;
  }
  if (me.error) {
    return <GateState title="Sesión no disponible" detail="Redirigiendo a inicio de sesión." tone="error" />;
  }
  if (me.data && !me.data.tfa) {
    return (
      <GateState
        title="Segundo factor requerido"
        detail={me.data.totpEnabled ? 'Redirigiendo a verificación 2FA.' : 'Redirigiendo a configuración inicial 2FA.'}
      />
    );
  }
  if (me.data?.mustChangePass) {
    return <MustChangePasswordGate email={me.data.email} />;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          email={me.data?.email ?? ''}
          role={me.data?.role ?? ''}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
            {children}
          </div>
        </main>
      </div>
      <FloatingAiChat />
    </div>
  );
}
```

> **Nota:** Mantener todas las funciones auxiliares existentes del archivo (`GateState`, `MustChangePasswordGate`, `Nav`, etc.) — solo reemplaza el `return` del componente principal y añade el estado `mobileOpen`.

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): new dashboard shell — Topbar + Sidebar replacing inline layout"
```

---

## Task 10: StatusBadge

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/StatusBadge.tsx`

- [ ] **Step 1: Crear StatusBadge**

Crear `apps/web/app/(dashboard)/dashboard/_components/StatusBadge.tsx`:

```tsx
import { cn } from '@/lib/utils/cn';
import type { ExecStatus } from '@/lib/types';

const STATUS_CONFIG: Record<ExecStatus, { label: string; classes: string }> = {
  PENDING: {
    label: 'Pendiente',
    classes: 'bg-warn-dim text-warn border-warn/30',
  },
  OVERDUE: {
    label: 'Vencida',
    classes: 'bg-danger-dim text-danger border-danger/30',
  },
  DONE: {
    label: 'Hecha',
    classes: 'bg-ok-dim text-ok border-ok/30',
  },
  SKIPPED: {
    label: 'Omitida',
    classes: 'bg-[var(--color-surface-2)] text-muted border-[var(--color-border)]',
  },
};

export function StatusBadge({ status }: { status: ExecStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        cfg.classes,
      )}
    >
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/StatusBadge.tsx
git commit -m "feat(web): StatusBadge with semantic color tokens"
```

---

## Task 11: KpiCard con sparkline + delta

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/KpiCard.tsx`

- [ ] **Step 1: Crear KpiCard**

Crear `apps/web/app/(dashboard)/dashboard/_components/KpiCard.tsx`:

```tsx
'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils/cn';

type Tone = 'danger' | 'warn' | 'ok' | 'accent' | 'neutral';

const TONE_CLASSES: Record<Tone, { border: string; value: string }> = {
  danger:  { border: 'border-l-danger',    value: 'text-danger' },
  warn:    { border: 'border-l-warn',      value: 'text-warn' },
  ok:      { border: 'border-l-ok',        value: 'text-ok' },
  accent:  { border: 'border-l-ds-accent', value: 'text-ds-accent' },
  neutral: { border: 'border-l-[var(--color-border)]', value: 'text-text' },
};

interface KpiCardProps {
  title: string;
  value: number | string;
  tone?: Tone;
  loading?: boolean;
  delta?: number;
  sparkline?: number[];
}

export function KpiCard({ title, value, tone = 'neutral', loading, delta, sparkline }: KpiCardProps) {
  const tc = TONE_CLASSES[tone];
  const sparkData = (sparkline ?? []).map((v, i) => ({ i, v }));

  const deltaSign = delta !== undefined && delta > 0 ? '+' : '';
  const deltaColor = delta === undefined ? '' : delta > 0 ? 'text-ok' : delta < 0 ? 'text-danger' : 'text-muted';

  return (
    <div
      className={cn(
        'relative rounded-xl border-l-4 border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        'min-w-[140px] shrink-0 sm:min-w-0 sm:shrink',
        tc.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted leading-none">{title}</p>
        {delta !== undefined && !loading && (
          <span className={cn('text-[10px] font-semibold tabular-nums', deltaColor)}>
            {deltaSign}{delta.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={cn('text-2xl font-semibold tabular-nums', tc.value)}>
          {loading
            ? <span className="skeleton inline-block h-8 w-16 rounded-md" />
            : value
          }
        </div>

        {sparkData.length > 0 && !loading && (
          <div className="h-8 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={`var(--color-${tone === 'neutral' ? 'text-muted' : tone === 'accent' ? 'accent' : tone})`}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/KpiCard.tsx
git commit -m "feat(web): KpiCard with sparkline, delta badge and semantic border"
```

---

## Task 12: ChartPanel con fullscreen + export PNG

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/ChartPanel.tsx`

- [ ] **Step 1: Crear ChartPanel**

Crear `apps/web/app/(dashboard)/dashboard/_components/ChartPanel.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { Expand, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ChartPanel({ title, subtitle, loading, children, className }: ChartPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    if (!contentRef.current) return;
    const { default: html2canvas } = await import('html2canvas').catch(() => ({ default: null }));
    if (!html2canvas) {
      alert('Instala html2canvas para exportar: pnpm --filter @datos/web add html2canvas');
      return;
    }
    const canvas = await html2canvas(contentRef.current, { backgroundColor: null });
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const header = (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted hover:text-text"
          onClick={() => setFullscreen(true)}
          aria-label="Pantalla completa"
        >
          <Expand className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted hover:text-text"
              aria-label="Opciones del gráfico"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportPng}>Exportar PNG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
          className,
        )}
        ref={contentRef}
      >
        {header}
        {loading
          ? <div className="skeleton h-[260px] w-full rounded-lg" />
          : children
        }
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/ChartPanel.tsx
git commit -m "feat(web): ChartPanel with fullscreen dialog and PNG export menu"
```

---

## Task 13: FilterChips + Pagination + ComingSoon

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/_components/FilterChips.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/_components/Pagination.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/_components/ComingSoon.tsx`

- [ ] **Step 1: Crear FilterChips**

Crear `apps/web/app/(dashboard)/dashboard/_components/FilterChips.tsx`:

```tsx
'use client';

import { X } from 'lucide-react';

interface Chip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: Chip[];
  onClearAll?: () => void;
}

export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-text"
        >
          <span className="text-muted">{chip.label}:</span>
          <span className="font-medium">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded text-muted hover:text-danger transition-colors"
            aria-label={`Quitar filtro ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length >= 2 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted hover:text-danger underline underline-offset-2 transition-colors"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear Pagination**

Crear `apps/web/app/(dashboard)/dashboard/_components/Pagination.tsx`:

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface PaginationProps {
  page: number;
  take: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, take, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / take));
  const firstRow = total === 0 ? 0 : page * take + 1;
  const lastRow = Math.min((page + 1) * take, total);
  const canPrev = page > 0;
  const canNext = (page + 1) * take < total;

  const pages = buildPageList(page, totalPages);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
      <span className="text-xs text-muted">
        {total === 0 ? 'Sin resultados' : `${firstRow}–${lastRow} de ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!canPrev}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className={cn('h-7 w-7 text-xs', p === page && 'bg-ds-accent text-accent-fg hover:bg-ds-accent/90')}
              onClick={() => onPage(p as number)}
            >
              {(p as number) + 1}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const result: (number | '…')[] = [];
  const add = (n: number) => { if (!result.includes(n)) result.push(n); };
  add(0);
  if (current > 2) result.push('…');
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) add(i);
  if (current < total - 3) result.push('…');
  add(total - 1);
  return result;
}
```

- [ ] **Step 3: Crear ComingSoon**

Crear `apps/web/app/(dashboard)/dashboard/_components/ComingSoon.tsx`:

```tsx
import { Construction } from 'lucide-react';

export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center fade-up">
      <Construction className="h-12 w-12 text-muted" />
      <div>
        <h2 className="text-lg font-semibold text-text">{label}</h2>
        <p className="text-sm text-muted mt-1">En desarrollo — disponible próximamente.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/_components/FilterChips.tsx \
        apps/web/app/\(dashboard\)/dashboard/_components/Pagination.tsx \
        apps/web/app/\(dashboard\)/dashboard/_components/ComingSoon.tsx
git commit -m "feat(web): FilterChips, Pagination, ComingSoon components"
```

---

## Task 14: Placeholder routes (SP2-SP5)

**Files:**
- Create: `apps/web/app/(dashboard)/dashboard/analytics/page.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/graficos/page.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/importacion/page.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/auditoria/page.tsx`

- [ ] **Step 1: Crear rutas placeholder**

Crear `apps/web/app/(dashboard)/dashboard/analytics/page.tsx`:
```tsx
import { ComingSoon } from '../_components/ComingSoon';
export default function AnalyticsPage() { return <ComingSoon label="Analytics avanzado" />; }
```

Crear `apps/web/app/(dashboard)/dashboard/graficos/page.tsx`:
```tsx
import { ComingSoon } from '../_components/ComingSoon';
export default function GraficosPage() { return <ComingSoon label="Gráficos IA" />; }
```

Crear `apps/web/app/(dashboard)/dashboard/importacion/page.tsx`:
```tsx
import { ComingSoon } from '../_components/ComingSoon';
export default function ImportacionPage() { return <ComingSoon label="Importación / Exportación" />; }
```

Crear `apps/web/app/(dashboard)/dashboard/auditoria/page.tsx`:
```tsx
import { ComingSoon } from '../_components/ComingSoon';
export default function AuditoriaPage() { return <ComingSoon label="Auditoría de sistema" />; }
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/analytics/ \
        apps/web/app/\(dashboard\)/dashboard/graficos/ \
        apps/web/app/\(dashboard\)/dashboard/importacion/ \
        apps/web/app/\(dashboard\)/dashboard/auditoria/
git commit -m "feat(web): placeholder routes for SP2-SP5 (analytics, graficos, importacion, auditoria)"
```

---

## Task 15: Refactor dashboard/page.tsx con nuevos componentes

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Sustituir Card → KpiCard**

En `apps/web/app/(dashboard)/dashboard/page.tsx`:

1. Eliminar la función `Card` local y `ChartPanel` local al final del archivo.
2. Añadir imports al inicio:

```tsx
import { KpiCard } from './_components/KpiCard';
import { ChartPanel } from './_components/ChartPanel';
import { StatusBadge } from './_components/StatusBadge';
import { FilterChips } from './_components/FilterChips';
import { Pagination } from './_components/Pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
```

- [ ] **Step 2: Reemplazar sección de KPI cards**

Localizar el bloque de cards con `-mx-4 flex gap-3 overflow-x-auto` y reemplazarlo:

```tsx
<div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-6">
  <KpiCard title="Tareas catálogo" value={kpis?.taskCount ?? '—'} loading={kpisQuery.isLoading} tone="accent" />
  <KpiCard title="Pendientes"      value={pipeline?.totals.pending ?? '—'}         tone="warn"    loading={pipelineQuery.isLoading} />
  <KpiCard title="Vencidas"        value={pipeline?.totals.overdue ?? '—'}         tone="danger"  loading={pipelineQuery.isLoading} />
  <KpiCard title="Hechas"          value={pipeline?.totals.done ?? '—'}            tone="ok"      loading={pipelineQuery.isLoading} />
  <KpiCard title="Omitidas"        value={pipeline?.totals.skipped ?? '—'}         tone="neutral" loading={pipelineQuery.isLoading} />
  <KpiCard
    title="Cumplimiento"
    value={pipeline ? `${pipeline.totals.completionRate.toFixed(1)}%` : '—'}
    tone="ok"
    loading={pipelineQuery.isLoading}
  />
</div>
```

- [ ] **Step 3: Reemplazar ChartPanel usages**

Cada `<ChartPanel title="..." subtitle="...">` mantiene el mismo children (Recharts), pero ahora usa el componente importado. Los 5 charts existentes se mantienen idénticos en contenido — solo cambia el wrapper.

Ejemplo para el primero:
```tsx
<ChartPanel title="Carga HH por mes" subtitle="Planificadas vs reales" loading={pipelineQuery.isLoading}>
  <ResponsiveContainer width="100%" height={260}>
    {/* ... igual que antes ... */}
  </ResponsiveContainer>
</ChartPanel>
```

Repetir para los otros 4 charts. El loading prop ahora muestra el skeleton del ChartPanel en vez de children vacíos.

- [ ] **Step 4: Reemplazar FilterChips bajo el panel de filtros**

Después del `</details>` del panel de filtros, añadir:

```tsx
<FilterChips
  chips={[
    ...(status ? [{ key: 'status', label: 'Estado', value: status, onRemove: () => { setStatus(''); setPage(0); } }] : []),
    ...(abc.trim() ? [{ key: 'abc', label: 'ABC', value: abc, onRemove: () => { setAbc(''); setPage(0); } }] : []),
    ...(frecuencia.trim() ? [{ key: 'frecuencia', label: 'Frecuencia', value: frecuencia, onRemove: () => { setFrecuencia(''); setPage(0); } }] : []),
    ...(psr.trim() ? [{ key: 'psr', label: 'PSR', value: psr, onRemove: () => { setPsr(''); setPage(0); } }] : []),
    ...(centroPlanificacion.trim() ? [{ key: 'centro', label: 'Centro', value: centroPlanificacion, onRemove: () => { setCentroPlanificacion(''); setPage(0); } }] : []),
    ...(q.trim() ? [{ key: 'q', label: 'Texto', value: q, onRemove: () => { setQ(''); setPage(0); } }] : []),
  ]}
  onClearAll={() => {
    setStatus(''); setAbc(''); setFrecuencia(''); setPsr('');
    setCentroPlanificacion(''); setQ(''); setPage(0);
  }}
/>
```

- [ ] **Step 5: Reemplazar Pagination en tabla de ejecuciones**

Localizar el bloque de paginación `<div className="flex items-center justify-between border-t px-4 py-3">` y reemplazarlo:

```tsx
<Pagination page={page} take={take} total={totalRows} onPage={setPage} />
```

- [ ] **Step 6: Reemplazar StatusPill → StatusBadge en DynamicRow y MobileExecCard**

En `DynamicRow`:
```tsx
// antes: <StatusPill status={row.status} />
// después:
<StatusBadge status={row.status} />
```

En `MobileExecCard`:
```tsx
// antes: <StatusPill status={row.status} />
// después:
<StatusBadge status={row.status} />
```

Eliminar la función `StatusPill` al final del archivo (ya no se usa).

- [ ] **Step 7: Reemplazar botones de acción en DynamicRow con DropdownMenu**

Reemplazar el bloque de botones inline en `DynamicRow`:

```tsx
<td className="px-3 py-2 text-right">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label="Acciones">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        disabled={busy || row.status === 'DONE'}
        onClick={onDone}
        className="text-ok focus:text-ok focus:bg-ok-dim"
      >
        Marcar hecha
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy || row.status === 'SKIPPED'}
        onClick={onSkip}
      >
        Omitir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</td>
```

Añadir `MoreHorizontal` a los imports de lucide-react.

- [ ] **Step 8: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

Expected: sin errores. Si hay errores de tipos en StatusPill eliminado, confirmar que todas las referencias fueron reemplazadas.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): refactor dashboard page — KpiCard, ChartPanel, StatusBadge, FilterChips, Pagination, DropdownMenu actions"
```

---

## Task 16: Actualizar tareas/page.tsx

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/tareas/page.tsx`

- [ ] **Step 1: Reemplazar StatusPill por StatusBadge**

En `apps/web/app/(dashboard)/dashboard/tareas/page.tsx`, buscar todo uso de `StatusPill` (o cualquier badge de estado hardcodeado) y reemplazar con:

```tsx
import { StatusBadge } from './_components/StatusBadge';
// ...
<StatusBadge status={row.status} />
```

- [ ] **Step 2: Aplicar tokens semánticos**

Reemplazar clases hardcodeadas de color (ej. `bg-amber-100 text-amber-800`) por variables semánticas (`bg-warn-dim text-warn`).

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm --filter @datos/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/tareas/page.tsx
git commit -m "feat(web): tareas page — StatusBadge and semantic color tokens"
```

---

## Task 17: Build final y verificación

**Files:** ninguno

- [ ] **Step 1: Build completo**

```bash
cd /home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas
pnpm --filter @datos/web build
```

Expected: `✓ Compiled successfully`. Sin errores de TypeScript ni de módulos no encontrados.

- [ ] **Step 2: Verificar rutas en dev server**

```bash
pnpm --filter @datos/web dev &
# navegar a:
# http://localhost:3000/login
# http://localhost:3000/dashboard
# http://localhost:3000/dashboard/tareas
# http://localhost:3000/dashboard/cronograma
# http://localhost:3000/dashboard/analytics
# http://localhost:3000/dashboard/graficos
# http://localhost:3000/dashboard/importacion
# http://localhost:3000/dashboard/auditoria
```

Checklist visual:
- [ ] Toggle dark/light sin flash al recargar
- [ ] Density toggle cambia spacing en tabla
- [ ] Sidebar colapsa a 64px con tooltips
- [ ] Mobile: Sheet abre y cierra
- [ ] KPI cards muestran valor + color semántico
- [ ] ChartPanel: botón fullscreen abre Dialog, menú ⋯ visible
- [ ] FilterChips aparecen al activar filtros
- [ ] Pagination muestra páginas con ellipsis
- [ ] StatusBadge colores correctos en tabla
- [ ] Rutas placeholder muestran ComingSoon sin error 404

- [ ] **Step 3: Verificar contraste WCAG AA**

Para los colores críticos verificar en https://webaim.org/resources/contrastchecker/:
- `#2563eb` sobre `#eff6ff` (acento sobre accent-dim): debe ser ≥ 4.5:1
- `#0f172a` sobre `#f8fafc` (text sobre bg): debe ser ≥ 7:1
- `#e6edf3` sobre `#0d1117` (dark text sobre dark bg): debe ser ≥ 7:1

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(web): SP1 design system rebrand complete — dark mode, density, sidebar, new components"
```

---

## Self-Review

**Spec coverage:**

| Req. spec | Task que lo implementa |
|---|---|
| CSS variables semánticas light + dark | Task 2 |
| `next-themes` dark mode sin flash | Task 3 |
| Density comfortable/compact | Task 4 |
| `useSidebarCollapsed` localStorage | Task 5 |
| NavItem con tooltip en modo colapsado | Task 6 |
| SidebarSection Radix Collapsible | Task 6 |
| SidebarNav 4 secciones | Task 7 |
| ThemeToggle / DensityToggle | Task 7 |
| UserMenu con logout | Task 7 |
| Topbar 52px sticky con breadcrumb y ⌘K placeholder | Task 8 |
| Sidebar desktop colapsable + Sheet mobile | Task 8 |
| Layout shell nueva | Task 9 |
| StatusBadge semántico | Task 10 |
| KpiCard sparkline + delta | Task 11 |
| ChartPanel fullscreen + export PNG | Task 12 |
| FilterChips con limpiar individual/todo | Task 13 |
| Pagination con ellipsis | Task 13 |
| ComingSoon placeholder | Task 13 |
| Rutas /analytics /graficos /importacion /auditoria | Task 14 |
| dashboard/page.tsx migrado | Task 15 |
| tareas/page.tsx migrado | Task 16 |
| Build TypeScript limpio | Task 17 |
| Contraste WCAG AA | Task 17 |

**Placeholder scan:** ningún TBD, ningún "implement later", ningún "similar a Task N" encontrado.

**Type consistency:** `ExecStatus` importado de `@/lib/types` en StatusBadge y usado igual que en page.tsx. `Tone` definido localmente en KpiCard y no exportado (no necesario). `Density` exportado de `useDensity.ts` e importado en `DensityProvider.tsx`. `useSidebarCollapsed` retorna `{ collapsed, toggle, setCollapsed }` — usado consistentemente en `Sidebar.tsx`.

---

## Addendum 2026-04-29 — Cierre de brechas de visión completa

Se completaron los pendientes detectados tras el rebrand inicial:

- [x] `Cmd+K` dejó de ser placeholder: nueva `CommandPalette` con navegación y búsqueda contextual.
- [x] Filtros principales del dashboard y tareas viven en URL para deep-links reales.
- [x] Eliminación de vistas guardadas usa diálogo de confirmación antes de ejecutar acción destructiva.
- [x] Fechas, totales y HH usan `Intl` (`es-CL`) y textos de carga/exportación usan `…`.
- [x] `/dashboard/analytics` dejó de ser placeholder: forecast HH, heatmap mensual, treemap ABC×frecuencia, anomalías y prioridades sugeridas.
- [x] `/dashboard/graficos` dejó de ser placeholder: lectura ejecutiva automática, generador de gráficos IA vía `/api/ai/chart` y planificador semanal.
- [x] `/dashboard/importacion` dejó de ser placeholder: plantilla XLSX descargable, dry-run/preview, diff de filas nuevas/actualizadas, mapper visible y export CSV/XLSX.
- [x] API admin expone `/api/admin/import/template` y `/api/admin/import/preview` con validación de archivo existente.

Commits principales:

- `7aa15a0` — command palette + URL-driven filters.
- `0c00098` — analytics avanzado.
- `63e5113` — IA expandida.
- `eecd860` — plantilla XLSX + dry-run + import workspace.

---

## Auditoría de cierre 2026-04-29 — estado OK

Esta sección reemplaza el estado histórico de checkboxes del cuerpo del plan. El cuerpo conserva pasos originales de implementación, pero el estado final real se valida contra código, rutas y build.

### Hallazgos del análisis del plan

- El plan original seguía mencionando placeholders para `/analytics`, `/graficos`, `/importacion` y `/auditoria`.
- El addendum anterior cerraba `/analytics`, `/graficos` e `/importacion`, pero faltaba cerrar `/auditoria`.
- El plan no contemplaba todavía el salto premium de IA narrativa persistente con memoria/hilos y explicación auditable.
- El plan tenía checklist de tareas sin marcar porque funcionaba como plan ejecutable histórico, no como reporte final.

### Correcciones finales aplicadas

- [x] `/dashboard/auditoria` reemplazado por vista real de auditoría hash-chain.
- [x] Verificación de integridad vía `/api/audit/verify` visible en UI.
- [x] Tabla de eventos auditables con filtros por acción y límite.
- [x] Endpoint dedicado de IA narrativa: `POST /api/ai/insights`.
- [x] Hilos persistentes de IA: `GET /api/ai/insights/threads`.
- [x] Memoria persistente en Prisma: `AiInsightThread` y `AiInsightMessage`.
- [x] Migración Prisma: `20260429210000_ai_insight_threads`.
- [x] Respuesta IA estructurada con `summary`, `findings`, `risks`, `nextActions` y `explanation.evidenceIds`.
- [x] Fallback determinístico si Groq/OpenRouter falla.
- [x] Registro en auditoría hash-chain con acción `AI_INSIGHT`.
- [x] UI de `/dashboard/graficos` actualizada para generar insights auditados y continuar hilos.

### Estado final por visión

| Área | Estado |
|---|---|
| Rebrand visual + tokens + dark/density | OK |
| Sidebar seccionado + topbar | OK |
| Cmd+K búsqueda rápida | OK |
| Filtros deep-link URL | OK |
| Charts avanzados | OK inicial: forecast, heatmap, treemap, anomalías |
| IA gráficos | OK |
| IA narrativa persistente | OK inicial: endpoint, hilos, memoria, explicación |
| Import/export plantilla + dry-run + diff | OK |
| Auditoría visible | OK |
| Build/typecheck | OK |

### Pendientes fuera de SP1, no bloqueantes para OK

- Mejorar IA narrativa con evaluación automática de calidad de respuesta y tests con fixtures reales.
- Mover cuota IA de memoria a Redis si se despliega en múltiples réplicas.
- Agregar Playwright visual regression para desktop/mobile.
- Virtualización de tablas grandes si se muestran más de 500 filas en UI.
- Permitir mapper de columnas editable visualmente; actualmente el mapper es visible y el backend valida plantilla estándar.

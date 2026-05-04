# Rediseño UI/UX — Plataforma de gestión de mantención

**Fecha:** 2026-05-03
**Autor:** nicoholas (con asistencia de Claude)
**Estado:** Spec aprobada · pendiente plan de implementación
**Proyecto:** datos.nicoholas.dev
**Stack:** Next.js 15 + NestJS 10 + Prisma + Postgres 16 + Redis + Caddy + Docker

---

## 1. Contexto y motivación

`datos.nicoholas.dev` nació como dashboard que reemplazaba un Power BI: visualización de un Excel inmutable con 545 tareas × 84 meses (ene-22 → dic-28). El sistema actual es **rico en datos pero pobre en interacción**:

- Home con scroll vertical de 1081 líneas (12 KPIs + 6 charts + filtros + tabla).
- Modal "Qué toca / Radar de mantención" tapa contenido al navegar desde plantas.
- Cronograma es solo visualización estática, sin drill-down.
- Analytics tiene KPIs ilegibles que no actúan como links a las secciones.
- Gráficos IA mezcla insight narrativo + generación libre con curva alta para usuario operacional.
- No existe CRUD de plantas, equipos ni plan de mantención.
- No hay registro real de ejecución (HH real, evidencia fotográfica, aprobación).
- No hay flujo mobile-first para operador en campo.

**Decisión del usuario** (sesión 2026-05-03): pivote desde "dashboard de Excel" a **plataforma de gestión de mantención completa** con plantas como entidad operacional central, plan de mantención por planta, registro real con evidencia, y flujo de aprobación preparado pero simplificado para uso personal/demo inicial.

## 2. Objetivos

| # | Objetivo | Medible |
|---|---|---|
| 1 | Bajar curva de aprendizaje | < 30s al primer registro de ejecución útil después del onboarding |
| 2 | CRUD completo de plantas y plan de mantención | Crear/editar/desactivar planta sin tocar Excel |
| 3 | Registro real con evidencia | Foto desde cámara nativa + HH real + aprobación opcional |
| 4 | BI accionable | Cualquier KPI/chart filtra el resto vía cross-filter |
| 5 | Mobile-first para operador en campo | Bottom tab bar + FAB + offline queue |
| 6 | Auth robusto + roles escalables | 2 roles hoy (SUPERADMIN/INVITADO), enum + matriz lista para 5 roles |
| 7 | Excel deja de ser source of truth | Pasa a bootstrap inicial + re-import opcional con diff |

## 3. No-objetivos (fuera de alcance de esta spec)

- Multi-tenant / múltiples clientes en la misma instancia.
- Integración con SAP PM real (sigue siendo simulación local).
- App móvil nativa (la PWA cubre el caso operador).
- Notificaciones por email/SMS (solo in-app + Web Push opcional).
- IA on-prem (sigue usando Anthropic API).
- Roles SUPERVISOR / OPERADOR / APROBADOR funcionales (solo estructura preparada).

## 4. Decisiones clave

### 4.1 Roles
- **Hoy:** `SUPERADMIN` (todo) y `INVITADO` (read-only para demo).
- **Estructura preparada:** enum `Role` extensible. Decoradores `@Roles(...)` por endpoint en NestJS. Hook `useCan(action)` en Next.js consume permisos del JWT y esconde/deshabilita CTAs.
- **Plan futuro:** agregar `SUPERVISOR | OPERADOR | APROBADOR` es solo migración + actualizar matriz de permisos sin refactor de UI.

### 4.2 Storage de evidencias
- **VPS local:** `/var/lib/datos/evidencias/{plantaId}/{ejecucionId}/{uuid}.{ext}`.
- Backup diario vía cron rsync a directorio separado (rotación 30 días).
- Servidos por endpoint NestJS `GET /api/evidencias/:id` que valida JWT + permiso de la planta antes de devolver el archivo (no se exponen rutas públicas en Caddy).
- Tipos aceptados: PDF, JPG, PNG, MP4. Máximo 25 MB por archivo, máximo 10 archivos por ejecución.

### 4.3 Excel
- **Pasa a:** bootstrap inicial + re-import opcional con diff inteligente.
- **Re-import:** wizard 4 pasos (Subir → Mapear columnas → Revisar diff → Aplicar fila por fila). Diff distingue: nuevas, actualizadas, conflictos, sin match.
- **Saved mappings:** la primera vez se mapea manual; el mapping se guarda y la próxima importación lo aplica automáticamente.
- **NO source of truth:** después del bootstrap, plantas/plan/ejecuciones se gestionan desde la UI.

### 4.4 Workflow de aprobación
- **Estados:** `PROGRAMADA → EN_CURSO (opcional) → HECHA_PEND_APROB → APROBADA / RECHAZADA`.
- **Estados terminales adicionales:** `SKIPPED` (no realizada con motivo), `POSTERGADA` (con nueva fecha programada).
- **Hoy con 2 roles:** SUPERADMIN puede registrar y aprobar en el mismo paso (toggle "Marcar como aprobada" default ON). El estado `HECHA_PEND_APROB` se mantiene en BD para no romper la estructura cuando se separe el rol APROBADOR.
- **Re-apertura:** ejecución `APROBADA` puede volver a `HECHA_PEND_APROB` con un click + motivo (audit log).

---

## 5. Arquitectura de información

### 5.1 Sidebar — agrupado por intención

Antes (plano, 9 items):
```
Dashboard · Plantas · Cronograma · Analytics · Gráficos · Tareas · Importación · Auditoría · Admin
```

Ahora (3 grupos, 6 items):
```
OPERACIÓN
  ⚡ Dashboard         (con tabs internos Hoy/Semana/Análisis/IA)
  🏭 Plantas           (con CRUD completo)
  📋 Tareas            (catálogo maestro de tareas tipo)
DATOS
  📤 Importación       (Excel bootstrap + re-import con diff)
ADMIN
  👥 Usuarios          (gestión + 2FA)
  🔍 Auditoría         (log con hash chain)
```

`/dashboard/cronograma` y `/dashboard/graficos` desaparecen como páginas sueltas; pasan a tabs internos del Dashboard.

### 5.2 Dashboard tabs internos

Header sticky con tabs: **⚡ Hoy · 📆 Semana · 📊 Análisis · 🤖 IA**

Default = Hoy. Última pestaña usada se recuerda en localStorage por usuario.

| Tab | Contenido | Reemplaza |
|---|---|---|
| Hoy | Radar global cross-planta + 4 KPIs operacionales + lista de pendientes-aprobación + plantas con riesgo alto | Top del dashboard actual |
| Semana | Calendario L-D con drag para reprogramar | Nuevo |
| Análisis | KPIs + 4 charts cross-filter + heatmap mes×año + tabla 187 ejec. paginada con bulk export | Resto del dashboard + /cronograma + /analytics |
| IA | 6 templates guiados + prompt libre colapsado + resultado auditable | /graficos |

### 5.3 Plantas — entidad central

`/dashboard/plantas` (listado) y `/dashboard/plantas/[psr]` (detalle) son **ahora la columna vertebral del producto**.

---

## 6. Diseño detallado

### 6.1 Tab Hoy

**Layout:** 4 KPIs en grid + radar global a la izquierda + sidebar derecho con pendientes y plantas riesgo.

**KPIs (clicleables, navegan a Análisis con filtro pre-aplicado):**
1. Vencidas críticas (rojo · ABC=A overdue) con delta vs ayer
2. Hoy (naranja · todas las tareas con fecha programada == hoy) con HH plan total
3. Pendientes de aprobación (ámbar · `HECHA_PEND_APROB`) con tiempo desde primera
4. Cumplimiento mes (verde · % aprobadas sobre programadas) con barra de progreso

**Radar global:**
- Buckets-chip clicleables: Vencidas / Este mes / Próximo mes / +2 meses.
- Cada item: ABC badge + nombre tarea + planta + venc/hoy/+Nd + HH + botones inline `[Registrar] [Postergar]`.
- "Registrar" abre drawer (ver 6.5).
- "Postergar" abre popover compacto: opciones rápidas (mañana / +3d / +1sem / próx. mes / fecha custom) + razón opcional.

**Sidebar derecho:**
- Card "Pend. aprobación" con bulk approve y row-level approve/reject.
- Card "Plantas con riesgo alto" — top 3-5 plantas con cumplimiento bajando.

### 6.2 Tab Semana

- 7 columnas (L–D), cada una con header (día semana, fecha, total HH).
- Cards de tareas dentro de cada día, ordenados por hora programada (si aplica) o ABC desc.
- Color de borde-izq por riesgo (vencida=rojo, hoy=naranja, futura=azul, hecha=verde semitransparente).
- Día actual destacado (fondo amarillo claro, header bold).
- Sáb/Dom: si tienen tareas, mismo tratamiento; si no, opacidad 0.6 con "Sin tareas".
- Header: navegación ← / → / Hoy + filtros (planta, ABC) + total HH semana en chip.
- **Drag & drop:** mover card a otro día reprograma con popover "Confirmar reprogramación + motivo opcional" (audit log).
- **Click card:** abre drawer registro.

### 6.3 Tab Análisis (BI cross-filter)

**Filtros pills arriba:** chips removibles individualmente. Click "+ Filtro" abre selector (planta, ABC, frecuencia, área, año, estado). URL contiene estado para compartir.

**4 charts (todos cross-filter, click → filtra el resto):**
1. **HH plan vs real (12m)** — barras agrupadas, color real OK / real bajo según umbral configurable.
2. **Cumplimiento por planta** — bar horizontal ordenado, planta seleccionada destacada con halo.
3. **Heatmap mes×año** — matriz 12 cols × N años, intensidad = HH plan. Cell click → filtra a ese mes/año.
4. **Distribución estados** — donut con 4-5 segmentos (Aprobada, Pend. aprob., Vencida, Otros). Click segmento → filtra.

**Tabla al fondo:** 187 ejecuciones paginadas. Columnas: estado, tarea, equipo, programada, real, HH plan/real, evidencias, aprobación, ⋯ acciones.
- Selección múltiple → bulk export CSV / PDF.
- Cada fila clicleable → drawer detalle ejecución.

### 6.4 Tab IA

**Sección 1 — Templates (entry point principal):**
6 cards con icono, título y descripción breve. Click → genera (con parámetros si requiere, ej. "Diagnóstico planta X" abre selector planta primero).

| Template | Salida |
|---|---|
| 🚨 Riesgo de la semana | Top tareas críticas potencialmente venceríbles + recomendación |
| 📊 Top 5 vencidas | Análisis de las más postergadas con causa probable |
| 📈 Predicción HH próximo mes | Forecast carga + recomendación capacidad |
| 🏭 Diagnóstico planta X | Análisis cumplimiento + recomendaciones específicas |
| 📋 Reporte ejecutivo mensual | PDF con KPIs + anomalías + plan próximo mes |
| 🔍 Anomalías detectadas | HH atípicos, equipos con falla recurrente, retrabajos |

**Sección 2 — Modo avanzado (colapsado):**
`<details>` expandible con textarea para prompt libre. CTA "Generar".

**Sección 3 — Resultado:**
Card con título, fecha, modelo, acciones (Descargar PDF / Copiar / Compartir link). Cuerpo: resumen + hallazgos + próximos pasos. Footer auditable: "187 ejecuciones analizadas · datos cortados al YYYY-MM-DD · modelo X · ID: ins_xxxx".

**Historial de generaciones:** botón "Ver anteriores" abre drawer con timeline de generaciones previas.

### 6.5 Plantas — listado

**Header:** título + contador (12 activas · 2 desactivadas) + botón `+ Nueva planta` (oculto si rol = INVITADO).

**Filtro bar:** búsqueda fuzzy (nombre, PSR, equipo) + chips por riesgo (Todas / Alto / Medio / Bajo) + toggle Grid ↔ Tabla.

**Vista grid (default):** 3 columnas desktop / 2 tablet / 1 mobile. Card por planta:
- Border-top color = riesgo (rojo/naranja/verde)
- Header: nombre + PSR + área + badge riesgo
- Stats compactas: equipos · tareas en plan · próx. ejecución (color rojo si vencida)
- Sparkline 6m de cumplimiento + número grande del último valor
- CTA `[Abrir →]` + `⋯` (menú: Editar / Duplicar plan / Desactivar)

**Vista tabla:** misma data en formato denso para análisis bulk.

### 6.6 Plantas — drawer crear/editar

Drawer lateral derecho 480px desktop, full-screen mobile. 4 pestañas internas:

**Pestaña 1 · General:**
- Nombre (req) · PSR (req, único) · Área responsable (select) · Descripción · Color identificador (palette 5 opciones) · Estado (segmented Activa / Desactivada).
- Footer informativo: "Identificador autogenerado · Auditoría registra crear/editar/desactivar".

**Pestaña 2 · Equipos:**
- Lista de equipos físicos asociados a la planta.
- Cada equipo: tipo (motor/bomba/filtro/tablero/otro) · nombre · modelo · serial (opcional) · notas.
- CRUD inline (add row, edit row, remove con confirm).

**Pestaña 3 · Plan de mantención:**
- Lista de tareas programadas que componen el plan.
- Cada tarea: ABC · descripción (req) · frecuencia (mensual/trimestral/semestral/anual/custom-cron) · HH plan · equipo asociado opcional · responsable opcional.
- CRUD inline + duplicar tarea.
- "Generar próximas N ejecuciones" — botón que crea entries en `Ejecucion` con estado `PROGRAMADA` para los próximos 12 meses según frecuencia.

**Pestaña 4 · Permisos:**
- Toggle "Visible para INVITADO" (default ON).
- Estructura preparada para más roles (UI ya renderea sección, hoy con un solo toggle).

**Validación:** nombre + PSR únicos. Eliminar = soft delete con campo "motivo de baja", queda en histórico.

### 6.7 Plantas — detalle (`/dashboard/plantas/[psr]`)

**Header sticky compartido:**
- Breadcrumb `← Plantas / PSR-XXX`
- Avatar (color identificador) + nombre + PSR (mono) + área + badges (riesgo, estado activa/desactivada)
- CTAs: `[✎ Editar]` `[+ Registrar ejecución]` (primario) `[⋯]` (Duplicar plan, Desactivar, Exportar)

**5 tabs internos:**

#### Tab 1 — Resumen (default)
- 4 KPIs específicos de la planta (vencidas / próx 30d / cumplimiento 6m / HH real vs plan)
- Card "Próximas ejecuciones" con CTA `[Registrar]` inline por item
- Card "Cumplimiento últimos 6 meses" — bar chart 6 meses con alerta de tendencia ("⚠ Tendencia bajista. Investigar causas.")
- Feed "Actividad reciente" (últimos 5-10 eventos) — registros, aprobaciones, ediciones de plan, todos clicleables al detalle.

#### Tab 2 — Plan & Equipos
- Layout split 280px / resto.
- Izq: lista de equipos. Click equipo filtra el plan a la derecha.
- Der: tabla del plan de mantención filtrado por equipo (o todos). CRUD inline mismo del drawer.

#### Tab 3 — Ejecuciones
- Toggle modo: **Lista / Calendario / Heatmap** (segmented).
- Filtros: estado · ABC · equipo · búsqueda.
- Modo Lista: tabla con columnas Estado, Tarea, Equipo, Programada, Real, HH plan/real, Evid., Aprob., ⋯.
- Modo Calendario: vista mes con cards por día.
- Modo Heatmap: matriz mes × año específica de esta planta. Cell click → filtra Lista a ese mes.

#### Tab 4 — Evidencias
- Filtros chip: Todas / Fotos / PDFs / Videos.
- Galería 4 cols con thumbnails. PDFs: icono + nombre. Videos: thumb con play overlay.
- Click thumbnail → lightbox con metadata (ejecución, fecha, autor, tamaño, descargar).
- Selección múltiple → "Descargar ZIP" o "Eliminar" (admin).

#### Tab 5 — Histórico
- Card 1: "HH plan vs real (12m)" — barras agrupadas.
- Card 2: "Top 5 tareas más postergadas" — lista con conteo.
- Card 3: "Equipos con más fallas" — lista con conteo de rechazadas/postergadas.
- Insights accionables, no charts vacíos.

### 6.8 Drawer de registro de ejecución

**Trigger:** botón `[Registrar]` desde Hoy, Semana, Detalle Planta, o tabla de Ejecuciones.

**Layout:** drawer lateral 480px desktop, full-screen mobile.

**Header:**
- Eyebrow "Registrar ejecución" + título tarea
- Banner contextual con ABC badge + planta + estado (vencida/hoy/...) + HH plan

**Form único scrollable (NO wizard):**

1. **¿Qué pasó?** — segmented 3 opciones:
   - ✓ **Hecha** (verde, default si vencida o hoy)
   - ⚠ **Con observaciones** (amarillo, comentario obligatorio, cuenta como cumplida con flag)
   - ⊘ **No realizada** (rojo, motivo + reprogramar para obligatorios, NO cuenta como cumplida)

2. **Fecha real** — date picker, default hoy.

3. **HH real** — input numérico con `−` / `+` (paso 0.1), default = HH plan, label muestra "(plan: X.X)".

4. **Evidencia** — drag&drop area + thumbnails con remove inline.
   - Mobile: dos botones grandes "📷 Cámara" y "📁 Subir".
   - Backend valida MIME, tamaño (≤25MB), cuota.

5. **Comentario** — textarea opcional (obligatorio para "Con obs." y "No realizada").

6. **Toggle "Marcar como aprobada"** — default ON para SUPERADMIN, oculto para OPERADOR (cuando exista).

**Footer sticky:**
- `[Cancelar]` (secundario)
- `[✓ Guardar y aprobar]` (primario, cambia label a "Guardar" si toggle OFF).

**Comportamientos:**
- Optimistic UI: tarea desaparece del Radar al guardar, undo de 5s.
- Foto sube en background con barra discreta.
- Audit log captura: registro, edición, aprobación, rechazo, re-apertura.

### 6.9 Bandeja Pendientes de Aprobación

Componente listo, oculto hoy (porque SUPERADMIN auto-aprueba). Cuando se separe el rol APROBADOR pasa a ser su home.

- Tab dentro de Hoy o página dedicada `/dashboard/aprobaciones`.
- Card por ejecución: checkbox + título + HH real/plan + 📎 N evidencias + tiempo desde registro + botones `[✓]` (verde) `[✗]` (rojo, abre modal motivo).
- Bulk approve con checkbox de fila + botón superior "Aprobar todas".

---

## 7. Auth & roles

### 7.1 Flujo login

1. Email + password.
2. 6 dígitos TOTP (Google Auth, Authy compatible).
3. Si primer login: cambio password obligatorio.
4. Recovery: 8 backup codes generados al setup, 1 uso c/u, regenerable.

### 7.2 Sesión

- JWT access token: 15 min, sliding window.
- JWT refresh token: 7 días, httpOnly cookie.
- Logout: invalida refresh, limpia local IndexedDB queue.

### 7.3 Roles (matriz hoy)

| Acción | SUPERADMIN | INVITADO |
|---|:---:|:---:|
| Ver dashboard / plantas / análisis | ✓ | ✓ |
| Crear/editar planta | ✓ | ✗ |
| CRUD plan de mantención | ✓ | ✗ |
| Registrar ejecución | ✓ | ✗ |
| Aprobar / rechazar ejecución | ✓ | ✗ |
| Subir evidencia | ✓ | ✗ |
| Importar Excel | ✓ | ✗ |
| Gestionar usuarios | ✓ | ✗ |
| Generar IA | ✓ | leer |
| Ver auditoría | ✓ | ✗ |

### 7.4 Estructura preparada para escalar

- Enum Prisma `Role { SUPERADMIN, INVITADO }` extensible a `SUPERVISOR | OPERADOR | APROBADOR`.
- NestJS: decoradores `@Roles(Role.SUPERADMIN)` por endpoint, guard global.
- Next.js: hook `useCan(action)` consume permisos del JWT y devuelve boolean. CTAs envueltos en `<Can action="planta.crear">…</Can>` que esconde o deshabilita con tooltip.
- Tabla `permission_matrix` opcional (BD) para flexibilidad runtime sin redeploy.

---

## 8. Importación

### 8.1 Posicionamiento

- Pasa de página principal a herramienta admin del grupo "Datos" en sidebar.
- NO source of truth: solo bootstrap inicial + re-import opcional con merge.

### 8.2 Wizard 4 pasos

1. **Subir archivo** — drag&drop XLSX, valida tamaño/extensión.
2. **Mapear columnas** — autodetect basado en headers; user puede ajustar. "Guardar mapping" para reutilizar.
3. **Revisar diff** — categorías:
   - **Nuevas** (no existen por PSR) — preview tabla, todas seleccionables/deseleccionables.
   - **Actualizadas** (existen, datos cambiados) — diff visual campo por campo.
   - **Conflictos** (mismo PSR, datos contradictorios) — pide resolución manual.
   - **Sin match** (en BD pero no en Excel) — opción de desactivar.
4. **Aplicar** — confirm modal con resumen de impacto. Importación corre como background job; UI muestra progreso. Audit log registra import_run.

### 8.3 Saved mappings

Cada mapping aplicado se guarda con fingerprint del archivo (header hash). Si el siguiente Excel coincide, se aplica automáticamente; si no, vuelve a paso 2.

---

## 9. Mobile-first patterns

### 9.1 Navegación

- **Bottom tab bar** reemplaza sidebar en breakpoint <768px: Hoy / Semana / Plantas / Análisis. IA, Importación, Admin → menú ⋯ topbar.
- **Pestañas internas** (drawer planta, detalle planta) → chips horizontales scrolleables.
- **FAB** (Floating Action Button) bottom-right en pantallas con CTA primario (Plantas, Detalle planta, Ejecuciones).

### 9.2 Componentes adaptativos

- **Tablas → cards stacked**: en mobile cada fila se renderea como card con info principal y acciones en `⋮`.
- **Drawers → bottom sheets**: drawers laterales se vuelven bottom sheets (más natural en touch).
- **Targets touch-friendly**: mínimo 44px alto, espaciado entre elementos cliqueables ≥8px.

### 9.3 Cámara nativa

- Botón "Cámara" usa `<input capture="environment" accept="image/*">` para abrir cámara directa sin galería intermedia.
- Compresión client-side (canvas) antes de upload para reducir bandwidth.

### 9.4 Offline queue

- Service worker registra requests `POST /api/ejecuciones` y subidas de evidencia.
- Si offline: encola en IndexedDB con timestamp.
- UI muestra banner amarillo "N registros pendientes sincronizar" con icono ⟳.
- Al recuperar conexión: sync automático, retry con exponential backoff.
- Conflictos (ejecución modificada en server entretanto) → modal resolución manual.

---

## 10. Sistema visual

### 10.1 Color tokens

5 colores semánticos × 9 tints (50–900):

| Token | Uso |
|---|---|
| `brand` (azul) | CTAs primarios, links, focus rings |
| `danger` (rojo) | Vencidas, rechazadas, eliminar |
| `warn` (ámbar) | Pendientes, observaciones |
| `ok` (verde) | Aprobadas, hechas, success toasts |
| `neutral` (gris) | Texto, bordes, disabled, fondos |

Componentes consumen tokens semánticos (`--color-danger-fg`, `--color-danger-bg-soft`), no valores raw. Dark mode invierte mapping sin tocar componentes.

### 10.2 Tipografía

Inter (system fallback). Escala modular 1.2x:

| Nivel | Tamaño / Peso |
|---|---|
| H1 | 18px / 700 |
| H2 | 14px / 600 |
| Body | 13px / 400 |
| Caption | 11px / 400 |
| Label | 10px / 400 / UPPER + tracking 1px |

Números tabular (`font-variant-numeric: tabular-nums`) para HH y montos.

### 10.3 Espaciado

Base 4px. Escala 1·2·3·4·5·6·8 → 4·8·12·16·20·24·32px.

**Density toggle:** comfortable (default) / compact (-25% spacing). Persiste por usuario en localStorage.

### 10.4 Componentes base (shadcn/ui)

Button · Badge · Card · Input · Select · Tabs · Drawer · Sheet · Dialog · Toast · Tooltip · Skeleton · Avatar · DataTable · Calendar · Combobox · DatePicker · Popover.

Todos accesibles: ARIA, keyboard, focus visible, reduced motion respetado.

### 10.5 Variantes

- **Button:** primary · secondary · ghost · destructive · link.
- **Badge:** danger · warn · ok · neutral · info (sólido o soft).
- **Card:** default · elevated · interactive (hover state).

---

## 11. Micro-interacciones y polish

- **Loading skeletons** en vez de spinners — preservan layout, reducen percepción de espera.
- **Optimistic UI** en marcar hecha / aprobar / postergar — feedback instantáneo + rollback con toast si falla.
- **Toasts no bloqueantes** top-right con undo de 5s en acciones reversibles.
- **Empty states** ilustrados con CTA contextual.
- **Error states** con mensaje técnico colapsado (`<details>`) + acción de reintento.
- **Atajos teclado:** `g h`=Hoy · `g s`=Semana · `g a`=Análisis · `g p`=Plantas · `n`=nueva ejecución · `?`=ayuda · `/` o `cmd+K`=búsqueda global.
- **Búsqueda global** (`cmd/ctrl+K`): plantas, equipos, tareas, ejecuciones, usuarios. Resultados agrupados por tipo, navegables con arrows + Enter.
- **Onboarding tour** primera vez: 5 pasos resaltando Hoy → Plantas → Registrar → Análisis → IA. Saltable, reactivable desde menú ayuda.
- **Notificaciones in-app** (campana topbar): tareas vencidas hoy, ejecuciones rechazadas, plantas con riesgo subiendo. Web Push opcional (toggle en settings).
- **Dark mode** auto según OS + override manual.
- **i18n ready:** archivo de mensajes (es-CL default), estructura permite agregar otros idiomas sin refactor.
- **Reduced motion:** anima opacity en lugar de transforms si `prefers-reduced-motion: reduce`.

### 11.1 Accesibilidad

- Contraste WCAG AA mínimo 4.5:1 (texto normal), 3:1 (texto grande / UI components).
- Focus visible con ring de 2px color brand.
- Navegación teclado completa, sin atrapar foco en modales.
- ARIA labels en charts (descripción + datos clave).
- Anuncia cambios dinámicos con `aria-live="polite"` (toasts, badges count).

---

## 12. Cambios técnicos transversales

### 12.1 Modelo de datos (Prisma)

Entidades nuevas o modificadas:

```
Planta
  id (cuid) · psr (unique) · nombre · descripcion · area · color · status (ACTIVA|DESACTIVADA)
  motivoBaja (nullable) · createdAt · updatedAt · createdBy · updatedBy

Equipo
  id · plantaId (FK) · tipo (MOTOR|BOMBA|FILTRO|TABLERO|OTRO)
  nombre · modelo · serial (nullable) · notas

TareaProgramada
  id · plantaId (FK) · equipoId (FK, nullable)
  abc (A|B|C) · descripcion · frecuencia (MENSUAL|TRIMESTRAL|SEMESTRAL|ANUAL|CUSTOM)
  cronExpression (nullable, si CUSTOM) · hhPlan · responsableId (FK User, nullable)

Ejecucion
  id · tareaProgramadaId (FK) · fechaProgramada · fechaReal (nullable)
  estado (PROGRAMADA|EN_CURSO|HECHA_PEND_APROB|APROBADA|RECHAZADA|SKIPPED|POSTERGADA)
  outcome (HECHA|CON_OBSERVACIONES|NO_REALIZADA, nullable)
  hhPlan · hhReal (nullable) · comentario (nullable)
  motivoSkip (nullable) · reprogramadaPara (nullable, FK Ejecucion siguiente)
  registradaBy (FK User) · registradaAt
  aprobadaBy (FK User, nullable) · aprobadaAt (nullable)
  rechazadaBy (FK User, nullable) · rechazadaAt (nullable) · motivoRechazo (nullable)

Evidencia
  id · ejecucionId (FK) · filename · mime · size · sha256 · path
  uploadedBy (FK User) · uploadedAt · descripcion (nullable)

User (extendido)
  rol (Role enum) — hoy SUPERADMIN | INVITADO

Role (enum)
  SUPERADMIN, INVITADO
  // futuro: SUPERVISOR, OPERADOR, APROBADOR

AuditLog (existe, extender para nuevas entidades)
  hash chain mantenido
```

Migraciones: secuenciales, reversibles. Soft delete generalizado vía campo `deletedAt`.

### 12.2 Endpoints NestJS (resumen, no exhaustivo)

```
GET    /api/plantas                  list, paginado, filtros
POST   /api/plantas                  create
GET    /api/plantas/:psr             detail
PATCH  /api/plantas/:psr             update
DELETE /api/plantas/:psr             soft delete (motivo)

GET    /api/plantas/:psr/equipos
POST   /api/plantas/:psr/equipos
PATCH  /api/equipos/:id
DELETE /api/equipos/:id

GET    /api/plantas/:psr/plan        plan de mantención
POST   /api/plantas/:psr/plan        crear tarea programada
PATCH  /api/tareas-programadas/:id
DELETE /api/tareas-programadas/:id
POST   /api/tareas-programadas/:id/generar-ejecuciones

GET    /api/ejecuciones              list con filtros (cross-filter)
POST   /api/ejecuciones              registrar ejecución
PATCH  /api/ejecuciones/:id          editar
POST   /api/ejecuciones/:id/aprobar
POST   /api/ejecuciones/:id/rechazar (motivo req)
POST   /api/ejecuciones/:id/postergar
POST   /api/ejecuciones/:id/reabrir

POST   /api/ejecuciones/:id/evidencias    multipart, valida MIME/tamaño
GET    /api/evidencias/:id                sirve archivo (JWT + permiso)
DELETE /api/evidencias/:id

GET    /api/dashboard/hoy
GET    /api/dashboard/semana
GET    /api/dashboard/analisis        cross-filter params
POST   /api/ia/template/:templateId   ejecuta template
POST   /api/ia/free-prompt
GET    /api/ia/historial

POST   /api/import/upload
POST   /api/import/diff               devuelve preview
POST   /api/import/aplicar            background job

GET    /api/auditoria
```

Todos protegidos por JWT + `@Roles(...)` apropiado.

### 12.3 Storage

- Path: `/var/lib/datos/evidencias/{plantaId}/{ejecucionId}/{uuid}.{ext}`.
- Permisos: 700, owner = usuario nestjs.
- Backup: cron diario a `/var/backups/datos/evidencias/YYYY-MM-DD/` con rsync, retención 30 días.
- Integridad: SHA256 guardado en BD, verificable on-demand.

### 12.4 Service worker / offline

- Workbox o vanilla SW.
- Estrategia: NetworkFirst para `/api/*` con queue en background sync para POST/PATCH.
- IndexedDB store: `pending_executions`, `pending_evidencias`.
- Reconciliación de conflictos: server retorna 409 con estado actual; UI abre modal "El registro fue modificado en server. Aplicar el tuyo / Mantener server / Merge".

### 12.5 Tests E2E (Playwright, ya instalado)

Flujos críticos cubiertos:
- Login + 2FA happy path + recovery code.
- Crear planta + agregar equipo + agregar tarea programada + generar ejecuciones.
- Registrar ejecución con foto + aprobar.
- Postergar ejecución → audit log.
- Drag & drop reprogramar en calendario.
- Cross-filter en Análisis: click bar → filtra todo.
- Importar Excel + diff + aplicar.
- Modo INVITADO: CTAs deshabilitados/ocultos.

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Storage local crece sin control | Cuota por planta (configurable). Alerta al 80%. |
| Pérdida de evidencia por falla disco | Backup rsync diario + verificación SHA256 + alerta si falta archivo. |
| Conflictos offline complejos | Modal resolución manual + audit log de conflictos. |
| Re-import sobreescribe datos manuales | Diff inteligente + confirm fila por fila. Nunca apply automático. |
| Curva onboarding sigue alta | Tour 5 pasos + tooltips contextuales + empty states con CTA. |
| IA genera resultados incorrectos | Auditable (prompt + datos + modelo + ID), no toma acciones automáticas. |
| Migración compleja desde estado actual | Phased: data model + auth + plantas → drawer ejec → dashboard tabs → mobile/visual. Cada fase deployable independiente. |

---

## 14. Métricas de éxito

| Métrica | Target |
|---|---|
| Tiempo desde login hasta primer registro útil (nuevo usuario) | < 60s |
| Tareas registradas con HH real (vs "marca hecha sin dato") | > 90% |
| Tareas registradas con al menos 1 evidencia | > 70% |
| Click-through desde KPI Hoy a tab Análisis filtrado | > 30% sesiones |
| Retorno mobile/desktop | > 30% mobile en operadores |
| Lighthouse performance / accessibility | ≥ 90 / ≥ 95 |

---

## 15. Plan de rollout (alto nivel)

Sugerencia para el plan de implementación (la spec NO prescribe milestones, eso lo define el plan):

1. **Foundations** — Prisma model + migrations + endpoints CRUD básicos + tests unit.
2. **Plantas + plan de mantención** — listado + drawer + detalle (tabs Resumen/Plan/Equipos).
3. **Ejecución** — drawer registro + estados + storage evidencia + endpoint protegido + audit.
4. **Dashboard tabs** — Hoy + Semana + Análisis (cross-filter) reemplazando home actual.
5. **IA tab** — templates guiados + prompt libre + historial.
6. **Mobile + offline** — bottom nav + FAB + service worker + IndexedDB queue.
7. **Sistema visual + accesibilidad** — tokens + dark mode + atajos + onboarding tour + i18n.
8. **Importación** — wizard + diff + saved mappings.

Cada fase deployable independiente (feature flags si convive con UI vieja).

---

## 16. Preguntas abiertas

- ¿Las notificaciones Web Push se incluyen en fase 1 o quedan post-launch?
- ¿El template "Reporte ejecutivo mensual" requiere generación de PDF server-side? (libreria: puppeteer / pdfkit / wkhtmltopdf).
- ¿Se mantiene la página `/dashboard/tareas` (catálogo maestro) o se elimina al pasar tareas a vivir dentro de plantas?
- ¿La página `/dashboard/admin` actual se redistribuye en Usuarios + Auditoría + Importación, o se mantiene como agregador?

---

**Fin de la spec. Estado: aprobada por el usuario, lista para plan de implementación.**

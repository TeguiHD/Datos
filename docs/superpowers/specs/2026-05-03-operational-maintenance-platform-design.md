# Plataforma operacional de mantención — Propuesta de valor real

**Fecha:** 2026-05-03  
**Contexto fuente:** `EXCEL DATOS.xlsx`, código actual `datos-nicoholas`, documentación `MAINTENANCE_ENGINE.md`  
**Estado:** Propuesta funcional / UX para convertir el sistema en herramienta diaria, no maqueta

## Tesis

El producto no debe ser "un dashboard para ver el Excel". Debe ser un **sistema operacional liviano de mantención preventiva** que toma un Excel SAP-PM difícil de manejar y lo convierte en:

1. una cartera editable de plantas/ubicaciones/equipos/intervenciones;
2. un calendario vivo de ocurrencias y HH;
3. una bandeja de trabajo para planificar, asignar, ejecutar y cerrar;
4. una fuente auditable de evidencia y cambios;
5. una capa de inteligencia para decidir qué hacer primero.

La propuesta de valor real es ahorrar tiempo diario al planificador y reducir pérdida de control: menos búsqueda manual en Excel, menos columnas horizontales, menos dudas sobre qué toca, menos intervención sin respaldo, más trazabilidad.

## Lo que el Excel realmente representa

El archivo `EXCEL DATOS.xlsx` no es una lista plana. Es un plan maestro horizontal:

- 542 registros operacionales detectados desde la fila 9.
- 115 columnas totales.
- 29 columnas base de definición SAP-PM.
- 84 columnas mensuales desde enero 2022 hasta diciembre 2028.
- 4.599 ocurrencias mensuales con HH positivas.
- 103.085 HH planificadas en el horizonte importado.
- 199 ubicaciones técnicas únicas.
- 182 denominaciones de planta/ubicación únicas.
- 315 intervenciones únicas.
- ABC: A=211, B=131, C=188, sin ABC=12.
- Frecuencia en meses: 12=309, 6=151, 60=59, 1=9, 3=6, 48=6, sin frecuencia=2.
- Área responsable operacional: ELEMEC=324, ELEMEC_N=159, I&C=57, sin responsable=2.
- 77 filas tienen comentario de inactivo/verificar/revisar.

No se expone nombre de operadores en esta propuesta. Cualquier campo de operador/persona debe tratarse como dato sensible: visible solo con permisos, oculto por defecto en reportes y exportaciones generales.

## Diagnóstico del sistema actual

### Fortalezas existentes

- Parser Excel con fila 8 como header y data desde fila 9.
- Importación con preview/dry-run, límite de tamaño y validación MIME/magic bytes.
- Modelo base correcto: `MaintenanceTask`, `MonthlySchedule`, `TaskExecution`.
- Motor de materialización que genera ocurrencias futuras, marca vencidas y detecta discrepancias.
- CRUD parcial de tareas y calendario.
- Estados de ejecución (`PENDING`, `OVERDUE`, `DONE`, `SKIPPED`).
- Auditoría de cambios.
- Dashboard, cronograma, analytics, importación, tareas, chat IA.

### Brechas que impiden valor diario

- El modelo todavía mezcla "planta", "ubicación técnica", "equipo" e "intervención" dentro de `MaintenanceTask`; falta una navegación natural por planta.
- La edición existe en API, pero la UI no se siente como flujo completo de mantenimiento.
- No hay entidad fuerte para evidencia: fotos, documentos, checklist, firma, mediciones, antes/después.
- No hay asignación operacional clara sin exponer personas: falta equipo/rol/cuadrilla/área y opción de persona privada.
- No hay tablero diario tipo "qué hago hoy / esta semana / por planta".
- La ejecución se cierra con HH real, operador y notas, pero falta flujo guiado: preparar, ejecutar, evidenciar, cerrar, generar correctivo si aparece hallazgo.
- Importar Excel actualiza por `sourceRowHash`; si se edita una tarea real, el hash puede dificultar reconciliación futura. Falta identidad estable por clave de negocio.
- El cronograma muestra HH, pero no permite actuar directamente sobre una celda mes/planta.
- El sistema tiene analytics, pero falta priorización operacional: ABC A vencida, alta HH, frecuencia crítica, plantas inactivas/verificar.

## Referencias de productos reales

Se toman ideas, no clones:

- Fiix plantea el flujo base de work order: identificar, crear, priorizar/programar, asignar/ejecutar, cerrar/documentar y analizar. Referencia: https://fiixsoftware.com/cmms/work-orders/
- Fiix también refuerza activos, PM scheduling, dashboards, QR y móvil offline como piezas de CMMS moderno. Referencia: https://fiixsoftware.com/cmms/features/
- MaintainX offline funciona con cache de work orders próximos y sincronización posterior. Referencia: https://help.getmaintainx.com/offline-mode
- SAP Service and Asset Manager prioriza app persona-céntrica, offline, work execution, captura de datos de activos y formularios. Referencia: https://www.sap.com/canada/products/scm/asset-manager/features.html
- IBM Maximo Mobile separa roles: aprobaciones, activos, inspecciones, técnico, inventario, evidencia, actuals, follow-up work. Referencia: https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=overview-maximo-mobile

## Producto objetivo

### Principio

El usuario debe entrar y responder en menos de 30 segundos:

- ¿Qué plantas requieren intervención?
- ¿Cuántas HH necesito?
- ¿Qué está vencido?
- ¿Qué está listo para ejecutar?
- ¿Qué falta asignar?
- ¿Qué intervenciones necesitan evidencia?
- ¿Qué cambió respecto al último Excel?
- ¿Qué debo corregir en el maestro?

### Personas

- **Planificador:** importa Excel, corrige maestro, programa mes/semana, asigna área/cuadrilla, revisa carga HH.
- **Supervisor:** aprueba plan, redistribuye carga, valida cierres y evidencia.
- **Ejecutor de terreno:** ve órdenes asignadas, trabaja offline, registra HH, notas y evidencia.
- **Administrador:** gestiona usuarios, permisos, catálogos, importaciones, auditoría.
- **Viewer:** revisa estado y reportes sin ver operadores/personas.

## Arquitectura funcional propuesta

### Módulos principales

1. **Centro operacional**
   - Primera pantalla real.
   - Bandejas: Vencidas, Esta semana, Este mes, Sin asignar, Con alerta, En revisión.
   - KPIs accionables: HH por ejecutar, HH vencidas, ABC A vencidas, plantas críticas, evidencia pendiente.

2. **Plantas**
   - Vista por planta/ubicación técnica.
   - Cada planta muestra: intervenciones, equipos, HH 12 meses, vencidas, responsable operacional, evidencia reciente, historial.
   - Permite entrar a una planta y operar sin pasar por tabla global.

3. **Intervenciones**
   - Maestro editable de tareas SAP-PM.
   - Campos base del Excel + campos operacionales nuevos.
   - Edición individual y masiva.
   - Estado maestro: activa, inactiva, verificar, requiere revisión, bloqueada.

4. **Planificador**
   - Calendario mensual/semanal de HH.
   - Agrupación por planta, área responsable, ABC, PSR, frecuencia.
   - Drag/drop o reasignación de ocurrencias.
   - Detección de sobrecarga por semana/área.

5. **Órdenes / ejecuciones**
   - Una ocurrencia concreta de `TaskExecution`.
   - Flujo: pendiente → asignada → en progreso → hecha / omitida / requiere correctivo.
   - Registro de HH real, notas, checklist, evidencia y cierre.

6. **Evidencia**
   - Adjuntos por ejecución: foto, PDF, documento, comentario, checklist, medición.
   - Evidencia requerida por tipo de intervención.
   - Redacción/privacidad: no exponer operadores en listados generales.

7. **Importación y reconciliación**
   - Dry-run actual se transforma en "comparador de cambios".
   - Diferencia entre: nueva planta, intervención modificada, HH mensual modificada, fila inactiva, posible duplicado.
   - Permite aceptar/rechazar cambios antes de aplicar.

8. **Auditoría y control**
   - Historial por planta/intervención/ejecución.
   - Quién cambió qué, cuándo, antes/después.
   - Exportaciones controladas por rol.

9. **Copilot operacional**
   - No reemplaza la UI.
   - Responde preguntas y genera filtros.
   - Sugiere acciones: "ABC A vencidas con más HH", "plantas con 3+ intervenciones vencidas", "qué cambió del Excel".

## Cambios de modelo de datos recomendados

### Entidades nuevas o reforzadas

```prisma
model Plant {
  id          String @id @default(cuid())
  code        String? // derivado de ubicacionTecnica raíz o centro
  name        String
  locationKey String? @unique
  status      String @default("ACTIVE") // ACTIVE, INACTIVE, REVIEW
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model WorkAssignment {
  id          String @id @default(cuid())
  executionId String
  assigneeType String // AREA, CREW, USER
  assigneeKey  String // ELEMEC, I&C, crew id, user id privado
  plannedStart DateTime?
  plannedEnd   DateTime?
  status       String @default("ASSIGNED")
  createdAt    DateTime @default(now())
}

model ExecutionEvidence {
  id          String @id @default(cuid())
  executionId String
  type        String // PHOTO, FILE, NOTE, CHECKLIST, MEASUREMENT
  url         String?
  content     Json?
  redacted    Boolean @default(false)
  createdById String?
  createdAt   DateTime @default(now())
}

model ChecklistTemplate {
  id          String @id @default(cuid())
  name        String
  appliesTo   Json // frecuencia, abc, clase, equipo, etc.
  fields      Json
  active      Boolean @default(true)
}

model ImportChange {
  id          String @id @default(cuid())
  importRunId String
  entityType  String
  entityKey   String
  changeType  String // CREATE, UPDATE, DELETE_CANDIDATE, SCHEDULE_CHANGE
  before      Json?
  after       Json?
  status      String @default("PENDING") // ACCEPTED, REJECTED
}
```

### Clave estable de importación

No depender solo de `sourceRowHash`. Crear una clave de negocio:

```ts
businessKey = centroPlanificacion + planMantPreventivo + posicionMant + ubicacionTecnica + equipo + descPosicionMant
```

El hash sirve para detectar cambios, no para identificar definitivamente una tarea.

## UX objetivo

### Pantalla 1: Centro operacional

Debe ser densa, clara y accionable:

- Header compacto con fecha operacional y estado de sync.
- 4 bandejas principales: Vencidas, Semana, Mes, Sin asignar.
- Tabla/canvas de trabajo: filas priorizadas por riesgo.
- Panel lateral de detalle rápido.
- Acciones masivas: asignar área, cambiar fecha, marcar en revisión, exportar.

No usar hero, tarjetas decorativas ni texto explicativo largo. Es una herramienta de trabajo repetitivo.

### Pantalla 2: Planta

Vista natural para el usuario:

- Encabezado: planta/ubicación, estado, HH próximas, vencidas, responsable operacional.
- Tabs: Intervenciones, Calendario, Evidencia, Historial.
- Línea de tiempo 12 meses con HH e hitos.
- Lista de intervenciones con filtros por ABC, frecuencia, estado.
- Acción primaria: "Planificar intervención" o "Abrir orden".

### Pantalla 3: Orden de trabajo

Vista mobile-first:

- Qué hay que hacer.
- Dónde.
- Equipo/ubicación.
- HH plan vs HH real.
- Checklist.
- Evidencia.
- Notas.
- Cerrar / omitir / generar correctivo.

El operador/persona no aparece en listados generales. En cierre se puede capturar internamente según permisos.

### Pantalla 4: Importación

Evolucionar desde "subir archivo" a "control de cambios":

- Paso 1: subir.
- Paso 2: validar estructura.
- Paso 3: resumen de impacto.
- Paso 4: diff por categoría.
- Paso 5: aplicar.
- Paso 6: reconstruir plan y mostrar consecuencias.

Ejemplos de impacto:

- 18 intervenciones nuevas.
- 34 HH cambiadas en 2026.
- 7 plantas inactivas detectadas.
- 12 filas sin ABC.
- 2 filas sin responsable operacional.

## Reglas UI/UX

- Mobile-first real: tabla se convierte en tarjetas operables en terreno.
- Tablas de escritorio con columnas congeladas: planta/intervención, vencimiento, ABC, HH, estado.
- Filtros como chips persistentes y guardables.
- Bulk actions visibles solo al seleccionar filas.
- Estados claros, no solo color: Pendiente, Vencida, Hecha, Omitida, En revisión, Sin asignar.
- Error messages con `role="alert"`; no solo borde rojo.
- Inputs numéricos con `inputMode="decimal"` para HH.
- Sin exponer nombres de operadores en vistas generales, exportaciones ni analytics por defecto.
- Sin paleta one-note. Recomendación: base neutra clara/oscura, acento azul operacional, danger rojo, warning ámbar, ok verde. Evitar estética "marketing".
- Componentes shadcn existentes: `Button`, `Badge`, `Dialog`, `Sheet`, `Select`, `DropdownMenu`, `Tooltip`, `Skeleton`. Agregar `Table`, `Tabs`, `Alert`, `Checkbox`, `Textarea`, `ToggleGroup` cuando se implemente.

## Flujos completos

### Flujo A: Del Excel al plan vivo

1. Admin sube Excel.
2. Sistema detecta estructura y cabecera fila 8.
3. Genera preview con:
   - filas válidas;
   - HH mensuales;
   - duplicados;
   - filas con revisar/inactivo;
   - cambios vs base actual.
4. Admin acepta cambios por categoría.
5. Sistema actualiza maestro y schedule.
6. Motor materializa `TaskExecution`.
7. Centro operacional muestra impacto inmediato.

### Flujo B: Planificación semanal

1. Planificador abre Centro Operacional.
2. Filtra "esta semana + ABC A/B + sin asignar".
3. Agrupa por planta o responsable operacional.
4. Selecciona 20 ocurrencias.
5. Asigna área/cuadrilla y fecha objetivo.
6. Sistema avisa sobrecarga HH.
7. Supervisor aprueba.

### Flujo C: Ejecución en terreno

1. Ejecutor abre "Mis órdenes" o QR de planta.
2. Ve órdenes cacheadas para offline.
3. Abre orden: ubicación, equipo, intervención, checklist.
4. Registra HH real, notas y evidencia.
5. Cierra como hecha u omitida.
6. Si detecta hallazgo, crea correctivo/follow-up.
7. Al volver online, sincroniza.

### Flujo D: Revisión y mejora

1. Supervisor revisa cierres sin evidencia o con HH real desviada.
2. Reabre o aprueba cierre.
3. Analytics muestra desviaciones por planta/frecuencia/ABC.
4. Planificador corrige maestro o frecuencia si aplica.

## PWA/offline

Inspiración MaintainX/SAP/Maximo: offline no significa cachear todo. Debe cachear lo que el usuario necesita:

- órdenes asignadas;
- próximas órdenes por planta/área;
- catálogos mínimos: estados, ABC, responsables operacionales;
- checklist templates;
- evidencia pendiente de sync.

Reglas:

- Cache por usuario/rol.
- Cola local de mutaciones.
- Conflictos por `updatedAt`/version.
- Si una orden cambió en servidor mientras estaba offline, mostrar diff antes de sobrescribir.
- Adjuntos grandes se suben al reconectar.

## Privacidad y permisos

- `VIEWER`: no ve operador/persona, solo área responsable y estado.
- `EDITOR`: puede cerrar órdenes y subir evidencia; ve solo sus asignaciones/personas autorizadas.
- `ADMIN`: ve datos operacionales completos.
- Exportaciones generales omiten operador/persona salvo permiso explícito.
- Audit log mantiene trazabilidad interna.

## Roadmap recomendado

### Fase 1 — Fundamento operacional (2-3 semanas)

- Crear navegación por Planta.
- Crear detalle de Planta.
- Rehacer Centro Operacional como bandeja de trabajo.
- Mejorar tabla de ejecuciones con selección masiva.
- Crear flujo de asignación por área/cuadrilla.
- Ocultar operadores/personas por rol.

### Fase 2 — Edición y control de cambios (2-3 semanas)

- Formulario completo de intervención.
- Edición masiva de ABC/frecuencia/responsable/estado maestro.
- Import diff con `ImportChange`.
- Clave estable de negocio.
- Pantalla de discrepancias y filas "verificar/inactivo".

### Fase 3 — Ejecución y evidencia (3-4 semanas)

- Detalle de orden mobile-first.
- Evidencia: fotos/documentos/notas/checklists.
- Checklist templates por tipo/frecuencia.
- Revisión de cierre.
- Correctivos/follow-up desde ejecución.

### Fase 4 — PWA/offline (3-5 semanas)

- Service worker.
- Cache de órdenes.
- Cola de mutaciones.
- Resolución de conflictos.
- Sync de adjuntos.

### Fase 5 — Inteligencia operacional (continuo)

- Copilot sobre `/api/ai/ask`.
- Recomendaciones de prioridad.
- Detección de anomalías: HH fuera de rango, plantas inactivas con plan, frecuencia incoherente.
- Reportes programados.

## Métricas de valor

- Tiempo para saber "qué toca esta semana": objetivo < 30 s.
- Tiempo para cerrar una orden simple: objetivo < 90 s en móvil.
- % órdenes con evidencia requerida completa.
- % HH reales capturadas vs plan.
- Vencidas ABC A.
- Filas Excel con problemas corregidas.
- Diferencia HH planificada Excel vs motor.
- Tiempo de importación con revisión.
- Uso de vistas guardadas y acciones masivas.

## Decisión recomendada

No conviene partir por más gráficos. Conviene partir por **Centro Operacional + Planta + Orden**.

La plataforma debe sentirse como:

> "Abro el sistema, veo mis plantas y mis intervenciones, sé qué requiere HH, asigno, ejecuto, evidencio y cierro. El Excel queda como fuente/importación, no como forma de trabajar."


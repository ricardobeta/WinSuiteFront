# Arquitectura de WinSuit

> Estado: agosto 2026. Este documento describe el sistema completo, no solo el frontend.
> Ver también: [PLAN_MEJORAMIENTO_2026.md](./PLAN_MEJORAMIENTO_2026.md) · [SEGURIDAD_HALLAZGOS_2026.md](./SEGURIDAD_HALLAZGOS_2026.md) · [COLABORADORES_RBAC_GUIDE.md](./COLABORADORES_RBAC_GUIDE.md) · [SITIO_WEB_UX_UI_AUDIT.md](./SITIO_WEB_UX_UI_AUDIT.md)

---

## 1. Topología: cinco repositorios, no un monorepo

El directorio de trabajo raíz **no es un repositorio git**. Contiene cinco repos independientes más carpetas de material suelto.

| Repositorio | Ruta | Qué es |
|---|---|---|
| **winsuite** | `Frontend/winsuite` | SPA principal del ERP. Angular 21 standalone. *(este repo)* |
| **winsuite-sites** | `Frontend/winsuite-sites` | Renderer SSR público de los sitios y landings publicados por los tenants. Angular 21 + Express. |
| **winsuite-bloques** | `Frontend/winsuite-bloques` | Librería *source-only* de bloques de contenido. Montada como **submódulo git** en `libs/bloques` de los otros dos frontends. |
| **win-server** | `WinServer/win-server` | Backend Spring Boot 4, arquitectura hexagonal. Paquete `com.win.tenant.win_server`. |
| **sri-worker** | `sri-worker` | Worker Python + Playwright que automatiza el portal del SRI. Se empaqueta como agente Windows local. |

**Sincronización de la librería de bloques:** `npm run check:bloques` verifica que el submódulo esté alineado. No está enganchado a ningún hook — hay que ejecutarlo manualmente.

---

## 2. Stack

### Frontend (`Frontend/winsuite`)

- **Angular 21** standalone, signals, preparado para zoneless
- **Angular Material 21** + CDK · Material Symbols Outlined
- `firebase` 11 + `@angular/fire` 21 (⚠️ release candidate, ver H17)
- ECharts 6 (`ngx-echarts`) · `angular-gridster2` (dashboard) · FullCalendar 7 · `@foblex/flow` (constructor de flujos) · `driver.js` (tours) · `papaparse` · `zod` · `dayjs` · `temporal-polyfill`
- Dev: `vitest` 4 + `jsdom`, `prettier`, `firebase-tools`. **No hay ESLint.**

### Backend (`WinServer/win-server`)

- **Spring Boot 4** sobre **Java 21**, arquitectura hexagonal
- `firebase-admin` (RTDB + Storage vía Admin SDK) — **no hay base relacional**
- **Spring AI 2.0** con `spring-ai-anthropic` y `spring-ai-google-genai`
- `bucket4j` + `caffeine` (rate limiting) · **BouncyCastle** (firma XAdES del SRI) · Apache POI · PDFBox + openhtmltopdf · zxing
- Se despliega como monolito en Docker. **No hay Cloud Functions.**

---

## 3. Modelo multi-tenant

Cada empresa es un **tenant** con su propio espacio en RTDB. Una cuenta de usuario puede pertenecer a varias empresas (`MiembroEmpresa`, `EmpresaDeCuenta`) y cambiar entre ellas sin cerrar sesión.

### 3.1 Flujo de autenticación y sesión

```
1. signInWithEmailAndPassword / signInWithPopup (Google)
        ↓
2. POST /api/auth/session/bootstrap   { preferredTenantId, sessionId }
        ↓  el backend valida membresía y emite un custom token
3. custom token con claims: tenantId + sessionId + sessionVersion
        ↓
4. signInWithCustomToken  →  sesión activa sobre un tenant concreto

Cambio de empresa:  POST /api/auth/session/switch  → reemite el token
```

- `sessionId` se genera por dispositivo con `crypto.randomUUID()`.
- `sessionVersion` es incrementable: **permite revocación instantánea** (expulsar a un colaborador o forzar cierre de sesión surte efecto sin esperar la caducidad del token).
- `remember = false` → `browserSessionPersistence`.
- Código: `core/services/auth.service.ts` · backend `infrastructure/config/JwtAuthenticationFilter.java`.

### 3.2 Aislamiento en las reglas RTDB

El proyecto principal exige **cuatro condiciones simultáneas** en cada nodo de negocio:

```
auth.token.tenantId === $tenantId
&& auth.token.sessionId != null && auth.token.sessionVersion != null
&& auth_sessions/{uid}/{sessionId}/activeTenantId === $tenantId
&& auth_sessions/{uid}/{sessionId}/version === auth.token.sessionVersion
&& tenant_users/{tenantId}/{uid}/active === true
```

No basta el claim: se valida la sesión viva, su versión y la membresía activa. El backend replica la comprobación server-side antes de fijar `TenantContext`.

Raíz de las tres bases: `.read: false, .write: false`. Los nodos `platform_*` (facturación de la plataforma) están explícitamente cerrados al cliente y solo son accesibles vía Admin SDK.

> ⚠️ **Limitación conocida:** estas reglas aíslan *entre empresas*, pero **no comprueban el rol dentro de una empresa**. El RBAC de la UI es evadible escribiendo directo a RTDB. Ver hallazgo [H02](./SEGURIDAD_HALLAZGOS_2026.md#h02).

### 3.3 Tres proyectos Firebase separados

| Proyecto | Reglas | Propósito |
|---|---|---|
| Principal | `realtime-database.rules.json`, `storage.rules` | Datos operativos de los tenants |
| Auditoría | `audit-realtime-database.rules.json` (`firebase.audit.json`) | Audit log. `.read/.write: false` en todo el árbol: **solo Admin SDK**. El cliente no puede falsificar ni borrar eventos. |
| Sitios | `sites-realtime-database.rules.json`, `sites-storage.rules` (`firebase.sites.json`) | Sitios web publicados. Lectura pública del media; el resto por tenant. |

Migración documentada en `FIREBASE_SPLIT_MIGRATION.md`. El puente de sesión entre proyectos vive en `core/services/sites-firebase-session.service.ts` ↔ `SitesFirebaseTokenController.java`.

---

## 4. Estructura del frontend

```
src/app/
├── core/
│   ├── config/        module-catalog.ts, dashboard-defaults.ts, tour-steps/
│   ├── firebase/      inicialización de las apps Firebase
│   ├── guards/        permission.guard.ts (moduleAccessGuard, workspaceAuthGuard, platformAdminGuard)
│   ├── interceptors/  auth.interceptor.ts (Bearer token), quota.interceptor.ts (HTTP 402 → diálogo de límite)
│   ├── models/        rbac.models.ts, platform.models.ts, notification.models.ts…
│   └── services/      auth, audit, authorization, plan, archivos, tema, tours, notificaciones…
├── shared/            componentes, directivas, adaptadores y utilidades reutilizables
│                      (config-copilot-panel, limite-alcanzado-dialog, table-column-picker,
│                       operational-tables.registry.ts, EcuadorDateAdapter, appTwoDecimalInput…)
└── features/          20 módulos funcionales (ver §5)
```

Cada feature aporta sus propias `*.routes.ts`, `pages/`, `components/`, `services/` y `models/`, cargadas con lazy loading desde `app.routes.ts`.

**Registro de módulos:** `core/config/module-catalog.ts` es la fuente única de qué módulos existen, cuáles son contratables y cuáles están bloqueados. `moduleAccessGuard` lo consulta para permitir o denegar la ruta. *(Nómina todavía no está registrada — ver [H09](./SEGURIDAD_HALLAZGOS_2026.md#h09).)*

Para añadir un módulo nuevo con RBAC, seguir la receta de [COLABORADORES_RBAC_GUIDE.md](./COLABORADORES_RBAC_GUIDE.md).

---

## 5. Módulos funcionales

| Grupo | Módulos |
|---|---|
| **Operación comercial** | `ventas` (POS retail/restaurante, sesiones de caja, cuentas abiertas, informes) · `clientes` · `servicios` · `inventario` (productos, variantes, recetas/BOM, kardex, almacenes, proveedores, órdenes de compra, costos) |
| **Financiero** | `contabilidad` — el módulo más grande: plan de cuentas, asientos, períodos, compras y carga masiva de XML, cuentas por pagar, bancos y conciliación, reportes y estados financieros, ATS, cumplimiento SRI · `nomina` (UI; la lógica vive en `contabilidad`) |
| **Fiscal** | `facturacion` (firmas electrónicas, establecimientos y puntos de emisión, descargas del SRI) |
| **Crecimiento** | `asistente-ventas` (WhatsApp: instancias, plantillas, flujos, conversaciones, funnels, base de conocimiento) · `sitio-web` (constructor visual, catálogo ecommerce, pedidos, pagos, dominios) |
| **Administración** | `colaboradores` (RBAC) · `empresa` (general, IA, calendario, notificaciones) · `auditoria` · `archivos` · `settings` |
| **Plataforma SaaS** | `planes` (consumo, upgrade, checkout) · `super-admin` (fuera del workspace, tras `platformAdminGuard`) |
| **Transversal** | `dashboard` (widgets configurables) · `workspace` (shell, navegación, copiloto global) · `auth` · `legal` (páginas públicas) |

---

## 6. Backend: arquitectura hexagonal

```
com.win.tenant.win_server/
├── domain/model/          entidades puras: facturacion, ats, platform, whatsapp, bancos, nomina…
├── application/
│   ├── port/in|out/       contratos de entrada y salida
│   └── service/           casos de uso: contabilidad, bancos, nomina, whatsapp, platform, ai/
└── infrastructure/
    ├── web/               controladores REST
    ├── adapter/           implementaciones de los puertos de salida
    ├── config/            seguridad, JWT, CORS, propiedades
    └── service/           generadores de PDF y utilidades técnicas
```

**Adaptadores destacados:** `XmlGenerationAdapter` (XML tributario JAXB) · `DigitalSignatureAdapter` (firma XAdES con BouncyCastle) · `SriIntegrationAdapter` (recepción y autorización) · `XmlParsingAdapter` (parseo de comprobantes recibidos) · `AtsXmlGenerationAdapter` · `MetaWhatsAppCloudAdapter` (+ variante stub) · `PayPhoneAdapter` · `PoiCsvExtractoParserAdapter` (extractos bancarios).

**Generación de documentos:** todos los PDF se producen en el backend con openhtmltopdf + PDFBox (`InvoiceRidePdfService`, `ContabilidadReportesPdfService`, `NominaComprobantePdfService`, `BancosReportesPdfService`…). El frontend no genera PDF.

---

## 7. Capa SaaS de plataforma

Modelo de dos niveles: **`AccountPlan`** (por cuenta, controla cuántas empresas propias y vinculadas) y **`CompanyPlan`** (por empresa).

**Límites** (`PlanLimits`): `storageBytes`, `sitesMediaBytes`, `sitiosEcommerce`, `sitiosLanding`, `aiTokensMes`, `facturasSriMes`, `descargasSriMes`, `colaboradores`, `sriWorkerHabilitado`. El valor `-1` significa sin límite.

**Plan efectivo** = plan del catálogo + `limitesOverride` + `modulosExtra` de los complementos contratados. Lo resuelve `PlanResolutionService` con caché de 30 s y ciclo mensual en `America/Guayaquil`.

**Enforcement.** `QuotaService` y sus especializaciones (`StorageQuotaService`, `SiteQuotaService`, `CollaboratorUsageCounter`, `AiUsageGateway`) lanzan `QuotaExceededException` → el backend responde **HTTP 402** → `core/interceptors/quota.interceptor.ts` lo captura y abre `shared/components/limite-alcanzado-dialog` con salida a la compra.

> Regla de diseño explícita: **quien decide si una operación cabe en el plan es siempre el backend.** El frontend solo muestra el resultado.

**Cobro.** Órdenes con máquina de estados `PENDIENTE_PAGO → PENDIENTE_VERIFICACION → APLICANDO → PAGADA | RECHAZADA | ANULADA`. Métodos: Payphone (confirmación server-side), transferencia bancaria con comprobante, y QR.

**Super-admin.** `features/super-admin` fuera del workspace, tras `platformAdminGuard` en el front y autorización real en `/api/platform/**`. La allowlist es por email verificado en variable de entorno; **no hay rol de plataforma persistido**, por lo que no existe escalada de privilegios desde dentro de un tenant.

---

## 8. Capa de IA

Tres copilotos distintos, todos sobre Spring AI 2.0 (Anthropic + Google GenAI). **Ninguna clave de proveedor llega al navegador**: todo pasa por el backend.

| Copiloto | Alcance | Dónde |
|---|---|---|
| **Global (read-only)** | Responde preguntas sobre el producto y los datos del tenant. No escribe. | `features/workspace/layout/global-copilot` · `AiCopilotController` |
| **De configuración** | *Plan → confirmar → escribir.* Tool calling con validador por acción. | `shared/components/config-copilot-panel` · `application/service/ai/config/` |
| **Público (pre-login)** | Responde sobre WinSuit a visitantes no autenticados. | `features/auth/components/public-copilot-dialog` · `PublicCopilotController` |

**Punto de extensión `ConfigToolSet`.** Cada pantalla de configuración que quiera copiloto implementa un `ConfigToolSet` con sus Read/Write tools y su `ActionValidator`. Hoy existen cuatro: `inventario/`, `contabilidad/`, `facturacion/`, `clientes/`. El bucle lo orquesta `ConfigToolLoop` sobre `ConfigToolRegistry`. Ver la skill `winsuite-config-copilot` para el procedimiento completo.

**RAG.** `CopilotKnowledgeIndexService` indexa `src/main/resources/ai/winsuite-knowledge-base.md` con embeddings, de forma incremental por hash SHA-256, al arranque y por cron diario. Detalles en `AI_COPILOT_KNOWLEDGE_INDEX.md`.

**Otros usos de IA:** generación y edición de sitios web (`AiSiteGeneratorApplicationService`, con validador de blueprint), mapeo automático de columnas de extractos bancarios y sugerencia de conciliación (`AiExtractoMappingService`, `AiConciliacionSuggestionService`), y los nodos de IA de los flujos de WhatsApp.

**Conector por tenant:** una empresa puede aportar su propia API key (`TenantAiConnector`), configurable en `features/empresa/pages/empresa-ia`.

---

## 9. Auditoría

Todo evento relevante se escribe **siempre vía backend** (`POST /api/audit/events`) al proyecto Firebase de auditoría, que el cliente no puede escribir ni borrar. El modelo exige `tenantId, timestamp, userId, actor, action, origin, module, entityType, entityId, target, summary` y guarda `changesBefore` / `changesAfter`. Se consulta paginado con cursor desde `features/auditoria`.

---

## 10. Despliegue

| Componente | Cómo se despliega |
|---|---|
| **winsuite** (este repo) | Firebase Hosting, target `dashboard`. `npm run deploy:hosting` (o `deploy:hosting:direct`). **Manual, sin CI** — ver [H07](./SEGURIDAD_HALLAZGOS_2026.md#h07). |
| **winsuite-sites** | Docker → GitHub Actions → GHCR → Dokploy en VPS → Traefik → Cloudflare, wildcard `*.winsuit.app`. Auto-deploy desactivado; se promueve por tag `sha-<commit>`. Ver `DEPLOYMENT.md` de ese repo. |
| **win-server** | Docker Compose en el mismo VPS, expuesto en `api.winsuit.app` (registro DNS exacto, con prioridad sobre el wildcard). **Manual, sin CI.** |
| **sri-worker** | Contenedor + agente Windows empaquetado con PyInstaller (GitHub Actions, release por tag `v*`). Corre en la máquina del cliente escuchando en `127.0.0.1:8010`. |

**Reglas de seguridad:** se despliegan con `firebase deploy --only database,storage` usando los tres targets. Hoy **sin tests automáticos** que las validen.

---

## 11. Convenciones del proyecto

- **Marca:** se escribe **WinSuit**. Carpetas, nombre de paquete, claves de `localStorage` y recursos externos conservan `winsuite` a propósito — no renombrar.
- **Importes monetarios:** siempre `type="text"` + directiva `appTwoDecimalInput`. Con `type="number"` el teclado numérico móvil pierde el punto decimal.
- **Fechas:** siempre `matDatepicker` con `EcuadorDateAdapter`, nunca `type="date"`. El adaptador acepta `02122026` tecleado de corrido, que es como escriben los contadores.
- **Localización:** `LOCALE_ID: 'es-EC'` fijo, `America/Guayaquil`, `SpanishPaginatorIntl`. No hay i18n.
- **Tema:** design system "Tactile Clarity" documentado en `DESIGN.md`. Tokens en `src/styles/_tokens.scss` + `_material-mapping.scss`. Dark mode funcional vía `core/services/theme.service.ts`.
- **Onboarding:** tours guiados con `driver.js`, definidos en `core/config/tour-steps/`.

# Plan de mejoramiento de WinSuit — 2026

> Documento maestro de producto. Fuente única para planificar los próximos 6-9 meses.
> Cada épica está redactada para poder pasarse como especificación de implementación.
>
> **Estado del producto al escribir este documento:** piloto con 1-5 empresas · mercado objetivo PYME Ecuador (SRI).
> **Fecha:** agosto 2026 · **Documentos hermanos:** [SEGURIDAD_HALLAZGOS_2026.md](./SEGURIDAD_HALLAZGOS_2026.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [SITIO_WEB_UX_UI_AUDIT.md](./SITIO_WEB_UX_UI_AUDIT.md)

---

## Índice

1. [Análisis de mercado](#1-análisis-de-mercado)
2. [Diagnóstico: madurez por módulo](#2-diagnóstico-madurez-por-módulo)
3. [Épicas](#3-épicas)
   - [F0 · Seguridad y continuidad](#f0--seguridad-y-continuidad-bloqueante)
   - [F1 · Cumplimiento fiscal 2026](#f1--cumplimiento-fiscal-2026)
   - [F2 · Cerrar el ciclo comercial](#f2--cerrar-el-ciclo-comercial)
   - [F3 · Capa SaaS comercial](#f3--capa-saas-comercial)
   - [F4 · IA y diferenciación](#f4--ia-y-diferenciación)
   - [F5 · Producto y escalabilidad](#f5--producto-y-escalabilidad)
4. [Roadmap por fases](#4-roadmap-por-fases)
5. [Métricas de seguimiento](#5-métricas-de-seguimiento)
6. [Fuentes](#6-fuentes)

---

## 1. Análisis de mercado

### 1.1 Competencia directa en Ecuador

| Actor | Posición | Precio referencia | Debilidad explotable |
|---|---|---|---|
| **Siigo Contífico** | Líder instalado en EC. Parte del grupo Siigo (1M+ clientes LatAm; adquirió Aspel en México). Arquitectura modular: contabilidad, facturación, nómina y POS se contratan por separado. | ~USD 41–111 | El precio se dispara al sumar nómina + inventario. UX heredada. IA incipiente. |
| **Alegra** | Regional (CO/EC/MX/PE). ~30 funciones de IA nativas. **Alegra MCP**: primer conector oficial LatAm para consultar la contabilidad desde ChatGPT/Claude/Perplexity. Trial de 15 días sin tarjeta. | USD ~15–60/mes | Contabilidad y facturación fuertes, pero **ERP operativo débil**: sin POS de restaurante, sin recetas/BOM, multi-bodega limitado. |
| **Ecuafact · Factuplan · Anfibius · Dergest** | Facturadores electrónicos puros, muy baratos, muy enfocados. | USD 10–30/mes | Solo emiten comprobantes. Sin contabilidad, inventario ni nómina reales. El cliente los abandona al crecer. |
| **Odoo · Defontana** | ERP completo y configurable. | Implementación USD 3k+ | Implementación cara y lenta. No nativos a la normativa ecuatoriana; requieren localización. |

**Banda de precio del mercado EC 2026**

- Plan básico en la nube (facturación limitada, contabilidad básica): **USD 10–30/mes** por empresa.
- Plan PYME (facturación completa + nómina + inventarios): **USD 30–80/mes** por empresa.

→ WinSuit debe posicionarse en la **banda alta de PYME (USD 39–99/mes)**, justificando el sobreprecio con integración real entre módulos + automatización con IA. Competir por precio contra los facturadores puros es una carrera perdida.

### 1.2 Tendencias que definen el tablero en 2026

- **ERP agéntico.** La IA deja de recomendar y pasa a ejecutar: conciliación bancaria automática, matching de órdenes de compra, detección de anomalías en tiempo real. Es *el* eje de diferenciación del año, y donde la competencia LatAm está invirtiendo.
- **Conectores LLM como superficie de producto.** Alegra MCP marcó el precedente: el cliente quiere consultar su contabilidad desde su asistente, no desde otra pestaña.
- **Escasez de personal contable.** En LatAm la automatización no es lujo sino necesidad operativa — es el argumento de venta más fuerte, por encima del precio.
- Mercado SaaS LatAm proyectado a **USD 45B en 2030**.

### 1.3 Cambios normativos ecuatorianos que fijan prioridades

| Cambio | Impacto en WinSuit |
|---|---|
| **Resolución SRI NAC-DGERCGC25-00000017** (vigente 1-ene-2026). Elimina el plazo de gracia de 4 días hábiles. **La transmisión al SRI debe ser inmediata** y la fecha de emisión debe corresponder a la fecha de la operación. Aplica a factura, NC, ND, retención, guía de remisión y liquidación de compra. **La anulación solo se permite hasta el día 7 del mes siguiente.** | Obliga a revisar la máquina de emisión (épica **C5**) y a completar los comprobantes faltantes (**C1-C4**). |
| **Recategorización RIMPE 2026.** ~70.000 contribuyentes movidos: ~56.000 salen de RIMPE al Régimen General y ~14.000 pasan de Negocio Popular a Emprendedor. | **Es la ventana comercial del año.** Decenas de miles de contribuyentes quedan obligados a llevar contabilidad completa **por primera vez** y su facturador puro ya no les sirve. |
| **SBU 2026 = USD 482** (+12 vs. 2025). Base de décimos, fondos de reserva y aportes IESS. | Parametrizar y verificar los cálculos de nómina contra este valor. |
| ATS mensual (semestral para RIMPE); registro de contratos en el SUT del Ministerio del Trabajo. | Épica **C6** (ATS incompleto) y **N3** (planilla IESS). |

### 1.4 Posicionamiento propuesto

> **"El único ERP ecuatoriano donde la contabilidad, el inventario y la nómina son un solo dato, con IA que ejecuta el trabajo repetitivo."**

**Cuña de entrada:** el contribuyente recategorizado a Régimen General en 2026. Necesita contabilidad completa por primera vez, su facturador actual no se la da, y el ERP tradicional le resulta caro y lento de implementar.

**Ventajas competitivas ya construidas y hoy invisibles en el marketing:**

- POS con modo **restaurante** (cuentas abiertas, dividir cuenta, lock por dispositivo) — Alegra no lo tiene.
- **Recetas/BOM** con subrecetas y auditoría de cambios.
- **Constructor de sitio web + ecommerce** por tenant, con generación asistida por IA.
- **Asistente comercial de WhatsApp** con flujos visuales, RAG y funnels, sobre Meta Cloud API oficial.
- **Conciliación bancaria asistida por IA** (mapeo automático de columnas del extracto + sugerencia de matches).

---

## 2. Diagnóstico: madurez por módulo

| Módulo | LOC (.ts sin specs) | Madurez | Veredicto |
|---|---:|---|---|
| Contabilidad (+bancos, CxP, compras, SRI) | 30.817 | ●●●●○ | Mejor activo del producto. Faltan flujo de efectivo, centros de costo y formularios 104/103. |
| Sitio web builder | 12.205 | ●●●●○ | Diferenciador inesperado. Backlog de UX abierto en `SITIO_WEB_UX_UI_AUDIT.md`. |
| Inventario | 9.772 | ●●●○○ | Kardex, costeo FIFO/LIFO/promedio, recetas y variantes sólidos. Sin traslados con UI, sin ajustes, sin lotes/series. |
| Ventas / POS | 8.547 | ●●●○○ | POS retail + restaurante muy bueno. Sin cotizaciones, sin pedidos, sin CxC, **sin nota de crédito electrónica**. |
| Nómina | 7.179 | ●●●○○ | Cobertura ecuatoriana profunda. **Sin entrada en `module-catalog.ts` ⇒ sin guard de acceso.** |
| Super-admin plataforma | 3.050 | ●●●●○ | 24 endpoints: órdenes, planes, complementos, ajustes de pago. |
| Asistente WhatsApp | 2.749 | ●●●○○ | Flujos, RAG, funnels, Embedded Signup de Meta. |
| Dashboard | 2.583 | ●●●○○ | Widgets configurables con gridster + ECharts. 11 widgets. |
| Facturación electrónica (config) | 1.708 + backend | ●●●○○ | Firma XAdES propia y envío al SRI. **Solo emite factura (01).** |
| Colaboradores / RBAC | 1.682 | ●●○○○ | Matriz de permisos completa en UI, **sin efecto real en la base de datos** (ver hallazgo S2). |
| Clientes | 907 | ●●○○○ | Cartera con campos personalizados. No es CRM. |
| **Servicios** | **392** | **●○○○○** | El modelo completo son 7 campos. Es un catálogo de precios, no un módulo. |
| Proyectos / Kanban | — | ○○○○○ | Placeholder ruteado sin implementación. |

**Comprobantes electrónicos SRI — cobertura actual**

| Comprobante | Emisión | Parseo (compra) | Descarga portal |
|---|:---:|:---:|:---:|
| 01 Factura | ✅ | ✅ | ✅ |
| 03 Liquidación de compra | ❌ | ✅ | ✅ |
| 04 Nota de crédito | ❌ | ✅ | ✅ |
| 05 Nota de débito | ❌ | ❌ | ✅ |
| 06 Guía de remisión | ❌ | ❌ | ❌ |
| 07 Comprobante de retención | ❌ | ✅ | ✅ |

**Deuda técnica marcada en código:** `@deprecated` en `inventario.models.ts:16` (`EstadoOrdenCompraLegacy`), `facturacion.models.ts` (`puntosEmisionLegacy`), `nomina.models.ts:68` (`MotivoSalidaLegacyNomina`), y bloque legacy comentado en `features/ventas/services/factura.service.ts:128`.

**Señal de alerta:** no hay **ni un solo `TODO`/`FIXME`** en `Frontend/winsuite/src` ni en `WinServer/win-server/src`. Los pendientes no están marcados en ninguna parte; solo se infieren de la estructura. Este documento existe para corregir eso.

---

## 3. Épicas

Convención de estado: `⬜ Backlog` · `🟨 En curso` · `✅ Hecho`

---

### F0 · Seguridad y continuidad (bloqueante)

> Ninguna de estas épicas añade valor visible al cliente. Todas bloquean la venta a una empresa que haga *due diligence*. El detalle técnico de cada hallazgo, con `archivo:línea`, vive en [SEGURIDAD_HALLAZGOS_2026.md](./SEGURIDAD_HALLAZGOS_2026.md).

#### S1 · Sacar secretos de OneDrive y rotarlos · 🔴 · ⬜

Los service accounts de Firebase Admin de los tres proyectos, la clave SSH privada y los `.env` de producción viven bajo `C:\Users\r-max\OneDrive\...` — es decir, **sincronizados a la nube de Microsoft**. Un service account Admin SDK **ignora todas las reglas de seguridad**: quien lo tenga lee y escribe la base de datos de todos los tenants, anulando por completo el buen trabajo hecho en las reglas RTDB.

Los `.gitignore` sí los cubren y se verificó que **nunca se commitearon**. El vector es la sincronización y el disco, no git.

**Acciones:** mover a un gestor de secretos (o al menos fuera del árbol sincronizado) · rotar **todas** las credenciales · separar `APP_SECRET_ENCRYPTION_KEY` de `WHATSAPP_TOKEN_ENCRYPTION_KEY` (hoy tienen el mismo valor) · reemplazar la contraseña SMTP con la que se envían las facturas de todos los clientes (hoy es una contraseña personal débil) · separar la clave de IA global de la de embeddings.

#### S2 · RBAC efectivo a nivel de datos · 🔴 · ⬜

De las 748 líneas de `Frontend/winsuite/realtime-database.rules.json` hay **exactamente una** comprobación de rol (`:118`, para `tablePreferences`). Todo lo demás — `contabilidad`, `nomina`, `ventas`, `inventario`, `Facturacion`, `clientes` — concede lectura y escritura completas a **cualquier miembro activo del tenant**, sin mirar su rol.

Como 45 servicios del frontend escriben directo a RTDB (183 llamadas `set/update/push/remove`), un colaborador con rol "Vendedor" puede abrir la consola del navegador y escribir en la nómina de su empresa. El RBAC de `authorization.service.ts` y `permission.guard.ts` es **solo UI**, y el de `TenantAuthorizationService.java` solo cubre los endpoints REST, que el cliente puede saltarse.

**Enfoque recomendado (híbrido):**

1. **Mover al backend Spring** las escrituras de contabilidad, nómina y facturación, y cerrar esos nodos en las reglas. Son los datos sensibles y los que ya tienen lógica de negocio en el servidor.
2. **Añadir lectura de rol en las reglas** (`root.child('tenant_users').child($tenantId).child(auth.uid).child('role')`) para el resto de módulos, siguiendo el patrón que ya existe en la línea 118.

#### S3 · Cerrar la fuga cross-tenant del proyecto de sitios · 🔴 · ⬜

En `sites-realtime-database.rules.json`, dos nodos son legibles por **cualquier usuario autenticado de cualquier empresa**: `subdominios` (`:46`) permite enumerar todos los subdominios de la plataforma con su `tenantId`; `dominios_custom` (`:53`) expone el `tokenVerificacion` de los dominios personalizados de todos los clientes — el secreto que prueba la propiedad del dominio.

Además, las reglas de este proyecto (`:7-9`) validan **solo** `auth.token.tenantId`, sin binding de sesión ni comprobación de membresía activa: un colaborador expulsado conserva acceso hasta que caduque su ID token (~1 h).

**Acción:** portar el patrón de 4 factores del proyecto principal y restringir la lectura de ambos índices al tenant propietario.

#### S4 · MFA + App Check + política de contraseñas · 🔴 · ⬜

Cero referencias a `multiFactor`/`totp` y cero a `appCheck` en todo el frontend. Para un ERP que maneja nómina, contabilidad y certificados de firma electrónica es una carencia crítica, y además un bloqueador comercial: cualquier cliente mediano lo pregunta.

**Acciones:** MFA por TOTP obligatorio para roles admin y contador · Firebase App Check · política de contraseñas propia (hoy el único límite son los 6 caracteres de Firebase).

#### S5 · Backups, retención y recuperación probada · 🔴 · ⬜

Cero menciones a backup, respaldo o retención en todo el repositorio. No hay export programado, ni política de retención, ni procedimiento de restauración, ni prueba de recuperación. Los datos contables y de nómina tienen plazos de conservación fiscal de 7 años en Ecuador.

**Acciones:** export programado de las tres bases RTDB · política de retención documentada · **restauración probada en un entorno limpio** (un backup no probado no es un backup).

#### S6 · CI en los dos repos principales · 🔴 · ⬜

`Frontend/winsuite` (41 specs de vitest) y `WinServer/win-server` (62 tests JUnit) **no tienen ningún pipeline**. Los 103 tests que ya existen no los ejecuta nadie automáticamente. `winsuite-sites` y `sri-worker` sí tienen GitHub Actions — hay de dónde copiar el patrón.

**Acciones:** workflow de build + test en ambos · `npm audit` / OWASP dependency-check · escaneo de secretos (gitleaks) · **`@firebase/rules-unit-testing`**: hoy 748 líneas de reglas de seguridad se despliegan sin una sola prueba automática · añadir ESLint (hoy no existe `ng lint`).

#### S7 · Hardening puntual · 🟠 · ⬜

Seis correcciones acotadas, detalladas una a una en el documento de seguridad: CORS de producción que admite `localhost` con credenciales · rate limit del copiloto público roto detrás de proxy (gasto directo de tokens de IA a coste de WinSuit) · defaults `local-dev-change-me` que cifrarían certificados de firma electrónica si falta la variable de entorno · ID token de Firebase enviado al worker local por HTTP · comparación de rol por string `'ADMIN'`.

#### S8 · LOPDP: implementar los derechos ARCO · 🟠 · ⬜

Las páginas legales publicadas prometen portabilidad y supresión de datos, pero **no existe ningún endpoint ni pantalla que las implemente**. Tampoco hay registro de consentimientos, ni DPA con los clientes, ni declaración de la región donde residen los datos (la LOPDP exige informar sobre transferencias internacionales).

**Acciones:** export de datos del titular · borrado a petición con trazabilidad · registro de consentimientos · declaración de región · plantilla de DPA para clientes.

#### S9 · Observabilidad · 🟠 · ⬜

Cero referencias a Sentry, OpenTelemetry, Datadog o similar. Los errores del frontend solo llegan a la consola del navegador; el backend solo escribe a stdout del contenedor sin agregación. Solo `/actuator/health` está expuesto: no hay métricas ni alertas, y un abuso del endpoint público de IA solo se detectaría por la factura del proveedor.

Además, `JwtAuthenticationFilter.java:71,125,132` loguea uid y tenant **a nivel INFO en cada petición autenticada**, y `:77` loguea el email de quien intenta entrar al panel de plataforma.

**Acciones:** error tracking en front y back · logs estructurados sin PII (bajar esos INFO a DEBUG) · métricas + alertas.

#### N1 · Poner Nómina bajo control de acceso · 🔴 · ⬜

El módulo Nómina **no aparece en `core/config/module-catalog.ts`**, por lo que sus rutas en `app.routes.ts` no tienen `moduleAccessGuard`. Hoy cualquier usuario autenticado del workspace entra a la nómina de su empresa. Es una corrección de pocas líneas y de las de mayor retorno inmediato de todo el plan.

> **Preservar explícitamente lo que está bien hecho:** el modelo de sesión con `sessionId` + `sessionVersion` y revocación server-side; el proyecto Firebase de auditoría separado con escritura exclusiva vía Admin SDK; la allowlist de super-admin por email verificado sin rol persistido en base de datos; la arquitectura hexagonal del backend; el cierre por defecto (`.read/.write: false`) en la raíz de las tres bases.

---

### F1 · Cumplimiento fiscal 2026

> Habilita el discurso comercial. Sin esto, WinSuit no puede afirmar que cumple con la normativa vigente.

#### C1 · Nota de crédito electrónica (04) — *el hueco normativo más grave* · ⬜

Hoy `features/ventas/services/ventas.service.ts:483 revertirVenta()` solo devuelve el stock al almacén y marca la venta como `REVERTIDA`. **No emite nota de crédito electrónica.** Una venta facturada y luego revertida deja al contribuyente con una factura autorizada ante el SRI sin su NC correspondiente.

**Alcance:** generación del XML 04 · firma y envío reutilizando `DigitalSignatureAdapter` y `SriIntegrationAdapter` · vinculación al documento modificado · **devoluciones parciales** (hoy el reverso es todo o nada) · RIDE de la NC · efecto contable e inventario.

**Reutilizar:** toda la cadena de emisión de factura ya existente en `WinServer/.../infrastructure/adapter/XmlGenerationAdapter.java` y la máquina de estados `armando → generando → firmando → autorizando`.

#### C2 · Comprobante de retención (07) como emisor · ⬜

Hoy solo se **parsea** el comprobante recibido (`XmlParsingAdapter`, versiones 1.x y 2.0.0). Falta emitirlo. Es obligatorio para toda empresa designada agente de retención, y la configuración de facturación ya contempla la bandera `agenteRetencion`.

#### C3 · Guía de remisión (06) · ⬜

No existe ni emisión ni parseo. Necesaria para cualquier cliente que despache mercadería — es decir, la mayoría de los clientes de inventario. Depende funcionalmente de **V1** (pedidos/despachos).

#### C4 · Nota de débito (05) · ⬜

Hoy solo se descarga del portal. Falta emisión y parseo.

#### C5 · Adecuación a la transmisión inmediata · ⬜

La Resolución NAC-DGERCGC25-00000017 elimina el plazo de gracia. Revisar la máquina de estados de emisión para garantizar envío **síncrono en el momento de la operación**, con cola de reintentos visible al usuario cuando el SRI no responde, y alerta cuando un comprobante lleva demasiado tiempo sin autorizar. Bloquear la anulación después del día 7 del mes siguiente a la emisión.

**Verificar además:** que el POS con `facturacionAutomatica` activo no permita diferir la emisión, y que la fecha del comprobante no pueda desviarse de la fecha de la operación.

#### C6 · ATS completo (hoy solo cubre compras) · ⬜

`WinServer/.../domain/model/ats/AtsReport.java:24` lo declara literalmente:

```java
private String totalVentas;      // "0.00" en v1 (solo compras)
```

El modelo solo tiene `List<AtsCompra> compras`. **Faltan ventas, exportaciones y comprobantes anulados.** Sin eso el anexo no se puede presentar, y presentarlo incompleto expone al cliente a sanciones. Es la épica de cumplimiento con mayor riesgo reputacional.

#### C7 · Formularios 104 (IVA) y 103 (retenciones en la fuente) · ⬜

Y conciliación de retenciones recibidas vs. declaradas. Toda la información de base ya está registrada (compras con `retencionesRenta`/`retencionesIva`, códigos de sustento, ventas); falta la agregación y el formato de salida.

---

### F2 · Cerrar el ciclo comercial

> Paridad competitiva. Son las funciones que un evaluador compara en una tabla frente a Contífico y Alegra.

#### Ventas y clientes

| # | Épica | Estado |
|---|---|:---:|
| **V1** | **Cotización → pedido → despacho → factura.** Hoy no existe nada: los "pedidos" que hay son exclusivamente del canal web (`features/sitio-web/pages/pedidos-page`). Un ERP sin proforma pierde contra cualquier competidor en la demo. | ⬜ |
| **V2** | **Cuentas por cobrar.** Existe CxP de proveedores completo (`pages/cuentas-por-pagar-list`, `pages/cxp-aging`, `pages/pago-proveedor-form`) pero **no existe el espejo de clientes**: crédito, abonos, antigüedad de cartera, estado de cuenta. *Reutilizar la estructura de CxP como plantilla* — es la ruta más corta. | ⬜ |
| **V3** | **Listas de precios múltiples, precio por cliente y promociones.** Hoy: un único `precioVenta` por producto más descuento manual por ítem o global. | ⬜ |
| **V4** | **Informes de ventas reales.** `pages/ventas-informes` tiene solo 3 vistas (ventas por estado, ingreso de caja diaria, ingresos por vendedor), muy por debajo de lo que promete la base de conocimiento del producto (ticket promedio, mejores productos, rentabilidad, margen). | ⬜ |
| **V5** | **CRM básico.** `features/clientes` es cartera, no CRM: faltan pipeline de oportunidades, actividades y seguimiento. Los "funnels" que existen viven solo dentro del asistente de WhatsApp y no se conectan con el cliente del ERP. | ⬜ |

#### Inventario

| # | Épica | Estado |
|---|---|:---:|
| **I1** | ⭐ **Traslados entre bodegas con UI.** *Épica más barata del plan.* Los tipos `TRASLADO`, `TRASLADO_ENTRADA` y `TRASLADO_SALIDA` **ya existen** en `inventario.models.ts` y se leen en `kardex.service.ts` y `costos.service.ts:201-211`. Falta únicamente la pantalla que los genere. | ⬜ |
| **I2** | **Ajustes de inventario, toma física y conteo cíclico.** El motivo `AJUSTE_INVENTARIO` solo se escribe desde `kardex.service.ts:241`; no hay pantalla. | ⬜ |
| **I3** | **Lotes, números de serie y fechas de caducidad.** Inexistentes. Bloqueante para farmacia, alimentos y distribución — tres verticales grandes que hoy no se pueden vender. | ⬜ |
| **I4** | **Punto de reorden y sugerencia de compra.** Hoy solo el widget `low-stock-products` del dashboard. | ⬜ |
| **I5** | Recuperar la **recepción parcial de órdenes de compra** (el estado `RECIBIDA_PARCIAL` está deprecado pero `cantidadRecibida` sobrevive en el ítem) y añadir código de proveedor por producto / última compra por proveedor. | ⬜ |

#### Nómina

| # | Épica | Estado |
|---|---|:---:|
| **N2** | **Impuesto a la renta en relación de dependencia**: proyección anual, formulario de gastos personales, retención mensual. No aparece en `CuentaNominaKey` ni en los rubros. Es obligación legal del empleador. | ⬜ |
| **N3** | **Archivo de planilla IESS** (estructura de carga al portal) y **archivo de pago bancario** (ACH / pago masivo). Sin esto el usuario sigue tecleando en dos sistemas. | ⬜ |
| **N4** | **Solicitud y aprobación de vacaciones con saldo de días.** Hoy solo existe el componente monetario (`vacacionesProvision`, rubro `VACACIONES`, `cuentaVacacionesPorPagarId`), no el control de días. | ⬜ |
| **N5** | Control de asistencia/marcaciones, horas extra tipificadas (25 % / 50 % / 100 %) y portal del empleado. | ⬜ |
| **N6** | **Desacoplar `features/nomina` de `features/contabilidad`.** Hoy la UI vive en `features/nomina/pages/` pero todos los modelos, servicios y utilidades están en `features/contabilidad/` — `features/nomina` es una carcasa. Además hay ruteo duplicado (`workspace/nomina/*` y `workspace/contabilidad/nomina/*` apuntando a los mismos componentes). | ⬜ |

#### Servicios

| # | Épica | Estado |
|---|---|:---:|
| **K1** | ⭐ **Convertir Servicios en un módulo de verdad.** *El mayor salto funcional disponible.* Hoy el modelo completo es `{id, nombre, descripcion, precio, activo, createdAt, updatedAt}` y la pantalla de configuración tiene 37 líneas. Falta: **órdenes de trabajo**, **agenda/citas** (`@fullcalendar` ya está en el proyecto y ya se usa en `empresa-calendar`), técnicos asignables, **suscripciones y facturación recurrente**, contratos, SLA, horas facturables. La facturación recurrente es además el diferenciador más claro frente a los facturadores puros, y genera ingreso predecible para el cliente. | ⬜ |

#### Contabilidad

| # | Épica | Estado |
|---|---|:---:|
| **A1** | Estado de **Flujo de Efectivo** y Estado de **Cambios en el Patrimonio** (hoy hay Situación Financiera, Resultado Integral, Diario, Mayor y Balance de Comprobación). | ⬜ |
| **A2** | **Centros de costo** y comparativos multi-período. Los centros de costo son requisito frecuente en constructoras y empresas de proyectos — un vertical que ya está presente en los datos del piloto. | ⬜ |
| **A3** | Notas a los estados financieros. | ⬜ |

---

### F3 · Capa SaaS comercial

> **El motor ya está construido y es serio.** Existen `PlanResolutionService` (plan efectivo = catálogo + overrides + add-ons, caché 30 s, ciclo mensual en `America/Guayaquil`), `QuotaService` con enforcement real vía HTTP 402 interceptado en el front, `PlatformAddon` de tipo límite o módulo, `OrderApplicationService` con máquina de estados, `PayPhoneAdapter`, y un panel de super-admin con 24 endpoints.
>
> Lo que falta es **superficie comercial, no técnica**. Por eso esta fase puede correr en paralelo desde temprano y con poco esfuerzo relativo.

| # | Épica | Estado |
|---|---|:---:|
| **P1** | ⭐ **Trial automático.** El estado `TRIAL` existe **solo como constante** en `CompanySubscription.java:20` y como tipo en TypeScript: nada lo asigna, lo expira ni lo degrada. Implementar trial de 15 días sin tarjeta (paridad con Alegra), con avisos de vencimiento y degradación al plan free al terminar. | ⬜ |
| **P2** | ⭐ **Selección de plan en el registro.** Hoy `auth/register` es público pero solo pide nombre/email/contraseña, y toda empresa cae al plan `free` sembrado por `PlatformCatalogSeeder.java` (20 MB, 1 ecommerce, 3 landings, 100k tokens IA/mes, 50 facturas SRI/mes, 3 colaboradores). El checkout ya existe en `features/planes/components/checkout-dialog`; falta conectarlo al alta. | ⬜ |
| **P3** | **Landing y pricing público.** Hoy `/` redirige a login y lo único público son las tres páginas legales creadas para la verificación de Meta. Nadie puede descubrir, entender ni comprar WinSuit sin una demo guiada. **Construirla con el propio site builder de WinSuit** — dogfooding demostrable y verificable por el prospecto. | ⬜ |
| **P4** | **Renovación recurrente y dunning.** Hoy las órdenes son compras puntuales. Falta: cobro recurrente, aviso de vencimiento, degradación gradual, reactivación y reintentos de cobro fallido. | ⬜ |
| **P5** | **Métricas SaaS en el super-admin.** Ya hay endpoints `/usage` y `/wallet` por empresa; falta la vista agregada: MRR, churn, activación, conversión trial→pago, consumo por plan. | ⬜ |
| **P6** | **Facturar el propio SaaS con WinSuit.** Emitir la factura electrónica del SRI al cliente desde el módulo propio. Requisito legal y dogfooding del camino crítico. | ⬜ |

---

### F4 · IA y diferenciación

> Donde se gana o se pierde el 2026. La infraestructura base (Spring AI 2.0 con Anthropic + Google GenAI, RAG con embeddings e indexación incremental, tool calling con plan-then-confirm) **ya está construida**. Estas épicas la extienden, no la crean.

| # | Épica | Estado |
|---|---|:---:|
| **IA1** | ⭐ **Extender el copiloto de configuración a todas las pantallas.** *Mejor relación esfuerzo/valor de todo el plan.* El punto de extensión `ConfigToolSet` está diseñado y tiene 4 implementaciones (`inventario/`, `contabilidad/`, `facturacion/`, `clientes/`), cada una con Read/Write tools y su `ActionValidator`. El panel Angular es reutilizable (`shared/components/config-copilot-panel`). **Faltan: ventas, nómina, bancos, sitio web y empresa.** Existe además una skill dedicada (`winsuite-config-copilot`) que documenta el patrón paso a paso. | ⬜ |
| **IA2** | ⭐ **Conciliación bancaria autónoma.** Ya existen `AiExtractoMappingService` (mapeo automático de columnas del extracto) y `AiConciliacionSuggestionService` (sugerencia de matches), ambos con validador. Subir de *sugerir* a *ejecutar automáticamente por encima de un umbral de confianza*, con auditoría completa y reversión en un clic. **Es literalmente la promesa del "ERP agéntico" que la competencia vende en 2026, y WinSuit está a una épica de distancia.** | ⬜ |
| **IA3** | **Compra → asiento sin intervención.** Ya hay parseo de XML y `pages/carga-masiva-compras`. Añadir clasificación automática de cuenta contable y tipo de gasto, aprendiendo del histórico de `MapeoProveedorContable` y `MapeoCategoriaContable`. | ⬜ |
| **IA4** | **Agente de cobranza sobre WhatsApp.** El asistente comercial ya está construido (instancias, plantillas aprobadas, flujos, RAG). Añadir recordatorios automáticos de cartera vencida y conciliación de pagos reportados por el cliente. *Depende de V2.* | ⬜ |
| **IA5** | **Conector MCP de WinSuit.** Consultar la contabilidad desde Claude o ChatGPT. Alegra ya lo tiene y lo usa como argumento de venta: es paridad, no lujo. El copiloto global read-only ya tiene las consultas resueltas; se trata de exponerlas por MCP. | ⬜ |
| **IA6** | **Alertas proactivas.** Anomalías de gasto, ventas fuera de patrón, comprobantes sin autorizar, períodos por cerrar, stock bajo punto de reorden. Reutilizar `NotificationOutboxEntry` y el push FCM ya operativo. | ⬜ |

---

### F5 · Producto y escalabilidad

| # | Épica | Estado |
|---|---|:---:|
| **X1** | **Responsive del ERP.** ~120 `@media` repartidas sin sistema, breakpoint dominante `max-width: 900px`, y solo el dashboard usa `BreakpointObserver`. Los bloques del sitio público sí están auditados a 390/768/1280 px; el ERP no tiene auditoría equivalente. Sin PWA ni manifest. ⚠️ **Hubo un intento previo (tarjetas/overflow) que se revirtió por completo — acordar el diseño con el usuario antes de escribir código.** | ⬜ |
| **X2** | **Accesibilidad.** Cerrar el backlog ya levantado en `SITIO_WEB_UX_UI_AUDIT.md`: overflow del lienzo/HTML/carrito, carrusel y FAQ operables por teclado, contraste automático, controles que dependen de hover. La intención está declarada (WCAG AA, `aria-*` en 82 archivos, `prefers-reduced-motion`) pero lo crítico sigue abierto. | ⬜ |
| **X3** | **API pública, webhooks salientes y OpenAPI.** No existe nada para terceros: todo `/api/**` es interno con JWT de Firebase, y los únicos endpoints públicos son el copiloto pre-login, el OAuth de WhatsApp y el webhook de Meta. Sin API keys, sin webhooks, sin Swagger. Necesario para contadores externos e integradores — y es un canal de distribución. | ⬜ |
| **X4** | **Constructor de reportes ad-hoc y exportación genérica.** Hoy cada reporte es una pantalla a medida y el frontend no tiene librería xlsx (solo `papaparse` para CSV; el Excel se genera en el backend con POI). Existe ya un registro central de tablas operativas (`shared/config/operational-tables.registry.ts`) que puede servir de base. | ⬜ |
| **X5** | **i18n.** No existe: todo hardcodeado en español, `LOCALE_ID: 'es-EC'` fijo, `MatPaginatorIntl` traducido a mano. **Fuera de alcance con el foco actual en Ecuador**, pero registrado: es la restricción que habría que levantar antes de cualquier expansión a LatAm, y afecta también a la lógica (zona `America/Guayaquil`, catálogos SRI, nómina ecuatoriana). | ⬜ |
| **X6** | **`@angular/fire` está en `21.0.0-rc.0` (release candidate) en producción.** Fijar a versión estable. | ⬜ |
| **X7** | **Documentación.** Reescribir `ARCHITECTURE.md` · README raíz que explique cómo encajan los 5 repositorios · **documentar la capa de planes y facturación**, hoy invisible en todos los `.md` pese a ser la pieza más estratégica del producto. | ⬜ |

---

## 4. Roadmap por fases

| Fase | Ventana | Objetivo | Épicas | Criterio de salida |
|---|---|---|---|---|
| **F0** | Semanas 0-6 | Poder vender sin riesgo | S1-S9, N1 | Secretos rotados y fuera de OneDrive · RBAC con efecto real en datos · CI en verde en ambos repos · backup restaurado en una prueba real |
| **F1** | Semanas 6-14 | Cumplir la normativa 2026 | C1-C7 | Los 6 comprobantes electrónicos se emiten · ATS con ventas aceptado por el SRI |
| **F2** | Semanas 14-28 | Paridad ERP | V1-V5, I1-I5, N2-N6, K1, A1-A3 | Ciclo cotización→cobro cerrado · Servicios deja de ser un esqueleto |
| **F3** | Paralelo desde sem. 4 | Convertir | P1-P6 | Un cliente se registra, prueba y paga **sin intervención humana** |
| **F4** | Paralelo desde sem. 10 | Diferenciar | IA1-IA6 | Conciliación autónoma en producción · copiloto de configuración en 9 pantallas |
| **F5** | Continuo | Escalar | X1-X7 | ERP usable en móvil · API pública documentada |

### Orden de arranque recomendado

Por relación impacto/esfuerzo, las cinco primeras cosas a hacer:

1. **N1** — poner Nómina bajo `moduleAccessGuard`. Pocas líneas, cierra un agujero de acceso.
2. **S1** — sacar los secretos de OneDrive y rotar. Sin código, riesgo máximo.
3. **I1** — traslados entre bodegas. El modelo de datos ya existe; solo falta la pantalla.
4. **P1 + P2** — trial automático y selección de plan en el registro. El motor ya está; falta la superficie.
5. **IA1** — extender los `ConfigToolSet` a ventas, nómina y bancos. Patrón ya diseñado y documentado en una skill.

Y en paralelo, arrancar **C1** (nota de crédito), porque es el hueco normativo más grave y el de mayor plazo de desarrollo de la fase F1.

---

## 5. Métricas de seguimiento

**Producto**

- Comprobantes autorizados por mes · % de rechazos del SRI
- Tiempo medio de cierre contable mensual
- % de líneas de extracto conciliadas automáticamente
- Empresas activas con nómina procesada / con inventario en uso

**Negocio**

- MRR · ARPU · conversión trial→pago · churn mensual · CAC
- Distribución de clientes por plan · consumo de add-ons

**Técnico**

- Cobertura de tests (línea base: 41 specs front + 62 tests back, hoy sin ejecutar en CI)
- Hallazgos de seguridad abiertos por severidad
- p95 de latencia de la API · MTTR
- % de comprobantes transmitidos dentro del mismo día de la operación (requisito NAC-DGERCGC25-00000017)

---

## 6. Fuentes

- [SRI — Resolución NAC-DGERCGC25-00000017 (PDF oficial)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf)
- [HLB Ecuador — Actualización en la normativa de comprobantes electrónicos](https://www.hlbecuador.com/sri-actualizacion-en-la-normativa-de-comprobantes-electronicos-resolucion-nac-dgercgc25-00000017/)
- [Ecuafact — Facturación electrónica obligatoria 2026: transmisión inmediata](https://ecuafact.com/blog/obligatoriedad-facturacion-electronica-ecuador-2026)
- [Russell Bedford EC — Recategorización RIMPE y nuevas obligaciones 2026](https://russellbedford.com.ec/recategorizacion-rimpe-y-nuevas-obligaciones-ante-el-sri-2026/)
- [Siigo Contífico — Planes y precios](https://contifico.com/planes/)
- [Anfibius — Precio de software contable en Ecuador 2026](https://anfibius.net/precio-de-software-contable-en-ecuador-cuanto-deberias-pagar-en-2026/)
- [Comparativa Alegra vs Siigo 2026](https://programascontabilidad.com/comparativas-de-software/alegra-siigo-comparativa/)
- [ImagineSOFT — Tendencias ERP 2026 en LATAM](https://imaginesoft.io/blog/tendencias-erp-2026-latam)
- [Deltech Audit — SBU 2026, guía para empresas](https://deltechaudit.ec/sbu-salario-basico-en-ecuador-2026-guia-para-empresas/)
- [Factuplan — Guía de remisión electrónica 2026](https://factuplan.com.ec/blog/guia-remision-electronica-ecuador-2026)

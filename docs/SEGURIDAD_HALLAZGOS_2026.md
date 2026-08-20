# Registro de hallazgos de seguridad — WinSuit 2026

> Auditoría de arquitectura, seguridad e infraestructura. Agosto 2026.
> Documento vivo: cada hallazgo se cierra individualmente actualizando su columna **Estado**.
> Épicas asociadas en [PLAN_MEJORAMIENTO_2026.md](./PLAN_MEJORAMIENTO_2026.md) (fase F0).
>
> ⚠️ **Este documento nombra variables y archivos, nunca valores.** No transcribir aquí ninguna clave, contraseña o token real.

**Severidad:** 🔴 crítico · 🟠 alto · 🟡 medio
**Estado:** ⬜ Abierto · 🟨 En curso · ✅ Cerrado · ⚪ Aceptado (riesgo asumido, con justificación)

---

## Resumen

| # | Hallazgo | Sev | Épica | Estado |
|---|---|:---:|:---:|:---:|
| [H01](#h01) | Service accounts, clave SSH y `.env` de producción sincronizados en OneDrive | 🔴 | S1 | ⬜ |
| [H02](#h02) | RBAC ausente en las reglas RTDB: cualquier miembro escribe cualquier módulo | 🔴 | S2 | ⬜ |
| [H03](#h03) | Fuga cross-tenant: `subdominios` y `dominios_custom` legibles por cualquier autenticado | 🔴 | S3 | ⬜ |
| [H04](#h04) | Reglas del proyecto de sitios sin binding de sesión ni membresía activa | 🔴 | S3 | ⬜ |
| [H05](#h05) | Sin MFA/2FA y sin política de contraseñas | 🔴 | S4 | ⬜ |
| [H06](#h06) | Sin backups, sin retención, sin plan de recuperación | 🔴 | S5 | ⬜ |
| [H07](#h07) | Sin CI en los dos repos principales; 103 tests que nadie ejecuta | 🔴 | S6 | ⬜ |
| [H08](#h08) | Contraseña SMTP débil y claves de cifrado reutilizadas entre dominios | 🔴 | S1 | ⬜ |
| [H09](#h09) | Módulo Nómina sin `moduleAccessGuard` | 🔴 | N1 | ⬜ |
| [H10](#h10) | Endpoint de IA público con rate limit inefectivo tras proxy | 🟠 | S7 | ⬜ |
| [H11](#h11) | CORS de producción admite `localhost` con `allowCredentials` | 🟠 | S7 | ⬜ |
| [H12](#h12) | Sin Firebase App Check | 🟠 | S4 | ⬜ |
| [H13](#h13) | Defaults `local-dev-change-me` en claves que cifran certificados de firma | 🟠 | S7 | ⬜ |
| [H14](#h14) | ID token de Firebase enviado al worker local por HTTP | 🟠 | S7 | ⬜ |
| [H15](#h15) | Sin APM ni error tracking; logs con PII a nivel INFO | 🟠 | S9 | ⬜ |
| [H16](#h16) | LOPDP: la política promete derechos ARCO sin implementación técnica | 🟠 | S8 | ⬜ |
| [H17](#h17) | `@angular/fire` en versión release candidate en producción | 🟡 | X6 | ⬜ |
| [H18](#h18) | Rol comparado por string `'ADMIN'` en lugar de por identificador | 🟡 | S7 | ⬜ |
| [H19](#h19) | `updateMetadata` permite falsear `actualizadoPor` desde el cliente | 🟡 | S2 | ⬜ |
| [H20](#h20) | Datos personales del representante legal publicados con correo personal | 🟡 | S8 | ⬜ |

---

## Lo que está bien hecho — no romper al remediar

Antes del detalle, conviene fijar lo que la auditoría encontró correcto y debe preservarse:

- **Modelo de sesión.** El claim no basta: las reglas y el backend validan `sessionId` + `sessionVersion` contra `auth_sessions/{uid}/{sessionId}`, lo que permite **revocación instantánea** al cambiar de empresa o expulsar a un colaborador. Está por encima de la media del sector.
- **Auditoría aislada.** Proyecto Firebase separado (`firebase.audit.json`), con `.read: false, .write: false` en todo el árbol: solo escribible por el Admin SDK. El cliente no puede falsificar ni borrar eventos, y el modelo guarda `changesBefore`/`changesAfter`.
- **Super-admin sin escalada posible.** Allowlist por email verificado en variable de entorno (`PLATFORM_ADMIN_EMAILS`), sin rol de plataforma persistido en base de datos: no hay forma de escalar privilegios desde dentro de un tenant.
- **Cierre por defecto.** `.read`/`.write` en `false` en la raíz de las tres bases, y ~12 nodos `platform_*` explícitamente cerrados (`realtime-database.rules.json:735-746`): la facturación de la plataforma es exclusiva del Admin SDK.
- **Storage endurecido.** `firmas/`, `facturacion/` y `contabilidad-sri/` cerrados con `if false` — solo backend.
- **Frontend limpio de secretos.** `environment.ts` y `environment.prod.ts` solo contienen configuración pública de Firebase. **Ninguna clave de Anthropic, Google o Twilio llega al bundle**: toda la IA pasa por el backend.
- **Arquitectura hexagonal** en el backend, con separación real `domain / application / infrastructure`.

---

## Detalle de hallazgos

<a id="h01"></a>
### H01 · Service accounts, clave SSH y `.env` de producción sincronizados en OneDrive · 🔴

**Ubicación**

| Archivo | Contenido |
|---|---|
| `servicesaccounts/win-suit-audit-firebase-adminsdk-*.json` | Clave privada del proyecto de auditoría |
| `servicesaccounts/win-suite-sites-firebase-adminsdk-*.json` | Clave privada del proyecto de sitios |
| `WinServer/win-server/wa-marketing-ea461-firebase-adminsdk-*.json` | Clave privada del **proyecto principal de producción** |
| `ssh/id_rsa.priv` | Clave SSH privada, sin passphrase aparente |
| `WinServer/win-server/.env`, `.env.prod`, `.env.bak.*` | ~53 variables con todos los secretos de producción |
| `Frontend/winsuite-sites/.env` | Service account JSON completo de dos proyectos |

**Impacto.** Toda la ruta del proyecto cuelga de `…\OneDrive\…`, por lo que estos archivos están **sincronizados a la nube de Microsoft**. Un service account de Firebase Admin **ignora todas las reglas de seguridad**: quien lo posea lee y escribe la base de datos de todos los tenants. Esto anula por completo el trabajo descrito en H02–H04 y en la sección "lo que está bien hecho".

**Atenuante verificado.** Los `.gitignore` sí cubren estos patrones (`.env*`, `*-firebase-adminsdk-*.json`, `service-account*.json`) y se comprobó el historial completo de git con `git log --all --diff-filter=A --name-only`: **nunca se commitearon**. El vector es la sincronización a OneDrive y el disco local, no el repositorio.

**Remediación**
1. Mover los secretos fuera del árbol sincronizado (idealmente a un gestor: Google Secret Manager, 1Password, Doppler).
2. **Rotar todas las credenciales**, asumiendo que las actuales están comprometidas.
3. Inyectar por variables de entorno en el despliegue, nunca por archivo en el repo.
4. Añadir escaneo de secretos (gitleaks) al CI de H07.

---

<a id="h02"></a>
### H02 · RBAC ausente en las reglas RTDB · 🔴

**Ubicación:** `Frontend/winsuite/realtime-database.rules.json` — 748 líneas, **una sola** comprobación de rol, en la línea 118 (nodo `tablePreferences`).

**Impacto.** Todos los nodos de negocio (`Negocio`, `contabilidad`, `nomina`, `ventas`, `inventario`, `Facturacion`, `clientes`) conceden lectura y escritura completas a cualquier miembro activo del tenant, sin mirar su rol. Como 45 servicios del frontend importan `@angular/fire/database` y realizan 183 llamadas `set/update/push/remove` directas, el modelo de permisos es evadible desde la consola del navegador:

```js
// Un colaborador con rol "Vendedor", sin permiso de nómina:
update(ref(db, 'nomina/<suTenantId>/roles/...'), { /* ... */ })
```

El RBAC de `core/services/authorization.service.ts` y `core/guards/permission.guard.ts` es **exclusivamente de interfaz**, y el de `TenantAuthorizationService.java` solo protege los endpoints REST, que el cliente no está obligado a usar.

**En una frase:** el aislamiento *entre empresas* es fuerte; el aislamiento *entre roles dentro de una empresa* es cosmético.

**Remediación (híbrida, por coste/beneficio)**
1. **Contabilidad, nómina y facturación** → mover las escrituras al backend Spring y cerrar esos nodos en las reglas. Ya tienen lógica de negocio server-side donde encajan.
2. **Resto de módulos** → añadir lectura de rol en las reglas, replicando el patrón ya presente en la línea 118:
   `root.child('tenant_users').child($tenantId).child(auth.uid).child('role').val() === 'ADMIN'`
3. Cubrir ambos caminos con tests de reglas (ver H07).

---

<a id="h03"></a>
### H03 · Fuga cross-tenant en los índices de dominios · 🔴

**Ubicación**
- `Frontend/winsuite/sites-realtime-database.rules.json:45-46` — nodo `subdominios`, `".read": "auth != null"`
- `Frontend/winsuite/sites-realtime-database.rules.json:52-53` — nodo `dominios_custom`, `".read": "auth != null"`

**Impacto.** Ambos índices son legibles por **cualquier usuario autenticado de cualquier empresa**:

- `subdominios` permite enumerar todos los subdominios de la plataforma junto con su `tenantId` y `sitioId` — inteligencia comercial sobre la base de clientes completa.
- `dominios_custom` expone el `tokenVerificacion` de los dominios personalizados de todos los clientes. Ese token es el secreto que prueba la propiedad del dominio; leerlo desde otro tenant permite adelantarse a la verificación o suplantar el flujo de alta de dominio.

**Nota:** la escritura sí está correctamente restringida al tenant propietario en ambos nodos. El problema es exclusivamente la lectura.

**Remediación.** Restringir `.read` al tenant propietario en el nodo hijo (`$subdominio` / `$dominioEscapado`), o resolver la búsqueda de disponibilidad de subdominio a través del backend en lugar de exponer el índice completo.

---

<a id="h04"></a>
### H04 · Reglas del proyecto de sitios sin binding de sesión · 🔴

**Ubicación:** `Frontend/winsuite/sites-realtime-database.rules.json:7-9` y siguientes.

**Impacto.** Este proyecto usa un modelo mucho más débil que el principal: valida **solo** `auth.token.tenantId === $tenantId`, sin comprobar sesión activa, versión de sesión ni membresía viva en `tenant_users`. Consecuencia: un colaborador expulsado o movido a otra empresa **conserva acceso hasta que caduque su ID token** (hasta ~1 hora), mientras que en el proyecto principal la revocación es instantánea.

**Remediación.** Portar el patrón de 4 factores del proyecto principal:

```
auth.token.tenantId === $tenantId
&& auth.token.sessionId != null && auth.token.sessionVersion != null
&& root.child('auth_sessions').child(auth.uid).child(auth.token.sessionId).child('activeTenantId').val() === $tenantId
&& root.child('auth_sessions').child(auth.uid).child(auth.token.sessionId).child('version').val() === auth.token.sessionVersion
&& root.child('tenant_users').child($tenantId).child(auth.uid).child('active').val() === true
```

Requiere que `auth_sessions` y `tenant_users` sean consultables desde el proyecto de sitios, o replicar el mínimo necesario.

**Correcto y a mantener:** `sites-storage.rules:6` tiene `allow get: if true` en `/sitios/{tenantId}/media/**` — es intencional (los sitios son públicos) y `list` sí está restringido.

---

<a id="h05"></a>
### H05 · Sin MFA/2FA y sin política de contraseñas · 🔴

**Ubicación:** `Frontend/winsuite/src/app/core/services/auth.service.ts` — cero referencias a `multiFactor`, `totp` o `2fa` en todo `src/`.

**Impacto.** Un ERP que gestiona nómina, contabilidad y certificados de firma electrónica depende por completo de una contraseña de 6 caracteres (el mínimo de Firebase). Firebase Auth soporta MFA por SMS y TOTP y no está activado. Es además un bloqueador comercial: cualquier cliente mediano lo pregunta en la evaluación.

**Remediación.** MFA por TOTP obligatorio para roles admin y contador, opcional para el resto · política de contraseñas propia (longitud, complejidad, comprobación contra listas de filtradas) · considerar expiración de sesión configurable por empresa.

---

<a id="h06"></a>
### H06 · Sin backups, sin retención, sin plan de recuperación · 🔴

**Ubicación:** ausencia total. Cero coincidencias de `backup|respaldo|retenc` en `docs/` y `README.md`; en el backend, los `@Scheduled` existentes son todos operativos (emisión SRI, notificaciones, calendario), ninguno de retención o purga.

**Impacto.** Firebase RTDB no tiene backups automáticos en el plan Spark; en Blaze requieren configuración explícita que no aparece en ninguna parte del repositorio. No hay export programado, ni política de retención, ni procedimiento de restauración documentado, ni prueba de recuperación. Con datos contables y de nómina sujetos a conservación fiscal de 7 años en Ecuador, es riesgo regulatorio además de operativo.

**Remediación.** Export programado de las tres bases · almacenamiento del backup en una cuenta separada · política de retención escrita · **procedimiento de restauración probado en un entorno limpio** y repetido periódicamente.

---

<a id="h07"></a>
### H07 · Sin CI en los dos repos principales · 🔴

**Estado por repositorio**

| Repo | CI | Tests | Lint |
|---|---|---|---|
| `Frontend/winsuite` | ❌ ninguno | 41 specs (vitest) | ❌ ninguno |
| `WinServer/win-server` | ❌ ninguno | 62 tests JUnit | ❌ ninguno |
| `Frontend/winsuite-sites` | ✅ `publish-container.yml` | e2e Playwright | — |
| `sri-worker` | ✅ `build-agent.yml` | `tests/` | — |

**Impacto.** Los dos componentes que manejan los datos no tienen pipeline. Los 103 tests que sí existen no se ejecutan automáticamente. No hay escaneo de dependencias ni de secretos, y el despliegue del dashboard es manual desde la máquina del desarrollador (`ng deploy` / `firebase deploy --only hosting:dashboard`).

**Sesgo de cobertura:** casi todos los tests cubren lógica de cálculo (nómina, ventas, contabilidad) y el copiloto de IA. **No hay ni un test de las reglas de seguridad** — `@firebase/rules-unit-testing` no está en `package.json`, y 748 líneas de reglas se despliegan sin validación.

**Remediación.** Workflow de build + test en ambos repos (copiar el patrón de `winsuite-sites`) · `npm audit` y OWASP dependency-check · gitleaks · **tests de reglas RTDB con `@firebase/rules-unit-testing`**, incluidos casos negativos por rol (cierra el bucle con H02) · ESLint.

---

<a id="h08"></a>
### H08 · Contraseña SMTP débil y claves de cifrado reutilizadas · 🔴

**Ubicación:** `WinServer/win-server/.env`

| Variable | Problema |
|---|---|
| `WIN_MAIL_PASSWORD` | Contraseña personal con patrón trivial (nombre + año). Es la cuenta desde la que se envían las facturas electrónicas de **todos** los clientes. |
| `APP_SECRET_ENCRYPTION_KEY` y `WHATSAPP_TOKEN_ENCRYPTION_KEY` | **Mismo valor.** Reutilización de clave entre dominios criptográficos distintos: comprometer uno compromete el otro. |
| `AI_GEMINI_API_KEY` y `AI_GEMINI_EMBEDDING_API_KEY` | **Misma clave**, pese a que el comentario en `application.properties` especifica que la de embeddings es la clave global de WinSuit y no la del tenant. |

**Otras claves sensibles en el mismo archivo:** `WHATSAPP_APP_SECRET`, `SRI_WORKER_INTERNAL_TOKEN`, `SRI_CREDENTIAL_ENCRYPTION_KEY` (cifra las credenciales del SRI de cada empresa), `FIRMA_CREDENTIAL_ENCRYPTION_KEY` (cifra los certificados de firma electrónica), `PAYPHONE_TOKEN`.

**Remediación.** Rotar todas · generar claves de cifrado independientes y aleatorias por dominio · cuenta de correo transaccional dedicada con credencial de aplicación, no personal · documentar el procedimiento de rotación.

---

<a id="h09"></a>
### H09 · Módulo Nómina sin control de acceso · 🔴

**Ubicación:** `Frontend/winsuite/src/app/core/config/module-catalog.ts` (Nómina **no aparece**) y `src/app/app.routes.ts` (rutas de nómina sin `moduleAccessGuard`).

**Impacto.** Todos los demás módulos están registrados en el catálogo y protegidos por `moduleAccessGuard`. Nómina no: cualquier usuario autenticado del workspace puede acceder a los sueldos, liquidaciones y datos personales de todos los empleados de su empresa. Se agrava por H02 (aunque el guard existiera, la escritura directa a RTDB seguiría abierta).

**Remediación.** Registrar `nomina` en `module-catalog.ts` con sus permisos, aplicar `moduleAccessGuard` a ambas ramas de ruteo (`workspace/nomina/*` y `workspace/contabilidad/nomina/*`), y sumar la comprobación de rol correspondiente en las reglas o el backend.

---

<a id="h10"></a>
### H10 · Rate limit del copiloto público inefectivo tras proxy · 🟠

**Ubicación**
- `WinServer/.../infrastructure/web/PublicCopilotController.java:20` — `rateLimit.requireAllowed(httpRequest.getRemoteAddr())`
- `WinServer/.../application/service/ai/PublicCopilotRateLimitService.java:13` — `ConcurrentHashMap<String, Window>`
- `WinServer/.../infrastructure/config/WebSecurityConfig.java:53` — `/api/public/copilot/**` en `permitAll`

**Impacto.** El endpoint de IA es público y no autenticado: cada llamada gasta tokens de Anthropic o Google **a coste de WinSuit**. En el despliegue Docker detrás de un proxy, `getRemoteAddr()` devuelve la IP del proxy, por lo que el límite se aplica **globalmente a todos los usuarios** en lugar de por cliente: un atacante consume la cuota compartida y de paso deja fuera de servicio la función para los visitantes legítimos. Además, el `ConcurrentHashMap` no tiene evicción → fuga de memoria lenta con IPs distintas.

**Remediación.** Leer la IP real de `X-Forwarded-For` con `ForwardedHeaderFilter` y una lista de proxies de confianza · añadir evicción por TTL (o usar Caffeine, que ya es dependencia del proyecto) · añadir un tope global diario de gasto de tokens con alerta · considerar captcha o token de sesión efímero antes de permitir el uso.

---

<a id="h11"></a>
### H11 · CORS de producción admite `localhost` con credenciales · 🟠

**Ubicación**
- `WinServer/win-server/docker-compose.prod.yml:49` — `CORS_ALLOWED_ORIGINS=https://dashboard.winsuit.app,http://localhost:4200`
- `WinServer/.../infrastructure/config/WebSecurityConfig.java:72` — `setAllowCredentials(true)`

**Impacto.** Una aplicación maliciosa corriendo en el `localhost` del usuario (o cualquier página que consiga que el navegador la sirva desde ese origen) puede llamar a la API de producción **con las credenciales del usuario**.

**Remediación.** Quitar `http://localhost:4200` de la configuración de producción y dejarlo solo en la de desarrollo.

---

<a id="h12"></a>
### H12 · Sin Firebase App Check · 🟠

**Ubicación:** `Frontend/winsuite/src/app/app.config.ts` — cero referencias a `appCheck`.

**Impacto.** La `apiKey` de Firebase es pública por diseño, pero sin App Check nada impide que un cliente ajeno a la aplicación cree cuentas masivamente o golpee RTDB y Auth directamente desde scripts. App Check ata las peticiones a instancias legítimas de la app.

**Remediación.** Activar App Check con reCAPTCHA Enterprise para web, en modo *monitor* primero y luego *enforce*.

---

<a id="h13"></a>
### H13 · Defaults inseguros en claves de cifrado · 🟠

**Ubicación:** `WinServer/win-server/src/main/resources/application.properties`

| Línea | Propiedad | Default |
|---|---|---|
| 19 | `sri.download.worker-token` | `local-dev-token` |
| 20 | `sri.download.credential-key` | `local-dev-change-me` |
| 21 | `firma.credential-key` | `local-dev-change-me` |
| 37 | `invoice.mail.credential-key` | `local-dev-change-me` |
| 63 | `whatsapp.webhook-verify-token` | `local-dev-token` |

**Impacto.** Si la variable de entorno falta o llega vacía en un despliegue, la aplicación **arranca igualmente** y cifra los certificados de firma electrónica y las credenciales del SRI de los clientes con una cadena literal conocida y publicada en el repositorio. Un fallo de configuración silencioso se convierte en un compromiso total de esos datos.

**Remediación.** Quitar los defaults en el perfil de producción y validar al arranque: `@Value` sin default más un `@PostConstruct` que falle si el valor está vacío o coincide con el placeholder. Fallar rápido es preferible a cifrar mal.

---

<a id="h14"></a>
### H14 · ID token de Firebase enviado al worker local por HTTP · 🟠

**Ubicación**
- `Frontend/winsuite/src/app/core/interceptors/auth.interceptor.ts:29-33` — adjunta `Authorization: Bearer <idToken>` a **todas** las peticiones, sin filtrar por origen.
- `Frontend/winsuite/src/app/core/services/sri-descargas.service.ts:27,32,37` — peticiones a `http://127.0.0.1:8010`.

**Impacto.** Cualquier proceso local que consiga escuchar en el puerto 8010 de la máquina del usuario captura un ID token de Firebase válido, con el que puede actuar como ese usuario. Además, las credenciales del portal del SRI viajan en claro por HTTP al endpoint `/config` del worker.

**Nota:** el comportamiento está documentado como intencional en `sri-descargas.service.ts:22-25`.

**Remediación.** Filtrar el interceptor por origen (adjuntar el ID token solo a `apiBaseUrl`) · emitir un token de corta vida y ámbito reducido para hablar con el worker local · cifrar o firmar el payload de credenciales del SRI en lugar de enviarlo en claro.

---

<a id="h15"></a>
### H15 · Sin APM ni error tracking; logs con PII a nivel INFO · 🟠

**Ubicación**
- Ausencia total: cero referencias a `sentry|datadog|newrelic|opentelemetry` en front y back.
- `Frontend/winsuite/src/app/app.config.ts` — `provideBrowserGlobalErrorListeners()` solo escribe en la consola del navegador; los ~34 `console.log/error` no llegan a ningún sistema.
- `WinServer/.../infrastructure/config/JwtAuthenticationFilter.java:71` — `log.info("Token verified successfully for user: {}", ...)` en **cada** petición autenticada; `:125` loguea el tenant; `:132` el uid; `:77` el **email** de quien intenta acceder al panel de plataforma.

**Impacto.** No hay forma de saber que algo falla en producción salvo que un cliente lo reporte. El endpoint público de IA solo se detectaría abusado por la factura del proveedor. Al mismo tiempo, se genera correlación uid↔tenant↔email en logs de stdout no rotados ni cifrados, con volumen enorme.

**Remediación.** Error tracking en front y back · logs estructurados con nivel adecuado (esos INFO → DEBUG) y sin PII · exponer métricas (`/actuator/prometheus`) y definir alertas mínimas: tasa de error 5xx, latencia p95, consumo de tokens de IA, comprobantes SRI en estado de error.

---

<a id="h16"></a>
### H16 · LOPDP: derechos ARCO prometidos sin implementación · 🟠

**Ubicación**
- `Frontend/winsuite/src/app/features/legal/pages/politica-privacidad/politica-privacidad.component.html:148,155` — menciona portabilidad y la Superintendencia de Protección de Datos Personales.
- `terminos-condiciones.component.html:86` — menciona la figura de "encargado del tratamiento".
- Contra: ningún controlador del backend implementa export ni supresión de datos a petición del titular.

**Impacto.** La política publicada promete derechos que el sistema no puede ejercer. Es incumplimiento documentado por escrito — la peor combinación ante un requerimiento de la autoridad.

**Carencias adicionales:** no aparece "LOPDP" ni "Ley Orgánica de Protección de Datos Personales" por su nombre en ningún archivo · sin registro de consentimientos ni banner de cookies · sin DPA con los clientes · sin clasificación ni cifrado a nivel de campo de los datos de empleados (nómina) y clientes, que viven en claro en RTDB · sin declaración de la región donde residen los datos (obligatorio informar transferencias internacionales).

**Remediación.** Endpoint y pantalla de export de datos del titular · borrado a petición con trazabilidad en el audit log · registro de consentimientos · declaración de región y transferencias · plantilla de DPA para clientes.

---

<a id="h17"></a>
### H17 · `@angular/fire` en release candidate en producción · 🟡

**Ubicación:** `Frontend/winsuite/package.json` — `"@angular/fire": "21.0.0-rc.0"`.

**Impacto.** Una RC puede introducir cambios incompatibles sin aviso y no tiene garantías de soporte. Toda la capa de datos del producto depende de ella.

**Remediación.** Fijar a la versión estable en cuanto exista; mientras tanto, pin exacto (ya lo está) y verificación en el CI de H07 antes de cualquier bump.

---

<a id="h18"></a>
### H18 · Rol comparado por string en lugar de por identificador · 🟡

**Ubicación:** `Frontend/winsuite/src/app/core/services/authorization.service.ts:20,36` — `if (profile.role.toUpperCase() === 'ADMIN')` devuelve el comodín de todos los permisos.

**Impacto.** Un rol personalizado creado por el usuario y llamado "admin", "Admin" o "ADMIN" obtiene privilegios totales en la interfaz sin haberlos configurado. Es una escalada accidental, no requiere intención maliciosa.

**Remediación.** Comparar por identificador de rol de sistema, no por su nombre visible · impedir que los roles personalizados usen nombres reservados.

---

<a id="h19"></a>
### H19 · `updateMetadata` permite falsear la autoría desde el cliente · 🟡

**Ubicación:** `Frontend/winsuite/src/app/core/services/audit.service.ts:87` — escribe `creadoPor` / `actualizadoPor` directamente en RTDB desde el cliente, sin `.validate` que fuerce `=== auth.uid`.

**Impacto.** Un usuario puede atribuir la modificación de un registro a otro compañero. **No afecta al audit log real** (que sí es server-side vía `POST /api/audit/events` y vive en un proyecto separado e inescribible desde el cliente), pero sí a la trazabilidad visible en las fichas de cada registro, que es la que el usuario consulta a diario.

**Remediación.** Añadir `.validate` en las reglas: `newData.child('actualizadoPor').val() === auth.uid`. Se resuelve de paso al abordar H02.

---

<a id="h20"></a>
### H20 · Datos personales del representante legal con correo personal · 🟡

**Ubicación:** `Frontend/winsuite/src/app/features/legal/data/datos-empresa.ts:47-63` — publica nombre completo, dirección domiciliaria detallada, teléfono móvil y un correo de Gmail personal como contacto corporativo.

**Impacto.** La publicación es exigida por Meta para la verificación de negocio, así que el dato debe existir. El problema es el **grado de detalle** y el uso de un correo personal como canal de contacto de una empresa que trata datos personales de terceros: cualquier notificación legal o solicitud ARCO llegaría a una bandeja personal sin trazabilidad ni continuidad.

**Remediación.** Correo de contacto en dominio propio (`legal@winsuit.app` o similar) · dirección a nivel de ciudad/sector en lugar de domicilio exacto, si la verificación lo permite · completar los campos que siguen pendientes (razón social, RUC).

---

## Procedimiento de cierre

Al remediar un hallazgo:

1. Cambiar su **Estado** a ✅ en la tabla resumen y en el detalle.
2. Añadir bajo el hallazgo una línea `**Cerrado:** <fecha> · <commit o PR> · <qué se hizo>`.
3. Si se decide asumir el riesgo, marcar ⚪ **con la justificación escrita y quién la aprueba** — no dejar hallazgos abiertos indefinidamente sin decisión.
4. Añadir, siempre que sea posible, un test automático que impida la regresión (ver H07).

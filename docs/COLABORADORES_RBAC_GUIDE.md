# Guía corta de RBAC para nuevos módulos

Para agregar un módulo nuevo en WinSuite:

1. Define el módulo y sus acciones mínimas: `create`, `read`, `update`, `delete`.
2. Registra la ruta lazy en `app.routes.ts` con `canMatch` o `canActivate` usando `moduleAccessGuard`.
3. Agrega el item al menú lateral con `requiredModule` y `requiredAction` para ocultarlo cuando no corresponda.
4. Crea la pantalla principal con el patrón visual del proyecto: `surface-card`, encabezado con `eyebrow`, título, descripción y acciones claras.
5. En formularios y listados, valida permisos antes de habilitar botones de crear/editar/eliminar.
6. Si el módulo gestiona usuarios o permisos, reutiliza `TenantApiService`, `AuthorizationService` y las pantallas de Colaboradores como referencia.

Regla práctica: si un usuario no puede ejecutar una acción, tampoco debe verla en el menú o en el botón de la pantalla.

# Separacion de Firebase: principal, auditoria y sitios

## Distribucion

- Principal: autenticacion, negocio, formularios, respuestas, pedidos y pagos.
- Auditoria: `auditoria/{tenantId}/eventos`.
- Sitios: `sitios`, `sitios_resumen`, `sitios_catalogo`, `publicaciones`, `subdominios`, `dominios_custom` y Storage `sitios/**`.

## Preparacion

1. Crear los proyectos Firebase de auditoria y sitios con Realtime Database.
2. Activar Authentication en el proyecto de sitios para aceptar custom tokens.
3. Crear cuentas de servicio diferentes para WinServer y winsuite-sites.
4. Desplegar `firebase.audit.json` en el proyecto de auditoria y `firebase.sites.json` en el de sitios.
5. Reemplazar `sitesFirebase` en los dos archivos de environment del dashboard.

## Migracion

El script vive en `Frontend/winsuite-sites` y siempre inicia en modo simulacion.

Variables requeridas:

- `SOURCE_DATABASE_URL`, `SOURCE_SERVICE_ACCOUNT_JSON`, `SOURCE_STORAGE_BUCKET`
- `AUDIT_DATABASE_URL`, `AUDIT_SERVICE_ACCOUNT_JSON`
- `SITES_DATABASE_URL`, `SITES_SERVICE_ACCOUNT_JSON`, `SITES_STORAGE_BUCKET`

Ejecutar primero desde `Frontend/winsuite-sites`:

```powershell
npm run migrate:firebase-split
```

Revisar conteos y luego aplicar:

```powershell
$env:MIGRATION_APPLY='true'
npm run migrate:firebase-split
```

No activar `MIGRATION_DELETE_SOURCE` hasta validar visualmente auditoria, editor, sitio publicado, formulario y pedido. El script no mueve `sitios_formularios`, `form_submissions`, `pedidos_web` ni `pagos_config`.

## Despliegue

Configurar en WinServer las variables `FIREBASE_AUDIT_*` y `FIREBASE_SITES_*`. En winsuite-sites configurar credenciales y URLs separadas `FIREBASE_PRIMARY_*` y `FIREBASE_SITES_*`. Si no se proporcionan, el codigo usa temporalmente el proyecto principal para permitir una transicion controlada.

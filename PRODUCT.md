# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipos administrativos y contables que gestionan la operación de distintas empresas clientes desde un ERP multiempresa.

## Product Purpose

WinSuite centraliza los procesos comerciales, administrativos, contables y de nómina. En Nómina, el objetivo es mantener empleados, calcular roles de pago y producir asientos contables revisables y trazables por empresa.

## Operating Context

La configuración y los datos operativos se aíslan por tenant. Los contadores parametrizan catálogos y cuentas antes de aprobar documentos; cuando falta una cuenta, el flujo permite resolverla durante la revisión del asiento sin perder el borrador.

## Capabilities and Constraints

- Aplicación Angular con Angular Material y Firebase Realtime Database.
- La configuración de cargos y departamentos pertenece a cada tenant.
- Los roles aprobados y sus asientos son históricos: cambios posteriores de catálogo no deben recalcularlos.
- La interfaz y los permisos usan los patrones existentes de los módulos de Contabilidad y Nómina.

## Product Principles

- Mantener trazabilidad entre la operación de nómina y el asiento contable.
- Permitir configuración progresiva sin ocultar datos incompletos.
- Preservar compatibilidad con información histórica y migraciones asistidas.
- Priorizar tareas contables claras, verificables y accesibles.


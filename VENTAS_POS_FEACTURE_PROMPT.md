# 🛒 MÓDULO DE VENTAS / POS — Contexto para Claude Code
**Stack confirmado:** Angular · Firebase Realtime Database · Angular Material · Standalone Components

> Este documento especifica el módulo de Ventas (Point of Sale) del SaaS. Se integra directamente con el módulo de Inventario ya documentado en `INVENTARIO_MODULE_PROMPT.md`. Leer ambos documentos antes de implementar. No duplicar lógica ya existente en Inventario — importar sus servicios.

---

## ✅ Decisiones Técnicas Confirmadas

| Item | Respuesta |
|---|---|
| Backend | Firebase Realtime Database |
| Framework | Angular 17+ Standalone Components |
| UI | Angular Material |
| Componente cliente rápido | Reutilizar `CamposCustomFormComponent` (selector `app-campos-custom-form`) |
| Stock al vender | Llama a `KardexService` del módulo Inventario — motivo `VENTA` |
| Stock al revertir venta | Llama a `KardexService` — motivo `DEVOLUCION` |
| Reverso de venta | Solo si la venta está en estado `COMPLETADA` y dentro del período permitido |
| Sesiones de caja | Cada venta pertenece a una sesión (`sesionId`) del vendedor |

---

## 🗺️ Árbol de Rutas del Módulo

```
/ventas
├── /pos                         → Panel Punto de Venta (pantalla principal de cobro)
├── /resumen                     → Historial de ventas + reverso
│   └── /:id                     → Detalle de una venta
└── /informes                    → Dashboard de KPIs e informes
```

---

## 🏗️ Estrategia de Arquitectura

### Principios de Diseño

1. **POS como pantalla de estado** — El panel POS es un componente de estado local (Angular signals). El "carrito" vive en memoria hasta que se confirma la venta. Solo al confirmar se escribe en Firebase.
2. **Venta como documento inmutable** — Una vez confirmada, una `Venta` no se edita. Los errores se corrigen con un "Reverso" que genera un documento separado.
3. **Integración con Inventario vía servicios** — El módulo de Ventas importa `KardexService` y `ProductosService` de Inventario. No accede directamente a los nodos `/stock` o `/kardex` — usa los métodos ya definidos.
4. **Verificación de stock en tiempo real** — El POS escucha el nodo `/stock` del producto seleccionado en tiempo real (`valueChanges()`) para mostrar disponibilidad actualizada.
5. **Sesión de caja** — Cada turno de trabajo abre una "sesión". Las ventas se agrupan por sesión para los informes de cierre de caja.
6. **Cliente opcional** — La venta puede completarse sin cliente (venta anónima) o con cliente existente/nuevo. Crear cliente rápido desde el POS sin salir de la pantalla.

---

## 🗄️ Estructura Firebase Realtime Database

```
/ventas/

  /documentos/{ventaId}
    numero: string                      ← VEN-0001, VEN-0002...
    sesionId: string
    clienteId: string | null            ← null = venta anónima
    clienteNombre: string               ← snapshot del nombre al vender
    vendedorId: string
    vendedorNombre: string              ← snapshot
    almacenId: string                   ← bodega desde donde se descuenta stock
    estado: 'COMPLETADA' | 'ANULADA' | 'REVERTIDA'
    subtotal: number
    descuento: number                   ← monto total de descuento
    impuesto: number
    total: number
    moneda: string                      ← snapshot de config al momento de venta
    notas: string
    creadoEn: number
    revertidaEn: number | null
    revertidaPor: string | null
    motivoReverso: string | null
    ventaOriginalId: string | null      ← si este doc ES un reverso, apunta al original

  /ventasItems/{ventaId}/{itemId}
    productoId: string
    sku: string                         ← snapshot
    nombre: string                      ← snapshot
    cantidad: number
    precioUnitario: number              ← precio al momento de venta
    costoUnitario: number               ← costo al momento de venta (para COGS)
    descuentoItem: number               ← descuento sobre este ítem
    subtotalItem: number                ← (precioUnitario - descuentoItem) * cantidad
    impuestoItem: number

  /ventasPagos/{ventaId}/{pagoId}
    metodo: 'EFECTIVO' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA'
          | 'QR' | 'CREDITO_CLIENTE'
    monto: number
    referencia: string                  ← número de transacción, últimos 4 dígitos, etc.
    creadoEn: number

  /sesiones/{sesionId}
    vendedorId: string
    vendedorNombre: string
    almacenId: string
    estado: 'ABIERTA' | 'CERRADA'
    fondoInicial: number                ← efectivo inicial en caja
    fondoCierre: number | null
    totalVentas: number                 ← acumulado (se actualiza con transaction)
    cantidadVentas: number              ← acumulado
    totalEfectivo: number
    totalTarjeta: number
    totalOtros: number
    abiertaEn: number
    cerradaEn: number | null

  /configuracion/ventas/
    permitirVentaSinStock: boolean      ← default: false
    permitirDescuentos: boolean
    descuentoMaximo: number             ← % máximo de descuento por ítem
    diasParaReverso: number             ← ventana de tiempo para revertir (ej. 30)
    impuestoPorDefecto: number          ← % IVA/IGV (sincronizado con config inventario)
    prefijoPOS: string                  ← 'VEN-'
    mostrarCosto: boolean               ← mostrar precio costo en POS (para admin)
```

---

## 🧩 Submódulo 1 — PANEL POS (`/ventas/pos`)

### Visión General del Layout

```
┌─────────────────────────────────────┬────────────────────────────────┐
│  PANEL IZQUIERDO — Búsqueda         │  PANEL DERECHO — Carrito       │
│  de Productos                       │                                │
│                                     │  Vendedor: Juan Pérez  🟢      │
│  [🔍 Buscar por SKU o nombre...]    │  Almacén: Bodega Central       │
│                                     │  ─────────────────────────     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │  CLIENTE                       │
│  │Prod A│ │Prod B│ │Prod C│        │  [🔍 Buscar cliente...  ]  [+] │
│  │$15.00│ │$22.00│ │$8.50 │        │  ─────────────────────────     │
│  │Stock:│ │Stock:│ │Stock:│        │  PRODUCTOS EN VENTA            │
│  │  12  │ │   0  │ │  45  │        │                                │
│  └──────┘ └──────┘ └──────┘        │  Prod A   x2   $30.00  [🗑]   │
│                                     │  Prod C   x1    $8.50  [🗑]   │
│  Filtros: [Categoría ▼]            │                                │
│           [Solo con stock ☑]       │  ─────────────────────────     │
│                                     │  Subtotal:          $38.50     │
│                                     │  Descuento:          $0.00     │
│                                     │  Impuesto (12%):     $4.62     │
│                                     │  TOTAL:             $43.12     │
│                                     │  ─────────────────────────     │
│                                     │  MÉTODO DE PAGO                │
│                                     │  [💵 Efectivo] [💳 Tarjeta]   │
│                                     │  [🏦 Transfer] [📱 QR]        │
│                                     │                                │
│                                     │  [🗑 Limpiar]  [✅ COBRAR]    │
└─────────────────────────────────────┴────────────────────────────────┘
```

### Estado del POS (Angular Signals — solo en memoria)

```typescript
// pos-state.service.ts — estado reactivo del carrito
interface CarritoItem {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  descuentoItem: number;
  stockDisponible: number;          // sincronizado en tiempo real desde Firebase
}

interface CarritoState {
  items: CarritoItem[];
  clienteId: string | null;
  clienteNombre: string | null;
  descuentoGlobal: number;
  metodoPago: MetodoPago[];         // permite pago mixto (efectivo + tarjeta)
  notas: string;
}

// Usando Signals:
readonly carrito = signal<CarritoState>(estadoVacio);
readonly subtotal = computed(() => /* suma items */);
readonly totalDescuento = computed(() => /* descuentos */);
readonly impuesto = computed(() => /* subtotal * % config */);
readonly total = computed(() => subtotal() - totalDescuento() + impuesto());
readonly hayStockInsuficiente = computed(() =>
  carrito().items.some(i => i.cantidad > i.stockDisponible)
);
```

### Panel Izquierdo — Búsqueda de Productos

**Comportamiento:**
- Búsqueda por SKU (exacta, `Enter` agrega directamente) o nombre (debounce 300ms)
- Grid de cards de productos con: nombre, SKU, precio venta, stock disponible en el almacén de la sesión
- Card de producto con **stock = 0**: se muestra con opacidad reducida, badge "Sin stock", no se puede agregar (a menos que `config.permitirVentaSinStock = true`)
- Click en card → agrega al carrito con cantidad 1; si ya está en carrito → incrementa cantidad
- Stock se actualiza en tiempo real desde Firebase (`.valueChanges()`)

**Card de Producto en el Grid:**
```
┌──────────────────────┐
│  [Imagen o ícono]    │
│  Nombre del Producto │
│  SKU: PROD-001       │
│  $15.00              │
│  Stock: 12 un    🟢  │
└──────────────────────┘
```
Chip de stock: 🟢 disponible / 🟡 bajo mínimo / 🔴 sin stock

### Panel Derecho — Carrito

#### Sección: Vendedor y Sesión
```
Vendedor: Juan Pérez  [●  SESIÓN ACTIVA]
Almacén:  Bodega Central
```
- El vendedor es el usuario autenticado (`auth.currentUser`)
- Si no hay sesión abierta → mostrar dialog para abrir sesión con fondo inicial

#### Sección: Cliente
```
[🔍 Buscar cliente por nombre/RUC...]    [+ Nuevo]
```
- Búsqueda con autocomplete contra `/clientes` de Firebase
- Chip con nombre del cliente una vez seleccionado, con botón [×] para quitar
- Botón [+ Nuevo] → abre `MatBottomSheet` o `MatDialog` con formulario rápido de cliente

**Formulario Rápido de Cliente (MatDialog/MatBottomSheet):**
> Reutilizar `CamposCustomFormComponent` para los campos personalizados, igual que en el módulo de Clientes. Solo mostrar los campos marcados como `requerido: true` para agilizar el proceso en caja.

```
Nombre*           RUC/Cédula*
Email             Teléfono
────────────────────────────────
Campos personalizados requeridos
<app-campos-custom-form [campos]="camposRequeridos" />
────────────────────────────────
[Cancelar]        [Crear y Seleccionar]
```
Al guardar: crea el cliente en `/clientes` y lo selecciona automáticamente en el carrito.

#### Sección: Ítems del Carrito

```
┌──────────────────────────────────────────────────────┐
│  Prod A          [-] [2] [+]    $30.00   [desc %] 🗑 │
│  Prod C          [-] [1] [+]     $8.50   [desc %] 🗑 │
└──────────────────────────────────────────────────────┘
```

- `[-]` y `[+]` modifican cantidad; no puede superar `stockDisponible` (validación en tiempo real)
- `[desc %]` campo inline de descuento por ítem (0 - `config.descuentoMaximo`); solo visible si `config.permitirDescuentos = true`
- `🗑` elimina el ítem del carrito
- Si cantidad intenta superar stock → mostrar `MatSnackBar` de advertencia y bloquear

#### Sección: Totales y Descuento Global
```
Subtotal:                    $38.50
Descuento global: [  0  ]%    $0.00
Impuesto (12%):               $4.62
────────────────────────────────────
TOTAL:                       $43.12
```

#### Sección: Métodos de Pago

**Pago simple (un método):**
```
[💵 Efectivo]  [💳 Crédito]  [💳 Débito]  [🏦 Transfer]  [📱 QR]  [🏷️ Crédito Cliente]
```
Click en un método → se marca como activo; el monto se pre-rellena con el total.

**Pago mixto (varios métodos):**
Al hacer click en un método ya seleccionado → permite dividir el monto:
```
💵 Efectivo:      [$20.00]
💳 Tarjeta:       [$23.12]
────────────────────────
Total pagado:     $43.12  ✅
```
Validar que la suma de pagos = total antes de habilitar [COBRAR].

**Si método = Efectivo:**
```
Efectivo recibido: [$50.00]
Cambio a devolver:  $6.88   ← calculado en tiempo real
```

#### Botón COBRAR — Flujo de Confirmación

El botón COBRAR está deshabilitado si:
- El carrito está vacío
- Hay ítems con stock insuficiente (y `config.permitirVentaSinStock = false`)
- La suma de pagos ≠ total
- No hay sesión activa

Al hacer click en COBRAR:

```typescript
// Secuencia atómica en VentasService.procesarVenta():

// 1. Validar stock de TODOS los ítems antes de escribir
for (const item of carrito.items) {
  const stockActual = await getStockActual(item.productoId, sesion.almacenId);
  if (stockActual < item.cantidad && !config.permitirVentaSinStock) {
    throw new Error(`Stock insuficiente: ${item.nombre}`);
  }
}

// 2. Generar número correlativo de venta
const numero = await generarNumeroVenta(); // VEN-0001

// 3. Crear documento de venta en /ventas/documentos (push)
const ventaId = await crearDocumentoVenta(ventaData);

// 4. Crear ítems en /ventas/ventasItems/{ventaId}
await crearItemsVenta(ventaId, carrito.items);

// 5. Crear pagos en /ventas/ventasPagos/{ventaId}
await crearPagosVenta(ventaId, carrito.metodoPago);

// 6. Por cada ítem — llamar KardexService del módulo Inventario:
for (const item of carrito.items) {
  await kardexService.registrarMovimiento(item.productoId, {
    tipo: 'SALIDA',
    motivo: 'VENTA',
    almacenId: sesion.almacenId,
    cantidad: item.cantidad,
    costoUnitario: item.costoUnitario,
    costoTotal: item.cantidad * item.costoUnitario,
    referenciaId: ventaId,
    referenciaTipo: 'VENTA',
    creadoPor: vendedorId,
    creadoEn: Date.now()
  });
  // KardexService internamente actualiza /stock con transaction()
}

// 7. Actualizar acumulados de la sesión con transaction()
await actualizarSesion(sesion.sesionId, {
  totalVentas: +carrito.total,
  cantidadVentas: +1,
  totalEfectivo: +montoEfectivo,
  totalTarjeta: +montoTarjeta,
});

// 8. Mostrar pantalla de éxito / ticket
```

#### Pantalla Post-Venta (MatDialog de éxito)
```
┌──────────────────────────────────────┐
│  ✅  VENTA EXITOSA                   │
│  VEN-0042                            │
│  Total cobrado: $43.12               │
│  Cambio entregado: $6.88             │
│                                      │
│  [🖨️ Imprimir Ticket]               │
│  [📧 Enviar por Email]               │
│  [🛒 Nueva Venta]                    │
└──────────────────────────────────────┘
```
"Nueva Venta" limpia el carrito y cierra el dialog.

---

## 🧩 Submódulo 2 — RESUMEN DE VENTAS (`/ventas/resumen`)

### Lista de Ventas

```
FILTROS
  [Fecha desde ─ Hasta]  [Vendedor ▼]  [Estado ▼]  [Cliente 🔍]
  [Almacén ▼]

KPI CARDS (dinámicas según filtros activos)
  [Total Ventas: $12,450]   [N° Transacciones: 87]   [Ticket Promedio: $143]

TABLA DE VENTAS
  N° Venta │ Fecha     │ Cliente       │ Vendedor  │ Total   │ Estado      │ Acciones
  VEN-0042  │ 15 ene    │ Juan Rodríguez│ Ana López │ $43.12  │ COMPLETADA  │ [👁][↩️]
  VEN-0041  │ 15 ene    │ (Anónimo)     │ Ana López │ $120.00 │ COMPLETADA  │ [👁][↩️]
  VEN-0039  │ 14 ene    │ María García  │ Carlos R. │ $55.00  │ REVERTIDA   │ [👁]
```

**Acciones por fila:**
- `[👁 Ver]` → navega a `/ventas/resumen/:id` (vista detalle en modo lectura)
- `[↩️ Revertir]` → visible solo si estado = `COMPLETADA` y `fechaVenta` dentro de los `config.diasParaReverso` días

### Vista Detalle de Venta (`/ventas/resumen/:id`)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Volver   VENTA #VEN-0042                [↩️ Revertir]    │
│  Estado: COMPLETADA   15 ene 2025 14:32                      │
├────────────────────────┬─────────────────────────────────────┤
│  CLIENTE               │  VENDEDOR                           │
│  Juan Rodríguez        │  Ana López                          │
│  RUC: 1234567890       │  Sesión: SES-045                    │
│  Email: j@example.com  │  Almacén: Bodega Central            │
├────────────────────────┴─────────────────────────────────────┤
│  PRODUCTOS                                                    │
│  SKU       │ Producto  │ Cant │ P. Unit │ Desc │ Subtotal    │
│  PROD-001  │ Producto A│   2  │  $15.00 │  0%  │  $30.00    │
│  PROD-003  │ Producto C│   1  │   $8.50 │  0%  │   $8.50    │
├──────────────────────────────────────────────────────────────┤
│  PAGOS                                                        │
│  💵 Efectivo: $50.00   Cambio: $6.88                         │
├──────────────────────────────────────────────────────────────┤
│  Subtotal: $38.50  │  Descuento: $0.00  │  IVA: $4.62       │
│  TOTAL: $43.12                                               │
└──────────────────────────────────────────────────────────────┘
```

### Flujo de Reverso de Venta

Al hacer click en `[↩️ Revertir]`:

**Paso 1 — Dialog de confirmación con motivo:**
```
┌──────────────────────────────────────────────────────┐
│  ↩️ REVERTIR VENTA #VEN-0042                        │
│                                                      │
│  Esta acción:                                        │
│  • Marcará la venta como REVERTIDA                  │
│  • Devolverá el stock de 2 productos al inventario  │
│  • NO revertirá el movimiento de efectivo           │
│                                                      │
│  Motivo del reverso*:                                │
│  [textarea — obligatorio]                            │
│                                                      │
│  [Cancelar]              [Confirmar Reverso]         │
└──────────────────────────────────────────────────────┘
```

**Paso 2 — Secuencia de ejecución (`VentasService.revertirVenta()`):**

```typescript
// ⚠️ Validaciones antes de ejecutar:
// 1. Estado de venta debe ser 'COMPLETADA'
// 2. Fecha de venta dentro de ventana de config.diasParaReverso
// 3. No debe existir ya un reverso asociado a esta venta

async revertirVenta(ventaId: string, motivo: string, userId: string): Promise<void> {

  // 1. Obtener ítems de la venta original
  const items = await getItemsVenta(ventaId);

  // 2. Por cada ítem — devolver stock vía KardexService (ENTRADA/DEVOLUCION)
  for (const item of items) {
    await kardexService.registrarMovimiento(item.productoId, {
      tipo: 'ENTRADA',
      motivo: 'DEVOLUCION',
      almacenId: ventaOriginal.almacenId,
      cantidad: item.cantidad,
      costoUnitario: item.costoUnitario,   // costo snapshot del momento de la venta
      costoTotal: item.cantidad * item.costoUnitario,
      referenciaId: ventaId,
      referenciaTipo: 'VENTA',
      notas: `Reverso venta ${ventaOriginal.numero}: ${motivo}`,
      creadoPor: userId,
      creadoEn: Date.now()
    });
    // KardexService.registrarMovimiento actualiza /stock con transaction()
  }

  // 3. Marcar venta original como REVERTIDA (multi-path update)
  await db.ref().update({
    [`ventas/documentos/${ventaId}/estado`]: 'REVERTIDA',
    [`ventas/documentos/${ventaId}/revertidaEn`]: Date.now(),
    [`ventas/documentos/${ventaId}/revertidaPor`]: userId,
    [`ventas/documentos/${ventaId}/motivoReverso`]: motivo,
  });

  // 4. Restar acumulados de la sesión original (si aún está abierta)
  if (sesionOriginal.estado === 'ABIERTA') {
    await actualizarSesion(sesionId, {
      totalVentas: -ventaOriginal.total,
      cantidadVentas: -1,
    });
  }
}
```

**Reglas del Reverso:**
- No se puede revertir una venta ya `REVERTIDA` o `ANULADA`
- No se puede revertir fuera de la ventana `config.diasParaReverso`
- El reverso restaura el stock al almacén de la venta original, no al almacén actual del vendedor
- El reverso NO afecta los métodos de pago (el reembolso se gestiona fuera del sistema)
- El reverso crea entradas en el Kardex con `motivo: 'DEVOLUCION'` y `referenciaId` apuntando a la ventaId original

---

## 🧩 Submódulo 3 — INFORMES DE VENTAS (`/ventas/informes`)

### Filosofía del Dashboard

El dashboard de informes está diseñado para responder las preguntas más valiosas para el negocio:
1. **¿Cuánto estoy vendiendo?** (volumen y tendencias)
2. **¿Qué es lo que más vende?** (mix de productos)
3. **¿Quiénes son mis mejores clientes?** (retención y valor)
4. **¿Cuándo y quién vende más?** (rendimiento por vendedor/horario)
5. **¿Cuánto estoy ganando realmente?** (margen y rentabilidad)

### Layout General del Dashboard

```
FILTROS GLOBALES (sticky en la parte superior)
  [Período: Últimos 30 días ▼]   [Desde ──── Hasta]
  [Almacén: Todos ▼]   [Vendedor: Todos ▼]   [Categoría: Todas ▼]
  [Actualizar]

SECCIÓN 1 — KPIs Principales (Cards en fila)

SECCIÓN 2 — Gráficos de Tendencia

SECCIÓN 3 — Rankings y Tablas Analíticas

SECCIÓN 4 — Rentabilidad
```

---

### SECCIÓN 1 — KPIs Principales

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 💰 TOTAL VENTAS  │ │ 🧾 TRANSACCIONES │ │ 🛒 TICKET PROMEDIO│ │ 📦 UNIDADES VEND.│
│   $45,200.00     │ │      312          │ │    $144.87        │ │     1,248         │
│  ↑ 12% vs mes    │ │  ↑ 8% vs mes     │ │  ↑ 3% vs mes     │ │  ↓ 2% vs mes     │
│  anterior        │ │  anterior         │ │  anterior         │ │  anterior         │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 📊 COGS ESTIMADO │ │ 💹 MARGEN BRUTO  │ │ 👥 CLIENTES ÚNICOS│ │ ↩️ TASA REVERSO  │
│   $28,400.00     │ │     37.2%         │ │      198          │ │     1.6%          │
│  (costo ventas)  │ │  (estimado)       │ │  de ese período   │ │  (% ventas rev.) │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Cálculo de KPIs:**
```typescript
// Total Ventas: suma de venta.total donde estado = 'COMPLETADA' en el período
// Transacciones: count de ventas COMPLETADAS
// Ticket Promedio: Total Ventas / Transacciones
// Unidades Vendidas: suma de ventasItems.cantidad en el período
// COGS Estimado: suma de (item.costoUnitario * item.cantidad) de ventasItems
// Margen Bruto: ((Total Ventas - COGS) / Total Ventas) * 100
// Clientes Únicos: count distinct de clienteId (excluyendo null)
// Tasa de Reverso: (ventas REVERTIDAS / ventas COMPLETADAS) * 100
```

---

### SECCIÓN 2 — Gráficos de Tendencia

#### 2.1 Ventas en el Tiempo (gráfico principal)
- **Tipo:** Línea o barras (ngx-charts AreaChart o BarChart)
- **Eje X:** Fechas (agrupado por día/semana/mes según rango)
- **Eje Y:** Monto de ventas
- **Líneas:** Ventas (azul) + COGS estimado (naranja) + Margen (verde punteada)
- **Selector de granularidad:** [Por día] [Por semana] [Por mes]

```
$5,000 ─┤     ╭──╮
        │   ╭─╯  ╰─╮
$3,000 ─┤  ╭╯       ╰─╮
        │╭─╯           ╰──
$1,000 ─┤
        └──────────────────→
        Lun  Mar  Mié  Jue  Vie
```

#### 2.2 Ventas por Hora del Día (heatmap de tráfico)
- **Tipo:** Heatmap simple o gráfico de barras agrupado por hora
- **Eje X:** Hora (00:00 – 23:00)
- **Eje Y:** Día de semana (Lun – Dom)
- **Color:** Intensidad según volumen de ventas
- **Insight:** Permite identificar horas pico y valles para planificar personal

#### 2.3 Mix de Métodos de Pago (donut)
- **Tipo:** Donut / Pie chart
- **Segmentos:** Efectivo / Tarjeta Crédito / Tarjeta Débito / Transferencia / QR / Crédito Cliente
- **Muestra:** % y monto de cada método

---

### SECCIÓN 3 — Rankings y Tablas Analíticas

#### 3.1 Top Productos Más Vendidos

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP PRODUCTOS                          [Por Cantidad ▼]        │
│                                                                  │
│  #  │ Producto      │ SKU     │ Unidades │ Ingresos │ % Total   │
│  1  │ Producto A    │ PR-001  │    245   │ $3,675   │  8.1%     │
│  2  │ Producto B    │ PR-002  │    180   │ $5,400   │  11.9%    │
│  3  │ Producto C    │ PR-003  │    165   │ $1,402   │  3.1%     │
│  ─── Barra visual de proporción ─────────────────────────────  │
└─────────────────────────────────────────────────────────────────┘
Selector: [Por Cantidad] [Por Ingresos] [Por Margen]
```

#### 3.2 Top Vendedores

```
┌─────────────────────────────────────────────────────────────────┐
│  RENDIMIENTO DE VENDEDORES                                       │
│                                                                  │
│  Vendedor    │ Ventas │ Transacc. │ Ticket Prom │ Margen Prom  │
│  Ana López   │$18,200 │    128    │   $142.18   │   38.2%      │
│  Carlos R.   │$15,400 │    105    │   $146.66   │   36.8%      │
│  María G.    │$11,600 │     79    │   $146.83   │   36.1%      │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3 Top Clientes (por valor)

```
┌─────────────────────────────────────────────────────────────────┐
│  MEJORES CLIENTES                      [Por Ingresos ▼]         │
│                                                                  │
│  Cliente         │ Compras │ Ticket Prom │ Total   │ Última     │
│  Juan Rodríguez  │   12    │   $210.00   │ $2,520  │ hace 2 días│
│  María García    │    8    │   $185.00   │ $1,480  │ hace 5 días│
│                                                                  │
│  Clientes sin registrar (anónimo): 114 transacciones = $4,200   │
│  → [Registrar clientes anónimos como oportunidad de mejora]     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4 Ventas por Categoría de Producto (Treemap o barras horizontales)

```
Electrónica    ████████████████████ 35.2%   $15,900
Ropa           ███████████████ 28.1%        $12,700
Alimentos      ██████████ 18.6%              $8,420
Otros          ████████ 18.1%                $8,180
```

---

### SECCIÓN 4 — Rentabilidad

#### 4.1 Análisis de Margen por Producto

```
┌─────────────────────────────────────────────────────────────────┐
│  MARGEN POR PRODUCTO                    [Ordenar por Margen ▼]  │
│                                                                  │
│  Producto     │ P.Venta │ P.Costo │ Margen $ │ Margen %  │ Vtas │
│  Producto X   │  $50.00 │  $12.00 │   $38.00 │   76%     │  45  │
│  Producto A   │  $15.00 │   $8.00 │    $7.00 │   46.6%   │ 245  │
│  Producto Z   │  $22.00 │  $16.00 │    $6.00 │   27.3%   │  90  │
│                                                                  │
│  🔴 Alertas: 3 productos con margen < 10%                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Evolución del Margen Bruto en el Tiempo
- Línea del margen % mes a mes
- Permite ver si el negocio está mejorando o deteriorando su rentabilidad

#### 4.3 Análisis de Descuentos

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPACTO DE DESCUENTOS                                           │
│  Total descuentos otorgados:      $1,240  (2.7% de ventas)     │
│  Venta promedio sin descuento:    $144.00                       │
│  Venta promedio con descuento:    $118.00                       │
│  Vendedor que más descuenta:      Carlos R. (avg 8.2%)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Archivos Angular

```
src/app/modules/ventas/
├── ventas.routes.ts
│
├── models/
│   └── ventas.models.ts                ← Interfaces: Venta, VentaItem, Pago, Sesion
│
├── services/
│   ├── ventas.service.ts               ← procesarVenta(), revertirVenta(), getVentas()
│   ├── sesiones.service.ts             ← abrirSesion(), cerrarSesion(), getSesionActiva()
│   ├── informes-ventas.service.ts      ← cálculo de KPIs y agregaciones
│   └── configuracion-ventas.service.ts
│
├── pages/
│   ├── pos/
│   │   ├── pos.component.ts            ← layout principal del POS
│   │   ├── pos.component.html
│   │   └── pos-state.service.ts        ← estado reactivo del carrito (signals, providedIn: 'self')
│   ├── resumen/
│   │   ├── resumen-ventas.component.ts
│   │   ├── resumen-ventas.component.html
│   │   └── detalle-venta/
│   │       └── detalle-venta.component.ts
│   └── informes/
│       ├── informes-ventas.component.ts
│       └── informes-ventas.component.html
│
└── components/
    ├── pos/
    │   ├── producto-grid/              ← grid de productos con stock en tiempo real
    │   ├── carrito/                    ← panel derecho del POS
    │   ├── metodos-pago/               ← selector de métodos de pago
    │   ├── cliente-selector/           ← búsqueda + formulario rápido de cliente
    │   ├── sesion-dialog/              ← abrir/cerrar sesión
    │   └── venta-exitosa-dialog/       ← pantalla post-cobro
    ├── resumen/
    │   └── reverso-dialog/             ← confirmación + motivo del reverso
    └── informes/
        ├── kpi-card/                   ← card con valor + tendencia vs período anterior
        ├── ventas-chart/               ← gráfico de tendencia (ngx-charts)
        ├── top-productos-table/
        ├── top-vendedores-table/
        └── margen-tabla/
```

---

## 🛡️ Reglas de Negocio — Tabla Completa

| Regla | Descripción |
|---|---|
| **Venta inmutable** | Una vez guardada en Firebase, una `Venta` no se edita. Solo reverso |
| **Reverso, no eliminación** | Las ventas con error se revierten con contra-asiento, nunca se borran |
| **Stock antes de cobrar** | Validar stock de todos los ítems ANTES de iniciar la escritura en Firebase |
| **Stock vía KardexService** | `VentasService` NUNCA escribe directamente en `/stock`. Siempre llama a `KardexService.registrarMovimiento()` del módulo Inventario |
| **Reverso restaura stock original** | El stock se devuelve al almacén de la venta original, con el costo snapshot del momento de la venta |
| **Cliente opcional** | Una venta puede completarse sin `clienteId` (venta anónima) |
| **Pago = total exacto** | La suma de los métodos de pago debe igualar exactamente el total de la venta |
| **Sesión activa obligatoria** | No se puede procesar una venta sin una sesión abierta para el usuario actual |
| **Snapshots en venta** | Al guardar, copiar `clienteNombre`, `vendedorNombre`, `sku`, `nombre`, `precioUnitario`, `costoUnitario` — para que los informes no se rompan si cambian los datos maestros |
| **Ventana de reverso** | Solo se puede revertir dentro de `config.diasParaReverso` días desde la fecha de venta |
| **COGS es estimado** | El `costoUnitario` en `VentaItem` es el `precioCosto` del producto al momento de la venta, no el costo FIFO/LIFO calculado del Kardex |
| **Descuento máximo** | Si `config.permitirDescuentos = true`, ningún ítem puede tener descuento mayor a `config.descuentoMaximo` % |
| **Número correlativo** | El número de venta (VEN-0001) se genera leyendo el último número y sumando 1, dentro de una `transaction()` para evitar duplicados |

---

## 🔌 Integración con Módulo de Inventario

```
Módulo Ventas importa de Módulo Inventario:
┌────────────────────────────────────────────────────────┐
│  import { KardexService }     from '../inventario/...  │  ← registrar SALIDA/DEVOLUCION
│  import { ProductosService }  from '../inventario/...  │  ← buscar productos, leer precios
│  import { StockService }      from '../inventario/...  │  ← observar stock en tiempo real
│  import { ConfiguracionInventarioService } from '...   │  ← leer moneda, impuesto, config
└────────────────────────────────────────────────────────┘

Flujo de datos:
  POS selecciona producto
      → ProductosService.getProducto(id) para precio y costo
      → StockService.getStockEnAlmacen$(productoId, almacenId) para disponibilidad en tiempo real
  
  POS confirma venta
      → KardexService.registrarMovimiento(productoId, {tipo:'SALIDA', motivo:'VENTA'})
      → KardexService actualiza /stock con transaction()
  
  Resumen revierte venta
      → KardexService.registrarMovimiento(productoId, {tipo:'ENTRADA', motivo:'DEVOLUCION'})
      → KardexService actualiza /stock con transaction()
```

---

## 📋 Orden de Implementación Sugerido

```
Fase 1 — Base
  [ ] ventas.models.ts — Venta, VentaItem, Pago, Sesion
  [ ] configuracion-ventas.service.ts
  [ ] sesiones.service.ts

Fase 2 — POS (core del módulo)
  [ ] pos-state.service.ts con signals (carrito en memoria)
  [ ] ProductoGridComponent con búsqueda + cards + stock en tiempo real
  [ ] CarritoComponent con ítems, cantidades, descuentos
  [ ] MetodosPagoComponent con pago mixto y cálculo de cambio
  [ ] ClienteSelectorComponent con búsqueda y creación rápida
  [ ] SesionDialogComponent
  [ ] ventas.service.ts — procesarVenta() con transacción Firebase
  [ ] VentaExitosaDialogComponent

Fase 3 — Resumen de Ventas
  [ ] ResumenVentasComponent con tabla y filtros
  [ ] DetalleVentaComponent
  [ ] ReversoDialogComponent
  [ ] ventas.service.ts — revertirVenta()

Fase 4 — Informes
  [ ] informes-ventas.service.ts — cálculo de KPIs
  [ ] KpiCardComponent con tendencia vs período anterior
  [ ] VentasChartComponent (ngx-charts)
  [ ] TopProductosTableComponent
  [ ] TopVendedoresTableComponent
  [ ] MargenTablaComponent
  [ ] InformesVentasComponent integrando todo

Fase 5 — Polish
  [ ] Ticket de venta (imprimible)
  [ ] Manejo de errores en procesarVenta() con rollback visual
  [ ] Skeleton loaders en informes
```

---

## 📎 Dependencias con otros Módulos

| Módulo | Qué usa Ventas de él |
|---|---|
| **Inventario** | `KardexService`, `ProductosService`, `StockService`, `ConfiguracionInventarioService` |
| **Clientes** | `ClientesService` (buscar/crear cliente), `CamposCustomFormComponent` (formulario rápido) |
| **Auth** | Usuario autenticado para `vendedorId`, `vendedorNombre`, `sesion` |

---

*Stack confirmado: Angular + Firebase Realtime Database.*
*Integración con módulo de Inventario vía servicios — no acceso directo a nodos Firebase del otro módulo.*
*Ver también: `INVENTARIO_MODULE_PROMPT.md` para contexto de KardexService y estructura de stock.*

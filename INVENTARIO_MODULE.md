# 📦 MÓDULO DE INVENTARIO — Contexto para Claude Code
**Stack confirmado:** Angular · Firebase Realtime Database · Angular Material · Standalone Components

> Este documento es la fuente de verdad para arquitectura, entidades, componentes y estrategias de implementación del módulo de Inventario. Todas las decisiones técnicas ya están resueltas. No hacer preguntas sobre las respuestas cubiertas aquí — implementar directamente.

---

## ✅ Decisiones Técnicas Confirmadas

| Pregunta | Respuesta |
|---|---|
| Backend | **Firebase Realtime Database** |
| Framework UI | **Angular 17+ con Standalone Components** |
| UI Library | **Angular Material** |
| Componente custom fields (formulario) | **`CamposCustomFormComponent`** — selector `app-campos-custom-form` |
| Modelo de campo personalizado | **`CampoPersonalizado`** de `../../models/clientes.models` |
| Multi-moneda | **Sí — configurable en pestaña General de Configuración** |
| Órdenes de Compra | **En scope — submódulo dentro de Inventario** |
| Edición de OC sube stock | **NO — solo la recepción sube stock** |

---

## 🗺️ Árbol de Rutas del Módulo

```
/inventario
├── /productos                    → Lista + botones [Kardex] [Editar] [Eliminar]
│   ├── /new                      → Formulario crear (mismo componente que editar)
│   ├── /:id/editar               → Formulario editar
│   └── /:id/kardex               → Kardex del producto
├── /proveedores                  → Lista proveedores
│   ├── /new
│   └── /:id/editar
├── /ordenes-compra               → Lista de OC
│   ├── /new
│   ├── /:id/ver                  → Vista detalle (modo lectura)
│   └── /:id/recibir              → Formulario de recepción (ÚNICO que sube stock)
├── /costos                       → Análisis de costos
├── /almacenes                    → Gestión de bodegas/sucursales
└── /configuracion                → Custom Fields + Categorías + Unidades + General
```

---

## 🏗️ Estrategia de Arquitectura

### Principios de Diseño
1. **Reutilización del componente `CamposCustomFormComponent`** — Importar sin modificar. Extender el enum de entidad en Firebase para soportar nodos `'producto'` y `'proveedor'` además de `'cliente'`.
2. **Firebase Realtime Database — datos denormalizados y planos** — No usar nodos profundamente anidados. El stock vive en su propio nodo separado del producto para permitir actualizaciones atómicas con `transaction()`.
3. **Kardex append-only** — Cada movimiento de inventario es un nodo nuevo con `push()`. Nunca se edita ni elimina. El stock se mantiene como contador separado actualizado con `transaction()`.
4. **Multi-almacén desde el inicio** — El stock siempre está en `/stock/{productoId}/{almacenId}`, no como campo del producto.
5. **Órdenes de Compra como disparador de stock** — Solo el acto de "Recibir OC" crea entradas en el Kardex. Crear/Editar una OC NUNCA toca el stock.

---

## 🗄️ Estructura de Firebase Realtime Database

```
/inventario/
  /productos/{productoId}
    sku: string
    nombre: string
    descripcion: string
    categoriaId: string
    unidadId: string
    metodoCosteo: 'FIFO' | 'LIFO' | 'PROMEDIO'
    precioCosto: number
    precioVenta: number
    stockMinimo: number
    stockMaximo: number
    activo: boolean
    proveedorIds: { [proveedorId]: true }   ← índice inverso Firebase
    camposPersonalizados: { [idCampo]: any }
    creadoEn: number                        ← timestamp Unix ms
    actualizadoEn: number

  /stock/{productoId}/{almacenId}
    cantidad: number
    cantidadReservada: number               ← comprometida en OC activas
    actualizadoEn: number

  /kardex/{productoId}/{entradaId}          ← generado con push()
    almacenId: string
    tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO'
    motivo: 'COMPRA' | 'VENTA' | 'DEVOLUCION' | 'AJUSTE_INVENTARIO'
          | 'TRASLADO_ENTRADA' | 'TRASLADO_SALIDA' | 'PRODUCCION' | 'OC_RECEPCION'
    cantidad: number
    costoUnitario: number
    costoTotal: number
    saldoCantidad: number                   ← snapshot del saldo en ese momento
    referenciaId: string                    ← ID de OC u otro documento
    referenciaTipo: 'OC' | 'MANUAL' | 'AJUSTE'
    notas: string
    creadoPor: string
    creadoEn: number

  /proveedores/{proveedorId}
    codigo: string
    nombre: string
    nombreContacto: string
    email: string
    telefono: string
    direccion: string
    ruc: string
    diasCredito: number
    moneda: string
    activo: boolean
    camposPersonalizados: { [idCampo]: any }
    creadoEn: number

  /ordenesCompra/{ordenId}
    numero: string                          ← OC-0001, OC-0002...
    proveedorId: string
    estado: 'BORRADOR' | 'ENVIADA' | 'RECIBIDA_PARCIAL' | 'RECIBIDA' | 'ANULADA'
    moneda: string
    tipoCambio: number
    subtotal: number
    impuesto: number
    total: number
    fechaEmision: number
    fechaEntregaEsperada: number
    notas: string
    creadoPor: string
    creadoEn: number
    actualizadoEn: number

  /ordenesCompraItems/{ordenId}/{itemId}
    productoId: string
    descripcion: string                     ← copia del nombre al momento de OC
    cantidad: number
    cantidadRecibida: number                ← se incrementa en recepciones parciales
    costoUnitario: number
    costoTotal: number

  /recepcionesOC/{recepcionId}
    ordenId: string
    almacenId: string
    items: { [itemId]: { cantidadRecibida: number, costoUnitario: number } }
    notas: string
    creadoPor: string
    creadoEn: number

  /almacenes/{almacenId}
    codigo: string
    nombre: string
    tipo: 'ALMACEN' | 'SUCURSAL' | 'BODEGA' | 'VIRTUAL'
    direccion: string
    responsableId: string
    esPorDefecto: boolean
    activo: boolean
    creadoEn: number

  /categorias/{categoriaId}
    nombre: string
    categoriaPadreId: string               ← null si es raíz
    color: string
    icono: string
    orden: number

  /unidades/{unidadId}
    nombre: string
    abreviatura: string
    tipo: 'MASA' | 'VOLUMEN' | 'UNIDAD' | 'LONGITUD'

  /camposPersonalizados/producto/{idCampo}
    idCampo: string
    nombreMostrar: string
    tipo: 'texto' | 'textarea' | 'booleano' | 'lista_simple' | 'lista_multiple' | 'catalogo' | 'fecha'
    opciones: [{ clave: string, valor: string }]
    requerido: boolean
    visibleEnLista: boolean
    orden: number

  /camposPersonalizados/proveedor/{idCampo}
    ...mismo esquema

  /configuracion/inventario
    metodoCosteoDefecto: 'FIFO' | 'LIFO' | 'PROMEDIO'
    permitirStockNegativo: boolean
    prefijoSKU: string
    monedaBase: string                     ← 'USD' | 'COP' | 'MXN' | etc.
    simboloMoneda: string                  ← '$' | 'S/' | etc.
    alertasStockMinimo: boolean
    impuestoPorDefecto: number             ← porcentaje IVA/IGV
```

---

## 🧩 Componente `CamposCustomFormComponent` — Integración Real

### Datos del componente (ya existe en el proyecto)
```
Selector:  app-campos-custom-form
Clase:     CamposCustomFormComponent
Archivo:   src/app/modules/clientes/components/campos-custom-form/campos-custom-form.component.ts
Implementa: ControlValueAccessor + Validator (se usa con formControlName)
```

### Interfaz `CampoPersonalizado` (del codebase)
```typescript
// src/app/modules/clientes/models/clientes.models.ts
export interface CampoPersonalizado {
  idCampo: string;          // clave única snake_case, inmutable
  nombreMostrar: string;    // label visible al usuario
  tipo: 'texto' | 'textarea' | 'booleano' | 'lista_simple'
      | 'lista_multiple' | 'catalogo' | 'fecha';
  opciones?: { clave: string; valor: string }[];  // para listas
  requerido: boolean;
}
```

### Inputs del componente
```typescript
@Input() campos: CampoPersonalizado[] = [];     // definiciones de campos
@Input() modoLectura = false;                   // deshabilita edición
@Input() valores?: Record<string, any>;         // valores en modo lectura
// El valor editable se gestiona con formControlName (ControlValueAccessor)
```

### Tipos de campo soportados
| tipo | Control Material | Comportamiento |
|---|---|---|
| `texto` | `mat-input` | texto libre de una línea |
| `textarea` | `textarea matInput` rows=3 | texto multilínea |
| `booleano` | `mat-slide-toggle` | true/false |
| `lista_simple` | `mat-select` | una opción de `opciones[]` |
| `lista_multiple` | `mat-select multiple` | varias opciones |
| `catalogo` | `mat-select` | igual que lista_simple |
| `fecha` | `mat-datepicker` | selector de fecha |

### Cómo usarlo en formularios del módulo

```typescript
// producto-form.component.ts
import { CamposCustomFormComponent } from
  '../../clientes/components/campos-custom-form/campos-custom-form.component';
// ⚠️ Ajustar la ruta relativa real del proyecto

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, ..., CamposCustomFormComponent],
  template: `
    <form [formGroup]="form">
      <!-- Campos estáticos del producto -->
      <mat-form-field appearance="outline">
        <mat-label>SKU</mat-label>
        <input matInput formControlName="sku" />
      </mat-form-field>
      <!-- ... otros campos estáticos ... -->

      <!-- Sección dinámica: solo se muestra si hay campos configurados -->
      @if (camposCustom().length > 0) {
        <mat-divider />
        <h3 class="section-title">Información adicional</h3>
        <app-campos-custom-form
          formControlName="camposPersonalizados"
          [campos]="camposCustom()"
          [modoLectura]="modoLectura"
          [valores]="valoresIniciales?.camposPersonalizados"
        />
      }
    </form>
  `
})
export class ProductoFormComponent {
  // Cargar desde Firebase /camposPersonalizados/producto
  readonly camposCustom = signal<CampoPersonalizado[]>([]);

  readonly form = this.fb.group({
    sku:                 ['', [Validators.required]],
    nombre:              ['', Validators.required],
    // ... campos estáticos ...
    camposPersonalizados: [{}],  // CamposCustomFormComponent gestiona su validación interna
  });
}
```

### Servicio para cargar campos desde Firebase

```typescript
// campos-inventario.service.ts
getCamposCustom(entidad: 'producto' | 'proveedor'): Observable<CampoPersonalizado[]> {
  return this.db
    .list<CampoPersonalizado>(`camposPersonalizados/${entidad}`,
      ref => ref.orderByChild('orden')
    )
    .valueChanges()
    .pipe(map(campos => campos.filter(c => c && c.idCampo)));
}
```

---

## 🧩 Submódulos — Especificación Detallada

---

### 1️⃣ PRODUCTOS (`/inventario/productos`)

#### Lista — `ProductosListComponent`

**Columnas base (siempre visibles):**
`SKU | Nombre | Categoría | Stock Total | P. Costo | P. Venta | Estado | Acciones`

**Columnas dinámicas:** Los `CampoPersonalizado` con `visibleEnLista: true` cargados de Firebase se agregan automáticamente antes de la columna Acciones usando `displayedColumns` de MatTable.

**Botones de acción por fila:**
```
[📋 Kardex]   [✏️ Editar]   [🗑 Eliminar]
```
- **Kardex** → navega a `/inventario/productos/:id/kardex`
- **Editar** → navega a `/inventario/productos/:id/editar`
- **Eliminar** → `MatDialog` de confirmación; si tiene entradas en `/kardex/{id}` → soft-delete (`activo: false`); si no tiene movimientos → eliminar nodo

**Features de la tabla:**
- Filtros: categoría, activo/inactivo, almacén, "solo con stock bajo mínimo"
- Búsqueda con `debounceTime(300)` sobre SKU y nombre
- Chip de alerta de stock: rojo si `stockActual < stockMinimo`, verde si normal
- Botón "Exportar CSV" que descarga los datos visibles

#### Formulario — `ProductoFormComponent` (Crear y Editar)
> **Un solo componente con `@Input() modo: 'crear' | 'editar'`**

```
SECCIÓN: INFORMACIÓN GENERAL
  SKU*              Nombre*
  Descripción (textarea)
  Categoría*        Unidad de Medida*        Activo (toggle)

SECCIÓN: PRECIOS Y COSTOS
  Precio de Costo*      Precio de Venta*
  Método de Costeo: [FIFO ▼]  (pre-rellena desde /configuracion/inventario/metodoCosteoDefecto)

SECCIÓN: CONTROL DE STOCK
  Stock Mínimo*         Stock Máximo
  ── Solo visible en modo CREAR ─────────────────────────────
  Stock inicial por almacén (tabla editable — MatTable inline)
  | Almacén        | Cantidad inicial |
  | Bodega Central |       [0]        |
  Nota: Al guardar, si cantidad > 0, genera KardexEntry
  tipo='ENTRADA', motivo='AJUSTE_INVENTARIO' por almacén.
  ────────────────────────────────────────────────────────────

SECCIÓN: PROVEEDORES
  mat-select múltiple — lista de proveedores activos

SECCIÓN: CAMPOS PERSONALIZADOS (solo si camposCustom.length > 0)
  <app-campos-custom-form formControlName="camposPersonalizados" />
```

**Regla crítica del formulario de edición:** El modo `editar` NO muestra la tabla de stock inicial y NO escribe en `/stock` ni `/kardex`. Editar un producto solo actualiza el nodo `/productos/{id}`.

---

### 2️⃣ KARDEX (`/inventario/productos/:id/kardex`)

#### Layout
```
┌────────────────────────────────────────────────────────────┐
│  ← Volver   [NOMBRE PRODUCTO]   SKU: ABC-001               │
├────────────────────────────────────────────────────────────┤
│  KPI Cards:                                                │
│  [Stock Total: 245 un]  [Valor: $2,450]  [Última entrada] │
├────────────────────────────────────────────────────────────┤
│  [Almacén ▼]  [Tipo ▼]  [Desde ─ Hasta]                   │
│                                   [+ Registrar Movimiento] │
├────────────────────────────────────────────────────────────┤
│  Fecha  │ Tipo    │ Motivo   │ Cant │ C.Unit │ Total│ Saldo│
│  15 ene │ ENTRADA │ COMPRA   │  50  │ $10.00 │ $500 │  295 │
│  14 ene │ SALIDA  │ VENTA    │  10  │ $10.00 │ $100 │  245 │
└────────────────────────────────────────────────────────────┘
```

#### Dialog "Registrar Movimiento Manual" (`MatDialog`)
```
Tipo*:               [ENTRADA / SALIDA / AJUSTE / TRASLADO]
Motivo*:             [select dinámico según Tipo]
Almacén*:            [selector de almacenes activos]
Almacén Destino*:    [solo si tipo = TRASLADO]
Cantidad*:           [número > 0]
Costo Unitario*:     [pre-rellena con último costoUnitario del Kardex]
Referencia:          [texto libre]
Notas:               [textarea]
```

**Motivos disponibles por tipo:**
```typescript
const motivosPorTipo: Record<string, string[]> = {
  ENTRADA:  ['COMPRA', 'DEVOLUCION', 'AJUSTE_INVENTARIO', 'PRODUCCION'],
  SALIDA:   ['VENTA', 'DEVOLUCION', 'AJUSTE_INVENTARIO'],
  AJUSTE:   ['AJUSTE_INVENTARIO'],
  TRASLADO: ['TRASLADO_ENTRADA']   // internamente crea TRASLADO_SALIDA + TRASLADO_ENTRADA
};
```

**Reglas de negocio:**
- SALIDA: validar `cantidad ≤ stockDisponibleEnAlmacen` antes de escribir en Firebase
- TRASLADO: dos writes atómicos — stock origen `-cantidad`, stock destino `+cantidad`; los dos KardexEntry comparten el mismo `referenciaId`
- AJUSTE negativo: solo si `config.permitirStockNegativo = true`
- Siempre usar `transaction()` para actualizar `/stock`

---

### 3️⃣ PROVEEDORES (`/inventario/proveedores`)

**Tabla:** Código | Nombre | Contacto | Email | Teléfono | Días Crédito | Estado | Acciones

**Acciones:** `[✏️ Editar]  [🗑 Eliminar]`

**Formulario** (un componente, modos crear/editar):
```
Código*          Nombre*
Nombre Contacto  Email
Teléfono         Dirección
RUC/NIT/RIF*     Días de Crédito
Moneda           Activo (toggle)
──────────────────────────────────────────────
CAMPOS PERSONALIZADOS
<app-campos-custom-form [campos]="camposProveedor()" />
```

**Vista de detalle** (navegando al nombre del proveedor):
- KPIs: Total comprado (suma de OC recibidas), última OC, OC activas
- Lista de OC asociadas a este proveedor
- Productos donde este proveedor está vinculado

---

### 4️⃣ ÓRDENES DE COMPRA (`/inventario/ordenes-compra`)

> **Regla fundamental inmutable:** Crear o editar una OC NUNCA escribe en `/stock` ni en `/kardex`. Solo el formulario de Recepción escribe stock.

#### Estados y transiciones válidas
```
BORRADOR ──[Enviar]──→ ENVIADA ──[Recibir parcial]──→ RECIBIDA_PARCIAL
                              └──[Recibir total]──→ RECIBIDA
Cualquier estado activo ──[Anular]──→ ANULADA
```

| Estado | Puede editar ítems | Puede recibir | Puede anular |
|---|---|---|---|
| BORRADOR | ✅ | ❌ | ✅ |
| ENVIADA | ❌ | ✅ | ✅ |
| RECIBIDA_PARCIAL | ❌ | ✅ (lo pendiente) | ✅ (genera contra-asiento) |
| RECIBIDA | ❌ | ❌ | ❌ |
| ANULADA | ❌ | ❌ | ❌ |

#### Lista de OC
**Columnas:** N° OC | Proveedor | Fecha Emisión | Fecha Entrega | Total | Estado | Acciones

**Acciones según estado:**
```
BORRADOR:          [✏️ Editar]  [📤 Enviar]  [🗑 Anular]
ENVIADA:           [👁 Ver]     [📦 Recibir] [🗑 Anular]
RECIBIDA_PARCIAL:  [👁 Ver]     [📦 Recibir más]
RECIBIDA:          [👁 Ver]
ANULADA:           [👁 Ver]
```

#### Formulario Crear/Editar OC
```
ENCABEZADO
  Proveedor*            Fecha Emisión*
  Fecha Entrega Esperada   Moneda* (default desde /configuracion/inventario)
  Notas

ÍTEMS DE LA ORDEN                          [+ Agregar Producto]
  ┌──────────────────────────────────────────────────────────┐
  │ Producto*    │ Cant* │ C. Unitario* │ Total   │  [🗑]   │
  │ [autocomplete│  [10] │   [$15.00]   │ $150.00 │         │
  │ SKU/nombre]  │       │              │         │         │
  └──────────────────────────────────────────────────────────┘
  Al seleccionar producto → pre-rellena costo con precioCosto del producto

TOTALES (calculados automáticamente)
  Subtotal:          $XXX.XX
  Impuesto (% campo editable, default de config): $XXX.XX
  Total:             $XXX.XX
```

#### Formulario de Recepción — `OrdenCompraRecepcionComponent`
> **Este es el único punto de escritura en `/stock` y `/kardex`.**

```
RECEPCIÓN — OC #OC-0042
Proveedor: Proveedor XYZ     Emitida: 15/01/2025

Almacén Destino*:   [selector de almacenes activos]
Fecha Recepción*:   [datepicker — default: hoy]
Notas:              [textarea]

ÍTEMS A RECIBIR
┌──────────────────────────────────────────────────────────┐
│ Producto    │ Cant. OC │ Ya recibido │ Pendiente │ Ahora  │
│ Producto A  │   100    │      0      │    100    │  [80]  │
│ Producto B  │    50    │     50      │      0    │  [--]  │
└──────────────────────────────────────────────────────────┘
  Solo editable "Ahora" en ítems con pendiente > 0
  Validar: 0 ≤ cantidadAhora ≤ pendiente

[Cancelar]                        [✅ Confirmar Recepción]
```

**Secuencia que ejecuta "Confirmar Recepción" (para cada ítem con cantidadAhora > 0):**

```typescript
// 1. Registrar en Kardex (append-only, push)
const kardexRef = db.ref(`kardex/${productoId}`).push();
await kardexRef.set({
  id: kardexRef.key,
  almacenId,
  tipo: 'ENTRADA',
  motivo: 'OC_RECEPCION',
  cantidad: cantidadAhora,
  costoUnitario,
  costoTotal: cantidadAhora * costoUnitario,
  saldoCantidad: stockActualAntes + cantidadAhora,
  referenciaId: ordenId,
  referenciaTipo: 'OC',
  notas,
  creadoPor: userId,
  creadoEn: Date.now()
});

// 2. Actualizar stock con transaction (evita race conditions)
await db.ref(`stock/${productoId}/${almacenId}/cantidad`)
  .transaction(current => (current ?? 0) + cantidadAhora);

// 3. Actualizar cantidadRecibida del ítem
await db.ref(`ordenesCompraItems/${ordenId}/${itemId}/cantidadRecibida`)
  .transaction(current => (current ?? 0) + cantidadAhora);

// 4. Guardar registro en /recepcionesOC

// 5. Recalcular y actualizar estado de la OC:
//    - Todos cantidadRecibida >= cantidad → estado = 'RECIBIDA'
//    - Alguno recibido parcialmente      → estado = 'RECIBIDA_PARCIAL'
```

**Anulación con recepciones previas:**
Si una OC en `RECIBIDA_PARCIAL` se anula, crear contra-asientos en Kardex (`tipo: 'SALIDA'`, `motivo: 'DEVOLUCION'`) por las cantidades ya recibidas, y revertir el stock.

---

### 5️⃣ ANÁLISIS DE COSTOS (`/inventario/costos`)

```
FILTROS
  [Producto ▼]  [Categoría ▼]  [Desde ── Hasta]
  Método:  ○ FIFO   ○ LIFO   ○ Promedio Ponderado

KPI CARDS
  [Valor Total Inventario: $XX,XXX]
  [Costo de Ventas (COGS): $XX,XXX]
  [Margen Bruto: XX%]

GRÁFICO (ngx-charts LineChart)
  Evolución del costo unitario promedio en el tiempo
  Eje X: fechas    Eje Y: costo unitario

TABLA DE ANÁLISIS POR PRODUCTO
  Producto | Saldo Ini | Entradas | Salidas | Saldo Fin | C. Prom. | Valor Total
```

**Moneda:** Todos los valores se muestran con `simboloMoneda` leído de `/configuracion/inventario`.

**Comparativa de métodos:** El radio button de método recalcula en memoria los valores desde los datos del Kardex — no persiste. Permite comparar FIFO vs LIFO vs Promedio sin modificar nada.

**Cálculo de costo promedio ponderado:**
```typescript
// Al registrar una ENTRADA con método PROMEDIO:
const costoPromNuevo =
  (stockAnterior * costoPromAnterior + cantidadEntrada * costoEntrada)
  / (stockAnterior + cantidadEntrada);
```

---

### 6️⃣ ALMACENES / SUCURSALES (`/inventario/almacenes`)

**Grid de MatCard:**
```
┌───────────────────────────┐  ┌───────────────────────────┐
│ 🏭 BODEGA PRINCIPAL       │  │ 🏪 SUCURSAL NORTE         │
│ [Chip: DEFAULT]           │  │                           │
│ SKUs activos: 245         │  │ SKUs activos: 120         │
│ Valor total: $45,200      │  │ Valor total: $18,400      │
│ [📦 Ver Stock]  [✏️ Edit] │  │ [📦 Ver Stock]  [✏️ Edit] │
└───────────────────────────┘  └───────────────────────────┘
                                          [+ Nuevo Almacén]
```

**"Ver Stock"** → tabla: Producto | SKU | Cant. | Reservado | Disponible | Stock Mín | Estado

**Formulario Almacén:**
`Nombre* | Código* | Tipo (select) | Dirección | Responsable | ¿Almacén por defecto? (toggle)`

Al marcar como default → desmarcar el anterior en la misma operación Firebase (`multi-path update`).

---

### 7️⃣ CONFIGURACIÓN (`/inventario/configuracion`)

**Tabs de Angular Material:**
```
[🏷️ Campos Personalizados]  [📁 Categorías]  [📐 Unidades]  [⚙️ General]
```

#### Tab: Campos Personalizados
Tiene dos sub-tabs internos: **Productos** y **Proveedores**

> ⚠️ **CRÍTICO:** Buscar en `src/app/modules/clientes/` el componente que gestiona el CRUD de definiciones de `CampoPersonalizado` (tipo "manager" o "configuracion"). Reutilizarlo pasando el nodo Firebase correcto (`camposPersonalizados/producto` o `camposPersonalizados/proveedor`). Si no existe un componente manager separado, crearlo aquí en `src/app/modules/inventario/components/campos-config/` y luego refactorizar para que Clientes también lo use.

**Comportamiento esperado del manager:**
```
Lista de campos:
┌──────────────────────────────────────────────────────┐
│  Campo          │ Tipo         │ Req │ En lista │ Acc │
│  Marca          │ texto        │ No  │ Sí       │ ✏️ 🗑│
│  Código Interno │ texto        │ Sí  │ No       │ ✏️ 🗑│
│                                    [+ Nuevo Campo]   │
└──────────────────────────────────────────────────────┘
```

**Dialog crear/editar campo:**
```
Nombre a mostrar*: [texto]
Tipo*:             [texto/textarea/booleano/lista_simple/lista_multiple/fecha]
Requerido:         [toggle]
Visible en lista:  [toggle]
Opciones (solo si tipo = lista_simple, lista_multiple o catalogo):
  [+ Agregar opción]   Clave: [  ]   Valor: [  ]
```

**Restricciones:**
- `idCampo` = slug generado del nombre al crear, **inmutable**
- `tipo` no puede cambiarse una vez creado
- Eliminar solo si ningún producto/proveedor tiene valor; si tiene datos → desactivar (`activo: false`)

#### Tab: Categorías
- `mat-tree` o lista indentada con expansion panels
- Crear categorías raíz + subcategorías (`categoriaPadreId`)
- CRUD inline

#### Tab: Unidades de Medida
- `MatTable` simple
- Campos: Nombre* | Abreviatura* | Tipo (MASA/VOLUMEN/UNIDAD/LONGITUD)
- CRUD

#### Tab: General
```
MONEDA Y PRECIOS
  Moneda base:           [USD ▼]    Símbolo: [$]
  Impuesto por defecto:  [12   ]%

INVENTARIO
  Método de costeo por defecto:  [PROMEDIO ▼]
  Permitir stock negativo:       [toggle OFF]
  Prefijo automático de SKU:     [PROD-]

NOTIFICACIONES
  Alertas de stock mínimo:       [toggle ON]

[Guardar Configuración]
```
Guardar escribe en `/configuracion/inventario` con `set()`.

---

## 📁 Estructura de Archivos Angular

```
src/app/modules/inventario/
├── inventario.routes.ts
│
├── models/
│   └── inventario.models.ts           ← Todas las interfaces del módulo
│
├── services/
│   ├── productos.service.ts           ← CRUD /productos + lógica stock inicial
│   ├── kardex.service.ts              ← append-only /kardex + transaction stock
│   ├── proveedores.service.ts
│   ├── ordenes-compra.service.ts      ← CRUD OC + lógica de recepción
│   ├── almacenes.service.ts
│   ├── costos.service.ts              ← Cálculo FIFO/LIFO/AVG (sin escritura)
│   ├── configuracion-inventario.service.ts
│   └── campos-inventario.service.ts   ← CRUD /camposPersonalizados/producto|proveedor
│
├── pages/
│   ├── productos-list/
│   ├── producto-form/                 ← @Input() modo: 'crear' | 'editar'
│   ├── kardex/
│   ├── proveedores-list/
│   ├── proveedor-form/
│   ├── ordenes-compra-list/
│   ├── orden-compra-form/             ← CRUD sin tocar stock
│   ├── orden-compra-recepcion/        ← ⚠️ ÚNICO punto que sube stock
│   ├── costos/
│   ├── almacenes/
│   └── configuracion/
│       └── configuracion.component.ts ← MatTabGroup con 4 tabs
│
└── components/
    ├── stock-chip/                    ← Chip visual rojo/amarillo/verde
    ├── kardex-movement-dialog/        ← MatDialog movimiento manual
    └── campos-config/
        ├── campos-config.component.ts ← Manager de CampoPersonalizado
        └── campo-form-dialog.component.ts
```

---

## 🛡️ Reglas de Negocio — Tabla Completa

| Regla | Descripción |
|---|---|
| **Stock solo por Kardex** | `/stock` es un contador. Nunca se edita directo; se actualiza vía `transaction()` disparado por KardexService |
| **Kardex append-only** | Nodos en `/kardex` NUNCA se editan ni borran. Errores → contra-asiento |
| **OC no toca stock** | `OrdenCompraService.crear()` y `.editar()` no escriben en `/stock` ni `/kardex` |
| **Solo recepción sube stock** | `OrdenCompraService.recibirItems()` es el único método que llama a `KardexService.registrar()` con motivo `OC_RECEPCION` |
| **Stock en creación de producto** | Si cantidad inicial > 0 en algún almacén → `KardexService.registrar()` con `motivo: 'AJUSTE_INVENTARIO'` por cada almacén |
| **Edición de producto no toca stock** | `ProductosService.editar()` solo actualiza `/productos/{id}`, jamás `/stock` ni `/kardex` |
| **SKU único** | `AsyncValidator` que consulta Firebase por `sku` antes de guardar |
| **Soft delete con movimientos** | Productos y proveedores con entradas en Kardex → `activo: false`. Sin movimientos → eliminar nodo |
| **`idCampo` inmutable** | Se genera como slug al crear y nunca cambia aunque se edite `nombreMostrar` |
| **`tipo` de campo inmutable** | No cambiar el `tipo` de un `CampoPersonalizado` existente |
| **Traslado = 2 entradas Kardex** | TRASLADO_SALIDA en origen + TRASLADO_ENTRADA en destino, mismo `referenciaId` |
| **Stock mínimo por almacén** | La alerta compara `stock[productoId][almacenId].cantidad < producto.stockMinimo` |
| **Moneda en OC** | Cada OC guarda `moneda` y `tipoCambio` del momento de emisión |
| **Costos en moneda base** | Los costos del Kardex siempre en `monedaBase` de configuración |
| **Anulación OC con recepciones** | Genera contra-asientos Kardex (`SALIDA/DEVOLUCION`) por cantidades ya recibidas |
| **Almacén default único** | `multi-path update` garantiza que solo un almacén tenga `esPorDefecto: true` |

---

## 🔌 Patrones Firebase Clave

```typescript
// ✅ Actualizar stock (SIEMPRE con transaction — nunca con set/update directo)
async actualizarStock(productoId: string, almacenId: string, delta: number): Promise<boolean> {
  let exito = false;
  await this.db.ref(`stock/${productoId}/${almacenId}/cantidad`)
    .transaction((stockActual: number | null) => {
      const nuevo = (stockActual ?? 0) + delta;
      if (nuevo < 0 && !this.config.permitirStockNegativo) {
        return; // undefined aborta la transacción
      }
      exito = true;
      return nuevo;
    });
  return exito;
}

// ✅ Registrar movimiento Kardex (append-only con push)
async registrarMovimiento(productoId: string, entry: Omit<KardexEntry, 'id'>): Promise<string> {
  const ref = this.db.ref(`kardex/${productoId}`).push();
  await ref.set({ ...entry, id: ref.key });
  return ref.key!;
}

// ✅ Validar SKU único (AsyncValidator)
skuUnicoValidator(idActual?: string): AsyncValidatorFn {
  return (control: AbstractControl) =>
    this.db.ref('inventario/productos')
      .orderByChild('sku').equalTo(control.value).once('value')
      .then(snap => {
        if (!snap.exists()) return null;
        const ids = Object.keys(snap.val());
        const ocupado = idActual ? ids.some(id => id !== idActual) : true;
        return ocupado ? { skuDuplicado: true } : null;
      });
}

// ✅ Multi-path update para cambio de almacén default
async marcarAlmacenDefault(nuevoId: string, anteriorId: string): Promise<void> {
  await this.db.ref().update({
    [`almacenes/${anteriorId}/esPorDefecto`]: false,
    [`almacenes/${nuevoId}/esPorDefecto`]: true,
  });
}
```

---

## 📋 Orden de Implementación Sugerido

```
Fase 1 — Base
  [ ] inventario.models.ts con todas las interfaces
  [ ] inventario.routes.ts con rutas lazy
  [ ] configuracion-inventario.service.ts
  [ ] campos-inventario.service.ts (CRUD campos custom)
  [ ] almacenes.service.ts

Fase 2 — Configuración UI
  [ ] ConfiguracionComponent con MatTabGroup
  [ ] Tab General (moneda, método costeo, etc.)
  [ ] Tab Campos Personalizados (reutilizar o crear CamposConfigComponent)
  [ ] Tab Categorías (mat-tree)
  [ ] Tab Unidades

Fase 3 — Productos
  [ ] productos.service.ts
  [ ] ProductosListComponent (MatTable con columnas dinámicas)
  [ ] ProductoFormComponent modo crear (con stock inicial + CamposCustomFormComponent)
  [ ] ProductoFormComponent modo editar (sin stock)
  [ ] StockChipComponent

Fase 4 — Kardex
  [ ] kardex.service.ts con transaction de stock
  [ ] KardexComponent (tabla de movimientos)
  [ ] KardexMovementDialogComponent

Fase 5 — Proveedores
  [ ] proveedores.service.ts
  [ ] ProveedoresListComponent
  [ ] ProveedorFormComponent con CamposCustomFormComponent

Fase 6 — Órdenes de Compra
  [ ] ordenes-compra.service.ts
  [ ] OrdenesCompraListComponent
  [ ] OrdenCompraFormComponent (CRUD — NO toca stock)
  [ ] OrdenCompraRecepcionComponent (⚠️ escribe stock — implementar con cuidado)
  [ ] Lógica de anulación con contra-asientos

Fase 7 — Costos y Almacenes
  [ ] costos.service.ts (FIFO/LIFO/Promedio desde Kardex)
  [ ] CostosComponent con gráfico de evolución
  [ ] AlmacenesComponent (grid de cards + vista de stock)

Fase 8 — Polish
  [ ] Alertas de stock mínimo (badge o notificación)
  [ ] Exportar CSV en listas de productos
  [ ] Manejo de errores Firebase con MatSnackBar
  [ ] Empty states con ilustración + CTA
  [ ] Skeleton loaders en tablas
```

---

*Versión 2 — Stack confirmado: Angular + Firebase Realtime Database.*
*Componente `CamposCustomFormComponent` verificado del código fuente real.*
*Incluye: Órdenes de Compra, multi-moneda, regla stock-solo-en-recepción.*

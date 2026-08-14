import { CampoPersonalizado } from '../../../shared/models/clientes.models';

export type MetodoCosteo = 'FIFO' | 'LIFO' | 'PROMEDIO';
export type MetodoPrecioVenta = 'MARGEN_UTILIDAD' | 'MARKUP';

/** Estados activos de una orden de compra. */
export type EstadoOrdenCompra =
  | 'BORRADOR'
  | 'RECIBIDA'
  | 'ANULADA';

/**
 * Estados de las OC creadas antes de la simplificacion del flujo. Solo se leen desde RTDB
 * y se normalizan con `OrdenesCompraService.normalizarEstado()`; nunca se escriben.
 */
export type EstadoOrdenCompraLegacy = EstadoOrdenCompra | 'ENVIADA' | 'RECIBIDA_PARCIAL';

export type TipoMovimientoKardex = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO';

export type MotivoMovimientoKardex =
  | 'COMPRA'
  | 'VENTA'
  | 'DEVOLUCION'
  | 'RECETA_VENTA'
  | 'RECETA_DEVOLUCION'
  | 'AJUSTE_INVENTARIO'
  | 'TRASLADO_ENTRADA'
  | 'TRASLADO_SALIDA'
  | 'PRODUCCION'
  | 'OC_RECEPCION';

export type ReferenciaMovimientoTipo = 'OC' | 'MANUAL' | 'AJUSTE';

export type TipoAlmacen = 'ALMACEN' | 'SUCURSAL' | 'BODEGA' | 'VIRTUAL';

export type TipoUnidad = 'MASA' | 'VOLUMEN' | 'UNIDAD' | 'LONGITUD';

export type TipoProductoInventario = 'SIMPLE' | 'RECETA';

/**
 * Rol comercial del producto. Es un eje independiente de `tipo`: una subreceta
 * (masa base, salsa madre) es RECETA e INSUMO al mismo tiempo.
 * - VENTA: aparece en el POS. Tambien puede usarse como ingrediente.
 * - INSUMO: materia prima. Nunca aparece en el POS ni en el catalogo web.
 */
export type UsoProducto = 'VENTA' | 'INSUMO';

/** Como se captura la cantidad en la caja. */
export type ModoVentaProducto = 'UNIDAD' | 'GRANEL';

/** Eje de variacion de un producto: 'Talla' con valores ['S', 'M', 'L']. */
export interface AtributoVariante {
  /** Slug estable derivado del nombre: 'talla'. */
  id: string;
  nombre: string;
  valores: string[];
}

export interface ImagenProducto {
  url: string;
  archivoId?: string;
  storagePath?: string;
}

export interface RecetaItem {
  productoId: string;
  cantidad: number;
  unidadId: string;
  notas?: string;
}

export interface RecetaAuditoria {
  id?: string;
  recetaId: string;
  accion: 'CREADA' | 'EDITADA' | 'INGREDIENTES_CAMBIADOS' | 'DESHABILITADA';
  cambiosAntes?: Record<string, any>;
  cambiosDespues?: Record<string, any>;
  creadoPor: string;
  creadoEn: number;
}

export interface Producto {
  id?: string;
  sku: string;
  codigoBarras?: string; // EAN/UPC para escaneo en el POS
  nombre: string;
  descripcion?: string;
  categoriaId: string;
  unidadId: string;
  metodoCosteo: MetodoCosteo;
  precioCosto: number;
  precioVenta: number;
  ivaPorcentaje: number;
  stockMinimo: number;
  stockMaximo?: number;
  activo: boolean;
  tipo?: TipoProductoInventario;
  recetaItems?: RecetaItem[];
  recetaNotas?: string;
  permitirInventarioNegativo?: boolean;
  /** Rol comercial. Ausente equivale a 'VENTA' por compatibilidad. */
  usoProducto?: UsoProducto;
  /** Captura de cantidad en el POS. Ausente equivale a 'UNIDAD'. */
  modoVenta?: ModoVentaProducto;
  /** Incremento que aplican los botones +/- del carrito. */
  pasoCantidad?: number;
  /** `null` limpia la imagen en un `update()` de RTDB; `undefined` haria fallar la escritura. */
  imagen?: ImagenProducto | null;
  /** Solo en el producto padre: ejes de variacion que generan los hijos. */
  atributosVariante?: AtributoVariante[];
  /** Solo en el producto hijo: id del padre que lo genero. */
  productoPadreId?: string;
  /** Solo en el producto hijo: { talla: 'M', color: 'Rojo' }. */
  valoresVariante?: Record<string, string>;
  proveedorIds?: Record<string, true>;
  camposPersonalizados?: Record<string, any>;
  creadoEn?: number;
  actualizadoEn?: number;
  creadoPor?: string | null;
  actualizadoPor?: string | null;
  ultimaAccion?: string | null;
}

export interface StockPorAlmacen {
  cantidad: number;
  cantidadReservada: number;
  actualizadoEn?: number;
}

export interface KardexEntry {
  id: string;
  almacenId: string;
  tipo: TipoMovimientoKardex;
  motivo: MotivoMovimientoKardex;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  saldoCantidad: number;
  referenciaId: string;
  referenciaTipo: ReferenciaMovimientoTipo;
  notas?: string;
  creadoPor: string;
  creadoEn: number;
}

export interface Proveedor {
  id?: string;
  codigo: string;
  nombre: string;
  nombreContacto?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ruc: string;
  diasCredito: number;
  moneda: string;
  activo: boolean;
  camposPersonalizados?: Record<string, any>;
  creadoEn?: number;
  actualizadoEn?: number;
  creadoPor?: string | null;
  actualizadoPor?: string | null;
  ultimaAccion?: string | null;
}

export interface OrdenCompra {
  id?: string;
  numero: string;
  proveedorId: string;
  estado: EstadoOrdenCompraLegacy;
  moneda: string;
  tipoCambio: number;
  subtotal: number;
  impuesto: number;
  total: number;
  fechaEmision: number;
  fechaEntregaEsperada?: number;
  notas?: string;
  creadoPor: string;
  creadoEn: number;
  actualizadoEn: number;
}

export interface OrdenCompraItem {
  id?: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  cantidadRecibida: number;
  costoUnitario: number;
  impuestoPorcentaje?: number;
  costoTotal: number;
}

export interface RecepcionOrdenCompraItem {
  cantidadRecibida: number;
  costoUnitario: number;
}

export interface RecepcionOC {
  id?: string;
  ordenId: string;
  almacenId: string;
  items: Record<string, RecepcionOrdenCompraItem>;
  /** Borrador creado en Contabilidad > Compras a partir de esta recepcion. */
  facturaCompraId?: string | null;
  /** Comprobante del proveedor adjuntado en la orden de compra. */
  xmlArchivoId?: string | null;
  pdfArchivoId?: string | null;
  notas?: string;
  creadoPor: string;
  creadoEn: number;

  /** @deprecated Recepciones del flujo antiguo. Se leen, ya no se escriben. */
  contabilizarRecepcion?: boolean;
  /** @deprecated */
  documentoProveedorNumero?: string;
  /** @deprecated */
  documentoProveedorFecha?: number | null;
  /** @deprecated */
  documentoProveedorSubtotal?: number;
  /** @deprecated */
  documentoProveedorIva?: number;
  /** @deprecated */
  documentoProveedorTotal?: number;
  /** @deprecated */
  documentoProveedorAutorizacion?: string;
}

export interface Almacen {
  id?: string;
  codigo: string;
  nombre: string;
  tipo: TipoAlmacen;
  direccion?: string;
  responsableId?: string;
  esPorDefecto: boolean;
  activo: boolean;
  creadoEn?: number;
  actualizadoEn?: number;
  creadoPor?: string | null;
  actualizadoPor?: string | null;
  ultimaAccion?: string | null;
}

export interface Categoria {
  id?: string;
  nombre: string;
  categoriaPadreId?: string | null;
  color?: string;
  icono?: string;
  orden?: number;
  activo?: boolean;
}

export interface Unidad {
  id?: string;
  nombre: string;
  abreviatura: string;
  tipo: TipoUnidad;
  activo?: boolean;
}

export interface ConfiguracionInventario {
  metodoCosteoDefecto: MetodoCosteo;
  permitirStockNegativo: boolean;
  prefijoSKU: string;
  monedaBase: string;
  simboloMoneda: string;
  alertasStockMinimo: boolean;
  impuestoPorDefecto: number;
  metodoPrecioVentaDefecto: MetodoPrecioVenta;
  porcentajePrecioVentaDefecto: number;
  /** Exige imagen para guardar un producto con usoProducto = 'VENTA'. */
  requerirImagenProductoVenta: boolean;
  /** Incremento por defecto de los productos vendidos por peso o medida. */
  pasoCantidadGranelDefecto: number;
}

export type EntidadCamposInventario = 'producto' | 'proveedor';

export interface ConfiguracionCamposInventario {
  entidad: EntidadCamposInventario;
  camposPersonalizados: CampoPersonalizado[];
}

export interface AlmacenStockRow {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  reservado: number;
  disponible: number;
  stockMinimo: number;
  bajoMinimo: boolean;
  valorTotal: number;
}

export interface CostoAnalisisRow {
  productoId: string;
  producto: string;
  saldoInicial: number;
  entradas: number;
  salidas: number;
  saldoFinal: number;
  costoPromedio: number;
  valorTotal: number;
  cogs: number;
}

export interface CostoAnalisisResultado {
  rows: CostoAnalisisRow[];
  valorTotalInventario: number;
  cogsTotal: number;
  margenBrutoEstimado: number;
}

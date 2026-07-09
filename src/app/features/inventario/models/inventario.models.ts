import { CampoPersonalizado } from '../../../shared/models/clientes.models';

export type MetodoCosteo = 'FIFO' | 'LIFO' | 'PROMEDIO';
export type MetodoPrecioVenta = 'MARGEN_UTILIDAD' | 'MARKUP';

export type EstadoOrdenCompra =
  | 'BORRADOR'
  | 'ENVIADA'
  | 'RECIBIDA_PARCIAL'
  | 'RECIBIDA'
  | 'ANULADA';

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
  estado: EstadoOrdenCompra;
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
  contabilizarRecepcion?: boolean;
  documentoProveedorNumero?: string;
  documentoProveedorFecha?: number | null;
  documentoProveedorSubtotal?: number;
  documentoProveedorIva?: number;
  documentoProveedorTotal?: number;
  documentoProveedorAutorizacion?: string;
  notas?: string;
  creadoPor: string;
  creadoEn: number;
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

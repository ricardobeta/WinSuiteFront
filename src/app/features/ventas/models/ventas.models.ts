export type EstadoVenta = 'COMPLETADA' | 'ANULADA' | 'REVERTIDA';

export type MetodoPagoVenta =
  | 'EFECTIVO'
  | 'TARJETA_CREDITO'
  | 'TARJETA_DEBITO'
  | 'TRANSFERENCIA'
  | 'QR'
  | 'CREDITO_CLIENTE';

export type VentaItemTipo = 'PRODUCTO' | 'SERVICIO' | 'RECETA';

export interface VentaDocumento {
  id?: string;
  numero: string;
  sesionId: string;
  clienteId: string | null;
  clienteNombre: string;
  vendedorId: string;
  vendedorNombre: string;
  almacenId: string;
  estado: EstadoVenta;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  moneda: string;
  notas: string;
  creadoEn: number;
  revertidaEn: number | null;
  revertidaPor: string | null;
  motivoReverso: string | null;
  ventaOriginalId: string | null;
}

export interface VentaItem {
  id?: string;
  itemTipo: VentaItemTipo;
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  descuentoItem: number;
  ivaPorcentajeItem: number;
  subtotalItem: number;
  impuestoItem: number;
}

export interface VentaPago {
  id?: string;
  metodo: MetodoPagoVenta;
  monto: number;
  referencia: string;
  creadoEn: number;
}

export interface SesionCaja {
  id?: string;
  vendedorId: string;
  vendedorNombre: string;
  almacenId: string;
  estado: 'ABIERTA' | 'CERRADA';
  fondoInicial: number;
  fondoCierre: number | null;
  totalVentas: number;
  cantidadVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalOtros: number;
  abiertaEn: number;
  cerradaEn: number | null;
}

export interface ConfiguracionVentas {
  permitirVentaSinStock: boolean;
  permitirDescuentos: boolean;
  descuentoMaximo: number;
  diasParaReverso: number;
  impuestoPorDefecto: number;
  prefijoPOS: string;
  mostrarCosto: boolean;
  monedaBase: string;
}

export interface CarritoItem {
  itemTipo: VentaItemTipo;
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  descuentoItem: number;
  ivaPorcentaje: number;
  stockDisponible: number;
  permitirInventarioNegativo?: boolean;
}

export interface MetodoPagoState {
  metodo: MetodoPagoVenta;
  monto: number;
  referencia: string;
}

export interface CarritoState {
  items: CarritoItem[];
  clienteId: string | null;
  clienteNombre: string | null;
  descuentoGlobal: number;
  notas: string;
  pagos: MetodoPagoState[];
}

export interface PosTabState {
  id: string;
  nombre: string;
  carrito: CarritoState;
}

export interface ConfirmarVentaInput {
  sesionId: string;
  almacenId: string;
  vendedorId: string;
  vendedorNombre: string;
  clienteId: string | null;
  clienteNombre: string;
  items: CarritoItem[];
  pagos: MetodoPagoState[];
  descuentoGlobal: number;
  impuestoPorcentaje: number;
  notas: string;
}

export interface VentaDetalle {
  documento: VentaDocumento;
  items: VentaItem[];
  pagos: VentaPago[];
}

// Configuración de Usuarios y Almacenes
export interface UsuarioAlmacenAsignacion {
  usuarioId: string;
  almacenIds: string[]; // múltiples almacenes permitidos
  asignadoEn: number;
  asignadoPor: string;
}

export interface UsuariosAlmacenesConfig {
  asignaciones: Record<string, UsuarioAlmacenAsignacion>; // key: usuarioId
  actualizadoEn?: number;
}

export interface UsuarioAlmacenSesionConfig {
  usuarioId: string;
  almacenSeleccionadoId: string | null;
  seleccionadoEn: number;
}

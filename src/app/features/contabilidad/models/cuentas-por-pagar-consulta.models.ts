import { EstadoDocumentoPorPagar, OrigenDocumentoPorPagar } from './cuentas-por-pagar.models';

export type TramoCartera = 'TODOS' | 'POR_VENCER' | 'VENCIDO' | '1_30' | '31_60' | '61_90' | 'MAS_90' | 'CREDITOS';

export interface ResumenCarteraCxp {
  deudaBruta: number;
  creditos: number;
  saldoNeto: number;
  vencido: number;
  porVencer: number;
  proveedores: number;
  documentos: number;
}

export interface ProveedorCarteraCxp {
  proveedorClave: string;
  proveedorNombre: string;
  proveedorIdentificacion: string;
  cantidadDocumentos: number;
  proximoVencimiento: string | null;
  porVencer: number;
  tramo1_30: number;
  tramo31_60: number;
  tramo61_90: number;
  tramoMas90: number;
  vencido: number;
  deudaBruta: number;
  creditos: number;
  saldoNeto: number;
}

export interface DocumentoCarteraCxp {
  id: string;
  numero: string;
  referencia: string;
  origenTipo: OrigenDocumentoPorPagar;
  proveedorClave: string;
  proveedorNombre: string;
  proveedorIdentificacion: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoOriginal: number;
  aplicadoAlCorte: number;
  saldoAlCorte: number;
  estadoAlCorte: EstadoDocumentoPorPagar;
  saldoActual: number;
  estadoActual: EstadoDocumentoPorPagar;
  diasVencidos: number;
  credito: boolean;
  elegiblePago: boolean;
  glosa: string;
}

export interface DocumentoHistorialCxp {
  id: string;
  numero: string;
  referencia: string;
  origenTipo: OrigenDocumentoPorPagar;
  proveedorClave: string;
  proveedorNombre: string;
  proveedorIdentificacion: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoOriginal: number;
  aplicadoActual: number;
  saldoActual: number;
  estadoActual: EstadoDocumentoPorPagar;
  anuladoEn: string | null;
  asientoId: string | null;
  motivoAnulacion: string | null;
}

export interface CarteraCxpResultado {
  fechaCorte: string;
  resumen: ResumenCarteraCxp;
  items: ProveedorCarteraCxp[];
  page: number;
  size: number;
  total: number;
}

export interface DetalleProveedorCxpResultado {
  proveedorClave: string;
  proveedorNombre: string;
  fechaCorte: string;
  items: DocumentoCarteraCxp[];
  page: number;
  size: number;
  total: number;
}

export interface HistorialCxpResultado {
  fechaDesde: string;
  fechaHasta: string;
  items: DocumentoHistorialCxp[];
  page: number;
  size: number;
  total: number;
}

export interface MovimientoDocumentoCxp {
  pagoId: string;
  pagoNumero: string;
  fecha: string;
  metodoPago: string;
  referencia: string;
  monto: number;
  estado: 'REGISTRADO' | 'ANULADO';
  anuladoEn: string | null;
}

export interface ReferenciaTrazableCxp {
  id: string;
  numero: string;
  descripcion: string;
  fecha: string | null;
  estado: string;
  tipo: string;
}

export interface TrazabilidadDocumentoCxp {
  documento: DocumentoHistorialCxp;
  glosa: string;
  asientoId: string | null;
  origenId: string | null;
  asiento: ReferenciaTrazableCxp | null;
  origen: ReferenciaTrazableCxp | null;
  movimientos: MovimientoDocumentoCxp[];
}

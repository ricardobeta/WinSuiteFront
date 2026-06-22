export type FacturaAmbiente = 'PRUEBA' | 'PRODUCCION';
export type FacturaTipoEmision = 'NORMAL' | 'SUSTITUTIVA';
export type FacturaTipoIdentificacionComprador =
  | 'RUC'
  | 'CEDULA'
  | 'PASAPORTE'
  | 'CONSUMIDOR_FINAL'
  | 'IDENTIFICACION_DEL_EXTERIOR';

export type FacturaFormaPago =
  | 'EFECTIVO'
  | 'CHEQUE'
  | 'TARJETA_CREDITO'
  | 'TRANSFERENCIA'
  | 'DEPOSITO'
  | 'COMPENSACION'
  | 'ENDOSO_TITULOS'
  | 'ENDOSO_TITULOS_VALOR';

export type FacturaCodigoImpuesto = 'IVA' | 'ICE' | 'IRBPNR';

export type FacturaCodigoPorcentajeIva =
  | 'IVA_0'
  | 'IVA_12'
  | 'IVA_14'
  | 'IVA_15'
  | 'IVA_5'
  | 'NO_OBJETO_IMPUESTO'
  | 'EXENTO_IVA'
  | 'IVA_DIFERENCIADO_3'
  | 'IVA_13';

export interface FacturaTax {
  codigo: FacturaCodigoImpuesto;
  codigoPorcentaje: FacturaCodigoPorcentajeIva;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface FacturaDetalle {
  codigoPrincipal: string;
  codigoAuxiliar: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: Record<string, string>;
  impuestos: FacturaTax[];
}

export interface FacturaPago {
  formaPago: FacturaFormaPago;
  total: number;
  plazo?: string | null;
  unidadTiempo?: string | null;
}

export interface Factura {
  ambiente: FacturaAmbiente;
  tipoEmision: FacturaTipoEmision;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  dirMatriz: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial?: string | null;
  claveAcceso?: string | null;
  fechaEmision: string;
  dirEstablecimiento: string;
  contribuyenteEspecial?: string | null;
  obligadoContabilidad?: string | null;
  tipoIdentificacionComprador: FacturaTipoIdentificacionComprador;
  identificacionComprador: string;
  razonSocialComprador: string;
  direccionComprador: string;
  totalSinImpuestos: number;
  totalDescuentos: number;
  totalConImpuestos: number;
  propina?: number | null;
  importeTotal: number;
  moneda: string;
  detalles: FacturaDetalle[];
  pagos: FacturaPago[];
  digitalSignature?: string | null;
}

export interface SriResponse {
  estado: string;
  numeroAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  ambiente?: string | null;
  comprobante?: string | null;
  mensajes?: string | null;
}

export type FacturaEstadoPaso = 'armando' | 'generando' | 'firmando' | 'autorizando' | 'autorizada' | 'error';

export interface FacturaEmisionResultado {
  facturaGenerada: Factura;
  respuestaFirma: SriResponse;
  respuestaAutorizacion: SriResponse;
  claveAcceso: string;
}

export interface FacturaSriRegistro {
  ventaId: string;
  ventaNumero: string;
  claveAcceso: string;
  estadoSri: string;
  autorizada: boolean;
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  autorizadaEn: number | null;
  ambiente: string | null;
  establecimiento: string | null;
  puntoEmision: string | null;
  secuencial: string | null;
  total: number;
  moneda: string;
  clienteId: string | null;
  clienteNombre: string;
  firmaId: string | null;
  mensajes: string | null;
  creadoEn: number;
  actualizadoEn: number;
}

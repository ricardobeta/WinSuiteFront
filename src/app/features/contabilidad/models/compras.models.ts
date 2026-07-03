// Modelos del submódulo de Facturas de Compra (contabilidad) y su relación con el ATS Ecuador.

export type EstadoFacturaCompra = 'BORRADOR' | 'REGISTRADA' | 'ANULADA';

/** SRI: 01 = RUC, 02 = cédula, 03 = pasaporte. */
export type TipoIdProveedor = '01' | '02' | '03';

export type SiNo = 'SI' | 'NO';

/** Retención en la fuente de renta (nodo <air><detalleAir> del ATS). */
export interface DetalleAirRetencion {
  codRetAir: string;
  baseImpAir: number;
  porcentajeAir: number;
  valRetAir: number;
}

/** Retención de IVA practicada en la compra. */
export interface RetencionIvaCompra {
  codRetIva: string;
  baseImpIva: number;
  porcentajeIva: number;
  valRetIva: number;
}

/** Referencia al documento modificado (solo notas de crédito). */
export interface DocumentoModificado {
  tipoComprobante: string; // tipo del doc modificado (ej. '01' factura)
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  fechaEmision: number | null;
  autorizacion?: string;
}

/** Bloque pagoExterior obligatorio en compras del ATS. */
export interface PagoExterior {
  pagoLocExt: '01' | '02'; // 01 = pago local, 02 = pago al exterior
  paisEfecPago?: string;
  aplicConvDobTrib?: SiNo;
  pagExtSujRetNorLeg?: SiNo;
}

export interface FacturaCompraItem {
  id?: string;
  productoId?: string | null;
  codigoPrincipal?: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  descuento?: number;
  ivaPorcentaje: number;
  subtotal: number;
  iva: number;
  total: number;
}

export type OrigenDocumentoCompra = 'XML' | 'MANUAL';

export interface FacturaCompra {
  id?: string;
  numero?: string; // consecutivo interno FC-0001

  estado: EstadoFacturaCompra;
  origen?: OrigenDocumentoCompra; // XML parseado o carga manual
  docModificado?: DocumentoModificado | null; // solo NC (tipoComprobante 04)

  // Proveedor
  tpIdProv: TipoIdProveedor;
  idProv: string;
  razonSocialProv: string;
  parteRel: SiNo;
  proveedorId?: string | null; // vínculo opcional a inventario/proveedores

  // Documento
  codSustento: string;
  tipoComprobante: string; // '01' factura
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  autorizacion?: string;
  claveAcceso?: string;
  fechaEmision: number; // timestamp
  fechaRegistro: number;

  // Montos (bases ATS)
  baseNoGraIva: number;
  baseImponible: number; // gravable 0%
  baseImpGrav: number; // gravable tarifa > 0
  baseImpExe: number;
  montoIce: number;
  montoIva: number;
  totalSinImpuestos: number;
  importeTotal: number;

  // Pago
  formasDePago: string[];
  pagoExterior?: PagoExterior;

  // Retenciones
  retencionesRenta: DetalleAirRetencion[];
  retencionesIva: RetencionIvaCompra[];
  totalRetencion: number;
  // Comprobante de retención emitido
  estabRetencion?: string;
  ptoEmiRetencion?: string;
  secRetencion?: string;
  autRetencion?: string;
  fechaEmiRet?: number | null;

  // Inventario
  alimentaInventario: boolean;
  almacenId?: string | null;
  ordenCompraId?: string | null;

  // Archivo XML
  archivoId?: string | null;
  xmlStoragePath?: string | null;

  creadoPor?: string;
  creadoEn: number;
  actualizadoEn: number;
}

// ---- DTO de parseo devuelto por el backend (POST /api/compras/parse-xml) ----

export interface FacturaCompraParsedItem {
  codigoPrincipal?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  ivaPorcentaje: number;
}

export interface FacturaCompraParsed {
  tpIdProv: string;
  idProv: string;
  razonSocialProv: string;
  tipoComprobante: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  secuencialCompleto?: string;
  claveAcceso?: string;
  fechaEmision?: string; // ISO yyyy-MM-dd
  baseNoGraIva: number;
  baseImponible: number;
  baseImpGrav: number;
  baseImpExe: number;
  montoIce: number;
  montoIva: number;
  totalSinImpuestos: number;
  importeTotal: number;
  // Solo NC (tipoComprobante 04)
  codDocModificado?: string;
  numDocModificado?: string;
  fechaEmisionDocSustento?: string; // ISO yyyy-MM-dd
  items: FacturaCompraParsedItem[];
}

// ---- Catálogos SRI mínimos para la UI ----

export interface CatalogoItem {
  codigo: string;
  descripcion: string;
}

/** Tipo de comprobante (tabla 4 SRI). */
export const TIPOS_COMPROBANTE: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '02', descripcion: 'Nota de venta' },
  { codigo: '03', descripcion: 'Liquidación de compra' },
  { codigo: '04', descripcion: 'Nota de crédito' }
];

export const TIPO_COMPROBANTE_NOTA_CREDITO = '04';

/** Código de sustento del comprobante (tabla 5 SRI). */
export const CODIGOS_SUSTENTO: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Crédito tributario para IVA' },
  { codigo: '02', descripcion: 'Costo o gasto para IR' },
  { codigo: '03', descripcion: 'Activo fijo - crédito tributario IVA' },
  { codigo: '04', descripcion: 'Activo fijo - costo o gasto' },
  { codigo: '05', descripcion: 'Liquidación de gastos de viaje' },
  { codigo: '06', descripcion: 'Inventario - crédito tributario IVA' },
  { codigo: '07', descripcion: 'Inventario - costo o gasto' },
  { codigo: '08', descripcion: 'Valor pagado para solicitar reembolso' },
  { codigo: '00', descripcion: 'Casos especiales sin sustento' }
];

/** Forma de pago (tabla 24 SRI) — obligatoria en compras ≥ $500. */
export const FORMAS_PAGO: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Sin utilización del sistema financiero' },
  { codigo: '15', descripcion: 'Compensación de deudas' },
  { codigo: '16', descripcion: 'Tarjeta de débito' },
  { codigo: '17', descripcion: 'Dinero electrónico' },
  { codigo: '18', descripcion: 'Tarjeta prepago' },
  { codigo: '19', descripcion: 'Tarjeta de crédito' },
  { codigo: '20', descripcion: 'Otros con utilización del sistema financiero' },
  { codigo: '21', descripcion: 'Endoso de títulos' }
];

/** Porcentajes de retención de IVA usuales. */
export const PORCENTAJES_RET_IVA: number[] = [10, 20, 30, 50, 70, 100];

export const MONTO_MINIMO_FORMA_PAGO = 500;

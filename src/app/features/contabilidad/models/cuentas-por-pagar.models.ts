// Modelos del submódulo Cuentas por Pagar (subledger de proveedores + pagos/egresos).
//
// El subledger es un libro auxiliar: reconcilia contra la(s) cuenta(s) de control "Cuentas por
// Pagar" del mayor. Regla de oro: no vuelve a contabilizar lo ya contabilizado. Un documento con
// origen FACTURA_COMPRA reutiliza el asiento que ya generó el módulo Compras; los orígenes MANUAL,
// RETENCION y NOMINA generan su propio asiento (DEBE gasto/pasivo / HABER CxP).

/** De dónde nace la obligación por pagar. */
export type OrigenDocumentoPorPagar = 'FACTURA_COMPRA' | 'MANUAL' | 'RETENCION' | 'NOMINA';

/** Estado de pago del documento en el subledger. */
export type EstadoDocumentoPorPagar = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';

/** Forma en que se paga un egreso a proveedor. */
export type MetodoPagoProveedor = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'TARJETA' | 'OTRO';

/** Estado del pago/egreso. */
export type EstadoPagoProveedor = 'REGISTRADO' | 'ANULADO';

/**
 * Documento por pagar (obligación) en el auxiliar. `montoOriginal` es el valor neto por pagar
 * (importe − retenciones para facturas). `saldoPendiente` se reduce con cada abono aplicado.
 */
export interface DocumentoPorPagar {
  id?: string;
  numero?: string; // consecutivo interno CXP-0001

  origenTipo: OrigenDocumentoPorPagar;
  origenId?: string | null;        // id del documento origen (ej. facturaCompraId)
  origenNumero?: string | null;    // número legible del origen (ej. establecimiento-punto-secuencial)

  // Proveedor (desnormalizado + vínculo opcional al maestro de inventario/proveedores)
  proveedorId?: string | null;
  proveedorNombre: string;
  proveedorIdentificacion?: string;

  // Fechas
  fechaEmision: number;      // timestamp
  fechaVencimiento: number;  // timestamp (emisión + díasCrédito del proveedor)

  moneda: string;            // 'USD'
  glosa: string;

  montoOriginal: number;
  saldoPendiente: number;
  estadoPago: EstadoDocumentoPorPagar;

  asientoId?: string | null; // asiento que originó la obligación (el de la compra, o el propio si es manual)

  creadoPor?: string;
  creadoEn: number;
  actualizadoEn: number;
}

/** Aplicación de un pago a un documento por pagar concreto. */
export interface AplicacionPago {
  documentoId: string;
  documentoNumero: string;
  monto: number;
}

/** Pago/egreso a proveedor. Debita la(s) cuenta(s) por pagar y acredita caja-banco. */
export interface PagoProveedor {
  id?: string;
  numero?: string; // consecutivo interno PP-0001

  proveedorId?: string | null;
  proveedorNombre: string;

  fecha: number; // timestamp
  cuentaOrigenId: string; // cuenta contable caja/banco (HABER)
  metodoPago: MetodoPagoProveedor;
  referencia?: string; // n.º de cheque / transferencia
  glosa: string;

  montoTotal: number;
  aplicaciones: AplicacionPago[];

  asientoId?: string | null;
  estado: EstadoPagoProveedor;

  creadoPor?: string;
  creadoEn: number;
  actualizadoEn: number;
}

/**
 * Configuración del módulo Cuentas por Pagar (pestaña propia en Configuración contable). Define las
 * cuentas por defecto del módulo y qué fuentes de obligaciones están activas para esta empresa.
 */
export interface ConfiguracionCuentasPorPagar {
  habilitarCuentasPorPagar: boolean;
  cuentaPorPagarDefaultId: string;       // cuenta de control CxP (HABER en compras/manuales)
  cuentaCajaBancoEgresoDefaultId: string; // cuenta caja/banco sugerida al pagar
  // Fuentes activas (flexibilidad por empresa/usuario)
  fuenteFacturasCompra: boolean;
  fuenteManual: boolean;
  fuenteRetenciones: boolean;
  fuenteNomina: boolean;
  actualizadoEn?: number;
}

/** Tramos de antigüedad de saldos (aging). */
export interface TramoAging {
  etiqueta: string;
  desde: number; // días vencidos (inclusive)
  hasta: number | null; // días vencidos (inclusive); null = sin tope
  total: number;
}

/** Fila de antigüedad de saldos por proveedor. */
export interface AgingProveedor {
  proveedorId: string | null;
  proveedorNombre: string;
  porVencer: number;
  tramo1_30: number;
  tramo31_60: number;
  tramo61_90: number;
  tramoMas90: number;
  total: number;
}

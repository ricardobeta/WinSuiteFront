/**
 * Modelos del submódulo Bancos (conciliación bancaria).
 * Datos en RTDB bajo contabilidad/{tenantId}/bancos/...
 * Los nodos movimientos/hashes/extractos/plantillas son de escritura
 * exclusiva del backend; el front solo los lee.
 */

export type BancoCodigo =
  | 'PICHINCHA'
  | 'GUAYAQUIL'
  | 'PRODUBANCO'
  | 'PACIFICO'
  | 'BOLIVARIANO'
  | 'INTERNACIONAL'
  | 'OTRO';

export const BANCOS_ECUADOR: { codigo: BancoCodigo; nombre: string }[] = [
  { codigo: 'PICHINCHA', nombre: 'Banco Pichincha' },
  { codigo: 'GUAYAQUIL', nombre: 'Banco de Guayaquil' },
  { codigo: 'PRODUBANCO', nombre: 'Produbanco' },
  { codigo: 'PACIFICO', nombre: 'Banco del Pacífico' },
  { codigo: 'BOLIVARIANO', nombre: 'Banco Bolivariano' },
  { codigo: 'INTERNACIONAL', nombre: 'Banco Internacional' },
  { codigo: 'OTRO', nombre: 'Otro banco' }
];

export type TipoCuentaBancaria = 'CORRIENTE' | 'AHORROS';
export type EstadoCuentaBancaria = 'ACTIVA' | 'INACTIVA';

export interface CuentaBancaria {
  id?: string;
  nombre: string;
  bancoCodigo: BancoCodigo;
  bancoNombre: string;
  tipoCuenta: TipoCuentaBancaria;
  numeroCuenta: string;
  moneda: string;
  cuentaContableId: string;
  plantillaBancoId?: string | null;
  saldoExtracto?: { valor: number; fecha: string; extractoId: string } | null;
  estado: EstadoCuentaBancaria;
  creadoEn?: number;
  creadoPor?: string | null;
  actualizadoEn?: number;
  actualizadoPor?: string | null;
}

export type EstadoConciliacionMovimiento = 'PENDIENTE' | 'SUGERIDO' | 'CONCILIADO' | 'DESCARTADO';

export interface MovimientoBancario {
  id?: string;
  extractoId: string;
  fecha: string;          // ISO yyyy-MM-dd
  fechaTs: number;
  periodo: string;        // yyyy-MM
  claveOrden: string;     // fecha#pushId — cursor de paginación
  descripcion: string;
  referencia: string;
  tipo: 'DEBITO' | 'CREDITO';
  monto: number;          // crédito +, débito -
  saldoLinea?: number | null;
  hashFila: string;
  estadoConciliacion: EstadoConciliacionMovimiento;
  matchId?: string | null;
}

export type EstadoMatch = 'AUTO' | 'SUGERIDO' | 'CONFIRMADO' | 'MANUAL' | 'DESCARTADO';
export type OrigenMatch = 'L1_EXACTO' | 'L2_REGLA' | 'L3_MEMORIA' | 'L4_IA' | 'MANUAL';
export type TipoContraparte = 'ASIENTO' | 'PAGO_CXP' | 'TESORERIA' | 'ASIENTO_NUEVO';

export interface ContraparteMatch {
  tipo: TipoContraparte;
  id: string;
  lineaIndex?: number | null;
  monto: number;
  detalle?: string;
}

export interface MatchConciliacion {
  id?: string;
  periodo: string;
  estado: EstadoMatch;
  origen: OrigenMatch;
  confianza: number;
  movimientoIds: string[];
  contrapartes: ContraparteMatch[];
  cuentaContableSugerida?: string | null;
  motivo: string;
  creadoEn: number;
  creadoPor?: string;
  confirmadoEn?: number | null;
  confirmadoPor?: string | null;
}

export interface ExtractoBancario {
  id?: string;
  cuentaBancariaId: string;
  periodo: string;
  archivo: { storagePath: string; nombre: string; tipo: 'XLSX' | 'CSV'; tamano?: number };
  plantillaId?: string | null;
  estado: 'ANALIZADO' | 'IMPORTADO' | 'ERROR';
  stats?: { filasLeidas: number; importadas: number; duplicadas: number; errores: number };
  saldoInicial?: number | null;
  saldoFinal?: number | null;
  importadoEn?: number;
  importadoPor?: string;
}

/** Mapeo de columnas detectado (plantilla o IA); editable en el wizard. */
export interface MapeoColumna {
  col: number | null;
  formatoFecha?: string;
  convencionSigno?: 'NEGATIVO_DEBITO' | 'NEGATIVO_CREDITO';
}

export interface MapeoExtracto {
  hojaIndex: number;
  filaEncabezado: number;
  mapeo: {
    fecha: MapeoColumna;
    descripcion: MapeoColumna;
    referencia?: MapeoColumna;
    debito?: MapeoColumna;
    credito?: MapeoColumna;
    montoUnico?: MapeoColumna;
    saldo?: MapeoColumna;
  };
  separadorDecimal: '.' | ',';
}

export interface HojaExtractoResumen {
  index: number;
  nombre: string;
  filasConDatos: number;
}

/** Plantilla guardada evaluada contra la hoja elegida. */
export interface PlantillaDisponible {
  id: string;
  nombre: string;
  bancoCodigo: string;
  formato: 'XLSX' | 'CSV';
  vecesUsada: number;
  compatible: boolean;
  motivo: string;
  filasValidas: number;
  filasDatos: number;
}

/** Fila candidata a encabezado, para el selector del wizard. */
export interface FilaCandidata {
  index: number;
  resumen: string;
}

/** filaEncabezado con este valor = el archivo no tiene títulos. */
export const SIN_ENCABEZADO = -1;

export interface AnalisisExtracto {
  origenMapeo: 'PLANTILLA' | 'IA' | 'MANUAL';
  plantillaId?: string | null;
  mapeo: MapeoExtracto;
  encabezados: string[];
  preview: PreviewFila[];
  filasDetectadas: number;
  filasValidas: number;
  filasDescartadas: number;
  erroresMuestra: string[];
  hojaIndex: number;
  hojas: HojaExtractoResumen[];
  primerasFilas: FilaCandidata[];
  /** Propuestos a partir del archivo; el usuario los confirma antes de importar. */
  saldoInicialDetectado?: number | null;
  saldoFinalDetectado?: number | null;
  sumaMovimientos: number;
  /** false = la deducción es incierta y hay que contrastarla con el extracto del banco. */
  saldosConfiables: boolean;
}

export interface PreviewFila {
  fila: number;
  fecha?: string;
  descripcion?: string;
  referencia?: string;
  tipo?: 'DEBITO' | 'CREDITO';
  monto?: number;
  saldoLinea?: number;
  error?: string;
}

export interface ResultadoImportacion {
  extractoId: string;
  filasLeidas: number;
  importadas: number;
  duplicadas: number;
  errores: string[];
  plantillaId?: string | null;
}

export interface ResultadoConciliacion {
  movimientosEvaluados: number;
  autoConciliados: number;
  sugeridos: number;
  descartados: number;
  matches: MatchConciliacion[];
}

export interface PartidaConciliatoria {
  movId?: string;
  tipo?: TipoContraparte;
  id?: string;
  lineaIndex?: number;
  fecha: string;
  monto: number;
  detalle: string;
}

export interface ResumenConciliacion {
  periodo: string;
  cuentaBancariaId: string;
  generadoEn: number;
  saldoLibros: number;
  saldoExtracto?: number;
  diferencia?: number;
  saldoBancoAjustado?: number;
  saldoLibrosAjustado?: number;
  diferenciaResidual?: number;
  /** Continuidad del extracto: inicial + movimientos debe llegar al final. */
  saldoInicialExtracto?: number;
  movimientosExtracto?: number;
  descuadreExtracto?: number;
  partidas: {
    depositosTransito: PartidaConciliatoria[];
    chequesNoCobrados: PartidaConciliatoria[];
    ndNoRegistradas: PartidaConciliatoria[];
    ncNoRegistradas: PartidaConciliatoria[];
  };
  totales: {
    movimientos: number;
    pendientesBanco: number;
    pendientesLibros: number;
    depositosTransito: number;
    chequesNoCobrados: number;
    ndNoRegistradas: number;
    ncNoRegistradas: number;
  };
  explicacionIA?: string;
  /** Notas del contador sobre el período; sobreviven al recálculo y salen en el PDF. */
  observaciones?: string;
  observacionesPor?: string;
  observacionesEn?: number;
}

export interface MovimientosPage {
  items: MovimientoBancario[];
  nextCursor: string | null;
  hasMore: boolean;
}

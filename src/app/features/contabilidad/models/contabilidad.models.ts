export type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO';

export type NaturalezaCuenta = 'DEUDORA' | 'ACREEDORA';

export type EstadoCuentaContable = 'ACTIVA' | 'INACTIVA';

export type OrigenCuentaContable = 'MANUAL' | 'PLANTILLA_ESF_CONSTRUCTORA' | 'PLANTILLA_PLAN_COMPLETO_ECUADOR';

export type SeccionReporteFinanciero =
  | 'ACTIVO_CORRIENTE'
  | 'ACTIVO_NO_CORRIENTE'
  | 'PASIVO_CORRIENTE'
  | 'PASIVO_NO_CORRIENTE'
  | 'PATRIMONIO'
  | 'INGRESOS_OPERACIONALES'
  | 'COSTOS'
  | 'GASTOS_ADMINISTRATIVOS'
  | 'GASTOS_VENTAS'
  | 'GASTOS_FINANCIEROS'
  | 'OTROS_INGRESOS'
  | 'OTROS_GASTOS';

export type TipoContribuyente = 'RIMPE' | 'NORMAL' | 'ESPECIAL';

export type EstadoPeriodoContable = 'ABIERTO' | 'CERRADO';

export interface CuentaContable {
  id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  cuentaPadreId?: string | null;
  nivel: number;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  permiteMovimiento: boolean;
  estado: EstadoCuentaContable;
  origen: OrigenCuentaContable;
  seccionReporte?: SeccionReporteFinanciero | null;
  ordenReporte?: number | null;
  incluyeEnEstadoFinanciero?: boolean;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface CuentaPlantillaPlanCuentas {
  codigo: string;
  nombre: string;
  descripcion?: string;
  permiteMovimiento: boolean;
  seccionReporte?: SeccionReporteFinanciero;
  ordenReporte?: number;
  incluyeEnEstadoFinanciero?: boolean;
}

export interface PlantillaPlanCuentas {
  id: string;
  nombre: string;
  descripcion: string;
  origen: OrigenCuentaContable;
  cuentas: CuentaPlantillaPlanCuentas[];
}

export interface ResultadoAplicarPlantilla {
  insertadas: number;
  omitidas: number;
}

export interface ConfiguracionEmpresaContable {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  obligadoContabilidad: boolean;
  tipoContribuyente: TipoContribuyente;
  actividadEconomicaCodigo: string;
  actividadEconomicaDescripcion: string;
  fechaInicioContable: string;
  monedaFuncional: 'USD';
  correoNotificacionesSri: string;
  configurado: boolean;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface PeriodoContable {
  id: string;
  anio: number;
  mes: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodoContable;
  creadoEn?: number;
  actualizadoEn?: number;
  cerradoEn?: number | null;
  cerradoPor?: string | null;
  reabiertoEn?: number | null;
  reabiertoPor?: string | null;
  motivoReapertura?: string | null;
}

export interface AuditoriaPeriodoContable {
  id?: string;
  periodoId: string;
  accion: 'CREAR' | 'CERRAR' | 'REABRIR';
  motivo?: string | null;
  usuarioId?: string | null;
  creadoEn: number;
}

export type EstadoAsiento = 'BORRADOR' | 'APROBADO' | 'REVERSADO';

export type TipoAsiento = 'MANUAL' | 'APERTURA' | 'AJUSTE';

export type OrigenAsiento = 'MANUAL' | 'VENTA_POS' | 'REVERSO_VENTA' | 'RECEPCION_OC' | 'REVERSO_RECEPCION_OC';

export type OrigenAsientoAutomatico = Exclude<OrigenAsiento, 'MANUAL'>;

export type ModoAsientoAutomatico = 'APROBADO' | 'BORRADOR';

export type OrigenModuloContable = 'VENTAS' | 'INVENTARIO';

export interface AsientoContableLinea {
  id: string;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface AsientoContable {
  id?: string;
  numero?: string | null;
  fecha: string;
  periodo: string;
  tipo: TipoAsiento;
  glosa: string;
  referencia?: string;
  estado: EstadoAsiento;
  origen: OrigenAsiento;
  origenTipo?: OrigenAsientoAutomatico | null;
  origenId?: string | null;
  origenNumero?: string | null;
  origenModulo?: OrigenModuloContable | null;
  lineas: AsientoContableLinea[];
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  asientoReversadoId?: string | null;
  creadoEn?: number;
  actualizadoEn?: number;
  aprobadoEn?: number | null;
  reversadoEn?: number | null;
}

export interface ConfiguracionIntegracionContable {
  habilitarAsientosAutomaticos: boolean;
  modoAsientoAutomatico: ModoAsientoAutomatico;
  cuentaCajaBancoId: string;
  cuentaCuentasPorCobrarId: string;
  cuentaCuentasPorPagarId: string;
  cuentaVentasProductosId: string;
  cuentaVentasServiciosId: string;
  cuentaIvaVentasId: string;
  cuentaIvaComprasId: string;
  cuentaInventarioId: string;
  cuentaCostoVentasId: string;
  cuentaDescuentosVentasId: string;
  actualizadoEn?: number;
}

export interface MapeoCategoriaContable {
  categoriaId: string;
  cuentaIngresoProductosId?: string;
  cuentaIngresoServiciosId?: string;
  cuentaInventarioId?: string;
  cuentaCostoVentaId?: string;
  cuentaCompraGastoId?: string;
  actualizadoEn?: number;
}

export type EstadoPendienteContabilizacion = 'PENDIENTE' | 'RESUELTO';

export interface PendienteContabilizacion {
  id?: string;
  origenTipo: OrigenAsientoAutomatico;
  origenId: string;
  origenNumero?: string | null;
  origenModulo: OrigenModuloContable;
  motivo: string;
  detalle: string;
  estado: EstadoPendienteContabilizacion;
  creadoEn: number;
  actualizadoEn: number;
}

export interface SaldoCuentaPeriodo {
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  periodo: string;
  debitos: number;
  creditos: number;
  saldo: number;
  actualizadoEn: number;
}

export interface FiltrosReporteContable {
  fechaDesde?: string;
  fechaHasta?: string;
  periodo?: string;
  cuentaId?: string;
  tipoCuenta?: TipoCuenta | 'TODOS';
  texto?: string;
}

export interface LibroDiarioFila {
  asientoId?: string;
  fecha: string;
  periodo: string;
  numero: string;
  glosa: string;
  estado: EstadoAsiento;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number;
  haber: number;
}

export interface LibroMayorFila {
  asientoId?: string;
  fecha: string;
  periodo: string;
  numero: string;
  concepto: string;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number;
  haber: number;
  saldo: number;
}

export interface LibroMayorResultado {
  saldoAnterior: number;
  totalDebe: number;
  totalHaber: number;
  saldoFinal: number;
  movimientos: LibroMayorFila[];
}

export interface BalanceComprobacionFila {
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  tipo: TipoCuenta;
  totalDebe: number;
  totalHaber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

export interface BalanceComprobacionResultado {
  filas: BalanceComprobacionFila[];
  totalDebe: number;
  totalHaber: number;
  totalSaldoDeudor: number;
  totalSaldoAcreedor: number;
  diferencia: number;
}

export interface EstadoFinancieroLinea {
  cuentaId?: string;
  codigoCuenta: string;
  nombreCuenta: string;
  seccion: SeccionReporteFinanciero;
  monto: number;
  orden: number;
  esCalculada?: boolean;
}

export interface EstadoFinancieroSeccion {
  seccion: SeccionReporteFinanciero;
  nombre: string;
  lineas: EstadoFinancieroLinea[];
  total: number;
  orden: number;
}

export interface EstadoSituacionFinancieraResultado {
  fechaCorte: string;
  secciones: EstadoFinancieroSeccion[];
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;
  resultadoEjercicio: number;
  diferencia: number;
}

export interface EstadoResultadoIntegralResultado {
  fechaDesde: string;
  fechaHasta: string;
  secciones: EstadoFinancieroSeccion[];
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  resultadoBruto: number;
  resultadoOperacional: number;
  resultadoNeto: number;
}

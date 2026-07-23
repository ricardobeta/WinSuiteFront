import { ModoAsientoAutomatico } from './contabilidad.models';
import { CampoPersonalizado } from '../../../shared/models/clientes.models';

export type EstadoEmpleadoNomina = 'ACTIVO' | 'INACTIVO';

export type EstadoContratoNomina = 'VIGENTE' | 'FINALIZADO';

export type EstadoRolPago = 'BORRADOR' | 'APROBADO' | 'ANULADO';

export type TipoNovedadNomina = 'INGRESO' | 'DESCUENTO';

export type TipoRubroNomina = 'INGRESO' | 'DESCUENTO';

export type ModoCalculoRubro = 'MANUAL' | 'PORCENTAJE_SUELDO' | 'FIJO';

export type OrigenLineaRol = 'SUELDO' | 'RUBRO' | 'SISTEMA';

/**
 * Un periodo puede tener varios roles de distinto tipo (el mensual de diciembre convive con el
 * rol de decimo tercero y con una liquidacion). Los roles creados antes de esta distincion se
 * normalizan a MENSUAL al leerlos.
 */
export type TipoRolNomina =
  | 'MENSUAL'
  | 'DECIMO_TERCERO'
  | 'DECIMO_CUARTO'
  | 'UTILIDADES'
  | 'LIQUIDACION';

export type RegionNomina = 'SIERRA' | 'COSTA';

/** Mensualizado: se paga en cada rol. Acumulado: se provisiona y se paga en su rol anual. */
export type ModoDecimos = 'MENSUALIZADO' | 'ACUMULADO';

/**
 * Motivo de terminacion. Define que indemnizaciones entran en el finiquito: el desahucio paga
 * bonificacion del 25% por año, el despido intempestivo paga la escala del Codigo del Trabajo,
 * y la renuncia o el fin de contrato solo liquidan lo devengado.
 */
export type MotivoSalidaNomina =
  | 'RENUNCIA'
  | 'DESPIDO_INTEMPESTIVO'
  | 'DESAHUCIO'
  | 'MUTUO_ACUERDO'
  | 'FIN_CONTRATO';

export type ConceptoProvision =
  | 'DECIMO_TERCERO'
  | 'DECIMO_CUARTO'
  | 'FONDOS_RESERVA'
  | 'VACACIONES';

export interface EmpleadoNomina {
  id?: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  email?: string;
  telefono?: string;
  cargo: string;
  departamento?: string;
  fechaIngreso: string;
  sueldoBase: number;
  estado: EstadoEmpleadoNomina;
  /**
   * Cada empleado elige ante el IESS si recibe decimos y fondos de reserva mensualizados o
   * acumulados; no es una politica de la empresa. Si vienen vacios se usa el valor por defecto
   * de la configuracion de nomina.
   */
  modoDecimoTercero?: ModoDecimos;
  modoDecimoCuarto?: ModoDecimos;
  modoFondosReserva?: ModoDecimos;
  /** Conyuge e hijos que dan derecho al 5% de utilidades por cargas familiares. */
  cargasFamiliares?: number;
  /** Se llenan al liquidar al empleado; disparan el rol de finiquito. */
  fechaSalida?: string | null;
  motivoSalida?: MotivoSalidaNomina | null;
  camposPersonalizados?: Record<string, any>;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface ContratoNomina {
  id?: string;
  empleadoId: string;
  cargo: string;
  sueldoBase: number;
  fechaInicio: string;
  fechaFin?: string | null;
  estado: EstadoContratoNomina;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface RubroNomina {
  id?: string;
  codigo: string;
  nombre: string;
  tipo: TipoRubroNomina;
  afectaIess: boolean;
  modoCalculo: ModoCalculoRubro;
  valorReferencia?: number;
  cuentaContableId?: string;
  sistema?: boolean;
  activo: boolean;
  orden?: number;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface NovedadNomina {
  id?: string;
  empleadoId: string;
  periodo: string;
  tipo: TipoNovedadNomina;
  concepto: string;
  monto: number;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface RolPagoLinea {
  rubroId: string;
  codigo: string;
  nombre: string;
  tipo: TipoRubroNomina;
  afectaIess: boolean;
  cuentaContableId?: string;
  monto: number;
  origen: OrigenLineaRol;
  editable: boolean;
}

export interface RolPagoDetalle {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  cargo: string;
  sueldoBase: number;
  /**
   * Reglas del empleado congeladas al generar el rol, para que el recalculo del borrador no
   * dependa de volver a leer la ficha ni cambie si el empleado se edita despues.
   */
  modoDecimoTercero?: ModoDecimos;
  modoDecimoCuarto?: ModoDecimos;
  modoFondosReserva?: ModoDecimos;
  /** Falso mientras el empleado no cumple un año de trabajo: antes no se devengan fondos de reserva. */
  aplicaFondosReserva?: boolean;
  /** Monto de decimos y fondos pagados en este rol por estar mensualizados. */
  decimoTerceroMensualizado?: number;
  decimoCuartoMensualizado?: number;
  fondosReservaMensualizado?: number;
  lineas: RolPagoLinea[];
  ingresosAdicionales: number;
  aportePersonalIess: number;
  aportePatronalIess: number;
  anticipos: number;
  prestamos: number;
  otrosDescuentos: number;
  decimoTerceroProvision: number;
  decimoCuartoProvision: number;
  fondosReservaProvision: number;
  vacacionesProvision: number;
  totalIngresos: number;
  totalDescuentos: number;
  totalBeneficios: number;
  netoPagar: number;
}

export interface RolPago {
  id?: string;
  numero?: string | null;
  periodo: string;
  tipo: TipoRolNomina;
  fechaPago: string;
  estado: EstadoRolPago;
  modoAsiento: ModoAsientoAutomatico;
  totalIngresos: number;
  totalAportePersonalIess: number;
  totalAportePatronalIess: number;
  totalAnticipos: number;
  totalPrestamos: number;
  totalOtrosDescuentos: number;
  totalBeneficios: number;
  totalNetoPagar: number;
  totalEmpleados: number;
  asientoId?: string | null;
  /** Asiento de reversion cuando el rol aprobado se reversa contablemente. */
  asientoReversionId?: string | null;
  creadoEn?: number;
  actualizadoEn?: number;
  aprobadoEn?: number | null;
  anuladoEn?: number | null;
  reversadoEn?: number | null;
}

/** Claves de la configuracion de nomina que apuntan a una cuenta del plan contable. */
export type CuentaNominaKey =
  | 'cuentaGastoSueldosId'
  | 'cuentaGastoBeneficiosSocialesId'
  | 'cuentaGastoAportePatronalId'
  | 'cuentaSueldosPorPagarId'
  | 'cuentaIessPorPagarId'
  | 'cuentaAnticiposEmpleadosId'
  | 'cuentaPrestamosEmpleadosId'
  | 'cuentaDecimosPorPagarId'
  | 'cuentaFondosReservaPorPagarId'
  | 'cuentaVacacionesPorPagarId'
  | 'cuentaUtilidadesPorPagarId';

export interface ConfiguracionNominaContable {
  modoAsiento: ModoAsientoAutomatico;
  porcentajeAportePersonalIess: number;
  porcentajeAportePatronalIess: number;
  salarioBasicoUnificado: number;
  /** Define el periodo de calculo del decimo cuarto: Sierra ago-jul, Costa mar-feb. */
  region: RegionNomina;
  modoDecimos: ModoDecimos;
  provisionarDecimoTercero: boolean;
  provisionarDecimoCuarto: boolean;
  provisionarFondosReserva: boolean;
  provisionarVacaciones: boolean;
  cuentaGastoSueldosId: string;
  cuentaGastoBeneficiosSocialesId: string;
  cuentaGastoAportePatronalId: string;
  cuentaSueldosPorPagarId: string;
  cuentaIessPorPagarId: string;
  cuentaAnticiposEmpleadosId: string;
  cuentaPrestamosEmpleadosId: string;
  cuentaDecimosPorPagarId: string;
  cuentaFondosReservaPorPagarId: string;
  cuentaVacacionesPorPagarId: string;
  /** Solo se exige al generar el rol de utilidades, no forma parte del checklist mensual. */
  cuentaUtilidadesPorPagarId: string;
  camposPersonalizados: CampoPersonalizado[];
  actualizadoEn?: number;
}

/** Vista previa del reparto de utilidades antes de generar el rol. */
export interface RepartoUtilidadesEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  diasTrabajados: number;
  cargasFamiliares: number;
  porTiempo: number;
  porCargas: number;
  total: number;
  /** Excedente sobre el techo legal de 24 SBU, que se transfiere al IESS. */
  excedente: number;
}

export interface RepartoUtilidades {
  anio: string;
  utilidadBase: number;
  monto10: number;
  monto5: number;
  totalDias: number;
  techoPorEmpleado: number;
  empleados: RepartoUtilidadesEmpleado[];
  totalRepartido: number;
  totalExcedente: number;
}

export interface RubroLiquidacion {
  codigo: string;
  nombre: string;
  tipo: TipoRubroNomina;
  monto: number;
  detalle: string;
}

export interface LiquidacionEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  fechaIngreso: string;
  fechaSalida: string;
  motivoSalida: MotivoSalidaNomina;
  aniosServicio: number;
  ultimaRemuneracion: number;
  rubros: RubroLiquidacion[];
  totalIngresos: number;
  totalDescuentos: number;
  netoPagar: number;
}

export interface ResumenRolPago {
  rol: RolPago;
  detalles: RolPagoDetalle[];
}

export type ItemPreparacionNomina =
  | 'CUENTAS'
  | 'REGLAS'
  | 'RUBROS'
  | 'EMPLEADOS'
  | 'PERIODO';

/**
 * Estado de un requisito previo a generar un rol. Se evalua sin lanzar excepciones para
 * poder mostrar el checklist completo de una sola vez, en lugar de fallar al aprobar.
 */
export interface RequisitoNomina {
  item: ItemPreparacionNomina;
  etiqueta: string;
  ok: boolean;
  detalle: string;
  /** Ruta a la que se envia al contador para resolver el requisito. */
  rutaResolver: string;
  queryParams?: Record<string, string>;
}

export interface PreparacionNomina {
  listo: boolean;
  requisitos: RequisitoNomina[];
}

/**
 * Aporte de un rol aprobado al historial anual de un empleado. Es la materia prima de decimos,
 * utilidades, liquidacion y del desglose de provisiones: sin esto no hay forma de responder
 * "cuanto lleva acumulado este empleado" sin recorrer el mayor cuenta por cuenta.
 */
export interface AporteAcumuladoNomina {
  rolId: string;
  rolNumero: string;
  tipo: TipoRolNomina;
  periodo: string;
  fechaPago: string;
  /** Ingresos que forman la base del decimo tercero (los que afectan IESS). */
  ingresosGravados: number;
  totalIngresos: number;
  aportePersonalIess: number;
  aportePatronalIess: number;
  decimoTerceroProvision: number;
  decimoCuartoProvision: number;
  fondosReservaProvision: number;
  vacacionesProvision: number;
  /** Dias trabajados imputados al periodo; base del reparto de utilidades. */
  diasTrabajados: number;
  registradoEn: number;
}

export interface AcumuladoEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  anio: string;
  aportes: AporteAcumuladoNomina[];
}

export interface SaldoProvisionEmpleado {
  concepto: ConceptoProvision;
  acumulado: number;
  pagado: number;
  saldo: number;
}

export interface DesgloseProvisionesEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  saldos: SaldoProvisionEmpleado[];
  aportes: AporteAcumuladoNomina[];
}

export interface DesgloseProvisiones {
  anio: string;
  empleados: DesgloseProvisionesEmpleado[];
  totalesPorConcepto: SaldoProvisionEmpleado[];
}

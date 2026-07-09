import { ModoAsientoAutomatico } from './contabilidad.models';
import { CampoPersonalizado } from '../../../shared/models/clientes.models';

export type EstadoEmpleadoNomina = 'ACTIVO' | 'INACTIVO';

export type EstadoContratoNomina = 'VIGENTE' | 'FINALIZADO';

export type EstadoRolPago = 'BORRADOR' | 'APROBADO' | 'ANULADO';

export type TipoNovedadNomina = 'INGRESO' | 'DESCUENTO';

export type TipoRubroNomina = 'INGRESO' | 'DESCUENTO';

export type ModoCalculoRubro = 'MANUAL' | 'PORCENTAJE_SUELDO' | 'FIJO';

export type OrigenLineaRol = 'SUELDO' | 'RUBRO' | 'SISTEMA';

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
  creadoEn?: number;
  actualizadoEn?: number;
  aprobadoEn?: number | null;
  anuladoEn?: number | null;
}

export interface ConfiguracionNominaContable {
  modoAsiento: ModoAsientoAutomatico;
  porcentajeAportePersonalIess: number;
  porcentajeAportePatronalIess: number;
  salarioBasicoUnificado: number;
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
  camposPersonalizados: CampoPersonalizado[];
  actualizadoEn?: number;
}

export interface ResumenRolPago {
  rol: RolPago;
  detalles: RolPagoDetalle[];
}

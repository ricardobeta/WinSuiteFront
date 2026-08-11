import { ModoAsientoAutomatico } from './contabilidad.models';
import { TipoRolNomina } from './nomina.models';

/**
 * REGISTRADO: el dinero salio del banco y el asiento cancelo el pasivo del rol.
 * ANULADO: se registro por error y se reverso contablemente; su monto vuelve al saldo del empleado.
 */
export type EstadoPagoNomina = 'REGISTRADO' | 'ANULADO';

export type FormaPagoNomina = 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO';

/**
 * Documento de pago de un rol aprobado: la segunda mitad del ciclo de nomina. El asiento del rol
 * dejo el pasivo (sueldos y beneficios sociales por pagar); este documento lo cancela contra el
 * banco que hizo la transferencia.
 *
 * Un pago individual es simplemente un documento con un solo detalle, asi que pagar a un empleado
 * y pagar a toda la planilla comparten todo el camino de codigo. Un rol admite varios pagos hasta
 * quedar cubierto: los parciales son la norma cuando falta el numero de cuenta de alguien.
 */
export interface PagoNomina {
  id?: string;
  numero: string;
  rolId: string;
  rolNumero: string | null;
  rolTipo: TipoRolNomina;
  /** Periodo 'YYYY-MM' heredado del rol. */
  periodo: string;
  /** Fecha en que salio el dinero; es la fecha del asiento. */
  fecha: string;
  cuentaBancariaId: string;
  /**
   * Banco y numero congelados al pagar: si manana se edita o desactiva la cuenta bancaria, el
   * documento sigue mostrando desde donde salio realmente la plata.
   */
  bancoNombre: string;
  numeroCuentaBanco: string;
  /** Cuenta contable del banco congelada. Es el HABER del asiento. */
  cuentaContableBancoId: string;
  formaPago: FormaPagoNomina;
  /** Numero de transferencia, lote o cheque. */
  referencia?: string;
  /** Glosa que escribe el usuario. Baja a cada linea del asiento junto al nombre del empleado. */
  concepto: string;
  total: number;
  totalEmpleados: number;
  estado: EstadoPagoNomina;
  modoAsiento: ModoAsientoAutomatico;
  asientoId?: string | null;
  asientoReversionId?: string | null;
  creadoEn?: number;
  actualizadoEn?: number;
  anuladoEn?: number | null;
}

export interface PagoNominaDetalle {
  empleadoId: string;
  empleadoNombre: string;
  /** Ausente cuando el detalle del rol no la congeló; el pago no la necesita para contabilizar. */
  cedula?: string;
  cargo: string;
  /** Neto del rol congelado al pagar, para auditar el parcial sin releer el rol. */
  netoRol: number;
  /** Lo que ya se le habia pagado en documentos anteriores. */
  pagadoAntes: number;
  monto: number;
  /**
   * Desglose del DEBE. Siempre montoSueldos + montoBeneficios === monto: en un pago parcial del rol
   * mensual se prorratea, y en los demas tipos de rol todo el monto va al pasivo principal.
   */
  montoSueldos: number;
  montoBeneficios: number;
  /**
   * Comprobante individual del empleado: el numero de transferencia o cheque con que cobro. Baja a
   * la descripcion de sus lineas del asiento, que es donde el contador lo busca cuando el
   * trabajador reclama que no le llego el pago.
   */
  referenciaPago?: string;
  observacion?: string;
}

export interface ResumenPagoNomina {
  pago: PagoNomina;
  detalles: PagoNominaDetalle[];
}

/** Datos de cabecera que el wizard envia al registrar el pago. */
export interface RegistrarPagoNominaInput {
  rolId: string;
  fecha: string;
  cuentaBancariaId: string;
  formaPago: FormaPagoNomina;
  referencia?: string;
  concepto: string;
}

/** Saldo de un empleado dentro de un rol: lo que se le debe y lo que ya cobro. */
export interface SaldoPagoEmpleado {
  empleadoId: string;
  neto: number;
  pagado: number;
  saldo: number;
  /** Parte del neto que corresponde a decimos y fondos mensualizados (beneficios sociales). */
  beneficios: number;
}

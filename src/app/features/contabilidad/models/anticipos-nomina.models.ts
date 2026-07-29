import { ModoAsientoAutomatico } from './contabilidad.models';

/**
 * REGISTRADO: el dinero ya se entrego y el anticipo espera al rol del periodo.
 * DESCONTADO: el rol mensual del periodo lo descontó y quedó aprobado.
 * ANULADO: se registró por error y se reversó contablemente.
 */
export type EstadoAnticipoNomina = 'REGISTRADO' | 'DESCONTADO' | 'ANULADO';

/**
 * Documento de anticipo de sueldo. Un anticipo individual es simplemente un documento con un
 * solo detalle, asi que la carga masiva y la individual comparten todo el camino de codigo.
 */
export interface AnticipoNomina {
  id?: string;
  numero: string;
  /** Periodo 'YYYY-MM' del rol en el que se descuenta. */
  periodo: string;
  /** Fecha de entrega del dinero; es la fecha del asiento. */
  fecha: string;
  /** Glosa que escribe el usuario. Baja a cada linea del asiento junto al nombre del empleado. */
  concepto: string;
  /** Cuenta del DEBE: anticipos a empleados (activo). */
  cuentaAnticipoId: string;
  /** Cuenta del HABER: caja o banco desde donde sale el dinero. */
  cuentaOrigenId: string;
  total: number;
  totalEmpleados: number;
  estado: EstadoAnticipoNomina;
  modoAsiento: ModoAsientoAutomatico;
  asientoId?: string | null;
  asientoReversionId?: string | null;
  /** Rol de pago que descontó el anticipo. */
  rolId?: string | null;
  rolNumero?: string | null;
  creadoEn?: number;
  actualizadoEn?: number;
  descontadoEn?: number | null;
  anuladoEn?: number | null;
}

export interface AnticipoNominaDetalle {
  empleadoId: string;
  empleadoNombre: string;
  cedula: string;
  cargo: string;
  /** Sueldo mensual contractual congelado al registrar, para no releer la ficha. */
  sueldoBase: number;
  /**
   * Dias del periodo que el empleado devenga, con la convencion laboral de meses de 30 dias. Un
   * empleado que ingresa el dia 10 solo devenga 21 dias, y su anticipo debe medirse contra eso.
   */
  diasTrabajadosPeriodo?: number;
  /** Sueldo proporcional a los dias del periodo: el techo real contra el que se mide el anticipo. */
  sueldoPeriodo?: number;
  monto: number;
  observacion?: string;
  rolId?: string | null;
  descontadoEn?: number | null;
}

export interface ResumenAnticipoNomina {
  anticipo: AnticipoNomina;
  detalles: AnticipoNominaDetalle[];
}

/** Datos de cabecera que el formulario envia al registrar el anticipo. */
export interface RegistrarAnticipoInput {
  periodo: string;
  fecha: string;
  concepto: string;
  cuentaAnticipoId: string;
  cuentaOrigenId: string;
}

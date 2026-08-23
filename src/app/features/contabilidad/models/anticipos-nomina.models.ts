import { ModoAsientoAutomatico } from './contabilidad.models';

/**
 * BORRADOR: propuesta editable; todavia no hubo entrega, asiento ni descuento en el rol.
 * REGISTRADO: el dinero ya se entrego y el anticipo espera al rol del periodo.
 * DESCONTADO: el rol mensual del periodo lo descontó y quedó aprobado.
 * ANULADO: se registró por error y se reversó contablemente.
 */
export type EstadoAnticipoNomina = 'BORRADOR' | 'REGISTRADO' | 'DESCONTADO' | 'ANULADO';

/** Solo el dinero efectivamente entregado puede entrar como descuento pendiente de un rol. */
export function anticipoAfectaNomina(estado: EstadoAnticipoNomina): boolean {
  return estado === 'REGISTRADO';
}

/** Totales operativos: entregados pendientes o ya descontados; nunca propuestas ni anulados. */
export function anticipoEsOperativo(estado: EstadoAnticipoNomina): boolean {
  return estado === 'REGISTRADO' || estado === 'DESCONTADO';
}

/** PDF unico que respalda la entrega de todos los empleados incluidos en el anticipo. */
export interface ComprobanteEntregaAnticipo {
  archivoId: string;
  nombre: string;
  storagePath: string;
  downloadUrl: string;
  sizeBytes: number;
  subidoEn: number;
  subidoPor?: string | null;
}

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
  /** Respaldo bancario consolidado, opcional y editable solo mientras el documento es borrador. */
  comprobanteEntrega?: ComprobanteEntregaAnticipo | null;
  /** Rol de pago que descontó el anticipo. */
  rolId?: string | null;
  rolNumero?: string | null;
  creadoEn?: number;
  actualizadoEn?: number;
  registradoEn?: number | null;
  descontadoEn?: number | null;
  anuladoEn?: number | null;
  /** Bloqueo efimero para hacer idempotente la confirmacion entre varias sesiones. */
  confirmacionToken?: string | null;
  confirmacionEn?: number | null;
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

/**
 * Cuanto vive el bloqueo efimero de confirmacion antes de darse por abandonado. Pasado ese tiempo
 * se asume que la sesion que lo tomo murio sin liberarlo (recarga, red caida, pestaña cerrada).
 */
export const BLOQUEO_CONFIRMACION_MS = 5 * 60 * 1000;

/** El token de confirmacion es `uid_timestamp_aleatorio`; solo las dos ultimas partes son fijas. */
export function uidDelTokenConfirmacion(token?: string | null): string {
  const partes = (token ?? '').split('_');
  return partes.length >= 3 ? partes.slice(0, -2).join('_') : '';
}

/**
 * Bloqueo que de verdad obliga a esperar: uno vigente y de otro usuario. Un bloqueo propio es un
 * intento anterior del mismo contador que quedo colgado, y hacerle esperar cinco minutos por su
 * propio reintento no protege nada: contra el doble asiento no cuida este bloqueo sino el indice
 * asientosOrigen, que devuelve el asiento que ya creo el intento previo.
 */
export function bloqueoConfirmacionAjeno(
  anticipo: Pick<AnticipoNomina, 'confirmacionToken' | 'confirmacionEn'>,
  uid: string,
  ahora: number
): { desdeEn: number } | null {
  if (!anticipo.confirmacionToken) {
    return null;
  }
  const desdeEn = Number(anticipo.confirmacionEn ?? 0);
  if (ahora - desdeEn >= BLOQUEO_CONFIRMACION_MS) {
    return null;
  }
  return uidDelTokenConfirmacion(anticipo.confirmacionToken) === uid ? null : { desdeEn };
}

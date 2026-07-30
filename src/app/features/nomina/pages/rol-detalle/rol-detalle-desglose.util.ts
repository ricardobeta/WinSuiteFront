import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';

/** Codigo del rubro de anticipo; tiene fila propia en el resumen y no entra en "otros descuentos". */
const CODIGO_ANTICIPO = 'ANTIC';

/** Codigo de la linea de sistema del aporte personal; tambien tiene fila propia. */
const CODIGO_IESS = 'IESS';

const DIAS_MES = 30;

/**
 * Fila de un desglose del resumen del rol. La `nota` es lo que da valor a la tabla: explica de
 * donde sale la cifra (dias trabajados, si afecta IESS, como se paga) en lugar de repetirla.
 */
export interface FilaDesglose {
  clave: string;
  etiqueta: string;
  nota: string;
  monto: number;
  /** Fila sin aporte en este periodo: se muestra en gris para que no compita con las que si suman. */
  atenuada?: boolean;
}

/**
 * Sueldo del periodo, rubros de ingreso y decimos/fondos mensualizados.
 *
 * Los mensualizados los genera `recalcularDetalle` como lineas `SISTEMA` y no aparecen en el editor
 * (que solo lista las de origen `RUBRO`), asi que este desglose es el unico lugar donde el contador
 * puede ver por que el total de ingresos no coincide con el sueldo.
 */
export function desgloseIngresos(detalle: RolPagoDetalle): FilaDesglose[] {
  return (detalle.lineas ?? [])
    .filter((linea) => linea.tipo === 'INGRESO')
    .map((linea, indice) => ({
      clave: `${linea.codigo}-${indice}`,
      etiqueta: linea.origen === 'SUELDO' ? 'Sueldo del período' : linea.nombre,
      nota: notaIngreso(linea, detalle),
      monto: redondear(linea.monto)
    }));
}

/**
 * Base del aporte personal: solo los ingresos que afectan IESS. Se muestra al cierre del desglose
 * porque es la respuesta a por que el aporte no es el porcentaje del total de ingresos.
 */
export function baseAportesIess(detalle: RolPagoDetalle): number {
  return redondear((detalle.lineas ?? [])
    .filter((linea) => linea.tipo === 'INGRESO' && linea.afectaIess)
    .reduce((total, linea) => total + linea.monto, 0));
}

/**
 * Rubros de descuento manuales. Excluye el aporte al IESS y los anticipos porque cada uno ya tiene
 * su propia fila en el resumen: incluirlos aqui los contaria dos veces.
 */
export function desgloseOtrosDescuentos(detalle: RolPagoDetalle): FilaDesglose[] {
  return (detalle.lineas ?? [])
    .filter((linea) => linea.tipo === 'DESCUENTO'
      && linea.codigo !== CODIGO_IESS
      && linea.codigo !== CODIGO_ANTICIPO)
    .map((linea, indice) => ({
      clave: `${linea.codigo}-${indice}`,
      etiqueta: linea.nombre,
      nota: linea.codigo,
      monto: redondear(linea.monto)
    }));
}

function notaIngreso(linea: RolPagoLinea, detalle: RolPagoDetalle): string {
  if (linea.origen === 'SUELDO') {
    const dias = detalle.diasTrabajadosPeriodo ?? DIAS_MES;
    return dias < DIAS_MES
      ? `${dias} de ${DIAS_MES} días · mensual ${redondear(detalle.sueldoMensual ?? 0).toFixed(2)}`
      : 'Remuneración del período';
  }
  if (linea.origen === 'SISTEMA') {
    return 'Se paga mes a mes · no afecta IESS';
  }
  return linea.afectaIess ? 'Afecta IESS' : 'No afecta IESS';
}

function redondear(valor: number): number {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';
import {
  DesgloseAportesIess,
  TasasIess,
  calcularAportesIess
} from '../../../contabilidad/services/nomina-calculos.util';

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
 * Aportes de la planilla del periodo. Los roles calculados antes de existir el CCC no traen ni la
 * base congelada ni la contribucion, asi que se rearman desde las lineas con las tasas vigentes:
 * el cuadro nunca debe salir en cero por ser un rol viejo.
 */
export function aportesIessDetalle(detalle: RolPagoDetalle, tasas: TasasIess): DesgloseAportesIess {
  if (detalle.baseImponibleIess === undefined || detalle.contribucionCcc === undefined) {
    return calcularAportesIess(baseAportesIess(detalle), tasas);
  }
  const aportePatronal = redondear(detalle.aportePatronalIess);
  const contribucionCcc = redondear(detalle.contribucionCcc);
  const aportePersonal = redondear(detalle.aportePersonalIess);
  return {
    baseImponible: redondear(detalle.baseImponibleIess),
    aportePersonal,
    aportePatronal,
    contribucionCcc,
    costoPatronal: redondear(aportePatronal + contribucionCcc),
    totalPlanilla: redondear(aportePersonal + aportePatronal + contribucionCcc)
  };
}

/**
 * Cuadro de referencia de la planilla: base imponible y los tres conceptos que se transfieren al
 * IESS. Solo el aporte personal se descuenta al trabajador; el patronal y el CCC son costo del
 * empleador y aparecen aqui para poder cuadrar contra la planilla antes de pagarla.
 */
export function desgloseIess(detalle: RolPagoDetalle, tasas: TasasIess): FilaDesglose[] {
  const aportes = aportesIessDetalle(detalle, tasas);
  return [
    {
      clave: 'BASE',
      etiqueta: 'Base imponible',
      nota: 'Ingresos que afectan IESS',
      monto: aportes.baseImponible
    },
    {
      clave: 'PERSONAL',
      etiqueta: 'Aporte personal',
      nota: `${formatearTasa(tasas.personal)} · se descuenta al trabajador`,
      monto: aportes.aportePersonal
    },
    {
      clave: 'PATRONAL',
      etiqueta: 'Aporte patronal',
      nota: `${formatearTasa(tasas.patronal)} · costo del empleador`,
      monto: aportes.aportePatronal
    },
    {
      clave: 'CCC',
      etiqueta: 'Contribución CCC',
      nota: `${formatearTasa(tasas.ccc)} · costo del empleador`,
      monto: aportes.contribucionCcc,
      atenuada: aportes.contribucionCcc === 0
    }
  ];
}

/** Quita los ceros de relleno para que 9.4500 se lea 9.45% y 1.0000 se lea 1%. */
function formatearTasa(tasa: number): string {
  return `${Number((Number(tasa) || 0).toFixed(4))}%`;
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

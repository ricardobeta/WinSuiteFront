import { RegimenFondosReserva } from '../models/nomina.models';

export const DIAS_LABORALES_MES = 30;

/**
 * Contribución al Fomento de Capacidades y Conocimientos Ciudadanos: 1% sobre la misma base
 * imponible del aporte, a cargo del empleador, que el IESS recauda como agente de retención en la
 * planilla de aportes. Solo es el valor inicial de la configuración; el cálculo usa la tasa que el
 * contador tenga guardada.
 */
export const PORCENTAJE_CCC_DEFECTO = 1;

/** Tasas vigentes de la planilla, en porcentaje (9.45 significa 9.45%). */
export interface TasasIess {
  personal: number;
  patronal: number;
  ccc: number;
}

export interface DesgloseAportesIess {
  baseImponible: number;
  /** Único concepto que se descuenta al trabajador. */
  aportePersonal: number;
  aportePatronal: number;
  contribucionCcc: number;
  /** Patronal + CCC: lo que el aporte le cuesta al empleador. */
  costoPatronal: number;
  /** Personal + patronal + CCC: lo que se transfiere al IESS. */
  totalPlanilla: number;
}

export interface ParametrosBeneficiosLegales {
  baseRemuneracion: number;
  salarioBasicoUnificado: number;
  diasTrabajados: number;
  diasFondosReserva: number;
  calcularDecimoTercero: boolean;
  calcularDecimoCuarto: boolean;
  calcularFondosReserva: boolean;
  calcularVacaciones: boolean;
}

export interface DevengadosLegales {
  decimoTercero: number;
  decimoCuarto: number;
  fondosReserva: number;
  vacaciones: number;
}

/**
 * Convención laboral de 30 días: el ingreso se cuenta de forma inclusiva y un día calendario 31
 * se trata como día 30. Las fechas anteriores al período reciben el mes completo.
 */
export function calcularDiasTrabajadosPeriodo(
  fechaIngreso: string | undefined,
  periodo: string
): number {
  if (!fechaIngreso) {
    return DIAS_LABORALES_MES;
  }
  const mesIngreso = fechaIngreso.slice(0, 7);
  if (mesIngreso > periodo) {
    return 0;
  }
  if (mesIngreso < periodo) {
    return DIAS_LABORALES_MES;
  }
  const diaIngreso = limitarDiaLaboral(Number(fechaIngreso.slice(8, 10)) || 1);
  return DIAS_LABORALES_MES - diaIngreso + 1;
}

/**
 * Calcula los días que causan fondos dentro del período. En construcción y servicios
 * complementarios coinciden con todos los días trabajados; en régimen general empiezan al iniciar
 * el segundo año de la relación laboral.
 */
export function calcularDiasFondosReservaPeriodo(
  fechaIngreso: string | undefined,
  periodo: string,
  regimen: RegimenFondosReserva
): number {
  const diasTrabajados = calcularDiasTrabajadosPeriodo(fechaIngreso, periodo);
  if (diasTrabajados === 0 || !fechaIngreso) {
    return 0;
  }
  if (regimen === 'CONSTRUCCION' || regimen === 'SERVICIOS_COMPLEMENTARIOS') {
    return diasTrabajados;
  }

  const anio = Number(fechaIngreso.slice(0, 4));
  const mes = Number(fechaIngreso.slice(5, 7));
  const dia = limitarDiaLaboral(Number(fechaIngreso.slice(8, 10)) || 1);
  if (!anio || !mes) {
    return 0;
  }

  const inicioDerecho = new Date(anio + 1, mes - 1, dia);
  const periodoDerecho = `${inicioDerecho.getFullYear()}-${String(inicioDerecho.getMonth() + 1).padStart(2, '0')}`;
  if (periodo < periodoDerecho) {
    return 0;
  }
  if (periodo > periodoDerecho) {
    return diasTrabajados;
  }

  const diasDesdeDerecho = DIAS_LABORALES_MES - limitarDiaLaboral(inicioDerecho.getDate()) + 1;
  return Math.min(diasTrabajados, diasDesdeDerecho);
}

export function calcularProporcionalMensual(valorMensual: number, dias: number): number {
  const diasValidos = Math.max(0, Math.min(DIAS_LABORALES_MES, Number(dias) || 0));
  return redondearDos(Number(valorMensual || 0) * (diasValidos / DIAS_LABORALES_MES));
}

export function calcularDevengadosLegales(
  parametros: ParametrosBeneficiosLegales
): DevengadosLegales {
  const diasTrabajados = Math.max(
    0,
    Math.min(DIAS_LABORALES_MES, Number(parametros.diasTrabajados) || 0)
  );
  const diasFondosReserva = Math.max(
    0,
    Math.min(diasTrabajados, Number(parametros.diasFondosReserva) || 0)
  );
  const baseRemuneracion = redondearDos(parametros.baseRemuneracion);
  const baseFondosReserva = diasTrabajados > 0
    ? redondearDos(baseRemuneracion * (diasFondosReserva / diasTrabajados))
    : 0;

  return {
    decimoTercero: parametros.calcularDecimoTercero
      ? redondearDos(baseRemuneracion / 12)
      : 0,
    decimoCuarto: parametros.calcularDecimoCuarto && parametros.salarioBasicoUnificado > 0
      ? redondearDos(
        (Number(parametros.salarioBasicoUnificado) / 12)
        * (diasTrabajados / DIAS_LABORALES_MES)
      )
      : 0,
    fondosReserva: parametros.calcularFondosReserva && diasFondosReserva > 0
      ? redondearDos(baseFondosReserva / 12)
      : 0,
    vacaciones: parametros.calcularVacaciones
      ? redondearDos(baseRemuneracion / 24)
      : 0
  };
}

/**
 * Corta a dos decimales sin redondear: 3.5977 vale 3.59, no 3.60. Es el trato que el IESS le da al
 * CCC, a diferencia de los aportes, que sí redondea.
 *
 * La tolerancia corrige el error del binario: un producto cuyo valor exacto es 3.60 puede quedar
 * almacenado como 3.5999999999999996 y truncarse a 3.59. Es demasiado pequeña para alterar un
 * truncado legítimo (3.5977 sigue siendo 3.59). Asume valores no negativos, como todos los aportes.
 */
export function truncarDos(valor: number): number {
  return Math.trunc((Number(valor) || 0) * 100 + 1e-6) / 100;
}

/**
 * Aportes de la planilla sobre la base imponible del período.
 *
 * Los dos aportes se redondean y el CCC se trunca, que es como aparecen en la planilla real: con una
 * base de 359.77 el aporte personal sale 33.998265 y el IESS cobra 34.00, mientras que el CCC sale
 * 3.5977 y cobra 3.59.
 *
 * Cada concepto se resuelve por separado y el total es la suma de los tres ya ajustados; calcular el
 * total sobre la base y ajustarlo al final daría otro centavo. El aporte patronal y el CCC no se
 * descuentan al trabajador, son costo del empleador.
 */
export function calcularAportesIess(baseImponible: number, tasas: TasasIess): DesgloseAportesIess {
  const base = Math.max(0, redondearDos(baseImponible));
  const aportePersonal = redondearAporte(base * (Number(tasas.personal) || 0) / 100);
  const aportePatronal = redondearAporte(base * (Number(tasas.patronal) || 0) / 100);
  const contribucionCcc = truncarDos(base * (Number(tasas.ccc) || 0) / 100);

  return {
    baseImponible: base,
    aportePersonal,
    aportePatronal,
    contribucionCcc,
    costoPatronal: redondearDos(aportePatronal + contribucionCcc),
    totalPlanilla: redondearDos(aportePersonal + aportePatronal + contribucionCcc)
  };
}

/**
 * Redondeo del aporte con la misma tolerancia que el truncado. Sin ella el medio centavo queda a
 * merced del binario: 63.315 se almacena por debajo y caería a 63.31, mientras que 74.705 sube a
 * 74.71. Con la tolerancia el medio centavo siempre sube, que es lo que espera el contador.
 */
function redondearAporte(valor: number): number {
  return Math.round((Number(valor) || 0) * 100 + 1e-6) / 100;
}

function limitarDiaLaboral(dia: number): number {
  return Math.max(1, Math.min(DIAS_LABORALES_MES, dia));
}

function redondearDos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

import { RegimenFondosReserva } from '../models/nomina.models';

export const DIAS_LABORALES_MES = 30;

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

function limitarDiaLaboral(dia: number): number {
  return Math.max(1, Math.min(DIAS_LABORALES_MES, dia));
}

function redondearDos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

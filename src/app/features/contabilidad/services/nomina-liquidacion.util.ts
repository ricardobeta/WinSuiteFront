import {
  CausalTerminacionNomina,
  MotivoSalidaNomina,
  RegimenFondosReserva
} from '../models/nomina.models';

export interface ReglaCausalLiquidacion {
  desahucio: boolean;
  indemnizacionDespido: boolean;
}

export interface IndemnizacionesLiquidacion {
  aniosCompletos: number;
  aniosParaDespido: number;
  bonificacionDesahucio: number;
  indemnizacionDespido: number;
}

export const CAUSALES_TERMINACION_NOMINA: ReadonlyArray<{
  codigo: CausalTerminacionNomina;
  nombre: string;
}> = [
  { codigo: 'CAUSAS_CONTRATO', nombre: 'Causas previstas en el contrato' },
  { codigo: 'MUTUO_ACUERDO', nombre: 'Mutuo acuerdo' },
  { codigo: 'FIN_OBRA_PERIODO_SERVICIO', nombre: 'Conclusion de obra, periodo o servicio' },
  { codigo: 'MUERTE_INCAPACIDAD_EMPLEADOR', nombre: 'Muerte o incapacidad del empleador / extincion juridica' },
  { codigo: 'MUERTE_INCAPACIDAD_TRABAJADOR', nombre: 'Muerte o incapacidad permanente del trabajador' },
  { codigo: 'FUERZA_MAYOR', nombre: 'Caso fortuito o fuerza mayor' },
  { codigo: 'VISTO_BUENO_EMPLEADOR', nombre: 'Visto bueno solicitado por el empleador' },
  { codigo: 'VISTO_BUENO_TRABAJADOR', nombre: 'Visto bueno solicitado por el trabajador' },
  { codigo: 'DESAHUCIO_TRABAJADOR', nombre: 'Desahucio presentado por el trabajador' },
  { codigo: 'DESPIDO_INTEMPESTIVO', nombre: 'Despido intempestivo' },
  { codigo: 'LIQUIDACION_NEGOCIO_CON_AVISO', nombre: 'Liquidacion del negocio con aviso' },
  { codigo: 'LIQUIDACION_NEGOCIO_SIN_AVISO', nombre: 'Liquidacion del negocio sin aviso' }
];

const REGLAS_CAUSAL: Record<CausalTerminacionNomina, ReglaCausalLiquidacion> = {
  CAUSAS_CONTRATO: { desahucio: false, indemnizacionDespido: false },
  MUTUO_ACUERDO: { desahucio: true, indemnizacionDespido: false },
  FIN_OBRA_PERIODO_SERVICIO: { desahucio: false, indemnizacionDespido: false },
  MUERTE_INCAPACIDAD_EMPLEADOR: { desahucio: false, indemnizacionDespido: false },
  MUERTE_INCAPACIDAD_TRABAJADOR: { desahucio: false, indemnizacionDespido: false },
  FUERZA_MAYOR: { desahucio: false, indemnizacionDespido: false },
  VISTO_BUENO_EMPLEADOR: { desahucio: false, indemnizacionDespido: false },
  VISTO_BUENO_TRABAJADOR: { desahucio: true, indemnizacionDespido: true },
  DESAHUCIO_TRABAJADOR: { desahucio: true, indemnizacionDespido: false },
  DESPIDO_INTEMPESTIVO: { desahucio: true, indemnizacionDespido: true },
  LIQUIDACION_NEGOCIO_CON_AVISO: { desahucio: true, indemnizacionDespido: false },
  LIQUIDACION_NEGOCIO_SIN_AVISO: { desahucio: true, indemnizacionDespido: true }
};

export function normalizarCausalTerminacion(motivo: MotivoSalidaNomina): CausalTerminacionNomina {
  if (motivo === 'RENUNCIA' || motivo === 'DESAHUCIO') return 'DESAHUCIO_TRABAJADOR';
  if (motivo === 'FIN_CONTRATO') return 'FIN_OBRA_PERIODO_SERVICIO';
  return motivo;
}

export function reglaCausalLiquidacion(causal: CausalTerminacionNomina): ReglaCausalLiquidacion {
  return REGLAS_CAUSAL[causal];
}

/** Convencion laboral de mes de 30 dias, con ingreso y salida incluidos. */
export function calcularDiasTrabajadosHastaSalida(
  fechaIngreso: string,
  fechaSalida: string
): number {
  const periodo = fechaSalida.slice(0, 7);
  if (!periodo || fechaIngreso > fechaSalida) return 0;
  if (fechaIngreso.slice(0, 7) > periodo) return 0;
  const diaSalida = limitarDia(Number(fechaSalida.slice(8, 10)) || 1);
  const diaIngreso = fechaIngreso.slice(0, 7) === periodo
    ? limitarDia(Number(fechaIngreso.slice(8, 10)) || 1)
    : 1;
  return Math.max(0, diaSalida - diaIngreso + 1);
}

export function calcularDiasFondosReservaHastaSalida(
  fechaIngreso: string,
  fechaSalida: string,
  regimen: RegimenFondosReserva
): number {
  const diasTrabajados = calcularDiasTrabajadosHastaSalida(fechaIngreso, fechaSalida);
  if (diasTrabajados === 0) return 0;
  if (regimen === 'CONSTRUCCION' || regimen === 'SERVICIOS_COMPLEMENTARIOS') return diasTrabajados;

  const ingreso = fechaUtc(fechaIngreso);
  const inicioDerecho = new Date(Date.UTC(
    ingreso.getUTCFullYear() + 1,
    ingreso.getUTCMonth(),
    ingreso.getUTCDate()
  ));
  const salida = fechaUtc(fechaSalida);
  if (inicioDerecho > salida) return 0;
  const periodoSalida = fechaSalida.slice(0, 7);
  const periodoDerecho = inicioDerecho.toISOString().slice(0, 7);
  if (periodoDerecho < periodoSalida) return diasTrabajados;
  const diaInicio = limitarDia(inicioDerecho.getUTCDate());
  const diaSalida = limitarDia(salida.getUTCDate());
  return Math.max(0, diaSalida - diaInicio + 1);
}

export function calcularIndemnizacionesLiquidacion(
  fechaIngreso: string,
  fechaSalida: string,
  ultimaRemuneracion: number,
  causal: CausalTerminacionNomina
): IndemnizacionesLiquidacion {
  const ingreso = fechaUtc(fechaIngreso);
  const salida = fechaUtc(fechaSalida);
  const aniosExactos = Math.max(0, (salida.getTime() - ingreso.getTime()) / (365.2425 * 86400000));
  const aniosCompletos = Math.floor(aniosExactos + 1e-9);
  const aniosParaDespido = aniosExactos > 0 ? Math.ceil(aniosExactos - 1e-9) : 0;
  const regla = reglaCausalLiquidacion(causal);
  const remuneracion = Math.max(0, Number(ultimaRemuneracion) || 0);

  const bonificacionDesahucio = regla.desahucio && aniosCompletos >= 1
    ? redondear(remuneracion * 0.25 * aniosCompletos)
    : 0;
  const mesesIndemnizacion = regla.indemnizacionDespido
    ? (aniosParaDespido <= 3 ? 3 : Math.min(25, aniosParaDespido))
    : 0;

  return {
    aniosCompletos,
    aniosParaDespido,
    bonificacionDesahucio,
    indemnizacionDespido: redondear(remuneracion * mesesIndemnizacion)
  };
}

function fechaUtc(value: string): Date {
  const [anio, mes, dia] = value.split('-').map(Number);
  return new Date(Date.UTC(anio || 1970, Math.max(0, (mes || 1) - 1), dia || 1));
}

function limitarDia(dia: number): number {
  return Math.max(1, Math.min(30, dia));
}

function redondear(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

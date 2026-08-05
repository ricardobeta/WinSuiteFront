import { describe, expect, it } from 'vitest';

import {
  CAUSALES_TERMINACION_NOMINA,
  calcularDiasFondosReservaHastaSalida,
  calcularDiasTrabajadosHastaSalida,
  calcularIndemnizacionesLiquidacion,
  normalizarCausalTerminacion,
  reglaCausalLiquidacion
} from './nomina-liquidacion.util';

describe('nomina-liquidacion.util', () => {
  it('calcula 15 dias y medio sueldo para una salida el 15 de agosto', () => {
    const dias = calcularDiasTrabajadosHastaSalida('2020-03-10', '2026-08-15');
    expect(dias).toBe(15);
    expect(600 * dias / 30).toBe(300);
  });

  it('limita el dia 31 y respeta ingreso y salida en el mismo mes', () => {
    expect(calcularDiasTrabajadosHastaSalida('2026-08-10', '2026-08-15')).toBe(6);
    expect(calcularDiasTrabajadosHastaSalida('2020-01-01', '2026-08-31')).toBe(30);
  });

  it('calcula fondos solo desde el aniversario para regimen general', () => {
    expect(calcularDiasFondosReservaHastaSalida('2025-08-10', '2026-08-15', 'GENERAL')).toBe(6);
    expect(calcularDiasFondosReservaHastaSalida('2026-08-10', '2026-08-15', 'CONSTRUCCION')).toBe(6);
  });

  it('aplica fraccion anual y tope para despido, pero anos completos para desahucio', () => {
    const calculo = calcularIndemnizacionesLiquidacion('2020-01-10', '2023-02-01', 700, 'DESPIDO_INTEMPESTIVO');
    expect(calculo.aniosCompletos).toBe(3);
    expect(calculo.aniosParaDespido).toBe(4);
    expect(calculo.bonificacionDesahucio).toBe(525);
    expect(calculo.indemnizacionDespido).toBe(2800);

    const tope = calcularIndemnizacionesLiquidacion('1990-01-01', '2026-08-15', 500, 'DESPIDO_INTEMPESTIVO');
    expect(tope.indemnizacionDespido).toBe(12500);
  });

  it('normaliza historicos y asigna reglas por causal', () => {
    expect(normalizarCausalTerminacion('RENUNCIA')).toBe('DESAHUCIO_TRABAJADOR');
    expect(normalizarCausalTerminacion('FIN_CONTRATO')).toBe('FIN_OBRA_PERIODO_SERVICIO');
    expect(reglaCausalLiquidacion('VISTO_BUENO_TRABAJADOR')).toEqual({ desahucio: true, indemnizacionDespido: true });
    expect(reglaCausalLiquidacion('VISTO_BUENO_EMPLEADOR')).toEqual({ desahucio: false, indemnizacionDespido: false });
  });

  it('mantiene el catalogo versionado completo y las causales indemnizatorias esperadas', () => {
    expect(CAUSALES_TERMINACION_NOMINA).toHaveLength(12);
    const indemnizatorias = CAUSALES_TERMINACION_NOMINA
      .filter((causal) => reglaCausalLiquidacion(causal.codigo).indemnizacionDespido)
      .map((causal) => causal.codigo);
    expect(indemnizatorias).toEqual([
      'VISTO_BUENO_TRABAJADOR',
      'DESPIDO_INTEMPESTIVO',
      'LIQUIDACION_NEGOCIO_SIN_AVISO'
    ]);
  });
});

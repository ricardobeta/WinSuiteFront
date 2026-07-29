import { describe, expect, it } from 'vitest';

import {
  calcularDiasFondosReservaPeriodo,
  calcularDiasTrabajadosPeriodo,
  calcularDevengadosLegales,
  calcularProporcionalMensual
} from './nomina-calculos.util';

describe('cálculos proporcionales de nómina', () => {
  it('reconoce 16 de 30 días cuando el empleado ingresa el día 15', () => {
    expect(calcularDiasTrabajadosPeriodo('2026-07-15', '2026-07')).toBe(16);
    expect(calcularProporcionalMensual(600, 16)).toBe(320);
  });

  it('excluye ingresos posteriores al período y reconoce meses previos completos', () => {
    expect(calcularDiasTrabajadosPeriodo('2026-08-01', '2026-07')).toBe(0);
    expect(calcularDiasTrabajadosPeriodo('2026-06-30', '2026-07')).toBe(30);
  });

  it('trata el día calendario 31 como el día laboral 30', () => {
    expect(calcularDiasTrabajadosPeriodo('2026-07-31', '2026-07')).toBe(1);
  });

  it('causa fondos de construcción desde el primer día trabajado', () => {
    expect(calcularDiasFondosReservaPeriodo('2026-07-15', '2026-07', 'CONSTRUCCION')).toBe(16);
    expect(calcularDiasFondosReservaPeriodo('2026-07-15', '2026-07', 'GENERAL')).toBe(0);
  });

  it('causa fondos de servicios complementarios desde el primer día trabajado', () => {
    expect(calcularDiasFondosReservaPeriodo('2026-07-15', '2026-07', 'SERVICIOS_COMPLEMENTARIOS')).toBe(16);
  });

  it('causa fondos generales proporcionalmente desde el primer aniversario', () => {
    expect(calcularDiasFondosReservaPeriodo('2025-07-15', '2026-06', 'GENERAL')).toBe(0);
    expect(calcularDiasFondosReservaPeriodo('2025-07-15', '2026-07', 'GENERAL')).toBe(16);
    expect(calcularDiasFondosReservaPeriodo('2025-07-15', '2026-08', 'GENERAL')).toBe(30);
  });

  it('prorratea décimos, fondos y vacaciones sobre los días del primer mes', () => {
    const devengados = calcularDevengadosLegales({
      baseRemuneracion: 320,
      salarioBasicoUnificado: 480,
      diasTrabajados: 16,
      diasFondosReserva: 16,
      calcularDecimoTercero: true,
      calcularDecimoCuarto: true,
      calcularFondosReserva: true,
      calcularVacaciones: true
    });

    expect(devengados).toEqual({
      decimoTercero: 26.67,
      decimoCuarto: 21.33,
      fondosReserva: 26.67,
      vacaciones: 13.33
    });
  });

  it('prorratea fondos generales cuando el derecho nace a mitad de un mes completo', () => {
    const devengados = calcularDevengadosLegales({
      baseRemuneracion: 600,
      salarioBasicoUnificado: 480,
      diasTrabajados: 30,
      diasFondosReserva: 16,
      calcularDecimoTercero: false,
      calcularDecimoCuarto: false,
      calcularFondosReserva: true,
      calcularVacaciones: false
    });

    expect(devengados.fondosReserva).toBe(26.67);
  });
});

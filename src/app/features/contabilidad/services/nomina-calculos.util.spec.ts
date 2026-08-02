import { describe, expect, it } from 'vitest';

import {
  calcularAportesIess,
  calcularDiasFondosReservaPeriodo,
  calcularDiasTrabajadosPeriodo,
  calcularDevengadosLegales,
  calcularProporcionalMensual,
  truncarDos
} from './nomina-calculos.util';

/** Tasas vigentes del régimen general privado. */
const TASAS = { personal: 9.45, patronal: 11.15, ccc: 1 };

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

describe('truncado del CCC', () => {
  it('corta el tercer decimal en lugar de redondearlo', () => {
    expect(truncarDos(3.5977)).toBe(3.59);
    expect(truncarDos(3.4477)).toBe(3.44);
    expect(truncarDos(3.5999)).toBe(3.59);
  });

  it('no baja un centavo por el error binario del flotante', () => {
    // 4.35 se almacena como 4.3499999999999996: sin la tolerancia se truncaría a 4.34.
    expect(truncarDos(4.35)).toBe(4.35);
    expect(truncarDos(0.07 * 100)).toBe(7);
  });

  it('deja intactos los valores que ya tienen dos decimales o menos', () => {
    expect(truncarDos(0)).toBe(0);
    expect(truncarDos(9.45)).toBe(9.45);
    expect(truncarDos(600)).toBe(600);
  });
});

describe('aportes IESS', () => {
  it('redondea los aportes y trunca el CCC, como la planilla real', () => {
    // Caso tomado de una planilla: con base 359.77 el personal sale 33.998265 y el IESS cobra 34.00,
    // mientras que el CCC sale 3.5977 y cobra 3.59.
    const aportes = calcularAportesIess(359.77, TASAS);

    expect(aportes.aportePersonal).toBe(34);
    expect(aportes.aportePatronal).toBe(40.11);
    expect(aportes.contribucionCcc).toBe(3.59);
    expect(aportes.totalPlanilla).toBe(77.7);
  });

  it('sube el medio centavo aunque el binario lo guarde por debajo', () => {
    // 670 * 9.45% = 63.315, que se almacena como 63.31499...: sin tolerancia caería a 63.31.
    const aportes = calcularAportesIess(670, TASAS);

    expect(aportes.aportePersonal).toBe(63.32);
    expect(aportes.aportePatronal).toBe(74.71); // 74.705
    expect(aportes.contribucionCcc).toBe(6.7);
  });

  it('el total es la suma de los conceptos ya ajustados, no un calculo aparte', () => {
    const aportes = calcularAportesIess(344.77, TASAS);

    expect(aportes.contribucionCcc).toBe(3.44); // 3.4477 truncado
    expect(aportes.totalPlanilla).toBe(
      aportes.aportePersonal + aportes.aportePatronal + aportes.contribucionCcc
    );
  });

  it('separa el costo del empleador del descuento al trabajador', () => {
    const aportes = calcularAportesIess(1000, TASAS);

    expect(aportes.aportePersonal).toBe(94.5);
    expect(aportes.costoPatronal).toBe(121.5); // 111.50 patronal + 10.00 CCC
    expect(aportes.totalPlanilla).toBe(216);
  });

  it('devuelve ceros con base cero o negativa en lugar de propagar el signo', () => {
    expect(calcularAportesIess(0, TASAS).totalPlanilla).toBe(0);
    expect(calcularAportesIess(-50, TASAS)).toMatchObject({ baseImponible: 0, totalPlanilla: 0 });
  });

  it('respeta las tasas configuradas y tolera un CCC en cero', () => {
    const aportes = calcularAportesIess(670, { personal: 9.45, patronal: 11.15, ccc: 0 });

    expect(aportes.contribucionCcc).toBe(0);
    expect(aportes.costoPatronal).toBe(74.71);
  });
});

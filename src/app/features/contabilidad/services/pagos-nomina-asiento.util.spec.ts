import { describe, expect, it } from 'vitest';

import { ConfiguracionNominaContable } from '../models/nomina.models';
import { PagoNominaDetalle } from '../models/pagos-nomina.models';
import {
  construirPartidasPagoRol,
  cuentaPasivoPorTipoRol,
  repartirMontoPago
} from './pagos-nomina-asiento.util';

const config: ConfiguracionNominaContable = {
  modoAsiento: 'BORRADOR',
  porcentajeAportePersonalIess: 9.45,
  porcentajeAportePatronalIess: 11.15,
  porcentajeContribucionCcc: 1,
  salarioBasicoUnificado: 470,
  region: 'SIERRA',
  modoDecimos: 'ACUMULADO',
  provisionarDecimoTercero: true,
  provisionarDecimoCuarto: true,
  provisionarFondosReserva: true,
  provisionarVacaciones: true,
  cuentaGastoSueldosId: 'gasto-otros',
  cuentaGastoBeneficiosSocialesId: 'gasto-beneficios-legado',
  cuentaGastoDecimoTerceroId: 'gasto-d13',
  cuentaGastoDecimoCuartoId: 'gasto-d14',
  cuentaGastoFondosReservaId: 'gasto-fondos',
  cuentaGastoVacacionesId: 'gasto-vacaciones',
  cuentaGastoAportePatronalId: 'gasto-patronal',
  cuentaGastoDesahucioId: 'gasto-desahucio',
  cuentaGastoIndemnizacionId: 'gasto-indemnizacion',
  cuentaSueldosPorPagarId: 'pasivo-sueldos',
  cuentaIessPorPagarId: 'pasivo-iess',
  cuentaBeneficiosSocialesPorPagarId: 'pasivo-beneficios',
  cuentaAnticiposEmpleadosId: 'activo-anticipos',
  cuentaPrestamosEmpleadosId: 'activo-prestamos',
  cuentaDecimosPorPagarId: 'pasivo-decimos-legado',
  cuentaDecimoTerceroPorPagarId: 'pasivo-d13',
  cuentaDecimoCuartoPorPagarId: 'pasivo-d14',
  cuentaFondosReservaPorPagarId: 'pasivo-fondos',
  cuentaVacacionesPorPagarId: 'pasivo-vacaciones',
  cuentaUtilidadesPorPagarId: 'pasivo-utilidades',
  cuentaLiquidacionesPorPagarId: 'pasivo-liquidaciones',
  camposPersonalizados: []
};

function detalle(overrides: Partial<PagoNominaDetalle>): PagoNominaDetalle {
  const base: PagoNominaDetalle = {
    empleadoId: 'empleado',
    empleadoNombre: 'Perez Juan',
    cargo: 'Maestro',
    netoRol: 0,
    pagadoAntes: 0,
    monto: 0,
    montoSueldos: 0,
    montoBeneficios: 0
  };
  return { ...base, ...overrides };
}

const totalDebe = (partidas: { debe: number }[]) => partidas.reduce((total, item) => total + item.debe, 0);
const totalHaber = (partidas: { haber: number }[]) => partidas.reduce((total, item) => total + item.haber, 0);

describe('cuentaPasivoPorTipoRol', () => {
  it('descarga cada tipo de rol en la cuenta que su asiento de aprobacion acredito', () => {
    expect(cuentaPasivoPorTipoRol('MENSUAL', config)).toBe('pasivo-sueldos');
    expect(cuentaPasivoPorTipoRol('DECIMO_TERCERO', config)).toBe('pasivo-sueldos');
    expect(cuentaPasivoPorTipoRol('DECIMO_CUARTO', config)).toBe('pasivo-sueldos');
    expect(cuentaPasivoPorTipoRol('UTILIDADES', config)).toBe('pasivo-utilidades');
    expect(cuentaPasivoPorTipoRol('LIQUIDACION', config)).toBe('pasivo-liquidaciones');
  });
});

describe('repartirMontoPago', () => {
  it('reparte el pago total en la proporcion devengada', () => {
    expect(repartirMontoPago(1000, 1000, 140)).toEqual({ montoSueldos: 860, montoBeneficios: 140 });
  });

  it('prorratea el parcial y deja el residuo del redondeo en sueldos', () => {
    const reparto = repartirMontoPago(333.33, 1000, 140);
    expect(reparto.montoBeneficios).toBe(46.67);
    expect(reparto.montoSueldos).toBe(286.66);
    expect(reparto.montoSueldos + reparto.montoBeneficios).toBeCloseTo(333.33, 2);
  });

  it('manda todo a sueldos cuando el empleado no tiene beneficios mensualizados', () => {
    expect(repartirMontoPago(500, 500, 0)).toEqual({ montoSueldos: 500, montoBeneficios: 0 });
  });

  it('nunca asigna a beneficios mas de lo que se paga', () => {
    const reparto = repartirMontoPago(50, 100, 100);
    expect(reparto.montoBeneficios).toBeLessThanOrEqual(50);
    expect(reparto.montoSueldos + reparto.montoBeneficios).toBeCloseTo(50, 2);
  });
});

describe('construirPartidasPagoRol', () => {
  it('emite un bloque independiente por empleado y separa los beneficios mensualizados', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [
        detalle({ empleadoId: 'a', empleadoNombre: 'Perez Juan', netoRol: 1000, monto: 1000, montoSueldos: 860, montoBeneficios: 140 }),
        detalle({ empleadoId: 'b', empleadoNombre: 'Lopez Ana', netoRol: 700, monto: 700, montoSueldos: 700, montoBeneficios: 0 }),
        detalle({ empleadoId: 'c', empleadoNombre: 'Vera Luis', netoRol: 500, monto: 500, montoSueldos: 500, montoBeneficios: 0 })
      ],
      config,
      'banco-pichincha',
      'Pago rol NOM-2026-00001'
    );

    // Juan aporta 3 filas (tiene beneficios); Ana y Luis, 2 cada uno.
    expect(partidas).toHaveLength(7);
    expect(partidas.slice(0, 3)).toEqual([
      { cuentaId: 'pasivo-sueldos', descripcion: 'Pago rol NOM-2026-00001 - Perez Juan', debe: 860, haber: 0 },
      { cuentaId: 'pasivo-beneficios', descripcion: 'Pago rol NOM-2026-00001 - Perez Juan (beneficios)', debe: 140, haber: 0 },
      { cuentaId: 'banco-pichincha', descripcion: 'Pago rol NOM-2026-00001 - Perez Juan', debe: 0, haber: 1000 }
    ]);
    expect(partidas.filter((partida) => partida.cuentaId === 'banco-pichincha')).toHaveLength(3);
    expect(totalDebe(partidas)).toBeCloseTo(totalHaber(partidas), 2);
    expect(totalHaber(partidas)).toBeCloseTo(2200, 2);
  });

  it('lleva la referencia de pago de cada empleado a todas sus lineas', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [
        detalle({ empleadoId: 'a', empleadoNombre: 'Perez Juan', monto: 1000, montoSueldos: 860, montoBeneficios: 140, referenciaPago: 'TRF-8891' }),
        detalle({ empleadoId: 'b', empleadoNombre: 'Lopez Ana', monto: 700, montoSueldos: 700, referenciaPago: 'CHQ-0042' })
      ],
      config,
      'banco-pichincha',
      'Pago rol NOM-2026-00001'
    );

    expect(partidas.map((partida) => partida.descripcion)).toEqual([
      'Pago rol NOM-2026-00001 - Perez Juan · Ref TRF-8891',
      'Pago rol NOM-2026-00001 - Perez Juan (beneficios) · Ref TRF-8891',
      'Pago rol NOM-2026-00001 - Perez Juan · Ref TRF-8891',
      'Pago rol NOM-2026-00001 - Lopez Ana · Ref CHQ-0042',
      'Pago rol NOM-2026-00001 - Lopez Ana · Ref CHQ-0042'
    ]);
  });

  it('omite el sufijo de referencia cuando el empleado no la tiene', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [detalle({ monto: 500, montoSueldos: 500, referenciaPago: '   ' })],
      config,
      'banco-pichincha',
      'Pago rol'
    );

    expect(partidas.every((partida) => partida.descripcion === 'Pago rol - Perez Juan')).toBe(true);
  });

  it('concentra los tipos distintos al mensual en un solo pasivo', () => {
    const partidas = construirPartidasPagoRol(
      'DECIMO_TERCERO',
      [detalle({ netoRol: 400, monto: 400, montoSueldos: 400 })],
      config,
      'banco-pichincha',
      'Pago decimo tercero'
    );

    expect(partidas).toEqual([
      { cuentaId: 'pasivo-sueldos', descripcion: 'Pago decimo tercero - Perez Juan', debe: 400, haber: 0 },
      { cuentaId: 'banco-pichincha', descripcion: 'Pago decimo tercero - Perez Juan', debe: 0, haber: 400 }
    ]);
  });

  it('mantiene el bloque cuadrado aunque el desglose llegue inconsistente', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [detalle({ netoRol: 1000, monto: 600, montoSueldos: 900, montoBeneficios: 140 })],
      config,
      'banco-pichincha',
      'Pago parcial'
    );

    expect(totalDebe(partidas)).toBeCloseTo(600, 2);
    expect(totalHaber(partidas)).toBeCloseTo(600, 2);
  });

  it('deja la fila sin cuenta cuando falta la del banco o la de beneficios', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [detalle({ monto: 1000, montoSueldos: 860, montoBeneficios: 140 })],
      { ...config, cuentaBeneficiosSocialesPorPagarId: '' },
      '',
      'Pago rol'
    );

    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: '', debe: 140 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: '', haber: 1000 }));
    expect(totalDebe(partidas)).toBeCloseTo(totalHaber(partidas), 2);
  });

  it('omite a los empleados sin monto en lugar de emitir filas en cero', () => {
    const partidas = construirPartidasPagoRol(
      'MENSUAL',
      [
        detalle({ empleadoId: 'a', monto: 500, montoSueldos: 500 }),
        detalle({ empleadoId: 'b', empleadoNombre: 'Sin pago', monto: 0 })
      ],
      config,
      'banco-pichincha',
      'Pago rol'
    );

    expect(partidas).toHaveLength(2);
    expect(partidas.every((partida) => partida.debe > 0 || partida.haber > 0)).toBe(true);
  });
});

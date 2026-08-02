import { describe, expect, it } from 'vitest';

import { ConfiguracionNominaContable, RolPagoDetalle, RolPagoLinea } from '../models/nomina.models';
import { construirPartidasRolMensual } from './nomina-asiento.util';

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
  camposPersonalizados: []
};

function linea(overrides: Partial<RolPagoLinea>): RolPagoLinea {
  return {
    rubroId: '', codigo: 'SUELDO', nombre: 'Sueldo base', tipo: 'INGRESO', afectaIess: true,
    cuentaContableId: '', monto: 0, origen: 'SUELDO', editable: false, ...overrides
  };
}

function detalle(overrides: Partial<RolPagoDetalle>): RolPagoDetalle {
  return {
    id: 'detalle', empleadoId: 'empleado', empleadoNombre: 'Empleado', cargo: 'Maestro',
    cargoId: 'cargo-maestro', cuentaGastoSueldosId: 'gasto-maestros', sueldoBase: 0, lineas: [],
    ingresosAdicionales: 0, aportePersonalIess: 0, aportePatronalIess: 0, contribucionCcc: 0,
    anticipos: 0, prestamos: 0, otrosDescuentos: 0, decimoTerceroProvision: 0,
    decimoCuartoProvision: 0, fondosReservaProvision: 0, vacacionesProvision: 0,
    decimoTerceroMensualizado: 0, decimoCuartoMensualizado: 0, fondosReservaMensualizado: 0,
    totalIngresos: 0, totalDescuentos: 0, totalBeneficios: 0, netoPagar: 0,
    ...overrides
  };
}

describe('construirPartidasRolMensual', () => {
  it('agrupa el sueldo por cargo y conserva los rubros por cuenta', () => {
    const partidas = construirPartidasRolMensual([
      detalle({
        id: 'a', empleadoId: 'a',
        lineas: [
          linea({ monto: 1000 }),
          linea({ codigo: 'BONO', nombre: 'Bonificaciones entregadas', origen: 'RUBRO', monto: 100, cuentaContableId: 'gasto-bonos' }),
          linea({ codigo: 'ANTIC', nombre: 'Anticipo de sueldo', tipo: 'DESCUENTO', origen: 'RUBRO', afectaIess: false, monto: 100, cuentaContableId: 'activo-anticipos' })
        ],
        decimoTerceroMensualizado: 80, decimoCuartoProvision: 50,
        fondosReservaMensualizado: 60, vacacionesProvision: 40,
        aportePersonalIess: 94.5, aportePatronalIess: 111.5, contribucionCcc: 10,
        totalIngresos: 1240, totalDescuentos: 194.5, totalBeneficios: 90, netoPagar: 1045.5
      }),
      detalle({
        id: 'b', empleadoId: 'b',
        lineas: [linea({ monto: 500 })],
        decimoTerceroProvision: 40, decimoCuartoMensualizado: 30,
        fondosReservaProvision: 25, vacacionesProvision: 20,
        aportePersonalIess: 47.25, aportePatronalIess: 55.75, contribucionCcc: 5,
        totalIngresos: 530, totalDescuentos: 47.25, totalBeneficios: 85, netoPagar: 482.75
      }),
      detalle({
        id: 'c', empleadoId: 'c', cargoId: 'cargo-asistente', cargo: 'Asistente', cuentaGastoSueldosId: '',
        lineas: [linea({ monto: 700 })], aportePersonalIess: 66.15, aportePatronalIess: 78.05,
        contribucionCcc: 7, totalIngresos: 700, totalDescuentos: 66.15, netoPagar: 633.85
      })
    ], config);

    expect(partidas.filter((item) => item.descripcion.startsWith('Sueldos y salarios'))).toEqual([
      expect.objectContaining({ cuentaId: '', descripcion: 'Sueldos y salarios · Asistente', debe: 700 }),
      expect.objectContaining({ cuentaId: 'gasto-maestros', descripcion: 'Sueldos y salarios · Maestro', debe: 1500 })
    ]);
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'gasto-bonos', descripcion: 'Bonificaciones entregadas', debe: 100 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-beneficios', haber: 170 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-sueldos', haber: 1992.1 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-iess', haber: 475.2 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-d13', haber: 40 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-d14', haber: 50 }));
    expect(partidas).toContainEqual(expect.objectContaining({ cuentaId: 'pasivo-fondos', haber: 25 }));

    const debe = partidas.reduce((total, item) => total + item.debe, 0);
    const haber = partidas.reduce((total, item) => total + item.haber, 0);
    expect(debe).toBeCloseTo(haber, 2);
  });

  it('omite conceptos en cero y no usa la cuenta global cuando falta la del cargo', () => {
    const partidas = construirPartidasRolMensual([
      detalle({ lineas: [linea({ monto: 500 })], cuentaGastoSueldosId: '', netoPagar: 500 })
    ], config);

    expect(partidas[0]).toEqual(expect.objectContaining({ cuentaId: '', debe: 500 }));
    expect(partidas.some((item) => item.cuentaId === config.cuentaGastoSueldosId && item.debe === 500)).toBe(false);
    expect(partidas.every((item) => item.debe > 0 || item.haber > 0)).toBe(true);
  });
});

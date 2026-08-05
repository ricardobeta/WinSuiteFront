import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';
import { construirMatrizRolConsolidado } from './rol-consolidado.util';

const TASAS = { personal: 9.45, patronal: 11.15, ccc: 1 };

function linea(overrides: Partial<RolPagoLinea>): RolPagoLinea {
  return {
    rubroId: '', codigo: 'SUELDO', nombre: 'Sueldo base', tipo: 'INGRESO', afectaIess: true,
    monto: 0, origen: 'SUELDO', editable: false, ...overrides
  };
}

function detalle(id: string, lineas: RolPagoLinea[], overrides: Partial<RolPagoDetalle> = {}): RolPagoDetalle {
  return {
    id, empleadoId: id, empleadoNombre: `Empleado ${id}`, cargo: 'Analista', departamento: 'Operaciones',
    sueldoBase: 600, lineas, ingresosAdicionales: 0, aportePersonalIess: 56.7,
    aportePatronalIess: 66.9, contribucionCcc: 6, baseImponibleIess: 600,
    anticipos: 0, prestamos: 0, otrosDescuentos: 0, decimoTerceroProvision: 50,
    decimoCuartoProvision: 38.33, fondosReservaProvision: 0, vacacionesProvision: 25,
    totalIngresos: 600, totalDescuentos: 56.7, totalBeneficios: 113.33, netoPagar: 543.3,
    ...overrides
  };
}

describe('construirMatrizRolConsolidado', () => {
  it('une rubros usados, conserva el orden y suma líneas repetidas', () => {
    const matriz = construirMatrizRolConsolidado([
      detalle('1', [
        linea({ monto: 600 }),
        linea({ rubroId: 'extra', codigo: 'HEX', nombre: 'Horas extra', monto: 20, origen: 'RUBRO' }),
        linea({ rubroId: 'extra', codigo: 'HEX', nombre: 'Horas extra', monto: 15, origen: 'RUBRO' })
      ], { totalIngresos: 635 }),
      detalle('2', [
        linea({ monto: 700 }),
        linea({ rubroId: 'bono', codigo: 'BONO', nombre: 'Bono', monto: 10, origen: 'RUBRO' })
      ], { totalIngresos: 710 })
    ], TASAS);

    const grupo = matriz.grupos.find((item) => item.id === 'INGRESOS')!;
    expect(grupo.columnas.map((item) => item.etiqueta)).toEqual([
      'Sueldo del período', 'Horas extra', 'Bono', 'Total ingresos'
    ]);
    expect(matriz.filas[0].valores['RUBRO:INGRESO:ID:extra']).toBe(35);
    expect(matriz.filas[1].valores['RUBRO:INGRESO:ID:extra']).toBe(0);
  });

  it('incluye el aporte personal IESS y el total dentro de descuentos', () => {
    const matriz = construirMatrizRolConsolidado([
      detalle('1', [
        linea({ monto: 600 }),
        linea({ codigo: 'MULTA', nombre: 'Multa', tipo: 'DESCUENTO', monto: 20, origen: 'RUBRO' }),
        linea({ codigo: 'IESS', nombre: 'Aporte personal IESS', tipo: 'DESCUENTO', monto: 56.7, origen: 'SISTEMA' })
      ], { otrosDescuentos: 20, totalDescuentos: 76.7, netoPagar: 523.3 })
    ], TASAS);

    const descuentos = matriz.grupos.find((item) => item.id === 'DESCUENTOS')!;
    expect(descuentos.columnas.map((item) => item.etiqueta)).toEqual([
      'Multa', 'IESS personal', 'Total descuentos'
    ]);
    expect(matriz.filas[0].valores['IESS_PERSONAL']).toBe(56.7);
    expect(matriz.filas[0].valores['TOTAL_DESCUENTOS']).toBe(76.7);
  });

  it('incluye provisiones y agrupa los valores patronales bajo IESS', () => {
    const matriz = construirMatrizRolConsolidado([
      detalle('1', [linea({ monto: 600 })]),
      detalle('2', [linea({ monto: 700 })], {
        totalIngresos: 700, aportePersonalIess: 66.15, aportePatronalIess: 78.05,
        contribucionCcc: 7, baseImponibleIess: 700, totalDescuentos: 66.15, netoPagar: 633.85
      })
    ], TASAS);

    expect(matriz.grupos.find((item) => item.id === 'PROVISIONES')?.columnas.map((item) => item.etiqueta))
      .toEqual(['Décimo tercero', 'Décimo cuarto', 'Vacaciones', 'Total provisionado']);
    expect(matriz.grupos.find((item) => item.id === 'IESS')?.columnas.map((item) => item.etiqueta))
      .toEqual([
        'Aporte patronal', 'Contribución CCC', 'Total patronal',
        'Total a pagar (personal + patronal)'
      ]);
    expect(matriz.filas[0].valores['TOTAL_PATRONAL']).toBe(72.9);
    expect(matriz.filas[0].valores['TOTAL_IESS_PAGAR']).toBe(129.6);
    expect(matriz.totales['TOTAL_INGRESOS']).toBe(1300);
    expect(matriz.totales['NETO_PAGAR']).toBe(1177.15);
  });

  it('reconstruye IESS de un rol histórico sin base ni CCC', () => {
    const antiguo = detalle('1', [linea({ monto: 600 })], {
      baseImponibleIess: undefined,
      contribucionCcc: undefined
    });
    const matriz = construirMatrizRolConsolidado([antiguo], TASAS);

    expect(matriz.filas[0].valores['IESS_BASE']).toBe(600);
    expect(matriz.filas[0].valores['IESS_CCC']).toBe(6);
  });
});

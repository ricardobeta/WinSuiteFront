import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';
import { baseAportesIess, desgloseIngresos, desgloseOtrosDescuentos } from './rol-detalle-desglose.util';

function linea(overrides: Partial<RolPagoLinea> = {}): RolPagoLinea {
  return {
    rubroId: '',
    codigo: 'SUELDO',
    nombre: 'Sueldo base',
    tipo: 'INGRESO',
    afectaIess: true,
    cuentaContableId: '',
    monto: 0,
    origen: 'SUELDO',
    editable: false,
    ...overrides
  };
}

function detalle(lineas: RolPagoLinea[], overrides: Partial<RolPagoDetalle> = {}): RolPagoDetalle {
  return {
    id: 'emp-1',
    empleadoId: 'emp-1',
    empleadoNombre: 'PEREZ JUAN',
    cargo: 'Bodeguero',
    sueldoMensual: 600,
    diasTrabajadosPeriodo: 30,
    sueldoBase: 600,
    lineas,
    ingresosAdicionales: 0,
    aportePersonalIess: 0,
    aportePatronalIess: 0,
    anticipos: 0,
    prestamos: 0,
    otrosDescuentos: 0,
    decimoTerceroProvision: 0,
    decimoCuartoProvision: 0,
    fondosReservaProvision: 0,
    vacacionesProvision: 0,
    totalIngresos: 0,
    totalDescuentos: 0,
    totalBeneficios: 0,
    netoPagar: 0,
    ...overrides
  };
}

/** Rol tipico: sueldo, un rubro de ingreso y los mensualizados que genera el sistema. */
const rolConMensualizados = detalle([
  linea({ monto: 600 }),
  linea({ codigo: 'HEXTRA25', nombre: 'Horas extra 25%', tipo: 'INGRESO', afectaIess: true, monto: 70, origen: 'RUBRO', editable: true }),
  linea({ codigo: 'D13MENS', nombre: 'Decimo tercero mensualizado', tipo: 'INGRESO', afectaIess: false, monto: 50, origen: 'SISTEMA', editable: false }),
  linea({ codigo: 'FRESERVA', nombre: 'Fondos de reserva mensualizados', tipo: 'INGRESO', afectaIess: false, monto: 100, origen: 'SISTEMA', editable: false }),
  linea({ codigo: 'IESS', nombre: 'Aporte personal IESS', tipo: 'DESCUENTO', afectaIess: false, monto: 63.32, origen: 'SISTEMA', editable: false })
]);

describe('desgloseIngresos', () => {
  it('lista sueldo, rubros y mensualizados en el orden del rol', () => {
    const filas = desgloseIngresos(rolConMensualizados);

    expect(filas.map((fila) => [fila.etiqueta, fila.monto])).toEqual([
      ['Sueldo del período', 600],
      ['Horas extra 25%', 70],
      ['Decimo tercero mensualizado', 50],
      ['Fondos de reserva mensualizados', 100]
    ]);
  });

  it('explica que los mensualizados no entran a la base de aportes', () => {
    const filas = desgloseIngresos(rolConMensualizados);

    expect(filas[2].nota).toBe('Se paga mes a mes · no afecta IESS');
    expect(filas[1].nota).toBe('Afecta IESS');
  });

  it('las filas suman exactamente el total de ingresos del rol', () => {
    const filas = desgloseIngresos(rolConMensualizados);
    const suma = filas.reduce((total, fila) => total + fila.monto, 0);

    expect(suma).toBe(820); // 600 + 70 + 50 + 100
  });

  it('deja fuera los descuentos', () => {
    expect(desgloseIngresos(rolConMensualizados).some((fila) => fila.etiqueta.includes('IESS'))).toBe(false);
  });

  it('indica los dias trabajados cuando el mes es parcial', () => {
    const parcial = detalle([linea({ monto: 420 })], { diasTrabajadosPeriodo: 21, sueldoMensual: 600, sueldoBase: 420 });

    expect(desgloseIngresos(parcial)[0].nota).toBe('21 de 30 días · mensual 600.00');
  });

  it('en un mes completo describe la remuneracion sin hablar de dias', () => {
    expect(desgloseIngresos(rolConMensualizados)[0].nota).toBe('Remuneración del período');
  });

  it('no falla con un detalle sin lineas', () => {
    expect(desgloseIngresos(detalle([]))).toEqual([]);
  });
});

describe('baseAportesIess', () => {
  it('suma solo los ingresos que afectan IESS', () => {
    // 600 + 70; los 150 de mensualizados quedan fuera.
    expect(baseAportesIess(rolConMensualizados)).toBe(670);
  });

  it('explica el aporte personal que muestra el resumen', () => {
    expect(Math.round(baseAportesIess(rolConMensualizados) * 0.0945 * 100) / 100).toBe(63.32);
  });
});

describe('desgloseOtrosDescuentos', () => {
  const conDescuentos = detalle([
    linea({ monto: 600 }),
    linea({ codigo: 'MULTA', nombre: 'Multa por atraso', tipo: 'DESCUENTO', afectaIess: false, monto: 20, origen: 'RUBRO', editable: true }),
    linea({ codigo: 'PREST', nombre: 'Prestamo quirografario', tipo: 'DESCUENTO', afectaIess: false, monto: 25, origen: 'RUBRO', editable: true }),
    linea({ codigo: 'ANTIC', nombre: 'Anticipo de sueldo', tipo: 'DESCUENTO', afectaIess: false, monto: 300, origen: 'RUBRO', editable: true }),
    linea({ codigo: 'IESS', nombre: 'Aporte personal IESS', tipo: 'DESCUENTO', afectaIess: false, monto: 56.7, origen: 'SISTEMA', editable: false })
  ]);

  it('lista solo los rubros manuales que el resumen agrupa', () => {
    expect(desgloseOtrosDescuentos(conDescuentos).map((fila) => [fila.etiqueta, fila.monto])).toEqual([
      ['Multa por atraso', 20],
      ['Prestamo quirografario', 25]
    ]);
  });

  it('excluye anticipos e IESS porque ya tienen su propia fila', () => {
    const codigos = desgloseOtrosDescuentos(conDescuentos).map((fila) => fila.clave);

    expect(codigos.some((clave) => clave.startsWith('ANTIC'))).toBe(false);
    expect(codigos.some((clave) => clave.startsWith('IESS'))).toBe(false);
  });

  it('la suma coincide con otrosDescuentos del resumen', () => {
    const suma = desgloseOtrosDescuentos(conDescuentos).reduce((total, fila) => total + fila.monto, 0);

    expect(suma).toBe(45);
  });
});

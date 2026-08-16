import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import {
  AnticipoNominaDetalle,
  anticipoAfectaNomina,
  anticipoEsOperativo
} from '../models/anticipos-nomina.models';
import { ConfiguracionNominaContable, RolPagoDetalle, RolPagoLinea } from '../models/nomina.models';
import { AnticiposNominaService } from './anticipos-nomina.service';
import { AsientosContablesService } from './asientos-contables.service';
import { ConfiguracionContableService } from './configuracion-contable.service';
import { calcularDiasTrabajadosPeriodo, calcularProporcionalMensual } from './nomina-calculos.util';
import { IntegracionContableService } from './integracion-contable.service';
import { NominaService } from './nomina.service';
import { PlanCuentasService } from './plan-cuentas.service';

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

function detalle(lineas: RolPagoLinea[]): RolPagoDetalle {
  return {
    id: 'emp-1',
    empleadoId: 'emp-1',
    empleadoNombre: 'PEREZ JUAN',
    cargo: 'Bodeguero',
    sueldoMensual: 600,
    diasTrabajadosPeriodo: 30,
    diasFondosReservaPeriodo: 0,
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
    netoPagar: 0
  };
}

describe('NominaService · anticipos en el rol', () => {
  let service: NominaService;
  let config: ConfiguracionNominaContable;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NominaService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } },
        { provide: AsientosContablesService, useValue: {} },
        { provide: PlanCuentasService, useValue: {} },
        { provide: IntegracionContableService, useValue: {} },
        { provide: ConfiguracionContableService, useValue: {} },
        { provide: AnticiposNominaService, useValue: {} }
      ]
    });
    service = TestBed.inject(NominaService);
    config = { ...service.getDefaultConfiguracion(), cuentaAnticiposEmpleadosId: 'cta-anticipos' };
  });

  it('separa el anticipo de los otros descuentos y lo resta del neto', () => {
    const resultado = service.recalcularDetalle(detalle([
      linea({ monto: 600 }),
      linea({ codigo: 'ANTIC', nombre: 'Anticipo de sueldo', tipo: 'DESCUENTO', afectaIess: false, monto: 300, origen: 'RUBRO', editable: true }),
      linea({ codigo: 'MULTA', nombre: 'Multa', tipo: 'DESCUENTO', afectaIess: false, monto: 20, origen: 'RUBRO', editable: true })
    ]), config);

    expect(resultado.anticipos).toBe(300);
    expect(resultado.otrosDescuentos).toBe(20);
    expect(resultado.totalDescuentos).toBe(376.7); // 300 + 20 + 56.70 (9.45% de 600)
    expect(resultado.netoPagar).toBe(223.3);
  });

  it('deja anticipos en cero cuando el rol no tiene esa linea', () => {
    const resultado = service.recalcularDetalle(detalle([
      linea({ monto: 600 }),
      linea({ codigo: 'MULTA', nombre: 'Multa', tipo: 'DESCUENTO', afectaIess: false, monto: 20, origen: 'RUBRO', editable: true })
    ]), config);

    expect(resultado.anticipos).toBe(0);
    expect(resultado.otrosDescuentos).toBe(20);
  });

  it('el anticipo no reduce la base de aportes ni las provisiones', () => {
    const sinAnticipo = service.recalcularDetalle(detalle([linea({ monto: 600 })]), config);
    const conAnticipo = service.recalcularDetalle(detalle([
      linea({ monto: 600 }),
      linea({ codigo: 'ANTIC', tipo: 'DESCUENTO', afectaIess: false, monto: 300, origen: 'RUBRO', editable: true })
    ]), config);

    expect(conAnticipo.aportePersonalIess).toBe(sinAnticipo.aportePersonalIess);
    expect(conAnticipo.aportePatronalIess).toBe(sinAnticipo.aportePatronalIess);
    expect(conAnticipo.totalBeneficios).toBe(sinAnticipo.totalBeneficios);
    expect(conAnticipo.totalIngresos).toBe(sinAnticipo.totalIngresos);
  });

  it('crearLineaAnticipo usa la cuenta configurada y marca la linea como editable', () => {
    const resultado = service.crearLineaAnticipo(150, null, config);

    expect(resultado).toEqual(expect.objectContaining({
      codigo: 'ANTIC',
      tipo: 'DESCUENTO',
      afectaIess: false,
      cuentaContableId: 'cta-anticipos',
      monto: 150,
      // Debe ser RUBRO: recalcularDetalle descarta y regenera las lineas SISTEMA.
      origen: 'RUBRO',
      editable: true
    }));
  });

  it('crearLineaAnticipo ignora montos no positivos', () => {
    expect(service.crearLineaAnticipo(0, null, config)).toBeNull();
    expect(service.crearLineaAnticipo(-10, null, config)).toBeNull();
  });

  it('deja el neto negativo cuando el anticipo supera lo devengado en un mes parcial', () => {
    // Ingreso el dia 10: devenga 21 de 30 dias, es decir 420 de un sueldo mensual de 600.
    const parcial = detalle([
      linea({ monto: 420 }),
      linea({ codigo: 'ANTIC', tipo: 'DESCUENTO', afectaIess: false, monto: 300, origen: 'RUBRO', editable: true })
    ]);
    const resultado = service.recalcularDetalle(
      { ...parcial, sueldoBase: 420, diasTrabajadosPeriodo: 21 },
      config
    );

    expect(resultado.anticipos).toBe(300);
    expect(resultado.netoPagar).toBeCloseTo(80.31, 2); // 420 - 300 - 39.69 de IESS
    expect(resultado.netoPagar).toBeGreaterThan(0);
  });
});

describe('NominaService · varios anticipos en el mismo periodo', () => {
  let service: NominaService;
  let config: ConfiguracionNominaContable;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NominaService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } },
        { provide: AsientosContablesService, useValue: {} },
        { provide: PlanCuentasService, useValue: {} },
        { provide: IntegracionContableService, useValue: {} },
        { provide: ConfiguracionContableService, useValue: {} },
        { provide: AnticiposNominaService, useValue: {} }
      ]
    });
    service = TestBed.inject(NominaService);
    config = { ...service.getDefaultConfiguracion(), cuentaAnticiposEmpleadosId: 'cta-anticipos' };
  });

  it('suma las lineas de anticipo cuando el empleado recibio varios en el periodo', () => {
    const resultado = service.recalcularDetalle(detalle([
      linea({ monto: 600 }),
      linea({ codigo: 'ANTIC', tipo: 'DESCUENTO', afectaIess: false, monto: 200, origen: 'RUBRO', editable: true }),
      linea({ codigo: 'ANTIC', tipo: 'DESCUENTO', afectaIess: false, monto: 150, origen: 'RUBRO', editable: true })
    ]), config);

    expect(resultado.anticipos).toBe(350);
    expect(resultado.otrosDescuentos).toBe(0);
    expect(resultado.netoPagar).toBe(193.3); // 600 - 350 - 56.70 de IESS
  });
});

describe('AnticiposNominaService · lineas del asiento', () => {
  let service: AnticiposNominaService;

  const cuentas = [
    { id: 'cta-anticipos', codigo: '1.1.3.05', nombre: 'Anticipos empleados', estado: 'ACTIVA', permiteMovimiento: true },
    { id: 'cta-banco', codigo: '1.1.1.02', nombre: 'Banco', estado: 'ACTIVA', permiteMovimiento: true }
  ];

  function empleado(nombre: string, monto: number): AnticipoNominaDetalle {
    return { empleadoId: nombre, empleadoNombre: nombre, cedula: '', cargo: '', sueldoBase: 600, monto };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnticiposNominaService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } },
        { provide: AsientosContablesService, useValue: {} },
        { provide: PlanCuentasService, useValue: { getCuentasOnce: async () => cuentas } },
        { provide: IntegracionContableService, useValue: {} }
      ]
    });
    service = TestBed.inject(AnticiposNominaService);
  });

  it('genera el par debe/haber de cada empleado con su nombre en ambas descripciones', async () => {
    const lineas = await service.construirLineasAnticipo(
      { periodo: '2026-07', concepto: 'Anticipo quincena', cuentaAnticipoId: 'cta-anticipos', cuentaOrigenId: 'cta-banco' },
      [empleado('PEREZ JUAN', 300), empleado('LOPEZ MARIA', 250)]
    );

    expect(lineas).toHaveLength(4);
    expect(lineas.map((l) => [l.codigoCuenta, l.descripcion, l.debe, l.haber])).toEqual([
      ['1.1.3.05', 'Anticipo quincena - PEREZ JUAN', 300, 0],
      ['1.1.1.02', 'Anticipo quincena - PEREZ JUAN', 0, 300],
      ['1.1.3.05', 'Anticipo quincena - LOPEZ MARIA', 250, 0],
      ['1.1.1.02', 'Anticipo quincena - LOPEZ MARIA', 0, 250]
    ]);
  });

  it('el asiento cuadra y cada par cuadra por si mismo', async () => {
    const lineas = await service.construirLineasAnticipo(
      { periodo: '2026-07', concepto: 'Anticipo', cuentaAnticipoId: 'cta-anticipos', cuentaOrigenId: 'cta-banco' },
      [empleado('A', 300), empleado('B', 250), empleado('C', 125.5)]
    );

    const debe = lineas.reduce((total, l) => total + l.debe, 0);
    const haber = lineas.reduce((total, l) => total + l.haber, 0);
    expect(debe).toBe(675.5);
    expect(debe).toBe(haber);
    for (let i = 0; i < lineas.length; i += 2) {
      expect(lineas[i].debe).toBe(lineas[i + 1].haber);
    }
  });

  it('deja sin cuenta las lineas cuya cuenta no esta configurada, para que el contador la elija', async () => {
    const lineas = await service.construirLineasAnticipo(
      { periodo: '2026-07', concepto: 'Anticipo', cuentaAnticipoId: '', cuentaOrigenId: 'cta-banco' },
      [empleado('PEREZ JUAN', 300)]
    );

    expect(lineas[0].cuentaId).toBe('');
    expect(lineas[1].cuentaId).toBe('cta-banco');
  });
});

describe('anticipos · base proporcional del periodo', () => {
  it('un empleado que ingresa el dia 10 devenga 21 de 30 dias', () => {
    expect(calcularDiasTrabajadosPeriodo('2026-07-10', '2026-07')).toBe(21);
    expect(calcularProporcionalMensual(600, 21)).toBe(420);
  });

  it('el 50% sugerido se calcula sobre lo devengado, no sobre el sueldo mensual', () => {
    const sueldoPeriodo = calcularProporcionalMensual(600, calcularDiasTrabajadosPeriodo('2026-07-10', '2026-07'));
    expect(sueldoPeriodo * 0.5).toBe(210); // y no 300, que dejaria el rol casi en cero
  });

  it('quien ingresa despues del periodo no devenga nada y no puede recibir anticipo de ese mes', () => {
    expect(calcularDiasTrabajadosPeriodo('2026-08-01', '2026-07')).toBe(0);
    expect(calcularProporcionalMensual(600, 0)).toBe(0);
  });
});

describe('anticipos · ciclo de borrador', () => {
  it('un borrador no afecta el rol ni los totales entregados', () => {
    expect(anticipoAfectaNomina('BORRADOR')).toBe(false);
    expect(anticipoEsOperativo('BORRADOR')).toBe(false);
  });

  it('solo registrado queda pendiente de descuento y descontado sigue siendo operativo', () => {
    expect(anticipoAfectaNomina('REGISTRADO')).toBe(true);
    expect(anticipoAfectaNomina('DESCONTADO')).toBe(false);
    expect(anticipoEsOperativo('REGISTRADO')).toBe(true);
    expect(anticipoEsOperativo('DESCONTADO')).toBe(true);
    expect(anticipoEsOperativo('ANULADO')).toBe(false);
  });
});

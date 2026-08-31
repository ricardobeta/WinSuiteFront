import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { ConfiguracionNominaContable, ModoDecimos, RolPagoDetalle } from '../models/nomina.models';
import { AnticiposNominaService } from './anticipos-nomina.service';
import { AsientosContablesService } from './asientos-contables.service';
import { ConfiguracionContableService } from './configuracion-contable.service';
import { IntegracionContableService } from './integracion-contable.service';
import { NominaService } from './nomina.service';
import { PlanCuentasService } from './plan-cuentas.service';

/**
 * Mensualizar y provisionar son dos destinos del mismo devengado. Estos tests fijan que la
 * eleccion del trabajador mande sobre el flag de provisiones de la empresa: un empleado que
 * mensualiza cobra su rubro aunque la empresa tenga la provision desactivada.
 */
describe('NominaService · decimos mensualizados vs provisionados', () => {
  let service: NominaService;
  let base: ConfiguracionNominaContable;

  function detalle(modoDecimoCuarto: ModoDecimos): RolPagoDetalle {
    return {
      id: 'emp-1',
      empleadoId: 'emp-1',
      empleadoNombre: 'PEREZ JUAN',
      cargo: 'Bodeguero',
      sueldoMensual: 600,
      diasTrabajadosPeriodo: 30,
      diasFondosReservaPeriodo: 0,
      sueldoBase: 600,
      modoDecimoCuarto,
      lineas: [{
        rubroId: '', codigo: 'SUELDO', nombre: 'Sueldo base', tipo: 'INGRESO',
        afectaIess: true, cuentaContableId: '', monto: 600, origen: 'SUELDO', editable: false
      }],
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NominaService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } },
        { provide: AuditService, useValue: { currentActor: () => ({ userId: 'uid-1' }), recordSafe: async () => undefined } },
        { provide: AsientosContablesService, useValue: {} },
        { provide: PlanCuentasService, useValue: {} },
        { provide: IntegracionContableService, useValue: {} },
        { provide: ConfiguracionContableService, useValue: {} },
        { provide: AnticiposNominaService, useValue: {} }
      ]
    });
    service = TestBed.inject(NominaService);
    base = { ...service.getDefaultConfiguracion(), salarioBasicoUnificado: 470 };
  });

  it('paga el decimo cuarto mensualizado aunque la empresa no provisione decimo cuarto', () => {
    // Caso reportado: el flag apagaba el calculo entero y el empleado cobraba cero.
    const config = { ...base, provisionarDecimoCuarto: false };

    const resultado = service.recalcularDetalle(detalle('MENSUALIZADO'), config);

    expect(resultado.decimoCuartoMensualizado).toBe(39.17); // 470 / 12
    expect(resultado.decimoCuartoProvision).toBe(0);
  });

  it('lo incluye en los ingresos como linea de sistema que no afecta IESS', () => {
    const config = { ...base, provisionarDecimoCuarto: false };

    const resultado = service.recalcularDetalle(detalle('MENSUALIZADO'), config);
    const linea = resultado.lineas.find((item) => item.codigo === 'D14MENS');

    expect(linea).toBeDefined();
    expect(linea!.monto).toBe(39.17);
    expect(linea!.afectaIess).toBe(false);
    expect(resultado.totalIngresos).toBe(639.17);
    // La base de aportes no cambia: el mensualizado no genera mas IESS.
    expect(resultado.aportePersonalIess).toBe(56.7); // 9.45% de 600
  });

  it('con la provision activada el resultado es el mismo para quien mensualiza', () => {
    const conProvision = service.recalcularDetalle(detalle('MENSUALIZADO'), { ...base, provisionarDecimoCuarto: true });
    const sinProvision = service.recalcularDetalle(detalle('MENSUALIZADO'), { ...base, provisionarDecimoCuarto: false });

    expect(sinProvision.decimoCuartoMensualizado).toBe(conProvision.decimoCuartoMensualizado);
    expect(sinProvision.netoPagar).toBe(conProvision.netoPagar);
  });

  it('quien acumula sigue dependiendo del flag de la empresa', () => {
    const conProvision = service.recalcularDetalle(detalle('ACUMULADO'), { ...base, provisionarDecimoCuarto: true });
    const sinProvision = service.recalcularDetalle(detalle('ACUMULADO'), { ...base, provisionarDecimoCuarto: false });

    expect(conProvision.decimoCuartoProvision).toBe(39.17);
    expect(sinProvision.decimoCuartoProvision).toBe(0);
    expect(sinProvision.decimoCuartoMensualizado).toBe(0);
  });

  it('sin salario basico no hay decimo cuarto que pagar, aunque se mensualice', () => {
    const config = { ...base, salarioBasicoUnificado: 0, provisionarDecimoCuarto: false };

    const resultado = service.recalcularDetalle(detalle('MENSUALIZADO'), config);

    expect(resultado.decimoCuartoMensualizado).toBe(0);
    expect(resultado.lineas.some((linea) => linea.codigo === 'D14MENS')).toBe(false);
  });

  it('el decimo tercero mensualizado se comporta igual', () => {
    const config = { ...base, provisionarDecimoTercero: false };
    const conD13 = { ...detalle('ACUMULADO'), modoDecimoTercero: 'MENSUALIZADO' as ModoDecimos };

    const resultado = service.recalcularDetalle(conD13, config);

    expect(resultado.decimoTerceroMensualizado).toBe(50); // 600 / 12
    expect(resultado.decimoTerceroProvision).toBe(0);
  });
});

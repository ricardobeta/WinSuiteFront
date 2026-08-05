import { TestBed } from '@angular/core/testing';
import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';
import { NominaRolConsolidadoComponent } from './nomina-rol-consolidado.component';

describe('NominaRolConsolidadoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NominaRolConsolidadoComponent] }).compileComponents();
  });

  it('muestra empleados, cabeceras agrupadas y permite plegar un grupo', () => {
    const fixture = crearFixture([detalle('1', 'Ana Pérez'), detalle('2', 'Luis Mora')]);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Ana Pérez');
    expect(element.textContent).toContain('Luis Mora');
    expect(element.textContent).toContain('Sueldo del período');
    expect(element.textContent).toContain('IESS personal');
    expect(element.textContent).toContain('Total descuentos');
    expect(element.textContent).toContain('Aporte patronal');
    expect(element.textContent).toContain('Contribución CCC');
    expect(element.textContent).toContain('Total patronal');
    expect(element.textContent).toContain('Total a pagar (personal + patronal)');

    const botonIngresos = [...element.querySelectorAll<HTMLButtonElement>('.group-head button')]
      .find((boton) => boton.textContent?.includes('Ingresos'))!;
    botonIngresos.click();
    fixture.detectChanges();

    const cabeceras = element.querySelector('.column-row')?.textContent ?? '';
    expect(cabeceras).not.toContain('Sueldo del período');
    expect(cabeceras).toContain('Total ingresos');
  });

  it('filtra empleados y cambia la etiqueta del total visible', async () => {
    const fixture = crearFixture([detalle('1', 'Ana Pérez'), detalle('2', 'Luis Mora')]);
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance as unknown as {
      busqueda: { (): string; set(value: string): void };
      filasVisibles: () => unknown[];
    };
    component.busqueda.set('Perez');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.busqueda()).toBe('Perez');
    expect(component.filasVisibles()).toHaveLength(1);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(element.querySelector('tbody')?.textContent).toContain('Ana Pérez');
    expect(element.querySelector('tfoot')?.textContent).toContain('Total visible');
  });
});

function crearFixture(detalles: RolPagoDetalle[]) {
  const fixture = TestBed.createComponent(NominaRolConsolidadoComponent);
  fixture.componentRef.setInput('detalles', detalles);
  fixture.componentRef.setInput('tasasIess', { personal: 9.45, patronal: 11.15, ccc: 1 });
  fixture.detectChanges();
  return fixture;
}

function detalle(id: string, nombre: string): RolPagoDetalle {
  const lineas: RolPagoLinea[] = [
    {
      rubroId: '', codigo: 'SUELDO', nombre: 'Sueldo base', tipo: 'INGRESO', afectaIess: true,
      monto: 600, origen: 'SUELDO', editable: false
    },
    {
      rubroId: '', codigo: 'IESS', nombre: 'Aporte personal IESS', tipo: 'DESCUENTO', afectaIess: false,
      monto: 56.7, origen: 'SISTEMA', editable: false
    }
  ];
  return {
    id, empleadoId: id, empleadoNombre: nombre, cargo: 'Analista', departamento: 'Operaciones',
    sueldoBase: 600, baseImponibleIess: 600, lineas, ingresosAdicionales: 0,
    aportePersonalIess: 56.7, aportePatronalIess: 66.9, contribucionCcc: 6,
    anticipos: 0, prestamos: 0, otrosDescuentos: 0, decimoTerceroProvision: 0,
    decimoCuartoProvision: 0, fondosReservaProvision: 0, vacacionesProvision: 0,
    totalIngresos: 600, totalDescuentos: 56.7, totalBeneficios: 0, netoPagar: 543.3
  };
}

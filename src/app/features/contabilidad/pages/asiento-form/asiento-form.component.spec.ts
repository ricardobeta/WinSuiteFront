import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProveedoresService } from '../../../inventario/services/proveedores.service';
import { CuentaContable } from '../../models/contabilidad.models';
import { AsientosContablesService } from '../../services/asientos-contables.service';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { AsientoFormComponent } from './asiento-form.component';

describe('AsientoFormComponent · proveedor manual de CxP', () => {
  const cuentaCxP: CuentaContable = {
    id: 'cxp-1',
    codigo: '2.1.1',
    nombre: 'Cuentas por pagar',
    nivel: 3,
    tipo: 'PASIVO',
    naturaleza: 'ACREEDORA',
    permiteMovimiento: true,
    estado: 'ACTIVA',
    origen: 'MANUAL',
  };
  const cuentaGasto: CuentaContable = {
    ...cuentaCxP,
    id: 'gasto-1',
    codigo: '5.1.1',
    nombre: 'Gasto general',
    tipo: 'GASTO',
    naturaleza: 'DEUDORA',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsientoFormComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        {
          provide: AsientosContablesService,
          useValue: {
            fechaHoy: () => '2026-08-28',
            periodoDesdeFecha: (fecha: string) => fecha.slice(0, 7),
            roundToTwo: (valor: number) => Math.round(valor * 100) / 100,
            crearLineaVacia: (descripcion = '') => ({
              id: crypto.randomUUID(),
              cuentaId: '',
              codigoCuenta: '',
              nombreCuenta: '',
              descripcion,
              debe: 0,
              haber: 0,
            }),
          },
        },
        {
          provide: PlanCuentasService,
          useValue: { getCuentasOnce: async () => [cuentaCxP, cuentaGasto] },
        },
        {
          provide: CuentasPorPagarService,
          useValue: {
            getConfiguracionOnce: async () => ({
              habilitarCuentasPorPagar: true,
              cuentaPorPagarDefaultId: 'cxp-1',
              cuentaCajaBancoEgresoDefaultId: '',
              fuenteFacturasCompra: true,
              fuenteManual: true,
              fuenteRetenciones: false,
              fuenteNomina: false,
            }),
          },
        },
        {
          provide: ProveedoresService,
          useValue: {
            getProveedores: () =>
              of([
                {
                  id: 'prov-1',
                  codigo: 'P-1',
                  nombre: 'Proveedor registrado',
                  ruc: '1790012345001',
                  diasCredito: 15,
                  moneda: 'USD',
                  activo: true,
                },
              ]),
          },
        },
        { provide: ConfiguracionContableService, useValue: {} },
      ],
    }).compileComponents();
  });

  async function crearFormularioCxP() {
    const fixture = TestBed.createComponent(AsientoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.configuracionCxP.set({
      habilitarCuentasPorPagar: true,
      cuentaPorPagarDefaultId: 'cxp-1',
      cuentaCajaBancoEgresoDefaultId: '',
      fuenteFacturasCompra: true,
      fuenteManual: true,
      fuenteRetenciones: false,
      fuenteNomina: false,
    });
    component.lineas.set([
      {
        id: '1',
        cuentaId: 'gasto-1',
        codigoCuenta: '5.1.1',
        nombreCuenta: 'Gasto general',
        descripcion: 'Compra manual',
        debe: 100,
        haber: 0,
      },
      {
        id: '2',
        cuentaId: 'cxp-1',
        codigoCuenta: '2.1.1',
        nombreCuenta: 'Cuentas por pagar',
        descripcion: 'Compra manual',
        debe: 0,
        haber: 100,
      },
    ]);
    component.cxpReferencia.set('FAC-001');
    fixture.detectChanges();
    return { fixture, component };
  }

  it('muestra nombre e identificación editables y no permite aprobarlos vacíos', async () => {
    const { fixture, component } = await crearFormularioCxP();
    const labels = fixture.nativeElement.textContent;
    const botonAprobar = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Aprobar'),
    ) as HTMLButtonElement;

    expect(labels).toContain('Nombre del proveedor');
    expect(labels).toContain('Identificación');
    expect(component.datosCxPCompletos()).toBe(false);
    expect(botonAprobar.disabled).toBe(true);

    component.actualizarProveedorNombreCxP('Proveedor manual');
    component.actualizarProveedorIdentificacionCxP('0912345678');
    fixture.detectChanges();

    expect(component.datosCxPCompletos()).toBe(true);
    expect(botonAprobar.disabled).toBe(false);
  });

  it('desvincula el proveedor registrado cuando se modifica manualmente su identidad', async () => {
    const { component } = await crearFormularioCxP();

    component.seleccionarProveedorCxP('prov-1');
    expect(component.cxpProveedorId()).toBe('prov-1');
    expect(component.cxpProveedorIdentificacion()).toBe('1790012345001');

    component.actualizarProveedorIdentificacionCxP('0912345678');

    expect(component.cxpProveedorId()).toBe('');
    expect(component.cxpProveedorNombre()).toBe('Proveedor registrado');
    expect(component.cxpProveedorIdentificacion()).toBe('0912345678');
  });
});

import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { PagoProveedorFormComponent } from './pago-proveedor-form.component';

describe('PagoProveedorFormComponent · precarga desde cartera', () => {
  const documento = {
    id: 'doc-1', numero: 'CXP-0064', origenTipo: 'FACTURA_COMPRA' as const,
    origenId: 'factura-1', origenNumero: '001-003-000000169', proveedorId: 'prov-1',
    proveedorClave: 'proveedor-real', proveedorNombre: 'YISKA S.A.S. B.I.C.',
    proveedorIdentificacion: '1191797346001', fechaEmision: new Date(2026, 5, 3).getTime(),
    fechaVencimiento: new Date(2026, 5, 3).getTime(), moneda: 'USD',
    glosa: 'Factura compra 001-003-000000169', montoOriginal: 55, saldoPendiente: 55,
    estadoPago: 'PENDIENTE' as const, asientoId: null, creadoEn: 1, actualizadoEn: 1
  };
  const service = {
    getDocumentosOnce: vi.fn(),
    getConfiguracionOnce: vi.fn()
  };

  beforeEach(async () => {
    service.getDocumentosOnce.mockReset().mockResolvedValue([documento]);
    service.getConfiguracionOnce.mockReset().mockResolvedValue({ cuentaCajaBancoEgresoDefaultId: 'banco-1' });
    await TestBed.configureTestingModule({
      imports: [PagoProveedorFormComponent, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ proveedor: 'clave-api-anterior', documentos: 'doc-1' }) } } },
        { provide: CuentasPorPagarService, useValue: service },
        { provide: PlanCuentasService, useValue: { getCuentasOnce: vi.fn().mockResolvedValue([]) } },
        { provide: IntegracionContableService, useValue: {} },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn(), openFromComponent: vi.fn() } }
      ]
    }).compileComponents();
  });

  it('recupera proveedor y abono por los IDs aunque cambie la clave recibida', async () => {
    const fixture = TestBed.createComponent(PagoProveedorFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    await vi.waitFor(() => expect(component.cargando()).toBe(false));
    fixture.detectChanges();

    expect(component.proveedorClave()).toBe('proveedor-real');
    expect(component.abonos()).toEqual({ 'doc-1': 55 });
    expect(component.glosa()).toContain('001-003-000000169');
    expect(fixture.nativeElement.textContent).toContain('001-003-000000169');
  });

  it('informa el error de carga y permite reintentar sin abandonar la pantalla', async () => {
    service.getDocumentosOnce
      .mockRejectedValueOnce(new Error('Fallo temporal de Firebase'))
      .mockResolvedValueOnce([documento]);
    const fixture = TestBed.createComponent(PagoProveedorFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    await vi.waitFor(() => expect(component.cargando()).toBe(false));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar el pago');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');

    await component.reintentarCarga();
    fixture.detectChanges();
    expect(component.proveedorClave()).toBe('proveedor-real');
    expect(component.abonos()).toEqual({ 'doc-1': 55 });
  });
});

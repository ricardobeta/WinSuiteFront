import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { TablePreferencesService } from '../../../../core/services/table-preferences.service';
import { CuentasPorPagarConsultaApiService } from '../../services/cuentas-por-pagar-consulta-api.service';
import { CuentasPorPagarListComponent } from './cuentas-por-pagar-list.component';

describe('CuentasPorPagarListComponent', () => {
  const parametros = new Map<string, string>();
  const api = {
    consultarCartera: vi.fn(),
    consultarProveedor: vi.fn(),
    consultarHistorial: vi.fn(),
    consultarTrazabilidad: vi.fn()
  };

  const resumen = {
    deudaBruta: 100, creditos: 0, saldoNeto: 100, vencido: 100,
    porVencer: 0, proveedores: 1, documentos: 1
  };
  const proveedor = {
    proveedorClave: 'prov-1', proveedorNombre: 'Proveedor Uno', proveedorIdentificacion: '1790000000001',
    cantidadDocumentos: 1, proximoVencimiento: '2026-08-15', porVencer: 0, tramo1_30: 100,
    tramo31_60: 0, tramo61_90: 0, tramoMas90: 0, vencido: 100, deudaBruta: 100,
    creditos: 0, saldoNeto: 100
  };
  const documento = {
    id: 'doc-1', numero: 'CXP-001', referencia: 'FAC-001', origenTipo: 'FACTURA_COMPRA' as const,
    proveedorClave: 'prov-1', proveedorNombre: 'Proveedor Uno', proveedorIdentificacion: '1790000000001',
    fechaEmision: '2026-08-01', fechaVencimiento: '2026-08-15', montoOriginal: 100,
    aplicadoAlCorte: 0, saldoAlCorte: 100, estadoAlCorte: 'PENDIENTE' as const, saldoActual: 100,
    estadoActual: 'PENDIENTE' as const, diasVencidos: 13, credito: false, elegiblePago: true, glosa: 'Compra'
  };

  beforeEach(async () => {
    parametros.clear();
    api.consultarCartera.mockReset().mockResolvedValue({
      fechaCorte: '2026-08-28', resumen, items: [proveedor], page: 0, size: 25, total: 1
    });
    api.consultarProveedor.mockReset().mockResolvedValue({
      proveedorClave: 'prov-1', proveedorNombre: 'Proveedor Uno', fechaCorte: '2026-08-28',
      items: [documento], page: 0, size: 50, total: 1
    });
    api.consultarHistorial.mockReset().mockResolvedValue({
      fechaDesde: '2026-08-01', fechaHasta: '2026-08-28', items: [], page: 0, size: 25, total: 0
    });
    api.consultarTrazabilidad.mockReset();

    await TestBed.configureTestingModule({
      imports: [CuentasPorPagarListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (key: string) => parametros.get(key) ?? null } },
            queryParamMap: of({ get: (key: string) => parametros.get(key) ?? null })
          }
        },
        { provide: CuentasPorPagarConsultaApiService, useValue: api },
        { provide: AuthService, useValue: { currentProfile: () => null } },
        { provide: TablePreferencesService, useValue: {} }
      ]
    }).compileComponents();
  });

  it('inicia en Cartera al corte y presenta una sola fila agregada por proveedor', async () => {
    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.consultarCartera).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Cartera al corte');
    expect(fixture.nativeElement.textContent).toContain('Proveedor Uno');
    expect(fixture.nativeElement.querySelectorAll('.provider-row')).toHaveLength(1);
  });

  it('restaura Historial desde la URL y consulta el rango persistido', async () => {
    parametros.set('vista', 'historial');
    parametros.set('desde', '2026-07-01');
    parametros.set('hasta', '2026-07-31');

    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.consultarHistorial).toHaveBeenCalledWith(expect.objectContaining({
      fechaDesde: '2026-07-01', fechaHasta: '2026-07-31'
    }));
    expect(fixture.nativeElement.querySelector('.history-filters')).toBeTruthy();
  });

  it('explica que una compra anulada permanece en historial pero no suma en cartera', async () => {
    parametros.set('vista', 'historial');
    api.consultarHistorial.mockResolvedValue({
      fechaDesde: '2026-08-01', fechaHasta: '2026-08-30', page: 0, size: 25, total: 1,
      items: [{
        id: 'doc-anulado', numero: 'CXP-0099', referencia: '002-001-000825849',
        origenTipo: 'FACTURA_COMPRA', proveedorClave: 'prov-1', proveedorNombre: 'Proveedor Uno',
        proveedorIdentificacion: '1790000000001', fechaEmision: '2026-08-01',
        fechaVencimiento: '2026-08-15', montoOriginal: 175.25, aplicadoActual: 0,
        saldoActual: 0, estadoActual: 'ANULADA', anuladoEn: '2026-08-20', asientoId: 'asiento-1',
        motivoAnulacion: 'ASIENTO_REVERSADO'
      }]
    });

    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Anulada');
    expect(fixture.nativeElement.textContent).toContain('Por reverso del asiento · no suma en cartera');
  });

  it('envia proveedor y documentos elegibles al formulario de pago', async () => {
    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as any;
    component.fechaCorte.set(component.hoy);
    await component.alternarProveedor(proveedor);
    component.seleccionarDocumento(documento, true);
    component.prepararPago();

    expect(navigate).toHaveBeenCalledWith(
      ['/workspace/contabilidad/cuentas-por-pagar/pagos/nuevo'],
      { queryParams: { proveedor: 'prov-1', documentos: 'doc-1' } }
    );
  });

  it('presenta relaciones contables legibles y navegables sin mostrar ids de Firebase', async () => {
    api.consultarTrazabilidad.mockResolvedValue({
      documento: {
        ...documento,
        aplicadoActual: 0,
        anuladoEn: null,
        asientoId: 'asiento-firebase'
      },
      glosa: 'Compra de inventario',
      asientoId: 'asiento-firebase',
      origenId: 'factura-firebase',
      asiento: {
        id: 'asiento-firebase', numero: 'ASI-0042', descripcion: 'Compra de inventario',
        fecha: '2026-08-01', estado: 'APROBADO', tipo: 'ASIENTO'
      },
      origen: {
        id: 'factura-firebase', numero: '002-001-000825849', descripcion: 'Proveedor Uno · 1790000000001',
        fecha: '2026-08-01', estado: 'REGISTRADA', tipo: 'FACTURA_COMPRA'
      },
      movimientos: [{
        pagoId: 'pago-firebase', pagoNumero: 'PAG-0018', fecha: '2026-08-20', metodoPago: 'TRANSFERENCIA',
        referencia: 'TRX-8821', monto: 25, estado: 'REGISTRADO', anuladoEn: null
      }]
    });
    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await (fixture.componentInstance as any).abrirTrazabilidad(documento);
    fixture.detectChanges();

    const texto = fixture.nativeElement.querySelector('.trace-panel').textContent;
    const enlaces = Array.from(fixture.nativeElement.querySelectorAll('.trace-relation, .payment-trace-link')) as HTMLAnchorElement[];
    expect(texto).toContain('ASI-0042');
    expect(texto).toContain('002-001-000825849');
    expect(texto).toContain('PAG-0018');
    expect(texto).not.toContain('asiento-firebase');
    expect(texto).not.toContain('factura-firebase');
    expect(texto).not.toContain('pago-firebase');
    expect(enlaces.some((enlace) => enlace.getAttribute('href')?.includes('/asientos/asiento-firebase/editar'))).toBe(true);
    expect(enlaces.some((enlace) => enlace.getAttribute('href')?.includes('/compras/factura-firebase/editar'))).toBe(true);
    expect(enlaces.some((enlace) => enlace.getAttribute('href')?.includes('pago=pago-firebase'))).toBe(true);
  });

  it('muestra una compra anulada sin asiento como excluida y sin enlace contable ficticio', async () => {
    api.consultarTrazabilidad.mockResolvedValue({
      documento: {
        ...documento,
        aplicadoActual: 0,
        saldoActual: 0,
        estadoActual: 'ANULADA',
        anuladoEn: '2026-08-30',
        asientoId: null,
        motivoAnulacion: 'COMPRA_ANULADA_SIN_ASIENTO'
      },
      glosa: 'Factura compra 001-003-000000169',
      asientoId: null,
      origenId: 'factura-anulada',
      asiento: null,
      origen: {
        id: 'factura-anulada', numero: '001-003-000000169', descripcion: 'YISKA S.A.S. B.I.C.',
        fecha: '2026-06-03', estado: 'ANULADA', tipo: 'FACTURA_COMPRA'
      },
      movimientos: []
    });
    const fixture = TestBed.createComponent(CuentasPorPagarListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await (fixture.componentInstance as any).abrirTrazabilidad(documento);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.trace-panel') as HTMLElement;
    expect(panel.textContent).toContain('Compra anulada sin asiento · no suma en cartera');
    expect(panel.textContent).toContain('Sin asiento asociado');
    expect(panel.querySelector('a[href*="/asientos/"]')).toBeNull();
  });
});

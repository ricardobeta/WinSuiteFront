import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { ArchivosService } from '../../../../core/services/archivos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AlmacenesService } from '../../services/almacenes.service';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { CategoriasService } from '../../services/categorias.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';
import { RecetasService } from '../../services/recetas.service';
import { UnidadesService } from '../../services/unidades.service';
import { ProductoFormComponent } from './producto-form.component';

describe('ProductoFormComponent responsive', () => {
  let mobile = false;
  let initialType: 'SIMPLE' | 'RECETA' = 'SIMPLE';

  beforeEach(async () => {
    mobile = false;
    initialType = 'SIMPLE';

    await TestBed.configureTestingModule({
      imports: [ProductoFormComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null },
              queryParamMap: { get: (key: string) => key === 'tipo' ? initialType : null }
            }
          }
        },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: mobile, breakpoints: {} }) }
        },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: ArchivosService, useValue: { uploadArchivo: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn(), openFromComponent: vi.fn() } },
        { provide: CamposInventarioService, useValue: { getCampos: () => of([]) } },
        { provide: CategoriasService, useValue: { getCategorias: () => of([]) } },
        { provide: UnidadesService, useValue: { getUnidades: () => of([]) } },
        { provide: AlmacenesService, useValue: { getAlmacenesActivos: () => of([]) } },
        {
          provide: ProductosService,
          useValue: {
            getProductos: () => of([]),
            getProductoById: vi.fn(),
            crearProducto: vi.fn(),
            actualizarProducto: vi.fn()
          }
        },
        { provide: KardexService, useValue: { registrarIngresoInicial: vi.fn() } },
        { provide: RecetasService, useValue: { registrarAuditoriaReceta: vi.fn() } },
        {
          provide: ConfiguracionInventarioService,
          useValue: {
            getConfiguracionOnce: () => Promise.resolve({
              metodoCosteoDefecto: 'PROMEDIO',
              permitirStockNegativo: false,
              prefijoSKU: 'PROD-',
              monedaBase: 'USD',
              simboloMoneda: '$',
              alertasStockMinimo: true,
              impuestoPorDefecto: 12,
              metodoPrecioVentaDefecto: 'MARKUP',
              porcentajePrecioVentaDefecto: 30,
              requerirImagenProductoVenta: false,
              pasoCantidadGranelDefecto: 0.1
            })
          }
        }
      ]
    }).compileComponents();
  });

  it('mantiene pestanas en escritorio', async () => {
    const fixture = TestBed.createComponent(ProductoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-tab-group')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-accordion')).toBeNull();
  });

  it('usa acordeon en movil, abre el primer error y conserva valores entre secciones', async () => {
    mobile = true;
    const fixture = TestBed.createComponent(ProductoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(fixture.nativeElement.querySelector('mat-accordion')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-tab-group')).toBeNull();

    component.form.controls.nombre.setValue('Producto movil');
    component.activarSeccionMovil('venta');
    component.activarSeccionMovil('general');
    expect(component.form.controls.nombre.value).toBe('Producto movil');

    component.form.controls.nombre.setValue('');
    await component.guardar();
    fixture.detectChanges();
    expect(component.seccionMovilActiva()).toBe('general');
    expect(fixture.nativeElement.querySelector('mat-expansion-panel.mat-expanded')?.textContent)
      .toContain('General');
  });

  it('incluye una etiqueta contextual al eliminar ingredientes', async () => {
    mobile = true;
    initialType = 'RECETA';
    const fixture = TestBed.createComponent(ProductoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Eliminar ingrediente 1"]'
    ) as HTMLButtonElement | null;
    expect(removeButton).toBeTruthy();
  });
});

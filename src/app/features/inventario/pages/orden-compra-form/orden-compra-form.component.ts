import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult } from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import { AuthService } from '../../../../core/services/auth.service';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { AlmacenesService } from '../../services/almacenes.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { ProductosService } from '../../services/productos.service';
import { ProveedoresService } from '../../services/proveedores.service';
import { Almacen, EstadoOrdenCompra, MetodoPrecioVenta, OrdenCompraItem, Producto, Proveedor } from '../../models/inventario.models';
import { esComprable } from '../../utils/producto.util';

const EXTENSIONES_PDF = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

@Component({
  selector: 'app-orden-compra-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    TwoDecimalInputDirective,
    ArchivoUploaderComponent
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>{{ titulo() }}</h2>
        <p>
          Registra la compra en un solo paso. Al guardarla como <strong>Recibida</strong> entra el stock
          y queda un borrador en Contabilidad &gt; Compras.
        </p>
      </header>

      <section class="surface-card form-card">
        <form class="oc-form" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Numero OC</mat-label>
              <input matInput formControlName="numero" readonly placeholder="Se genera automaticamente" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Proveedor</mat-label>
              <mat-select formControlName="proveedorId" [disabled]="soloLectura()">
                @for (proveedor of proveedores(); track proveedor.id) {
                  <mat-option [value]="proveedor.id">{{ proveedor.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha emision</mat-label>
              <input matInput [matDatepicker]="pickerEmision" formControlName="fechaEmision" [readonly]="soloLectura()" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerEmision"></mat-datepicker-toggle>
              <mat-datepicker #pickerEmision></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="estado" [disabled]="soloLectura()">
                @for (estado of estados; track estado.value) {
                  <mat-option [value]="estado.value">{{ estado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          @if (esRecepcion() && !soloLectura()) {
            <section class="recepcion-box">
              <div class="section-head">
                <div>
                  <h3>Entrada de mercaderia</h3>
                  <p>Al guardar se incrementa el stock del almacen y se registra el kardex de entrada.</p>
                </div>
              </div>

              <mat-form-field appearance="outline" class="almacen-field">
                <mat-label>Almacen destino</mat-label>
                <mat-select formControlName="almacenId">
                  @for (almacen of almacenes(); track almacen.id) {
                    <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="comprobantes">
                <article class="comprobante">
                  <h4>XML de la factura</h4>
                  @if (xmlArchivo(); as archivo) {
                    <div class="archivo-chip">
                      <mat-icon>description</mat-icon>
                      <span>{{ archivo.name }}</span>
                      <button mat-button type="button" (click)="quitarXml()">
                        <mat-icon>close</mat-icon> Quitar
                      </button>
                    </div>
                  } @else {
                    <button mat-stroked-button type="button" (click)="seleccionarArchivo('xml')">
                      <mat-icon>folder_open</mat-icon> Seleccionar un XML ya cargado
                    </button>
                    <span class="or-sep">o sube uno nuevo</span>
                    <app-archivo-uploader
                      sourceModule="compras"
                      [extensions]="['xml']"
                      (uploaded)="onXmlSubido($event)"
                    ></app-archivo-uploader>
                  }
                </article>

                <article class="comprobante">
                  <h4>PDF de la factura</h4>
                  @if (pdfArchivo(); as archivo) {
                    <div class="archivo-chip">
                      <mat-icon>picture_as_pdf</mat-icon>
                      <span>{{ archivo.name }}</span>
                      <button mat-button type="button" (click)="quitarPdf()">
                        <mat-icon>close</mat-icon> Quitar
                      </button>
                    </div>
                  } @else {
                    <button mat-stroked-button type="button" (click)="seleccionarArchivo('pdf')">
                      <mat-icon>folder_open</mat-icon> Seleccionar un PDF ya cargado
                    </button>
                    <span class="or-sep">o sube uno nuevo</span>
                    <app-archivo-uploader
                      sourceModule="compras"
                      [extensions]="extensionesPdf"
                      (uploaded)="onPdfSubido($event)"
                    ></app-archivo-uploader>
                  }
                </article>
              </div>

              @if (comprobanteObligatorio() && !tieneComprobante()) {
                <p class="warn-hint">
                  <mat-icon>error_outline</mat-icon>
                  La contabilidad esta activa: adjunta el XML o el PDF de la factura para poder recibir.
                </p>
              }
            </section>
          }

          <div class="items-header">
            <h3>Items</h3>
            @if (!soloLectura()) {
              <button mat-stroked-button type="button" (click)="agregarItem()">
                <mat-icon>add</mat-icon>
                Agregar item
              </button>
            }
          </div>

          <div formArrayName="items" class="items-grid">
            @for (item of items.controls; track $index) {
              <div class="item-row" [formGroupName]="$index">
                <strong class="mobile-item-title">Item {{ $index + 1 }}</strong>
                <mat-form-field appearance="outline">
                  <mat-label>Producto</mat-label>
                  <mat-select formControlName="productoId" [disabled]="soloLectura()" (selectionChange)="actualizarDescripcionDesdeProducto($index)">
                    @for (producto of productos(); track producto.id) {
                      <mat-option [value]="producto.id">{{ producto.nombre }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Descripcion</mat-label>
                  <input matInput formControlName="descripcion" [readonly]="soloLectura()" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Cantidad</mat-label>
                  <input matInput type="number" min="0" formControlName="cantidad" [readonly]="soloLectura()" (input)="recalcularTotales()" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Costo unitario</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="costoUnitario" [readonly]="soloLectura()" (input)="recalcularTotales()" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>IVA item (%)</mat-label>
                  <input matInput type="number" min="0" max="100" formControlName="impuestoPorcentaje" [readonly]="soloLectura()" (input)="recalcularTotales()" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Total item</mat-label>
                  <input matInput [value]="totalItem($index) | number:'1.2-2'" readonly />
                </mat-form-field>

                @if (!soloLectura()) {
                  <button
                    mat-icon-button
                    type="button"
                    color="warn"
                    class="item-delete"
                    [attr.aria-label]="'Eliminar item ' + ($index + 1)"
                    (click)="eliminarItem($index)"
                  >
                    <mat-icon>delete</mat-icon>
                    <span class="mobile-action-label">Eliminar item</span>
                  </button>
                }
              </div>
            }
          </div>

          <section class="totales-box">
            <p>Subtotal: {{ subtotal() | number:'1.2-2' }}</p>
            <p>Impuesto: {{ impuesto() | number:'1.2-2' }}</p>
            <p class="total-line">Total: {{ total() | number:'1.2-2' }}</p>
          </section>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <textarea matInput rows="3" formControlName="notas" [readonly]="soloLectura()"></textarea>
            <mat-hint>Se guarda en la orden y acompana al movimiento de kardex al recibir.</mat-hint>
          </mat-form-field>

          @if (esRecepcion() && !soloLectura()) {
            <section class="panel" formArrayName="items">
              <button mat-button type="button" class="panel-toggle" (click)="mostrarPrecios.set(!mostrarPrecios())">
                <mat-icon>{{ mostrarPrecios() ? 'expand_less' : 'expand_more' }}</mat-icon>
                Actualizar precios de venta (opcional)
              </button>

              @if (mostrarPrecios()) {
                <div class="panel-body">
                  <p class="muted">
                    Sugerencia por <strong>Margen de utilidad</strong> o <strong>Markup</strong> sobre el costo
                    de ingreso. Si no activas nada, el precio de venta del producto no cambia.
                  </p>

                  @for (group of items.controls; track $index) {
                    <article class="pricing-card" [formGroupName]="$index">
                      <div class="pricing-head">
                        <strong>{{ descripcionItem($index) }}</strong>
                        <span>Costo ingreso: {{ costoItem($index) | number:'1.2-2' }}</span>
                        <span>Precio actual: {{ precioVentaActual($index) | number:'1.2-2' }}</span>
                      </div>

                      <div class="pricing-grid">
                        <mat-form-field appearance="outline">
                          <mat-label>Metodo sugerencia</mat-label>
                          <mat-select formControlName="metodoPrecioVenta">
                            @for (metodo of metodosPrecioVenta; track metodo.value) {
                              <mat-option [value]="metodo.value">{{ metodo.label }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>% sugerido</mat-label>
                          <input matInput type="number" min="0" max="99.99" formControlName="porcentajePrecioVenta" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Precio sugerido</mat-label>
                          <input matInput [value]="precioSugeridoItem($index) | number:'1.2-2'" readonly />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Nuevo precio venta</mat-label>
                          <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioVentaNuevo" />
                        </mat-form-field>
                      </div>

                      <div class="pricing-actions">
                        <button mat-button type="button" (click)="usarSugerido($index)">Usar sugerido</button>
                        <mat-slide-toggle formControlName="actualizarPrecioVenta">Aplicar nuevo precio</mat-slide-toggle>
                      </div>
                    </article>
                  }
                </div>
              }
            </section>
          }

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/ordenes-compra">Cancelar</a>

            @if (!soloLectura()) {
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
                {{ guardando() ? 'Guardando...' : textoBotonGuardar() }}
              </button>
            }
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .page-grid { display: grid; gap: 1rem; }
    .header-card, .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .oc-form { display: grid; gap: 1rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .recepcion-box { display: grid; gap: .85rem; padding: .95rem; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .75rem; background: var(--tc-surface-container-low); }
    .section-head h3, .section-head p { margin: 0; }
    .section-head p { color: var(--muted-foreground); font-size: .9rem; }
    .almacen-field { max-width: 340px; }
    .comprobantes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .comprobante { display: grid; gap: .5rem; align-content: start; }
    .comprobante h4 { margin: 0; font-size: .95rem; }
    .or-sep { color: var(--muted-foreground); font-size: .85rem; }
    .archivo-chip { display: flex; align-items: center; gap: .6rem; padding: .6rem .85rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 8%, var(--card)); }
    .archivo-chip > mat-icon { color: var(--primary); }
    .archivo-chip span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .warn-hint { display: flex; align-items: center; gap: .4rem; margin: 0; color: var(--tc-error); font-size: .9rem; }
    .items-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .items-header h3 { margin: 0; }
    .items-grid { display: grid; gap: .75rem; }
    .item-row { display: grid; grid-template-columns: 1.3fr 1.3fr .8fr .9fr .9fr .9fr auto; gap: .6rem; align-items: start; }
    .totales-box { margin-left: auto; text-align: right; display: grid; gap: .25rem; }
    .totales-box p { margin: 0; }
    .total-line { font-weight: 700; }
    .panel { border-top: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); padding-top: .5rem; }
    .panel-toggle { padding-left: 0; }
    .panel-body { display: grid; gap: 1rem; padding-top: .5rem; }
    .panel-body .muted { margin: 0; color: var(--muted-foreground); }
    .pricing-card { padding: .8rem; border-radius: .75rem; background: var(--tc-surface-container-low); display: grid; gap: .75rem; }
    .pricing-head { display: flex; flex-wrap: wrap; gap: 1rem; color: var(--muted-foreground); }
    .pricing-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .pricing-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }
    .mobile-item-title, .mobile-action-label { display: none; }
    @media (max-width: 1200px) { .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .item-row { grid-template-columns: 1fr 1fr 1fr; } }
    @media (max-width: 900px) {
      .grid-4 { grid-template-columns: 1fr; }
      .comprobantes { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .pricing-actions { justify-content: flex-start; flex-wrap: wrap; }
      .actions-row, .items-header { justify-content: flex-start; }
      .item-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .header-card, .form-card { padding: .85rem; }
      .items-header { display: grid; grid-template-columns: 1fr; }
      .items-header button, .almacen-field { width: 100%; max-width: none; }
      .item-row { padding: .85rem; border-radius: 12px; background: var(--tc-surface-container-low); }
      .mobile-item-title { display: block; }
      .mobile-action-label { display: inline; }
      .item-delete {
        display: inline-flex;
        width: 100%;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        gap: .4rem;
        border-radius: 10px;
        background: var(--tc-error-container);
        color: var(--tc-on-error-container);
      }
      .pricing-actions { display: grid; grid-template-columns: 1fr; }
      .pricing-actions button { width: 100%; }
      .actions-row {
        position: sticky;
        bottom: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        padding: .75rem .2rem max(.75rem, env(safe-area-inset-bottom));
        background: color-mix(in srgb, var(--tc-surface-container-lowest) 94%, transparent);
        box-shadow: 0 -12px 28px rgb(15 23 42 / 12%);
        backdrop-filter: blur(12px);
      }
      .actions-row a, .actions-row button { width: 100%; }
      .actions-row > :only-child { grid-column: 1 / -1; }
    }
  `]
})
export class OrdenCompraFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly productosService = inject(ProductosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly ordenesService = inject(OrdenesCompraService);
  private readonly integracionContable = inject(IntegracionContableService);

  protected readonly estados: Array<{ value: EstadoOrdenCompra; label: string }> = [
    { value: 'BORRADOR', label: 'Borrador' },
    { value: 'RECIBIDA', label: 'Recibida' },
    { value: 'ANULADA', label: 'Anulada' }
  ];
  protected readonly metodosPrecioVenta: Array<{ value: MetodoPrecioVenta; label: string }> = [
    { value: 'MARGEN_UTILIDAD', label: 'Margen utilidad' },
    { value: 'MARKUP', label: 'Markup' }
  ];
  protected readonly extensionesPdf = EXTENSIONES_PDF;

  protected readonly guardando = signal(false);
  protected readonly ordenId = signal<string | null>(null);
  protected readonly esEdicion = computed(() => !!this.ordenId());
  protected readonly soloLectura = signal(false);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly productosMap = signal<Record<string, Producto>>({});
  protected readonly mostrarPrecios = signal(false);
  protected readonly comprobanteObligatorio = signal(false);
  protected readonly xmlArchivo = signal<ArchivoItem | null>(null);
  protected readonly pdfArchivo = signal<ArchivoItem | null>(null);
  /** Estado elegido en el select; gobierna la seccion de entrada de mercaderia. */
  protected readonly estadoSeleccionado = signal<EstadoOrdenCompra>('BORRADOR');
  protected readonly esRecepcion = computed(() => this.estadoSeleccionado() === 'RECIBIDA');
  protected readonly tieneComprobante = computed(() => !!this.xmlArchivo() || !!this.pdfArchivo());

  private impuestoPorcentajeDefecto = 12;
  private metodoPrecioVentaDefecto: MetodoPrecioVenta = 'MARKUP';
  private porcentajePrecioVentaDefecto = 30;

  protected readonly form = this.fb.nonNullable.group({
    numero: [''],
    proveedorId: ['', [Validators.required]],
    estado: ['BORRADOR' as EstadoOrdenCompra, [Validators.required]],
    almacenId: [''],
    fechaEmision: [new Date(), [Validators.required]],
    notas: [''],
    // Sin campo en pantalla: se conservan en el modelo con los valores por defecto de la
    // configuracion de inventario para no romper las OC ya guardadas ni los totales.
    moneda: ['USD', [Validators.required]],
    tipoCambio: [1, [Validators.required, Validators.min(0)]],
    fechaEntregaEsperada: [new Date()],
    items: this.fb.array([])
  });

  protected readonly subtotal = signal(0);
  protected readonly impuesto = signal(0);
  protected readonly total = signal(0);

  protected get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  protected readonly titulo = computed(() => {
    if (this.soloLectura()) {
      return 'Detalle de orden de compra';
    }
    return this.esEdicion() ? 'Editar orden de compra' : 'Nueva orden de compra';
  });

  protected readonly textoBotonGuardar = computed(() => {
    if (this.esRecepcion()) {
      return 'Guardar y recibir';
    }
    return this.esEdicion() ? 'Actualizar' : 'Crear';
  });

  async ngOnInit(): Promise<void> {
    this.proveedoresService
      .getProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((proveedores) => this.proveedores.set(proveedores.filter((p) => p.activo !== false)));

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        // Una plantilla de variantes no tiene stock propio: se compran sus variantes.
        this.productos.set(productos.filter((p) => esComprable(p)));
        const map: Record<string, Producto> = {};
        productos.forEach((producto) => {
          if (producto.id) {
            map[producto.id] = producto;
          }
        });
        this.productosMap.set(map);
        this.sincronizarPreciosActuales();
      });

    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);
        const porDefecto = almacenes.find((a) => a.esPorDefecto) ?? almacenes[0];
        if (porDefecto && !this.form.controls.almacenId.value) {
          this.form.patchValue({ almacenId: porDefecto.id ?? '' }, { emitEvent: false });
        }
      });

    this.form.controls.estado.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => this.aplicarEstado(estado));

    void this.integracionContable
      .contabilidadActiva()
      .then((activa) => this.comprobanteObligatorio.set(activa))
      .catch(() => this.comprobanteObligatorio.set(false));

    const config = await this.configService.getConfiguracionOnce();
    this.impuestoPorcentajeDefecto = Number(config.impuestoPorDefecto ?? 12);
    this.metodoPrecioVentaDefecto = config.metodoPrecioVentaDefecto;
    this.porcentajePrecioVentaDefecto = config.porcentajePrecioVentaDefecto;
    this.form.patchValue({ moneda: config.monedaBase });

    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.soloLectura.set(path.includes('/ver'));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.agregarItem();
      return;
    }

    this.ordenId.set(id);
    const orden = await this.ordenesService.getOrdenCompraById(id);
    if (!orden) {
      return;
    }

    const impuestoPorcentajeFallback = orden.subtotal > 0 ? (orden.impuesto * 100) / orden.subtotal : 0;
    this.form.patchValue({
      numero: orden.numero,
      proveedorId: orden.proveedorId,
      estado: orden.estado as EstadoOrdenCompra,
      moneda: orden.moneda,
      tipoCambio: orden.tipoCambio,
      fechaEmision: new Date(orden.fechaEmision),
      fechaEntregaEsperada: orden.fechaEntregaEsperada ? new Date(orden.fechaEntregaEsperada) : new Date(),
      notas: orden.notas ?? ''
    });

    const items = await this.ordenesService.getItemsOrden(id);
    this.items.clear();
    items.forEach((item) => this.items.push(this.crearGrupoItem(item, impuestoPorcentajeFallback)));
    if (this.items.length === 0) {
      this.agregarItem();
    }

    this.recalcularTotales();
    this.sincronizarPreciosActuales();

    // Una OC ya recibida o anulada no se vuelve a editar: el stock y el borrador contable ya existen.
    if (orden.estado === 'RECIBIDA' || orden.estado === 'ANULADA') {
      this.soloLectura.set(true);
    }

    if (this.soloLectura()) {
      this.form.disable({ emitEvent: false });
    }
  }

  /** Sincroniza el estado seleccionado y la obligatoriedad del almacen. */
  private aplicarEstado(estado: EstadoOrdenCompra): void {
    this.estadoSeleccionado.set(estado);
    const almacenControl = this.form.controls.almacenId;
    if (estado === 'RECIBIDA') {
      almacenControl.addValidators(Validators.required);
    } else {
      almacenControl.removeValidators(Validators.required);
    }
    almacenControl.updateValueAndValidity({ emitEvent: false });
  }

  private crearGrupoItem(item: Partial<OrdenCompraItem>, impuestoFallback = this.impuestoPorcentajeDefecto) {
    return this.fb.nonNullable.group({
      productoId: [item.productoId ?? '', [Validators.required]],
      descripcion: [item.descripcion ?? '', [Validators.required]],
      cantidad: [item.cantidad ?? 1, [Validators.required, Validators.min(0.0001)]],
      costoUnitario: [item.costoUnitario ?? 0, [Validators.required, Validators.min(0)]],
      impuestoPorcentaje: [item.impuestoPorcentaje ?? impuestoFallback, [Validators.required, Validators.min(0), Validators.max(100)]],
      cantidadRecibida: [item.cantidadRecibida ?? 0],
      metodoPrecioVenta: [this.metodoPrecioVentaDefecto as MetodoPrecioVenta],
      porcentajePrecioVenta: [this.porcentajePrecioVentaDefecto, [Validators.min(0), Validators.max(99.99)]],
      precioVentaActual: [0],
      precioVentaNuevo: [0, [Validators.min(0)]],
      actualizarPrecioVenta: [false]
    });
  }

  protected agregarItem(): void {
    this.items.push(this.crearGrupoItem({}));
    this.recalcularTotales();
    this.sincronizarPreciosActuales();
  }

  protected eliminarItem(index: number): void {
    if (this.items.length <= 1) {
      return;
    }

    this.items.removeAt(index);
    this.recalcularTotales();
  }

  protected actualizarDescripcionDesdeProducto(index: number): void {
    const control = this.items.at(index);
    const productoId = control.get('productoId')?.value as string;
    const producto = this.productos().find((p) => p.id === productoId);
    if (!producto) {
      return;
    }

    control.patchValue({
      descripcion: producto.nombre,
      costoUnitario: producto.precioCosto,
      precioVentaActual: producto.precioVenta,
      precioVentaNuevo: producto.precioVenta
    }, { emitEvent: false });

    this.recalcularTotales();
  }

  protected descripcionItem(index: number): string {
    return String(this.items.at(index)?.get('descripcion')?.value ?? '');
  }

  protected costoItem(index: number): number {
    return Number(this.items.at(index)?.get('costoUnitario')?.value ?? 0);
  }

  protected precioVentaActual(index: number): number {
    return Number(this.items.at(index)?.get('precioVentaActual')?.value ?? 0);
  }

  protected precioSugeridoItem(index: number): number {
    const group = this.items.at(index);
    if (!group) {
      return 0;
    }

    const metodo = (group.get('metodoPrecioVenta')?.value as MetodoPrecioVenta | undefined) ?? this.metodoPrecioVentaDefecto;
    const porcentaje = Number(group.get('porcentajePrecioVenta')?.value ?? this.porcentajePrecioVentaDefecto);
    const costo = this.costoItem(index);

    if (costo <= 0) {
      return 0;
    }

    if (metodo === 'MARGEN_UTILIDAD') {
      const factor = 1 - (porcentaje / 100);
      return factor <= 0 ? costo : this.redondear2(costo / factor);
    }

    return this.redondear2(costo * (1 + (porcentaje / 100)));
  }

  protected usarSugerido(index: number): void {
    this.items.at(index).patchValue({
      precioVentaNuevo: this.precioSugeridoItem(index),
      actualizarPrecioVenta: true
    });
  }

  protected totalItem(index: number): number {
    return this.subtotalItem(index) + this.impuestoItem(index);
  }

  protected subtotalItem(index: number): number {
    const control = this.items.at(index);
    const cantidad = Number(control.get('cantidad')?.value ?? 0);
    const costoUnitario = Number(control.get('costoUnitario')?.value ?? 0);
    return cantidad * costoUnitario;
  }

  protected impuestoItem(index: number): number {
    const control = this.items.at(index);
    const porcentaje = Number(control.get('impuestoPorcentaje')?.value ?? 0);
    return this.subtotalItem(index) * (porcentaje / 100);
  }

  protected recalcularTotales(): void {
    const subtotal = this.items.controls.reduce((sum, _, index) => sum + this.subtotalItem(index), 0);
    const impuesto = this.items.controls.reduce((sum, _, index) => sum + this.impuestoItem(index), 0);
    this.subtotal.set(subtotal);
    this.impuesto.set(impuesto);
    this.total.set(subtotal + impuesto);
  }

  // ---- Comprobantes ----

  protected seleccionarArchivo(tipo: 'xml' | 'pdf'): void {
    const esXml = tipo === 'xml';
    const dialogRef = this.dialog.open<ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult | null>(
      ArchivoSelectorDialogComponent,
      {
        maxWidth: '96vw',
        data: {
          title: esXml ? 'Selecciona el XML de la factura del proveedor' : 'Selecciona el PDF de la factura',
          subtitle: 'Reutiliza un comprobante ya cargado (por ejemplo, los descargados del SRI) o sube uno nuevo.',
          sourceModule: 'compras',
          allowUpload: true,
          extensions: esXml ? ['xml'] : EXTENSIONES_PDF
        }
      }
    );

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result?.archivo) {
        return;
      }
      if (esXml) {
        this.onXmlSubido(result.archivo);
      } else {
        this.onPdfSubido(result.archivo);
      }
    });
  }

  protected onXmlSubido(archivo: ArchivoItem): void {
    this.xmlArchivo.set(archivo);
  }

  protected onPdfSubido(archivo: ArchivoItem): void {
    this.pdfArchivo.set(archivo);
  }

  protected quitarXml(): void {
    this.xmlArchivo.set(null);
  }

  protected quitarPdf(): void {
    this.pdfArchivo.set(null);
  }

  // ---- Guardado ----

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando() || this.soloLectura()) {
      this.form.markAllAsTouched();
      return;
    }

    const recibir = this.esRecepcion();
    if (recibir && this.comprobanteObligatorio() && !this.tieneComprobante()) {
      this.notificar('Adjunta el XML o el PDF de la factura para poder recibir la mercaderia.', 'error');
      return;
    }

    this.guardando.set(true);

    try {
      this.recalcularTotales();

      const raw = this.form.getRawValue();
      const items = this.items.controls.map((group) => {
        const value = group.getRawValue() as Record<string, unknown>;
        return {
          productoId: String(value['productoId']),
          descripcion: String(value['descripcion']),
          cantidad: Number(value['cantidad']),
          cantidadRecibida: Number(value['cantidadRecibida'] ?? 0),
          costoUnitario: Number(value['costoUnitario']),
          impuestoPorcentaje: Number(value['impuestoPorcentaje'] ?? 0),
          costoTotal: Number(value['cantidad']) * Number(value['costoUnitario'])
        };
      });

      // La OC se guarda en BORRADOR aunque el usuario haya elegido RECIBIDA: el estado RECIBIDA
      // lo escribe recibirOrdenCompra() una vez que el stock entro de verdad.
      const ordenPayload = {
        proveedorId: raw.proveedorId,
        estado: (recibir ? 'BORRADOR' : raw.estado) as EstadoOrdenCompra,
        moneda: raw.moneda,
        tipoCambio: Number(raw.tipoCambio),
        subtotal: this.subtotal(),
        impuesto: this.impuesto(),
        total: this.total(),
        fechaEmision: this.toTimestamp(raw.fechaEmision),
        fechaEntregaEsperada: this.toTimestamp(raw.fechaEntregaEsperada),
        notas: raw.notas,
        creadoPor: this.authService.currentUser()?.uid ?? 'sistema'
      };

      let ordenId = this.ordenId();
      if (ordenId) {
        await this.ordenesService.actualizarOrdenCompra(ordenId, ordenPayload);
        await this.ordenesService.reemplazarItemsOrden(ordenId, items);
      } else {
        ordenId = await this.ordenesService.crearOrdenCompra({ orden: ordenPayload, items });
      }

      if (recibir) {
        await this.recibir(ordenId);
        this.notificar('Compra recibida: stock actualizado y borrador creado en Contabilidad.', 'inventory');
      } else {
        this.notificar('Orden de compra guardada.', 'shopping_cart_checkout');
      }

      await this.router.navigate(['/workspace/inventario/ordenes-compra']);
    } catch (error) {
      this.notificar(error instanceof Error ? error.message : 'No fue posible guardar la orden de compra.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Registra la entrada de mercaderia por el pendiente de cada item. Los ids de item se releen
   * porque `reemplazarItemsOrden()` los regenera al guardar.
   */
  private async recibir(ordenId: string): Promise<void> {
    const itemsGuardados = await this.ordenesService.getItemsOrden(ordenId);
    const xml = this.xmlArchivo();
    const pdf = this.pdfArchivo();

    const itemsRecepcion = itemsGuardados
      .map((item, index) => {
        const group = this.items.at(index);
        const pendiente = Math.max(0, item.cantidad - (item.cantidadRecibida ?? 0));
        const actualizarPrecioVenta = !!group?.get('actualizarPrecioVenta')?.value;
        const precioVentaNuevo = Number(group?.get('precioVentaNuevo')?.value ?? 0);

        if (actualizarPrecioVenta && precioVentaNuevo <= 0) {
          throw new Error(`Debes ingresar un nuevo precio de venta valido para ${item.descripcion}.`);
        }

        return {
          itemId: item.id!,
          productoId: item.productoId,
          cantidadRecibida: pendiente,
          costoUnitario: item.costoUnitario,
          actualizarPrecioVenta,
          precioVentaNuevo
        };
      })
      .filter((item) => item.cantidadRecibida > 0);

    if (itemsRecepcion.length === 0) {
      throw new Error('No hay cantidades pendientes por recibir en esta orden.');
    }

    await this.ordenesService.recibirOrdenCompra({
      ordenId,
      almacenId: this.form.controls.almacenId.value,
      items: itemsRecepcion,
      fechaRecepcion: Date.now(),
      notas: this.form.controls.notas.value,
      comprobante: {
        xmlArchivoId: xml?.id ?? null,
        xmlStoragePath: xml?.storagePath ?? null,
        pdfArchivoId: pdf?.id ?? null,
        pdfDownloadUrl: pdf?.downloadUrl ?? null
      },
      userId: this.authService.currentUser()?.uid ?? 'sistema'
    });
  }

  private sincronizarPreciosActuales(): void {
    this.items.controls.forEach((group) => {
      const productoId = String(group.get('productoId')?.value ?? '');
      const producto = this.productosMap()[productoId];
      if (!producto) {
        return;
      }

      const precioActual = Number(producto.precioVenta ?? 0);
      const nuevoActual = Number(group.get('precioVentaNuevo')?.value ?? 0);
      group.patchValue(
        {
          precioVentaActual: precioActual,
          precioVentaNuevo: nuevoActual > 0 ? nuevoActual : precioActual
        },
        { emitEvent: false }
      );
    });
  }

  private notificar(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2800,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private redondear2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
  }
}

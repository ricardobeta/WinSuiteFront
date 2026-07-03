import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { MatDialog } from '@angular/material/dialog';

import { AuthService } from '../../../../core/services/auth.service';
import { ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult } from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import { Almacen, MetodoPrecioVenta, OrdenCompra, OrdenCompraItem, Producto } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { ProductosService } from '../../services/productos.service';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { ComprasXmlService } from '../../../contabilidad/services/compras-xml.service';
import { FacturasCompraService } from '../../../contabilidad/services/facturas-compra.service';
import { FacturaCompra, FacturaCompraItem, FacturaCompraParsed, TipoIdProveedor } from '../../../contabilidad/models/compras.models';

@Component({
  selector: 'app-orden-compra-recepcion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule,
    TwoDecimalInputDirective,
    ArchivoUploaderComponent
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>Recepcion de orden de compra</h2>
        <p>Este flujo es el unico punto que incrementa stock y registra kardex de entrada.</p>
      </header>

      <section class="surface-card form-card">
        @if (orden(); as oc) {
          <div class="oc-meta">
            <p><strong>OC:</strong> {{ oc.numero }}</p>
            <p><strong>Estado:</strong> {{ oc.estado }}</p>
          </div>
        }

        <form [formGroup]="form" class="recepcion-form" (ngSubmit)="confirmarRecepcion()">
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Almacen destino</mat-label>
              <mat-select formControlName="almacenId">
                @for (almacen of almacenes(); track almacen.id) {
                  <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha recepcion</mat-label>
              <input matInput [matDatepicker]="pickerRecepcion" formControlName="fechaRecepcion" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerRecepcion"></mat-datepicker-toggle>
              <mat-datepicker #pickerRecepcion></mat-datepicker>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <textarea matInput rows="3" formControlName="notas"></textarea>
          </mat-form-field>

          @if (integracionContableActiva()) {
            <section class="documento-proveedor">
              <div class="section-head">
                <div>
                  <h3>Documento proveedor</h3>
                  <p>La recepcion solo se contabiliza cuando existe factura o documento del proveedor.</p>
                </div>
                <mat-slide-toggle formControlName="contabilizarRecepcion">Contabilizar esta recepcion</mat-slide-toggle>
              </div>

              @if (form.controls.contabilizarRecepcion.value) {
                <div class="xml-uploader">
                  @if (!facturaParseada()) {
                    <div class="upload-options">
                      <button mat-stroked-button type="button" (click)="seleccionarFacturaExistente()">
                        <mat-icon>folder_open</mat-icon> Seleccionar un XML ya cargado
                      </button>
                      <span class="or-sep">o sube uno nuevo</span>
                    </div>
                    <app-archivo-uploader sourceModule="compras" (uploaded)="onXmlFacturaSubido($event)"></app-archivo-uploader>
                    @if (parseandoXml()) {
                      <p class="xml-hint"><mat-icon>hourglass_top</mat-icon> Analizando la factura del proveedor…</p>
                    }
                    <p class="xml-hint muted">Sube el XML de la factura del proveedor para autocompletar y registrar la factura de compra para el ATS.</p>
                  } @else {
                    <div class="parsed-chip">
                      <mat-icon>description</mat-icon>
                      <span>Factura {{ form.controls.documentoProveedorNumero.value }} cargada · se registrará para el ATS.</span>
                      <button mat-button type="button" (click)="reemplazarXmlFactura()"><mat-icon>autorenew</mat-icon> Reemplazar</button>
                    </div>
                  }
                </div>
              }

              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>Numero documento</mat-label>
                  <input matInput formControlName="documentoProveedorNumero" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha documento</mat-label>
                  <input matInput [matDatepicker]="pickerDocumentoProveedor" formControlName="documentoProveedorFecha" />
                  <mat-datepicker-toggle matIconSuffix [for]="pickerDocumentoProveedor"></mat-datepicker-toggle>
                  <mat-datepicker #pickerDocumentoProveedor></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Autorizacion</mat-label>
                  <input matInput formControlName="documentoProveedorAutorizacion" />
                </mat-form-field>
              </div>

              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>Subtotal</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="documentoProveedorSubtotal" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>IVA</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="documentoProveedorIva" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Total</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="documentoProveedorTotal" />
                </mat-form-field>
              </div>
            </section>
          }

          <div class="table-wrap" formArrayName="items">
            <table mat-table [dataSource]="itemRows()" class="items-table mat-elevation-z0">
              <ng-container matColumnDef="producto">
                <th mat-header-cell *matHeaderCellDef>Producto</th>
                <td mat-cell *matCellDef="let row">{{ row.descripcion }}</td>
              </ng-container>

              <ng-container matColumnDef="cantidadOc">
                <th mat-header-cell *matHeaderCellDef>Cant. OC</th>
                <td mat-cell *matCellDef="let row">{{ row.cantidad }}</td>
              </ng-container>

              <ng-container matColumnDef="yaRecibido">
                <th mat-header-cell *matHeaderCellDef>Ya recibido</th>
                <td mat-cell *matCellDef="let row">{{ row.cantidadRecibida }}</td>
              </ng-container>

              <ng-container matColumnDef="pendiente">
                <th mat-header-cell *matHeaderCellDef>Pendiente</th>
                <td mat-cell *matCellDef="let row; let i = index">{{ pendienteItem(i) }}</td>
              </ng-container>

              <ng-container matColumnDef="ahora">
                <th mat-header-cell *matHeaderCellDef>Ahora</th>
                <td mat-cell *matCellDef="let row; let i = index" [formGroup]="itemGroup(i)">
                  <mat-form-field appearance="outline" class="cantidad-field">
                    <input
                      matInput
                      type="number"
                      min="0"
                      [max]="pendienteItem(i)"
                      formControlName="cantidadAhora"
                    />
                  </mat-form-field>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnasItemsRecepcion"></tr>
              <tr mat-row *matRowDef="let row; columns: columnasItemsRecepcion"></tr>
            </table>
          </div>

          <section class="pricing-section" formArrayName="items">
            <h3>Sugerencia de precio de venta por ingreso</h3>
            <p>
              El sistema sugiere precio por <strong>Margen de utilidad</strong> o <strong>Markup</strong>.
              Puedes mantener el precio actual o aplicar uno nuevo por item.
            </p>

            @for (group of items.controls; track $index) {
              <article class="pricing-card" [formGroupName]="$index">
                <div class="pricing-head">
                  <strong>{{ itemRows()[$index]?.descripcion }}</strong>
                  <span>Costo ingreso: {{ itemRows()[$index]?.costoUnitario | number:'1.2-2' }}</span>
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
          </section>

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/ordenes-compra">Cancelar</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Procesando...' : 'Confirmar recepcion' }}
            </button>
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
    .oc-meta { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .oc-meta p { margin: 0; }
    .recepcion-form { display: grid; gap: 1rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
    .documento-proveedor { display: grid; gap: .75rem; padding: .85rem; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .5rem; background: var(--tc-surface-container-low); }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .section-head h3, .section-head p { margin: 0; }
    .section-head p { color: var(--muted-foreground); font-size: .9rem; }
    .xml-uploader { display: grid; gap: .5rem; }
    .upload-options { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .or-sep { color: var(--muted-foreground); font-size: .85rem; }
    .xml-hint { display: flex; align-items: center; gap: .4rem; margin: 0; }
    .xml-hint.muted { color: var(--muted-foreground); font-size: .85rem; }
    .parsed-chip { display: flex; align-items: center; gap: .6rem; padding: .6rem .85rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 8%, var(--card)); }
    .parsed-chip > mat-icon { color: var(--primary); }
    .parsed-chip span { flex: 1; }
    .table-wrap { overflow: auto; }
    .items-table { width: 100%; min-width: 820px; background: transparent; }
    .cantidad-field { width: 130px; margin-bottom: -1.25em; }
    .pricing-section { display: grid; gap: .75rem; }
    .pricing-section h3 { margin: 0; }
    .pricing-section p { margin: 0; color: var(--muted-foreground); }
    .pricing-card { padding: .8rem; border-radius: .75rem; background: color-mix(in srgb, var(--tc-surface-container-low) 92%, white); display: grid; gap: .75rem; }
    .pricing-head { display: flex; flex-wrap: wrap; gap: 1rem; color: var(--muted-foreground); }
    .pricing-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .pricing-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
      .grid-3 { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .pricing-actions { justify-content: flex-start; flex-wrap: wrap; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class OrdenCompraRecepcionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly ordenesService = inject(OrdenesCompraService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly productosService = inject(ProductosService);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly comprasXml = inject(ComprasXmlService);
  private readonly facturasCompra = inject(FacturasCompraService);
  private readonly dialog = inject(MatDialog);

  protected readonly guardando = signal(false);
  protected readonly integracionContableActiva = signal(false);
  protected readonly parseandoXml = signal(false);
  protected readonly facturaParseada = signal(false);
  private facturaXml: FacturaCompraParsed | null = null;
  private facturaArchivoId: string | null = null;
  private facturaXmlStoragePath: string | null = null;
  protected readonly orden = signal<OrdenCompra | null>(null);
  protected readonly itemRows = signal<OrdenCompraItem[]>([]);
  protected readonly columnasItemsRecepcion = ['producto', 'cantidadOc', 'yaRecibido', 'pendiente', 'ahora'];
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly productosMap = signal<Record<string, Producto>>({});
  protected readonly metodosPrecioVenta: Array<{ value: MetodoPrecioVenta; label: string }> = [
    { value: 'MARGEN_UTILIDAD', label: 'Margen utilidad' },
    { value: 'MARKUP', label: 'Markup' }
  ];
  private metodoPrecioVentaDefecto: MetodoPrecioVenta = 'MARKUP';
  private porcentajePrecioVentaDefecto = 30;

  protected readonly form = this.fb.nonNullable.group({
    almacenId: ['', [Validators.required]],
    fechaRecepcion: [new Date(), [Validators.required]],
    notas: [''],
    contabilizarRecepcion: [false],
    documentoProveedorNumero: [''],
    documentoProveedorFecha: [new Date()],
    documentoProveedorSubtotal: [0],
    documentoProveedorIva: [0],
    documentoProveedorTotal: [0],
    documentoProveedorAutorizacion: [''],
    items: this.fb.array([])
  });

  protected get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  protected itemGroup(index: number): FormGroup {
    return this.items.at(index) as FormGroup;
  }

  async ngOnInit(): Promise<void> {
    const config = await this.configService.getConfiguracionOnce();
    this.metodoPrecioVentaDefecto = config.metodoPrecioVentaDefecto;
    this.porcentajePrecioVentaDefecto = config.porcentajePrecioVentaDefecto;

    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);
        const def = almacenes.find((a) => a.esPorDefecto) ?? almacenes[0];
        if (def && !this.form.controls.almacenId.value) {
          this.form.patchValue({ almacenId: def.id ?? '' });
        }
      });

    this.integracionContable
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.integracionContableActiva.set(config.habilitarAsientosAutomaticos);
        if (!config.habilitarAsientosAutomaticos) {
          this.form.patchValue({ contabilizarRecepcion: false }, { emitEvent: false });
        }
      });

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        const map: Record<string, Producto> = {};
        productos.forEach((producto) => {
          if (producto.id) {
            map[producto.id] = producto;
          }
        });
        this.productosMap.set(map);
        this.sincronizarPreciosActuales();
      });

    const ordenId = this.route.snapshot.paramMap.get('id');
    if (!ordenId) {
      return;
    }

    const orden = await this.ordenesService.getOrdenCompraById(ordenId);
    if (!orden) {
      return;
    }

    const items = await this.ordenesService.getItemsOrden(ordenId);
    this.orden.set(orden);
    this.itemRows.set(items);

    items.forEach(() => {
      this.items.push(this.fb.nonNullable.group({
        cantidadAhora: [0, [Validators.min(0)]],
        metodoPrecioVenta: [this.metodoPrecioVentaDefecto as MetodoPrecioVenta, [Validators.required]],
        porcentajePrecioVenta: [this.porcentajePrecioVentaDefecto, [Validators.required, Validators.min(0), Validators.max(99.99)]],
        precioVentaActual: [0],
        precioVentaNuevo: [0, [Validators.min(0)]],
        actualizarPrecioVenta: [false]
      }));
    });

    this.sincronizarPreciosActuales();
  }

  protected pendienteItem(index: number): number {
    const item = this.itemRows()[index];
    if (!item) {
      return 0;
    }

    return Math.max(0, item.cantidad - (item.cantidadRecibida ?? 0));
  }

  protected precioVentaActual(index: number): number {
    return Number(this.items.at(index)?.get('precioVentaActual')?.value ?? 0);
  }

  protected precioSugeridoItem(index: number): number {
    const row = this.itemRows()[index];
    if (!row) {
      return 0;
    }

    const group = this.items.at(index);
    const metodo = (group.get('metodoPrecioVenta')?.value as MetodoPrecioVenta | undefined) ?? this.metodoPrecioVentaDefecto;
    const porcentaje = Number(group.get('porcentajePrecioVenta')?.value ?? this.porcentajePrecioVentaDefecto);
    const costo = Number(row.costoUnitario ?? 0);

    if (costo <= 0) {
      return 0;
    }

    if (metodo === 'MARGEN_UTILIDAD') {
      const factor = 1 - (porcentaje / 100);
      if (factor <= 0) {
        return costo;
      }
      return this.redondear2(costo / factor);
    }

    return this.redondear2(costo * (1 + (porcentaje / 100)));
  }

  protected usarSugerido(index: number): void {
    const sugerido = this.precioSugeridoItem(index);
    this.items.at(index).patchValue({
      precioVentaNuevo: sugerido,
      actualizarPrecioVenta: true
    });
  }

  protected async confirmarRecepcion(): Promise<void> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    const orden = this.orden();
    if (!orden?.id) {
      return;
    }

    const payloadItems = this.items.controls
      .map((group, index) => ({
        group,
        row: this.itemRows()[index],
        cantidadAhora: Number(group.get('cantidadAhora')?.value ?? 0)
      }))
      .filter((item) => !!item.row && item.cantidadAhora > 0)
      .map((item) => {
        const pendiente = Math.max(0, item.row.cantidad - (item.row.cantidadRecibida ?? 0));
        if (item.cantidadAhora > pendiente) {
          throw new Error(`La cantidad supera el pendiente para ${item.row.descripcion}.`);
        }

        const actualizarPrecioVenta = !!item.group.get('actualizarPrecioVenta')?.value;
        const precioVentaNuevo = Number(item.group.get('precioVentaNuevo')?.value ?? 0);
        if (actualizarPrecioVenta && precioVentaNuevo <= 0) {
          throw new Error(`Debes ingresar un nuevo precio de venta valido para ${item.row.descripcion}.`);
        }

        return {
          itemId: item.row.id!,
          productoId: item.row.productoId,
          cantidadRecibida: item.cantidadAhora,
          costoUnitario: item.row.costoUnitario,
          actualizarPrecioVenta,
          precioVentaNuevo
        };
      });

    if (payloadItems.length === 0) {
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'No hay cantidades para recibir.', icon: 'info' },
        duration: 1800,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    this.guardando.set(true);

    try {
      await this.ordenesService.recibirOrdenCompra({
        ordenId: orden.id,
        almacenId: this.form.controls.almacenId.value,
        items: payloadItems,
        fechaRecepcion: this.toTimestamp(this.form.controls.fechaRecepcion.value),
        notas: this.form.controls.notas.value,
        contabilizarRecepcion: this.form.controls.contabilizarRecepcion.value,
        documentoProveedorNumero: this.form.controls.documentoProveedorNumero.value.trim(),
        documentoProveedorFecha: this.toTimestamp(this.form.controls.documentoProveedorFecha.value),
        documentoProveedorSubtotal: Number(this.form.controls.documentoProveedorSubtotal.value ?? 0),
        documentoProveedorIva: Number(this.form.controls.documentoProveedorIva.value ?? 0),
        documentoProveedorTotal: Number(this.form.controls.documentoProveedorTotal.value ?? 0),
        documentoProveedorAutorizacion: this.form.controls.documentoProveedorAutorizacion.value.trim(),
        userId: this.authService.currentUser()?.uid ?? 'sistema'
      });

      if (this.form.controls.contabilizarRecepcion.value && this.facturaXml) {
        await this.registrarFacturaCompraDesdeRecepcion(orden);
      }

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Recepcion registrada correctamente.', icon: 'inventory' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/inventario/ordenes-compra']);
    } catch (error) {
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: error instanceof Error ? error.message : 'No fue posible registrar la recepcion.', icon: 'error' },
        duration: 2800,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    } finally {
      this.guardando.set(false);
    }
  }

  protected seleccionarFacturaExistente(): void {
    const dialogRef = this.dialog.open<ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult | null>(
      ArchivoSelectorDialogComponent,
      {
        maxWidth: '96vw',
        data: {
          title: 'Selecciona el XML de la factura del proveedor',
          subtitle: 'Reutiliza un comprobante ya cargado (por ejemplo, los descargados del SRI) o sube uno nuevo.',
          sourceModule: 'compras',
          allowUpload: true,
          extensions: ['xml']
        }
      }
    );
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.archivo) {
        this.onXmlFacturaSubido(result.archivo);
      }
    });
  }

  protected onXmlFacturaSubido(item: ArchivoItem): void {
    this.facturaArchivoId = item.id;
    this.facturaXmlStoragePath = item.storagePath ?? null;
    if (!item.storagePath) {
      return;
    }
    this.parseandoXml.set(true);
    this.comprasXml.parseXml(item.storagePath).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (parsed) => {
        this.facturaXml = parsed;
        this.parseandoXml.set(false);
        this.facturaParseada.set(true);
        this.form.patchValue({
          documentoProveedorNumero: parsed.secuencialCompleto || `${parsed.establecimiento}-${parsed.puntoEmision}-${parsed.secuencial}`,
          documentoProveedorFecha: parsed.fechaEmision ? new Date(parsed.fechaEmision) : new Date(),
          documentoProveedorSubtotal: Number(parsed.totalSinImpuestos ?? 0),
          documentoProveedorIva: Number(parsed.montoIva ?? 0),
          documentoProveedorTotal: Number(parsed.importeTotal ?? 0),
          documentoProveedorAutorizacion: parsed.claveAcceso ?? ''
        });
      },
      error: () => {
        this.parseandoXml.set(false);
        this.facturaParseada.set(false);
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: 'No se pudo analizar el XML. Puedes ingresar los datos manualmente.', icon: 'error' },
          duration: 2800,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
    });
  }

  protected reemplazarXmlFactura(): void {
    this.facturaParseada.set(false);
    this.facturaXml = null;
  }

  /** Crea una factura de compra (para el ATS) a partir del XML parseado en la recepción. */
  private async registrarFacturaCompraDesdeRecepcion(orden: OrdenCompra): Promise<void> {
    const parsed = this.facturaXml;
    if (!parsed) {
      return;
    }
    const userId = this.authService.currentUser()?.uid ?? 'sistema';
    const fechaEmision = parsed.fechaEmision ? new Date(parsed.fechaEmision).getTime() : Date.now();
    const importeTotal = Number(parsed.importeTotal ?? 0);

    const factura: Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'> = {
      estado: 'REGISTRADA',
      tpIdProv: (parsed.tpIdProv as TipoIdProveedor) ?? '01',
      idProv: parsed.idProv ?? '',
      razonSocialProv: parsed.razonSocialProv ?? '',
      parteRel: 'NO',
      codSustento: '01',
      tipoComprobante: parsed.tipoComprobante ?? '01',
      establecimiento: parsed.establecimiento ?? '',
      puntoEmision: parsed.puntoEmision ?? '',
      secuencial: parsed.secuencial ?? '',
      autorizacion: parsed.claveAcceso ?? '',
      claveAcceso: parsed.claveAcceso ?? '',
      fechaEmision,
      fechaRegistro: Date.now(),
      baseNoGraIva: Number(parsed.baseNoGraIva ?? 0),
      baseImponible: Number(parsed.baseImponible ?? 0),
      baseImpGrav: Number(parsed.baseImpGrav ?? 0),
      baseImpExe: Number(parsed.baseImpExe ?? 0),
      montoIce: Number(parsed.montoIce ?? 0),
      montoIva: Number(parsed.montoIva ?? 0),
      totalSinImpuestos: Number(parsed.totalSinImpuestos ?? 0),
      importeTotal,
      formasDePago: importeTotal >= 500 ? ['20'] : [],
      pagoExterior: { pagoLocExt: '01' },
      retencionesRenta: [],
      retencionesIva: [],
      totalRetencion: 0,
      // El inventario ya lo alimentó la recepción; esta factura es solo el registro tributario/ATS.
      alimentaInventario: false,
      almacenId: null,
      ordenCompraId: orden.id ?? null,
      archivoId: this.facturaArchivoId,
      xmlStoragePath: this.facturaXmlStoragePath,
      creadoPor: userId
    };

    const items: Omit<FacturaCompraItem, 'id'>[] = (parsed.items ?? []).map((item) => {
      const subtotal = this.redondear2(Number(item.cantidad ?? 0) * Number(item.precioUnitario ?? 0));
      const iva = this.redondear2(subtotal * Number(item.ivaPorcentaje ?? 0) / 100);
      return {
        productoId: null,
        codigoPrincipal: item.codigoPrincipal ?? '',
        descripcion: item.descripcion ?? '',
        cantidad: Number(item.cantidad ?? 0),
        costoUnitario: Number(item.precioUnitario ?? 0),
        descuento: Number(item.descuento ?? 0),
        ivaPorcentaje: Number(item.ivaPorcentaje ?? 0),
        subtotal,
        iva,
        total: this.redondear2(subtotal + iva)
      };
    });

    await this.facturasCompra.crearFacturaCompra({ factura, items });
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

  private redondear2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private sincronizarPreciosActuales(): void {
    if (this.itemRows().length === 0 || this.items.length === 0) {
      return;
    }

    this.itemRows().forEach((row, index) => {
      const producto = this.productosMap()[row.productoId];
      const precioActual = Number(producto?.precioVenta ?? 0);
      const group = this.items.at(index);
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
}

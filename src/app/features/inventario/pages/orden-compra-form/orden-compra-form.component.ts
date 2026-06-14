import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { ProductosService } from '../../services/productos.service';
import { ProveedoresService } from '../../services/proveedores.service';
import { EstadoOrdenCompra, OrdenCompraItem, Producto, Proveedor } from '../../models/inventario.models';

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
    MatNativeDateModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>{{ titulo() }}</h2>
        <p>Gestion de orden de compra sin afectar stock. El stock se actualiza solo en recepcion.</p>
      </header>

      <section class="surface-card form-card">
        <form class="oc-form" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="grid-2">
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
          </div>

          <div class="grid-3">
            <mat-form-field appearance="outline">
              <mat-label>Fecha emision</mat-label>
              <input matInput [matDatepicker]="pickerEmision" formControlName="fechaEmision" [readonly]="soloLectura()" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerEmision"></mat-datepicker-toggle>
              <mat-datepicker #pickerEmision></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha entrega esperada</mat-label>
              <input matInput [matDatepicker]="pickerEntrega" formControlName="fechaEntregaEsperada" [readonly]="soloLectura()" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerEntrega"></mat-datepicker-toggle>
              <mat-datepicker #pickerEntrega></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="estado" [disabled]="soloLectura()">
                @for (estado of estados; track estado) {
                  <mat-option [value]="estado" [disabled]="estado === 'RECIBIDA' || estado === 'RECIBIDA_PARCIAL'">{{ estado }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <div class="grid-3">
            <mat-form-field appearance="outline">
              <mat-label>Moneda</mat-label>
              <input matInput formControlName="moneda" [readonly]="soloLectura()" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tipo cambio</mat-label>
              <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="tipoCambio" [readonly]="soloLectura()" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <textarea matInput rows="3" formControlName="notas" [readonly]="soloLectura()"></textarea>
          </mat-form-field>

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
                  <mat-label>Impuesto item</mat-label>
                  <input matInput [value]="impuestoItem($index)" readonly />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Total item</mat-label>
                  <input matInput [value]="totalItem($index)" readonly />
                </mat-form-field>

                @if (!soloLectura()) {
                  <button mat-icon-button type="button" color="warn" (click)="eliminarItem($index)">
                    <mat-icon>delete</mat-icon>
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

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/ordenes-compra">Cancelar</a>

            @if (!soloLectura() && puedeEnviar()) {
              <button mat-stroked-button type="button" (click)="enviarOrden()" [disabled]="guardando()">Enviar</button>
            }

            @if (!soloLectura()) {
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
                {{ guardando() ? 'Guardando...' : (esEdicion() ? 'Actualizar' : 'Crear') }}
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
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .items-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .items-header h3 { margin: 0; }
    .items-grid { display: grid; gap: .75rem; }
    .item-row { display: grid; grid-template-columns: 1.3fr 1.3fr .8fr .9fr .9fr .9fr .9fr auto; gap: .6rem; align-items: start; }
    .totales-box { margin-left: auto; text-align: right; display: grid; gap: .25rem; }
    .totales-box p { margin: 0; }
    .total-line { font-weight: 700; }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }
    @media (max-width: 1200px) { .item-row { grid-template-columns: 1fr 1fr 1fr; } }
    @media (max-width: 900px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .actions-row, .items-header { justify-content: flex-start; }
      .item-row { grid-template-columns: 1fr; }
    }
  `]
})
export class OrdenCompraFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly productosService = inject(ProductosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly ordenesService = inject(OrdenesCompraService);

  protected readonly estados: EstadoOrdenCompra[] = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'ANULADA'];
  protected readonly guardando = signal(false);
  protected readonly ordenId = signal<string | null>(null);
  protected readonly esEdicion = computed(() => !!this.ordenId());
  protected readonly soloLectura = signal(false);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  private impuestoPorcentajeDefecto = 12;

  protected readonly form = this.fb.nonNullable.group({
    numero: [''],
    proveedorId: ['', [Validators.required]],
    estado: ['BORRADOR' as EstadoOrdenCompra, [Validators.required]],
    moneda: ['USD', [Validators.required]],
    tipoCambio: [1, [Validators.required, Validators.min(0)]],
    fechaEmision: [new Date(), [Validators.required]],
    fechaEntregaEsperada: [new Date()],
    notas: [''],
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

  protected readonly puedeEnviar = computed(() => this.form.controls.estado.value === 'BORRADOR' && this.esEdicion());

  async ngOnInit(): Promise<void> {
    this.proveedoresService
      .getProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((proveedores) => this.proveedores.set(proveedores.filter((p) => p.activo !== false)));

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => this.productos.set(productos.filter((p) => p.activo !== false)));

    const config = await this.configService.getConfiguracionOnce();
    this.impuestoPorcentajeDefecto = Number(config.impuestoPorDefecto ?? 12);
    this.form.patchValue({
      moneda: config.monedaBase
    });

    this.agregarItem();

    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.soloLectura.set(path.includes('/ver'));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
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
      estado: orden.estado,
      moneda: orden.moneda,
      tipoCambio: orden.tipoCambio,
      fechaEmision: new Date(orden.fechaEmision),
      fechaEntregaEsperada: orden.fechaEntregaEsperada ? new Date(orden.fechaEntregaEsperada) : new Date(),
      notas: orden.notas ?? ''
    });

    const items = await this.ordenesService.getItemsOrden(id);
    this.items.clear();
    items.forEach((item) => {
      this.items.push(this.fb.nonNullable.group({
        productoId: [item.productoId, [Validators.required]],
        descripcion: [item.descripcion, [Validators.required]],
        cantidad: [item.cantidad, [Validators.required, Validators.min(0.0001)]],
        costoUnitario: [item.costoUnitario, [Validators.required, Validators.min(0)]],
        impuestoPorcentaje: [item.impuestoPorcentaje ?? impuestoPorcentajeFallback, [Validators.required, Validators.min(0), Validators.max(100)]],
        cantidadRecibida: [item.cantidadRecibida]
      }));
    });

    this.recalcularTotales();

    if (this.soloLectura()) {
      this.form.disable({ emitEvent: false });
    }
  }

  protected agregarItem(): void {
    this.items.push(this.fb.nonNullable.group({
      productoId: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(0.0001)]],
      costoUnitario: [0, [Validators.required, Validators.min(0)]],
      impuestoPorcentaje: [this.impuestoPorcentajeDefecto, [Validators.required, Validators.min(0), Validators.max(100)]],
      cantidadRecibida: [0]
    }));
    this.recalcularTotales();
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
      costoUnitario: producto.precioCosto
    }, { emitEvent: false });

    this.recalcularTotales();
  }

  protected totalItem(index: number): number {
    const subtotal = this.subtotalItem(index);
    const impuesto = this.impuestoItem(index);
    return subtotal + impuesto;
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

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando() || this.soloLectura()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    try {
      this.recalcularTotales();

      const raw = this.form.getRawValue();
      const items = this.items.controls.map((group) => {
        const value = group.getRawValue();
        return {
          productoId: value.productoId,
          descripcion: value.descripcion,
          cantidad: Number(value.cantidad),
          cantidadRecibida: Number(value.cantidadRecibida ?? 0),
          costoUnitario: Number(value.costoUnitario),
          impuestoPorcentaje: Number(value.impuestoPorcentaje ?? 0),
          costoTotal: Number(value.cantidad) * Number(value.costoUnitario)
        };
      });

      const ordenPayload = {
        proveedorId: raw.proveedorId,
        estado: raw.estado,
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

      const ordenId = this.ordenId();
      if (ordenId) {
        await this.ordenesService.actualizarOrdenCompra(ordenId, ordenPayload);
        await this.ordenesService.reemplazarItemsOrden(ordenId, items);
      } else {
        await this.ordenesService.crearOrdenCompra({
          orden: ordenPayload,
          items
        });
      }

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Orden de compra guardada.', icon: 'shopping_cart_checkout' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/inventario/ordenes-compra']);
    } finally {
      this.guardando.set(false);
    }
  }

  protected async enviarOrden(): Promise<void> {
    const id = this.ordenId();
    if (!id || this.soloLectura()) {
      return;
    }

    await this.ordenesService.cambiarEstadoOrdenCompra(id, 'ENVIADA');
    this.form.patchValue({ estado: 'ENVIADA' });
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message: 'Orden enviada correctamente.', icon: 'send' },
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
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

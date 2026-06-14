import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../../core/services/auth.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CamposCustomFormComponent } from '../../../../shared/components/campos-custom-form/campos-custom-form.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { Almacen, Categoria, MetodoCosteo, Producto, RecetaItem, TipoProductoInventario, Unidad } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { CategoriasService } from '../../services/categorias.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';
import { RecetasService } from '../../services/recetas.service';
import { UnidadesService } from '../../services/unidades.service';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    CamposCustomFormComponent,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="form-page">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>{{ esEdicion() ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <p>Completa la informacion base y los campos personalizados del producto.</p>
      </header>

      <section class="surface-card form-card">
        <form class="producto-form" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>SKU</mat-label>
              <input matInput formControlName="sku" readonly />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="nombre" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Descripcion</mat-label>
            <textarea matInput rows="3" formControlName="descripcion"></textarea>
          </mat-form-field>

          <div class="grid-3">
            <mat-form-field appearance="outline">
              <mat-label>Tipo de producto</mat-label>
              <mat-select formControlName="tipo">
                <mat-option value="SIMPLE">Simple</mat-option>
                <mat-option value="RECETA">Receta</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoria</mat-label>
              <mat-select formControlName="categoriaId">
                @for (categoria of categorias(); track categoria.id) {
                  <mat-option [value]="categoria.id">{{ categoria.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Unidad</mat-label>
              <mat-select formControlName="unidadId">
                @for (unidad of unidades(); track unidad.id) {
                  <mat-option [value]="unidad.id">{{ unidad.nombre }} ({{ unidad.abreviatura }})</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Metodo costeo</mat-label>
              <mat-select formControlName="metodoCosteo">
                @for (metodo of metodosCosteo; track metodo) {
                  <mat-option [value]="metodo">{{ metodo }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          @if (esReceta()) {
            <section class="custom-section">
              <div class="section-header-row">
                <h3>Ingredientes de receta</h3>
                <button mat-stroked-button type="button" (click)="agregarIngrediente()">
                  <mat-icon>add</mat-icon>
                  Agregar ingrediente
                </button>
              </div>

              @if (productosBaseDisponibles().length === 0) {
                <p class="hint">No hay productos ni subrecetas activas para usar como ingredientes.</p>
              }

              @if (ingredientesReceta().length === 0) {
                <p class="hint">Agrega al menos un ingrediente para definir la receta.</p>
              } @else {
                <section class="receta-grid receta-grid-head">
                  <span>Ingrediente</span>
                  <span>Cantidad</span>
                  <span>Unidad</span>
                  <span>Notas</span>
                  <span>Accion</span>
                </section>

                @for (group of ingredientesReceta().controls; track $index) {
                  <div class="receta-grid" [formGroup]="group">
                    <mat-form-field appearance="outline">
                      <mat-label>Ingrediente (producto o subreceta)</mat-label>
                      <mat-select formControlName="productoId" (selectionChange)="onIngredienteProductoChange($index)">
                        @for (producto of productosBaseDisponibles(); track producto.id) {
                          <mat-option [value]="producto.id">{{ producto.nombre }} · {{ producto.sku }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Cantidad</mat-label>
                      <input matInput type="number" min="0.0001" step="0.0001" formControlName="cantidad" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Unidad</mat-label>
                      <input matInput [value]="unidadNombre(group.controls.unidadId.value)" readonly />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Notas</mat-label>
                      <input matInput formControlName="notas" />
                    </mat-form-field>

                    <button mat-icon-button type="button" color="warn" (click)="removerIngrediente($index)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
              }

              <mat-slide-toggle formControlName="permitirInventarioNegativo">
                Permitir inventario negativo con confirmacion en POS
              </mat-slide-toggle>

              <mat-form-field appearance="outline">
                <mat-label>Notas de receta</mat-label>
                <textarea matInput rows="2" formControlName="recetaNotas"></textarea>
              </mat-form-field>
            </section>
          }

          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Precio costo (opcional)</mat-label>
              <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioCosto" placeholder="Se calcula por costeo" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Precio venta</mat-label>
              <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioVenta" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>IVA %</mat-label>
              <input matInput type="number" min="0" max="100" formControlName="ivaPorcentaje" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stock minimo</mat-label>
              <input matInput type="number" min="0" formControlName="stockMinimo" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Stock maximo</mat-label>
            <input matInput type="number" min="0" formControlName="stockMaximo" />
          </mat-form-field>

          <mat-slide-toggle formControlName="activo">Activo</mat-slide-toggle>

          @if (!esEdicion() && !esReceta()) {
            <section class="custom-section">
              <h3>Inventario inicial (opcional)</h3>
              <mat-slide-toggle formControlName="registrarInventarioInicial">Registrar ingreso inicial</mat-slide-toggle>

              @if (form.controls.registrarInventarioInicial.value) {
                <div class="grid-3">
                  <mat-form-field appearance="outline">
                    <mat-label>Almacen destino</mat-label>
                    <mat-select formControlName="almacenInicialId">
                      @for (almacen of almacenes(); track almacen.id) {
                        <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Cantidad inicial</mat-label>
                    <input matInput type="number" min="0" formControlName="cantidadInicial" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Costo unitario inicial</mat-label>
                    <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="costoUnitarioInicial" />
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline">
                  <mat-label>Notas ingreso inicial</mat-label>
                  <textarea matInput rows="2" formControlName="notasInventarioInicial"></textarea>
                </mat-form-field>
              }
            </section>
          }

          @if (camposCustom().length > 0) {
            <section class="custom-section">
              <h3>Informacion adicional</h3>
              <app-campos-custom-form
                formControlName="camposPersonalizados"
                [campos]="camposCustom()"
              />
            </section>
          }

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/productos">Cancelar</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando...' : (esEdicion() ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .form-page { display: grid; gap: 1rem; }
    .header-card, .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .producto-form { display: grid; gap: 1rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .custom-section { display: grid; gap: .75rem; border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); padding-top: 1rem; }
    .custom-section h3 { margin: 0; }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; gap: .75rem; }
    .receta-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr auto; gap: .75rem; align-items: center; }
    .receta-grid-head { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
    .hint { margin: 0; color: var(--muted-foreground); }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }
    @media (max-width: 900px) {
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
      .section-header-row { flex-direction: column; align-items: flex-start; }
      .receta-grid { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class ProductoFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly productosService = inject(ProductosService);
  private readonly configuracionService = inject(ConfiguracionInventarioService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly camposService = inject(CamposInventarioService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly kardexService = inject(KardexService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly recetasService = inject(RecetasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly guardando = signal(false);
  protected readonly productoId = signal<string | null>(null);
  protected readonly esEdicion = computed(() => !!this.productoId());
  protected readonly metodosCosteo: MetodoCosteo[] = ['FIFO', 'LIFO', 'PROMEDIO'];
  protected readonly camposCustom = signal<CampoPersonalizado[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly productosCatalogo = signal<Producto[]>([]);
  protected readonly productoOriginal = signal<Producto | null>(null);
  protected readonly tipoProducto = signal<TipoProductoInventario>('SIMPLE');
  protected readonly esReceta = computed(() => this.tipoProducto() === 'RECETA');
  protected readonly productosBaseDisponibles = computed(() =>
    this.productosCatalogo()
      .filter((producto) => {
        const tipo = producto.tipo ?? 'SIMPLE';
        return tipo === 'SIMPLE' || tipo === 'RECETA';
      })
      .filter((producto) => !!producto.id && producto.id !== this.productoId())
      .filter((producto) => producto.activo !== false)
  );
  private skuPrefix = 'PROD-';

  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    descripcion: [''],
    tipo: ['SIMPLE' as TipoProductoInventario, [Validators.required]],
    categoriaId: ['', [Validators.required]],
    unidadId: ['', [Validators.required]],
    metodoCosteo: ['PROMEDIO' as MetodoCosteo, [Validators.required]],
    precioCosto: [0, [Validators.min(0)]],
    precioVenta: [0, [Validators.required, Validators.min(0)]],
    ivaPorcentaje: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    stockMaximo: [0, [Validators.min(0)]],
    activo: [true],
    permitirInventarioNegativo: [false],
    recetaNotas: [''],
    recetaItems: this.formBuilder.array([
    ] as Array<ReturnType<ProductoFormComponent['createIngredienteGroup']>>),
    registrarInventarioInicial: [false],
    almacenInicialId: [''],
    cantidadInicial: [0, [Validators.min(0)]],
    costoUnitarioInicial: [0, [Validators.min(0)]],
    notasInventarioInicial: [''],
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({})
  });

  async ngOnInit(): Promise<void> {
    const config = await this.configuracionService.getConfiguracionOnce();
    this.skuPrefix = config.prefijoSKU || 'PROD-';
    this.form.patchValue({ ivaPorcentaje: this.safePercent(config.impuestoPorDefecto) });

    this.camposService
      .getCampos('producto')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        this.camposCustom.set(campos.filter((campo) => campo.activo !== false));
      });

    this.categoriasService
      .getCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categorias) => {
        this.categorias.set(categorias.filter((categoria) => categoria.activo !== false));
      });

    this.unidadesService
      .getUnidades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unidades) => {
        this.unidades.set(unidades.filter((unidad) => unidad.activo !== false));
      });

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        this.productosCatalogo.set(productos);
      });

    this.form.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => {
        const next = tipo ?? 'SIMPLE';
        this.tipoProducto.set(next);

        if (next === 'RECETA') {
          this.form.patchValue({
            registrarInventarioInicial: false,
            cantidadInicial: 0,
            costoUnitarioInicial: 0,
            notasInventarioInicial: ''
          }, { emitEvent: false });
        }

        if (next === 'RECETA' && this.ingredientesReceta().length === 0) {
          this.agregarIngrediente();
        }
      });

    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);

        const defaultAlmacen = almacenes.find((almacen) => almacen.esPorDefecto) ?? almacenes[0];
        if (!this.form.controls.almacenInicialId.value && defaultAlmacen?.id) {
          this.form.patchValue({ almacenInicialId: defaultAlmacen.id }, { emitEvent: false });
        }
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      const tipoParam = this.route.snapshot.queryParamMap.get('tipo');
      const tipoInicial: TipoProductoInventario = tipoParam === 'RECETA' ? 'RECETA' : 'SIMPLE';

      this.form.patchValue({ tipo: tipoInicial }, { emitEvent: true });
      this.tipoProducto.set(tipoInicial);

      if (tipoInicial === 'RECETA' && this.ingredientesReceta().length === 0) {
        this.agregarIngrediente();
      }

      this.form.patchValue({ sku: this.generarSku() });
      return;
    }

    this.productoId.set(id);
    const producto = await this.productosService.getProductoById(id);
    if (!producto) {
      return;
    }

    this.productoOriginal.set(producto);

    this.form.patchValue({
      sku: producto.sku,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      tipo: producto.tipo ?? 'SIMPLE',
      categoriaId: producto.categoriaId,
      unidadId: producto.unidadId,
      metodoCosteo: producto.metodoCosteo,
      precioCosto: producto.precioCosto,
      precioVenta: producto.precioVenta,
      ivaPorcentaje: this.safePercent(producto.ivaPorcentaje),
      stockMinimo: producto.stockMinimo,
      stockMaximo: producto.stockMaximo ?? 0,
      activo: producto.activo,
      permitirInventarioNegativo: producto.permitirInventarioNegativo === true,
      recetaNotas: producto.recetaNotas ?? '',
      camposPersonalizados: producto.camposPersonalizados ?? {}
    });
    this.tipoProducto.set(producto.tipo ?? 'SIMPLE');

    this.ingredientesReceta().clear();
    (producto.recetaItems ?? []).forEach((item) => {
      this.ingredientesReceta().push(this.createIngredienteGroup(item));
    });

    this.form.patchValue({
      registrarInventarioInicial: false,
      cantidadInicial: 0,
      costoUnitarioInicial: this.safeNumber(producto.precioCosto),
      notasInventarioInicial: ''
    }, { emitEvent: false });

    if ((producto.tipo ?? 'SIMPLE') === 'RECETA' && this.ingredientesReceta().length === 0) {
      this.agregarIngrediente();
    }
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    try {
      const raw = this.form.getRawValue();
      const recetaItems = this.normalizarRecetaItems(raw.recetaItems);
      await this.validarRecetaPayload(raw.tipo, recetaItems);

      const payload: Omit<Producto, 'id'> = {
        sku: raw.sku || this.generarSku(),
        nombre: raw.nombre,
        descripcion: raw.descripcion || '',
        tipo: raw.tipo,
        categoriaId: raw.categoriaId,
        unidadId: raw.unidadId,
        metodoCosteo: raw.metodoCosteo,
        precioCosto: this.safeNumber(raw.precioCosto),
        precioVenta: Number(raw.precioVenta),
        ivaPorcentaje: this.safePercent(raw.ivaPorcentaje),
        stockMinimo: raw.tipo === 'RECETA' ? 0 : Number(raw.stockMinimo),
        stockMaximo: raw.tipo === 'RECETA' ? 0 : Number(raw.stockMaximo || 0),
        activo: raw.activo,
        permitirInventarioNegativo: raw.tipo === 'RECETA' ? raw.permitirInventarioNegativo : false,
        recetaNotas: raw.tipo === 'RECETA' ? (raw.recetaNotas || '') : '',
        recetaItems: raw.tipo === 'RECETA' ? recetaItems : [],
        camposPersonalizados: raw.camposPersonalizados ?? {}
      };

      const id = this.productoId();
      if (id) {
        await this.productosService.actualizarProducto(id, payload);
        await this.registrarAuditoriaRecetaSiAplica(id, payload, this.productoOriginal());
      } else {
        const nuevoProductoId = await this.productosService.crearProducto(payload);
        await this.registrarAuditoriaRecetaSiAplica(nuevoProductoId, payload, null);
        await this.registrarInventarioInicialSiAplica(nuevoProductoId, payload);
      }

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Producto guardado correctamente.', icon: 'inventory_2' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/inventario/productos']);
    } finally {
      this.guardando.set(false);
    }
  }

  private generarSku(): string {
    const prefix = (this.skuPrefix || 'PROD-').trim() || 'PROD-';
    const base = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}${base}-${random}`;
  }

  protected ingredientesReceta(): FormArray<ReturnType<ProductoFormComponent['createIngredienteGroup']>> {
    return this.form.controls.recetaItems;
  }

  protected agregarIngrediente(): void {
    this.ingredientesReceta().push(this.createIngredienteGroup());
  }

  protected removerIngrediente(index: number): void {
    this.ingredientesReceta().removeAt(index);
  }

  protected onIngredienteProductoChange(index: number): void {
    const group = this.ingredientesReceta().at(index);
    const productoId = group.controls.productoId.value;
    const producto = this.productosCatalogo().find((item) => item.id === productoId);
    if (!producto) {
      return;
    }

    group.controls.unidadId.setValue(producto.unidadId);
  }

  protected unidadNombre(unidadId: string): string {
    const unidad = this.unidades().find((item) => item.id === unidadId);
    if (!unidad) {
      return 'Sin unidad';
    }

    return `${unidad.nombre} (${unidad.abreviatura})`;
  }

  private createIngredienteGroup(item?: Partial<RecetaItem>) {
    return this.formBuilder.nonNullable.group({
      productoId: [item?.productoId ?? '', [Validators.required]],
      cantidad: [this.safeCantidad(item?.cantidad), [Validators.required, Validators.min(0.0001)]],
      unidadId: [item?.unidadId ?? '', [Validators.required]],
      notas: [item?.notas ?? '']
    });
  }

  private safeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private safePercent(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.min(100, Math.max(0, parsed));
  }

  private safeCantidad(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private normalizarRecetaItems(items: Array<{ productoId: string; cantidad: number; unidadId: string; notas: string }>): RecetaItem[] {
    return items
      .map((item) => ({
        productoId: item.productoId,
        cantidad: this.safeCantidad(item.cantidad),
        unidadId: item.unidadId,
        notas: (item.notas ?? '').trim()
      }))
      .filter((item) => item.productoId.trim().length > 0);
  }

  private async validarRecetaPayload(tipo: TipoProductoInventario, items: RecetaItem[]): Promise<void> {
    if (tipo !== 'RECETA') {
      return;
    }

    if (items.length === 0) {
      throw new Error('Una receta debe tener al menos un ingrediente.');
    }

    const ids = new Set<string>();

    for (const item of items) {
      if (ids.has(item.productoId)) {
        throw new Error('No se permite repetir un ingrediente en la receta.');
      }

      ids.add(item.productoId);

      const producto = await this.productosService.getProductoById(item.productoId);
      if (!producto) {
        throw new Error('Uno de los ingredientes seleccionados no existe.');
      }

      const tipoIngrediente = producto.tipo ?? 'SIMPLE';
      if (tipoIngrediente !== 'SIMPLE' && tipoIngrediente !== 'RECETA') {
        throw new Error('Ingrediente invalido. Solo se permiten productos o subrecetas.');
      }

      const recetaActualId = this.productoId();
      if (recetaActualId && item.productoId === recetaActualId) {
        throw new Error('Una receta no puede incluirse a si misma.');
      }

      if (recetaActualId && tipoIngrediente === 'RECETA') {
        const contieneObjetivo = await this.recetaContieneObjetivo(item.productoId, recetaActualId);
        if (contieneObjetivo) {
          throw new Error('La subreceta seleccionada genera una referencia circular.');
        }
      }

      if (producto.unidadId !== item.unidadId) {
        throw new Error(`La unidad del ingrediente ${producto.nombre} no coincide con su configuracion base.`);
      }
    }
  }

  private async recetaContieneObjetivo(recetaId: string, objetivoId: string, visited = new Set<string>()): Promise<boolean> {
    if (recetaId === objetivoId) {
      return true;
    }

    if (visited.has(recetaId)) {
      return false;
    }

    visited.add(recetaId);

    const receta = await this.productosService.getProductoById(recetaId);
    if (!receta || (receta.tipo ?? 'SIMPLE') !== 'RECETA') {
      return false;
    }

    for (const item of receta.recetaItems ?? []) {
      if (item.productoId === objetivoId) {
        return true;
      }

      const ingrediente = await this.productosService.getProductoById(item.productoId);
      if (!ingrediente || (ingrediente.tipo ?? 'SIMPLE') !== 'RECETA') {
        continue;
      }

      const encontrado = await this.recetaContieneObjetivo(item.productoId, objetivoId, visited);
      if (encontrado) {
        return true;
      }
    }

    return false;
  }

  private async registrarAuditoriaRecetaSiAplica(
    recetaId: string,
    payload: Omit<Producto, 'id'>,
    original: Producto | null
  ): Promise<void> {
    const userId = this.authService.currentUser()?.uid ?? 'sistema';
    const eraReceta = (original?.tipo ?? 'SIMPLE') === 'RECETA';
    const esReceta = (payload.tipo ?? 'SIMPLE') === 'RECETA';

    if (!eraReceta && !esReceta) {
      return;
    }

    if (esReceta) {
      await this.recetasService.registrarAuditoriaReceta({
        recetaId,
        accion: original ? 'EDITADA' : 'CREADA',
        cambiosAntes: original ? this.auditPayloadFromProducto(original) : undefined,
        cambiosDespues: this.auditPayloadFromProducto(payload),
        creadoPor: userId
      });

      const beforeItems = JSON.stringify((original?.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      })));
      const afterItems = JSON.stringify((payload.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      })));

      if (beforeItems !== afterItems) {
        await this.recetasService.registrarAuditoriaReceta({
          recetaId,
          accion: 'INGREDIENTES_CAMBIADOS',
          cambiosAntes: { recetaItems: original?.recetaItems ?? [] },
          cambiosDespues: { recetaItems: payload.recetaItems ?? [] },
          creadoPor: userId
        });
      }

      return;
    }

    await this.recetasService.registrarAuditoriaReceta({
      recetaId,
      accion: 'DESHABILITADA',
      cambiosAntes: this.auditPayloadFromProducto(original),
      cambiosDespues: this.auditPayloadFromProducto(payload),
      creadoPor: userId
    });
  }

  private auditPayloadFromProducto(producto: Partial<Producto> | null): Record<string, any> {
    if (!producto) {
      return {};
    }

    return {
      tipo: producto.tipo ?? 'SIMPLE',
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      permitirInventarioNegativo: producto.permitirInventarioNegativo === true,
      recetaNotas: producto.recetaNotas ?? '',
      recetaItems: (producto.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      }))
    };
  }

  private async registrarInventarioInicialSiAplica(productoId: string, payload: Omit<Producto, 'id'>): Promise<void> {
    if ((payload.tipo ?? 'SIMPLE') === 'RECETA') {
      return;
    }

    if (!this.form.controls.registrarInventarioInicial.value) {
      return;
    }

    const almacenId = this.form.controls.almacenInicialId.value;
    const cantidad = Number(this.form.controls.cantidadInicial.value ?? 0);
    const costo = Number(this.form.controls.costoUnitarioInicial.value ?? payload.precioCosto ?? 0);

    if (!almacenId) {
      throw new Error('Selecciona un almacen para registrar inventario inicial.');
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error('La cantidad inicial debe ser mayor a cero.');
    }

    if (!Number.isFinite(costo) || costo < 0) {
      throw new Error('El costo unitario inicial no puede ser negativo.');
    }

    await this.kardexService.registrarIngresoInicial({
      productoId,
      almacenId,
      cantidad,
      costoUnitario: costo,
      notas: this.form.controls.notasInventarioInicial.value || 'Ingreso inicial desde alta de producto',
      userId: this.authService.currentUser()?.uid ?? 'sistema'
    });
  }
}

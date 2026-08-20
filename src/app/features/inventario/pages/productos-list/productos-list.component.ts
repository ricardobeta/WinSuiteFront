import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PageEvent } from '@angular/material/paginator';

import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { CustomFieldValueComponent } from '../../../../shared/components/custom-field-value/custom-field-value.component';
import { TableColumnDefinition } from '../../../../shared/models/table-preferences.models';
import { Almacen, Producto } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';
import { esGranel, esInsumo, esVariante, usoDe } from '../../utils/producto.util';

type FiltroUso = 'TODOS' | 'VENTA' | 'INSUMO';

@Component({
  selector: 'app-productos-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatTableModule, MatChipsModule, MatFormFieldModule, MatSelectModule, DataTableFrameComponent, CustomFieldValueComponent],
  template: `
    <section class="surface-card page-card">
      <div class="header">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Productos</h2>
          <p>Tabla base con columnas dinamicas de campos personalizados visibles en lista.</p>
        </div>
        <div class="header-actions">
          <mat-form-field appearance="outline" class="warehouse-select">
            <mat-label>Almacen</mat-label>
            <mat-select [value]="almacenSeleccionadoId()" (valueChange)="seleccionarAlmacen($event)">
              @for (almacen of almacenes(); track almacen.id) {
                <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <a mat-raised-button color="primary" routerLink="/workspace/inventario/productos/new" [queryParams]="{ tipo: 'SIMPLE' }">Nuevo producto</a>
        </div>
      </div>

      @if (cargando()) {
        <section class="skeleton-grid">
          @for (n of [1,2,3,4,5]; track n) {
            <article class="skeleton-row"></article>
          }
        </section>
      } @else if (productos().length === 0) {
        <section class="empty-card">
          <h3>Sin productos</h3>
          <p>No hay productos registrados para esta empresa.</p>
        </section>
      } @else {
        <app-data-table-frame
          tableModule="inventario"
          tableId="productos"
          [columns]="columnDefinitions()"
          searchPlaceholder="Buscar por SKU o nombre"
          [total]="productosFiltrados().length"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          (searchChange)="actualizarBusqueda($event)"
          (pageChange)="actualizarPagina($event)"
        >
          <div table-filters class="uso-filtros">
            @for (opcion of filtrosUso; track opcion.valor) {
              <button
                type="button"
                class="uso-chip"
                [class.activo]="filtroUso() === opcion.valor"
                [attr.aria-pressed]="filtroUso() === opcion.valor"
                (click)="seleccionarFiltroUso(opcion.valor)"
              >
                {{ opcion.etiqueta }}
              </button>
            }
          </div>

          <table mat-table [dataSource]="productosPaginados()">
          <ng-container matColumnDef="imagen">
            <th mat-header-cell *matHeaderCellDef>Imagen</th>
            <td mat-cell *matCellDef="let row">
              @if (row.imagen?.url) {
                <img class="miniatura" [src]="row.imagen.url" [alt]="row.nombre" loading="lazy" />
              } @else {
                <span class="miniatura miniatura-vacia">{{ inicial(row) }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef>SKU</th>
            <td mat-cell *matCellDef="let row">{{ row.sku }}</td>
          </ng-container>

          <ng-container matColumnDef="nombre">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let row">
              {{ row.nombre }}
              @if ((row.tipo ?? 'SIMPLE') === 'RECETA') {
                <mat-chip class="chip-receta">Receta</mat-chip>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="uso">
            <th mat-header-cell *matHeaderCellDef>Uso</th>
            <td mat-cell *matCellDef="let row">
              @if (esMateriaPrima(row)) {
                <mat-chip class="chip-insumo">Materia prima</mat-chip>
              } @else {
                <mat-chip class="chip-venta">Venta</mat-chip>
                @if (esPorPeso(row)) {
                  <mat-chip class="chip-granel">Por peso</mat-chip>
                }
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="codigoBarras">
            <th mat-header-cell *matHeaderCellDef>Código de barras</th>
            <td mat-cell *matCellDef="let row">{{ row.codigoBarras || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="descripcion">
            <th mat-header-cell *matHeaderCellDef>Descripción</th>
            <td mat-cell *matCellDef="let row">{{ row.descripcion || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="stockAlmacen">
            <th mat-header-cell *matHeaderCellDef>Stock ({{ nombreAlmacenSeleccionado() }})</th>
            <td mat-cell *matCellDef="let row">
              {{ stockEnAlmacenSeleccionado(row) | number:'1.0-2' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="precioCosto">
            <th mat-header-cell *matHeaderCellDef>P. Costo</th>
            <td mat-cell *matCellDef="let row">{{ row.precioCosto | number:'1.2-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="precioVenta">
            <th mat-header-cell *matHeaderCellDef>P. Venta</th>
            <td mat-cell *matCellDef="let row">{{ row.precioVenta | number:'1.2-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="iva">
            <th mat-header-cell *matHeaderCellDef>IVA</th>
            <td mat-cell *matCellDef="let row">{{ row.ivaPorcentaje | number:'1.0-2' }}%</td>
          </ng-container>

          <ng-container matColumnDef="stockMinimo">
            <th mat-header-cell *matHeaderCellDef>Stock mínimo</th>
            <td mat-cell *matCellDef="let row">{{ row.stockMinimo | number:'1.0-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="stockMaximo">
            <th mat-header-cell *matHeaderCellDef>Stock máximo</th>
            <td mat-cell *matCellDef="let row">{{ row.stockMaximo == null ? '—' : (row.stockMaximo | number:'1.0-2') }}</td>
          </ng-container>

          <ng-container matColumnDef="inventarioNegativo">
            <th mat-header-cell *matHeaderCellDef>Inventario negativo</th>
            <td mat-cell *matCellDef="let row">{{ row.permitirInventarioNegativo ? 'Sí' : 'No' }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip [class.inactivo]="!row.activo">{{ row.activo ? 'Activo' : 'Inactivo' }}</mat-chip>
              @if (isBajoMinimo(row)) {
                <mat-chip class="chip-low">Stock bajo</mat-chip>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <a mat-button [routerLink]="['/workspace/inventario/productos', row.id, 'kardex']">Kardex</a>
              @if ((row.tipo ?? 'SIMPLE') === 'RECETA') {
                <a mat-button [routerLink]="['/workspace/inventario/productos', row.id, 'auditoria-receta']">Auditoria</a>
              }
              <a mat-button [routerLink]="['/workspace/inventario/productos', row.id, 'editar']">Editar</a>
            </td>
          </ng-container>

          @for (campo of camposDisponibles(); track campo.idCampo) {
            <ng-container [matColumnDef]="customColumnId(campo.idCampo)">
              <th mat-header-cell *matHeaderCellDef>{{ campo.nombreMostrar }}</th>
              <td mat-cell *matCellDef="let row">
                <app-custom-field-value [field]="campo" [value]="row.camposPersonalizados?.[campo.idCampo]" />
              </td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
          </table>
        </app-data-table-frame>
      }
    </section>
  `,
  styles: [`
    .page-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); display: grid; gap: 1rem; }
    .header { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
    .header-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .warehouse-select { min-width: 240px; }
    .header h2 { margin: 0; }
    .header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1020px; }
    .inactivo { opacity: .65; }
    .chip-low { margin-left: .35rem; background: var(--tc-error-container); color: var(--tc-on-error-container); }
    .chip-receta { margin-left: .35rem; background: var(--tc-warning-container); color: var(--tc-on-warning-container); }
    .chip-insumo { background: color-mix(in srgb, var(--foreground) 10%, transparent); color: var(--muted-foreground); }
    .chip-venta { background: color-mix(in srgb, var(--primary) 16%, transparent); color: var(--primary); }
    .chip-granel { margin-left: .35rem; background: var(--tc-info-container); color: var(--tc-on-info-container); }
    .miniatura { display: block; width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
    .miniatura-vacia {
      display: grid; place-items: center;
      background: var(--tc-surface-container-low); color: var(--muted-foreground);
      font-weight: 650; font-size: .9rem;
    }
    .uso-filtros { display: flex; flex-wrap: wrap; gap: .4rem; }
    .uso-chip {
      min-height: 44px; padding: .5rem .8rem; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--border); background: transparent;
      color: var(--muted-foreground); font-size: .8rem; font-weight: 600;
    }
    .uso-chip.activo { border-color: transparent; background: color-mix(in srgb, var(--primary) 16%, transparent); color: var(--primary); }
    .empty-card { padding: 1rem; border: 1px dashed color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .75rem; }
    .empty-card h3 { margin: 0; }
    .empty-card p { margin: .4rem 0 0; color: var(--muted-foreground); }
    .skeleton-grid { display: grid; gap: .5rem; }
    .skeleton-row { height: 48px; border-radius: .5rem; background: linear-gradient(90deg, rgba(180,180,180,.18), rgba(180,180,180,.28), rgba(180,180,180,.18)); animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
    @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
    @media (max-width: 600px) {
      .page-card { padding: .85rem; }
      .header-actions, .warehouse-select, .header-actions a { width: 100%; }
      .header-actions a { justify-content: center; }
    }
    @media (prefers-reduced-motion: reduce) { .skeleton-row { animation: none; } }
  `]
})
export class ProductosListComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly camposService = inject(CamposInventarioService);
  private readonly kardexService = inject(KardexService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly almacenSeleccionadoId = signal<string | null>(null);
  protected readonly stockTotales = signal<Record<string, number>>({});
  protected readonly stockPorProductoAlmacen = signal<Record<string, Record<string, number>>>({});
  protected readonly camposDisponibles = signal<CampoPersonalizado[]>([]);
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly filtroUso = signal<FiltroUso>('TODOS');
  protected readonly filtrosUso: Array<{ valor: FiltroUso; etiqueta: string }> = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'VENTA', etiqueta: 'De venta' },
    { valor: 'INSUMO', etiqueta: 'Materia prima' }
  ];
  protected readonly productosFiltrados = computed(() => {
    const uso = this.filtroUso();
    const porUso =
      uso === 'TODOS' ? this.productos() : this.productos().filter((producto) => usoDe(producto) === uso);

    const query = this.normalizar(this.busqueda());
    if (!query) return porUso;
    return porUso.filter((producto) => this.normalizar(`${producto.sku} ${producto.nombre}`).includes(query));
  });
  protected readonly productosPaginados = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.productosFiltrados().slice(start, start + this.pageSize());
  });
  protected readonly productosIndex = computed(() => {
    const index: Record<string, Producto> = {};
    for (const producto of this.productos()) {
      if (producto.id) {
        index[producto.id] = producto;
      }
    }
    return index;
  });
  protected readonly displayedColumns = computed(() => [
    'imagen',
    'sku',
    'nombre',
    'uso',
    'codigoBarras',
    'descripcion',
    'stockAlmacen',
    ...this.camposDisponibles().map((campo) => this.customColumnId(campo.idCampo)),
    'precioCosto',
    'precioVenta',
    'iva',
    'stockMinimo',
    'stockMaximo',
    'inventarioNegativo',
    'estado',
    'acciones'
  ]);
  protected readonly columnDefinitions = computed<TableColumnDefinition[]>(() => [
    { id: 'imagen', label: 'Imagen' },
    { id: 'sku', label: 'SKU' },
    { id: 'nombre', label: 'Nombre' },
    { id: 'uso', label: 'Uso' },
    { id: 'codigoBarras', label: 'Código de barras', defaultVisible: false },
    { id: 'descripcion', label: 'Descripción', defaultVisible: false },
    { id: 'stockAlmacen', label: 'Stock del almacén' },
    ...this.camposDisponibles().map((campo) => ({
      id: this.customColumnId(campo.idCampo),
      label: campo.nombreMostrar,
      group: 'custom' as const,
      defaultVisible: campo.visibleEnLista === true
    })),
    { id: 'precioCosto', label: 'Precio de costo' },
    { id: 'precioVenta', label: 'Precio de venta' },
    { id: 'iva', label: 'IVA', defaultVisible: false },
    { id: 'stockMinimo', label: 'Stock mínimo', defaultVisible: false },
    { id: 'stockMaximo', label: 'Stock máximo', defaultVisible: false },
    { id: 'inventarioNegativo', label: 'Permite inventario negativo', defaultVisible: false },
    { id: 'estado', label: 'Estado' },
    { id: 'acciones', label: 'Acciones', locked: true }
  ]);

  ngOnInit(): void {
    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        // Las recetas tienen su propia pantalla; las variantes se ven dentro de su
        // producto padre. Aqui quedan los productos simples y las plantillas.
        this.productos.set(
          productos.filter((producto) => (producto.tipo ?? 'SIMPLE') === 'SIMPLE' && !esVariante(producto))
        );
        this.cargando.set(false);
      });

    this.kardexService
      .getStockTotalesPorProducto()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((totales) => {
        this.stockTotales.set(totales);
      });

    this.kardexService
      .getStockPorProductoPorAlmacen()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((stock) => {
        this.stockPorProductoAlmacen.set(stock);
      });

    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);

        const seleccionado = this.almacenSeleccionadoId();
        const existeSeleccionado = !!seleccionado && almacenes.some((almacen) => almacen.id === seleccionado);
        if (existeSeleccionado) {
          return;
        }

        const porDefecto = almacenes.find((almacen) => almacen.esPorDefecto)?.id;
        this.almacenSeleccionadoId.set(porDefecto ?? almacenes[0]?.id ?? null);
      });

    this.camposService
      .getCampos('producto')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        this.camposDisponibles.set(campos.filter((campo) => campo.activo !== false));
      });
  }

  protected isBajoMinimo(producto: Producto): boolean {
    const stock = this.stockTotales()[producto.id ?? ''] ?? 0;
    return stock < Number(producto.stockMinimo ?? 0);
  }

  protected customColumnId(idCampo: string): string {
    return `custom_${idCampo}`;
  }

  protected seleccionarAlmacen(almacenId: string | null): void {
    this.almacenSeleccionadoId.set(almacenId);
  }

  protected actualizarBusqueda(value: string): void {
    this.busqueda.set(value);
    this.pageIndex.set(0);
  }

  protected seleccionarFiltroUso(valor: FiltroUso): void {
    this.filtroUso.set(valor);
    this.pageIndex.set(0);
  }

  protected esMateriaPrima(producto: Producto): boolean {
    return esInsumo(producto);
  }

  protected esPorPeso(producto: Producto): boolean {
    return esGranel(producto);
  }

  /** Sustituto de la miniatura cuando el producto todavia no tiene foto. */
  protected inicial(producto: Producto): string {
    return (producto.nombre ?? '?').trim().charAt(0).toUpperCase() || '?';
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected nombreAlmacenSeleccionado(): string {
    const id = this.almacenSeleccionadoId();
    if (!id) {
      return 'Sin seleccion';
    }

    return this.almacenes().find((almacen) => almacen.id === id)?.nombre ?? 'Sin seleccion';
  }

  protected stockEnAlmacenSeleccionado(producto: Producto): number {
    const almacenId = this.almacenSeleccionadoId();
    if (!producto.id || !almacenId) {
      return 0;
    }

    if ((producto.tipo ?? 'SIMPLE') === 'RECETA') {
      return this.capacidadRecetaEnAlmacen(producto.id, almacenId, new Set<string>());
    }

    return this.stockProductoEnAlmacen(producto.id, almacenId);
  }

  private capacidadRecetaEnAlmacen(recetaId: string, almacenId: string, trail: Set<string>): number {
    if (trail.has(recetaId)) {
      return 0;
    }

    const receta = this.productosIndex()[recetaId];
    if (!receta || (receta.tipo ?? 'SIMPLE') !== 'RECETA') {
      return 0;
    }

    const items = (receta.recetaItems ?? []).filter((item) => item.cantidad > 0 && !!item.productoId);
    if (items.length === 0) {
      return 0;
    }

    trail.add(recetaId);

    try {
      let maximo = Number.MAX_SAFE_INTEGER;

      for (const item of items) {
        const ingrediente = this.productosIndex()[item.productoId];
        if (!ingrediente) {
          return 0;
        }

        const stockIngrediente = (ingrediente.tipo ?? 'SIMPLE') === 'RECETA'
          ? this.capacidadRecetaEnAlmacen(item.productoId, almacenId, trail)
          : this.stockProductoEnAlmacen(item.productoId, almacenId);
        const posibles = Math.floor(stockIngrediente / item.cantidad);
        maximo = Math.min(maximo, posibles);
      }

      return Number.isFinite(maximo) ? Math.max(0, maximo) : 0;
    } finally {
      trail.delete(recetaId);
    }
  }

  private stockProductoEnAlmacen(productoId: string, almacenId: string): number {
    return Number(this.stockPorProductoAlmacen()[productoId]?.[almacenId] ?? 0);
  }

  private roundToTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizar(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}

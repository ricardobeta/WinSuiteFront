import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { Almacen, Producto } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-productos-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatTableModule, MatChipsModule, MatFormFieldModule, MatSelectModule],
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
          <p>No hay productos registrados para este tenant.</p>
        </section>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="productos()">
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

          @for (campo of camposVisibles(); track campo.idCampo) {
            <ng-container [matColumnDef]="campo.idCampo">
              <th mat-header-cell *matHeaderCellDef>{{ campo.nombreMostrar }}</th>
              <td mat-cell *matCellDef="let row">{{ valorCampo(row, campo.idCampo) }}</td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
          </table>
        </div>
      }
    </section>
  `,
  styles: [`
    .page-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); display: grid; gap: 1rem; }
    .header { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
    .header-actions { display: flex; gap: .5rem; }
    .warehouse-select { min-width: 240px; }
    .header h2 { margin: 0; }
    .header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1020px; }
    .inactivo { opacity: .65; }
    .chip-low { margin-left: .35rem; background: color-mix(in srgb, #b3261e 14%, transparent); color: #b3261e; }
    .chip-receta { margin-left: .35rem; background: rgb(249 115 22 / 20%); color: rgb(154 52 18); }
    .empty-card { padding: 1rem; border: 1px dashed color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .75rem; }
    .empty-card h3 { margin: 0; }
    .empty-card p { margin: .4rem 0 0; color: var(--muted-foreground); }
    .skeleton-grid { display: grid; gap: .5rem; }
    .skeleton-row { height: 48px; border-radius: .5rem; background: linear-gradient(90deg, rgba(180,180,180,.18), rgba(180,180,180,.28), rgba(180,180,180,.18)); animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
    @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
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
  protected readonly camposVisibles = signal<CampoPersonalizado[]>([]);
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
    'sku',
    'nombre',
    'stockAlmacen',
    ...this.camposVisibles().map((campo) => campo.idCampo),
    'precioCosto',
    'precioVenta',
    'estado',
    'acciones'
  ]);

  ngOnInit(): void {
    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        this.productos.set(productos.filter((producto) => (producto.tipo ?? 'SIMPLE') === 'SIMPLE'));
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
        this.camposVisibles.set(campos.filter((campo) => campo.visibleEnLista));
      });
  }

  protected isBajoMinimo(producto: Producto): boolean {
    const stock = this.stockTotales()[producto.id ?? ''] ?? 0;
    return stock < Number(producto.stockMinimo ?? 0);
  }

  protected valorCampo(producto: Producto, idCampo: string): string {
    const value = producto.camposPersonalizados?.[idCampo];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value === undefined || value === null || value === '' ? '-' : String(value);
  }

  protected seleccionarAlmacen(almacenId: string | null): void {
    this.almacenSeleccionadoId.set(almacenId);
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
}

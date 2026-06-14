import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { Almacen, Producto } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-recetas-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatChipsModule, MatTableModule, MatFormFieldModule, MatSelectModule],
  template: `
    <section class="surface-card page-card">
      <div class="header">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Recetas</h2>
          <p>Gestiona productos de tipo receta y su disponibilidad estimada por insumos.</p>
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
          <a mat-raised-button color="primary" routerLink="/workspace/inventario/productos/new" [queryParams]="{ tipo: 'RECETA' }">Nueva receta</a>
        </div>
      </div>

      @if (cargando()) {
        <section class="skeleton-grid">
          @for (n of [1,2,3,4]; track n) {
            <article class="skeleton-row"></article>
          }
        </section>
      } @else if (recetas().length === 0) {
        <section class="empty-card">
          <h3>Sin recetas</h3>
          <p>No hay productos tipo receta creados para este tenant.</p>
        </section>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="recetas()">
            <ng-container matColumnDef="sku">
              <th mat-header-cell *matHeaderCellDef>SKU</th>
              <td mat-cell *matCellDef="let row">{{ row.sku }}</td>
            </ng-container>

            <ng-container matColumnDef="nombre">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
            </ng-container>

            <ng-container matColumnDef="insumos">
              <th mat-header-cell *matHeaderCellDef>Insumos</th>
              <td mat-cell *matCellDef="let row">{{ cantidadInsumos(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="disponible">
              <th mat-header-cell *matHeaderCellDef>Disp. estimada</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip [class.danger]="disponibilidadReceta(row) <= 0">{{ disponibilidadReceta(row) }}</mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="stockAlmacen">
              <th mat-header-cell *matHeaderCellDef>Stock ({{ nombreAlmacenSeleccionado() }})</th>
              <td mat-cell *matCellDef="let row">
                {{ disponibilidadEnAlmacenSeleccionado(row) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip [class.inactivo]="!row.activo">{{ row.activo ? 'Activa' : 'Inactiva' }}</mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef>Acciones</th>
              <td mat-cell *matCellDef="let row">
                <a mat-button [routerLink]="['/workspace/inventario/productos', row.id, 'editar']">Editar</a>
                <a mat-button [routerLink]="['/workspace/inventario/productos', row.id, 'auditoria-receta']">Auditoria</a>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let row; columns: columnas"></tr>
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
    table { width: 100%; min-width: 980px; }
    mat-chip.inactivo { opacity: .65; }
    mat-chip.danger { background: color-mix(in srgb, #b3261e 16%, transparent); color: #b3261e; }
    .empty-card { padding: 1rem; border: 1px dashed color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .75rem; }
    .empty-card h3 { margin: 0; }
    .empty-card p { margin: .4rem 0 0; color: var(--muted-foreground); }
    .skeleton-grid { display: grid; gap: .5rem; }
    .skeleton-row { height: 48px; border-radius: .5rem; background: linear-gradient(90deg, rgba(180,180,180,.18), rgba(180,180,180,.28), rgba(180,180,180,.18)); animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
    @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
  `]
})
export class RecetasListComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly kardexService = inject(KardexService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly almacenSeleccionadoId = signal<string | null>(null);
  protected readonly stockPorProductoAlmacen = signal<Record<string, Record<string, number>>>({});
  protected readonly columnas = ['sku', 'nombre', 'insumos', 'disponible', 'stockAlmacen', 'estado', 'acciones'];
  protected readonly productosIndex = computed(() => {
    const index: Record<string, Producto> = {};
    for (const producto of this.productos()) {
      if (producto.id) {
        index[producto.id] = producto;
      }
    }
    return index;
  });
  protected readonly recetas = computed(() =>
    this.productos()
      .filter((producto) => (producto.tipo ?? 'SIMPLE') === 'RECETA')
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  );

  ngOnInit(): void {
    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
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
  }

  protected cantidadInsumos(receta: Producto): number {
    return (receta.recetaItems ?? []).length;
  }

  protected disponibilidadReceta(receta: Producto): number {
    const items = (receta.recetaItems ?? []).filter((item) => item.cantidad > 0 && !!item.productoId);
    if (items.length === 0) {
      return 0;
    }

    let maximo = Number.MAX_SAFE_INTEGER;

    for (const item of items) {
      const stock = this.stockProductoTotal(item.productoId);
      const posibles = Math.floor(stock / item.cantidad);
      maximo = Math.min(maximo, posibles);
    }

    return Number.isFinite(maximo) ? Math.max(0, maximo) : 0;
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

  protected disponibilidadEnAlmacenSeleccionado(receta: Producto): number {
    const almacenId = this.almacenSeleccionadoId();
    if (!receta.id || !almacenId) {
      return 0;
    }

    return this.capacidadRecetaEnAlmacen(receta.id, almacenId, new Set<string>());
  }

  private disponibilidadPorAlmacen(receta: Producto): Array<{ almacenId: string; nombre: string; cantidad: number }> {
    if (!receta.id) {
      return [];
    }

    return this.almacenes()
      .filter((almacen) => !!almacen.id)
      .map((almacen) => {
        const almacenId = almacen.id as string;
        return {
          almacenId,
          nombre: almacen.nombre,
          cantidad: this.capacidadRecetaEnAlmacen(receta.id as string, almacenId, new Set<string>())
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
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

  private stockProductoTotal(productoId: string): number {
    return Object.values(this.stockPorProductoAlmacen()[productoId] ?? {})
      .reduce((total, value) => total + Number(value ?? 0), 0);
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

import { Almacen, KardexEntry, Producto } from '../../models/inventario.models';
import { AlmacenesService } from '../../services/almacenes.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-producto-kardex',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Kardex de producto</h2>
          <p>
            @if (producto()) {
              {{ producto()!.nombre }} · {{ producto()!.sku }}
            } @else {
              Detalle de movimientos historicos
            }
          </p>
        </div>

        <div class="header-actions">
          <a mat-stroked-button routerLink="/workspace/inventario/productos">Volver a productos</a>
          <button mat-raised-button color="primary" type="button" (click)="recargar()" [disabled]="cargando()">Recargar</button>
        </div>
      </header>

      <section class="surface-card filtros-card">
        <div class="filtros-grid">
          <mat-form-field appearance="outline">
            <mat-label>Desde</mat-label>
            <input matInput [matDatepicker]="pickerDesde" [value]="fechaDesde()" (dateChange)="fechaDesde.set($event.value ?? null)" />
            <mat-datepicker-toggle matIconSuffix [for]="pickerDesde"></mat-datepicker-toggle>
            <mat-datepicker #pickerDesde></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Hasta</mat-label>
            <input matInput [matDatepicker]="pickerHasta" [value]="fechaHasta()" (dateChange)="fechaHasta.set($event.value ?? null)" />
            <mat-datepicker-toggle matIconSuffix [for]="pickerHasta"></mat-datepicker-toggle>
            <mat-datepicker #pickerHasta></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select [value]="tipoFiltro()" (valueChange)="tipoFiltro.set($event)">
              <mat-option value="TODOS">Todos</mat-option>
              @for (tipo of tiposMovimiento; track tipo) {
                <mat-option [value]="tipo">{{ tipo }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button mat-button type="button" (click)="limpiarFiltros()">Limpiar</button>
        </div>
      </section>

      <section class="kpi-grid">
        <article class="surface-card kpi-card">
          <h4>Entradas</h4>
          <p>{{ totalEntradas() | number:'1.0-2' }}</p>
        </article>
        <article class="surface-card kpi-card">
          <h4>Salidas</h4>
          <p>{{ totalSalidas() | number:'1.0-2' }}</p>
        </article>
        <article class="surface-card kpi-card">
          <h4>Saldo final</h4>
          <p>{{ saldoFinal() | number:'1.0-2' }}</p>
        </article>
      </section>

      @if (cargando()) {
        <section class="surface-card loading-card">
          <p>Cargando movimientos de kardex...</p>
        </section>
      } @else if (movimientosFiltrados().length === 0) {
        <section class="surface-card empty-card">
          <h3>Sin movimientos en filtro</h3>
          <p>No hay registros para los criterios seleccionados.</p>
        </section>
      } @else {
        <section class="surface-card table-card">
          <div class="table-wrap">
            <table mat-table [dataSource]="movimientosFiltrados()">
              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.creadoEn | date:'dd/MM/yyyy HH:mm' }}</td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
              </ng-container>

              <ng-container matColumnDef="motivo">
                <th mat-header-cell *matHeaderCellDef>Motivo</th>
                <td mat-cell *matCellDef="let row">{{ row.motivo }}</td>
              </ng-container>

              <ng-container matColumnDef="almacen">
                <th mat-header-cell *matHeaderCellDef>Almacen</th>
                <td mat-cell *matCellDef="let row">{{ almacenesMap()[row.almacenId] || row.almacenId }}</td>
              </ng-container>

              <ng-container matColumnDef="cantidad">
                <th mat-header-cell *matHeaderCellDef>Cantidad</th>
                <td mat-cell *matCellDef="let row" [class.out]="isSalida(row)">
                  {{ isSalida(row) ? '-' : '+' }}{{ row.cantidad | number:'1.0-2' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="costoUnitario">
                <th mat-header-cell *matHeaderCellDef>C. unit.</th>
                <td mat-cell *matCellDef="let row">{{ row.costoUnitario | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="costoTotal">
                <th mat-header-cell *matHeaderCellDef>C. total</th>
                <td mat-cell *matCellDef="let row">{{ row.costoTotal | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="saldo">
                <th mat-header-cell *matHeaderCellDef>Saldo</th>
                <td mat-cell *matCellDef="let row">{{ row.saldoCantidad | number:'1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="referencia">
                <th mat-header-cell *matHeaderCellDef>Referencia</th>
                <td mat-cell *matCellDef="let row">{{ row.referenciaTipo }} · {{ row.referenciaId }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .page-grid { display: grid; gap: 1rem; }
    .header-card, .filtros-card, .table-card, .loading-card, .empty-card { padding: 1rem 1.25rem; background: var(--tc-surface-container-lowest); }
    .header-card { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .header-actions { display: flex; gap: .5rem; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .filtros-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: .75rem; align-items: center; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
    .kpi-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .kpi-card h4 { margin: 0; color: var(--muted-foreground); font-weight: 500; }
    .kpi-card p { margin: .45rem 0 0; font-size: 1.25rem; font-weight: 700; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1100px; }
    .out { color: #b3261e; font-weight: 700; }
    .empty-card h3 { margin: 0; }
    .empty-card p, .loading-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    @media (max-width: 900px) {
      .header-card { align-items: flex-start; flex-direction: column; }
      .header-actions { width: 100%; }
      .filtros-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ProductoKardexComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly kardexService = inject(KardexService);
  private readonly productosService = inject(ProductosService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly productoId = signal<string>('');
  protected readonly producto = signal<Producto | null>(null);
  protected readonly movimientos = signal<KardexEntry[]>([]);
  protected readonly fechaDesde = signal<Date | null>(null);
  protected readonly fechaHasta = signal<Date | null>(null);
  protected readonly tipoFiltro = signal<'TODOS' | KardexEntry['tipo']>('TODOS');
  protected readonly almacenesMap = signal<Record<string, string>>({});
  protected readonly tiposMovimiento: KardexEntry['tipo'][] = ['ENTRADA', 'SALIDA', 'AJUSTE', 'TRASLADO'];
  protected readonly columnas = ['fecha', 'tipo', 'motivo', 'almacen', 'cantidad', 'costoUnitario', 'costoTotal', 'saldo', 'referencia'];

  protected readonly movimientosFiltrados = computed(() => {
    const tipo = this.tipoFiltro();
    const desdeTs = this.toStartOfDay(this.fechaDesde());
    const hastaTs = this.toEndOfDay(this.fechaHasta());

    return this.movimientos().filter((m) => {
      if (tipo !== 'TODOS' && m.tipo !== tipo) {
        return false;
      }
      if (desdeTs !== null && m.creadoEn < desdeTs) {
        return false;
      }
      if (hastaTs !== null && m.creadoEn > hastaTs) {
        return false;
      }
      return true;
    });
  });

  protected readonly totalEntradas = computed(() =>
    this.movimientosFiltrados()
      .filter((m) => this.isEntrada(m))
      .reduce((sum, m) => sum + Math.abs(m.cantidad), 0)
  );

  protected readonly totalSalidas = computed(() =>
    this.movimientosFiltrados()
      .filter((m) => this.isSalida(m))
      .reduce((sum, m) => sum + Math.abs(m.cantidad), 0)
  );

  protected readonly saldoFinal = computed(() => {
    const rows = this.movimientosFiltrados();
    if (rows.length === 0) {
      return 0;
    }

    return rows[0].saldoCantidad;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.productoId.set(params.get('id') ?? '');
        void this.recargar();
      });

    this.almacenesService
      .getAlmacenes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        const map: Record<string, string> = {};
        almacenes.forEach((a: Almacen) => {
          if (a.id) {
            map[a.id] = a.nombre;
          }
        });
        this.almacenesMap.set(map);
      });
  }

  protected async recargar(): Promise<void> {
    const id = this.productoId();
    if (!id) {
      this.cargando.set(false);
      this.movimientos.set([]);
      this.producto.set(null);
      return;
    }

    this.cargando.set(true);

    try {
      const [producto, movimientos] = await Promise.all([
        this.productosService.getProductoById(id),
        this.kardexService.getMovimientosProducto(id)
      ]);

      this.producto.set(producto);
      this.movimientos.set(movimientos);
    } finally {
      this.cargando.set(false);
    }
  }

  protected isEntrada(mov: KardexEntry): boolean {
    if (mov.tipo === 'ENTRADA') {
      return true;
    }
    if (mov.tipo === 'AJUSTE') {
      return mov.cantidad > 0;
    }
    return mov.tipo === 'TRASLADO' && mov.motivo === 'TRASLADO_ENTRADA';
  }

  protected isSalida(mov: KardexEntry): boolean {
    if (mov.tipo === 'SALIDA') {
      return true;
    }
    if (mov.tipo === 'AJUSTE') {
      return mov.cantidad < 0;
    }
    return mov.tipo === 'TRASLADO' && mov.motivo === 'TRASLADO_SALIDA';
  }

  protected limpiarFiltros(): void {
    this.fechaDesde.set(null);
    this.fechaHasta.set(null);
    this.tipoFiltro.set('TODOS');
  }

  private toStartOfDay(value: Date | null): number | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  private toEndOfDay(value: Date | null): number | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
}

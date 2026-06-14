import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';

import { Producto, RecetaAuditoria } from '../../models/inventario.models';
import { ProductosService } from '../../services/productos.service';
import { RecetasService } from '../../services/recetas.service';

@Component({
  selector: 'app-receta-auditoria',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatTableModule
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Auditoria de receta</h2>
          <p>
            @if (producto()) {
              {{ producto()!.nombre }} · {{ producto()!.sku }}
            } @else {
              Historial de cambios de la receta
            }
          </p>
        </div>

        <div class="header-actions">
          <a mat-stroked-button routerLink="/workspace/inventario/productos">Volver a productos</a>
          @if (productoId()) {
            <a mat-button [routerLink]="['/workspace/inventario/productos', productoId(), 'editar']">Editar receta</a>
          }
        </div>
      </header>

      @if (!esReceta()) {
        <section class="surface-card empty-card">
          <h3>Producto no es receta</h3>
          <p>Este historial solo aplica a productos de tipo receta.</p>
        </section>
      } @else if (cargando()) {
        <section class="surface-card loading-card">
          <p>Cargando auditoria de receta...</p>
        </section>
      } @else if (auditoriaFiltrada().length === 0) {
        <section class="surface-card empty-card">
          <h3>Sin eventos de auditoria</h3>
          <p>Esta receta no tiene cambios registrados aun.</p>
        </section>
      } @else {
        <section class="surface-card table-card">
          <div class="table-wrap">
            <table mat-table [dataSource]="auditoriaFiltrada()">
              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.creadoEn | date:'dd/MM/yyyy HH:mm' }}</td>
              </ng-container>

              <ng-container matColumnDef="accion">
                <th mat-header-cell *matHeaderCellDef>Accion</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.warn]="row.accion === 'DESHABILITADA'">{{ row.accion }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="usuario">
                <th mat-header-cell *matHeaderCellDef>Usuario</th>
                <td mat-cell *matCellDef="let row">{{ row.creadoPor }}</td>
              </ng-container>

              <ng-container matColumnDef="detalle">
                <th mat-header-cell *matHeaderCellDef>Detalle</th>
                <td mat-cell *matCellDef="let row">
                  <p class="detail-text">{{ resumenEvento(row) }}</p>
                </td>
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
    .header-card, .table-card, .loading-card, .empty-card { padding: 1rem 1.25rem; background: var(--tc-surface-container-lowest); }
    .header-card { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .header-actions { display: flex; gap: .5rem; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 900px; }
    mat-chip.warn { background: color-mix(in srgb, #b3261e 18%, transparent); color: #b3261e; }
    .detail-text { margin: 0; white-space: normal; }
    .empty-card h3 { margin: 0; }
    .empty-card p, .loading-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    @media (max-width: 900px) {
      .header-card { align-items: flex-start; flex-direction: column; }
      .header-actions { width: 100%; }
    }
  `]
})
export class RecetaAuditoriaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productosService = inject(ProductosService);
  private readonly recetasService = inject(RecetasService);

  protected readonly productoId = signal<string>('');
  protected readonly producto = signal<Producto | null>(null);
  protected readonly cargando = signal(true);
  protected readonly auditoria = signal<RecetaAuditoria[]>([]);
  protected readonly columnas = ['fecha', 'accion', 'usuario', 'detalle'];
  protected readonly esReceta = computed(() => (this.producto()?.tipo ?? 'SIMPLE') === 'RECETA');
  protected readonly auditoriaFiltrada = computed(() =>
    this.auditoria().filter((item) => item.recetaId === this.productoId())
  );

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id') ?? '';
        this.productoId.set(id);
        this.cargando.set(true);

        if (!id) {
          this.producto.set(null);
          this.auditoria.set([]);
          this.cargando.set(false);
          return;
        }

        void this.productosService.getProductoById(id)
          .then((producto) => {
            this.producto.set(producto);
          })
          .finally(() => {
            this.cargando.set(false);
          });

        this.recetasService
          .getAuditoriaReceta(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((rows) => {
            this.auditoria.set(rows);
          });
      });
  }

  protected resumenEvento(evento: RecetaAuditoria): string {
    const before = JSON.stringify(evento.cambiosAntes ?? {});
    const after = JSON.stringify(evento.cambiosDespues ?? {});

    if (evento.accion === 'INGREDIENTES_CAMBIADOS') {
      return 'Se actualizaron ingredientes o cantidades de la receta.';
    }

    if (before === after) {
      return 'Cambio registrado sin diferencia de payload.';
    }

    return 'Cambio de receta registrado con trazabilidad completa.';
  }
}

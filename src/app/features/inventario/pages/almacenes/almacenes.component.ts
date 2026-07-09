import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { Almacen, AlmacenStockRow } from '../../models/inventario.models';
import { AlmacenFormDialogComponent } from '../../components/almacenes/almacen-form-dialog.component';
import { AlmacenesService } from '../../services/almacenes.service';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatDialogModule, MatSnackBarModule, MatTableModule],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Almacenes</h2>
          <p>Gestiona bodegas/sucursales y visualiza stock por ubicacion.</p>
        </div>
        <button mat-raised-button color="primary" type="button" (click)="nuevoAlmacen()">Nuevo almacen</button>
      </header>

      @if (cargando()) {
        <section class="cards-grid skeleton-grid">
          @for (n of [1,2,3]; track n) {
            <article class="surface-card skeleton-card"></article>
          }
        </section>
      } @else if (almacenes().length === 0) {
        <section class="surface-card empty-card">
          <h3>Sin almacenes</h3>
          <p>Crea el primer almacen para comenzar a registrar recepciones y stock.</p>
          <button mat-raised-button color="primary" type="button" (click)="nuevoAlmacen()">Crear almacen</button>
        </section>
      } @else {
        <section class="cards-grid">
          @for (almacen of almacenes(); track almacen.id) {
            <article class="surface-card almacen-card" [class.default-card]="almacen.esPorDefecto">
              <header>
                <h3>{{ almacen.nombre }}</h3>
                @if (almacen.esPorDefecto) {
                  <span class="chip-default">DEFAULT</span>
                }
              </header>

              <p class="muted">{{ almacen.codigo }} · {{ almacen.tipo }}</p>
              <p class="muted">{{ almacen.direccion || 'Sin direccion' }}</p>

              <p><strong>SKUs activos:</strong> {{ kpiSkus(almacen.id!) }}</p>
              <p><strong>Valor total:</strong> {{ kpiValor(almacen.id!) | number:'1.2-2' }}</p>

              <div class="card-actions">
                <button mat-button type="button" (click)="verStock(almacen)">Ver stock</button>
                <button mat-button type="button" (click)="editarAlmacen(almacen)">Editar</button>
                @if (!almacen.esPorDefecto) {
                  <button mat-button type="button" (click)="marcarDefault(almacen)">Marcar default</button>
                }
                <button mat-button color="warn" type="button" (click)="eliminarAlmacen(almacen)">Eliminar</button>
              </div>
            </article>
          }
        </section>
      }

      @if (almacenSeleccionado()) {
        <section class="surface-card stock-card">
          <div class="stock-header">
            <h3>Stock · {{ almacenSeleccionado()!.nombre }}</h3>
          </div>

          <div class="table-wrap">
            <table mat-table [dataSource]="stockRows()">
              <ng-container matColumnDef="sku">
                <th mat-header-cell *matHeaderCellDef>SKU</th>
                <td mat-cell *matCellDef="let row">{{ row.sku }}</td>
              </ng-container>

              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Producto</th>
                <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
              </ng-container>

              <ng-container matColumnDef="cantidad">
                <th mat-header-cell *matHeaderCellDef>Cant.</th>
                <td mat-cell *matCellDef="let row">{{ row.cantidad }}</td>
              </ng-container>

              <ng-container matColumnDef="reservado">
                <th mat-header-cell *matHeaderCellDef>Reservado</th>
                <td mat-cell *matCellDef="let row">{{ row.reservado }}</td>
              </ng-container>

              <ng-container matColumnDef="disponible">
                <th mat-header-cell *matHeaderCellDef>Disponible</th>
                <td mat-cell *matCellDef="let row" [class.low]="row.bajoMinimo">{{ row.disponible }}</td>
              </ng-container>

              <ng-container matColumnDef="stockMinimo">
                <th mat-header-cell *matHeaderCellDef>Stock min.</th>
                <td mat-cell *matCellDef="let row">{{ row.stockMinimo }}</td>
              </ng-container>

              <ng-container matColumnDef="valorTotal">
                <th mat-header-cell *matHeaderCellDef>Valor</th>
                <td mat-cell *matCellDef="let row">{{ row.valorTotal | number:'1.2-2' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="stockColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: stockColumns"></tr>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .page-grid { display: grid; gap: 1rem; }
    .header-card { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .almacen-card { padding: 1rem; display: grid; gap: .5rem; }
    .almacen-card header { display: flex; justify-content: space-between; align-items: center; gap: .75rem; }
    .almacen-card h3 { margin: 0; font-size: 1.05rem; }
    .muted { margin: 0; color: var(--muted-foreground); }
    .chip-default { background: color-mix(in srgb, var(--primary) 20%, transparent); padding: .2rem .5rem; border-radius: 999px; font-size: .75rem; }
    .default-card { border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent); }
    .card-actions { display: flex; flex-wrap: wrap; gap: .25rem; }
    .stock-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .stock-header h3 { margin: 0 0 .75rem; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 820px; }
    .low { color: #b3261e; font-weight: 700; }
    .empty-card { padding: 1.25rem; display: grid; gap: .5rem; background: var(--tc-surface-container-lowest); }
    .empty-card h3 { margin: 0; }
    .skeleton-grid .skeleton-card { height: 180px; border-radius: .75rem; background: linear-gradient(90deg, rgba(180,180,180,.18), rgba(180,180,180,.28), rgba(180,180,180,.18)); animation: shimmer 1.4s infinite; }
    @keyframes shimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
    @media (max-width: 900px) { .header-card { align-items: flex-start; flex-direction: column; } }
  `]
})
export class AlmacenesComponent implements OnInit {
  private readonly service = inject(AlmacenesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly almacenSeleccionado = signal<Almacen | null>(null);
  protected readonly stockRows = signal<AlmacenStockRow[]>([]);
  protected readonly stockKpi = computed(() => {
    const rows = this.stockRows();
    return {
      skus: rows.filter((row) => row.cantidad > 0).length,
      valor: rows.reduce((sum, row) => sum + row.valorTotal, 0)
    };
  });
  protected readonly stockColumns = ['sku', 'nombre', 'cantidad', 'reservado', 'disponible', 'stockMinimo', 'valorTotal'];
  private stockSub?: Subscription;

  ngOnInit(): void {
    this.service
      .getAlmacenes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);
        this.cargando.set(false);

        if (!this.almacenSeleccionado() && almacenes.length > 0) {
          const target = almacenes.find((a) => a.esPorDefecto) ?? almacenes[0];
          this.verStock(target);
        }
      });
  }

  protected nuevoAlmacen(): void {
    const dialogRef = this.dialog.open(AlmacenFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe((almacen: Almacen | undefined) => {
      if (!almacen) {
        return;
      }

      void this.service
        .guardarAlmacen(almacen)
        .then(async (id) => {
          if (almacen.esPorDefecto) {
            await this.service.marcarComoDefault(id);
          }
          this.toast('Almacen guardado.', 'warehouse');
        })
        .catch(() => this.toast('No fue posible guardar el almacen.', 'error'));
    });
  }

  protected editarAlmacen(almacen: Almacen): void {
    const dialogRef = this.dialog.open(AlmacenFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { almacen }
    });

    dialogRef.afterClosed().subscribe((result: Almacen | undefined) => {
      if (!result) {
        return;
      }

      void this.service
        .guardarAlmacen({ ...result, id: almacen.id })
        .then(async (id) => {
          if (result.esPorDefecto) {
            await this.service.marcarComoDefault(id);
          }
          this.toast('Almacen actualizado.', 'edit');
        })
        .catch(() => this.toast('No fue posible actualizar el almacen.', 'error'));
    });
  }

  protected eliminarAlmacen(almacen: Almacen): void {
    if (!almacen.id) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar almacen',
        message: `¿Deseas eliminar ${almacen.nombre}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.service
        .eliminarAlmacen(almacen.id!)
        .then(() => {
          this.toast('Almacen eliminado.', 'delete');
        })
        .catch(() => this.toast('No fue posible eliminar el almacen.', 'error'));
    });
  }

  protected marcarDefault(almacen: Almacen): void {
    if (!almacen.id) {
      return;
    }

    void this.service
      .marcarComoDefault(almacen.id)
      .then(() => {
        this.toast('Almacen marcado como default.', 'verified');
      })
      .catch(() => this.toast('No fue posible marcar el almacen por defecto.', 'error'));
  }

  protected verStock(almacen: Almacen): void {
    this.almacenSeleccionado.set(almacen);

    if (!almacen.id) {
      this.stockRows.set([]);
      return;
    }

    this.stockSub?.unsubscribe();
    this.stockSub = this.service
      .getStockDetallePorAlmacen(almacen.id)
      .subscribe((rows) => {
        this.stockRows.set(rows);
      });
  }

  protected kpiSkus(almacenId: string): number {
    if (this.almacenSeleccionado()?.id !== almacenId) {
      return 0;
    }

    return this.stockKpi().skus;
  }

  protected kpiValor(almacenId: string): number {
    if (this.almacenSeleccionado()?.id !== almacenId) {
      return 0;
    }

    return this.stockKpi().valor;
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

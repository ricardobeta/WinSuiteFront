import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { AuthService } from '../../../../core/services/auth.service';
import { VentaDocumento } from '../../models/ventas.models';
import { ReversoVentaDialogComponent } from '../reverso-venta-dialog/reverso-venta-dialog.component';
import { VentasService } from '../../services/ventas.service';

@Component({
  selector: 'app-ventas-resumen',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatTableModule,
    DatePipe,
    DecimalPipe
  ],
  template: `
    <section class="surface-card resumen-card">
      <header class="header">
        <div>
          <p class="eyebrow">Ventas</p>
          <h2>Resumen</h2>
          <p>Historial, total vendido y reverso de ventas completadas.</p>
        </div>
      </header>

      <mat-form-field appearance="outline">
        <mat-label>Filtrar por numero o cliente</mat-label>
        <input matInput [formControl]="filtroControl" placeholder="VEN-000001 o nombre" />
      </mat-form-field>

      <section class="kpis">
        <article>
          <p>Total ventas</p>
          <strong>{{ ventasFiltradas().length }}</strong>
        </article>
        <article>
          <p>Monto total</p>
          <strong>{{ totalVendido() | number:'1.2-2' }}</strong>
        </article>
      </section>

      <div class="table-wrap">
        <table mat-table [dataSource]="ventasPaginadas()">
          <ng-container matColumnDef="numero">
            <th mat-header-cell *matHeaderCellDef>Numero</th>
            <td mat-cell *matCellDef="let row">{{ row.numero }}</td>
          </ng-container>

          <ng-container matColumnDef="fecha">
            <th mat-header-cell *matHeaderCellDef>Fecha</th>
            <td mat-cell *matCellDef="let row">{{ row.creadoEn | date:'short' }}</td>
          </ng-container>

          <ng-container matColumnDef="cliente">
            <th mat-header-cell *matHeaderCellDef>Cliente</th>
            <td mat-cell *matCellDef="let row">{{ row.clienteNombre || 'CLIENTE FINAL' }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">{{ row.estado }}</td>
          </ng-container>

          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let row">{{ row.total | number:'1.2-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row" class="actions-col">
              <a mat-button [routerLink]="['/workspace/ventas/resumen', row.id]">Detalle</a>
              <button
                mat-button
                color="warn"
                type="button"
                [disabled]="row.estado !== 'COMPLETADA'"
                (click)="revertir(row)"
              >
                Revertir
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnas"></tr>
          <tr mat-row *matRowDef="let row; columns: columnas"></tr>
        </table>
      </div>

      <mat-paginator
        [length]="ventasFiltradas().length"
        [pageIndex]="pageIndexActual()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="pageSizeOptions"
        showFirstLastButtons
        (page)="onPage($event)"
      ></mat-paginator>
    </section>
  `,
  styles: [`
    .resumen-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .header h2 { margin: 0; }
    .header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .kpis article { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .7rem; padding: .75rem; }
    .kpis p { margin: 0; color: var(--muted-foreground); }
    .kpis strong { font-size: 1.4rem; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 860px; }
    .actions-col { display: inline-flex; gap: .4rem; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr; } }
  `]
})
export class VentasResumenComponent {
  private readonly ventasService = inject(VentasService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly filtroControl = new FormControl('', { nonNullable: true });
  protected readonly ventas = signal<VentaDocumento[]>([]);
  protected readonly columnas = ['numero', 'fecha', 'cliente', 'estado', 'total', 'acciones'];
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly pageSizeOptions = [5, 10, 20, 50];

  protected readonly ventasFiltradas = computed(() => {
    const query = this.filtroControl.value.trim().toLowerCase();

    if (!query) {
      return this.ventas();
    }

    return this.ventas().filter((venta) => {
      return (
        venta.numero.toLowerCase().includes(query) ||
        venta.clienteNombre.toLowerCase().includes(query)
      );
    });
  });

  protected readonly totalVendido = computed(() =>
    this.ventasFiltradas().reduce((acum, venta) => {
      if (venta.estado !== 'COMPLETADA') {
        return acum;
      }

      return acum + venta.total;
    }, 0)
  );

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.ventasFiltradas().length / this.pageSize()))
  );

  protected readonly pageIndexActual = computed(() =>
    Math.min(this.pageIndex(), this.totalPaginas() - 1)
  );

  protected readonly ventasPaginadas = computed(() => {
    const start = this.pageIndexActual() * this.pageSize();
    return this.ventasFiltradas().slice(start, start + this.pageSize());
  });

  constructor() {
    this.ventasService
      .getVentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ventas) => this.ventas.set(ventas));

    this.filtroControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pageIndex.set(0));
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected async revertir(venta: VentaDocumento): Promise<void> {
    if (!venta.id) {
      return;
    }

    const dialogRef = this.dialog.open(ReversoVentaDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        numeroVenta: venta.numero,
        clienteNombre: venta.clienteNombre
      }
    });

    const motivo = await firstValueFrom(dialogRef.afterClosed());
    if (!motivo?.trim()) {
      return;
    }

    const user = this.auth.currentUser();
    if (!user) {
      this.snackBar.open('No hay usuario autenticado.', 'Cerrar', { duration: 2200 });
      return;
    }

    try {
      await this.ventasService.revertirVenta(venta.id, motivo.trim(), user.uid);
      this.snackBar.open('Venta revertida correctamente.', 'Cerrar', { duration: 2400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo revertir la venta.';
      this.snackBar.open(message, 'Cerrar', { duration: 2600 });
    }
  }
}

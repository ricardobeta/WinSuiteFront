import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { OrdenCompra } from '../../models/inventario.models';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';

@Component({
  selector: 'app-ordenes-compra-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatTableModule, MatDialogModule, MatSnackBarModule],
  template: `
    <section class="surface-card page-card">
      <div class="header">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Ordenes de compra</h2>
          <p>Gestion de estados y acciones operativas de recepcion.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/workspace/inventario/ordenes-compra/kanban">Kanban drag and drow</a>
          <a mat-raised-button color="primary" routerLink="/workspace/inventario/ordenes-compra/new">Nueva OC</a>
        </div>
      </div>

      @if (cargando()) {
        <section class="skeleton-grid">
          @for (n of [1,2,3,4]; track n) {
            <article class="skeleton-row"></article>
          }
        </section>
      } @else if (ordenes().length === 0) {
        <section class="empty-card">
          <h3>Sin ordenes de compra</h3>
          <p>Registra la primera OC para iniciar abastecimiento.</p>
        </section>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="ordenes()">
          <ng-container matColumnDef="numero">
            <th mat-header-cell *matHeaderCellDef>N° OC</th>
            <td mat-cell *matCellDef="let row">{{ row.numero }}</td>
          </ng-container>

          <ng-container matColumnDef="fechaEmision">
            <th mat-header-cell *matHeaderCellDef>Fecha emision</th>
            <td mat-cell *matCellDef="let row">{{ row.fechaEmision }}</td>
          </ng-container>

          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let row">{{ row.total | number:'1.2-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">{{ row.estado }}</td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              @if (row.estado === 'BORRADOR') {
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'editar']">Editar</a>
                <button mat-button type="button" (click)="enviar(row)">Enviar</button>
                <button mat-button color="warn" type="button" (click)="anular(row)">Anular</button>
              }
              @if (row.estado === 'ENVIADA') {
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'ver']">Ver</a>
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'recibir']">Recibir</a>
                <button mat-button color="warn" type="button" (click)="anular(row)">Anular</button>
              }
              @if (row.estado === 'RECIBIDA_PARCIAL') {
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'ver']">Ver</a>
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'recibir']">Recibir mas</a>
              }
              @if (row.estado === 'RECIBIDA' || row.estado === 'ANULADA') {
                <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', row.id, 'ver']">Ver</a>
              }
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
    .header h2 { margin: 0; }
    .header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 920px; }
    .empty-card { padding: 1rem; border: 1px dashed color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .75rem; }
    .empty-card h3 { margin: 0; }
    .empty-card p { margin: .4rem 0 0; color: var(--muted-foreground); }
    .skeleton-grid { display: grid; gap: .5rem; }
    .skeleton-row { height: 48px; border-radius: .5rem; background: linear-gradient(90deg, rgba(180,180,180,.18), rgba(180,180,180,.28), rgba(180,180,180,.18)); animation: shimmer 1.3s infinite; }
    @keyframes shimmer { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
    @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
  `]
})
export class OrdenesCompraListComponent implements OnInit {
  private readonly service = inject(OrdenesCompraService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly columnas = ['numero', 'fechaEmision', 'total', 'estado', 'acciones'];

  ngOnInit(): void {
    this.service
      .getOrdenesCompra()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ordenes) => {
        this.ordenes.set(ordenes);
        this.cargando.set(false);
      });
  }

  protected async enviar(orden: OrdenCompra): Promise<void> {
    if (!orden.id) {
      return;
    }

    try {
      await this.service.cambiarEstadoOrdenCompra(orden.id, 'ENVIADA');
      this.mostrarExito('Orden enviada.', 'send');
    } catch (error) {
      this.mostrarExito(error instanceof Error ? error.message : 'No fue posible cambiar el estado.', 'error');
    }
  }

  protected anular(orden: OrdenCompra): void {
    if (!orden.id) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Anular orden de compra',
        message: `¿Deseas anular la OC ${orden.numero}?`,
        confirmText: 'Anular'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.service.cambiarEstadoOrdenCompra(orden.id!, 'ANULADA')
        .then(() => {
          this.mostrarExito('Orden anulada.', 'block');
        })
        .catch((error) => {
          this.mostrarExito(error instanceof Error ? error.message : 'No fue posible anular la orden.', 'error');
        });
    });
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

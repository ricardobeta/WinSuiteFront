import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { PagoProveedor } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';

@Component({
  selector: 'app-pagos-proveedor-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule],
  template: `
    <section class="pagos-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Cuentas por Pagar</p>
          <h2>Pagos a proveedor</h2>
          <p>Egresos registrados y su aplicacion a documentos por pagar.</p>
        </div>
        <div class="header-actions">
          <a mat-button routerLink="/workspace/contabilidad/cuentas-por-pagar">Documentos</a>
          <a mat-raised-button color="primary" routerLink="nuevo"><mat-icon>add</mat-icon> Nuevo pago</a>
        </div>
      </header>

      @if (pagos().length === 0) {
        <section class="surface-card empty">Aun no hay pagos registrados.</section>
      } @else {
        <section class="surface-card table-card">
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Metodo</th>
                  <th>Referencia</th>
                  <th class="num">Monto</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (pago of pagos(); track pago.id) {
                  <tr [class.anulado]="pago.estado === 'ANULADO'">
                    <td>{{ pago.numero }}</td>
                    <td>{{ pago.fecha | date:'dd/MM/yyyy' }}</td>
                    <td>{{ pago.proveedorNombre }}</td>
                    <td>{{ pago.metodoPago }}</td>
                    <td>{{ pago.referencia || '—' }}</td>
                    <td class="num">{{ pago.montoTotal | number:'1.2-2' }}</td>
                    <td><span class="estado" [attr.data-estado]="pago.estado">{{ pago.estado }}</span></td>
                    <td class="acciones">
                      @if (pago.estado === 'REGISTRADO') {
                        <button mat-icon-button color="warn" type="button" aria-label="Anular" (click)="anular(pago)">
                          <mat-icon>block</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .pagos-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .table-card { padding: .5rem; background: var(--tc-surface-container-lowest); }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .estado { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; background: color-mix(in srgb, #2e7d32 22%, transparent); }
    .estado[data-estado='ANULADO'] { background: color-mix(in srgb, var(--outline) 35%, transparent); text-decoration: line-through; }
    tr.anulado { opacity: .6; }
    .acciones { text-align: right; }
    .empty { padding: 2rem; text-align: center; color: var(--muted-foreground); background: var(--tc-surface-container-lowest); }
  `]
})
export class PagosProveedorListComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pagos = signal<PagoProveedor[]>([]);

  ngOnInit(): void {
    this.service.getPagos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pagos) => this.pagos.set(pagos));
  }

  protected async anular(pago: PagoProveedor): Promise<void> {
    if (!pago.id) {
      return;
    }
    try {
      await this.service.anularPago(pago.id);
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Pago anulado y saldos restaurados.', icon: 'block' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    } catch (error: unknown) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudo anular el pago.', 'Cerrar', { duration: 4000 });
    }
  }
}

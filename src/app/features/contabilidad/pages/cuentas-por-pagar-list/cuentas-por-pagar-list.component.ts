import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { DocumentoPorPagar, EstadoDocumentoPorPagar } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';

@Component({
  selector: 'app-cuentas-por-pagar-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="cxp-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Cuentas por Pagar</p>
          <h2>Documentos por pagar</h2>
          <p>Saldo pendiente por proveedor y estado de pago de cada obligacion.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="antiguedad"><mat-icon>schedule</mat-icon> Antiguedad</a>
          <a mat-stroked-button routerLink="pagos"><mat-icon>payments</mat-icon> Pagos</a>
          <a mat-raised-button color="primary" routerLink="nueva"><mat-icon>add</mat-icon> Nueva CxP manual</a>
        </div>
      </header>

      <section class="surface-card totals-card">
        <div class="total-item">
          <span class="label">Saldo total por pagar</span>
          <strong>{{ totalPendiente() | currency:'USD':'symbol':'1.2-2' }}</strong>
        </div>
        <div class="total-item">
          <span class="label">Documentos con saldo</span>
          <strong>{{ conSaldo() }}</strong>
        </div>
      </section>

      <section class="surface-card filters">
        <mat-form-field appearance="outline">
          <mat-label>Buscar proveedor</mat-label>
          <input matInput [ngModel]="filtroProveedor()" (ngModelChange)="filtroProveedor.set($event)" placeholder="Nombre o identificacion" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [ngModel]="filtroEstado()" (ngModelChange)="filtroEstado.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="PENDIENTE">Pendiente</mat-option>
            <mat-option value="PARCIAL">Parcial</mat-option>
            <mat-option value="PAGADA">Pagada</mat-option>
            <mat-option value="ANULADA">Anulada</mat-option>
          </mat-select>
        </mat-form-field>
      </section>

      @if (documentosFiltrados().length === 0) {
        <section class="surface-card empty">No hay documentos por pagar con los filtros actuales.</section>
      } @else {
        <section class="surface-card table-card">
          <app-data-table-frame
            [showSearch]="false"
            [total]="documentosFiltrados().length"
            [pageIndex]="pageIndexActual()"
            [pageSize]="pageSize()"
            (pageChange)="actualizarPagina($event)"
          >
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Proveedor</th>
                  <th>Origen</th>
                  <th>Emision</th>
                  <th>Vence</th>
                  <th class="num">Monto</th>
                  <th class="num">Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (documento of documentosPaginados(); track documento.id) {
                  <tr [class.vencido]="estaVencido(documento)">
                    <td>{{ documento.numero }}</td>
                    <td>
                      <strong>{{ documento.proveedorNombre }}</strong>
                      @if (documento.proveedorIdentificacion) { <span class="sub">{{ documento.proveedorIdentificacion }}</span> }
                    </td>
                    <td><span class="chip">{{ etiquetaOrigen(documento.origenTipo) }}</span></td>
                    <td>{{ documento.fechaEmision | date:'dd/MM/yyyy' }}</td>
                    <td>{{ documento.fechaVencimiento | date:'dd/MM/yyyy' }}</td>
                    <td class="num">{{ documento.montoOriginal | number:'1.2-2' }}</td>
                    <td class="num">{{ documento.saldoPendiente | number:'1.2-2' }}</td>
                    <td><span class="estado" [attr.data-estado]="documento.estadoPago">{{ documento.estadoPago }}</span></td>
                    <td class="acciones">
                      @if (documento.origenTipo === 'MANUAL' && documento.estadoPago !== 'ANULADA' && documento.saldoPendiente === documento.montoOriginal) {
                        <button mat-icon-button color="warn" type="button" aria-label="Anular" (click)="anular(documento)">
                          <mat-icon>block</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </app-data-table-frame>
        </section>
      }
    </section>
  `,
  styles: [`
    .cxp-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .totals-card { padding: 1rem 1.25rem; display: flex; gap: 2.5rem; background: var(--tc-surface-container-lowest); }
    .total-item { display: grid; gap: .2rem; }
    .total-item .label { font-size: .8rem; color: var(--muted-foreground); }
    .total-item strong { font-size: 1.35rem; }
    .filters { padding: 1rem 1.25rem; display: flex; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .filters mat-form-field { min-width: 220px; }
    .table-card { padding: .5rem; background: var(--tc-surface-container-lowest); }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sub { display: block; font-size: .78rem; color: var(--muted-foreground); }
    .chip { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 15%, transparent); }
    .estado { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; }
    .estado[data-estado='PENDIENTE'] { background: var(--tc-warning-container); color: var(--tc-on-warning-container); }
    .estado[data-estado='PARCIAL'] { background: var(--tc-info-container); color: var(--tc-on-info-container); }
    .estado[data-estado='PAGADA'] { background: var(--tc-success-container); color: var(--tc-on-success-container); }
    .estado[data-estado='ANULADA'] { background: color-mix(in srgb, var(--outline) 35%, transparent); text-decoration: line-through; }
    tr.vencido td:nth-child(5) { color: var(--tc-error); font-weight: 600; }
    .acciones { text-align: right; }
    .empty { padding: 2rem; text-align: center; color: var(--muted-foreground); background: var(--tc-surface-container-lowest); }
  `]
})
export class CuentasPorPagarListComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly documentos = signal<DocumentoPorPagar[]>([]);
  protected readonly filtroProveedor = signal('');
  protected readonly filtroEstado = signal<'TODOS' | EstadoDocumentoPorPagar>('TODOS');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly documentosFiltrados = computed(() => {
    const termino = this.filtroProveedor().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.documentos().filter((documento) => {
      const coincideProveedor = !termino
        || documento.proveedorNombre.toLowerCase().includes(termino)
        || (documento.proveedorIdentificacion ?? '').toLowerCase().includes(termino);
      const coincideEstado = estado === 'TODOS' || documento.estadoPago === estado;
      return coincideProveedor && coincideEstado;
    });
  });
  protected readonly pageIndexActual = computed(() =>
    Math.min(this.pageIndex(), Math.max(0, Math.ceil(this.documentosFiltrados().length / this.pageSize()) - 1))
  );
  protected readonly documentosPaginados = computed(() => {
    const start = this.pageIndexActual() * this.pageSize();
    return this.documentosFiltrados().slice(start, start + this.pageSize());
  });

  protected readonly totalPendiente = computed(() => this.documentos()
    .filter((documento) => documento.estadoPago !== 'ANULADA')
    .reduce((suma, documento) => suma + Number(documento.saldoPendiente ?? 0), 0));

  protected readonly conSaldo = computed(() => this.documentos()
    .filter((documento) => documento.estadoPago !== 'ANULADA' && Number(documento.saldoPendiente ?? 0) > 0).length);

  ngOnInit(): void {
    this.service.getDocumentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((documentos) => this.documentos.set(documentos));
  }

  protected estaVencido(documento: DocumentoPorPagar): boolean {
    return documento.estadoPago !== 'PAGADA' && documento.estadoPago !== 'ANULADA'
      && Number(documento.saldoPendiente ?? 0) > 0 && documento.fechaVencimiento < Date.now();
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected etiquetaOrigen(origen: DocumentoPorPagar['origenTipo']): string {
    switch (origen) {
      case 'FACTURA_COMPRA': return 'Factura';
      case 'MANUAL': return 'Manual';
      case 'RETENCION': return 'Retencion';
      case 'NOMINA': return 'Nomina';
      default: return origen;
    }
  }

  protected async anular(documento: DocumentoPorPagar): Promise<void> {
    if (!documento.id) {
      return;
    }
    try {
      await this.service.anularDocumento(documento.id);
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Documento anulado.', icon: 'block' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    } catch (error: unknown) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudo anular.', 'Cerrar', { duration: 4000 });
    }
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { ESTADOS_ORDEN, EstadoOrden, OrdenCompra } from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

/**
 * Ordenes de compra de todas las empresas. Aqui es donde se cierra el circuito de la
 * transferencia: el cliente sube el comprobante y el super administrador lo verifica.
 */
@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="pagina">
      <section class="surface-card bloque">
        <div class="cabecera">
          <div>
            <p class="eyebrow">Cobros</p>
            <h2>Ordenes de compra</h2>
            <p class="sub">
              Las de tarjeta se acreditan solas. Las de transferencia y QR esperan aqui a que
              verifiques el deposito.
            </p>
          </div>
          <button mat-stroked-button type="button" (click)="cargar()" [disabled]="cargando()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>

        <div class="filtros">
          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select [(ngModel)]="filtroEstado" (selectionChange)="cargar()">
              <mat-option value="">Todas</mat-option>
              @for (estado of estados; track estado) {
                <mat-option [value]="estado">{{ etiqueta(estado) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="buscador">
            <mat-label>Buscar por empresa, correo u orden</mat-label>
            <input matInput [(ngModel)]="busqueda" (ngModelChange)="busquedaSignal.set($event)" />
          </mat-form-field>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        @if (pendientes() > 0) {
          <p class="aviso">
            <mat-icon>pending_actions</mat-icon>
            {{ pendientes() }} orden(es) esperando verificacion.
          </p>
        }

        <div class="tabla">
          <table mat-table [dataSource]="filtradas()">
            <ng-container matColumnDef="empresa">
              <th mat-header-cell *matHeaderCellDef>Empresa</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/super-admin/empresas', row.tenantId]">
                  <strong>{{ row.tenantNombre || row.tenantId }}</strong>
                </a>
                <small>{{ row.userEmail }}</small>
              </td>
            </ng-container>

            <ng-container matColumnDef="detalle">
              <th mat-header-cell *matHeaderCellDef>Compra</th>
              <td mat-cell *matCellDef="let row">
                @for (item of row.items ?? []; track item.refId) {
                  <div class="item">{{ item.nombre }} &times;{{ item.cantidad }}</div>
                }
                <small>{{ fecha(row.createdAt) }}</small>
              </td>
            </ng-container>

            <ng-container matColumnDef="metodo">
              <th mat-header-cell *matHeaderCellDef>Metodo</th>
              <td mat-cell *matCellDef="let row">
                {{ metodoLegible(row.metodoPago) }}
                @if (row.referenciaPago) {
                  <small>Ref. {{ row.referenciaPago }}</small>
                }
                @if (row.payphoneAutorizacion) {
                  <small>Aut. {{ row.payphoneAutorizacion }}</small>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.moneda || 'USD' }} {{ (row.totalCentavos / 100).toFixed(2) }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let row">
                <span
                  class="pastilla"
                  [class.pagada]="row.estado === 'PAGADA'"
                  [class.pendiente]="esPendiente(row)"
                  [class.rota]="row.estado === 'APLICANDO'"
                >
                  {{ etiqueta(row.estado) }}
                </span>
                @if (row.revisadaPor) {
                  <small>{{ row.revisadaPor }}</small>
                }
                @if (row.motivoRechazo) {
                  <small>{{ row.motivoRechazo }}</small>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                @if (row.comprobanteUrl) {
                  <a
                    mat-icon-button
                    [href]="row.comprobanteUrl"
                    target="_blank"
                    rel="noopener"
                    matTooltip="Ver comprobante"
                  >
                    <mat-icon>receipt_long</mat-icon>
                  </a>
                }
                @if (esPendiente(row)) {
                  @if (rechazando() === row.id) {
                    <div class="rechazo">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Motivo (lo vera el cliente)</mat-label>
                        <input matInput [(ngModel)]="motivo" maxlength="120" />
                      </mat-form-field>
                      <button mat-button type="button" (click)="rechazando.set('')">Cancelar</button>
                      <button
                        mat-raised-button
                        color="warn"
                        type="button"
                        [disabled]="cargando()"
                        (click)="confirmarRechazo(row)"
                      >
                        Rechazar
                      </button>
                    </div>
                  } @else {
                    <button
                      mat-icon-button
                      color="primary"
                      type="button"
                      matTooltip="Aprobar y acreditar"
                      [disabled]="cargando()"
                      (click)="aprobar(row)"
                    >
                      <mat-icon>check_circle</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      type="button"
                      matTooltip="Rechazar"
                      [disabled]="cargando()"
                      (click)="pedirMotivo(row)"
                    >
                      <mat-icon>cancel</mat-icon>
                    </button>
                  }
                }
                @if (row.estado === 'APLICANDO') {
                  <button
                    mat-icon-button
                    color="warn"
                    type="button"
                    matTooltip="Reintentar la acreditacion"
                    [disabled]="cargando()"
                    (click)="reintentar(row)"
                  >
                    <mat-icon>replay</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let row; columns: columnas"></tr>
          </table>

          @if (filtradas().length === 0 && !cargando()) {
            <p class="vacio">No hay ordenes que coincidan.</p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .pagina { display: grid; gap: 1rem; align-content: start; }
    .bloque { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .cabecera { display: flex; align-items: start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 1.5rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); max-width: 60ch; }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .filtros { display: flex; gap: .8rem; flex-wrap: wrap; }
    .buscador { flex: 1 1 260px; }
    .error { margin: 0; color: #b3261e; }
    .aviso { display: flex; align-items: center; gap: .4rem; margin: 0; color: #8a5300; }
    .tabla { overflow-x: auto; }
    table { width: 100%; }
    td small { display: block; color: var(--muted-foreground); font-size: .78rem; }
    td a { color: inherit; text-decoration: none; }
    td a:hover strong { text-decoration: underline; }
    .item { font-size: .9rem; }
    .pastilla {
      display: inline-block; padding: .15rem .6rem; border-radius: 999px; font-size: .75rem;
      background: var(--tc-surface-container-high); color: var(--muted-foreground);
    }
    .pastilla.pagada { background: color-mix(in srgb, green 16%, transparent); color: #1b5e20; }
    .pastilla.pendiente { background: color-mix(in srgb, orange 18%, transparent); color: #8a5300; }
    .pastilla.rota { background: color-mix(in srgb, red 16%, transparent); color: #b3261e; }
    .vacio { padding: 1rem; margin: 0; color: var(--muted-foreground); }
    .rechazo { display: flex; align-items: center; gap: .4rem; min-width: 340px; }
    .rechazo mat-form-field { flex: 1; }
  `],
})
export class OrdenesComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly columnas = ['empresa', 'detalle', 'metodo', 'total', 'estado', 'acciones'];
  protected readonly estados: EstadoOrden[] = [
    'PENDIENTE_VERIFICACION',
    'PENDIENTE_PAGO',
    'APLICANDO',
    'PAGADA',
    'RECHAZADA',
    'ANULADA',
  ];

  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly busquedaSignal = signal('');
  /** Id de la orden cuyo motivo de rechazo se esta tecleando. */
  protected readonly rechazando = signal('');

  protected filtroEstado = '';
  protected busqueda = '';
  protected motivo = '';

  protected readonly pendientes = computed(
    () => this.ordenes().filter((orden) => orden.estado === 'PENDIENTE_VERIFICACION').length,
  );

  protected readonly filtradas = computed(() => {
    const texto = this.busquedaSignal().trim().toLowerCase();
    if (!texto) return this.ordenes();
    return this.ordenes().filter((orden) =>
      [orden.tenantNombre, orden.userEmail, orden.id, orden.referenciaPago]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto)),
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.api.listarOrdenes(this.filtroEstado).subscribe({
      next: (ordenes) => {
        this.ordenes.set(ordenes);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar las ordenes.');
        this.cargando.set(false);
      },
    });
  }

  protected esPendiente(orden: OrdenCompra): boolean {
    return orden.estado === 'PENDIENTE_PAGO' || orden.estado === 'PENDIENTE_VERIFICACION';
  }

  protected etiqueta(estado: EstadoOrden | string): string {
    return ESTADOS_ORDEN[estado as EstadoOrden] ?? estado;
  }

  protected metodoLegible(metodo: string): string {
    if (metodo === 'payphone') return 'Tarjeta';
    if (metodo === 'transferencia') return 'Transferencia';
    if (metodo === 'qr') return 'QR';
    return metodo;
  }

  protected fecha(epoch: number | null | undefined): string {
    return epoch ? new Date(epoch).toLocaleString('es-EC') : '';
  }

  protected aprobar(orden: OrdenCompra): void {
    const total = `${orden.moneda || 'USD'} ${(orden.totalCentavos / 100).toFixed(2)}`;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Acreditar la compra',
          message: `Se acreditara ${total} a ${orden.tenantNombre ?? orden.tenantId}. Hazlo solo si ya verificaste el deposito.`,
          confirmText: 'Acreditar',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado) {
          this.ejecutar(this.api.aprobarOrden(orden.id), 'Compra acreditada.');
        }
      });
  }

  protected pedirMotivo(orden: OrdenCompra): void {
    this.motivo = '';
    this.rechazando.set(orden.id);
  }

  protected confirmarRechazo(orden: OrdenCompra): void {
    this.rechazando.set('');
    this.ejecutar(this.api.rechazarOrden(orden.id, this.motivo), 'Orden rechazada.');
  }

  protected reintentar(orden: OrdenCompra): void {
    this.ejecutar(this.api.reintentarOrden(orden.id), 'Acreditacion reintentada.');
  }

  private ejecutar(peticion: ReturnType<PlatformApiService['aprobarOrden']>, mensaje: string): void {
    this.cargando.set(true);
    peticion.subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: mensaje },
          duration: 3000,
        });
        this.cargar();
      },
      error: (e: { error?: { error?: string } }) => {
        this.cargando.set(false);
        this.error.set(e?.error?.error ?? 'No se pudo completar la operacion.');
      },
    });
  }
}

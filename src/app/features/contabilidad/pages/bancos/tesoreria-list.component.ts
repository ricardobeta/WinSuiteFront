import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { CuentaBancaria } from '../../models/bancos.models';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { MovimientoTesoreria, TesoreriaService } from '../../services/tesoreria.service';
import { MovimientoTesoreriaDialogComponent } from './movimiento-tesoreria-dialog.component';

@Component({
  selector: 'app-tesoreria-list',
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
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="tes-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Tesorería</h2>
          <p class="support">Registra cheques girados, depósitos y transferencias: generan su asiento contable y quedan listos para conciliar con el extracto.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos">
            <mat-icon>arrow_back</mat-icon>
            Cuentas
          </a>
          @if (canCreate()) {
            <button mat-flat-button color="primary" class="cta" (click)="nuevoMovimiento()">
              <mat-icon>add</mat-icon>
              Registrar movimiento
            </button>
          }
        </div>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Neto período</p>
          <p class="kpi-value">{{ neto() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Cheques/egresos pendientes</p>
          <p class="kpi-value">{{ egresosPendientes() }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Depósitos en tránsito</p>
          <p class="kpi-value">{{ ingresosPendientes() }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Cuenta bancaria</mat-label>
          <mat-select [formControl]="cuenta">
            @for (item of cuentas(); track item.id) {
              <mat-option [value]="item.id">{{ item.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Período obligatorio</mat-label>
          <input matInput type="month" [formControl]="periodo" />
        </mat-form-field>

        <button mat-raised-button color="primary" type="button" class="search-button"
                (click)="buscar()" [disabled]="!cuenta.value || !periodo.value || cargando()">
          <mat-icon>search</mat-icon>
          Buscar
        </button>
      </section>

      <section class="surface-card table-card">
        @if (!consultaRealizada()) {
          <div class="empty-state">
            <mat-icon>manage_search</mat-icon>
            <h3>Selecciona cuenta y período</h3>
          </div>
        } @else if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando…</h3>
          </div>
        } @else if (movimientos().length === 0) {
          <div class="empty-state">
            <mat-icon>savings</mat-icon>
            <h3>Sin movimientos de tesorería</h3>
          </div>
        } @else {
          <app-data-table-frame [showSearch]="false" [showPaginator]="false">
            <table mat-table [dataSource]="movimientos()" class="tes-table">
              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
              </ng-container>

              <ng-container matColumnDef="detalle">
                <th mat-header-cell *matHeaderCellDef>Detalle</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ tipoLabel(row.tipo) }}@if (row.beneficiario) { · {{ row.beneficiario }}}</span>
                    <span class="doc-sub">{{ row.glosa }}@if (row.referencia) { · Ref {{ row.referencia }}}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="monto">
                <th mat-header-cell *matHeaderCellDef class="num">Monto</th>
                <td mat-cell *matCellDef="let row" class="num" [class.neg]="row.monto < 0">
                  {{ row.monto | currency: 'USD':'symbol-narrow':'1.2-2' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="estadoClase(row.estado)">{{ row.estado }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  @if (row.estado === 'REGISTRADO' && canUpdate()) {
                    <button mat-icon-button matTooltip="Anular" (click)="anular(row)">
                      <mat-icon>block</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </app-data-table-frame>
        }
      </section>
    </section>
  `,
  styles: [`
    .tes-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .header-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }
    .filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: 1.5fr 200px auto; gap: .75rem; align-items: start; }
    .search-button { min-height: 56px; }
    .table-card { padding: 1rem 1.25rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .doc-cell { display: grid; }
    .doc-num { font-weight: 500; }
    .doc-sub { font-size: .78rem; color: var(--muted-foreground); }
    td.num, th.num { text-align: right; }
    .tes-table td.neg { color: var(--destructive); }
    .pill { display: inline-flex; border-radius: 999px; padding: .15rem .6rem; font-size: .75rem; font-weight: 600; }
    .pill-registrado { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #b45309; }
    .pill-conciliado { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill-anulado { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    @media (max-width: 900px) { .kpi-row, .filters-card { grid-template-columns: 1fr; } }
  `]
})
export class TesoreriaListComponent {
  private readonly tesoreriaService = inject(TesoreriaService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['fecha', 'detalle', 'monto', 'estado', 'acciones'];
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly movimientos = signal<MovimientoTesoreria[]>([]);
  protected readonly cargando = signal(false);
  protected readonly consultaRealizada = signal(false);

  protected readonly cuenta = new FormControl('', { nonNullable: true });
  protected readonly periodo = new FormControl('', { nonNullable: true });

  protected readonly neto = computed(() =>
    this.movimientos().filter((movimiento) => movimiento.estado !== 'ANULADO')
      .reduce((total, movimiento) => total + movimiento.monto, 0));
  protected readonly egresosPendientes = computed(() =>
    this.movimientos().filter((movimiento) => movimiento.estado === 'REGISTRADO' && movimiento.monto < 0).length);
  protected readonly ingresosPendientes = computed(() =>
    this.movimientos().filter((movimiento) => movimiento.estado === 'REGISTRADO' && movimiento.monto > 0).length);

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA')));
  }

  protected canCreate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'create');
  }

  protected canUpdate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'update');
  }

  protected buscar(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    if (!this.cuenta.value || !this.periodo.value) {
      return;
    }
    this.cargando.set(true);
    this.consultaRealizada.set(true);
    try {
      this.movimientos.set(
        await this.tesoreriaService.getMovimientosPorCuenta(this.cuenta.value, this.periodo.value));
    } catch {
      this.snackBar.open('No se pudieron cargar los movimientos de tesorería.', 'OK', { duration: 4500 });
    } finally {
      this.cargando.set(false);
    }
  }

  protected async nuevoMovimiento(): Promise<void> {
    const result = await firstValueFrom(this.dialog.open(MovimientoTesoreriaDialogComponent, {
      data: { cuentas: this.cuentas(), cuentaBancariaId: this.cuenta.value || null }
    }).afterClosed());
    if (result) {
      this.snackBar.open('Movimiento registrado con su asiento contable.', 'OK', { duration: 4000 });
      await this.cargar();
    }
  }

  protected async anular(movimiento: MovimientoTesoreria): Promise<void> {
    try {
      await this.tesoreriaService.anularMovimiento(movimiento);
      this.snackBar.open('Movimiento anulado. Recuerda reversar su asiento si corresponde.', 'OK', { duration: 5000 });
      await this.cargar();
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo anular.', 'OK', { duration: 4500 });
    }
  }

  protected tipoLabel(tipo: MovimientoTesoreria['tipo']): string {
    return ({
      DEPOSITO: 'Depósito',
      CHEQUE: 'Cheque',
      TRANSFERENCIA_ENVIADA: 'Transferencia enviada',
      TRANSFERENCIA_RECIBIDA: 'Transferencia recibida',
      ND: 'Nota de débito',
      NC: 'Nota de crédito'
    } as Record<string, string>)[tipo] ?? tipo;
  }

  protected estadoClase(estado: MovimientoTesoreria['estado']): string {
    return ({
      REGISTRADO: 'pill pill-registrado',
      CONCILIADO: 'pill pill-conciliado',
      ANULADO: 'pill pill-anulado'
    } as Record<string, string>)[estado] ?? 'pill';
  }
}

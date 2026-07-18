import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { CuentaBancaria } from '../../models/bancos.models';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { CuentaBancariaDialogComponent } from './cuenta-bancaria-dialog.component';

@Component({
  selector: 'app-bancos-cuentas-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="bancos-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Cuentas bancarias</h2>
          <p class="support">Registra tus cuentas, importa extractos de cualquier banco y concilia el período con ayuda de la IA.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos/extractos/importar">
            <mat-icon>upload_file</mat-icon>
            Importar extracto
          </a>
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos/conciliacion">
            <mat-icon>fact_check</mat-icon>
            Conciliación
          </a>
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos/tesoreria">
            <mat-icon>savings</mat-icon>
            Tesorería
          </a>
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos/configuracion/reglas">
            <mat-icon>rule</mat-icon>
            Reglas
          </a>
          @if (canCreate()) {
            <button mat-flat-button color="primary" class="cta" (click)="nuevaCuenta()">
              <mat-icon>add</mat-icon>
              Nueva cuenta
            </button>
          }
        </div>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Cuentas activas</p>
          <p class="kpi-value">{{ cuentasActivas() }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Bancos</p>
          <p class="kpi-value">{{ bancosDistintos() }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Último saldo de extracto</p>
          <p class="kpi-value">{{ ultimoSaldo() !== null ? (ultimoSaldo() | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}</p>
        </article>
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando cuentas…</h3>
          </div>
        } @else if (cuentas().length === 0) {
          <div class="empty-state">
            <mat-icon>account_balance</mat-icon>
            <h3>Sin cuentas bancarias</h3>
            <p>Crea tu primera cuenta y vincúlala a una cuenta contable de activo.</p>
          </div>
        } @else {
          <app-data-table-frame [showSearch]="false" [showPaginator]="false">
            <table mat-table [dataSource]="cuentas()" class="bancos-table">
              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Cuenta</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ row.nombre }}</span>
                    <span class="doc-sub">{{ row.bancoNombre }} · {{ row.numeroCuenta }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill pill-info">{{ row.tipoCuenta === 'CORRIENTE' ? 'Corriente' : 'Ahorros' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="saldo">
                <th mat-header-cell *matHeaderCellDef class="num">Saldo extracto</th>
                <td mat-cell *matCellDef="let row" class="num">
                  @if (row.saldoExtracto) {
                    {{ row.saldoExtracto.valor | currency: 'USD':'symbol-narrow':'1.2-2' }}
                    <span class="doc-sub">al {{ row.saldoExtracto.fecha }}</span>
                  } @else {
                    —
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="row.estado === 'ACTIVA' ? 'pill-success' : 'pill-muted'">{{ row.estado }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <a mat-icon-button matTooltip="Movimientos"
                     [routerLink]="['/workspace/contabilidad/bancos/movimientos']"
                     [queryParams]="{ cuenta: row.id }">
                    <mat-icon>list_alt</mat-icon>
                  </a>
                  @if (canUpdate()) {
                    <button mat-icon-button matTooltip="Editar" (click)="editarCuenta(row)">
                      <mat-icon>edit</mat-icon>
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
    .bancos-page { display: grid; gap: 1rem; }
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
    .table-card { padding: 1rem 1.25rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .doc-cell { display: grid; }
    .doc-num { font-weight: 600; }
    .doc-sub { font-size: .78rem; color: var(--muted-foreground); }
    td.num, th.num { text-align: right; }
    .pill { display: inline-flex; align-items: center; gap: .25rem; border-radius: 999px; padding: .15rem .6rem; font-size: .75rem; font-weight: 600; }
    .pill-info { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .pill-success { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill-muted { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    @media (max-width: 900px) { .kpi-row { grid-template-columns: 1fr; } }
  `]
})
export class BancosCuentasListComponent {
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['nombre', 'tipo', 'saldo', 'estado', 'acciones'];
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly cargando = signal(true);

  protected readonly cuentasActivas = computed(() =>
    this.cuentas().filter((cuenta) => cuenta.estado === 'ACTIVA').length);
  protected readonly bancosDistintos = computed(() =>
    new Set(this.cuentas().map((cuenta) => cuenta.bancoCodigo)).size);
  protected readonly ultimoSaldo = computed(() => {
    const conSaldo = this.cuentas().filter((cuenta) => cuenta.saldoExtracto);
    if (conSaldo.length === 0) {
      return null;
    }
    return conSaldo.reduce((total, cuenta) => total + (cuenta.saldoExtracto?.valor ?? 0), 0);
  });

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuentas) => {
          this.cuentas.set(cuentas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false)
      });
  }

  protected canCreate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'create');
  }

  protected canUpdate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'update');
  }

  protected async nuevaCuenta(): Promise<void> {
    const result = await firstValueFrom(
      this.dialog.open(CuentaBancariaDialogComponent, { data: {} }).afterClosed());
    if (!result) {
      return;
    }
    try {
      await this.cuentasService.crearCuenta(result);
      this.snackBar.open('Cuenta bancaria creada.', 'OK', { duration: 3500 });
    } catch {
      this.snackBar.open('No se pudo crear la cuenta bancaria.', 'OK', { duration: 4500 });
    }
  }

  protected async editarCuenta(cuenta: CuentaBancaria): Promise<void> {
    const result = await firstValueFrom(
      this.dialog.open(CuentaBancariaDialogComponent, { data: { cuenta } }).afterClosed());
    if (!result || !cuenta.id) {
      return;
    }
    try {
      await this.cuentasService.actualizarCuenta(cuenta.id, result);
      this.snackBar.open('Cuenta bancaria actualizada.', 'OK', { duration: 3500 });
    } catch {
      this.snackBar.open('No se pudo actualizar la cuenta bancaria.', 'OK', { duration: 4500 });
    }
  }
}

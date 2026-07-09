import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { AuthService } from '../../../../core/services/auth.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { RolPago } from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';

@Component({
  selector: 'app-nomina-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule
  ],
  template: `
    <section class="roles-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina</p>
          <h2>Roles de pago</h2>
          <p>Genera el rol mensual, ajusta ingresos y descuentos por empleado, y apruebalo para crear su asiento contable.</p>
        </div>
        <div class="header-links">
          <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/rubros">
            <mat-icon>category</mat-icon>
            Rubros
          </a>
          <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/configuracion">
            <mat-icon>settings</mat-icon>
            Configuracion
          </a>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card generator-card">
        <div class="grid-3">
          <mat-form-field appearance="outline">
            <mat-label>Periodo</mat-label>
            <input matInput type="month" [(ngModel)]="periodo" name="periodo" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de pago</mat-label>
            <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" />
            <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
            <mat-datepicker #pickerPago></mat-datepicker>
          </mat-form-field>

          <button mat-raised-button color="primary" type="button" (click)="generar()" [disabled]="procesando()">
            <mat-icon>payments</mat-icon>
            Generar rol
          </button>
        </div>
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_top</mat-icon>
            <h3>Cargando roles</h3>
            <p>Estamos preparando los roles de pago de esta empresa.</p>
          </div>
        } @else if (roles().length === 0) {
          <div class="empty-state">
            <mat-icon>payments</mat-icon>
            <h3>Sin roles generados</h3>
            <p>Configura cuentas y rubros, registra empleados activos y genera el primer rol mensual.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="roles()">
              <ng-container matColumnDef="numero">
                <th mat-header-cell *matHeaderCellDef>Rol</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.numero || row.periodo }}</strong>
                  <span class="muted">{{ row.periodo }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="fechaPago">
                <th mat-header-cell *matHeaderCellDef>Pago</th>
                <td mat-cell *matCellDef="let row">{{ row.fechaPago ? (row.fechaPago | date: 'dd/MM/yyyy') : '' }}</td>
              </ng-container>

              <ng-container matColumnDef="empleados">
                <th mat-header-cell *matHeaderCellDef>Empleados</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmpleados }}</td>
              </ng-container>

              <ng-container matColumnDef="ingresos">
                <th mat-header-cell *matHeaderCellDef class="num">Ingresos</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.totalIngresos | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="neto">
                <th mat-header-cell *matHeaderCellDef class="num">Neto</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.totalNetoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class.ok]="row.estado === 'APROBADO'" [class.off]="row.estado === 'ANULADO'">{{ row.estado }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-raised-button color="primary" type="button" (click)="abrir(row)">
                    {{ row.estado === 'BORRADOR' ? 'Editar' : 'Ver' }}
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .roles-page { display: grid; gap: 1rem; }
    .page-header, .generator-card, .table-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .header-links { display: flex; gap: .5rem; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p, .muted { color: var(--muted-foreground); }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr auto; gap: .75rem; align-items: center; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 780px; }
    td strong, td .muted { display: block; }
    .num { text-align: right; }
    .pill { display: inline-flex; padding: .25rem .65rem; border-radius: 999px; background: color-mix(in srgb, #f59e0b 18%, transparent); font-weight: 700; }
    .pill.ok { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .empty-state { min-height: 190px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-3 { grid-template-columns: 1fr; }
    }
  `]
})
export class NominaRolesComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly nominaService = inject(NominaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['numero', 'fechaPago', 'empleados', 'ingresos', 'neto', 'estado', 'acciones'];
  protected readonly roles = signal<RolPago[]>([]);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected periodo = new Date().toISOString().slice(0, 7);

  /**
   * Referencia Date estable para el datepicker. NO usar un getter que derive un Date nuevo por
   * cada ciclo de detección de cambios: el matDatepicker lo interpretaría como un valor distinto
   * en cada ciclo y entraría en un bucle infinito de detección de cambios que congela el navegador.
   */
  protected fechaPagoDate: Date | null = new Date();

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.waitForInitialBootstrap();

      this.nominaService
        .getRolesPago()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (roles) => {
            this.roles.set(roles);
            this.cargando.set(false);
          },
          error: (error) => {
            this.cargando.set(false);
            this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar los roles de pago.');
          }
        });
    } catch (error) {
      this.cargando.set(false);
      this.error.set(error instanceof Error ? error.message : 'No se pudo preparar la sesion para cargar roles de pago.');
    }
  }

  protected async generar(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      const fechaPago = dateAIso(this.fechaPagoDate);
      const rolId = await this.nominaService.generarRolPago(this.periodo, fechaPago);
      this.toast('Rol de pago generado en borrador.', 'payments');
      await this.router.navigate(['/workspace/contabilidad/nomina/roles', rolId]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo generar el rol de pago.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected abrir(rol: RolPago): void {
    if (rol.id) {
      void this.router.navigate(['/workspace/contabilidad/nomina/roles', rol.id]);
    }
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

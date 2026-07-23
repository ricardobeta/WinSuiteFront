import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../../core/services/auth.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { PreparacionNomina, RolPago } from '../../models/nomina.models';
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
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
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
          <a
            mat-stroked-button
            routerLink="/workspace/contabilidad/configuracion"
            [queryParams]="{ tab: 'integraciones', panel: 'nomina' }"
          >
            <mat-icon>settings</mat-icon>
            Configuracion contable
          </a>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card generator-card">
        <div class="grid-3">
          <mat-form-field appearance="outline">
            <mat-label>Tipo de rol</mat-label>
            <mat-select [ngModel]="tipoRol()" (ngModelChange)="tipoRol.set($event)" name="tipoRol">
              <mat-option value="MENSUAL">Rol mensual</mat-option>
              <mat-option value="DECIMO_TERCERO">Decimo tercero</mat-option>
              <mat-option value="DECIMO_CUARTO">Decimo cuarto</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Periodo</mat-label>
            <input matInput type="month" [ngModel]="periodo()" (ngModelChange)="cambiarPeriodo($event)" name="periodo" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de pago</mat-label>
            <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" />
            <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
            <mat-datepicker #pickerPago></mat-datepicker>
          </mat-form-field>

          <button
            mat-raised-button
            color="primary"
            type="button"
            (click)="generar()"
            [disabled]="procesando() || !preparacion()?.listo"
            [matTooltip]="preparacion()?.listo ? '' : 'Completa la preparacion para habilitar la generacion'"
          >
            <mat-icon>payments</mat-icon>
            Generar rol
          </button>
        </div>

        @if (tipoRol() !== 'MENSUAL') {
          <p class="hint-decimos">
            <mat-icon>info</mat-icon>
            El decimo se calcula con lo provisionado en su periodo legal (D13 diciembre a noviembre,
            D14 segun la region configurada), tomado del acumulado de los roles mensuales aprobados.
          </p>
        }

        <section class="checklist">
          <header class="checklist-head">
            <h3>
              Preparacion
              @if (preparacion(); as estado) {
                <span class="pill" [class.ok]="estado.listo">
                  {{ estado.listo ? 'Todo listo' : pendientes() + ' pendiente(s)' }}
                </span>
              }
            </h3>
            <button mat-button type="button" (click)="revisarPreparacion()" [disabled]="revisando()">
              <mat-icon>refresh</mat-icon>
              Volver a revisar
            </button>
          </header>

          @if (revisando() && !preparacion()) {
            <p class="muted">Revisando la configuracion de nomina...</p>
          } @else if (preparacion(); as estado) {
            <ul class="checklist-items">
              @for (requisito of estado.requisitos; track requisito.item) {
                <li [class.ok]="requisito.ok">
                  <mat-icon>{{ requisito.ok ? 'check_circle' : 'error_outline' }}</mat-icon>
                  <div>
                    <strong>{{ requisito.etiqueta }}</strong>
                    <span class="muted">{{ requisito.detalle }}</span>
                  </div>
                  @if (!requisito.ok) {
                    <a mat-stroked-button [routerLink]="requisito.rutaResolver" [queryParams]="requisito.queryParams">
                      Resolver
                    </a>
                  }
                </li>
              }
            </ul>
          }
        </section>
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
                  <span class="muted">{{ etiquetaTipo(row) }} · {{ row.periodo }}</span>
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
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: .75rem; align-items: center; }
    .hint-decimos { display: flex; gap: .5rem; align-items: center; margin: 0 0 .5rem; padding: .6rem .85rem; border-radius: .5rem; background: color-mix(in srgb, var(--primary) 10%, transparent); font-size: .9rem; }
    .checklist { display: grid; gap: .6rem; margin-top: .5rem; padding-top: .85rem; border-top: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent); }
    .checklist-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .checklist-head h3 { display: flex; align-items: center; gap: .6rem; font-size: 1rem; }
    .checklist-items { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
    .checklist-items li { display: grid; grid-template-columns: auto 1fr auto; gap: .65rem; align-items: center; padding: .5rem .75rem; border-radius: .5rem; background: color-mix(in srgb, #f59e0b 10%, transparent); }
    .checklist-items li.ok { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .checklist-items li mat-icon { color: #f59e0b; }
    .checklist-items li.ok mat-icon { color: var(--primary); }
    .checklist-items strong, .checklist-items span { display: block; }
    .checklist-items span { font-size: .85rem; }
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
  protected readonly periodo = signal(new Date().toISOString().slice(0, 7));
  protected readonly tipoRol = signal<'MENSUAL' | 'DECIMO_TERCERO' | 'DECIMO_CUARTO'>('MENSUAL');
  protected readonly preparacion = signal<PreparacionNomina | null>(null);
  protected readonly revisando = signal(false);
  protected readonly pendientes = computed(
    () => this.preparacion()?.requisitos.filter((requisito) => !requisito.ok).length ?? 0
  );

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

      await this.revisarPreparacion();
    } catch (error) {
      this.cargando.set(false);
      this.error.set(error instanceof Error ? error.message : 'No se pudo preparar la sesion para cargar roles de pago.');
    }
  }

  protected cambiarPeriodo(periodo: string): void {
    this.periodo.set(periodo);
    // El requisito de periodo contable depende del mes elegido, asi que se revalida al cambiarlo.
    void this.revisarPreparacion();
  }

  protected async revisarPreparacion(): Promise<void> {
    this.revisando.set(true);
    try {
      this.preparacion.set(await this.nominaService.evaluarPreparacion(this.periodo()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo revisar la preparacion de nomina.');
    } finally {
      this.revisando.set(false);
    }
  }

  protected async generar(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      const fechaPago = dateAIso(this.fechaPagoDate);
      const tipo = this.tipoRol();
      const rolId = tipo === 'MENSUAL'
        ? await this.nominaService.generarRolPago(this.periodo(), fechaPago)
        : await this.nominaService.generarRolDecimos(tipo, this.periodo(), fechaPago);
      this.toast('Rol generado en borrador.', 'payments');
      await this.router.navigate(['/workspace/contabilidad/nomina/roles', rolId]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo generar el rol de pago.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected etiquetaTipo(rol: RolPago): string {
    return this.nominaService.etiquetasTipoRol[rol.tipo ?? 'MENSUAL'];
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

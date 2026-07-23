import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { ConfiguracionNominaContable, CuentaNominaKey } from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-nomina-configuracion-contable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="nomina-contable-config">
      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="config-card">
        <div class="section-head">
          <div>
            <h3>Reglas de calculo y asiento</h3>
            <p>Define porcentajes, provisiones y como se crean los asientos al aprobar roles de pago.</p>
          </div>
        </div>

        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Crear asiento como</mat-label>
            <mat-select [(ngModel)]="form.modoAsiento" name="modoAsiento" [disabled]="!canUpdate()">
              <mat-option value="BORRADOR">Borrador</mat-option>
              <mat-option value="APROBADO">Aprobado</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Aporte personal IESS %</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.porcentajeAportePersonalIess" name="personalIess" [disabled]="!canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Aporte patronal IESS %</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.porcentajeAportePatronalIess" name="patronalIess" [disabled]="!canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Base decimo cuarto (SBU)</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.salarioBasicoUnificado" name="sbu" [disabled]="!canUpdate()" />
          </mat-form-field>
        </div>

        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Region</mat-label>
            <mat-select [(ngModel)]="form.region" name="region" [disabled]="!canUpdate()">
              <mat-option value="SIERRA">Sierra y Amazonia (ago - jul)</mat-option>
              <mat-option value="COSTA">Costa y Galapagos (mar - feb)</mat-option>
            </mat-select>
            <mat-hint>Define el periodo de calculo del decimo cuarto</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Pago de decimos por defecto</mat-label>
            <mat-select [(ngModel)]="form.modoDecimos" name="modoDecimos" [disabled]="!canUpdate()">
              <mat-option value="ACUMULADO">Acumulado (se paga en su rol anual)</mat-option>
              <mat-option value="MENSUALIZADO">Mensualizado (se paga en cada rol)</mat-option>
            </mat-select>
            <mat-hint>Solo el valor inicial: cada empleado define el suyo en su ficha</mat-hint>
          </mat-form-field>
        </div>

        <div class="checks">
          <mat-checkbox [(ngModel)]="form.provisionarDecimoTercero" name="d13" [disabled]="!canUpdate()">Provisionar decimo tercero</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarDecimoCuarto" name="d14" [disabled]="!canUpdate()">Provisionar decimo cuarto</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarFondosReserva" name="fondos" [disabled]="!canUpdate()">Provisionar fondos de reserva</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarVacaciones" name="vacaciones" [disabled]="!canUpdate()">Provisionar vacaciones</mat-checkbox>
        </div>
      </section>

      <section class="config-card">
        <div class="section-head">
          <div>
            <h3>Cuentas contables de nomina</h3>
            <p>Estas cuentas se usan al aprobar el rol y generar el asiento contable. Puedes guardar avance parcial.</p>
          </div>
          <button
            mat-stroked-button
            type="button"
            (click)="sugerirCuentas()"
            [disabled]="sugiriendo() || !canUpdate()"
            matTooltip="Propone una cuenta del plan para cada casilla vacia, sin pisar las que ya elegiste"
          >
            <mat-icon>auto_fix_high</mat-icon>
            Sugerir cuentas del plan
          </button>
        </div>

        <div class="account-grid">
          @for (campo of camposCuentas; track campo.key) {
            <div class="account-field">
              <span>{{ campo.label }}</span>
              <app-cuenta-contable-autocomplete
                [cuentas]="cuentasMovimiento()"
                [cuentaId]="form[campo.key]"
                [soloActivas]="true"
                [soloMovimiento]="true"
                [label]="campo.label"
                [mostrarNumero]="false"
                [compact]="true"
                [disabled]="!canUpdate()"
                (cuentaSeleccionada)="seleccionarCuenta(campo.key, $event)"
              />
            </div>
          }
        </div>

        <footer class="actions-row">
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="guardando() || !canUpdate()">
            <mat-icon>save</mat-icon>
            Guardar configuracion de nomina
          </button>
        </footer>
      </section>
    </section>
  `,
  styles: [`
    .nomina-contable-config { display: grid; gap: 1rem; }
    .config-card { display: grid; gap: 1rem; }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .section-head h3, .section-head p { margin: 0; }
    .section-head p { margin-top: .25rem; color: var(--muted-foreground); }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .checks { display: flex; gap: .85rem; flex-wrap: wrap; }
    .account-grid { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: .85rem; }
    .account-field { display: grid; gap: .35rem; font-weight: 700; min-width: 0; }
    .actions-row { display: flex; justify-content: flex-end; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-4, .account-grid { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class NominaConfiguracionContableComponent {
  private readonly nominaService = inject(NominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly cuentasMovimiento = computed(() => this.cuentas().filter((cuenta) => cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento));
  protected readonly guardando = signal(false);
  protected readonly sugiriendo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly form: ConfiguracionNominaContable = this.nominaService.getDefaultConfiguracion();
  protected readonly camposCuentas: Array<{ key: CuentaNominaKey; label: string }> = [
    { key: 'cuentaGastoSueldosId', label: 'Gasto sueldos' },
    { key: 'cuentaGastoBeneficiosSocialesId', label: 'Gasto beneficios sociales' },
    { key: 'cuentaGastoAportePatronalId', label: 'Gasto aporte patronal' },
    { key: 'cuentaSueldosPorPagarId', label: 'Sueldos por pagar' },
    { key: 'cuentaIessPorPagarId', label: 'IESS por pagar' },
    { key: 'cuentaAnticiposEmpleadosId', label: 'Anticipos empleados' },
    { key: 'cuentaPrestamosEmpleadosId', label: 'Prestamos empleados' },
    { key: 'cuentaDecimosPorPagarId', label: 'Decimos por pagar' },
    { key: 'cuentaFondosReservaPorPagarId', label: 'Fondos reserva por pagar' },
    { key: 'cuentaVacacionesPorPagarId', label: 'Vacaciones por pagar' },
    { key: 'cuentaUtilidadesPorPagarId', label: 'Utilidades por pagar' }
  ];

  constructor() {
    this.nominaService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => Object.assign(this.form, this.nominaService.getDefaultConfiguracion(), config));

    this.planCuentasService
      .getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas));
  }

  protected seleccionarCuenta(campo: CuentaNominaKey, cuenta: CuentaContable | null): void {
    this.form[campo] = cuenta?.id ?? '';
  }

  /** Rellena solo las casillas vacias con la cuenta del plan que mejor coincide; el contador confirma al guardar. */
  protected async sugerirCuentas(): Promise<void> {
    if (!this.canUpdate()) {
      return;
    }

    this.error.set(null);
    this.sugiriendo.set(true);
    try {
      const { configuracion, asignadas } = await this.nominaService.sugerirCuentas({ ...this.form });
      Object.assign(this.form, configuracion);
      this.toast(
        asignadas > 0
          ? `${asignadas} cuenta(s) sugeridas. Revisalas y guarda la configuracion.`
          : 'No se encontraron cuentas equivalentes en el plan. Selecciona las cuentas a mano.',
        'auto_fix_high'
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron sugerir cuentas.');
    } finally {
      this.sugiriendo.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    if (!this.canUpdate()) {
      return;
    }

    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.nominaService.guardarConfiguracion({ ...this.form });
      this.toast('Configuracion contable de nomina guardada.', 'save');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    } finally {
      this.guardando.set(false);
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

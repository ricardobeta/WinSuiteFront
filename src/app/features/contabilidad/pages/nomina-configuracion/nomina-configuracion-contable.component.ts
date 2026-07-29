import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import {
  ConfiguracionNominaContable,
  CuentaNominaKey
} from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-nomina-configuracion-contable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="nomina-contable-config">
      @if (error()) {
        <section class="error-box" role="alert">{{ error() }}</section>
      }

      <section class="config-card">
        <div class="section-head">
          <div>
            <h3>Reglas de cálculo y asiento</h3>
            <p>Define porcentajes, provisiones y cómo se crean los asientos al aprobar roles de pago.</p>
          </div>
          <span class="tenant-badge">
            <mat-icon>domain</mat-icon>
            Configuración de esta empresa
          </span>
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
            <input matInput type="text" inputmode="decimal" appTwoDecimalInput="4" [(ngModel)]="form.porcentajeAportePersonalIess" name="personalIess" [disabled]="!canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Aporte patronal IESS %</mat-label>
            <input matInput type="text" inputmode="decimal" appTwoDecimalInput="4" [(ngModel)]="form.porcentajeAportePatronalIess" name="patronalIess" [disabled]="!canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Base décimo cuarto (SBU)</mat-label>
            <input matInput type="text" inputmode="decimal" appTwoDecimalInput [(ngModel)]="form.salarioBasicoUnificado" name="sbu" [disabled]="!canUpdate()" />
            <mat-hint>Valor vigente para el período que procesarás</mat-hint>
          </mat-form-field>
        </div>

        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Region</mat-label>
            <mat-select [(ngModel)]="form.region" name="region" [disabled]="!canUpdate()">
              <mat-option value="SIERRA">Sierra y Amazonia (ago - jul)</mat-option>
              <mat-option value="COSTA">Costa y Galapagos (mar - feb)</mat-option>
            </mat-select>
            <mat-hint>Define el período legal del décimo cuarto</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Pago de décimos por defecto</mat-label>
            <mat-select [(ngModel)]="form.modoDecimos" name="modoDecimos" [disabled]="!canUpdate()">
              <mat-option value="ACUMULADO">Acumulado (se paga en su rol anual)</mat-option>
              <mat-option value="MENSUALIZADO">Mensualizado (se paga en cada rol)</mat-option>
            </mat-select>
            <mat-hint>Solo el valor inicial: cada empleado define el suyo en su ficha</mat-hint>
          </mat-form-field>
        </div>

        <section class="policy-section" aria-labelledby="fondos-policy-title">
          <div class="policy-copy">
            <span class="policy-icon" aria-hidden="true"><mat-icon>gavel</mat-icon></span>
            <div>
              <h4 id="fondos-policy-title">Inicio de fondos de reserva</h4>
              <p>Compara las reglas y asigna la excepción únicamente en la ficha de quien corresponda.</p>
            </div>
          </div>

          <div class="policy-matrix" aria-label="Comparación de regímenes de fondos de reserva">
            <div class="policy-row">
              <div>
                <span class="option-title">Régimen general</span>
                <span class="option-detail">Personal administrativo, comercial, técnico de apoyo y demás trabajadores.</span>
              </div>
              <div>
                <strong>Desde el segundo año</strong>
                <span class="legal-ref">Código del Trabajo · art. 196</span>
              </div>
            </div>
            <div class="policy-row construction">
              <div>
                <span class="option-title">Trabajo directo de construcción</span>
                <span class="option-detail">Albañiles, maestros de obra y personal que ejecuta directamente la construcción.</span>
              </div>
              <div>
                <strong>Desde el primer día</strong>
                <span class="legal-ref">Ley de Seguridad Social · art. 149</span>
              </div>
            </div>
            <div class="policy-row construction">
              <div>
                <span class="option-title">Servicios complementarios</span>
                <span class="option-detail">Vigilancia y seguridad privada, limpieza, jardinería y alimentación.</span>
              </div>
              <div>
                <strong>Desde el primer día</strong>
                <span class="legal-ref">Reglamento Mandato 8 · art. 14</span>
              </div>
            </div>
          </div>

          <div class="policy-actions">
            <p>
              La excepción se asigna en la ficha de cada trabajador; nunca se aplica automáticamente
              a toda la empresa constructora.
            </p>
            <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/empleados">
              <mat-icon>badge</mat-icon>
              Clasificar trabajadores
            </a>
          </div>

          <div class="calculation-note">
            <mat-icon>calculate</mat-icon>
            <p>
              <strong>El proporcional se aplica automáticamente.</strong>
              Si una persona ingresa el 15 de julio, el rol reconoce 16 de 30 días; sobre esa base
              calcula sueldo, IESS, décimos, vacaciones y, cuando corresponda, fondos de reserva.
            </p>
          </div>
        </section>

        <div class="checks">
          <mat-checkbox [(ngModel)]="form.provisionarDecimoTercero" name="d13" [disabled]="!canUpdate()">Provisionar décimo tercero</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarDecimoCuarto" name="d14" [disabled]="!canUpdate()">Provisionar décimo cuarto</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarFondosReserva" name="fondos" [disabled]="!canUpdate()">Provisionar fondos de reserva</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarVacaciones" name="vacaciones" [disabled]="!canUpdate()">Provisionar vacaciones</mat-checkbox>
        </div>
      </section>

      <section class="config-card">
        <div class="section-head">
          <div>
            <h3>Cuentas contables de nómina</h3>
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
            Guardar configuración de nómina
          </button>
        </footer>
      </section>
    </section>
  `,
  styles: [`
    .nomina-contable-config { display: grid; gap: 1rem; }
    .config-card { display: grid; gap: 1.25rem; }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .section-head h3, .section-head p { margin: 0; }
    .section-head p { max-width: 68ch; margin-top: .3rem; color: var(--muted-foreground); }
    .tenant-badge {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      gap: .45rem;
      padding: .55rem .85rem;
      border-radius: 999px;
      background: var(--tc-surface-container-low, var(--background));
      color: var(--primary);
      font-size: .83rem;
      font-weight: 700;
    }
    .tenant-badge mat-icon { width: 1.1rem; height: 1.1rem; font-size: 1.1rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .policy-section {
      display: grid;
      gap: 1rem;
      padding: clamp(1rem, 2vw, 1.35rem);
      border-radius: 1rem;
      background: var(--tc-surface-container-low, var(--background));
    }
    .policy-copy { display: flex; align-items: center; gap: .8rem; }
    .policy-copy h4, .policy-copy p, .calculation-note p { margin: 0; }
    .policy-copy h4 { font-size: 1rem; }
    .policy-copy p { margin-top: .2rem; color: var(--muted-foreground); }
    .policy-icon {
      display: grid;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      place-items: center;
      border-radius: .75rem;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      color: var(--primary);
    }
    .policy-matrix { display: grid; gap: .55rem; }
    .policy-row {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(180px, .8fr);
      gap: 1rem;
      align-items: center;
      min-width: 0;
      padding: .85rem 1rem;
      border-radius: .85rem;
      background: var(--tc-surface-container-lowest, #fff);
    }
    .policy-row.construction { background: color-mix(in srgb, var(--primary) 9%, var(--tc-surface-container-lowest, #fff)); }
    .policy-row > div { min-width: 0; }
    .policy-row > div:last-child { display: grid; gap: .15rem; justify-items: end; text-align: end; }
    .option-title, .option-detail, .legal-ref { display: block; white-space: normal; }
    .option-title { margin-bottom: .3rem; color: var(--foreground); font-weight: 750; }
    .option-detail { max-width: 42ch; color: var(--muted-foreground); font-size: .88rem; line-height: 1.45; }
    .legal-ref { margin-top: .6rem; color: var(--primary); font-size: .76rem; font-weight: 700; }
    .policy-row .legal-ref { margin-top: 0; }
    .policy-actions { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .policy-actions p { max-width: 68ch; margin: 0; color: var(--muted-foreground); font-size: .88rem; }
    .calculation-note {
      display: flex;
      gap: .7rem;
      align-items: flex-start;
      padding: .8rem .9rem;
      border-radius: .75rem;
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      color: var(--foreground);
    }
    .calculation-note mat-icon { flex: 0 0 auto; color: var(--primary); }
    .calculation-note p { max-width: 72ch; font-size: .88rem; line-height: 1.5; }
    .checks {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: .65rem;
      padding: .25rem;
    }
    .checks mat-checkbox {
      display: flex;
      min-height: 52px;
      align-items: center;
      padding-inline: .55rem;
      border-radius: .75rem;
      background: var(--tc-surface-container-low, var(--background));
    }
    .account-grid { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: .85rem; }
    .account-field { display: grid; gap: .35rem; font-weight: 700; min-width: 0; }
    .actions-row { display: flex; justify-content: flex-end; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-4, .account-grid, .checks { grid-template-columns: 1fr 1fr; }
      .actions-row { justify-content: flex-start; }
    }
    @media (max-width: 640px) {
      .grid-4, .account-grid, .checks, .policy-row { grid-template-columns: 1fr; }
      .policy-row > div:last-child { justify-items: start; text-align: start; }
      .tenant-badge { width: 100%; justify-content: center; }
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

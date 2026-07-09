import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { ConfiguracionNominaContable } from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

type CuentaNominaKey =
  | 'cuentaGastoSueldosId'
  | 'cuentaGastoBeneficiosSocialesId'
  | 'cuentaGastoAportePatronalId'
  | 'cuentaSueldosPorPagarId'
  | 'cuentaIessPorPagarId'
  | 'cuentaAnticiposEmpleadosId'
  | 'cuentaPrestamosEmpleadosId'
  | 'cuentaDecimosPorPagarId'
  | 'cuentaFondosReservaPorPagarId'
  | 'cuentaVacacionesPorPagarId';

@Component({
  selector: 'app-nomina-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="nomina-config">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad - Nomina</p>
          <h2>Configuracion de nomina</h2>
          <p>Define reglas de calculo y cuentas contables antes de aprobar roles de pago.</p>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card config-card">
        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Crear asiento como</mat-label>
            <mat-select [(ngModel)]="form.modoAsiento" name="modoAsiento">
              <mat-option value="BORRADOR">Borrador</mat-option>
              <mat-option value="APROBADO">Aprobado</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Aporte personal IESS %</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.porcentajeAportePersonalIess" name="personalIess" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Aporte patronal IESS %</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.porcentajeAportePatronalIess" name="patronalIess" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Base decimo cuarto</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.salarioBasicoUnificado" name="sbu" />
          </mat-form-field>
        </div>

        <div class="checks">
          <mat-checkbox [(ngModel)]="form.provisionarDecimoTercero" name="d13">Provisionar decimo tercero</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarDecimoCuarto" name="d14">Provisionar decimo cuarto</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarFondosReserva" name="fondos">Provisionar fondos de reserva</mat-checkbox>
          <mat-checkbox [(ngModel)]="form.provisionarVacaciones" name="vacaciones">Provisionar vacaciones</mat-checkbox>
        </div>
      </section>

      <section class="surface-card config-card">
        <h3>Cuentas contables</h3>
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
                (cuentaSeleccionada)="seleccionarCuenta(campo.key, $event)"
              />
            </div>
          }
        </div>

        <footer class="actions-row">
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="guardando()">
            <mat-icon>save</mat-icon>
            Guardar configuracion
          </button>
        </footer>
      </section>

      <section class="surface-card config-card">
        <div class="section-head">
          <div>
            <h3>Campos personalizados de empleados</h3>
            <p>Define campos adicionales para el formulario de creacion y edicion de empleados.</p>
          </div>
          <button mat-raised-button color="primary" type="button" (click)="agregarCampo()">
            <mat-icon>add</mat-icon>
            Agregar campo
          </button>
        </div>

        @if (camposPersonalizados().length === 0) {
          <div class="empty-state">
            <mat-icon>dynamic_form</mat-icon>
            <h3>Sin campos personalizados</h3>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="camposPersonalizados()">
              <ng-container matColumnDef="nombreMostrar">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">{{ row.nombreMostrar }}</td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
              </ng-container>

              <ng-container matColumnDef="opciones">
                <th mat-header-cell *matHeaderCellDef>Opciones</th>
                <td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">
                  {{ formatearOpciones(row) }}
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-icon-button color="warn" type="button" matTooltip="Eliminar campo" (click)="eliminarCampo(row)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnasCampos"></tr>
              <tr mat-row *matRowDef="let row; columns: columnasCampos"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .nomina-config { display: grid; gap: 1rem; }
    .page-header, .config-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p { margin-top: .35rem; color: var(--muted-foreground); }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .checks { display: flex; gap: .85rem; flex-wrap: wrap; }
    .config-card { display: grid; gap: 1rem; }
    .account-grid { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: .85rem; }
    .account-field { display: grid; gap: .35rem; font-weight: 700; min-width: 0; }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .section-head p { margin-top: .25rem; color: var(--muted-foreground); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 720px; }
    .num { text-align: right; }
    .options-cell { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty-state { min-height: 130px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .empty-state h3 { margin: 0; }
    .actions-row { display: flex; justify-content: flex-end; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-4, .account-grid { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class NominaConfiguracionComponent {
  private readonly nominaService = inject(NominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly cuentasMovimiento = computed(() => this.cuentas().filter((cuenta) => cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento));
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form: ConfiguracionNominaContable = this.nominaService.getDefaultConfiguracion();
  protected readonly columnasCampos = ['nombreMostrar', 'tipo', 'opciones', 'acciones'];
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
    { key: 'cuentaVacacionesPorPagarId', label: 'Vacaciones por pagar' }
  ];

  constructor() {
    this.nominaService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        Object.assign(this.form, this.nominaService.getDefaultConfiguracion(), config);
        this.camposPersonalizados.set(config.camposPersonalizados ?? []);
      });

    this.planCuentasService
      .getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas));
  }

  protected seleccionarCuenta(campo: CuentaNominaKey, cuenta: CuentaContable | null): void {
    this.form[campo] = cuenta?.id ?? '';
  }

  protected async guardar(): Promise<void> {
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.nominaService.guardarConfiguracion({ ...this.form });
      this.toast('Configuracion de nomina guardada.', 'save');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    } finally {
      this.guardando.set(false);
    }
  }

  protected agregarCampo(): void {
    const dialogRef = this.dialog.open(AgregarCampoDialogComponent, {
      width: '760px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((campo: CampoPersonalizado | undefined) => {
      if (!campo) {
        return;
      }
      void this.nominaService.agregarCampo(campo).then(() => this.toast('Campo personalizado agregado.', 'playlist_add'));
    });
  }

  protected eliminarCampo(campo: CampoPersonalizado): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar campo',
        message: `Deseas eliminar el campo ${campo.nombreMostrar}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      void this.nominaService.eliminarCampo(campo.idCampo).then(() => this.toast('Campo eliminado.', 'delete'));
    });
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' - ') ?? '-';
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

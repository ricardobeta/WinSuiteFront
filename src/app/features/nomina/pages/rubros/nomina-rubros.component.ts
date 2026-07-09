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
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContableAutocompleteComponent } from '../../../contabilidad/components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../../contabilidad/models/contabilidad.models';
import { ModoCalculoRubro, RubroNomina } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';
import { PlanCuentasService } from '../../../contabilidad/services/plan-cuentas.service';

@Component({
  selector: 'app-nomina-rubros',
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
    <section class="rubros-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina</p>
          <h2>Rubros de nomina</h2>
          <p>Define los ingresos y descuentos que se pueden usar en los roles de pago de esta empresa.</p>
        </div>
        @if (rubros().length === 0) {
          <button mat-stroked-button type="button" (click)="sembrar()" [disabled]="procesando() || !canUpdate()">
            <mat-icon>auto_awesome</mat-icon>
            Sembrar rubros por defecto
          </button>
        }
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card form-card">
        <h3>{{ form.id ? 'Editar rubro' : 'Nuevo rubro' }}</h3>
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Codigo</mat-label>
            <input matInput maxlength="12" [(ngModel)]="form.codigo" name="codigo" [disabled]="!!form.sistema || !canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Nombre</mat-label>
            <input matInput [(ngModel)]="form.nombre" name="nombre" [disabled]="!canUpdate()" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select [(ngModel)]="form.tipo" name="tipo" [disabled]="!canUpdate()">
              <mat-option value="INGRESO">Ingreso</mat-option>
              <mat-option value="DESCUENTO">Descuento</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Modo de calculo</mat-label>
            <mat-select [(ngModel)]="form.modoCalculo" name="modoCalculo" [disabled]="!canUpdate()">
              <mat-option value="MANUAL">Manual (por rol)</mat-option>
              <mat-option value="PORCENTAJE_SUELDO">% del sueldo</mat-option>
              <mat-option value="FIJO">Valor fijo</mat-option>
            </mat-select>
          </mat-form-field>

          @if (form.modoCalculo !== 'MANUAL') {
            <mat-form-field appearance="outline">
              <mat-label>{{ form.modoCalculo === 'PORCENTAJE_SUELDO' ? 'Porcentaje %' : 'Monto fijo' }}</mat-label>
              <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.valorReferencia" name="valorReferencia" [disabled]="!canUpdate()" />
            </mat-form-field>
          }

          <div class="account-field span-2">
            <span>Cuenta contable (opcional)</span>
            <app-cuenta-contable-autocomplete
              [cuentas]="cuentasMovimiento()"
              [cuentaId]="form.cuentaContableId ?? ''"
              [soloActivas]="true"
              [soloMovimiento]="true"
              label="Cuenta contable"
              [mostrarNumero]="false"
              [compact]="true"
              [disabled]="!canUpdate()"
              (cuentaSeleccionada)="seleccionarCuenta($event)"
            />
          </div>

          <div class="checks">
            @if (form.tipo === 'INGRESO') {
              <mat-checkbox [(ngModel)]="form.afectaIess" name="afectaIess" [disabled]="!canUpdate()">Afecta base IESS</mat-checkbox>
            }
            <mat-checkbox [(ngModel)]="form.activo" name="activo" [disabled]="!canUpdate()">Activo</mat-checkbox>
          </div>
        </div>

        <footer class="actions-row">
          @if (form.id) {
            <button mat-button type="button" (click)="limpiar()">
              <mat-icon>close</mat-icon>
              Cancelar edicion
            </button>
          }
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="procesando() || !canUpdate()">
            <mat-icon>save</mat-icon>
            Guardar rubro
          </button>
        </footer>
      </section>

      <section class="surface-card table-card">
        @if (rubros().length === 0) {
          <div class="empty-state">
            <mat-icon>category</mat-icon>
            <h3>Sin rubros</h3>
            <p>Siembra los rubros por defecto o crea el primero para usarlo en los roles.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="rubros()">
              <ng-container matColumnDef="codigo">
                <th mat-header-cell *matHeaderCellDef>Codigo</th>
                <td mat-cell *matCellDef="let row"><strong>{{ row.codigo }}</strong></td>
              </ng-container>

              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class.desc]="row.tipo === 'DESCUENTO'">{{ row.tipo === 'INGRESO' ? 'Ingreso' : 'Descuento' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="calculo">
                <th mat-header-cell *matHeaderCellDef>Calculo</th>
                <td mat-cell *matCellDef="let row">{{ etiquetaCalculo(row) }}</td>
              </ng-container>

              <ng-container matColumnDef="iess">
                <th mat-header-cell *matHeaderCellDef>IESS</th>
                <td mat-cell *matCellDef="let row">{{ row.tipo === 'INGRESO' ? (row.afectaIess ? 'Si' : 'No') : '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class.off]="!row.activo">{{ row.activo ? 'Activo' : 'Inactivo' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-button type="button" (click)="editar(row)" [disabled]="!canUpdate()">Editar</button>
                  <button mat-icon-button color="warn" type="button" matTooltip="Eliminar" (click)="eliminar(row)" [disabled]="row.sistema || !canUpdate()">
                    <mat-icon>delete</mat-icon>
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
    .rubros-page { display: grid; gap: 1rem; }
    .page-header, .form-card, .table-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p, .muted, .empty-state p { color: var(--muted-foreground); }
    .form-card { display: grid; gap: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; align-items: start; }
    .span-2 { grid-column: span 2; }
    .account-field { display: grid; gap: .35rem; font-weight: 600; min-width: 0; }
    .checks { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .actions-row { display: flex; justify-content: flex-end; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 820px; }
    .num { text-align: right; }
    .pill { display: inline-flex; padding: .25rem .65rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 16%, transparent); font-weight: 700; font-size: .8rem; }
    .pill.desc { background: color-mix(in srgb, #f59e0b 20%, transparent); }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .empty-state { min-height: 180px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: auto; }
    }
  `]
})
export class NominaRubrosComponent {
  private readonly nominaService = inject(NominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['codigo', 'nombre', 'tipo', 'calculo', 'iess', 'estado', 'acciones'];
  protected readonly rubros = signal<RubroNomina[]>([]);
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly cuentasMovimiento = computed(() => this.cuentas().filter((cuenta) => cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento));
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form: RubroNomina = this.nuevoRubro();

  constructor() {
    this.nominaService
      .getRubros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rubros) => this.rubros.set(rubros));

    this.planCuentasService
      .getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas));
  }

  protected seleccionarCuenta(cuenta: CuentaContable | null): void {
    this.form.cuentaContableId = cuenta?.id ?? '';
  }

  protected editar(rubro: RubroNomina): void {
    if (!this.canUpdate()) {
      return;
    }
    this.form = { ...rubro };
  }

  protected limpiar(): void {
    this.form = this.nuevoRubro();
  }

  protected async guardar(): Promise<void> {
    if (!this.canUpdate()) {
      return;
    }

    this.error.set(null);
    this.procesando.set(true);
    try {
      await this.nominaService.guardarRubro({ ...this.form });
      this.toast('Rubro guardado.', 'save');
      this.limpiar();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el rubro.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected eliminar(rubro: RubroNomina): void {
    if (!rubro.id || !this.canUpdate()) {
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar rubro',
        message: `Deseas eliminar el rubro ${rubro.nombre}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado || !rubro.id) {
        return;
      }
      void this.nominaService.eliminarRubro(rubro.id)
        .then(() => this.toast('Rubro eliminado.', 'delete'))
        .catch((error) => this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar el rubro.'));
    });
  }

  protected async sembrar(): Promise<void> {
    if (!this.canUpdate()) {
      return;
    }

    this.error.set(null);
    this.procesando.set(true);
    try {
      await this.nominaService.sembrarRubrosPorDefecto();
      this.toast('Rubros por defecto creados.', 'auto_awesome');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron crear los rubros.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected etiquetaCalculo(rubro: RubroNomina): string {
    if (rubro.modoCalculo === 'PORCENTAJE_SUELDO') {
      return `${rubro.valorReferencia ?? 0}% del sueldo`;
    }
    if (rubro.modoCalculo === 'FIJO') {
      return `Fijo ${rubro.valorReferencia ?? 0}`;
    }
    return 'Manual';
  }

  private nuevoRubro(): RubroNomina {
    return {
      codigo: '',
      nombre: '',
      tipo: 'INGRESO',
      afectaIess: true,
      modoCalculo: 'MANUAL' as ModoCalculoRubro,
      valorReferencia: 0,
      cuentaContableId: '',
      sistema: false,
      activo: true,
      orden: 0
    };
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

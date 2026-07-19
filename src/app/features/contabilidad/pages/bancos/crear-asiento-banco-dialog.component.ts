import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AsientoContable, CuentaContable } from '../../models/contabilidad.models';
import { CuentaBancaria, MovimientoBancario } from '../../models/bancos.models';
import { AsientosContablesService } from '../../services/asientos-contables.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

export interface CrearAsientoBancoDialogData {
  cuentaBancaria: CuentaBancaria;
  movimientos: MovimientoBancario[];
  cuentaContableSugeridaId?: string | null;
  motivo?: string;
}

/**
 * Crea el asiento contable de un movimiento del extracto sin contrapartida
 * (comisión, interés, ND/NC): DEBE gasto / HABER banco para débitos, inverso
 * para créditos. Devuelve el asientoId para confirmar el match.
 */
@Component({
  selector: 'app-crear-asiento-banco-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>Crear asiento desde el banco</h2>
    <mat-dialog-content>
      <div class="resumen">
        @for (movimiento of data.movimientos; track movimiento.id) {
          <p class="mov">
            <span>{{ movimiento.fecha }} · {{ movimiento.descripcion }}</span>
            <strong [class.neg]="movimiento.monto < 0">{{ movimiento.monto | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong>
          </p>
        }
        @if (data.motivo) {
          <p class="hint">{{ data.motivo }}</p>
        }
      </div>

      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Glosa del asiento</mat-label>
          <input matInput formControlName="glosa" />
        </mat-form-field>

        <app-cuenta-contable-autocomplete
          [cuentas]="cuentasContables()"
          [cuentaId]="form.value.cuentaContableId ?? null"
          [label]="totalMovimientos() < 0 ? 'Cuenta de gasto (DEBE)' : 'Cuenta de ingreso (HABER)'"
          (cuentaSeleccionada)="onCuenta($event)"
        />
        <p class="hint">
          {{ totalMovimientos() < 0
            ? 'DEBE ' + (totalAbs() | currency: 'USD':'symbol-narrow':'1.2-2') + ' a la cuenta seleccionada / HABER al banco.'
            : 'DEBE ' + (totalAbs() | currency: 'USD':'symbol-narrow':'1.2-2') + ' al banco / HABER a la cuenta seleccionada.' }}
        </p>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || guardando()" (click)="guardar()">
        <mat-icon>receipt_long</mat-icon>
        {{ guardando() ? 'Creando…' : 'Crear asiento y conciliar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: .5rem; min-width: min(520px, 84vw); }
    .resumen { display: grid; gap: .25rem; margin-bottom: .75rem; }
    .mov { display: flex; justify-content: space-between; gap: 1rem; margin: 0; }
    .mov strong.neg { color: var(--destructive); }
    .hint { color: var(--muted-foreground); font-size: .8rem; margin: .2rem 0 0; }
  `]
})
export class CrearAsientoBancoDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CrearAsientoBancoDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly planCuentas = inject(PlanCuentasService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = inject<CrearAsientoBancoDialogData>(MAT_DIALOG_DATA);
  protected readonly cuentasContables = signal<CuentaContable[]>([]);
  protected readonly guardando = signal(false);

  private cuentaSeleccionada: CuentaContable | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    glosa: [this.glosaInicial(), Validators.required],
    cuentaContableId: [this.data.cuentaContableSugeridaId ?? '', Validators.required]
  });

  constructor() {
    this.planCuentas.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => {
        this.cuentasContables.set(cuentas);
        const sugerida = cuentas.find((cuenta) => cuenta.id === this.data.cuentaContableSugeridaId);
        if (sugerida) {
          this.cuentaSeleccionada = sugerida;
        }
      });
  }

  protected totalMovimientos(): number {
    return this.data.movimientos.reduce((total, movimiento) => total + movimiento.monto, 0);
  }

  protected totalAbs(): number {
    return Math.round(Math.abs(this.totalMovimientos()) * 100) / 100;
  }

  protected onCuenta(cuenta: CuentaContable | null): void {
    this.cuentaSeleccionada = cuenta;
    this.form.patchValue({ cuentaContableId: cuenta?.id ?? '' });
  }

  protected async guardar(): Promise<void> {
    const cuentaBanco = this.cuentasContables()
      .find((cuenta) => cuenta.id === this.data.cuentaBancaria.cuentaContableId);
    if (this.form.invalid || !this.cuentaSeleccionada || !cuentaBanco) {
      return;
    }
    this.guardando.set(true);
    try {
      const egreso = this.totalMovimientos() < 0;
      const monto = this.totalAbs();
      const glosa = this.form.getRawValue().glosa;
      const fecha = this.data.movimientos[0].fecha;
      const lineas = [
        {
          id: '1',
          cuentaId: egreso ? (this.cuentaSeleccionada.id ?? '') : (cuentaBanco.id ?? ''),
          codigoCuenta: egreso ? this.cuentaSeleccionada.codigo : cuentaBanco.codigo,
          nombreCuenta: egreso ? this.cuentaSeleccionada.nombre : cuentaBanco.nombre,
          descripcion: glosa,
          debe: monto,
          haber: 0
        },
        {
          id: '2',
          cuentaId: egreso ? (cuentaBanco.id ?? '') : (this.cuentaSeleccionada.id ?? ''),
          codigoCuenta: egreso ? cuentaBanco.codigo : this.cuentaSeleccionada.codigo,
          nombreCuenta: egreso ? cuentaBanco.nombre : this.cuentaSeleccionada.nombre,
          descripcion: glosa,
          debe: 0,
          haber: monto
        }
      ];
      const asiento: AsientoContable = {
        fecha,
        periodo: fecha.slice(0, 7),
        tipo: 'AJUSTE',
        glosa: `Conciliación bancaria: ${glosa}`,
        referencia: this.data.movimientos[0].referencia || undefined,
        estado: 'BORRADOR',
        origen: 'MANUAL',
        lineas,
        totalDebe: monto,
        totalHaber: monto,
        diferencia: 0
      };
      const asientoId = await this.asientosService.aprobarAsiento(asiento);
      this.dialogRef.close({ asientoId });
    } finally {
      this.guardando.set(false);
    }
  }

  private glosaInicial(): string {
    const primera = this.data.movimientos[0];
    return primera ? primera.descripcion : 'Movimiento bancario';
  }
}

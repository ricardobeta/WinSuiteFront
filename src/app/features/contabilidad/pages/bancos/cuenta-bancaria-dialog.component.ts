import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { BANCOS_ECUADOR, CuentaBancaria } from '../../models/bancos.models';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

export interface CuentaBancariaDialogData {
  cuenta?: CuentaBancaria;
}

@Component({
  selector: 'app-cuenta-bancaria-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data.cuenta ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre interno</mat-label>
          <input matInput formControlName="nombre" placeholder="Pichincha Cte principal" />
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Banco</mat-label>
            <mat-select formControlName="bancoCodigo">
              @for (banco of bancos; track banco.codigo) {
                <mat-option [value]="banco.codigo">{{ banco.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo de cuenta</mat-label>
            <mat-select formControlName="tipoCuenta">
              <mat-option value="CORRIENTE">Corriente</mat-option>
              <mat-option value="AHORROS">Ahorros</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Número de cuenta</mat-label>
          <input matInput formControlName="numeroCuenta" autocomplete="off" />
          <mat-hint>Se recomienda solo los últimos dígitos (ej. ****2204)</mat-hint>
        </mat-form-field>

        <app-cuenta-contable-autocomplete
          [cuentas]="cuentasContables()"
          [cuentaId]="form.value.cuentaContableId ?? null"
          label="Cuenta contable del banco (activo)"
          (cuentaSeleccionada)="onCuentaContable($event)"
        />

        @if (data.cuenta) {
          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="estado">
              <mat-option value="ACTIVA">Activa</mat-option>
              <mat-option value="INACTIVA">Inactiva</mat-option>
            </mat-select>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="guardar()">
        <mat-icon>save</mat-icon>
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: .35rem; min-width: min(480px, 82vw); padding-top: .5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
  `]
})
export class CuentaBancariaDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CuentaBancariaDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly planCuentas = inject(PlanCuentasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = inject<CuentaBancariaDialogData>(MAT_DIALOG_DATA);
  protected readonly bancos = BANCOS_ECUADOR;
  protected readonly cuentasContables = signal<CuentaContable[]>([]);

  protected readonly form = this.formBuilder.nonNullable.group({
    nombre: [this.data.cuenta?.nombre ?? '', [Validators.required, Validators.maxLength(80)]],
    bancoCodigo: [this.data.cuenta?.bancoCodigo ?? 'PICHINCHA', Validators.required],
    tipoCuenta: [this.data.cuenta?.tipoCuenta ?? 'CORRIENTE', Validators.required],
    numeroCuenta: [this.data.cuenta?.numeroCuenta ?? '', [Validators.required, Validators.maxLength(30)]],
    cuentaContableId: [this.data.cuenta?.cuentaContableId ?? '', Validators.required],
    estado: [this.data.cuenta?.estado ?? 'ACTIVA', Validators.required]
  });

  constructor() {
    this.planCuentas.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentasContables.set(cuentas.filter((cuenta) => cuenta.tipo === 'ACTIVO')));
  }

  protected onCuentaContable(cuenta: CuentaContable | null): void {
    this.form.patchValue({ cuentaContableId: cuenta?.id ?? '' });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const banco = this.bancos.find((item) => item.codigo === value.bancoCodigo);
    this.dialogRef.close({
      ...value,
      bancoNombre: banco?.nombre ?? value.bancoCodigo,
      moneda: 'USD'
    });
  }
}

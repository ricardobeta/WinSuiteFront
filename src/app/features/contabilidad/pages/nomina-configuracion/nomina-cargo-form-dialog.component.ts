import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { CargoNomina } from '../../models/nomina.models';

export interface NominaCargoFormDialogData {
  cargo?: CargoNomina;
  cuentas: CuentaContable[];
}

@Component({
  selector: 'app-nomina-cargo-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data.cargo ? 'Editar cargo' : 'Nuevo cargo' }}</h2>
    <mat-dialog-content>
      <p class="intro">El sueldo base de los empleados con este cargo se agrupará en la cuenta seleccionada.</p>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre del cargo</mat-label>
          <input matInput formControlName="nombre" autocomplete="off" />
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>Ingresa un nombre.</mat-error>
          }
        </mat-form-field>

        <app-cuenta-contable-autocomplete
          [cuentas]="data.cuentas"
          [cuentaId]="cuentaId()"
          [soloActivas]="true"
          [soloMovimiento]="true"
          label="Cuenta de gasto de sueldos"
          [mostrarNumero]="false"
          (cuentaSeleccionada)="cuentaId.set($event?.id ?? '')"
        />
        <p class="hint">Puedes dejarla pendiente; el popup del asiento exigirá elegir una cuenta antes de registrar.</p>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">Guardar cargo</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .intro { max-width: 64ch; margin: 0 0 1rem; color: var(--muted-foreground); line-height: 1.5; }
    .dialog-form { display: grid; gap: .35rem; min-width: min(520px, 78vw); padding-top: .25rem; }
    .hint { margin: -.25rem 0 .5rem; color: var(--muted-foreground); font-size: .82rem; line-height: 1.45; }
    @media (max-width: 640px) { .dialog-form { min-width: 0; } }
  `]
})
export class NominaCargoFormDialogComponent implements OnInit {
  protected readonly data = inject<NominaCargoFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<NominaCargoFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly cuentaId = signal('');
  protected readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', Validators.required]
  });

  ngOnInit(): void {
    if (this.data.cargo) {
      this.form.patchValue({ nombre: this.data.cargo.nombre });
      this.cuentaId.set(this.data.cargo.cuentaGastoSueldosId ?? '');
    }
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({
      ...this.data.cargo,
      nombre: this.form.controls.nombre.value.trim(),
      cuentaGastoSueldosId: this.cuentaId(),
      activo: this.data.cargo?.activo ?? true
    } satisfies CargoNomina);
  }
}


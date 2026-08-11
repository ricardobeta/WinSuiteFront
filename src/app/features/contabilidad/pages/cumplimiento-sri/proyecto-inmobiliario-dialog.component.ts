import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ProyectoInmobiliario, ProyectoInmobiliarioInput } from '../../models/cumplimiento-sri.models';

@Component({
  selector: 'app-proyecto-inmobiliario-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar proyecto' : 'Nuevo proyecto inmobiliario' }}</h2>
    <mat-dialog-content>
      <p class="dialog-support">Estos datos se imprimirán en la cabecera del listado oficial del SRI.</p>
      <form class="project-form" [formGroup]="form" (ngSubmit)="guardar()">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nombre del proyecto calificado</mat-label>
          <input matInput formControlName="nombre" maxlength="160" autocomplete="off" />
          <mat-error>Ingresa el nombre del proyecto.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Número de registro asignado</mat-label>
          <input matInput formControlName="numeroRegistro" maxlength="100" autocomplete="off" />
          <mat-error>Ingresa el registro emitido para el proyecto.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tipo de beneficiario</mat-label>
          <mat-select formControlName="tipoProyecto">
            <mat-option value="PROMOTOR_INMOBILIARIO">Promotor inmobiliario</mat-option>
            <mat-option value="VIVIENDA_PROPIA">Vivienda propia</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Costo total referencial</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0.01" step="0.01" formControlName="costoTotalReferencial" />
          <mat-hint>Se usa para la alerta referencial acumulada de IVA.</mat-hint>
          <mat-error>Ingresa un costo mayor a cero.</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="guardar()" [disabled]="form.invalid">
        <mat-icon>save</mat-icon> Guardar proyecto
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-support { color: var(--app-text-secondary); margin: 0 0 20px; }
    .project-form { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; min-width: min(620px, 76vw); padding-top: 4px; }
    .full { grid-column: 1 / -1; }
    @media (max-width: 640px) { .project-form { grid-template-columns: 1fr; min-width: 0; } .full { grid-column: auto; } }
  `]
})
export class ProyectoInmobiliarioDialogComponent {
  readonly data = inject<ProyectoInmobiliario | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<ProyectoInmobiliarioDialogComponent, ProyectoInmobiliarioInput>);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    nombre: [this.data?.nombre ?? '', [Validators.required, Validators.maxLength(160)]],
    numeroRegistro: [this.data?.numeroRegistro ?? '', [Validators.required, Validators.maxLength(100)]],
    costoTotalReferencial: [this.data?.costoTotalReferencial ?? 0, [Validators.required, Validators.min(0.01)]],
    tipoProyecto: [this.data?.tipoProyecto ?? 'PROMOTOR_INMOBILIARIO' as const, Validators.required]
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({ ...this.form.getRawValue(), activo: this.data?.activo ?? true });
  }
}

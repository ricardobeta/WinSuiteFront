import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DepartamentoNomina } from '../../models/nomina.models';

@Component({
  selector: 'app-nomina-departamento-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar departamento' : 'Nuevo departamento' }}</h2>
    <mat-dialog-content>
      <p class="intro">Los departamentos organizan al personal y son independientes del cargo y de su cuenta contable.</p>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre del departamento</mat-label>
          <input matInput formControlName="nombre" autocomplete="off" />
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>Ingresa un nombre.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">Guardar departamento</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .intro { max-width: 58ch; margin: 0 0 1rem; color: var(--muted-foreground); line-height: 1.5; }
    .dialog-form { display: grid; min-width: min(460px, 78vw); padding-top: .25rem; }
    @media (max-width: 640px) { .dialog-form { min-width: 0; } }
  `]
})
export class NominaDepartamentoFormDialogComponent implements OnInit {
  protected readonly data = inject<DepartamentoNomina | undefined>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<NominaDepartamentoFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly form = this.formBuilder.nonNullable.group({ nombre: ['', Validators.required] });

  ngOnInit(): void {
    if (this.data) {
      this.form.patchValue({ nombre: this.data.nombre });
    }
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({
      ...this.data,
      nombre: this.form.controls.nombre.value.trim(),
      activo: this.data?.activo ?? true
    } satisfies DepartamentoNomina);
  }
}


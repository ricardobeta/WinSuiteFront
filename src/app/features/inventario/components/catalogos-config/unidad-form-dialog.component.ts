import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { TipoUnidad, Unidad } from '../../models/inventario.models';

export interface UnidadFormDialogData {
  unidad?: Unidad;
}

@Component({
  selector: 'app-unidad-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.unidad ? 'Editar unidad' : 'Nueva unidad' }}</h2>

    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" />
        </mat-form-field>

        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Abreviatura</mat-label>
            <input matInput formControlName="abreviatura" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo">
              @for (tipo of tiposUnidad; track tipo) {
                <mat-option [value]="tipo">{{ tipo }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: 1rem; padding-top: .5rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
  `]
})
export class UnidadFormDialogComponent implements OnInit {
  protected readonly data = inject<UnidadFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UnidadFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly tiposUnidad: TipoUnidad[] = ['MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD'];
  protected readonly form = this.formBuilder.nonNullable.group({
    id: [''],
    nombre: ['', [Validators.required]],
    abreviatura: ['', [Validators.required]],
    tipo: ['UNIDAD' as TipoUnidad, [Validators.required]]
  });

  ngOnInit(): void {
    if (!this.data.unidad) {
      return;
    }

    this.form.patchValue({
      id: this.data.unidad.id ?? '',
      nombre: this.data.unidad.nombre,
      abreviatura: this.data.unidad.abreviatura,
      tipo: this.data.unidad.tipo
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const unidad: Unidad = {
      id: raw.id || undefined,
      nombre: raw.nombre,
      abreviatura: raw.abreviatura,
      tipo: raw.tipo,
      activo: true
    };

    this.dialogRef.close(unidad);
  }
}

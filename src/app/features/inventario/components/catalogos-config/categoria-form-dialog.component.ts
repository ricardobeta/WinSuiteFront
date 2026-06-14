import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Categoria } from '../../models/inventario.models';

export interface CategoriaFormDialogData {
  categoria?: Categoria;
  categoriasDisponibles: Categoria[];
}

@Component({
  selector: 'app-categoria-form-dialog',
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
    <h2 mat-dialog-title>{{ data.categoria ? 'Editar categoria' : 'Nueva categoria' }}</h2>

    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Categoria padre</mat-label>
          <mat-select formControlName="categoriaPadreId">
            <mat-option [value]="null">Sin categoria padre</mat-option>
            @for (categoria of categoriasPadre(); track categoria.id) {
              <mat-option [value]="categoria.id">{{ categoria.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Color</mat-label>
            <input matInput formControlName="color" placeholder="#009688" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Icono</mat-label>
            <input matInput formControlName="icono" placeholder="inventory_2" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Orden</mat-label>
          <input matInput type="number" formControlName="orden" min="0" />
        </mat-form-field>
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
export class CategoriaFormDialogComponent implements OnInit {
  protected readonly data = inject<CategoriaFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CategoriaFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: [''],
    nombre: ['', [Validators.required]],
    categoriaPadreId: [null as string | null],
    color: [''],
    icono: [''],
    orden: [0]
  });

  ngOnInit(): void {
    if (!this.data.categoria) {
      return;
    }

    this.form.patchValue({
      id: this.data.categoria.id ?? '',
      nombre: this.data.categoria.nombre,
      categoriaPadreId: this.data.categoria.categoriaPadreId ?? null,
      color: this.data.categoria.color ?? '',
      icono: this.data.categoria.icono ?? '',
      orden: this.data.categoria.orden ?? 0
    });
  }

  protected categoriasPadre(): Categoria[] {
    const actualId = this.form.controls.id.value;
    return this.data.categoriasDisponibles.filter((categoria) => categoria.id !== actualId);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const categoria: Categoria = {
      id: raw.id || undefined,
      nombre: raw.nombre,
      categoriaPadreId: raw.categoriaPadreId,
      color: raw.color || undefined,
      icono: raw.icono || undefined,
      orden: raw.orden,
      activo: true
    };

    this.dialogRef.close(categoria);
  }
}

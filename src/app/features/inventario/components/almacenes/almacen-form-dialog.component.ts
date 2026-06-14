import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { Almacen, TipoAlmacen } from '../../models/inventario.models';

export interface AlmacenFormDialogData {
  almacen?: Almacen;
}

@Component({
  selector: 'app-almacen-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.almacen ? 'Editar almacen' : 'Nuevo almacen' }}</h2>

    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="nombre" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Codigo</mat-label>
            <input matInput formControlName="codigo" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo">
            @for (tipo of tipos; track tipo) {
              <mat-option [value]="tipo">{{ tipo }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Direccion</mat-label>
          <input matInput formControlName="direccion" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Responsable (id)</mat-label>
          <input matInput formControlName="responsableId" />
        </mat-form-field>

        <div class="toggles">
          <mat-slide-toggle formControlName="esPorDefecto">Almacen por defecto</mat-slide-toggle>
          <mat-slide-toggle formControlName="activo">Activo</mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: 1rem; padding-top: .5rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .toggles { display: flex; gap: 1rem; flex-wrap: wrap; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
  `]
})
export class AlmacenFormDialogComponent implements OnInit {
  protected readonly data = inject<AlmacenFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AlmacenFormDialogComponent>);
  private readonly fb = inject(FormBuilder);

  protected readonly tipos: TipoAlmacen[] = ['ALMACEN', 'SUCURSAL', 'BODEGA', 'VIRTUAL'];
  protected readonly form = this.fb.nonNullable.group({
    id: [''],
    codigo: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    tipo: ['ALMACEN' as TipoAlmacen, [Validators.required]],
    direccion: [''],
    responsableId: [''],
    esPorDefecto: [false],
    activo: [true]
  });

  ngOnInit(): void {
    if (!this.data.almacen) {
      return;
    }

    this.form.patchValue({
      id: this.data.almacen.id ?? '',
      codigo: this.data.almacen.codigo,
      nombre: this.data.almacen.nombre,
      tipo: this.data.almacen.tipo,
      direccion: this.data.almacen.direccion ?? '',
      responsableId: this.data.almacen.responsableId ?? '',
      esPorDefecto: this.data.almacen.esPorDefecto,
      activo: this.data.almacen.activo
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.dialogRef.close({
      id: raw.id || undefined,
      codigo: raw.codigo,
      nombre: raw.nombre,
      tipo: raw.tipo,
      direccion: raw.direccion,
      responsableId: raw.responsableId,
      esPorDefecto: raw.esPorDefecto,
      activo: raw.activo
    } as Almacen);
  }
}

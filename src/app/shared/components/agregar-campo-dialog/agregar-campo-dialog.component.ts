import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CampoPersonalizado, TipoCampo } from '../../models/clientes.models';
import { CatalogoOpcionesComponent } from '../catalogo-opciones/catalogo-opciones.component';

@Component({
  selector: 'app-agregar-campo-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    CatalogoOpcionesComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar campo' : 'Agregar campo' }}</h2>

    <mat-dialog-content>
      <form class="campo-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre para mostrar</mat-label>
          <input matInput formControlName="nombreMostrar" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo">
            @for (tipo of tipos; track tipo) {
              <mat-option [value]="tipo">{{ tipo }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="requerido">Requerido</mat-checkbox>

        @if (tieneOpciones()) {
          <app-catalogo-opciones formControlName="opciones"></app-catalogo-opciones>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="form.invalid">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .campo-form { display: grid; gap: 1rem; padding-top: .5rem; }
  `]
})
export class AgregarCampoDialogComponent implements OnInit {
  protected readonly data = inject<CampoPersonalizado | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<AgregarCampoDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tipos: TipoCampo[] = ['texto', 'textarea', 'booleano', 'lista_simple', 'lista_multiple', 'catalogo', 'fecha'];
  protected readonly form = this.formBuilder.nonNullable.group({
    idCampo: [''],
    nombreMostrar: ['', [Validators.required]],
    tipo: ['texto' as TipoCampo, [Validators.required]],
    requerido: [false],
    opciones: this.formBuilder.control([] as { clave: string; valor: string }[]),
    orden: [0]
  });

  ngOnInit(): void {
    const campo = this.data ?? this.crearCampoVacio();
    this.form.patchValue(campo);
    this.actualizarOpcionesSegunTipo(campo.tipo);

    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipo) => {
      this.actualizarOpcionesSegunTipo(tipo);
    });
  }

  protected tieneOpciones(): boolean {
    return ['lista_simple', 'lista_multiple', 'catalogo'].includes(this.form.controls.tipo.value);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const campo: CampoPersonalizado = {
      idCampo: value.idCampo || this.generarIdCampo(),
      nombreMostrar: value.nombreMostrar,
      tipo: value.tipo,
      requerido: value.requerido,
      opciones: this.tieneOpciones() ? (value.opciones ?? []) : undefined,
      orden: value.orden ?? 0
    };

    this.dialogRef.close(campo);
  }

  private actualizarOpcionesSegunTipo(tipo: TipoCampo): void {
    if (['lista_simple', 'lista_multiple', 'catalogo'].includes(tipo)) {
      return;
    }

    this.form.controls.opciones.setValue([], { emitEvent: false });
  }

  private crearCampoVacio(): CampoPersonalizado {
    return {
      idCampo: this.generarIdCampo(),
      nombreMostrar: '',
      tipo: 'texto',
      requerido: false,
      opciones: [],
      orden: 0
    };
  }

  private generarIdCampo(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `campo_${Date.now()}`;
  }
}

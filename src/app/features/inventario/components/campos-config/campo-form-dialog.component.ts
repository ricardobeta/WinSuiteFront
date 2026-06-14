import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CatalogoOpcionesComponent } from '../../../../shared/components/catalogo-opciones/catalogo-opciones.component';
import { CampoPersonalizado, TipoCampo } from '../../../../shared/models/clientes.models';

export interface CampoFormDialogData {
  campo?: CampoPersonalizado;
}

@Component({
  selector: 'app-campo-form-dialog',
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
    CatalogoOpcionesComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ esEdicion() ? 'Editar campo' : 'Nuevo campo' }}</h2>

    <mat-dialog-content>
      <form class="campo-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre a mostrar</mat-label>
          <input matInput formControlName="nombreMostrar" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo" [disabled]="esEdicion()">
            @for (tipo of tipos; track tipo) {
              <mat-option [value]="tipo">{{ tipo }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Orden</mat-label>
          <input matInput type="number" formControlName="orden" min="0" />
        </mat-form-field>

        <mat-checkbox formControlName="requerido">Requerido</mat-checkbox>
        <mat-checkbox formControlName="visibleEnLista">Visible en lista</mat-checkbox>

        @if (tieneOpciones()) {
          <app-catalogo-opciones formControlName="opciones" />
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="form.invalid">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .campo-form { display: grid; gap: 1rem; padding-top: .5rem; }
  `]
})
export class CampoFormDialogComponent implements OnInit {
  private readonly data = inject<CampoFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject(MatDialogRef<CampoFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly tipos: TipoCampo[] = ['texto', 'textarea', 'booleano', 'lista_simple', 'lista_multiple', 'catalogo', 'fecha'];
  protected readonly esEdicion = computed(() => !!this.data.campo);
  protected readonly form = this.formBuilder.nonNullable.group({
    idCampo: [''],
    nombreMostrar: ['', [Validators.required]],
    tipo: ['texto' as TipoCampo, [Validators.required]],
    requerido: [false],
    visibleEnLista: [false],
    opciones: this.formBuilder.control([] as { clave: string; valor: string }[]),
    orden: [0]
  });

  ngOnInit(): void {
    const campo = this.data.campo;

    if (campo) {
      this.form.patchValue({
        idCampo: campo.idCampo,
        nombreMostrar: campo.nombreMostrar,
        tipo: campo.tipo,
        requerido: campo.requerido ?? false,
        visibleEnLista: campo.visibleEnLista ?? false,
        opciones: campo.opciones ?? [],
        orden: campo.orden ?? 0
      });
      this.form.controls.tipo.disable({ emitEvent: false });
    }

    this.form.controls.tipo.valueChanges.subscribe((tipo) => {
      this.actualizarOpcionesSegunTipo(tipo);
    });

    this.actualizarOpcionesSegunTipo(this.form.controls.tipo.value);
  }

  protected tieneOpciones(): boolean {
    const tipo = this.form.controls.tipo.value;
    return tipo === 'lista_simple' || tipo === 'lista_multiple' || tipo === 'catalogo';
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const idCampo = raw.idCampo || this.generarIdCampo(raw.nombreMostrar);

    const campo: CampoPersonalizado = {
      idCampo,
      nombreMostrar: raw.nombreMostrar,
      tipo: raw.tipo,
      requerido: raw.requerido,
      visibleEnLista: raw.visibleEnLista,
      orden: raw.orden ?? 0,
      activo: true,
      opciones: this.tieneOpciones() ? raw.opciones ?? [] : undefined
    };

    this.dialogRef.close(campo);
  }

  private actualizarOpcionesSegunTipo(tipo: TipoCampo): void {
    if (tipo === 'lista_simple' || tipo === 'lista_multiple' || tipo === 'catalogo') {
      return;
    }

    this.form.controls.opciones.setValue([], { emitEvent: false });
  }

  private generarIdCampo(nombreMostrar: string): string {
    const slug = nombreMostrar
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return slug || `campo_${Date.now()}`;
  }
}

import { Component, forwardRef, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormBuilder, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { OpcionLista } from '../../models/clientes.models';

@Component({
  selector: 'app-catalogo-opciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CatalogoOpcionesComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CatalogoOpcionesComponent),
      multi: true
    }
  ],
  template: `
    <div class="catalogo-opciones">
      <div class="header">
        <strong>Opciones del catálogo</strong>
        <button type="button" mat-stroked-button color="primary" (click)="agregarOpcion()">
          <mat-icon>add</mat-icon>
          Agregar opción
        </button>
      </div>

      <div class="opciones-list">
        @for (grupo of opciones.controls; track $index) {
          <div class="opcion-row" [formGroup]="$any(grupo)">
            <mat-form-field appearance="outline">
              <mat-label>Clave</mat-label>
              <input matInput formControlName="clave" />
              @if (mostrarErrorDuplicado(grupo.value.clave)) {
                <mat-error>La clave debe ser unica.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Valor</mat-label>
              <input matInput formControlName="valor" />
            </mat-form-field>

            <button type="button" mat-icon-button color="warn" (click)="eliminarOpcion($index)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .catalogo-opciones { display: grid; gap: 1rem; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .opciones-list { display: grid; gap: .75rem; }
    .opcion-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: .75rem; align-items: center; }
  `]
})
export class CatalogoOpcionesComponent implements ControlValueAccessor, Validator, OnChanges {
  @Input() disabled = false;

  private readonly formBuilder = inject(FormBuilder);
  protected readonly opciones = this.formBuilder.array([
    this.crearGrupoOpcion()
  ]);

  private onChange: (value: OpcionLista[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled']) {
      this.disabled ? this.opciones.disable({ emitEvent: false }) : this.opciones.enable({ emitEvent: false });
    }
  }

  writeValue(value: OpcionLista[] | null): void {
    this.opciones.clear({ emitEvent: false });

    const opciones = value?.length ? value : [];
    if (opciones.length === 0) {
      this.opciones.push(this.crearGrupoOpcion(), { emitEvent: false });
    } else {
      opciones.forEach((opcion) => this.opciones.push(this.crearGrupoOpcion(opcion), { emitEvent: false }));
    }
  }

  registerOnChange(fn: (value: OpcionLista[]) => void): void {
    this.onChange = fn;
    this.opciones.valueChanges.subscribe((value) => {
      this.onChange((value as OpcionLista[]).filter((opcion) => !!opcion.clave || !!opcion.valor));
      this.onValidatorChange();
    });
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.opciones.disable({ emitEvent: false }) : this.opciones.enable({ emitEvent: false });
  }

  validate(): ValidationErrors | null {
    const claves = this.opciones.controls.map((control) => control.get('clave')?.value?.trim()).filter(Boolean);
    const hasDuplicates = new Set(claves).size !== claves.length;
    const hasInvalid = this.opciones.controls.some((control) => !control.get('clave')?.value || !control.get('valor')?.value);

    if (hasDuplicates) {
      return { clavesDuplicadas: true };
    }

    return hasInvalid ? { opcionesInvalidas: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  agregarOpcion(): void {
    this.opciones.push(this.crearGrupoOpcion());
    this.onTouched();
  }

  eliminarOpcion(index: number): void {
    if (this.opciones.length === 1) {
      this.opciones.at(0).reset({ clave: '', valor: '' });
      return;
    }

    this.opciones.removeAt(index);
    this.onTouched();
  }

  mostrarErrorDuplicado(clave: unknown): boolean {
    if (!clave) {
      return false;
    }

    const claves = this.opciones.controls.map((control) => control.get('clave')?.value?.trim()).filter(Boolean);
    return claves.filter((item) => item === String(clave).trim()).length > 1;
  }

  private crearGrupoOpcion(opcion?: Partial<OpcionLista>) {
    return this.formBuilder.group({
      clave: new FormControl(opcion?.clave ?? '', { nonNullable: true }),
      valor: new FormControl(opcion?.valor ?? '', { nonNullable: true })
    });
  }
}
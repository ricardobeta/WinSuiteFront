import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnChanges, SimpleChanges, forwardRef, inject } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CampoPersonalizado } from '../../models/clientes.models';

@Component({
  selector: 'app-campos-custom-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDatepickerModule
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CamposCustomFormComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CamposCustomFormComponent),
      multi: true
    }
  ],
  template: `
    <div class="campos-custom-container" [formGroup]="camposForm">
      @for (campo of campos; track campo.idCampo) {
        @switch (campo.tipo) {
          @case ('texto') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <input matInput [formControlName]="campo.idCampo" [readonly]="modoLectura" />
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Este campo es obligatorio.</mat-error>
              }
            </mat-form-field>
          }
          @case ('textarea') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <textarea matInput rows="3" [formControlName]="campo.idCampo" [readonly]="modoLectura"></textarea>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Este campo es obligatorio.</mat-error>
              }
            </mat-form-field>
          }
          @case ('booleano') {
            <div class="campo-bool">
              <mat-slide-toggle [formControlName]="campo.idCampo" [disabled]="modoLectura">
                {{ campo.nombreMostrar }}
              </mat-slide-toggle>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <small class="field-error">Debes activar esta opción.</small>
              }
            </div>
          }
          @case ('lista_simple') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <mat-select [formControlName]="campo.idCampo" [disabled]="modoLectura">
                @for (opcion of campo.opciones ?? []; track opcion.clave) {
                  <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
                }
              </mat-select>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Selecciona una opción.</mat-error>
              }
            </mat-form-field>
          }
          @case ('lista_multiple') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <mat-select [formControlName]="campo.idCampo" multiple [disabled]="modoLectura">
                @for (opcion of campo.opciones ?? []; track opcion.clave) {
                  <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
                }
              </mat-select>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Selecciona al menos una opción.</mat-error>
              }
            </mat-form-field>
          }
          @case ('catalogo') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <mat-select [formControlName]="campo.idCampo" [disabled]="modoLectura">
                @for (opcion of campo.opciones ?? []; track opcion.clave) {
                  <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
                }
              </mat-select>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Selecciona una opción.</mat-error>
              }
            </mat-form-field>
          }
          @case ('fecha') {
            <mat-form-field appearance="outline">
              <mat-label>{{ campo.nombreMostrar }}</mat-label>
              <input matInput [matDatepicker]="picker" [formControlName]="campo.idCampo" [readonly]="modoLectura" />
              @if (!modoLectura) {
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              }
              <mat-datepicker #picker></mat-datepicker>
              @if (mostrarErrorRequerido(campo.idCampo)) {
                <mat-error>Selecciona una fecha.</mat-error>
              }
            </mat-form-field>
          }
        }
      }
    </div>
  `,
  styles: [`
    .campos-custom-container { display: grid; gap: 1rem; }
    .campos-custom-container mat-form-field { width: 100%; }
    .campo-bool { padding: .5rem 0; }
    .field-error { color: #b3261e; font-size: .75rem; display: inline-block; margin-top: .35rem; }
  `]
})
export class CamposCustomFormComponent implements ControlValueAccessor, Validator, OnChanges {
  @Input() campos: CampoPersonalizado[] = [];
  @Input() modoLectura = false;
  @Input() valores?: Record<string, any>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly camposForm = this.formBuilder.group({});

  private onChange: (value: Record<string, any>) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  private pendingValue: Record<string, any> = {};

  constructor() {
    this.camposForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (!this.modoLectura) {
        this.onChange(value as Record<string, any>);
      }
      this.onValidatorChange();
    });

    this.camposForm.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.onValidatorChange();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campos']) {
      this.rebuildControls();
      this.onValidatorChange();
    }

    if (changes['modoLectura']) {
      this.modoLectura ? this.camposForm.disable({ emitEvent: false }) : this.camposForm.enable({ emitEvent: false });
    }

    if (changes['valores'] && this.modoLectura) {
      this.patchDisplayValues();
    }
  }

  writeValue(value: Record<string, any> | null): void {
    this.pendingValue = value ?? {};
    this.patchDisplayValues();
  }

  registerOnChange(fn: (value: Record<string, any>) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.camposForm.disable({ emitEvent: false }) : this.camposForm.enable({ emitEvent: false });
    this.onValidatorChange();
  }

  validate(_: AbstractControl): ValidationErrors | null {
    if (this.modoLectura) {
      return null;
    }

    return this.camposForm.valid ? null : { camposCustomInvalidos: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  protected markTouched(): void {
    this.onTouched();
  }

  private rebuildControls(): void {
    Object.keys(this.camposForm.controls).forEach((controlName) => {
      this.camposForm.removeControl(controlName);
    });

    this.campos.forEach((campo) => {
      const initialValue = this.resolveInitialValue(campo);
      this.camposForm.addControl(
        campo.idCampo,
        new FormControl(
          { value: initialValue, disabled: this.modoLectura },
          { nonNullable: false, validators: this.buildValidators(campo) }
        )
      );
    });

    this.patchDisplayValues();
  }

  private patchDisplayValues(): void {
    const values = this.modoLectura ? (this.valores ?? this.pendingValue) : this.pendingValue;
    if (values && Object.keys(values).length > 0) {
      this.camposForm.patchValue(values, { emitEvent: false });
    }
  }

  private resolveInitialValue(campo: CampoPersonalizado): any {
    const currentValue = this.pendingValue?.[campo.idCampo] ?? this.valores?.[campo.idCampo];

    if (currentValue !== undefined) {
      return currentValue;
    }

    if (campo.tipo === 'lista_multiple') {
      return [];
    }

    if (campo.tipo === 'booleano') {
      return false;
    }

    return '';
  }

  private buildValidators(campo: CampoPersonalizado) {
    if (!campo.requerido) {
      return [];
    }

    if (campo.tipo === 'booleano') {
      return [Validators.requiredTrue];
    }

    if (campo.tipo === 'lista_multiple') {
      return [
        (control: AbstractControl): ValidationErrors | null => {
          const value = control.value;
          return Array.isArray(value) && value.length > 0 ? null : { required: true };
        }
      ];
    }

    return [Validators.required];
  }

  protected mostrarErrorRequerido(controlName: string): boolean {
    const control = this.camposForm.get(controlName);

    if (!control || this.modoLectura) {
      return false;
    }

    return control.hasError('required') && (control.touched || control.dirty || this.camposForm.touched);
  }
}
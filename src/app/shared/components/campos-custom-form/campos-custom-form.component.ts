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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CampoPersonalizado } from '../../models/clientes.models';
import { CampoCustomControlComponent } from '../campo-custom-control/campo-custom-control.component';

@Component({
  selector: 'app-campos-custom-form',
  standalone: true,
  imports: [ReactiveFormsModule, CampoCustomControlComponent],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CamposCustomFormComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CamposCustomFormComponent), multi: true }
  ],
  template: `
    <div class="campos-custom-container" [formGroup]="camposForm">
      @for (campo of campos; track campo.idCampo) {
        <app-campo-custom-control
          [campo]="campo"
          [control]="controlCampo(campo.idCampo)"
          [modoLectura]="modoLectura"
        />
      }
    </div>
  `,
  styles: [`.campos-custom-container { display: grid; gap: 1rem; }`]
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
      if (!this.modoLectura) this.onChange(value as Record<string, any>);
      this.onValidatorChange();
    });
    this.camposForm.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onValidatorChange());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campos']) {
      this.rebuildControls();
      this.onValidatorChange();
    }
    if (changes['modoLectura']) {
      this.modoLectura ? this.camposForm.disable({ emitEvent: false }) : this.camposForm.enable({ emitEvent: false });
    }
    if (changes['valores'] && this.modoLectura) this.patchDisplayValues();
  }

  writeValue(value: Record<string, any> | null): void {
    this.pendingValue = value ?? {};
    this.patchDisplayValues();
  }
  registerOnChange(fn: (value: Record<string, any>) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.camposForm.disable({ emitEvent: false }) : this.camposForm.enable({ emitEvent: false });
    this.onValidatorChange();
  }
  validate(_: AbstractControl): ValidationErrors | null {
    return this.modoLectura || this.camposForm.valid ? null : { camposCustomInvalidos: true };
  }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }

  protected controlCampo(controlName: string): FormControl<any> {
    return this.camposForm.get(controlName) as FormControl<any>;
  }

  private rebuildControls(): void {
    Object.keys(this.camposForm.controls).forEach((controlName) => this.camposForm.removeControl(controlName));
    this.campos.forEach((campo) => {
      this.camposForm.addControl(campo.idCampo, new FormControl(
        { value: this.resolveInitialValue(campo), disabled: this.modoLectura },
        { nonNullable: false, validators: this.buildValidators(campo) }
      ));
    });
    this.patchDisplayValues();
  }

  private patchDisplayValues(): void {
    const values = this.modoLectura ? (this.valores ?? this.pendingValue) : this.pendingValue;
    if (values && Object.keys(values).length > 0) this.camposForm.patchValue(values, { emitEvent: false });
  }

  private resolveInitialValue(campo: CampoPersonalizado): any {
    const currentValue = this.pendingValue?.[campo.idCampo] ?? this.valores?.[campo.idCampo];
    if (currentValue !== undefined) return currentValue;
    if (campo.tipo === 'lista_multiple') return [];
    if (campo.tipo === 'booleano') return false;
    return '';
  }

  private buildValidators(campo: CampoPersonalizado) {
    if (!campo.requerido) return [];
    if (campo.tipo === 'booleano') return [Validators.requiredTrue];
    if (campo.tipo === 'lista_multiple') {
      return [(control: AbstractControl): ValidationErrors | null =>
        Array.isArray(control.value) && control.value.length > 0 ? null : { required: true }];
    }
    return [Validators.required];
  }
}

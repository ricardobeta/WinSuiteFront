import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import {
  COLORES_ETIQUETA_CLIENTE,
  ColorEtiquetaCliente,
  EtiquetaClienteConfig
} from '../../models/clientes.models';
import { textoComparableEtiqueta } from '../../utils/etiquetas-clientes.utils';

export interface EtiquetaClienteDialogData {
  etiqueta?: EtiquetaClienteConfig;
  existentes: EtiquetaClienteConfig[];
}

@Component({
  selector: 'app-etiqueta-cliente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-heading">
      <span class="heading-mark" aria-hidden="true"><mat-icon>sell</mat-icon></span>
      <div>
        <h2 mat-dialog-title>{{ data.etiqueta ? 'Editar etiqueta' : 'Nueva etiqueta' }}</h2>
        <p>Usa un nombre breve y un color fácil de reconocer.</p>
      </div>
    </div>

    <mat-dialog-content>
      <form class="etiqueta-form" [formGroup]="form" (ngSubmit)="guardar()">
        <mat-form-field appearance="outline">
          <mat-label>Nombre de la etiqueta</mat-label>
          <input matInput formControlName="nombre" maxlength="40" autocomplete="off" />
          <mat-hint align="end">{{ form.controls.nombre.value.length }}/40</mat-hint>
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>Escribe un nombre.</mat-error>
          } @else if (form.controls.nombre.hasError('duplicada')) {
            <mat-error>Ya existe una etiqueta con ese nombre.</mat-error>
          }
        </mat-form-field>

        <fieldset>
          <legend>Color</legend>
          <div class="palette" role="radiogroup" aria-label="Color de la etiqueta">
            @for (color of colores; track color) {
              <button
                type="button"
                class="color-choice"
                [attr.data-color]="color"
                [class.is-selected]="form.controls.color.value === color"
                [attr.aria-checked]="form.controls.color.value === color"
                [attr.aria-label]="nombreColor(color)"
                role="radio"
                (click)="form.controls.color.setValue(color)"
              >
                <span aria-hidden="true"></span>
                @if (form.controls.color.value === color) { <mat-icon>check</mat-icon> }
              </button>
            }
          </div>
        </fieldset>

        <div class="chip-preview" aria-live="polite">
          <span>Vista previa</span>
          <span class="preview-chip" [attr.data-color]="form.controls.color.value">
            <i aria-hidden="true"></i>{{ form.controls.nombre.value.trim() || 'Etiqueta' }}
          </span>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="guardar()">Guardar etiqueta</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-heading { display: flex; gap: .85rem; align-items: center; padding: 1.3rem 1.5rem .35rem; }
    .heading-mark { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border-radius: 13px; background: var(--tc-primary-container); color: var(--tc-on-primary-container); }
    h2[mat-dialog-title] { margin: 0; padding: 0; font-family: var(--tc-font-family-heading); font-size: 1.3rem; letter-spacing: -.02em; }
    .dialog-heading p { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    mat-dialog-content { width: min(540px, 86vw); }
    .etiqueta-form { display: grid; gap: 1.25rem; padding-top: .8rem; }
    fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: .65rem; color: var(--tc-on-surface); font-size: .82rem; font-weight: 700; }
    .palette { display: flex; flex-wrap: wrap; gap: .65rem; }
    .color-choice { --tag-bg: #d8f3ed; --tag-fg: #075b50; position: relative; display: grid; width: 44px; height: 44px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--tag-fg); cursor: pointer; }
    .color-choice > span { width: 30px; height: 30px; border-radius: 50%; background: var(--tag-bg); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tag-fg) 22%, transparent); }
    .color-choice mat-icon { position: absolute; width: 18px; height: 18px; font-size: 18px; }
    .color-choice.is-selected { outline: 2px solid var(--primary); outline-offset: 2px; }
    .color-choice:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px; }
    .chip-preview { display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 1rem; padding: .7rem .85rem; border-radius: 12px; background: var(--tc-surface-container-low); color: var(--muted-foreground); font-size: .78rem; font-weight: 650; }
    .preview-chip { display: inline-flex; min-height: 30px; max-width: 65%; align-items: center; gap: .4rem; padding: .2rem .7rem; border-radius: 999px; background: var(--tag-bg, #d8f3ed); color: var(--tag-fg, #075b50); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .preview-chip i { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: currentColor; opacity: .72; }
    [data-color='blue'] { --tag-bg: #dceeff; --tag-fg: #174f78; }
    [data-color='violet'] { --tag-bg: #ece5ff; --tag-fg: #593b87; }
    [data-color='amber'] { --tag-bg: #ffedc7; --tag-fg: #714500; }
    [data-color='rose'] { --tag-bg: #ffe1e7; --tag-fg: #8b2943; }
    [data-color='slate'] { --tag-bg: #e7ecef; --tag-fg: #45545b; }
    :host-context(html.theme-dark) [data-color='teal'] { --tag-bg: #163f38; --tag-fg: #a9eee0; }
    :host-context(html.theme-dark) [data-color='blue'] { --tag-bg: #17364a; --tag-fg: #b9e0fb; }
    :host-context(html.theme-dark) [data-color='violet'] { --tag-bg: #35274b; --tag-fg: #ddc9ff; }
    :host-context(html.theme-dark) [data-color='amber'] { --tag-bg: #493716; --tag-fg: #ffdda0; }
    :host-context(html.theme-dark) [data-color='rose'] { --tag-bg: #4b2631; --tag-fg: #ffc6d2; }
    :host-context(html.theme-dark) [data-color='slate'] { --tag-bg: #30383c; --tag-fg: #d7e0e4; }
  `]
})
export class EtiquetaClienteDialogComponent {
  protected readonly data = inject<EtiquetaClienteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EtiquetaClienteDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly colores = COLORES_ETIQUETA_CLIENTE;
  protected readonly form = this.formBuilder.nonNullable.group({
    nombre: [this.data.etiqueta?.nombre ?? '', [Validators.required, Validators.maxLength(40)]],
    color: [this.data.etiqueta?.color ?? 'teal' as ColorEtiquetaCliente, Validators.required]
  });

  protected guardar(): void {
    const nombre = this.form.controls.nombre.value.trim();
    const comparable = textoComparableEtiqueta(nombre);
    const duplicada = this.data.existentes.some((item) =>
      item.idEtiqueta !== this.data.etiqueta?.idEtiqueta
      && textoComparableEtiqueta(item.nombre) === comparable);
    this.form.controls.nombre.updateValueAndValidity({ emitEvent: false });
    if (duplicada) {
      this.form.controls.nombre.setErrors({ ...this.form.controls.nombre.errors, duplicada: true });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      idEtiqueta: this.data.etiqueta?.idEtiqueta ?? this.generarId(),
      nombre,
      color: this.form.controls.color.value,
      activa: this.data.etiqueta?.activa ?? true
    } satisfies EtiquetaClienteConfig);
  }

  protected nombreColor(color: ColorEtiquetaCliente): string {
    return ({ teal: 'Verde petróleo', blue: 'Azul', violet: 'Violeta', amber: 'Ámbar', rose: 'Rosa', slate: 'Gris' })[color];
  }

  private generarId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `etiqueta_${Date.now()}`;
  }
}

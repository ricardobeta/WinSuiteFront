import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { CampoPersonalizado } from '../../models/clientes.models';

@Component({
  selector: 'app-campo-custom-control',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (campo().tipo) {
      @case ('texto') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <input matInput [formControl]="control()" [readonly]="modoLectura()" />
          @if (mostrarError()) { <mat-error>Este campo es obligatorio.</mat-error> }
        </mat-form-field>
      }
      @case ('textarea') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <textarea matInput rows="3" [formControl]="control()" [readonly]="modoLectura()"></textarea>
          @if (mostrarError()) { <mat-error>Este campo es obligatorio.</mat-error> }
        </mat-form-field>
      }
      @case ('booleano') {
        <div class="campo-bool">
          <mat-slide-toggle [formControl]="control()">{{ campo().nombreMostrar }}</mat-slide-toggle>
          @if (mostrarError()) { <small>Debes activar esta opción.</small> }
        </div>
      }
      @case ('lista_simple') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <mat-select [formControl]="control()">
            @for (opcion of campo().opciones ?? []; track opcion.clave) {
              <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
            }
          </mat-select>
          @if (mostrarError()) { <mat-error>Selecciona una opción.</mat-error> }
        </mat-form-field>
      }
      @case ('lista_multiple') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <mat-select [formControl]="control()" multiple>
            @for (opcion of campo().opciones ?? []; track opcion.clave) {
              <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
            }
          </mat-select>
          @if (mostrarError()) { <mat-error>Selecciona al menos una opción.</mat-error> }
        </mat-form-field>
      }
      @case ('catalogo') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <mat-select [formControl]="control()">
            @for (opcion of campo().opciones ?? []; track opcion.clave) {
              <mat-option [value]="opcion.clave">{{ opcion.valor }}</mat-option>
            }
          </mat-select>
          @if (mostrarError()) { <mat-error>Selecciona una opción.</mat-error> }
        </mat-form-field>
      }
      @case ('fecha') {
        <mat-form-field appearance="outline">
          <mat-label>{{ campo().nombreMostrar }}</mat-label>
          <input matInput [matDatepicker]="picker" [formControl]="control()" [readonly]="modoLectura()" />
          @if (!modoLectura()) { <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle> }
          <mat-datepicker #picker></mat-datepicker>
          @if (mostrarError()) { <mat-error>Selecciona una fecha.</mat-error> }
        </mat-form-field>
      }
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    mat-form-field { width: 100%; }
    .campo-bool { display: grid; min-height: 56px; align-content: center; gap: .3rem; padding: .25rem .1rem; }
    .campo-bool small { color: var(--tc-error, #b3261e); font-size: .75rem; }
  `]
})
export class CampoCustomControlComponent {
  readonly campo = input.required<CampoPersonalizado>();
  readonly control = input.required<FormControl<any>>();
  readonly modoLectura = input(false);

  protected mostrarError(): boolean {
    const control = this.control();
    return !this.modoLectura()
      && control.invalid
      && (control.touched || control.dirty)
      && (control.hasError('required') || control.hasError('requiredTrue'));
  }
}

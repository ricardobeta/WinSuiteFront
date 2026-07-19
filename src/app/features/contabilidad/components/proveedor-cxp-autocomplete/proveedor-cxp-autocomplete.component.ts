import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface ProveedorCxpOpcion {
  clave: string;
  nombre: string;
  identificacion?: string;
}

@Component({
  selector: 'app-proveedor-cxp-autocomplete',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" class="proveedor-field">
      <mat-label>{{ label }}</mat-label>
      <input
        matInput
        type="search"
        [formControl]="control"
        [matAutocomplete]="proveedoresAuto"
        #trigger="matAutocompleteTrigger"
        (focus)="abrirOpciones(trigger, false)"
        (click)="abrirOpciones(trigger, true)"
        placeholder="Escribe el nombre del proveedor"
      />
      @if (seleccionado()) {
        <button mat-icon-button matSuffix type="button" aria-label="Limpiar proveedor" (click)="limpiar()">
          <mat-icon>close</mat-icon>
        </button>
      } @else {
        <mat-icon matSuffix>search</mat-icon>
      }
      <mat-autocomplete #proveedoresAuto="matAutocomplete" [displayWith]="mostrarProveedor" (optionSelected)="seleccionar($event)">
        @for (proveedor of filtrados(); track proveedor.clave) {
          <mat-option [value]="proveedor">
            {{ proveedor.nombre }}@if (proveedor.identificacion) { · {{ proveedor.identificacion }} }
          </mat-option>
        }
        @if (filtrados().length === 0) {
          <mat-option disabled>No hay proveedores que coincidan</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: [`
    .proveedor-field { width: 100%; }
  `]
})
export class ProveedorCxpAutocompleteComponent implements OnInit, OnChanges {
  @Input() proveedores: ProveedorCxpOpcion[] = [];
  @Input() proveedorClave: string | null = null;
  @Input() label = 'Proveedor';
  @Output() proveedorSeleccionado = new EventEmitter<ProveedorCxpOpcion | null>();

  protected readonly control = new FormControl<ProveedorCxpOpcion | string>('', { nonNullable: true });
  protected readonly filtrados = signal<ProveedorCxpOpcion[]>([]);
  protected readonly seleccionado = signal<ProveedorCxpOpcion | null>(null);

  ngOnInit(): void {
    this.control.valueChanges.subscribe((value) => {
      if (typeof value === 'string') {
        this.filtrar(value);
        const actual = this.seleccionado();
        if (actual && value.trim() !== this.mostrarProveedor(actual)) {
          this.seleccionado.set(null);
          this.proveedorSeleccionado.emit(null);
        }
      }
    });
    this.sincronizarSeleccion();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('proveedores' in changes || 'proveedorClave' in changes) {
      this.sincronizarSeleccion();
      this.filtrar(typeof this.control.value === 'string' ? this.control.value : '');
    }
  }

  protected readonly mostrarProveedor = (proveedor: ProveedorCxpOpcion | string | null): string => {
    if (!proveedor) {
      return '';
    }
    return typeof proveedor === 'string' ? proveedor : proveedor.nombre;
  };

  protected seleccionar(event: MatAutocompleteSelectedEvent): void {
    const proveedor = event.option.value as ProveedorCxpOpcion;
    this.seleccionado.set(proveedor);
    this.control.setValue(proveedor, { emitEvent: false });
    this.proveedorSeleccionado.emit(proveedor);
  }

  protected limpiar(): void {
    this.seleccionado.set(null);
    this.control.setValue('', { emitEvent: false });
    this.filtrar('');
    this.proveedorSeleccionado.emit(null);
  }

  protected abrirOpciones(trigger: MatAutocompleteTrigger, aperturaExplicita: boolean): void {
    const value = this.control.value;
    if (!aperturaExplicita && typeof value !== 'string') {
      return;
    }
    this.filtrar(typeof value === 'string' ? value : '');
    queueMicrotask(() => trigger.openPanel());
  }

  private sincronizarSeleccion(): void {
    const proveedor = this.proveedores.find((item) => item.clave === this.proveedorClave) ?? null;
    this.seleccionado.set(proveedor);
    this.control.setValue(proveedor ?? '', { emitEvent: false });
  }

  private filtrar(texto: string): void {
    const termino = this.normalizar(texto);
    this.filtrados.set(
      this.proveedores
        .filter((proveedor) => !termino || this.normalizar(`${proveedor.nombre} ${proveedor.identificacion ?? ''}`).includes(termino))
        .slice(0, 30)
    );
  }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}

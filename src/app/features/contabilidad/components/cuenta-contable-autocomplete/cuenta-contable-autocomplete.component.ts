import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CuentaContable } from '../../models/contabilidad.models';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-cuenta-contable-autocomplete',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="cuenta-selector" [class.compact]="compact">
      <mat-form-field appearance="outline">
        <mat-label>{{ label }}</mat-label>
        <input
          matInput
          type="search"
          [formControl]="busquedaControl"
          [matAutocomplete]="cuentasAuto"
          #cuentasTrigger="matAutocompleteTrigger"
          (focus)="mostrarOpciones(cuentasTrigger, false)"
          (click)="mostrarOpciones(cuentasTrigger, true)"
          placeholder="Nombre o codigo"
        />
        <mat-autocomplete
          #cuentasAuto="matAutocomplete"
          [displayWith]="displayCuenta"
          (optionSelected)="seleccionarCuenta($event)"
        >
          @for (cuenta of cuentasFiltradas(); track cuenta.id ?? cuenta.codigo) {
            <mat-option [value]="cuenta">
              {{ cuenta.codigo }} - {{ cuenta.nombre }}
            </mat-option>
          }
          @if (cuentasFiltradas().length === 0) {
            <mat-option disabled>No hay cuentas disponibles con estos filtros</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      @if (mostrarNumero) {
        <mat-form-field appearance="outline">
          <mat-label>Numero de cuenta</mat-label>
          <input matInput [value]="codigoCuenta()" readonly />
        </mat-form-field>
      }
    </div>
  `,
  styles: [`
    .cuenta-selector {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(140px, 220px);
      gap: .75rem;
      align-items: start;
    }

    .cuenta-selector.compact {
      grid-template-columns: 1fr;
    }

    @media (max-width: 760px) {
      .cuenta-selector {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CuentaContableAutocompleteComponent implements OnInit, OnChanges {
  @Input() cuentas: CuentaContable[] | null = null;
  @Input() cuentaId: string | null = null;
  @Input() soloActivas = true;
  @Input() soloMovimiento = true;
  @Input() label = 'Cuenta contable';
  @Input() mostrarNumero = true;
  @Input() compact = false;
  @Input() disabled = false;

  @Output() cuentaSeleccionada = new EventEmitter<CuentaContable | null>();

  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busquedaControl = new FormControl<CuentaContable | string>('', { nonNullable: true });
  protected readonly codigoCuenta = signal('');
  private readonly todasLasCuentas = signal<CuentaContable[]>([]);
  protected readonly cuentasDisponibles = signal<CuentaContable[]>([]);
  protected readonly cuentasFiltradas = signal<CuentaContable[]>([]);
  private cuentaActual: CuentaContable | null = null;

  ngOnInit(): void {
    if (Array.isArray(this.cuentas)) {
      this.actualizarCuentas(this.cuentas);
    } else {
      this.planCuentasService
        .getCuentas()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((cuentas) => this.actualizarCuentas(cuentas));
    }

    this.busquedaControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.filtrarCuentas(value);

          if (value.trim() === '') {
            this.limpiarSeleccion();
          } else if (this.cuentaActual && value.trim() !== this.displayCuenta(this.cuentaActual)) {
            this.limpiarSeleccion();
          }
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('cuentas' in changes && Array.isArray(this.cuentas)) {
      this.actualizarCuentas(this.cuentas);
    }

    if ('cuentaId' in changes) {
      this.sincronizarCuentaSeleccionada();
    }

    if ('soloActivas' in changes || 'soloMovimiento' in changes) {
      this.actualizarCuentas(this.todasLasCuentas());
    }

    if ('disabled' in changes) {
      if (this.disabled) {
        this.busquedaControl.disable({ emitEvent: false });
      } else {
        this.busquedaControl.enable({ emitEvent: false });
      }
    }
  }

  protected readonly displayCuenta = (cuenta: CuentaContable | string | null): string => {
    if (!cuenta) {
      return '';
    }

    if (typeof cuenta === 'string') {
      return cuenta;
    }

    return `${cuenta.codigo} - ${cuenta.nombre}`;
  };

  protected seleccionarCuenta(event: MatAutocompleteSelectedEvent): void {
    const cuenta = event.option.value as CuentaContable;
    this.cuentaActual = cuenta;
    this.codigoCuenta.set(cuenta.codigo);
    this.busquedaControl.setValue(cuenta, { emitEvent: false });
    this.cuentaSeleccionada.emit(cuenta);
  }

  protected mostrarOpciones(trigger: MatAutocompleteTrigger, aperturaExplicita: boolean): void {
    const value = this.busquedaControl.value;
    if (!aperturaExplicita && typeof value !== 'string') {
      return;
    }
    this.filtrarCuentas(typeof value === 'string' ? value : '');
    queueMicrotask(() => {
      if (!this.disabled) {
        trigger.openPanel();
      }
    });
  }

  private actualizarCuentas(cuentas: CuentaContable[]): void {
    this.todasLasCuentas.set(cuentas);

    const filtradas = cuentas
      .filter((cuenta) => !this.soloActivas || cuenta.estado !== 'INACTIVA')
      .filter((cuenta) => !this.soloMovimiento || cuenta.permiteMovimiento !== false)
      .sort((a, b) => String(a.codigo ?? '').localeCompare(String(b.codigo ?? ''), undefined, { numeric: true }));

    this.cuentasDisponibles.set(filtradas);
    this.sincronizarCuentaSeleccionada();
    this.filtrarCuentas(typeof this.busquedaControl.value === 'string' ? this.busquedaControl.value : '');
  }

  private sincronizarCuentaSeleccionada(): void {
    if (!this.cuentaId) {
      this.limpiarSeleccion(false);
      return;
    }

    const cuenta = this.cuentasDisponibles().find((item) => item.id === this.cuentaId)
      ?? this.todasLasCuentas().find((item) => item.id === this.cuentaId);
    if (!cuenta || this.cuentaActual?.id === cuenta.id) {
      return;
    }

    this.cuentaActual = cuenta;
    this.codigoCuenta.set(cuenta.codigo);
    this.busquedaControl.setValue(cuenta, { emitEvent: false });
  }

  private filtrarCuentas(query: string): void {
    const term = query.trim().toLowerCase();
    const cuentas = this.cuentasDisponibles();

    if (!term) {
      this.cuentasFiltradas.set(cuentas.slice(0, 25));
      return;
    }

    this.cuentasFiltradas.set(
      cuentas
        .filter((cuenta) => {
          return String(cuenta.nombre ?? '').toLowerCase().includes(term)
            || String(cuenta.codigo ?? '').toLowerCase().includes(term);
        })
        .slice(0, 25)
    );
  }

  private limpiarSeleccion(emitir = true): void {
    if (!this.cuentaActual && !this.codigoCuenta()) {
      return;
    }

    this.cuentaActual = null;
    this.codigoCuenta.set('');
    this.busquedaControl.setValue('', { emitEvent: false });
    if (emitir) {
      this.cuentaSeleccionada.emit(null);
    }
  }
}

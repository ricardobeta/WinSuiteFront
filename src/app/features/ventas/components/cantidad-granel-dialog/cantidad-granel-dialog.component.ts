import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { redondearCantidad } from '../../../inventario/utils/producto.util';

export interface CantidadGranelDialogData {
  nombre: string;
  /** Abreviatura de la unidad de medida: kg, lb, m, L. */
  unidad: string;
  precioUnitario: number;
  /** Disponible en el almacen activo. Se ignora si `permitirExceso`. */
  stockDisponible: number;
  permitirExceso: boolean;
  /** Cantidad de partida al corregir una linea ya agregada. */
  cantidadInicial?: number;
  /** Texto del boton principal: 'Agregar' al alta, 'Actualizar' al corregir. */
  textoConfirmar?: string;
}

const TECLAS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'borrar'] as const;

/**
 * Teclado tactil para capturar cantidades decimales en la caja.
 *
 * El POS suma de 1 en 1, que sirve para unidades pero no para queso o fruta.
 * Aqui el cajero digita el peso y ve el total antes de confirmar.
 */
@Component({
  selector: 'app-cantidad-granel-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.nombre }}</h2>

    <mat-dialog-content>
      <p class="precio-base">
        {{ data.precioUnitario | number: '1.2-2' }} por {{ data.unidad }}
      </p>

      <div class="visor" [class.excedido]="excedeStock()">
        <span class="cantidad">{{ textoCantidad() }}</span>
        <span class="unidad">{{ data.unidad }}</span>
      </div>

      <div class="teclado">
        @for (tecla of teclas; track tecla) {
          <button type="button" class="tecla" [class.accion]="tecla === '.'" (click)="pulsar(tecla)">
            @if (tecla === 'borrar') {
              <mat-icon>backspace</mat-icon>
            } @else {
              {{ tecla }}
            }
          </button>
        }
      </div>

      <div class="total-row">
        <span>Total</span>
        <strong>{{ total() | number: '1.2-2' }}</strong>
      </div>

      @if (excedeStock()) {
        <p class="aviso">
          <mat-icon>error_outline</mat-icon>
          Solo hay {{ data.stockDisponible | number: '1.0-3' }} {{ data.unidad }} en este almacen.
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="limpiar()">Limpiar</button>
      <button mat-button type="button" [mat-dialog-close]="null">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="!puedeConfirmar()" (click)="confirmar()">
        {{ data.textoConfirmar ?? 'Agregar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: min(88vw, 320px); }
    .precio-base { margin: 0 0 .75rem; color: var(--muted-foreground); font-size: .9rem; }
    .visor {
      display: flex; align-items: baseline; justify-content: flex-end; gap: .4rem;
      padding: .75rem 1rem; margin-bottom: .85rem;
      border-radius: 12px; background: var(--tc-surface-container-low);
    }
    .visor.excedido { background: color-mix(in srgb, var(--tc-error) 12%, transparent); }
    .cantidad { font-size: 2.1rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .unidad { color: var(--muted-foreground); font-weight: 600; }
    .teclado { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .tecla {
      /* 56px: objetivo de toque comodo para operar con el dedo y con prisa. */
      min-height: 56px;
      border: 0; border-radius: 12px; cursor: pointer;
      background: var(--tc-surface-container-low); color: var(--tc-on-surface);
      font-size: 1.25rem; font-weight: 650;
      display: grid; place-items: center;
      transition: background-color .15s ease, transform .12s ease;
    }
    .tecla:active { transform: scale(.96); background: color-mix(in srgb, var(--tc-primary-container) 40%, var(--tc-surface-container-low)); }
    .tecla.accion { color: var(--primary); }
    .total-row {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-top: .9rem; padding-top: .75rem;
      border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    }
    .total-row strong { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
    .aviso {
      display: flex; align-items: center; gap: .35rem;
      margin: .6rem 0 0; color: var(--tc-error); font-size: .82rem;
    }
    .aviso mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `]
})
export class CantidadGranelDialogComponent {
  protected readonly data = inject<CantidadGranelDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CantidadGranelDialogComponent, number | null>);

  protected readonly teclas = TECLAS;

  /** Se guarda como texto para no perder el "0." intermedio mientras se teclea. */
  protected readonly textoCantidad = signal(
    this.data.cantidadInicial && this.data.cantidadInicial > 0 ? String(this.data.cantidadInicial) : '0'
  );

  protected readonly cantidad = computed(() => {
    const valor = Number(this.textoCantidad());
    return Number.isFinite(valor) ? redondearCantidad(valor) : 0;
  });

  protected readonly total = computed(() => this.cantidad() * Number(this.data.precioUnitario ?? 0));

  protected readonly excedeStock = computed(
    () => !this.data.permitirExceso && this.cantidad() > Number(this.data.stockDisponible ?? 0)
  );

  protected readonly puedeConfirmar = computed(() => this.cantidad() > 0 && !this.excedeStock());

  protected pulsar(tecla: string): void {
    const actual = this.textoCantidad();

    if (tecla === 'borrar') {
      const recortado = actual.slice(0, -1);
      this.textoCantidad.set(recortado.length > 0 ? recortado : '0');
      return;
    }

    if (tecla === '.') {
      if (!actual.includes('.')) {
        this.textoCantidad.set(`${actual}.`);
      }
      return;
    }

    // Tres decimales cubren gramos y mililitros; mas no lo pesa ninguna balanza de mostrador.
    const decimales = actual.split('.')[1];
    if (decimales && decimales.length >= 3) {
      return;
    }

    this.textoCantidad.set(actual === '0' ? tecla : `${actual}${tecla}`);
  }

  protected limpiar(): void {
    this.textoCantidad.set('0');
  }

  protected confirmar(): void {
    if (this.puedeConfirmar()) {
      this.dialogRef.close(this.cantidad());
    }
  }
}

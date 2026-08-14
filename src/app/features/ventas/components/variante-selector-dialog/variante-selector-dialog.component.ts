import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { AtributoVariante } from '../../../inventario/models/inventario.models';

/** Una variante concreta, ya resuelta a datos de catalogo. */
export interface VarianteSeleccionable {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  disponible: boolean;
  valores: Record<string, string>;
  imagenUrl?: string;
}

export interface VarianteSelectorDialogData {
  nombrePadre: string;
  imagenUrl?: string;
  atributos: AtributoVariante[];
  variantes: VarianteSeleccionable[];
}

/**
 * Selector de variante del POS: un grupo de chips por eje.
 *
 * Las combinaciones agotadas se muestran deshabilitadas, no ocultas: el cajero
 * necesita poder decirle al cliente "la M roja se acabo".
 */
@Component({
  selector: 'app-variante-selector-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.nombrePadre }}</h2>

    <mat-dialog-content>
      @for (atributo of data.atributos; track atributo.id) {
        <section class="eje">
          <p class="eje-titulo">{{ atributo.nombre }}</p>
          <div class="opciones">
            @for (valor of atributo.valores; track valor) {
              <button
                type="button"
                class="opcion"
                [class.activa]="seleccion()[atributo.id] === valor"
                [class.agotada]="!valorDisponible(atributo.id, valor)"
                [disabled]="!valorAlcanzable(atributo.id, valor)"
                (click)="elegir(atributo.id, valor)"
              >
                {{ valor }}
              </button>
            }
          </div>
        </section>
      }

      <div class="resumen" [class.vacio]="!varianteElegida()">
        @if (varianteElegida(); as variante) {
          <div>
            <p class="resumen-nombre">{{ variante.sku }}</p>
            <p class="resumen-stock" [class.sin-stock]="!variante.disponible">
              {{ variante.disponible ? 'Stock: ' + (variante.stock | number: '1.0-3') : 'Agotada' }}
            </p>
          </div>
          <strong class="resumen-precio">{{ variante.precio | number: '1.2-2' }}</strong>
        } @else {
          <p class="resumen-vacio">Elige una opcion de cada caracteristica.</p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="null">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="!puedeAgregar()" (click)="agregar()">
        Agregar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: min(90vw, 380px); }
    .eje { margin-bottom: 1rem; }
    .eje-titulo { margin: 0 0 .45rem; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-foreground); }
    .opciones { display: flex; flex-wrap: wrap; gap: .45rem; }
    .opcion {
      min-height: 44px; padding: .5rem .9rem;
      border: 1px solid var(--border); border-radius: 10px;
      background: transparent; color: var(--tc-on-surface);
      font: inherit; font-weight: 600; cursor: pointer;
      transition: background-color .15s ease, border-color .15s ease;
    }
    .opcion.activa { border-color: transparent; background: color-mix(in srgb, var(--primary) 18%, transparent); color: var(--primary); }
    .opcion.agotada { text-decoration: line-through; opacity: .75; }
    .opcion:disabled { opacity: .35; cursor: not-allowed; text-decoration: none; }
    .resumen {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      margin-top: .5rem; padding: .75rem .9rem;
      border-radius: 12px; background: var(--tc-surface-container-low);
    }
    .resumen.vacio { justify-content: center; }
    .resumen-nombre { margin: 0; font-weight: 600; }
    .resumen-stock { margin: .15rem 0 0; font-size: .82rem; color: var(--muted-foreground); }
    .resumen-stock.sin-stock { color: var(--tc-error); }
    .resumen-precio { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .resumen-vacio { margin: 0; color: var(--muted-foreground); font-size: .85rem; }
  `]
})
export class VarianteSelectorDialogComponent {
  protected readonly data = inject<VarianteSelectorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VarianteSelectorDialogComponent, VarianteSeleccionable | null>);

  protected readonly seleccion = signal<Record<string, string>>(this.seleccionInicial());

  protected readonly varianteElegida = computed(() => {
    const elegido = this.seleccion();
    const completo = this.data.atributos.every((atributo) => !!elegido[atributo.id]);
    if (!completo) {
      return null;
    }

    return (
      this.data.variantes.find((variante) =>
        this.data.atributos.every((atributo) => variante.valores[atributo.id] === elegido[atributo.id])
      ) ?? null
    );
  });

  protected readonly puedeAgregar = computed(() => this.varianteElegida()?.disponible === true);

  /** Arranca con la primera combinacion que tenga stock, para ahorrar toques. */
  private seleccionInicial(): Record<string, string> {
    const preferida = this.data.variantes.find((variante) => variante.disponible) ?? this.data.variantes[0];
    return preferida ? { ...preferida.valores } : {};
  }

  protected elegir(atributoId: string, valor: string): void {
    this.seleccion.update((actual) => ({ ...actual, [atributoId]: valor }));
  }

  /** Existe alguna variante con este valor, aunque este agotada. */
  protected valorAlcanzable(atributoId: string, valor: string): boolean {
    return this.data.variantes.some((variante) => variante.valores[atributoId] === valor);
  }

  /** Existe stock combinando este valor con el resto de lo ya elegido. */
  protected valorDisponible(atributoId: string, valor: string): boolean {
    const elegido = { ...this.seleccion(), [atributoId]: valor };

    return this.data.variantes.some(
      (variante) =>
        variante.disponible &&
        this.data.atributos.every(
          (atributo) => !elegido[atributo.id] || variante.valores[atributo.id] === elegido[atributo.id]
        )
    );
  }

  protected agregar(): void {
    const variante = this.varianteElegida();
    if (variante?.disponible) {
      this.dialogRef.close(variante);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Boton Buscar de los listados que consultan bajo demanda.
 *
 * Cuando hay filtros sin aplicar late para avisar de que lo que se ve en pantalla no
 * corresponde a los filtros del formulario. El pulso usa `box-shadow` y no `transform`:
 * el boton vive dentro del grid de filtros y escalarlo desplazaria el resto de campos.
 */
@Component({
  selector: 'app-buscar-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <button
      mat-raised-button
      color="primary"
      type="button"
      class="boton"
      [class.pendiente]="avisando()"
      [disabled]="disabled() || cargando()"
      [attr.aria-label]="etiquetaAccesible()"
      [matTooltip]="avisando() ? 'Hay filtros sin aplicar' : ''"
      matTooltipPosition="above"
      (click)="buscar.emit()"
    >
      <span class="contenido">
        @if (cargando()) {
          <mat-spinner diameter="18" />
          <span>Buscando…</span>
        } @else {
          <mat-icon>search</mat-icon>
          <span>{{ etiqueta() }}</span>
        }
        @if (avisando()) {
          <span class="aviso-dot" aria-hidden="true"></span>
        }
      </span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .boton { position: relative; width: 100%; height: 100%; }
    .contenido { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; }
    .aviso-dot { position: absolute; inset-block-start: 6px; inset-inline-end: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--tc-warning); box-shadow: 0 0 0 2px var(--tc-surface-container-lowest); }
    .pendiente { animation: pulso-buscar 1.8s ease-in-out infinite; }
    @keyframes pulso-buscar {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); }
      50% { box-shadow: 0 0 0 .5rem color-mix(in srgb, var(--primary) 0%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pendiente { animation: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 45%, transparent); }
    }
  `]
})
export class BuscarButtonComponent {
  readonly disabled = input(false);
  readonly cargando = input(false);
  /** Hay filtros sin aplicar o la consulta nunca se ha ejecutado. */
  readonly pendiente = input(false);
  readonly etiqueta = input('Buscar');

  readonly buscar = output<void>();

  /** Mientras carga no se avisa: el spinner ya dice que la busqueda esta en marcha. */
  protected readonly avisando = computed(() => this.pendiente() && !this.cargando() && !this.disabled());
  protected readonly etiquetaAccesible = computed(() =>
    this.avisando() ? `${this.etiqueta()} (hay filtros sin aplicar)` : this.etiqueta()
  );
}

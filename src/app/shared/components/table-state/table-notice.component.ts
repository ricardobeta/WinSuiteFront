import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type TipoAvisoTabla = 'filtros-sucios' | 'escaneo-parcial';

/**
 * Aviso sobre la tabla de un listado paginado.
 *
 * `filtros-sucios`: el usuario cambio un filtro y lo que se ve sigue siendo el resultado
 * de la busqueda anterior. `escaneo-parcial`: el escaneo se corto por el techo de
 * seguridad y quedan registros del periodo sin revisar.
 */
@Component({
  selector: 'app-table-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="config-aviso" role="status">
      <mat-icon>{{ esFiltrosSucios() ? 'filter_alt' : 'search' }}</mat-icon>
      @if (esFiltrosSucios()) {
        <span>Los filtros cambiaron · presiona Buscar para aplicarlos.</span>
      } @else {
        <span>
          Revisados {{ escaneados() }} registros del período ·
          {{ encontrados() }} {{ encontrados() === 1 ? 'coincidencia' : 'coincidencias' }}.
          Puede haber más.
        </span>
      }
      <button mat-stroked-button type="button" (click)="accion.emit()">
        {{ esFiltrosSucios() ? 'Buscar ahora' : 'Seguir buscando en el período' }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    button { flex-shrink: 0; }
  `]
})
export class TableNoticeComponent {
  readonly tipo = input.required<TipoAvisoTabla>();
  readonly escaneados = input(0);
  readonly encontrados = input(0);

  readonly accion = output<void>();

  protected readonly esFiltrosSucios = computed(() => this.tipo() === 'filtros-sucios');
}

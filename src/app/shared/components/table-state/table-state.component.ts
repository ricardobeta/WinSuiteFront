import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * `sin-criterio` = falta elegir periodo o cuenta; `pendiente` = hay criterio pero
 * nadie ha pulsado Buscar todavia; `cargando` = escaneo en curso; `vacio` = la
 * busqueda termino sin resultados.
 */
export type EstadoTabla = 'sin-criterio' | 'pendiente' | 'cargando' | 'vacio';

interface TextosEstado {
  icono: string;
  titulo: string;
  mensaje: string;
}

const TEXTOS: Record<EstadoTabla, TextosEstado> = {
  'sin-criterio': {
    icono: 'date_range',
    titulo: 'Selecciona un período',
    mensaje: 'La consulta no se ejecutará hasta que elijas un mes.'
  },
  pendiente: {
    icono: 'manage_search',
    titulo: 'Consulta pendiente',
    mensaje: 'Presiona Buscar para cargar los resultados del período seleccionado.'
  },
  cargando: {
    icono: 'hourglass_empty',
    titulo: 'Buscando en el período',
    mensaje: ''
  },
  vacio: {
    icono: 'inbox',
    titulo: 'Sin resultados',
    mensaje: 'No hay registros para los criterios seleccionados.'
  }
};

/**
 * Estados vacios y de carga de las tablas paginadas.
 *
 * Sustituye los bloques `.empty-state` que estaban copiados en cada listado y aloja la
 * animacion de busqueda: barra indeterminada mas filas esqueleto. El texto de progreso
 * solo aparece a partir del segundo chunk, para que una busqueda de una sola lectura no
 * parpadee con un contador que nadie llega a leer.
 */
@Component({
  selector: 'app-table-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatProgressBarModule],
  host: {
    '[attr.aria-busy]': "estado() === 'cargando' ? 'true' : null"
  },
  template: `
    @if (estado() === 'cargando') {
      <div class="cargando">
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="textos().titulo" />
        <div class="skeleton" aria-hidden="true">
          @for (fila of filas(); track fila) {
            <div class="skeleton-row">
              @for (celda of celdas(); track celda) {
                <div class="skeleton-cell"></div>
              }
            </div>
          }
        </div>
        @if (chunks() > 1) {
          <p class="progreso" role="status" aria-live="polite">
            Revisados {{ escaneados() }} registros · {{ encontrados() }}
            {{ encontrados() === 1 ? 'coincidencia' : 'coincidencias' }}
          </p>
        }
      </div>
    } @else {
      <div class="empty-state">
        <mat-icon>{{ icono() ?? textos().icono }}</mat-icon>
        <h3>{{ titulo() ?? textos().titulo }}</h3>
        @if (mensaje() ?? textos().mensaje) {
          <p>{{ mensaje() ?? textos().mensaje }}</p>
        }
        <ng-content />
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: .5rem; text-align: center; color: var(--muted-foreground); }
    .empty-state h3 { margin: 0; color: var(--foreground); }
    .empty-state p { margin: 0; max-width: 42ch; }
    .cargando { min-height: 240px; display: grid; align-content: start; gap: .85rem; padding-block: .5rem; }
    .skeleton { display: grid; gap: .55rem; }
    .skeleton-row { display: flex; gap: .75rem; }
    .skeleton-cell { flex: 1 1 0; height: 1.15rem; border-radius: var(--tc-radius-md); background: linear-gradient(90deg, var(--tc-surface-container-low) 25%, color-mix(in srgb, var(--primary) 10%, var(--tc-surface-container-low)) 37%, var(--tc-surface-container-low) 63%); background-size: 240% 100%; animation: shimmer 1.4s linear infinite; }
    .skeleton-row .skeleton-cell:first-child { flex: 0 0 18%; }
    .progreso { margin: 0; text-align: center; font-size: .86rem; color: var(--muted-foreground); }
    @keyframes shimmer { from { background-position: -140% 0; } to { background-position: 240% 0; } }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-cell { animation: none; background: var(--tc-surface-container-low); }
    }
  `]
})
export class TableStateComponent {
  readonly estado = input.required<EstadoTabla>();
  readonly titulo = input<string | null>(null);
  readonly mensaje = input<string | null>(null);
  readonly icono = input<string | null>(null);
  readonly filasSkeleton = input(6);
  readonly columnasSkeleton = input(5);
  readonly escaneados = input(0);
  readonly encontrados = input(0);
  /** Lecturas del escaneo en curso. Con 1 no se muestra progreso. */
  readonly chunks = input(0);

  protected readonly textos = computed(() => TEXTOS[this.estado()]);
  protected readonly filas = computed(() =>
    Array.from({ length: Math.max(1, this.filasSkeleton()) }, (_, indice) => indice)
  );
  protected readonly celdas = computed(() =>
    Array.from({ length: Math.max(1, Math.min(this.columnasSkeleton(), 9)) }, (_, indice) => indice)
  );
}

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { CATEGORIAS_BLOQUES, DefinicionBloque } from '../../config/bloques-catalogo';

/**
 * Paleta de bloques agrupada por categoria, con buscador. Los bloques se agregan con
 * click o arrastrando al canvas (lista CDK conectada a 'canvas-bloques').
 */
@Component({
  selector: 'app-paleta-bloques',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, MatIconModule],
  template: `
    <div class="buscador">
      <mat-icon>search</mat-icon>
      <input
        type="search"
        placeholder="Buscar bloque..."
        [value]="filtro()"
        (input)="filtro.set($any($event.target).value)"
      />
    </div>
    <div
      class="paleta"
      cdkDropList
      id="paleta-bloques"
      [cdkDropListData]="filtradas()"
      [cdkDropListConnectedTo]="['canvas-bloques']"
      cdkDropListSortingDisabled
    >
      @for (grupo of grupos(); track grupo.id) {
        <span class="categoria">{{ grupo.nombre }}</span>
        @for (definicion of grupo.bloques; track definicion.tipo) {
          <button
            type="button"
            class="item"
            cdkDrag
            [cdkDragData]="definicion"
            (click)="agregar.emit(definicion)"
            [title]="definicion.descripcion"
          >
            <mat-icon>{{ definicion.icono }}</mat-icon>
            <span class="textos">
              <span>{{ definicion.nombre }}</span>
              <small>{{ definicion.descripcion }}</small>
            </span>
            <div class="placeholder" *cdkDragPlaceholder></div>
          </button>
        }
      } @empty {
        <p class="vacio">Sin resultados para "{{ filtro() }}"</p>
      }
    </div>
  `,
  styles: `
    .buscador {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 12px 0;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      padding: 4px 8px;
      background: #fff;
    }
    .buscador mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      opacity: 0.5;
    }
    .buscador input {
      border: none;
      outline: none;
      font: inherit;
      font-size: 0.85rem;
      width: 100%;
      background: none;
    }
    .paleta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
    }
    .categoria {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.5;
      margin-top: 8px;
    }
    .categoria:first-child {
      margin-top: 0;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      background: #fff;
      cursor: grab;
      font: inherit;
      font-size: 0.88rem;
      text-align: left;
    }
    .item:hover {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .item mat-icon {
      color: #2563eb;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .textos {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .textos small {
      font-size: 0.7rem;
      opacity: 0.55;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item:not(:hover) .textos small {
      display: none;
    }
    .vacio {
      opacity: 0.55;
      font-size: 0.82rem;
      text-align: center;
      margin: 16px 0;
    }
    .placeholder {
      display: none;
    }
  `,
})
export class PaletaBloquesComponent {
  readonly definiciones = input.required<DefinicionBloque[]>();
  readonly agregar = output<DefinicionBloque>();

  readonly filtro = signal('');

  readonly filtradas = computed(() => {
    const filtro = this.filtro().trim().toLowerCase();
    if (!filtro) return this.definiciones();
    return this.definiciones().filter(
      (d) =>
        d.nombre.toLowerCase().includes(filtro) || d.descripcion.toLowerCase().includes(filtro),
    );
  });

  readonly grupos = computed(() =>
    CATEGORIAS_BLOQUES.map((categoria) => ({
      ...categoria,
      bloques: this.filtradas().filter((d) => d.categoria === categoria.id),
    })).filter((grupo) => grupo.bloques.length > 0),
  );
}

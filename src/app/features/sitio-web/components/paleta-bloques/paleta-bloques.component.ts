import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { DefinicionBloque } from '../../config/bloques-catalogo';

/**
 * Paleta de bloques: se agregan con click o arrastrando al canvas
 * (lista CDK conectada a 'canvas-bloques', sin ordenamiento propio).
 */
@Component({
  selector: 'app-paleta-bloques',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, MatIconModule],
  template: `
    <div
      class="paleta"
      cdkDropList
      id="paleta-bloques"
      [cdkDropListData]="definiciones()"
      [cdkDropListConnectedTo]="['canvas-bloques']"
      cdkDropListSortingDisabled
    >
      @for (definicion of definiciones(); track definicion.tipo) {
        <button
          type="button"
          class="item"
          cdkDrag
          [cdkDragData]="definicion"
          (click)="agregar.emit(definicion)"
          [title]="definicion.descripcion"
        >
          <mat-icon>{{ definicion.icono }}</mat-icon>
          <span>{{ definicion.nombre }}</span>
          <div class="placeholder" *cdkDragPlaceholder></div>
        </button>
      }
    </div>
  `,
  styles: `
    .paleta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      background: #fff;
      cursor: grab;
      font: inherit;
      font-size: 0.9rem;
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
    }
    .placeholder {
      display: none;
    }
  `,
})
export class PaletaBloquesComponent {
  readonly definiciones = input.required<DefinicionBloque[]>();
  readonly agregar = output<DefinicionBloque>();
}

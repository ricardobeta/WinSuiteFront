import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { Bloque, BloqueRenderComponent, PaginaDoc } from '@winsuite/bloques';
import { DefinicionBloque } from '../../config/bloques-catalogo';

/**
 * Canvas WYSIWYG: renderiza los bloques con el MISMO <ws-bloque-render> del renderer publico,
 * envueltos en un chrome de edicion (seleccionar, mover, duplicar, ocultar, eliminar).
 * Recibe drops de la paleta (lista 'paleta-bloques') y reordena con drag & drop.
 */
@Component({
  selector: 'app-canvas-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragHandle, MatIconModule, BloqueRenderComponent],
  template: `
    <div
      class="canvas ws-sitio"
      cdkDropList
      id="canvas-bloques"
      [cdkDropListData]="bloques()"
      (cdkDropListDropped)="alSoltar($event)"
    >
      @if (bloques().length === 0) {
        <div class="canvas-vacio">
          <mat-icon>swipe_left</mat-icon>
          <p>Arrastra bloques desde la paleta o haz click en uno para agregarlo.</p>
        </div>
      }
      @for (bloque of bloques(); track bloque.id; let i = $index) {
        <div
          class="envoltorio"
          cdkDrag
          [class.seleccionado]="bloque.id === seleccionId()"
          [class.oculto]="!bloque.visible"
          (click)="seleccionar.emit(bloque.id)"
        >
          <div class="chrome">
            <span class="chrome-tipo">{{ bloque.tipo }}</span>
            <button type="button" cdkDragHandle title="Mover (arrastrar)">
              <mat-icon>drag_indicator</mat-icon>
            </button>
            <button type="button" (click)="mover(i, -1, $event)" [disabled]="i === 0" title="Subir">
              <mat-icon>keyboard_arrow_up</mat-icon>
            </button>
            <button
              type="button"
              (click)="mover(i, 1, $event)"
              [disabled]="i === bloques().length - 1"
              title="Bajar"
            >
              <mat-icon>keyboard_arrow_down</mat-icon>
            </button>
            <button
              type="button"
              (click)="accion(toggleVisible, bloque.id, $event)"
              title="Mostrar/ocultar"
            >
              <mat-icon>{{ bloque.visible ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
            <button type="button" (click)="accion(duplicar, bloque.id, $event)" title="Duplicar">
              <mat-icon>content_copy</mat-icon>
            </button>
            <button
              type="button"
              class="peligro"
              (click)="accion(eliminar, bloque.id, $event)"
              title="Eliminar"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <div class="contenido-bloque" [class.desvanecido]="!bloque.visible">
            <ws-bloque-render
              [bloque]="bloque"
              [nombreNegocio]="nombreNegocio()"
              [logoUrl]="logoUrl()"
              [paginas]="paginas()"
              (bloqueChange)="bloqueChange.emit($event)"
            />
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .canvas {
      min-height: 100%;
      border-radius: 8px;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.12);
      overflow: hidden;
    }
    .canvas-vacio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 80px 24px;
      opacity: 0.5;
      text-align: center;
    }
    .envoltorio {
      position: relative;
      outline: 2px solid transparent;
      outline-offset: -2px;
      transition: outline-color 0.12s ease;
    }
    .envoltorio:hover {
      outline-color: #93c5fd;
    }
    .envoltorio.seleccionado {
      outline-color: #2563eb;
    }
    .chrome {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 5;
      display: none;
      align-items: center;
      gap: 2px;
      background: #1f2937;
      border-radius: 8px;
      padding: 2px 6px;
    }
    .chrome-tipo {
      color: #d1d5db;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 4px;
    }
    .envoltorio:hover .chrome,
    .envoltorio.seleccionado .chrome {
      display: flex;
    }
    .chrome button {
      display: inline-flex;
      background: none;
      border: none;
      color: #e5e7eb;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }
    .chrome button:hover:not([disabled]) {
      background: rgba(255, 255, 255, 0.14);
    }
    .chrome button[disabled] {
      opacity: 0.35;
      cursor: default;
    }
    .chrome button.peligro:hover {
      color: #fca5a5;
    }
    .chrome mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .contenido-bloque.desvanecido {
      opacity: 0.35;
    }
    .cdk-drag-preview {
      opacity: 0.85;
    }
    .cdk-drag-placeholder {
      opacity: 0.25;
      background: #dbeafe;
      min-height: 48px;
    }
  `,
})
export class CanvasEditorComponent {
  readonly bloques = input.required<Bloque[]>();
  readonly seleccionId = input<string | null>(null);
  readonly nombreNegocio = input<string>('');
  readonly logoUrl = input<string | undefined>(undefined);
  readonly paginas = input<PaginaDoc[]>([]);

  readonly seleccionar = output<string>();
  /** Ediciones inline hechas dentro del bloque (textos, elementos de columnas). */
  readonly bloqueChange = output<Bloque>();
  readonly reordenar = output<{ desde: number; hasta: number }>();
  readonly soltarNuevo = output<{ definicion: DefinicionBloque; indice: number }>();
  readonly duplicar = output<string>();
  readonly eliminar = output<string>();
  readonly toggleVisible = output<string>();

  alSoltar(evento: CdkDragDrop<Bloque[]>): void {
    if (evento.previousContainer.id === 'paleta-bloques') {
      this.soltarNuevo.emit({
        definicion: evento.item.data as DefinicionBloque,
        indice: evento.currentIndex,
      });
      return;
    }
    if (evento.previousIndex !== evento.currentIndex) {
      this.reordenar.emit({ desde: evento.previousIndex, hasta: evento.currentIndex });
    }
  }

  mover(indice: number, delta: number, evento: Event): void {
    evento.stopPropagation();
    this.reordenar.emit({ desde: indice, hasta: indice + delta });
  }

  accion(salida: { emit: (id: string) => void }, bloqueId: string, evento: Event): void {
    evento.stopPropagation();
    salida.emit(bloqueId);
  }
}

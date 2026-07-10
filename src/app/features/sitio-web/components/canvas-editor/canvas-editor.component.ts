import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import {
  AnchoBloque,
  Bloque,
  BloqueRenderComponent,
  EstilosBloque,
  FormularioDef,
  PaginaDoc,
  Viewport,
  clasesItemBloque,
} from '@winsuite/bloques';
import { DefinicionBloque } from '../../config/bloques-catalogo';

/** Puntos de snap del resize de ancho por borde (fraccion del canvas -> anchoBloque). */
const SNAPS: { max: number; ancho: AnchoBloque }[] = [
  { max: 0.415, ancho: 'tercio' },
  { max: 0.58, ancho: 'mitad' },
  { max: 0.83, ancho: 'dosTercios' },
  { max: Infinity, ancho: 'completo' },
];

/**
 * Canvas WYSIWYG: renderiza los bloques con el MISMO <ws-bloque-render> del renderer publico,
 * envueltos en un chrome de edicion (seleccionar, mover, duplicar, ocultar, eliminar,
 * redimensionar ancho por el borde derecho, insertar entre bloques).
 * Recibe drops de la paleta (lista 'paleta-bloques') y reordena con drag & drop.
 * El canvas lleva .ws-sitio => es un @container: las reglas responsive de la lib aplican
 * segun el ANCHO DEL CANVAS (fidelidad 1:1 con el sitio publicado en cada vista).
 */
@Component({
  selector: 'app-canvas-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragHandle, MatIconModule, BloqueRenderComponent],
  template: `
    <div
      class="canvas ws-sitio ws-fila"
      cdkDropList
      id="canvas-bloques"
      cdkDropListOrientation="mixed"
      [cdkDropListData]="bloques()"
      (cdkDropListDropped)="alSoltar($event)"
      (pointermove)="moverResize($event)"
      (pointerup)="soltarResize()"
      (pointercancel)="soltarResize()"
    >
      @if (bloques().length === 0) {
        <div class="canvas-vacio ws-item">
          <mat-icon>swipe_left</mat-icon>
          <p>Arrastra bloques desde la paleta o haz click en uno para agregarlo.</p>
        </div>
      }
      @for (bloque of bloques(); track bloque.id; let i = $index) {
        <div
          class="envoltorio {{ clasesAncho(bloque) }}"
          cdkDrag
          [class.seleccionado]="bloque.id === seleccionId()"
          [class.oculto]="!bloque.visible || ocultoEnVista(bloque)"
          (click)="seleccionar.emit(bloque.id)"
        >
          <button
            type="button"
            class="insertar"
            title="Insertar bloque aqui"
            [class.activo]="puntoInsercion() === i"
            (click)="marcarInsercion(i, $event)"
          >
            <mat-icon>add</mat-icon>
          </button>
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
          <div class="contenido-bloque" [class.desvanecido]="!bloque.visible || ocultoEnVista(bloque)">
            <ws-bloque-render
              [bloque]="bloque"
              [nombreNegocio]="nombreNegocio()"
              [logoUrl]="logoUrl()"
              [paginas]="paginas()"
              [formularios]="formularios()"
              (bloqueChange)="bloqueChange.emit($event)"
            />
          </div>
          @if (ocultoEnVista(bloque)) {
            <span class="etiqueta-oculto">Oculto en esta vista</span>
          }
          <button
            type="button"
            class="asa-ancho"
            title="Arrastrar para cambiar el ancho del bloque"
            (pointerdown)="iniciarResize(bloque, $event)"
          ></button>
          @if (resize()?.bloqueId === bloque.id) {
            <span class="guia-ancho">{{ etiquetaAncho(resize()!.ancho) }}</span>
          }
        </div>
      }
      @if (bloques().length > 0) {
        <button
          type="button"
          class="insertar-final ws-item"
          [class.activo]="puntoInsercion() === bloques().length"
          (click)="marcarInsercion(bloques().length, $event)"
          title="Insertar bloque al final"
        >
          <mat-icon>add</mat-icon> Agregar bloque aqui
        </button>
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
    .insertar {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 6;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      border: none;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .envoltorio:hover .insertar,
    .insertar.activo {
      display: inline-flex;
    }
    .insertar.activo {
      background: #16a34a;
      display: inline-flex;
    }
    .insertar mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .insertar-final {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 0;
      padding: 14px;
      border: 1px dashed rgba(0, 0, 0, 0.25);
      background: none;
      color: #6b7280;
      cursor: pointer;
      font: inherit;
      font-size: 0.85rem;
    }
    .insertar-final:hover,
    .insertar-final.activo {
      color: #2563eb;
      border-color: #2563eb;
      background: #eff6ff;
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
    .etiqueta-oculto {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 4;
      background: #1f2937;
      color: #e5e7eb;
      font-size: 0.72rem;
      border-radius: 999px;
      padding: 3px 12px;
      pointer-events: none;
    }
    .asa-ancho {
      position: absolute;
      top: 50%;
      right: -3px;
      transform: translateY(-50%);
      width: 8px;
      height: 44px;
      border-radius: 6px;
      border: none;
      background: #2563eb;
      cursor: ew-resize;
      opacity: 0;
      transition: opacity 0.12s ease;
      z-index: 6;
      padding: 0;
      touch-action: none;
    }
    .envoltorio:hover .asa-ancho,
    .envoltorio.seleccionado .asa-ancho {
      opacity: 0.9;
    }
    .guia-ancho {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 7;
      background: #2563eb;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 999px;
      padding: 3px 12px;
      pointer-events: none;
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly bloques = input.required<Bloque[]>();
  readonly seleccionId = input<string | null>(null);
  readonly nombreNegocio = input<string>('');
  readonly logoUrl = input<string | undefined>(undefined);
  readonly paginas = input<PaginaDoc[]>([]);
  /** Formularios prehechos de la empresa (para previsualizar el bloque formulario). */
  readonly formularios = input<Record<string, FormularioDef>>({});
  /** Vista activa del editor (los resize/ocultar en tablet/movil van a overrides). */
  readonly viewport = input<Viewport>('desktop');
  /** Indice donde insertara el proximo bloque elegido de la paleta (null = al final). */
  readonly puntoInsercion = input<number | null>(null);

  readonly seleccionar = output<string>();
  /** Ediciones inline hechas dentro del bloque (textos, elementos, resize). */
  readonly bloqueChange = output<Bloque>();
  readonly reordenar = output<{ desde: number; hasta: number }>();
  readonly soltarNuevo = output<{ definicion: DefinicionBloque; indice: number }>();
  readonly duplicar = output<string>();
  readonly eliminar = output<string>();
  readonly toggleVisible = output<string>();
  readonly puntoInsercionChange = output<number | null>();

  /** Resize de ancho en curso (para la guia visual). */
  readonly resize = signal<{ bloqueId: string; ancho: AnchoBloque } | null>(null);
  private bloqueEnResize: Bloque | null = null;

  // El colapso responsive lo maneja el @container; aqui evitamos display:none (ws-*-oculto)
  // para poder mostrar el bloque desvanecido con la etiqueta "oculto en esta vista".
  clasesAncho(bloque: Bloque): string {
    return clasesItemBloque(bloque.estilos).replace(/\s?ws-[tm]-oculto/g, '');
  }

  ocultoEnVista(bloque: Bloque): boolean {
    const vista = this.viewport();
    if (vista === 'desktop') return false;
    return !!bloque.estilos?.responsive?.[vista]?.ocultar;
  }

  etiquetaAncho(ancho: AnchoBloque): string {
    return { completo: '100%', mitad: '50%', tercio: '33%', dosTercios: '66%' }[ancho];
  }

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

  marcarInsercion(indice: number, evento: Event): void {
    evento.stopPropagation();
    this.puntoInsercionChange.emit(this.puntoInsercion() === indice ? null : indice);
  }

  // --- Resize de ancho por el borde derecho (snap a completo/mitad/tercio/dosTercios) ---

  iniciarResize(bloque: Bloque, evento: PointerEvent): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.bloqueEnResize = bloque;
    this.resize.set({ bloqueId: bloque.id, ancho: this.anchoActual(bloque.estilos) });
    (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
  }

  moverResize(evento: PointerEvent): void {
    const bloque = this.bloqueEnResize;
    if (!bloque) return;
    evento.preventDefault();
    const canvas = this.host.nativeElement.querySelector('.canvas') as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const fraccion = (evento.clientX - rect.left) / rect.width;
    const ancho = SNAPS.find((snap) => fraccion <= snap.max)!.ancho;
    if (this.resize()?.ancho !== ancho) this.resize.set({ bloqueId: bloque.id, ancho });
  }

  soltarResize(): void {
    const bloque = this.bloqueEnResize;
    const resize = this.resize();
    this.bloqueEnResize = null;
    this.resize.set(null);
    if (!bloque || !resize) return;
    if (resize.ancho === this.anchoActual(bloque.estilos)) return;
    this.bloqueChange.emit({ ...bloque, estilos: this.conAncho(bloque.estilos, resize.ancho) });
  }

  private anchoActual(estilos?: EstilosBloque): AnchoBloque {
    const vista = this.viewport();
    if (vista !== 'desktop') {
      const override = estilos?.responsive?.[vista]?.anchoBloque;
      if (override) return override;
    }
    return estilos?.anchoBloque ?? 'completo';
  }

  /** En desktop muta la base; en tablet/movil escribe el override de esa vista. */
  private conAncho(estilos: EstilosBloque | undefined, ancho: AnchoBloque): EstilosBloque {
    const vista = this.viewport();
    if (vista === 'desktop') return { ...estilos, anchoBloque: ancho };
    const responsive = { ...estilos?.responsive };
    responsive[vista] = { ...responsive[vista], anchoBloque: ancho };
    return { ...estilos, responsive };
  }
}

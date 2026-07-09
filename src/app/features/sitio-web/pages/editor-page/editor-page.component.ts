import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  Bloque,
  CATALOGO_PRODUCTOS,
  ContenidoSitio,
  MODO_RENDER,
  PICKER_IMAGEN,
  PaginaDoc,
  PickerImagen,
  SitioConfig,
  TemaSitio,
  slugify,
  temaACssVars,
  urlGoogleFonts,
} from '@winsuite/bloques';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult,
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { SitiosService } from '../../services/sitios.service';
import { SitioBorradorService } from '../../services/sitio-borrador.service';
import { SitioPublicacionService } from '../../services/sitio-publicacion.service';
import { EditorHistorialService } from '../../services/editor-historial.service';
import { CatalogoEditorAdapter } from '../../services/catalogo-editor.adapter';
import { BLOQUES_CATALOGO, DefinicionBloque, nuevoIdBloque } from '../../config/bloques-catalogo';
import { PaletaBloquesComponent } from '../../components/paleta-bloques/paleta-bloques.component';
import { CanvasEditorComponent } from '../../components/canvas-editor/canvas-editor.component';
import { PanelPropiedadesComponent } from '../../components/panel-propiedades/panel-propiedades.component';
import { PanelTemaComponent } from '../../components/panel-tema/panel-tema.component';

type Viewport = 'desktop' | 'tablet' | 'movil';

const AUTOSAVE_MS = 1500;

@Component({
  selector: 'app-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    EditorHistorialService,
    CatalogoEditorAdapter,
    { provide: CATALOGO_PRODUCTOS, useExisting: CatalogoEditorAdapter },
    { provide: MODO_RENDER, useValue: 'editor' },
    {
      // Los bloques piden imagenes con este puerto: abre el popup compartido de archivos
      // de winsuite (buscar/reutilizar/subir) y resuelve con la URL elegida.
      provide: PICKER_IMAGEN,
      useFactory: (): PickerImagen => {
        const dialog = inject(MatDialog);
        return async () => {
          const ref = dialog.open<
            ArchivoSelectorDialogComponent,
            unknown,
            ArchivoSelectorDialogResult | null
          >(ArchivoSelectorDialogComponent, {
            data: {
              title: 'Imagenes de tu sitio',
              subtitle: 'Reutiliza una imagen ya subida o carga una nueva.',
              sourceModule: 'sitio_web',
              extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
            },
            maxWidth: '95vw',
            autoFocus: false,
          });
          const resultado = await firstValueFrom(ref.afterClosed());
          return resultado?.archivo?.downloadUrl ?? null;
        };
      },
    },
  ],
  imports: [
    MatIconModule,
    MatButtonModule,
    PaletaBloquesComponent,
    CanvasEditorComponent,
    PanelPropiedadesComponent,
    PanelTemaComponent,
  ],
  template: `
    <div class="editor">
      <div class="toolbar">
        <select class="selector-pagina" [value]="paginaActualId()" (change)="cambiarPagina($event)">
          @for (pagina of listaPaginas(); track pagina.id) {
            <option [value]="pagina.id">{{ pagina.titulo }}</option>
          }
        </select>
        <button mat-icon-button title="Nueva pagina" (click)="nuevaPagina()">
          <mat-icon>note_add</mat-icon>
        </button>

        <span class="separador"></span>

        <button
          mat-icon-button
          title="Deshacer"
          [disabled]="!historial.puedeDeshacer()"
          (click)="deshacer()"
        >
          <mat-icon>undo</mat-icon>
        </button>
        <button
          mat-icon-button
          title="Rehacer"
          [disabled]="!historial.puedeRehacer()"
          (click)="rehacer()"
        >
          <mat-icon>redo</mat-icon>
        </button>

        <span class="separador"></span>

        <button
          mat-icon-button
          title="Escritorio"
          [class.activo]="viewport() === 'desktop'"
          (click)="viewport.set('desktop')"
        >
          <mat-icon>desktop_windows</mat-icon>
        </button>
        <button
          mat-icon-button
          title="Tablet"
          [class.activo]="viewport() === 'tablet'"
          (click)="viewport.set('tablet')"
        >
          <mat-icon>tablet_mac</mat-icon>
        </button>
        <button
          mat-icon-button
          title="Movil"
          [class.activo]="viewport() === 'movil'"
          (click)="viewport.set('movil')"
        >
          <mat-icon>smartphone</mat-icon>
        </button>

        <span class="estado-guardado">
          @if (guardando()) {
            Guardando...
          } @else if (pendienteGuardar()) {
            Cambios sin guardar
          } @else {
            Borrador guardado
          }
        </span>

        <button mat-stroked-button (click)="panel.set(panel() === 'tema' ? 'propiedades' : 'tema')">
          <mat-icon>palette</mat-icon>
          Tema
        </button>
        <button mat-flat-button color="primary" [disabled]="publicando()" (click)="publicar()">
          <mat-icon>rocket_launch</mat-icon>
          {{ publicando() ? 'Publicando...' : 'Publicar' }}
        </button>
      </div>

      <div class="cuerpo">
        <aside class="lateral izquierda">
          <h3 class="titulo-panel">Bloques</h3>
          <app-paleta-bloques
            [definiciones]="definicionesDisponibles()"
            (agregar)="agregarBloque($event)"
          />
        </aside>

        <main class="zona-canvas" (click)="seleccionId.set(null)">
          <div
            class="marco"
            [class.tablet]="viewport() === 'tablet'"
            [class.movil]="viewport() === 'movil'"
            (click)="$event.stopPropagation()"
          >
            @if (contenido(); as c) {
              <div [style]="estiloTema()">
                <app-canvas-editor
                  [bloques]="bloquesActuales()"
                  [seleccionId]="seleccionId()"
                  [nombreNegocio]="config()?.nombre ?? ''"
                  [logoUrl]="c.tema.logoUrl"
                  [paginas]="listaPaginas()"
                  (seleccionar)="seleccionId.set($event)"
                  (bloqueChange)="actualizarBloque($event)"
                  (reordenar)="reordenarBloque($event.desde, $event.hasta)"
                  (soltarNuevo)="insertarBloque($event.definicion, $event.indice)"
                  (duplicar)="duplicarBloque($event)"
                  (eliminar)="eliminarBloque($event)"
                  (toggleVisible)="alternarVisible($event)"
                />
              </div>
            } @else {
              <div class="cargando">Cargando borrador...</div>
            }
          </div>
        </main>

        <aside class="lateral derecha">
          @if (panel() === 'tema') {
            @if (contenido(); as c) {
              <app-panel-tema [tema]="c.tema" (temaChange)="actualizarTema($event)" />
            }
          } @else {
            @if (bloqueSeleccionado(); as bloque) {
              <app-panel-propiedades
                [bloque]="bloque"
                [paginas]="listaPaginas()"
                (bloqueChange)="actualizarBloque($event)"
              />
            } @else {
              <div class="sin-seleccion">
                <mat-icon>touch_app</mat-icon>
                <p>Selecciona un bloque del canvas para editar sus propiedades.</p>
              </div>
            }
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .editor {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f3f4f6;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: #fff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      flex-wrap: wrap;
    }
    .selector-pagina {
      font: inherit;
      padding: 6px 8px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      background: #fff;
      max-width: 160px;
    }
    .separador {
      width: 1px;
      height: 22px;
      background: rgba(0, 0, 0, 0.12);
      margin-inline: 6px;
    }
    .toolbar button.activo {
      color: #2563eb;
      background: #eff6ff;
      border-radius: 8px;
    }
    .estado-guardado {
      margin-left: auto;
      margin-right: 10px;
      font-size: 0.8rem;
      opacity: 0.65;
    }
    .cuerpo {
      flex: 1;
      display: grid;
      grid-template-columns: 220px 1fr 300px;
      min-height: 0;
    }
    .lateral {
      background: #fff;
      overflow-y: auto;
      min-height: 0;
    }
    .lateral.izquierda {
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }
    .lateral.derecha {
      border-left: 1px solid rgba(0, 0, 0, 0.08);
    }
    .titulo-panel {
      margin: 12px 12px 0;
      font-size: 0.95rem;
    }
    .zona-canvas {
      overflow: auto;
      padding: 20px;
      min-height: 0;
    }
    .marco {
      margin-inline: auto;
      max-width: 1180px;
      transition: max-width 0.2s ease;
    }
    .marco.tablet {
      max-width: 768px;
    }
    .marco.movil {
      max-width: 390px;
    }
    .cargando {
      text-align: center;
      padding: 60px;
      opacity: 0.6;
    }
    .sin-seleccion {
      padding: 32px 20px;
      text-align: center;
      opacity: 0.55;
    }
  `,
})
export class EditorPageComponent {
  private readonly sitiosService = inject(SitiosService);
  private readonly borradorService = inject(SitioBorradorService);
  private readonly publicacionService = inject(SitioPublicacionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly historial = inject(EditorHistorialService);

  readonly sitioId = input.required<string>();

  readonly config = signal<SitioConfig | null>(null);
  readonly contenido = signal<ContenidoSitio | null>(null);
  readonly paginaActualId = signal('home');
  readonly seleccionId = signal<string | null>(null);
  readonly viewport = signal<Viewport>('desktop');
  readonly panel = signal<'propiedades' | 'tema'>('propiedades');
  readonly guardando = signal(false);
  readonly pendienteGuardar = signal(false);
  readonly publicando = signal(false);

  private timerAutosave: ReturnType<typeof setTimeout> | null = null;

  readonly listaPaginas = computed<PaginaDoc[]>(() =>
    Object.values(this.contenido()?.paginas ?? {}),
  );

  readonly bloquesActuales = computed<Bloque[]>(
    () => this.contenido()?.paginas[this.paginaActualId()]?.bloques ?? [],
  );

  readonly bloqueSeleccionado = computed<Bloque | null>(() => {
    const id = this.seleccionId();
    return id ? (this.bloquesActuales().find((bloque) => bloque.id === id) ?? null) : null;
  });

  readonly definicionesDisponibles = computed<DefinicionBloque[]>(() =>
    BLOQUES_CATALOGO.filter(
      (definicion) => !definicion.soloEcommerce || this.config()?.tipo === 'ecommerce',
    ),
  );

  readonly estiloTema = computed(() => {
    const tema = this.contenido()?.tema;
    if (!tema) return '';
    return Object.entries(temaACssVars(tema))
      .map(([variable, valor]) => `${variable}: ${valor}`)
      .join('; ');
  });

  constructor() {
    // Carga inicial de config + borrador al resolverse el sitioId de la ruta.
    effect(() => {
      const sitioId = this.sitioId();
      void this.cargar(sitioId);
    });

    // Fidelidad tipografica: carga las Google Fonts del tema tambien en el canvas.
    effect(() => {
      const tema = this.contenido()?.tema;
      if (!tema) return;
      const url = urlGoogleFonts(tema);
      if (!url) return;
      const id = 'ws-fuentes-sitio';
      let enlace = this.documento.getElementById(id) as HTMLLinkElement | null;
      if (!enlace) {
        enlace = this.documento.createElement('link');
        enlace.id = id;
        enlace.rel = 'stylesheet';
        this.documento.head.appendChild(enlace);
      }
      if (enlace.href !== url) enlace.href = url;
    });

    // Guardado inmediato al salir del editor si quedo algo pendiente.
    this.destroyRef.onDestroy(() => {
      if (this.timerAutosave) clearTimeout(this.timerAutosave);
      if (this.pendienteGuardar()) void this.guardarAhora();
    });
  }

  private async cargar(sitioId: string): Promise<void> {
    const [config, borrador] = await Promise.all([
      this.sitiosService.getConfig(sitioId),
      this.borradorService.cargar(sitioId),
    ]);
    this.config.set(config);
    if (borrador) {
      this.contenido.set(borrador);
      this.historial.reiniciar(borrador);
      const primeraPagina = Object.keys(borrador.paginas)[0];
      if (!borrador.paginas[this.paginaActualId()] && primeraPagina) {
        this.paginaActualId.set(primeraPagina);
      }
    }
  }

  /** Toda mutacion pasa por aqui: nuevo contenido -> historial -> autosave con debounce. */
  private mutar(transformar: (contenido: ContenidoSitio) => ContenidoSitio): void {
    const actual = this.contenido();
    if (!actual) return;
    const nuevo = transformar(actual);
    this.contenido.set(nuevo);
    this.historial.registrar(nuevo);
    this.programarAutosave();
  }

  private mutarBloques(transformar: (bloques: Bloque[]) => Bloque[]): void {
    const paginaId = this.paginaActualId();
    this.mutar((contenido) => {
      const pagina = contenido.paginas[paginaId];
      if (!pagina) return contenido;
      return {
        ...contenido,
        paginas: {
          ...contenido.paginas,
          [paginaId]: {
            ...pagina,
            bloques: transformar(pagina.bloques),
            actualizadoEn: Date.now(),
          },
        },
      };
    });
  }

  private programarAutosave(): void {
    this.pendienteGuardar.set(true);
    if (this.timerAutosave) clearTimeout(this.timerAutosave);
    this.timerAutosave = setTimeout(() => void this.guardarAhora(), AUTOSAVE_MS);
  }

  async guardarAhora(): Promise<void> {
    const contenido = this.contenido();
    if (!contenido) return;
    this.guardando.set(true);
    try {
      await this.borradorService.guardar(this.sitioId(), contenido);
      this.pendienteGuardar.set(false);
    } catch {
      this.snackBar.open('No se pudo guardar el borrador', 'OK', { duration: 4000 });
    } finally {
      this.guardando.set(false);
    }
  }

  agregarBloque(definicion: DefinicionBloque): void {
    this.insertarBloque(definicion, this.bloquesActuales().length);
  }

  insertarBloque(definicion: DefinicionBloque, indice: number): void {
    const bloque = definicion.crearPorDefecto(nuevoIdBloque());
    this.mutarBloques((bloques) => {
      const copia = [...bloques];
      copia.splice(Math.min(indice, copia.length), 0, bloque);
      return copia;
    });
    this.seleccionId.set(bloque.id);
  }

  reordenarBloque(desde: number, hasta: number): void {
    this.mutarBloques((bloques) => {
      const copia = [...bloques];
      const [movido] = copia.splice(desde, 1);
      copia.splice(hasta, 0, movido);
      return copia;
    });
  }

  duplicarBloque(bloqueId: string): void {
    this.mutarBloques((bloques) => {
      const indice = bloques.findIndex((bloque) => bloque.id === bloqueId);
      if (indice < 0) return bloques;
      const duplicado = { ...structuredClone(bloques[indice]), id: nuevoIdBloque() };
      const copia = [...bloques];
      copia.splice(indice + 1, 0, duplicado);
      return copia;
    });
  }

  eliminarBloque(bloqueId: string): void {
    if (this.seleccionId() === bloqueId) this.seleccionId.set(null);
    this.mutarBloques((bloques) => bloques.filter((bloque) => bloque.id !== bloqueId));
  }

  alternarVisible(bloqueId: string): void {
    this.mutarBloques((bloques) =>
      bloques.map((bloque) =>
        bloque.id === bloqueId ? { ...bloque, visible: !bloque.visible } : bloque,
      ),
    );
  }

  actualizarBloque(bloque: Bloque): void {
    this.mutarBloques((bloques) =>
      bloques.map((actual) => (actual.id === bloque.id ? bloque : actual)),
    );
  }

  actualizarTema(tema: TemaSitio): void {
    this.mutar((contenido) => ({ ...contenido, tema }));
  }

  cambiarPagina(evento: Event): void {
    this.paginaActualId.set((evento.target as HTMLSelectElement).value);
    this.seleccionId.set(null);
  }

  nuevaPagina(): void {
    const titulo = prompt('Nombre de la nueva pagina:');
    if (!titulo?.trim()) return;
    const id = `p-${Date.now().toString(36)}`;
    const pagina: PaginaDoc = {
      schemaVersion: 1,
      id,
      slug: slugify(titulo),
      titulo: titulo.trim(),
      bloques: [],
      actualizadoEn: Date.now(),
    };
    this.mutar((contenido) => ({ ...contenido, paginas: { ...contenido.paginas, [id]: pagina } }));
    this.paginaActualId.set(id);
  }

  deshacer(): void {
    const contenido = this.historial.deshacer();
    if (contenido) {
      this.contenido.set(contenido);
      this.programarAutosave();
    }
  }

  rehacer(): void {
    const contenido = this.historial.rehacer();
    if (contenido) {
      this.contenido.set(contenido);
      this.programarAutosave();
    }
  }

  async publicar(): Promise<void> {
    const config = this.config();
    if (!config || this.publicando()) return;
    this.publicando.set(true);
    try {
      await this.guardarAhora();
      const version = await this.publicacionService.publicar(config);
      this.snackBar.open(
        `Publicado (v${version}). Tu sitio: ${config.subdominio}.winsuit.app`,
        'OK',
        { duration: 6000 },
      );
    } catch (error) {
      this.snackBar.open(`No se pudo publicar: ${(error as Error).message}`, 'OK', {
        duration: 6000,
      });
    } finally {
      this.publicando.set(false);
    }
  }
}

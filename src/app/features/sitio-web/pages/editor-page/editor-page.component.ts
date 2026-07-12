import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  BarraTextoComponent,
  BarraTextoService,
  Bloque,
  CATALOGO_PRODUCTOS,
  ContenidoSitio,
  MODO_RENDER,
  PICKER_IMAGEN,
  PaginaDoc,
  PickerImagen,
  SCHEMA_VERSION_SITIO,
  SitioConfig,
  TemaSitio,
  VIEWPORT_ACTIVO,
  Viewport,
  slugify,
  temaACssVars,
  urlGoogleFonts,
} from '@winsuite/bloques';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult,
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { SitiosService } from '../../services/sitios.service';
import { FormulariosService } from '../../services/formularios.service';
import { SitioBorradorService } from '../../services/sitio-borrador.service';
import { SitioPublicacionService } from '../../services/sitio-publicacion.service';
import { EditorHistorialService } from '../../services/editor-historial.service';
import { CatalogoEditorAdapter } from '../../services/catalogo-editor.adapter';
import { BLOQUES_CATALOGO, DefinicionBloque, nuevoIdBloque } from '../../config/bloques-catalogo';
import { PaletaBloquesComponent } from '../../components/paleta-bloques/paleta-bloques.component';
import { CanvasEditorComponent } from '../../components/canvas-editor/canvas-editor.component';
import { PanelPropiedadesComponent } from '../../components/panel-propiedades/panel-propiedades.component';
import { PanelTemaComponent } from '../../components/panel-tema/panel-tema.component';
import { DialogoSitioComponent } from '../../components/dialogo-sitio/dialogo-sitio.component';

const AUTOSAVE_MS = 1500;

@Component({
  selector: 'app-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    EditorHistorialService,
    CatalogoEditorAdapter,
    { provide: CATALOGO_PRODUCTOS, useExisting: CatalogoEditorAdapter },
    { provide: MODO_RENDER, useValue: 'editor' },
    // Vista activa compartida con los bloques de la lib (edicion responsive por vista).
    { provide: VIEWPORT_ACTIVO, useFactory: () => signal<Viewport>('desktop') },
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
    MatTooltipModule,
    PaletaBloquesComponent,
    CanvasEditorComponent,
    PanelPropiedadesComponent,
    PanelTemaComponent,
    BarraTextoComponent,
  ],
  host: {
    '(document:keydown)': 'alTeclear($event)',
  },
  template: `
    <div class="editor">
      <div class="toolbar">
        <select class="selector-pagina" [value]="paginaActualId()" (change)="cambiarPagina($event)">
          @for (pagina of listaPaginas(); track pagina.id) {
            <option [value]="pagina.id">{{ pagina.titulo }}</option>
          }
        </select>
        <button mat-icon-button matTooltip="Nueva pagina" (click)="nuevaPagina()">
          <mat-icon>note_add</mat-icon>
        </button>

        <span class="separador"></span>

        <button
          mat-icon-button
          matTooltip="Deshacer (Ctrl+Z)"
          [disabled]="!historial.puedeDeshacer()"
          (click)="deshacer()"
        >
          <mat-icon>undo</mat-icon>
        </button>
        <button
          mat-icon-button
          matTooltip="Rehacer (Ctrl+Y)"
          [disabled]="!historial.puedeRehacer()"
          (click)="rehacer()"
        >
          <mat-icon>redo</mat-icon>
        </button>

        <span class="separador"></span>

        <button
          mat-icon-button
          matTooltip="Vista escritorio"
          [class.activo]="viewport() === 'desktop'"
          (click)="viewport.set('desktop')"
        >
          <mat-icon>desktop_windows</mat-icon>
        </button>
        <button
          mat-icon-button
          matTooltip="Vista tablet"
          [class.activo]="viewport() === 'tablet'"
          (click)="viewport.set('tablet')"
        >
          <mat-icon>tablet_mac</mat-icon>
        </button>
        <button
          mat-icon-button
          matTooltip="Vista movil"
          [class.activo]="viewport() === 'movil'"
          (click)="viewport.set('movil')"
        >
          <mat-icon>smartphone</mat-icon>
        </button>
        @if (viewport() !== 'desktop') {
          <span class="badge-vista">Editando vista {{ viewport() }}</span>
        }

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
                  [formularios]="formulariosMap()"
                  [viewport]="viewport()"
                  [puntoInsercion]="puntoInsercion()"
                  (puntoInsercionChange)="puntoInsercion.set($event)"
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

        <aside class="lateral derecha" #panelDerecho>
          @if (panel() === 'tema') {
            @if (contenido(); as c) {
              <app-panel-tema [tema]="c.tema" (temaChange)="actualizarTema($event)" />
            }
          } @else {
            @if (bloqueSeleccionado(); as bloque) {
              <app-panel-propiedades
                [bloque]="bloque"
                [paginas]="listaPaginas()"
                [viewport]="viewport()"
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

      <!-- Barra de formato flotante: se abre al enfocar cualquier texto del canvas -->
      <ws-barra-texto />
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
      /* La toolbar acompaña el scroll de la pagina */
      position: sticky;
      top: 0;
      z-index: 30;
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
    .badge-vista {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #1d4ed8;
      background: #eff6ff;
      border-radius: 999px;
      padding: 4px 10px;
      margin-left: 4px;
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
      align-items: start;
    }
    .lateral {
      background: #fff;
      overflow-y: auto;
      min-height: 0;
      /* Paneles fijos con scroll propio: sticky bajo la toolbar (tambien sticky). */
      position: sticky;
      top: 58px;
      height: calc(100vh - 58px);
      max-height: calc(100vh - 58px);
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
  private readonly dialog = inject(MatDialog);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly historial = inject(EditorHistorialService);

  readonly sitioId = input.required<string>();

  private readonly panelDerecho = viewChild<ElementRef<HTMLElement>>('panelDerecho');

  readonly config = signal<SitioConfig | null>(null);
  readonly contenido = signal<ContenidoSitio | null>(null);
  readonly paginaActualId = signal('home');
  readonly seleccionId = signal<string | null>(null);
  /** Vista activa; es el MISMO signal que inyectan los bloques via VIEWPORT_ACTIVO. */
  readonly viewport = inject(VIEWPORT_ACTIVO) as ReturnType<typeof signal<Viewport>>;
  private readonly barraTexto = inject(BarraTextoService);
  readonly panel = signal<'propiedades' | 'tema'>('propiedades');
  readonly puntoInsercion = signal<number | null>(null);
  readonly guardando = signal(false);
  readonly pendienteGuardar = signal(false);
  readonly publicando = signal(false);

  private timerAutosave: ReturnType<typeof setTimeout> | null = null;

  readonly listaPaginas = computed<PaginaDoc[]>(() =>
    Object.values(this.contenido()?.paginas ?? {}),
  );

  private readonly formulariosService = inject(FormulariosService);
  private readonly formularios = toSignal(this.formulariosService.getFormularios(), {
    initialValue: [],
  });
  /** Formularios prehechos indexados por id (los consume el bloque formulario del canvas). */
  readonly formulariosMap = computed(() =>
    Object.fromEntries(this.formularios().map((f) => [f.formularioId, f])),
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

    // La barra de texto flotante se cierra al cambiar de bloque, pagina o vista.
    effect(() => {
      this.seleccionId();
      this.paginaActualId();
      this.viewport();
      this.barraTexto.cerrar();
    });

    // Al seleccionar otro bloque, el panel de propiedades vuelve arriba.
    effect(() => {
      this.seleccionId();
      this.panelDerecho()?.nativeElement.scrollTo({ top: 0 });
    });

    // Guardado inmediato al salir del editor si quedo algo pendiente.
    this.destroyRef.onDestroy(() => {
      if (this.timerAutosave) clearTimeout(this.timerAutosave);
      if (this.pendienteGuardar()) void this.guardarAhora();
      this.barraTexto.cerrar();
    });
  }

  /** Atajos: Supr elimina, Ctrl+D duplica, Ctrl+Z/Ctrl+Y deshacer/rehacer. */
  alTeclear(evento: KeyboardEvent): void {
    const objetivo = evento.target as HTMLElement;
    // Nunca interceptar mientras se escribe (inputs del panel o textos contenteditable).
    if (
      objetivo.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(objetivo.tagName)
    ) {
      return;
    }
    const ctrl = evento.ctrlKey || evento.metaKey;
    if (ctrl && evento.key.toLowerCase() === 'z' && !evento.shiftKey) {
      evento.preventDefault();
      this.deshacer();
    } else if (ctrl && (evento.key.toLowerCase() === 'y' || (evento.key.toLowerCase() === 'z' && evento.shiftKey))) {
      evento.preventDefault();
      this.rehacer();
    } else if (ctrl && evento.key.toLowerCase() === 'd' && this.seleccionId()) {
      evento.preventDefault();
      this.duplicarBloque(this.seleccionId()!);
    } else if (evento.key === 'Delete' && this.seleccionId()) {
      evento.preventDefault();
      this.eliminarBloque(this.seleccionId()!);
    }
  }

  private async cargar(sitioId: string): Promise<void> {
    const [config, borrador] = await Promise.all([
      this.sitiosService.getConfig(sitioId),
      this.borradorService.cargar(sitioId),
    ]);
    this.config.set(config);
    if (borrador) {
      const preparado = this.asegurarPaginasSistema(borrador, config?.tipo === 'ecommerce');
      this.contenido.set(preparado);
      this.historial.reiniciar(preparado);
      const primeraPagina = Object.keys(preparado.paginas)[0];
      if (!preparado.paginas[this.paginaActualId()] && primeraPagina) {
        this.paginaActualId.set(primeraPagina);
      }
      if (preparado !== borrador) this.programarAutosave();
    }
  }

  private asegurarPaginasSistema(contenido: ContenidoSitio, incluirProducto: boolean): ContenidoSitio {
    const paginas = { ...contenido.paginas };
    let cambio = false;
    const header = (): Bloque => ({
      id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true,
      enlaces: [], mostrarCarrito: incluirProducto, estilos: { paddingY: 'compacto' },
    });
    const footer = (): Bloque => ({
      id: nuevoIdBloque(), visible: true, tipo: 'footer', texto: '© Mi negocio', redes: [],
      estilos: { paddingY: 'compacto' },
    });
    if (incluirProducto && !paginas['__producto']) {
      paginas['__producto'] = {
        schemaVersion: SCHEMA_VERSION_SITIO, id: '__producto', slug: '__producto',
        titulo: 'Diseño de producto', actualizadoEn: Date.now(),
        bloques: [header(), { id: '__zona-producto', visible: true, tipo: 'sistema-producto' }, footer()],
      };
      cambio = true;
    }
    if (!paginas['__pago']) {
      paginas['__pago'] = {
        schemaVersion: SCHEMA_VERSION_SITIO, id: '__pago', slug: '__pago',
        titulo: 'Diseño de pago', actualizadoEn: Date.now(),
        bloques: [header(), { id: '__zona-pago', visible: true, tipo: 'sistema-pago' }, footer()],
      };
      cambio = true;
    }
    return cambio ? { ...contenido, paginas } : contenido;
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

  /** Click en la paleta: inserta en el punto marcado con "+" (o al final). */
  agregarBloque(definicion: DefinicionBloque): void {
    const indice = this.puntoInsercion() ?? this.bloquesActuales().length;
    this.insertarBloque(definicion, indice);
  }

  insertarBloque(definicion: DefinicionBloque, indice: number): void {
    const bloque = definicion.crearPorDefecto(nuevoIdBloque());
    this.mutarBloques((bloques) => {
      const copia = [...bloques];
      copia.splice(Math.min(indice, copia.length), 0, bloque);
      return copia;
    });
    this.seleccionId.set(bloque.id);
    this.puntoInsercion.set(null);
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
    if (bloqueId.startsWith('__zona-')) return;
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
    if (bloqueId.startsWith('__zona-')) {
      this.snackBar.open('La zona funcional de esta página no se puede eliminar', 'OK', { duration: 3000 });
      return;
    }
    if (this.seleccionId() === bloqueId) this.seleccionId.set(null);
    this.mutarBloques((bloques) => bloques.filter((bloque) => bloque.id !== bloqueId));
  }

  alternarVisible(bloqueId: string): void {
    if (bloqueId.startsWith('__zona-')) return;
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
    this.puntoInsercion.set(null);
  }

  async nuevaPagina(): Promise<void> {
    const titulo = await firstValueFrom(
      this.dialog.open(DialogoSitioComponent, {
        data: { titulo: 'Nueva página', etiqueta: 'Nombre de la página', requerido: true, maxLength: 80 },
        width: '460px',
      }).afterClosed(),
    );
    if (!titulo?.trim()) return;
    const id = `p-${Date.now().toString(36)}`;
    const pagina: PaginaDoc = {
      schemaVersion: SCHEMA_VERSION_SITIO,
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

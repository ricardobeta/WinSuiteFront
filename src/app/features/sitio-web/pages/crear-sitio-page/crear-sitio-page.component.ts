import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ContenidoSitio, SUBDOMINIO_REGEX, TipoSitio, slugify } from '@winsuite/bloques';
import { SitiosService } from '../../services/sitios.service';
import { PLANTILLAS_SITIO, PlantillaSitio, plantillasPorTipo } from '../../config/plantillas';
import { esSubdominioReservado } from '../../config/subdominios-reservados';
import { AiSiteChatDialogComponent, AiSiteChatDialogData, AiSiteChatDialogResult } from '../../components/ai-site-chat-dialog/ai-site-chat-dialog.component';
import { SitioBorradorService } from '../../services/sitio-borrador.service';

type EstadoSubdominio =
  | 'sin-verificar'
  | 'verificando'
  | 'disponible'
  | 'ocupado'
  | 'invalido'
  | 'error';

@Component({
  selector: 'app-crear-sitio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="cabecera">
      <a mat-icon-button routerLink=".." aria-label="Volver"><mat-icon>arrow_back</mat-icon></a>
      <h1>Crear sitio</h1>
    </div>

    <div class="pasos">
      <span [class.activo]="paso() === 1">1. Tipo</span>
      <span [class.activo]="paso() === 2">2. Plantilla</span>
      <span [class.activo]="paso() === 3">3. Nombre y direccion</span>
    </div>

    @switch (paso()) {
      @case (1) {
        <h2>¿Que quieres crear?</h2>
        <div class="opciones">
          <button
            class="opcion"
            [class.seleccionada]="tipo() === 'ecommerce'"
            (click)="elegirTipo('ecommerce')"
          >
            <mat-icon>shopping_cart</mat-icon>
            <h3>Ecommerce</h3>
            <p>Tienda online con tus productos del inventario, carrito y pedidos.</p>
          </button>
          <button
            class="opcion"
            [class.seleccionada]="tipo() === 'landing'"
            (click)="elegirTipo('landing')"
          >
            <mat-icon>web</mat-icon>
            <h3>Landing page</h3>
            <p>Pagina de marketing con formularios para captar clientes.</p>
          </button>
          <button class="opcion opcion-ia" (click)="armarConIa()">
            <div class="muestra muestra-ia">
              <span class="orbita"></span><mat-icon>smart_toy</mat-icon><strong>Diseño único</strong>
            </div>
            <span class="categoria">Copiloto de sitios</span>
            <h3>Armarlo con IA</h3>
            <p>¿No sabes por dónde empezar? Conversa con el diseñador: descubre contigo si necesitas tienda o landing y crea todo el sitio.</p>
            <div class="etiquetas"><span>Colores</span><span>Textos</span><span>Secciones</span></div>
          </button>
        </div>
      }
      @case (2) {
        <h2>Elige una plantilla</h2>
        <div class="opciones">
          @for (p of plantillas(); track p.id) {
            <button
              class="opcion"
              [class.seleccionada]="plantilla()?.id === p.id"
              (click)="elegirPlantilla(p)"
            >
              <div class="muestra" [style.background]="'linear-gradient(135deg,' + p.colorPreview + ',' + (p.colorSecundario ?? p.colorPreview) + ')'">
                <div class="mini-navegacion"><span></span><span></span><span></span></div>
                <mat-icon>{{ p.icono ?? 'web' }}</mat-icon>
                <div class="mini-contenido"><b></b><i></i><i></i></div>
              </div>
              @if (p.categoria) { <span class="categoria">{{ p.categoria }}</span> }
              <h3>{{ p.nombre }}</h3>
              <p>{{ p.descripcion }}</p>
              @if (p.etiquetas?.length) {
                <div class="etiquetas">@for (e of p.etiquetas; track e) { <span>{{ e }}</span> }</div>
              }
            </button>
          }
        </div>
        <div class="acciones">
          <button mat-button (click)="paso.set(1)">Atras</button>
        </div>
      }
      @case (3) {
        <h2>Nombre y direccion de tu sitio</h2>
        <div class="formulario">
          <label>
            <span>Nombre del sitio</span>
            <input
              type="text"
              [ngModel]="nombre()"
              (ngModelChange)="cambiarNombre($event)"
              placeholder="Mi tienda"
              maxlength="80"
            />
          </label>
          <label>
            <span>Subdominio</span>
            <div class="subdominio">
              <input
                type="text"
                [ngModel]="subdominio()"
                (ngModelChange)="cambiarSubdominio($event)"
                placeholder="mi-tienda"
                maxlength="31"
              />
              <span class="sufijo">.winsuit.app</span>
            </div>
            <span
              class="ayuda"
              [class.error]="
                estadoSubdominio() === 'ocupado' ||
                estadoSubdominio() === 'invalido' ||
                estadoSubdominio() === 'error'
              "
            >
              @switch (estadoSubdominio()) {
                @case ('verificando') {
                  Comprobando disponibilidad...
                }
                @case ('disponible') {
                  ✓ Disponible
                }
                @case ('ocupado') {
                  Ese subdominio ya esta en uso o reservado.
                }
                @case ('invalido') {
                  Solo minusculas, numeros y guiones (3 a 31 caracteres, empieza con letra o
                  numero).
                }
                @case ('error') {
                  No se pudo comprobar la disponibilidad: {{ errorVerificacion() }}
                }
                @default {
                  Sera la direccion publica de tu sitio.
                }
              }
            </span>
          </label>
          <div class="acciones">
            <button mat-button (click)="paso.set(2)">Atras</button>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!puedeCrear() || creando()"
              (click)="crear()"
            >
              {{ creando() ? 'Creando...' : 'Crear sitio' }}
            </button>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 24px;
      max-width: 860px;
      margin-inline: auto;
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
    }
    .pasos {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .pasos span {
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--tc-surface-container-low);
    }
    .pasos .activo {
      background: var(--primary);
      color: var(--tc-on-primary);
      font-weight: 600;
    }
    .opciones {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .opcion {
      text-align: left;
      padding: 20px;
      border: 2px solid var(--tc-ghost-border);
      border-radius: 12px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      cursor: pointer;
      font: inherit;
    }
    .opcion:hover {
      border-color: var(--primary);
    }
    .opcion.seleccionada {
      border-color: var(--primary);
      background: var(--tc-primary-container);
      color: var(--tc-on-primary-container);
    }
    .opcion mat-icon {
      font-size: 34px;
      width: 34px;
      height: 34px;
      color: var(--primary);
    }
    .opcion h3 {
      margin: 10px 0 6px;
    }
    .opcion p {
      margin: 0;
      opacity: 0.7;
      font-size: 0.9rem;
    }
    .muestra {
      height: 128px;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      color: white;
    }
    .muestra > mat-icon { position: absolute; right: 18px; top: 44px; font-size: 42px; width: 42px; height: 42px; opacity: 0.9; color: white; }
    .opcion-ia { border-color: color-mix(in srgb, var(--primary) 45%, var(--tc-ghost-border)); position: relative; overflow: hidden; }
    .muestra-ia { background: linear-gradient(135deg, #172554, #6d28d9 58%, #ec4899); display: grid; place-content: center; justify-items: center; gap: 5px; }
    .muestra-ia mat-icon { position: static; font-size: 46px; width: 46px; height: 46px; color: white; animation: robot-flota 2.6s ease-in-out infinite; }
    .muestra-ia strong { font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; }
    .orbita { position: absolute; width: 84px; height: 84px; border: 1px solid rgba(255,255,255,.35); border-radius: 50%; animation: orbita 7s linear infinite; }
    .mini-navegacion { height: 24px; padding: 7px 10px; display: flex; gap: 5px; background: rgba(255,255,255,.14); }
    .mini-navegacion span { width: 18px; height: 3px; border-radius: 3px; background: rgba(255,255,255,.7); }
    .mini-contenido { position: absolute; left: 14px; bottom: 18px; display: grid; gap: 6px; }
    .mini-contenido b, .mini-contenido i { display: block; height: 5px; border-radius: 4px; background: white; }
    .mini-contenido b { width: 100px; height: 9px; } .mini-contenido i { width: 72px; opacity: .65; }
    .categoria { display: inline-block; margin-top: 12px; color: var(--primary); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .etiquetas { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
    .etiquetas span { padding: 3px 8px; border-radius: 999px; background: var(--tc-surface-container-low); color: var(--tc-on-surface); font-size: .72rem; }
    .formulario {
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 480px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-weight: 600;
    }
    input {
      font: inherit;
      padding: 10px 12px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .subdominio {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .subdominio input {
      flex: 1;
    }
    .sufijo {
      font-family: monospace;
      opacity: 0.7;
    }
    .ayuda {
      font-weight: 400;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .ayuda.error {
      color: var(--tc-error);
      opacity: 1;
    }
    .acciones {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }
    @keyframes robot-flota { 50% { transform: translateY(-5px) rotate(3deg); } }
    @keyframes orbita { to { transform: rotate(360deg); } }
  `,
})
export class CrearSitioPageComponent {
  private readonly sitiosService = inject(SitiosService);
  private readonly borradorService = inject(SitioBorradorService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  readonly paso = signal<1 | 2 | 3>(1);
  readonly tipo = signal<TipoSitio | null>(null);
  readonly plantilla = signal<PlantillaSitio | null>(null);
  readonly nombre = signal('');
  readonly subdominio = signal('');
  readonly estadoSubdominio = signal<EstadoSubdominio>('sin-verificar');
  readonly errorVerificacion = signal('');
  readonly creando = signal(false);
  readonly contenidoGenerado = signal<ContenidoSitio | null>(null);

  private subdominioEditadoManualmente = false;
  private timerVerificacion: ReturnType<typeof setTimeout> | null = null;
  /** Resultado completo del chat IA (blueprint + imagenes) para persistirlo al crear. */
  private aiResultado: AiSiteChatDialogResult | null = null;

  readonly plantillas = computed(() =>
    this.tipo() ? plantillasPorTipo(this.tipo() as TipoSitio) : PLANTILLAS_SITIO,
  );

  readonly puedeCrear = computed(
    () =>
      !!this.tipo() &&
      !!this.plantilla() &&
      this.nombre().trim().length >= 2 &&
      this.estadoSubdominio() === 'disponible',
  );

  elegirTipo(tipo: TipoSitio): void {
    this.tipo.set(tipo);
    this.plantilla.set(null);
    this.contenidoGenerado.set(null);
    this.aiResultado = null;
    this.paso.set(2);
  }

  elegirPlantilla(plantilla: PlantillaSitio): void {
    this.plantilla.set(plantilla);
    this.contenidoGenerado.set(null);
    this.aiResultado = null;
    this.paso.set(3);
  }

  async armarConIa(): Promise<void> {
    // Desde el paso 1 el tipo puede ser null: la IA lo descubre conversando.
    const ref = this.dialog.open<AiSiteChatDialogComponent, AiSiteChatDialogData, AiSiteChatDialogResult>(
      AiSiteChatDialogComponent,
      { injector: this.injector, data: { type: this.tipo() }, maxWidth: '96vw', maxHeight: '94vh', autoFocus: false, disableClose: true, panelClass: 'ai-site-chat-panel' },
    );
    const resultado = await firstValueFrom(ref.afterClosed());
    if (!resultado) return;
    const { contenido, tipo } = resultado;
    this.aiResultado = resultado;
    this.tipo.set(tipo);
    this.contenidoGenerado.set(contenido);
    this.plantilla.set({ id: 'generada-ia', nombre: 'Diseño creado con IA', descripcion: 'Borrador personalizado y editable.', tipo, colorPreview: contenido.tema.colorPrimario, crearContenido: () => contenido });
    this.paso.set(3);
  }

  cambiarNombre(nombre: string): void {
    this.nombre.set(nombre);
    if (!this.subdominioEditadoManualmente) {
      this.cambiarSubdominio(slugify(nombre), true);
    }
  }

  cambiarSubdominio(valor: string, autogenerado = false): void {
    if (!autogenerado) this.subdominioEditadoManualmente = true;
    const limpio = valor.toLowerCase().trim();
    this.subdominio.set(limpio);

    if (this.timerVerificacion) clearTimeout(this.timerVerificacion);
    if (!SUBDOMINIO_REGEX.test(limpio)) {
      this.estadoSubdominio.set(limpio ? 'invalido' : 'sin-verificar');
      return;
    }
    if (esSubdominioReservado(limpio)) {
      this.estadoSubdominio.set('ocupado');
      return;
    }
    this.estadoSubdominio.set('verificando');
    this.timerVerificacion = setTimeout(async () => {
      try {
        const disponible = await this.sitiosService.subdominioDisponible(limpio);
        // Evita pisar el estado si el usuario siguio escribiendo.
        if (this.subdominio() === limpio) {
          this.estadoSubdominio.set(disponible ? 'disponible' : 'ocupado');
        }
      } catch (error) {
        if (this.subdominio() === limpio) {
          this.errorVerificacion.set((error as Error).message ?? 'error desconocido');
          this.estadoSubdominio.set('error');
        }
      }
    }, 400);
  }

  async crear(): Promise<void> {
    const tipo = this.tipo();
    const plantilla = this.plantilla();
    if (!tipo || !plantilla || this.creando()) return;

    this.creando.set(true);
    try {
      const sitioId = await this.sitiosService.crearSitio({
        tipo,
        nombre: this.nombre().trim(),
        subdominio: this.subdominio(),
        contenidoInicial: this.contenidoGenerado() ?? plantilla.crearContenido(),
      });
      // Persistir el estado del Copiloto: permite seguir iterando el diseño desde el editor.
      if (this.aiResultado?.blueprint) {
        await this.borradorService.guardarIa(sitioId, {
          type: this.aiResultado.tipo,
          blueprint: this.aiResultado.blueprint,
          imageUrls: this.aiResultado.imageUrls,
          formBindings: this.aiResultado.formBindings,
        }).catch(() => undefined);
      }
      this.snackBar.open('Sitio creado. ¡A construir!', 'OK', { duration: 3000 });
      await this.router.navigate(['/workspace/sitio-web', sitioId, 'editor']);
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo crear el sitio', 'OK', {
        duration: 5000,
      });
    } finally {
      this.creando.set(false);
    }
  }
}

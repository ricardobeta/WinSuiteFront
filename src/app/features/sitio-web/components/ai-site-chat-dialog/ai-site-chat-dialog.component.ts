import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { CampoFormulario, ContenidoSitio, FormularioDef, TipoSitio, slugify } from '@winsuite/bloques';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult,
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { TEMA_PRESETS, TemaPreset } from '../../config/tema-presets';
import { AiSiteBlueprintCompilerService } from '../../services/ai-site-blueprint-compiler.service';
import { AiSiteEditApplierService } from '../../services/ai-site-edit-applier.service';
import {
  AiSiteBlueprint,
  AiSiteBlueprintForm,
  AiSiteChatMessage,
  AiSiteGeneratorService,
} from '../../services/ai-site-generator.service';
import { FormulariosService } from '../../services/formularios.service';

export interface AiSiteChatDialogData {
  type: TipoSitio | null;
  /** Diseño IA existente: el chat abre en modo mejora sobre el sitio actual. */
  blueprint?: AiSiteBlueprint | null;
  imageUrls?: string[];
  /** Documento real del editor: activa refinamiento no destructivo por operaciones. */
  currentContent?: ContenidoSitio | null;
  /** Vinculaciones persistentes para no volver a crear formularios IA. */
  formBindings?: Record<string, string>;
}

/** Contrato de cierre: el chat tambien resuelve el tipo cuando entro sin el. */
export interface AiSiteChatDialogResult {
  contenido: ContenidoSitio;
  tipo: TipoSitio;
  source: 'generation' | 'edit';
  /** Estado IA para persistir y poder seguir iterando desde el editor. */
  blueprint: AiSiteBlueprint | null;
  imageUrls: string[];
  formBindings: Record<string, string>;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  error?: boolean;
}

const THINKING_MESSAGES = ['Pensando…', 'Diseñando la estructura…', 'Escribiendo los textos…', 'Eligiendo colores y tipografías…', 'Componiendo las secciones…'];
const HEADING_FONTS = ['poppins', 'montserrat', 'playfair', 'roboto', 'inter'] as const;
const BODY_FONTS = ['inter', 'poppins', 'montserrat', 'roboto'] as const;

/** Nombre e icono legibles de cada tipo de seccion del blueprint. */
const SECCIONES_INFO: Record<string, { nombre: string; icono: string }> = {
  hero: { nombre: 'Portada', icono: 'panorama' },
  features: { nombre: 'Beneficios', icono: 'grid_view' },
  products: { nombre: 'Productos', icono: 'storefront' },
  testimonials: { nombre: 'Testimonios', icono: 'reviews' },
  gallery: { nombre: 'Galería', icono: 'photo_library' },
  text: { nombre: 'Texto', icono: 'notes' },
  cta: { nombre: 'Llamado a la acción', icono: 'ads_click' },
  faq: { nombre: 'Preguntas frecuentes', icono: 'quiz' },
  statistics: { nombre: 'Estadísticas', icono: 'monitoring' },
  team: { nombre: 'Equipo', icono: 'groups' },
  plans: { nombre: 'Planes y precios', icono: 'sell' },
  payment: { nombre: 'Métodos de pago', icono: 'payments' },
  contact: { nombre: 'Formulario', icono: 'contact_mail' },
  map: { nombre: 'Mapa', icono: 'location_on' },
  logos: { nombre: 'Logos', icono: 'workspace_premium' },
  carousel: { nombre: 'Carrusel', icono: 'view_carousel' },
  image: { nombre: 'Imagen', icono: 'image' },
  video: { nombre: 'Video', icono: 'smart_display' },
  button: { nombre: 'Botón', icono: 'smart_button' },
  columns: { nombre: 'Columnas', icono: 'view_column' },
  canvas: { nombre: 'Composición creativa', icono: 'dashboard_customize' },
  html: { nombre: 'Widget HTML', icono: 'code' },
  paycta: { nombre: 'Botón de pago', icono: 'shopping_cart_checkout' },
  countdown: { nombre: 'Cuenta regresiva', icono: 'timer' },
  spacer: { nombre: 'Espaciador', icono: 'height' },
};

/** Catalogo para "pídeme que agregue un bloque". */
const CATALOGO_SECCIONES = Object.entries(SECCIONES_INFO)
  .map(([type, info]) => ({ type, ...info }));

@Component({
  selector: 'app-ai-site-chat-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="chat">
      <header>
        <div class="robot" [class.pensando]="isSending()" aria-hidden="true">
          <span class="antena"></span><mat-icon>smart_toy</mat-icon><span class="brillo"></span>
        </div>
        <div>
          <span class="eyebrow">Diseñador IA de WinSuite</span>
          <h2>{{ headerTitle() }}</h2>
          <p>Conversemos: te preguntaré lo necesario y diseñaré tu sitio completo.</p>
        </div>
        <button mat-icon-button type="button" (click)="tryClose()" aria-label="Cerrar"><mat-icon>close</mat-icon></button>
      </header>

      <main #scroller>
        @for (msg of messages(); track $index) {
          <div class="bubble" [class.user]="msg.role === 'user'" [class.error]="msg.error">
            <p>{{ msg.content }}</p>
          </div>
        }

        @if (isSending()) {
          <div class="bubble thinking"><mat-spinner diameter="18"></mat-spinner><span>{{ thinkingText() }}</span></div>
        }

        @if (visibleBlueprint(); as bp) {
          <section class="result">
            <div class="result-head"><mat-icon>auto_awesome</mat-icon><b>{{ bp.concept }}</b></div>
            <div class="swatches">
              <span [style.background]="bp.theme.primary" title="Primario"></span>
              <span [style.background]="bp.theme.accent" title="Acento"></span>
              <span [style.background]="bp.theme.background" title="Fondo"></span>
              <span [style.background]="bp.theme.text" title="Texto"></span>
              <em>{{ bp.theme.headingFont }} · {{ bp.theme.bodyFont }}</em>
              <button type="button" class="toggle-tema" (click)="editingTheme.set(!editingTheme())">
                <mat-icon>palette</mat-icon>{{ editingTheme() ? 'Ocultar' : 'Personalizar colores' }}
              </button>
            </div>

            @if (editingTheme()) {
              <div class="tema-editor">
                <div class="presets">
                  @for (preset of presets; track preset.nombre) {
                    <button type="button" (click)="applyPreset(preset)" [title]="preset.nombre">
                      <span [style.background]="preset.tema.colorPrimario"></span>
                      <span [style.background]="preset.tema.colorAcento"></span>
                      {{ preset.nombre }}
                    </button>
                  }
                </div>
                <div class="colores">
                  <label>Primario<input type="color" [ngModel]="bp.theme.primary" (ngModelChange)="patchTheme({ primary: $event })" /></label>
                  <label>Acento<input type="color" [ngModel]="bp.theme.accent" (ngModelChange)="patchTheme({ accent: $event })" /></label>
                  <label>Fondo<input type="color" [ngModel]="bp.theme.background" (ngModelChange)="patchTheme({ background: $event })" /></label>
                  <label>Texto<input type="color" [ngModel]="bp.theme.text" (ngModelChange)="patchTheme({ text: $event })" /></label>
                </div>
                <div class="fuentes">
                  <label>Títulos
                    <select [ngModel]="bp.theme.headingFont" (ngModelChange)="patchTheme({ headingFont: $event })">
                      @for (f of headingFonts; track f) { <option [value]="f">{{ f }}</option> }
                    </select>
                  </label>
                  <label>Cuerpo
                    <select [ngModel]="bp.theme.bodyFont" (ngModelChange)="patchTheme({ bodyFont: $event })">
                      @for (f of bodyFonts; track f) { <option [value]="f">{{ f }}</option> }
                    </select>
                  </label>
                  <label>Esquinas
                    <select [ngModel]="bp.theme.cornerStyle" (ngModelChange)="patchTheme({ cornerStyle: $event })">
                      <option value="recto">Rectas</option><option value="suave">Suaves</option><option value="redondo">Redondas</option>
                    </select>
                  </label>
                </div>
              </div>
            }

            <div class="paginas">
              @for (page of bp.pages; track $index; let pageIndex = $index) {
                <div class="pagina">
                  <button type="button" class="pagina-head" (click)="togglePage(pageIndex)">
                    <mat-icon>{{ openPages().has(pageIndex) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                    <b>{{ page.title }}</b><span>{{ page.sections.length }} bloques</span>
                  </button>
                  @if (openPages().has(pageIndex)) {
                    <ul>
                      @for (section of page.sections; track $index; let sIndex = $index) {
                        <li>
                          <mat-icon>{{ seccionIcono(section.type) }}</mat-icon>
                          <span class="seccion-nombre">{{ seccionNombre(section.type) }}</span>
                          @if (section.title) { <em>{{ section.title }}</em> }
                          <span class="mover">
                            <button type="button" [disabled]="sIndex === 0" (click)="moveSection(pageIndex, sIndex, -1)" aria-label="Subir bloque" title="Subir"><mat-icon>arrow_upward</mat-icon></button>
                            <button type="button" [disabled]="sIndex === page.sections.length - 1" (click)="moveSection(pageIndex, sIndex, 1)" aria-label="Bajar bloque" title="Bajar"><mat-icon>arrow_downward</mat-icon></button>
                          </span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>

            <button type="button" class="toggle-tema catalogo-toggle" (click)="showCatalog.set(!showCatalog())">
              <mat-icon>widgets</mat-icon>{{ showCatalog() ? 'Ocultar bloques disponibles' : 'Ver todos los bloques disponibles' }}
            </button>
            @if (showCatalog()) {
              <div class="catalogo">
                <p>Toca un bloque y se lo pido a la IA para tu sitio:</p>
                <div class="catalogo-chips">
                  @for (bloque of catalogo; track bloque.type) {
                    <button type="button" [disabled]="isSending()" (click)="requestBlock(bloque.nombre)">
                      <mat-icon>{{ bloque.icono }}</mat-icon>{{ bloque.nombre }}
                    </button>
                  }
                </div>
              </div>
            }
            <div class="result-actions">
              <button mat-flat-button color="primary" [disabled]="isSending() || isApplying()" (click)="applyDesign()">
                @if (isApplying()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>check_circle</mat-icon> }
                {{ isApplying() ? 'Creando formularios…' : 'Usar este diseño' }}
              </button>
              <span>…o pídeme cambios aquí mismo: «hazlo más oscuro», «agrega una sección de equipo».</span>
            </div>
          </section>
        }

        @if (editingExisting && pendingEdits()) {
          <section class="result edit-result">
            <div class="result-head">
              <mat-icon>difference</mat-icon>
              <b>Cambios preparados sobre tu diseño actual</b>
            </div>
            <p>
              {{ pendingOperationCount() }}
              {{ pendingOperationCount() === 1 ? 'ajuste listo' : 'ajustes listos' }}.
              Los bloques y estilos que no pediste cambiar se conservarán.
            </p>
            <div class="result-actions">
              <button mat-flat-button color="primary" [disabled]="isSending()" (click)="applyDesign()">
                <mat-icon>check_circle</mat-icon> Aplicar estos cambios
              </button>
              <span>Puedes seguir pidiendo ajustes antes de aplicarlos.</span>
            </div>
          </section>
        }

        @if (lastSuggestions().length && !isSending()) {
          <div class="chips">
            @for (chip of lastSuggestions(); track chip) {
              <button type="button" (click)="send(chip)">{{ chip }}</button>
            }
          </div>
        }
      </main>

      @if (imageUrls().length) {
        <div class="attachments">
          @for (url of imageUrls(); track url; let i = $index) {
            <div><img [src]="url" alt="Imagen adjunta" /><button type="button" (click)="removeImage(i)" aria-label="Quitar imagen"><mat-icon>close</mat-icon></button></div>
          }
          <span>{{ imageUrls().length }}/12</span>
        </div>
      }

      <footer>
        <button mat-icon-button type="button" class="attach" [class.highlight]="highlightAttach()"
                [disabled]="imageUrls().length >= 12" (click)="addImage()" aria-label="Adjuntar imagen"
                title="Adjuntar imágenes de Mis archivos">
          <mat-icon>attach_file</mat-icon>
        </button>
        <textarea [(ngModel)]="draftValue" rows="1" maxlength="4000"
                  [placeholder]="blueprint() ? 'Pide un cambio al diseño…' : 'Escribe tu respuesta…'"
                  (keydown)="handleKeydown($event)"></textarea>
        <button mat-icon-button type="button" color="primary" [disabled]="!draftValue.trim() || isSending()"
                (click)="send()" aria-label="Enviar">
          <mat-icon>send</mat-icon>
        </button>
      </footer>
      @if (nearLimit()) {
        <div class="limit-hint"><mat-icon>info</mat-icon>La conversación es larga: te conviene generar el sitio y luego pedir ajustes.</div>
      }
    </div>
  `,
  styles: `
    .chat{width:min(880px,96vw);height:min(760px,92vh);display:flex;flex-direction:column;color:var(--tc-on-surface);background:var(--tc-surface-container-lowest)}
    header{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 16%,transparent),color-mix(in srgb,#8b5cf6 13%,transparent));border-bottom:1px solid var(--tc-ghost-border)}
    h2{margin:2px 0 4px;font-size:1.25rem} header p{margin:0;opacity:.72;font-size:.88rem}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--primary)}
    .robot{position:relative;width:58px;height:58px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(145deg,var(--primary),#7c3aed);box-shadow:0 12px 28px color-mix(in srgb,var(--primary) 28%,transparent);animation:float 3s ease-in-out infinite}.robot mat-icon{font-size:36px;width:36px;height:36px;color:white}.antena{position:absolute;top:-10px;width:4px;height:13px;background:var(--primary);border-radius:4px}.antena:after{content:'';position:absolute;width:8px;height:8px;border-radius:50%;background:#f59e0b;left:-2px;top:-4px}.brillo{position:absolute;width:8px;height:8px;background:#fff;border-radius:50%;right:8px;top:9px;opacity:.75}.pensando{animation:think .8s ease-in-out infinite alternate}
    main{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:12px}
    .bubble{max-width:78%;padding:12px 15px;border-radius:16px 16px 16px 4px;background:var(--tc-surface-container-low);border:1px solid var(--tc-ghost-border);align-self:flex-start}
    .bubble p{margin:0;white-space:pre-wrap;line-height:1.45}
    .bubble.user{align-self:flex-end;border-radius:16px 16px 4px 16px;background:var(--tc-primary-container);border-color:transparent}
    .bubble.error{background:color-mix(in srgb,var(--tc-error) 12%,transparent);color:var(--tc-error);border-color:transparent}
    .bubble.thinking{display:flex;align-items:center;gap:10px;opacity:.8}
    .chips{display:flex;flex-wrap:wrap;gap:8px}
    .chips button,.toggle-tema,.presets button,.catalogo-chips button{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;border:1px solid var(--tc-ghost-border);background:transparent;color:inherit;font:inherit;font-size:.82rem;cursor:pointer}
    .chips button,.toggle-tema{border-color:color-mix(in srgb,var(--primary) 45%,transparent);color:var(--primary);font-weight:600}
    .chips button:hover,.mover button:hover:not(:disabled),.catalogo-chips button:hover:not(:disabled){background:var(--tc-primary-container);color:var(--primary)}
    .catalogo-chips button:hover:not(:disabled){border-color:var(--primary)}
    .result{border:1.5px solid color-mix(in srgb,var(--primary) 40%,transparent);border-radius:16px;padding:16px;display:grid;gap:12px;background:color-mix(in srgb,var(--primary) 5%,transparent)}
    .edit-result p{margin:0;line-height:1.45}
    .result-head{display:flex;align-items:center;gap:9px}.result-head mat-icon{color:var(--primary)}
    .swatches{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.swatches>span{width:26px;height:26px;border-radius:8px;border:1px solid var(--tc-ghost-border)}.swatches em{margin-left:6px;font-size:.8rem;opacity:.7;font-style:normal}
    .toggle-tema{margin-left:auto}.catalogo-toggle{margin-left:0;justify-self:start}
    .tema-editor,.catalogo{display:grid;gap:10px;padding:12px;border-radius:12px;background:var(--tc-surface-container-lowest);border:1px solid var(--tc-ghost-border)}
    .presets,.catalogo-chips{display:flex;flex-wrap:wrap;gap:7px}
    .presets button span{width:14px;height:14px;border-radius:50%;border:1px solid var(--tc-ghost-border)}
    .colores,.fuentes{display:grid;gap:10px}.colores{grid-template-columns:repeat(4,1fr)}.fuentes{grid-template-columns:repeat(3,1fr)}
    .colores label,.fuentes label{display:grid;gap:5px;font-size:.78rem;font-weight:650}
    .colores input{width:100%;height:34px;border:1px solid var(--tc-ghost-border);border-radius:8px;padding:2px;background:transparent;cursor:pointer}
    .fuentes select{font:inherit;color:inherit;background:var(--tc-surface-container-lowest);border:1px solid var(--tc-ghost-border);border-radius:8px;padding:7px 9px}
    .paginas{display:grid;gap:6px}.pagina{border:1px solid var(--tc-ghost-border);border-radius:10px;overflow:hidden}
    .pagina-head{display:flex;align-items:center;gap:7px;width:100%;padding:9px 11px;border:none;background:var(--tc-surface-container-low);color:inherit;font:inherit;cursor:pointer;text-align:left}.pagina-head span{margin-left:auto;font-size:.78rem;opacity:.6}
    .pagina ul{margin:0;padding:6px 8px;list-style:none;display:grid;gap:2px}
    .pagina li{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px}.pagina li:hover{background:var(--tc-surface-container-low)}
    .pagina li>mat-icon{color:var(--primary);opacity:.85}
    .pagina mat-icon,.mover mat-icon,.catalogo-chips mat-icon,.toggle-tema mat-icon{font-size:17px;width:17px;height:17px}
    .seccion-nombre{font-size:.86rem;font-weight:600}.pagina li em{font-size:.78rem;opacity:.55;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
    .mover{margin-left:auto;display:inline-flex;gap:2px}.mover button{width:26px;height:26px;display:grid;place-items:center;border:none;border-radius:6px;background:transparent;color:inherit;cursor:pointer;padding:0}.mover button:disabled{opacity:.25;cursor:default}
    .catalogo p{margin:0;font-size:.82rem;opacity:.7}.catalogo-chips button:disabled{opacity:.5;cursor:default}
    .result-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.result-actions span{font-size:.82rem;opacity:.7;flex:1;min-width:200px}.result-actions button mat-spinner{display:inline-block;margin-right:6px}
    .attachments{display:flex;align-items:center;gap:8px;padding:8px 24px 0;flex-wrap:wrap}.attachments div{position:relative;width:52px;height:52px}.attachments img{width:100%;height:100%;object-fit:cover;border-radius:10px}.attachments div button{position:absolute;right:-7px;top:-7px;width:20px;height:20px;border-radius:50%;border:none;background:var(--tc-on-surface);color:var(--tc-surface-container-lowest);display:grid;place-items:center;cursor:pointer;padding:0}.attachments div button mat-icon{font-size:13px;width:13px;height:13px}.attachments>span{font-size:.78rem;opacity:.6}
    footer{display:flex;align-items:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--tc-ghost-border)}
    footer textarea{flex:1;font:inherit;color:inherit;background:var(--tc-surface-container-low);border:1px solid var(--tc-ghost-border);border-radius:14px;padding:11px 14px;resize:none;max-height:120px}
    footer textarea:focus{outline:2px solid color-mix(in srgb,var(--primary) 35%,transparent);border-color:var(--primary)}
    .attach.highlight{color:var(--primary);animation:pulse 1.1s ease-in-out infinite}
    .limit-hint{display:flex;align-items:center;gap:8px;padding:6px 24px 12px;font-size:.8rem;opacity:.7}.limit-hint mat-icon{font-size:17px;width:17px;height:17px}
    @keyframes float{50%{transform:translateY(-5px)}}@keyframes think{to{transform:rotate(4deg) scale(1.04)}}@keyframes pulse{50%{transform:scale(1.18)}}
    @media(max-width:650px){header{padding:14px 16px}.robot{width:48px;height:48px;border-radius:16px}.robot mat-icon{font-size:30px;width:30px;height:30px}main{padding:14px 16px}.bubble{max-width:88%}.colores{grid-template-columns:1fr 1fr}.fuentes{grid-template-columns:1fr}}
  `,
})
export class AiSiteChatDialogComponent implements OnDestroy {
  readonly data = inject<AiSiteChatDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AiSiteChatDialogComponent, AiSiteChatDialogResult>);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly generator = inject(AiSiteGeneratorService);
  private readonly compiler = inject(AiSiteBlueprintCompilerService);
  private readonly editApplier = inject(AiSiteEditApplierService);
  private readonly formularios = inject(FormulariosService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly resolvedType = signal<TipoSitio | null>(this.data.type);
  readonly messages = signal<ChatMsg[]>([this.welcomeMessage()]);
  readonly isSending = signal(false);
  readonly isApplying = signal(false);
  readonly imageUrls = signal<string[]>(this.data.imageUrls ?? []);
  readonly blueprint = signal<AiSiteBlueprint | null>(this.data.blueprint ?? null);
  readonly editingExisting = !!this.data.currentContent;
  readonly previewContent = signal<ContenidoSitio | null>(
    this.data.currentContent ? structuredClone(this.data.currentContent) : null,
  );
  readonly pendingEdits = signal(false);
  readonly pendingOperationCount = signal(0);
  readonly highlightAttach = signal(false);
  readonly editingTheme = signal(false);
  readonly thinkingText = signal(THINKING_MESSAGES[0]);
  draftValue = '';

  readonly presets = TEMA_PRESETS;
  readonly headingFonts = HEADING_FONTS;
  readonly bodyFonts = BODY_FONTS;
  readonly catalogo = CATALOGO_SECCIONES;
  readonly openPages = signal<Set<number>>(new Set([0]));
  readonly showCatalog = signal(false);
  readonly visibleBlueprint = computed(() => this.editingExisting ? null : this.blueprint());

  readonly headerTitle = computed(() => {
    const type = this.resolvedType();
    if (this.editingExisting) return 'Mejoremos tu sitio actual';
    return type === 'ecommerce' ? 'Creemos tu tienda en línea'
      : type === 'landing' ? 'Creemos tu landing page'
      : 'Creemos tu sitio web';
  });
  readonly lastSuggestions = computed(() => {
    const list = this.messages();
    const last = list[list.length - 1];
    return last?.role === 'assistant' && !last.error ? (last.suggestions ?? []) : [];
  });
  readonly nearLimit = computed(() => !this.editingExisting && !this.blueprint() && this.messages().length >= 22);

  /** Clave semantica estable -> formularioId real, persistida entre aperturas del chat. */
  private readonly createdForms = new Map<string, string>(Object.entries(this.data.formBindings ?? {}));
  /** En modo mejora, cerrar sin cambios no debe pedir confirmacion. */
  private readonly initialBlueprint = this.data.blueprint ?? null;
  private thinkingTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void { this.stopThinking(); }

  private welcomeMessage(): ChatMsg {
    if (this.data.currentContent) {
      return {
        role: 'assistant',
        content: 'Estoy trabajando sobre el diseño que tienes ahora, incluidos tus cambios manuales. Pídeme un ajuste concreto y conservaré todo lo que no menciones.',
        suggestions: ['Alterna fondos anaranjados y blancos', 'Mejora solo los textos de la portada', 'Agrega una sección de equipo', 'Haz más visible el botón principal'],
      };
    }
    if (this.data.blueprint) {
      return {
        role: 'assistant',
        content: 'Este es el diseño actual de tu sitio. Pídeme los cambios que quieras y regeneraré el diseño manteniendo lo demás.',
        suggestions: ['Hazlo más oscuro', 'Agrega una sección de equipo', 'Mejora los textos de la portada', 'Agrega una cuenta regresiva'],
      };
    }
    if (this.data.type === 'ecommerce') {
      return {
        role: 'assistant',
        content: '¡Hola! Voy a diseñar tu tienda en línea. Cuéntame, ¿cómo se llama tu negocio y qué vendes?',
        suggestions: ['Vendo ropa y accesorios', 'Tengo una tienda de tecnología', 'Vendo productos artesanales'],
      };
    }
    if (this.data.type === 'landing') {
      return {
        role: 'assistant',
        content: '¡Hola! Voy a diseñar tu landing page. Cuéntame, ¿cómo se llama tu negocio y qué ofreces?',
        suggestions: ['Tengo una cafetería', 'Ofrezco servicios profesionales', 'Soy fotógrafo'],
      };
    }
    return {
      role: 'assistant',
      content: '¡Hola! Voy a diseñar tu sitio web. Cuéntame, ¿qué negocio tienes y qué quieres lograr: vender en línea o conseguir más clientes?',
      suggestions: ['Quiero vender mis productos en línea', 'Quiero una página para captar clientes', 'Tengo un restaurante', 'Ofrezco planes de internet'],
    };
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  async send(text?: string): Promise<void> {
    const content = (text ?? this.draftValue).trim();
    if (!content || this.isSending()) return;
    this.draftValue = '';
    this.messages.update(list => [...list, { role: 'user', content }]);
    this.scrollToBottom();
    await this.request();
  }

  private async request(): Promise<void> {
    this.isSending.set(true);
    this.startThinking();
    try {
      const response = await firstValueFrom(this.generator.chat({
        type: this.resolvedType(),
        messages: this.payloadMessages(),
        imageUrls: this.imageUrls(),
        blueprint: this.editingExisting ? null : this.blueprint(),
        currentContent: this.editingExisting ? this.previewContent() : null,
      }));
      if (response.siteType) this.resolvedType.set(response.siteType);
      if (response.mode === 'generate' && response.blueprint) this.blueprint.set(response.blueprint);
      if (response.mode === 'edit') {
        const current = this.previewContent();
        if (!current) throw new Error('No se encontró el contenido actual del sitio.');
        this.previewContent.set(this.editApplier.apply(current, response.operations));
        this.pendingOperationCount.update(count => count + response.operations.length);
        this.pendingEdits.set(true);
      }
      if (response.requestImages) this.highlightAttach.set(true);
      this.messages.update(list => [...list, {
        role: 'assistant',
        content: response.message || 'Listo. ¿Continuamos?',
        suggestions: response.suggestions,
      }]);
    } catch (error: any) {
      this.messages.update(list => [...list, {
        role: 'assistant',
        error: true,
        content: error?.error?.error || error?.message || 'No pude procesar tu mensaje. Intenta nuevamente.',
      }]);
    } finally {
      this.stopThinking();
      this.isSending.set(false);
      this.scrollToBottom();
    }
  }

  /**
   * El refinamiento del documento conserva una ventana corta para entender frases
   * como "ahora hazlo mas grande"; el contenido ya incorpora los cambios anteriores.
   */
  private payloadMessages(): AiSiteChatMessage[] {
    const clean = this.messages()
      .filter(msg => !msg.error)
      .map(({ role, content }) => ({ role, content }));
    if (this.editingExisting) return clean.slice(-12);
    if (this.blueprint()) {
      const lastUser = [...clean].reverse().find(msg => msg.role === 'user');
      return lastUser ? [lastUser] : clean.slice(-1);
    }
    return clean.slice(-30);
  }

  patchTheme(partial: Partial<AiSiteBlueprint['theme']>): void {
    this.blueprint.update(bp => bp ? { ...bp, theme: { ...bp.theme, ...partial } } : bp);
  }

  seccionNombre(type: string): string {
    return SECCIONES_INFO[type]?.nombre ?? type;
  }

  seccionIcono(type: string): string {
    return SECCIONES_INFO[type]?.icono ?? 'widgets';
  }

  togglePage(pageIndex: number): void {
    this.openPages.update(open => {
      const next = new Set(open);
      if (next.has(pageIndex)) next.delete(pageIndex); else next.add(pageIndex);
      return next;
    });
  }

  /** Reordena bloques localmente: el orden editado viaja con refinamientos y con "Usar este diseño". */
  moveSection(pageIndex: number, sectionIndex: number, delta: number): void {
    this.blueprint.update(bp => {
      if (!bp) return bp;
      const target = sectionIndex + delta;
      const sections = bp.pages[pageIndex]?.sections;
      if (!sections || target < 0 || target >= sections.length) return bp;
      const pages = bp.pages.map((page, index) => index === pageIndex
        ? { ...page, sections: page.sections.slice() }
        : page);
      const moved = pages[pageIndex].sections;
      [moved[sectionIndex], moved[target]] = [moved[target], moved[sectionIndex]];
      return { ...bp, pages };
    });
  }

  requestBlock(nombre: string): void {
    if (this.isSending()) return;
    this.showCatalog.set(false);
    void this.send(`Agrega una sección de ${nombre.toLowerCase()} al sitio.`);
  }

  applyPreset(preset: TemaPreset): void {
    this.patchTheme({
      primary: preset.tema.colorPrimario,
      accent: preset.tema.colorAcento,
      background: preset.tema.colorFondo,
      text: preset.tema.colorTexto,
      // El contrato del blueprint no admite 'system'.
      headingFont: preset.tema.fuenteTitulos === 'system' ? 'poppins' : preset.tema.fuenteTitulos,
      bodyFont: preset.tema.fuenteCuerpo === 'system' ? 'inter' : preset.tema.fuenteCuerpo,
      cornerStyle: preset.tema.radioEsquinas,
    });
  }

  async addImage(): Promise<void> {
    if (this.imageUrls().length >= 12) return;
    const ref = this.dialog.open<ArchivoSelectorDialogComponent, unknown, ArchivoSelectorDialogResult | null>(ArchivoSelectorDialogComponent, {
      injector: this.injector,
      data: {
        title: 'Imágenes para tu nuevo sitio',
        subtitle: 'Elige una imagen real de tu empresa o sube una nueva.',
        sourceModule: 'sitio_web',
        storageTarget: 'sites',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
      },
      maxWidth: '95vw',
      autoFocus: false,
    });
    const result = await firstValueFrom(ref.afterClosed());
    const url = result?.archivo?.downloadUrl;
    if (!url || this.imageUrls().includes(url)) return;
    this.imageUrls.update(urls => [...urls, url]);
    this.highlightAttach.set(false);
    // Mensaje local: viaja con el siguiente turno para que la IA sepa que ya hay imagenes.
    this.messages.update(list => [...list, {
      role: 'user',
      content: `He adjuntado una imagen (${this.imageUrls().length} en total).`,
    }]);
    this.scrollToBottom();
  }

  removeImage(index: number): void {
    this.imageUrls.update(urls => urls.filter((_, i) => i !== index));
  }

  async applyDesign(): Promise<void> {
    const blueprint = this.blueprint();
    const tipo = this.resolvedType();
    if (this.isApplying()) return;
    if (!tipo) {
      this.pushError('No pude determinar si tu sitio es tienda o landing. Dímelo en el chat y vuelve a intentar.');
      return;
    }
    if (this.editingExisting) {
      const contenido = this.previewContent();
      if (!contenido || !this.pendingEdits()) return;
      this.dialogRef.close({
        contenido,
        tipo,
        source: 'edit',
        blueprint,
        imageUrls: this.imageUrls(),
        formBindings: Object.fromEntries(this.createdForms),
      });
      return;
    }
    if (!blueprint) return;
    this.isApplying.set(true);
    try {
      const formIds = await this.materializeForms(blueprint);
      const contenido = this.compiler.compile(blueprint, this.imageUrls(), tipo === 'ecommerce', formIds);
      this.dialogRef.close({
        contenido,
        tipo,
        source: 'generation',
        blueprint,
        imageUrls: this.imageUrls(),
        formBindings: Object.fromEntries(this.createdForms),
      });
    } catch (error: any) {
      this.pushError(error?.message || 'No pude aplicar el diseño. Pídeme que lo regenere.');
    } finally {
      this.isApplying.set(false);
    }
  }

  /**
   * "Tool" de la IA: crea de verdad los formularios que diseño la conversacion
   * (sitios_formularios/{tenant}) para que aparezcan en la pantalla Formularios.
   * La vinculacion semantica se persiste con el estado IA. Reordenar secciones o
   * volver a abrir el chat reutiliza y actualiza el mismo formulario.
   */
  private async materializeForms(blueprint: AiSiteBlueprint): Promise<Map<string, string>> {
    const pages = Array.isArray(blueprint.pages) ? blueprint.pages.slice(0, 5) : [];
    const existing = await this.formularios.getFormulariosUnaVez();
    const compilerBindings = new Map<string, string>();
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageId = pageIndex === 0 ? 'home' : (slugify(page.slug || page.title) || `pagina-${pageIndex + 1}`);
      const sections = Array.isArray(page.sections) ? page.sections.slice(0, 12) : [];
      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        if (section?.type !== 'contact' || !section.form?.fields?.length) continue;
        const key = this.formBindingKey(pageId, section.form);
        const boundId = this.createdForms.get(key);
        const previous = boundId ? existing[boundId] : undefined;
        const def = this.buildFormDef(section.form, previous);
        await this.formularios.guardar(def);
        this.createdForms.set(key, def.formularioId);
        compilerBindings.set(`${pageId}:${index}`, def.formularioId);
      }
    }
    return compilerBindings;
  }

  private formBindingKey(pageId: string, form: AiSiteBlueprintForm): string {
    return `${pageId}:form:${slugify(form.name).slice(0, 50) || 'contacto'}`;
  }

  private buildFormDef(form: AiSiteBlueprintForm, previous?: FormularioDef): FormularioDef {
    const ahora = Date.now();
    const usados = new Set<string>();
    const campos: CampoFormulario[] = form.fields.slice(0, 20).map((field, index) => {
      let id = slugify(field.label)?.slice(0, 40) || `campo-${index + 1}`;
      while (usados.has(id)) id = `${id}-${index + 1}`;
      usados.add(id);
      const etiqueta = field.label.slice(0, 200);
      const requerido = field.required === true;
      if (field.type === 'seleccion') {
        return {
          id, tipo: 'seleccion', etiqueta, requerido,
          opciones: (field.options ?? []).filter(o => typeof o === 'string' && o.trim()).slice(0, 30).map(o => o.slice(0, 200)),
        };
      }
      const tipo = (['texto', 'email', 'telefono', 'textarea'] as const).includes(field.type as never)
        ? field.type as 'texto' | 'email' | 'telefono' | 'textarea'
        : 'texto';
      return { id, tipo, etiqueta, requerido };
    });
    return {
      formularioId: previous?.formularioId ?? `f-${ahora.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: form.name.slice(0, 80) || 'Formulario del sitio',
      campos,
      mensajeExito: form.successMessage?.slice(0, 1000) || 'Gracias, te contactaremos pronto.',
      creadoEn: previous?.creadoEn ?? ahora,
      actualizadoEn: ahora,
    };
  }

  private pushError(message: string): void {
    this.messages.update(list => [...list, { role: 'assistant', error: true, content: message }]);
    this.scrollToBottom();
  }

  tryClose(): void {
    const cambiado = this.pendingEdits()
      || (this.blueprint() && this.blueprint() !== this.initialBlueprint);
    if (cambiado && !window.confirm('Perderás los cambios del diseño. ¿Cerrar de todos modos?')) return;
    this.dialogRef.close();
  }

  private startThinking(): void {
    let index = 0;
    this.thinkingText.set(THINKING_MESSAGES[0]);
    this.stopThinking();
    this.thinkingTimer = setInterval(() => {
      index = (index + 1) % THINKING_MESSAGES.length;
      this.thinkingText.set(THINKING_MESSAGES[index]);
    }, 2600);
  }

  private stopThinking(): void {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}

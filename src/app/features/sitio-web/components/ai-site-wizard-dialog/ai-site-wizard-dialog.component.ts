import { ChangeDetectionStrategy, Component, Injector, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { ContenidoSitio, TipoSitio } from '@winsuite/bloques';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult,
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { AiSiteBlueprintCompilerService } from '../../services/ai-site-blueprint-compiler.service';
import { AiSiteBrief, AiSiteGeneratorService } from '../../services/ai-site-generator.service';

interface WizardData { type: TipoSitio }

@Component({
  selector: 'app-ai-site-wizard-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="wizard">
      <header>
        <div class="robot" [class.pensando]="generating()" aria-hidden="true">
          <span class="antena"></span><mat-icon>smart_toy</mat-icon><span class="brillo"></span>
        </div>
        <div>
          <span class="eyebrow">Diseñador IA de WinSuite</span>
          <h2>{{ generating() ? 'Estoy diseñando tu sitio…' : question() }}</h2>
          <p>{{ helper() }}</p>
        </div>
        <button mat-icon-button mat-dialog-close aria-label="Cerrar"><mat-icon>close</mat-icon></button>
      </header>

      @if (generating()) {
        <section class="loading">
          <mat-spinner diameter="44"></mat-spinner>
          <b>Creando estructura, textos, colores y secciones</b>
          <span>Después podrás cambiar cada detalle en el editor.</span>
        </section>
      } @else {
        <main>
          @switch (step()) {
            @case (0) {
              <label>Nombre del negocio<input [(ngModel)]="brief.businessName" maxlength="100" placeholder="Ej. Café del Valle" /></label>
              <label>¿Qué ofrece?<textarea [(ngModel)]="brief.description" maxlength="2000" rows="4" placeholder="Productos, servicios, propuesta de valor y ciudad…"></textarea></label>
            }
            @case (1) {
              <div class="choices">
                @for (option of objectives; track option.value) {
                  <button type="button" [class.selected]="brief.objective === option.value" (click)="brief.objective = option.value">
                    <mat-icon>{{ option.icon }}</mat-icon><b>{{ option.label }}</b><span>{{ option.help }}</span>
                  </button>
                }
              </div>
              <label>¿A quién quieres llegar?<input [(ngModel)]="brief.audience" maxlength="300" placeholder="Ej. familias jóvenes de Quito" /></label>
            }
            @case (2) {
              <div class="choices compact">
                @for (style of styles; track style.value) {
                  <button type="button" [class.selected]="brief.visualStyle === style.value" (click)="brief.visualStyle = style.value">
                    <span class="swatch" [style.background]="style.color"></span><b>{{ style.label }}</b>
                  </button>
                }
              </div>
              <label>Tono de los textos
                <select [(ngModel)]="brief.tone"><option>Cercano y claro</option><option>Profesional</option><option>Elegante</option><option>Dinámico y juvenil</option><option>Directo y comercial</option></select>
              </label>
            }
            @case (3) {
              <div class="suggestion"><mat-icon>auto_awesome</mat-icon><span>Según tu objetivo te recomiendo: <b>{{ suggestedFeatures() }}</b></span></div>
              <div class="checks">
                @for (feature of availableFeatures(); track feature) {
                  <label><input type="checkbox" [checked]="brief.features.includes(feature)" (change)="toggle(feature, brief.features)" />{{ feature }}</label>
                }
              </div>
              <h3>Páginas</h3>
              <div class="checks">
                @for (page of availablePages; track page) {
                  <label><input type="checkbox" [checked]="brief.pages.includes(page)" (change)="toggle(page, brief.pages)" />{{ page }}</label>
                }
              </div>
            }
            @case (4) {
              <div class="image-actions">
                <button mat-stroked-button type="button" (click)="addImage()"><mat-icon>photo_library</mat-icon>Elegir de Mis archivos</button>
                <span>{{ brief.imageUrls.length }}/12 imágenes</span>
              </div>
              @if (brief.imageUrls.length) {
                <div class="images">@for (url of brief.imageUrls; track url; let i = $index) {<div><img [src]="url" alt="Imagen seleccionada" /><button mat-icon-button (click)="removeImage(i)"><mat-icon>close</mat-icon></button></div>}</div>
              } @else {
                <div class="empty"><mat-icon>collections</mat-icon><b>Puedes continuar sin imágenes</b><span>También podrás agregarlas después desde el editor.</span></div>
              }
            }
            @case (5) {
              <div class="summary">
                <div><span>Negocio</span><b>{{ brief.businessName }}</b></div><div><span>Objetivo</span><b>{{ brief.objective }}</b></div>
                <div><span>Estilo</span><b>{{ brief.visualStyle }}</b></div><div><span>Formato</span><b>{{ data.type === 'ecommerce' ? 'Ecommerce' : 'Landing page' }}</b></div>
              </div>
              <label>Últimos detalles (opcional)<textarea [(ngModel)]="brief.notes" maxlength="1000" rows="4" placeholder="Promoción destacada, ubicación, llamada a la acción, información que no debe faltar…"></textarea></label>
              @if (error()) { <div class="error"><mat-icon>error_outline</mat-icon>{{ error() }}</div> }
            }
          }
        </main>
        <footer>
          <button mat-button type="button" [disabled]="step() === 0" (click)="back()">Atrás</button>
          <span>{{ step() + 1 }} de 6</span>
          @if (step() < 5) { <button mat-flat-button color="primary" [disabled]="!validStep()" (click)="next()">Continuar</button> }
          @else { <button mat-flat-button color="primary" (click)="generate()"><mat-icon>auto_awesome</mat-icon>Armar mi sitio</button> }
        </footer>
      }
    </div>
  `,
  styles: `
    .wizard{width:min(760px,90vw);color:var(--tc-on-surface);background:var(--tc-surface-container-lowest)}
    header{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:24px 26px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 16%,transparent),color-mix(in srgb,#8b5cf6 13%,transparent));border-bottom:1px solid var(--tc-ghost-border)}
    h2{margin:2px 0 4px;font-size:1.35rem} header p{margin:0;opacity:.72}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--primary)}
    .robot{position:relative;width:68px;height:68px;display:grid;place-items:center;border-radius:24px;background:linear-gradient(145deg,var(--primary),#7c3aed);box-shadow:0 12px 28px color-mix(in srgb,var(--primary) 28%,transparent);animation:float 3s ease-in-out infinite}.robot mat-icon{font-size:42px;width:42px;height:42px;color:white}.antena{position:absolute;top:-10px;width:4px;height:13px;background:var(--primary);border-radius:4px}.antena:after{content:'';position:absolute;width:8px;height:8px;border-radius:50%;background:#f59e0b;left:-2px;top:-4px}.brillo{position:absolute;width:9px;height:9px;background:#fff;border-radius:50%;right:9px;top:10px;opacity:.75}.pensando{animation:think .8s ease-in-out infinite alternate}
    main{min-height:330px;padding:26px;display:grid;gap:20px}label{display:grid;gap:7px;font-weight:650}input,textarea,select{font:inherit;color:inherit;background:var(--tc-surface-container-lowest);border:1px solid var(--tc-ghost-border);border-radius:10px;padding:11px 13px;resize:vertical}input:focus,textarea:focus,select:focus{outline:2px solid color-mix(in srgb,var(--primary) 35%,transparent);border-color:var(--primary)}
    .choices{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.choices button{min-height:116px;padding:15px;text-align:left;display:grid;gap:6px;border:1px solid var(--tc-ghost-border);border-radius:14px;background:var(--tc-surface-container-lowest);color:inherit;cursor:pointer}.choices button mat-icon{color:var(--primary)}.choices button span{font-size:.82rem;opacity:.7}.choices button.selected{border:2px solid var(--primary);background:var(--tc-primary-container)}.choices.compact button{min-height:80px}.swatch{width:34px;height:12px;border-radius:999px;opacity:1!important}
    .suggestion,.error{display:flex;gap:9px;align-items:center;padding:12px;border-radius:10px;background:var(--tc-primary-container)}.suggestion mat-icon{color:var(--primary)}.checks{display:flex;flex-wrap:wrap;gap:9px}.checks label{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid var(--tc-ghost-border);border-radius:999px;font-weight:500}.checks input{accent-color:var(--primary)}h3{margin:5px 0 0}
    .image-actions{display:flex;justify-content:space-between;align-items:center}.images{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.images div{height:105px;position:relative}.images img{width:100%;height:100%;object-fit:cover;border-radius:12px}.images button{position:absolute;right:2px;top:2px;background:#fff}.empty{min-height:210px;border:2px dashed var(--tc-ghost-border);border-radius:14px;display:grid;place-content:center;justify-items:center;gap:8px;opacity:.7}.empty mat-icon{font-size:45px;width:45px;height:45px}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px}.summary div{display:grid;padding:13px;border-radius:10px;background:var(--tc-surface-container-low)}.summary span{font-size:.75rem;opacity:.65}.error{background:color-mix(in srgb,var(--tc-error) 12%,transparent);color:var(--tc-error)}
    footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:16px 26px;border-top:1px solid var(--tc-ghost-border)}footer>span{text-align:center;font-size:.82rem;opacity:.6}footer button:last-child{justify-self:end}.loading{min-height:390px;display:grid;place-content:center;justify-items:center;gap:14px;text-align:center}.loading span{opacity:.65}
    @keyframes float{50%{transform:translateY(-5px)}}@keyframes think{to{transform:rotate(4deg) scale(1.04)}}
    @media(max-width:650px){header{padding:18px}.robot{width:54px;height:54px;border-radius:18px}.robot mat-icon{font-size:34px;width:34px;height:34px}.choices{grid-template-columns:1fr 1fr}.images{grid-template-columns:repeat(3,1fr)}main{padding:18px}.summary{grid-template-columns:1fr}}
  `,
})
export class AiSiteWizardDialogComponent {
  readonly data = inject<WizardData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AiSiteWizardDialogComponent, ContenidoSitio>);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly generator = inject(AiSiteGeneratorService);
  private readonly compiler = inject(AiSiteBlueprintCompilerService);
  readonly step = signal(0);
  readonly generating = signal(false);
  readonly error = signal('');
  readonly brief: AiSiteBrief = { type: this.data.type, businessName: '', description: '', objective: '', audience: '', visualStyle: 'Moderno', tone: 'Cercano y claro', features: [], pages: ['Inicio'], imageUrls: [], notes: '' };
  readonly objectives = [
    { value: 'Vender productos', label: 'Vender', icon: 'shopping_bag', help: 'Productos, carrito y pagos' },
    { value: 'Captar prospectos', label: 'Conseguir clientes', icon: 'person_add', help: 'Beneficios y formulario' },
    { value: 'Agendar citas', label: 'Recibir reservas', icon: 'event_available', help: 'Servicios y contacto' },
    { value: 'Presentar servicios', label: 'Mostrar servicios', icon: 'design_services', help: 'Propuesta y planes' },
    { value: 'Mostrar portafolio', label: 'Exhibir trabajos', icon: 'photo_library', help: 'Galería y resultados' },
  ];
  readonly styles = [{ value: 'Moderno', label: 'Moderno', color: 'linear-gradient(90deg,#2563eb,#8b5cf6)' }, { value: 'Elegante', label: 'Elegante', color: 'linear-gradient(90deg,#111827,#d4af37)' }, { value: 'Minimalista', label: 'Minimalista', color: 'linear-gradient(90deg,#e5e7eb,#64748b)' }, { value: 'Vibrante', label: 'Vibrante', color: 'linear-gradient(90deg,#ec4899,#f59e0b)' }, { value: 'Natural', label: 'Natural', color: 'linear-gradient(90deg,#166534,#84cc16)' }, { value: 'Oscuro', label: 'Oscuro', color: 'linear-gradient(90deg,#020617,#334155)' }];
  readonly availablePages = ['Inicio', 'Nosotros', 'Servicios', 'Productos', 'Galería', 'Preguntas frecuentes', 'Contacto'];

  question(): string { return ['Cuéntame sobre tu negocio', '¿Qué debe lograr el sitio?', '¿Cómo quieres que se vea?', '¿Qué contenido necesita?', 'Elijamos tus imágenes', 'Revisemos antes de crear'][this.step()]; }
  helper(): string { return ['Con esta información escribiré una propuesta auténtica.', 'Adaptaré la estructura para guiar al visitante a esa acción.', 'Generaré una paleta accesible, tipografías y acabados coherentes.', 'Puedes elegir varias opciones; luego todo seguirá siendo editable.', 'Selecciona imágenes reales desde el archivo reutilizable de tu empresa.', 'La IA creará un primer borrador completo, no lo publicará.'][this.step()]; }
  suggestedFeatures(): string { return this.brief.objective.includes('Vender') ? 'productos, pagos y preguntas frecuentes' : this.brief.objective.includes('Agendar') ? 'servicios, formulario y mapa' : this.brief.objective.includes('portafolio') ? 'galería, testimonios y contacto' : 'beneficios, testimonios y formulario'; }
  availableFeatures(): string[] { return this.data.type === 'ecommerce' ? ['Productos del inventario', 'Carrito', 'Formas de pago', 'Promociones', 'Testimonios', 'Preguntas frecuentes', 'WhatsApp', 'Mapa'] : ['Beneficios', 'Formulario de contacto', 'Planes y precios', 'Galería', 'Testimonios', 'Estadísticas', 'Equipo', 'Preguntas frecuentes', 'WhatsApp', 'Mapa']; }
  toggle(value: string, list: string[]): void { const i = list.indexOf(value); i >= 0 ? list.splice(i, 1) : list.push(value); }
  validStep(): boolean { if (this.step() === 0) return this.brief.businessName.trim().length >= 2 && this.brief.description.trim().length >= 10; if (this.step() === 1) return !!this.brief.objective && this.brief.audience.trim().length >= 3; return true; }
  next(): void { if (this.validStep()) this.step.update(x => Math.min(5, x + 1)); }
  back(): void { this.step.update(x => Math.max(0, x - 1)); }
  removeImage(index: number): void { this.brief.imageUrls.splice(index, 1); }

  async addImage(): Promise<void> {
    if (this.brief.imageUrls.length >= 12) return;
    const ref = this.dialog.open<ArchivoSelectorDialogComponent, unknown, ArchivoSelectorDialogResult | null>(ArchivoSelectorDialogComponent, { injector: this.injector, data: { title: 'Imágenes para tu nuevo sitio', subtitle: 'Elige una imagen real de tu empresa o sube una nueva.', sourceModule: 'sitio_web', storageTarget: 'sites', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }, maxWidth: '95vw', autoFocus: false });
    const result = await firstValueFrom(ref.afterClosed());
    const url = result?.archivo?.downloadUrl;
    if (url && !this.brief.imageUrls.includes(url)) this.brief.imageUrls.push(url);
  }

  async generate(): Promise<void> {
    this.generating.set(true); this.error.set('');
    try {
      const blueprint = await firstValueFrom(this.generator.generate(this.brief));
      this.dialogRef.close(this.compiler.compile(blueprint, this.brief.imageUrls, this.data.type === 'ecommerce'));
    } catch (error: any) {
      this.error.set(error?.error?.error || error?.message || 'No se pudo crear el diseño. Intenta nuevamente.');
      this.generating.set(false);
    }
  }
}

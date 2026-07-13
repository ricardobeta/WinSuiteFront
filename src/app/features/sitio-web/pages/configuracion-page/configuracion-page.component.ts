import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { SUBDOMINIO_REGEX, SitioConfig } from '@winsuite/bloques';
import { SitiosService } from '../../services/sitios.service';
import { SitioConfigService } from '../../services/sitio-config.service';
import { DominioCustomService } from '../../services/dominio-custom.service';
import { SelectorImagenComponent } from '../../components/selector-imagen/selector-imagen.component';
import { DialogoSitioComponent } from '../../components/dialogo-sitio/dialogo-sitio.component';

@Component({
  selector: 'app-configuracion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatIconModule, SelectorImagenComponent],
  template: `
    @if (config(); as c) {
      <div class="pagina">
        <h2>Configuracion del sitio</h2>

        <section>
          <h3>General</h3>
          <label>Nombre del sitio<input [(ngModel)]="nombre" maxlength="80" /></label>
          <label class="check">
            <input type="checkbox" [(ngModel)]="activo" />
            Sitio activo (si lo desactivas, deja de servirse al publico)
          </label>
        </section>

        <section>
          <h3>Direccion</h3>
          <label>
            Subdominio
            <div class="linea">
              <input [(ngModel)]="subdominio" maxlength="31" />
              <span class="sufijo">.winsuit.app</span>
            </div>
          </label>

          <h4>Dominio propio</h4>
          @if (c.dominioCustom; as dominio) {
            <div class="dominio-registrado">
              <div>
                <strong>{{ dominio.dominio }}</strong>
                <span class="badge" [class.ok]="dominio.verificado">
                  {{ dominio.verificado ? 'Verificado' : 'Pendiente de verificacion' }}
                </span>
              </div>
              @if (!dominio.verificado) {
                <div class="instrucciones">
                  <p>Configura estos registros en el DNS de tu dominio:</p>
                  <code
                    >TXT _winsuite-verify.{{ dominio.dominio }} =
                    {{ dominio.tokenVerificacion }}</code
                  >
                  <code>CNAME {{ dominio.dominio }} → sites.winsuit.app</code>
                  <p class="nota">
                    La verificacion automatica y el certificado se activaran proximamente; tu
                    registro ya queda reservado.
                  </p>
                </div>
              }
              <button mat-stroked-button (click)="quitarDominio(dominio.dominio)">
                <mat-icon>delete</mat-icon> Quitar dominio
              </button>
            </div>
          } @else {
            <div class="linea">
              <input [(ngModel)]="dominioNuevo" placeholder="mitienda.com" />
              <button
                mat-stroked-button
                (click)="registrarDominio()"
                [disabled]="!dominioNuevo.trim()"
              >
                Registrar
              </button>
            </div>
            <p class="nota">
              Si no tienes dominio propio, tu sitio funciona con el subdominio de winsuite.
            </p>
          }
        </section>

        <section>
          <h3>SEO</h3>
          <label>Titulo (title)<input [(ngModel)]="seoTitle" maxlength="200" /></label>
          <label>
            Descripcion (meta description)
            <textarea rows="3" [(ngModel)]="seoDescription" maxlength="300"></textarea>
          </label>
          <div class="campo">
            <span>Imagen para compartir (Open Graph)</span>
            <app-selector-imagen
              [url]="seoOgImage() || undefined"
              (urlChange)="seoOgImage.set($event)"
            />
          </div>
        </section>

        <section>
          <h3>Seguimiento</h3>
          <label
            >Pixel de Facebook (solo el ID numerico)<input
              [(ngModel)]="facebookPixelId"
              maxlength="30"
          /></label>
          <label
            >Google Analytics (G-XXXXXXX)<input [(ngModel)]="gaMeasurementId" maxlength="30"
          /></label>
        </section>

        <section>
          <h3>WhatsApp</h3>
          <label
            >Numero (con codigo de pais, ej. +593...)<input
              [(ngModel)]="whatsappNumero"
              maxlength="20"
          /></label>
          <label>
            Mensaje inicial del pedido
            <textarea rows="2" [(ngModel)]="whatsappMensaje" maxlength="1000"></textarea>
          </label>
          @if (c.tipo === 'ecommerce') {
            <label>
              Como reciben los pedidos tus clientes
              <select [(ngModel)]="checkoutModo">
                <option value="whatsapp">Solo WhatsApp</option>
                <option value="formulario">Solo formulario</option>
                <option value="ambos">WhatsApp y formulario</option>
              </select>
            </label>
          }
        </section>

        <div class="acciones">
          <button mat-flat-button color="primary" (click)="guardar()" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 680px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    h2 {
      margin: 0;
    }
    section {
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      border: 1px solid var(--tc-ghost-border);
      border-radius: 12px;
      padding: 18px;
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h3 {
      margin: 0;
      font-size: 1rem;
    }
    h4 {
      margin: 8px 0 0;
      font-size: 0.9rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      font-weight: 400;
    }
    input:not([type='checkbox']),
    select,
    textarea {
      font: inherit;
      font-weight: 400;
      padding: 9px 10px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .linea {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .linea input {
      flex: 1;
    }
    .sufijo {
      font-family: monospace;
      opacity: 0.7;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    .nota {
      margin: 0;
      font-size: 0.82rem;
      opacity: 0.65;
      font-weight: 400;
    }
    .dominio-registrado {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    .badge {
      margin-left: 10px;
      font-size: 0.75rem;
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--tc-warning-container);
      color: var(--tc-on-warning-container);
    }
    .badge.ok {
      background: var(--tc-success-container);
      color: var(--tc-on-success-container);
    }
    .instrucciones {
      background: var(--tc-surface-container-low);
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    .instrucciones p {
      margin: 0;
      font-size: 0.85rem;
    }
    code {
      display: block;
      font-size: 0.8rem;
      background: #111827;
      color: #d1d5db;
      padding: 6px 10px;
      border-radius: 6px;
      overflow-x: auto;
    }
    .acciones {
      display: flex;
      justify-content: flex-end;
      padding: 16px 0 32px;
    }
  `,
})
export class ConfiguracionPageComponent {
  private readonly sitiosService = inject(SitiosService);
  private readonly configService = inject(SitioConfigService);
  private readonly dominioService = inject(DominioCustomService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly sitioId = input.required<string>();

  readonly config = signal<SitioConfig | null>(null);
  readonly guardando = signal(false);
  readonly seoOgImage = signal('');

  // Campos de formulario (se hidratan al cargar la config).
  nombre = '';
  activo = true;
  subdominio = '';
  dominioNuevo = '';
  seoTitle = '';
  seoDescription = '';
  facebookPixelId = '';
  gaMeasurementId = '';
  whatsappNumero = '';
  whatsappMensaje = '';
  checkoutModo: 'whatsapp' | 'formulario' | 'ambos' = 'whatsapp';

  readonly esEcommerce = computed(() => this.config()?.tipo === 'ecommerce');

  constructor() {
    effect(() => {
      const sitioId = this.sitioId();
      void this.cargar(sitioId);
    });
  }

  private async cargar(sitioId: string): Promise<void> {
    const config = await this.sitiosService.getConfig(sitioId);
    this.config.set(config);
    if (!config) return;
    this.nombre = config.nombre;
    this.activo = config.activo;
    this.subdominio = config.subdominio;
    this.seoTitle = config.seo.title;
    this.seoDescription = config.seo.description;
    this.seoOgImage.set(config.seo.ogImageUrl ?? '');
    this.facebookPixelId = config.tracking.facebookPixelId ?? '';
    this.gaMeasurementId = config.tracking.gaMeasurementId ?? '';
    this.whatsappNumero = config.whatsapp.numero;
    this.whatsappMensaje = config.whatsapp.mensajePlantilla;
    this.checkoutModo = config.checkout?.modo ?? 'whatsapp';
  }

  async guardar(): Promise<void> {
    const config = this.config();
    if (!config || this.guardando()) return;
    this.guardando.set(true);
    try {
      // El cambio de subdominio pasa por el reclamo transaccional del indice global.
      const subdominioLimpio = this.subdominio.toLowerCase().trim();
      if (subdominioLimpio !== config.subdominio) {
        if (!SUBDOMINIO_REGEX.test(subdominioLimpio)) {
          throw new Error(
            'Subdominio no valido: solo minusculas, numeros y guiones (3-31 caracteres).',
          );
        }
        await this.configService.cambiarSubdominio(config, subdominioLimpio);
      }

      await this.configService.guardar(config.sitioId, {
        nombre: this.nombre.trim(),
        activo: this.activo,
        seo: {
          title: this.seoTitle.trim(),
          description: this.seoDescription.trim(),
          ...(this.seoOgImage() ? { ogImageUrl: this.seoOgImage() } : {}),
        },
        tracking: {
          ...(this.facebookPixelId.trim() ? { facebookPixelId: this.facebookPixelId.trim() } : {}),
          ...(this.gaMeasurementId.trim() ? { gaMeasurementId: this.gaMeasurementId.trim() } : {}),
        },
        whatsapp: { numero: this.whatsappNumero.trim(), mensajePlantilla: this.whatsappMensaje },
        ...(config.tipo === 'ecommerce' ? { checkout: { modo: this.checkoutModo } } : {}),
      });
      await this.cargar(config.sitioId);
      this.snackBar.open('Configuracion guardada', 'OK', { duration: 3000 });
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo guardar', 'OK', {
        duration: 5000,
      });
    } finally {
      this.guardando.set(false);
    }
  }

  async registrarDominio(): Promise<void> {
    const config = this.config();
    if (!config) return;
    try {
      await this.dominioService.registrar(config.sitioId, this.dominioNuevo);
      this.dominioNuevo = '';
      await this.cargar(config.sitioId);
      this.snackBar.open('Dominio registrado. Configura los registros DNS indicados.', 'OK', {
        duration: 6000,
      });
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo registrar el dominio', 'OK', {
        duration: 5000,
      });
    }
  }

  async quitarDominio(dominio: string): Promise<void> {
    const config = this.config();
    if (!config) return;
    const confirmado = await firstValueFrom(this.dialog.open(DialogoSitioComponent, {
      data: { titulo: 'Quitar dominio', mensaje: `¿Quitar el dominio ${dominio} de este sitio?`, confirmar: 'Quitar', peligro: true },
      width: '480px',
    }).afterClosed());
    if (!confirmado) return;
    await this.dominioService.quitar(config.sitioId, dominio);
    await this.cargar(config.sitioId);
    this.snackBar.open('Dominio eliminado', 'OK', { duration: 3000 });
  }
}

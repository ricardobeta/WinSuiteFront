import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { WhatsAppInstance } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

interface LinkSession {
  instanceId: string;
  loginUrl: string;
  expiresAt: number;
  appId: string;
  configId: string;
  state: string;
  graphApiVersion: string;
}

interface FacebookSdk {
  init(config: { appId: string; version: string; xfbml?: boolean; cookie?: boolean }): void;
  login(
    callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
    options: Record<string, unknown>
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

@Component({
  selector: 'app-instancias',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="page-grid">
      <article class="panel surface-card">
        <div class="header-row">
          <div>
            <p class="eyebrow">Meta Embedded Signup</p>
            <h2>Numeros WhatsApp</h2>
          </div>
          <button mat-stroked-button type="button" (click)="cargarInstancias()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>

        <form (ngSubmit)="crearInstancia()" class="create-form">
          <mat-form-field appearance="outline">
            <mat-label>Nombre interno</mat-label>
            <input
              matInput
              name="displayName"
              [ngModel]="displayName()"
              (ngModelChange)="displayName.set($event)"
              placeholder="Ventas principal"
              autocomplete="off"
            />
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" [disabled]="!canCreate()">
            <mat-icon>add_link</mat-icon>
            Crear instancia
          </button>
        </form>

        <p *ngIf="errorMessage()" class="error">{{ errorMessage() }}</p>
        <p *ngIf="successMessage()" class="success">{{ successMessage() }}</p>
      </article>

      <article class="panel surface-card">
        <div class="header-row">
          <div>
            <p class="eyebrow">{{ instances().length }} instancia(s)</p>
            <h2>Conexiones de la empresa</h2>
          </div>
        </div>

        <ul class="items" *ngIf="hasInstances(); else emptyState">
          <li *ngFor="let instance of instances()">
            <div class="instance-main">
              <span class="status" [class.connected]="instance.status === 'CONNECTED'">{{ instance.status }}</span>
              <strong>{{ instance.displayName }}</strong>
              <p>{{ instance.displayPhoneNumber || 'Sin numero vinculado' }}</p>
              <small>WABA: {{ instance.wabaId || 'pendiente' }} - Phone ID: {{ instance.phoneNumberId || 'pendiente' }}</small>
            </div>
            <button mat-raised-button color="primary" type="button" (click)="vincular(instance)" [disabled]="linkingId() === instance.id">
              <mat-icon>login</mat-icon>
              {{ instance.status === 'CONNECTED' ? 'Revincular' : 'Vincular Meta' }}
            </button>
          </li>
        </ul>

        <ng-template #emptyState>
          <div class="empty">
            <strong>No hay instancias todavia.</strong>
            <span>Crea una instancia y abre el login de Meta para autorizar el numero del cliente.</span>
          </div>
        </ng-template>
      </article>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page-grid { display: grid; gap: var(--space-4); grid-template-columns: minmax(280px, 420px) minmax(0, 1fr); align-items: start; }
    .panel { padding: var(--space-4); display: grid; gap: var(--space-4); border-radius: var(--radius-md); }
    .header-row { display: flex; justify-content: space-between; gap: var(--space-4); align-items: start; }
    h2, p { margin: 0; }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; color: var(--primary); font-size: .74rem; }
    .create-form { display: grid; gap: var(--space-3); }
    .create-form button { justify-self: start; }
    button mat-icon { margin-right: var(--space-2); }
    .items { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-3); }
    .items li { display: flex; justify-content: space-between; gap: var(--space-4); align-items: center; border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-3); background: var(--mat-sys-surface-container-low); }
    .instance-main { min-width: 0; display: grid; gap: .25rem; }
    .instance-main p, .instance-main small { color: var(--muted-foreground); }
    .status { width: fit-content; border: 1px solid var(--border); border-radius: 999px; padding: .18rem .5rem; font-size: .72rem; background: var(--card); }
    .status.connected { color: var(--success); border-color: color-mix(in srgb, var(--success) 45%, var(--border)); background: color-mix(in srgb, var(--success) 12%, var(--card)); }
    .error { color: var(--destructive); }
    .success { color: var(--success); }
    .empty { display: grid; gap: .3rem; color: var(--muted-foreground); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: var(--space-4); background: var(--mat-sys-surface-container-low); }
    @media (max-width: 980px) { .page-grid { grid-template-columns: 1fr; } .items li { align-items: stretch; flex-direction: column; } }
  `]
})
export class InstanciasComponent {
  private readonly api = inject(AsistenteVentasApiService);
  private facebookSdkPromise: Promise<FacebookSdk> | null = null;

  protected readonly displayName = signal('');
  protected readonly loading = signal(false);
  protected readonly linkingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly hasInstances = computed(() => this.instances().length > 0);
  protected readonly canCreate = computed(() => this.displayName().trim().length > 0 && !this.loading());

  constructor() {
    void this.cargarInstancias();
  }

  @HostListener('window:message', ['$event'])
  protected onPopupMessage(event: MessageEvent): void {
    if (event.data?.type === 'winsuite-whatsapp-linked') {
      this.successMessage.set('Numero vinculado correctamente con Meta.');
      void this.cargarInstancias();
    }
  }

  protected async crearInstancia(): Promise<void> {
    if (!this.canCreate()) return;
    this.loading.set(true);
    this.clearMessages();
    try {
      await firstValueFrom(this.api.createInstance({ displayName: this.displayName().trim() }));
      this.displayName.set('');
      await this.cargarInstancias();
      this.successMessage.set('Instancia creada. Ahora puedes vincularla con Meta.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo crear la instancia.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async vincular(instance: WhatsAppInstance): Promise<void> {
    this.clearMessages();
    this.linkingId.set(instance.id);
    try {
      const linkSession = await firstValueFrom(this.api.startLinkSession(instance.id));
      const signup = await this.runEmbeddedSignup(linkSession);
      await firstValueFrom(this.api.completeLinkSession(instance.id, {
        code: signup.code,
        state: linkSession.state,
        wabaId: signup.wabaId,
        phoneNumberId: signup.phoneNumberId
      }));
      this.successMessage.set('Numero vinculado correctamente con Meta.');
      await this.cargarInstancias();
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo completar la vinculacion con Meta.');
    } finally {
      this.linkingId.set(null);
    }
  }

  protected async cargarInstancias(): Promise<void> {
    try {
      const result = await firstValueFrom(this.api.listInstances());
      this.instances.set(result ?? []);
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudieron cargar las instancias.');
    }
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private async runEmbeddedSignup(linkSession: LinkSession): Promise<{ code: string; wabaId: string; phoneNumberId: string }> {
    const sdk = await this.loadFacebookSdk(linkSession.appId, linkSession.graphApiVersion);

    return new Promise((resolve, reject) => {
      let code: string | null = null;
      let wabaId: string | null = null;
      let phoneNumberId: string | null = null;

      const cleanup = (): void => {
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timeoutId);
      };

      const finishIfReady = (): void => {
        if (!code || !wabaId || !phoneNumberId) return;
        cleanup();
        resolve({ code, wabaId, phoneNumberId });
      };

      const onMessage = (event: MessageEvent): void => {
        if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;

        const data = this.parseFacebookMessage(event.data);
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event === 'FINISH') {
          wabaId = data.data?.['waba_id'] ?? data.data?.['wabaId'] ?? null;
          phoneNumberId = data.data?.['phone_number_id'] ?? data.data?.['phoneNumberId'] ?? null;
          finishIfReady();
          return;
        }

        if (data.event === 'CANCEL' || data.event === 'ERROR') {
          cleanup();
          reject(new Error(`Embedded Signup ${data.event}`));
        }
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Embedded Signup timeout'));
      }, 120000);

      window.addEventListener('message', onMessage);

      sdk.login((response) => {
        code = response.authResponse?.code ?? null;
        if (!code) {
          cleanup();
          reject(new Error('Meta did not return an authorization code'));
          return;
        }
        finishIfReady();
      }, {
        config_id: linkSession.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: '3'
        }
      });
    });
  }

  private loadFacebookSdk(appId: string, graphApiVersion: string): Promise<FacebookSdk> {
    if (this.facebookSdkPromise) return this.facebookSdkPromise;

    this.facebookSdkPromise = new Promise((resolve, reject) => {
      const initialize = (): void => {
        if (!window.FB) {
          reject(new Error('Facebook SDK did not load'));
          return;
        }
        window.FB.init({
          appId,
          version: graphApiVersion,
          xfbml: false,
          cookie: false
        });
        resolve(window.FB);
      };

      if (window.FB) {
        initialize();
        return;
      }

      window.fbAsyncInit = initialize;
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      script.onerror = () => reject(new Error('Could not load Facebook SDK'));
      document.body.appendChild(script);
    });

    return this.facebookSdkPromise;
  }

  private parseFacebookMessage(raw: unknown): { type?: string; event?: string; data?: Record<string, string> } | null {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw && typeof raw === 'object' ? raw as { type?: string; event?: string; data?: Record<string, string> } : null;
  }
}

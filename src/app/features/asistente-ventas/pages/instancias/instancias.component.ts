import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { WhatsAppInstance } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

/** El token del numero de prueba de Meta dura un dia; pasado ese plazo se avisa en pantalla. */
const HORAS_VIDA_TOKEN = 24;

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
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <section class="page-grid">
      <div class="drawer-backdrop" *ngIf="connectionDrawerOpen()" (click)="connectionDrawerOpen.set(false)"></div>
      <div class="columna connection-drawer" *ngIf="connectionDrawerOpen()">
        <div class="drawer-title"><div><h2>{{ editandoId() ? 'Editar conexión' : 'Agregar conexión' }}</h2><p>Configura el número que atenderá las conversaciones.</p></div><button mat-icon-button type="button" (click)="connectionDrawerOpen.set(false)" aria-label="Cerrar"><mat-icon>close</mat-icon></button></div>
        <article class="panel surface-card" *ngIf="enEspera()">
          <div class="header-row">
            <div>
              <p class="eyebrow">Proximamente</p>
              <h2>Conexion no disponible</h2>
            </div>
          </div>
          <p class="ayuda">
            La aplicacion de WinSuit esta en revision por Meta. En cuanto la aprueben podras vincular
            el numero de WhatsApp de tu empresa desde aqui y el asistente empezara a responder.
          </p>
        </article>

        <article class="panel surface-card" *ngIf="embeddedSignupHabilitado()">
          <div class="header-row">
            <div>
              <p class="eyebrow">Meta Embedded Signup</p>
              <h2>Numeros WhatsApp</h2>
            </div>
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

        <article class="panel surface-card" *ngIf="manualHabilitado()">
          <div class="header-row">
            <div>
              <p class="eyebrow">Numero de prueba</p>
              <h2>Conexion manual</h2>
            </div>
          </div>

          <p class="ayuda">
            Copia los datos del numero de prueba desde el panel de Meta. El token se genera alli con
            <strong>Generar token</strong> y caduca a las {{ horasVidaToken }} horas: cuando deje de
            funcionar, genera otro y actualizalo aqui.
          </p>

          <form (ngSubmit)="guardarManual()" class="create-form">
            <mat-form-field appearance="outline">
              <mat-label>Nombre interno</mat-label>
              <input
                matInput
                type="text"
                name="manualNombre"
                [ngModel]="manualNombre()"
                (ngModelChange)="manualNombre.set($event)"
                placeholder="Numero de prueba"
                autocomplete="off"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone Number ID</mat-label>
              <input
                matInput
                type="text"
                name="manualPhoneNumberId"
                [ngModel]="manualPhoneNumberId()"
                (ngModelChange)="manualPhoneNumberId.set($event)"
                autocomplete="off"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Identificador de la cuenta de WhatsApp Business</mat-label>
              <input
                matInput
                type="text"
                name="manualWabaId"
                [ngModel]="manualWabaId()"
                (ngModelChange)="manualWabaId.set($event)"
                autocomplete="off"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Token de acceso</mat-label>
              <input
                matInput
                type="password"
                name="manualToken"
                [ngModel]="manualToken()"
                (ngModelChange)="manualToken.set($event)"
                autocomplete="off"
              />
              <mat-hint>{{ ayudaToken() }}</mat-hint>
            </mat-form-field>

            <div class="manual-acciones">
              <button mat-raised-button color="primary" type="submit" [disabled]="!canSaveManual()">
                <mat-icon>link</mat-icon>
                {{ editandoId() ? 'Guardar cambios' : 'Conectar numero' }}
              </button>
              <button mat-button type="button" *ngIf="editandoId()" (click)="cancelarEdicion()">Cancelar</button>
            </div>
          </form>

          <p *ngIf="manualError()" class="error">{{ manualError() }}</p>
          <p *ngIf="manualSuccess()" class="success">{{ manualSuccess() }}</p>
        </article>
      </div>

      <article class="panel surface-card">
        <div class="header-row">
          <div>
            <h2>Conexiones de WhatsApp</h2>
            <p class="ayuda">{{ filteredInstances().length }} de {{ instances().length }} conexiones</p>
          </div>
          <div class="header-actions"><button mat-icon-button type="button" (click)="cargarInstancias()" matTooltip="Actualizar"><mat-icon>refresh</mat-icon></button><button mat-raised-button color="primary" type="button" (click)="connectionDrawerOpen.set(true)"><mat-icon>add</mat-icon>Agregar conexión</button></div>
        </div>

        <div class="connection-filters"><label class="search-box"><mat-icon>search</mat-icon><input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Buscar por nombre, número o WABA" /></label><div class="filter-pills"><button type="button" [class.active]="statusFilter() === 'ALL'" (click)="statusFilter.set('ALL')">Todas</button><button type="button" [class.active]="statusFilter() === 'CONNECTED'" (click)="statusFilter.set('CONNECTED')">Conectadas</button><button type="button" [class.active]="statusFilter() === 'PENDING'" (click)="statusFilter.set('PENDING')">Pendientes</button></div></div>

        <ul class="items" *ngIf="hasInstances(); else emptyState">
          <li *ngFor="let instance of filteredInstances()">
            <div class="instance-main">
              <div class="badges">
                <span class="status" [class.connected]="instance.status === 'CONNECTED'">{{ instance.status }}</span>
                <span class="status manual" *ngIf="instance.manual">Manual</span>
              </div>
              <strong>{{ instance.displayName }}</strong>
              <p>{{ instance.displayPhoneNumber || 'Sin numero vinculado' }}</p>
              <small>WABA: {{ instance.wabaId || 'pendiente' }} - Phone ID: {{ instance.phoneNumberId || 'pendiente' }}</small>
              <small *ngIf="instance.manual && instance.tokenUpdatedAt">
                Token actualizado: {{ instance.tokenUpdatedAt | date: 'dd/MM/yyyy HH:mm' }}
              </small>
              <small class="warn" *ngIf="tokenCaducado(instance)">
                El token supera las {{ horasVidaToken }} horas: genera uno nuevo en Meta y actualizalo.
              </small>
              <p class="check" *ngIf="checkId() === instance.id && checkMessage()"
                 [class.error]="!checkOk()" [class.success]="checkOk()">
                {{ checkMessage() }}
              </p>

              <form class="token-form" *ngIf="tokenFormId() === instance.id" (ngSubmit)="guardarToken(instance)">
                <mat-form-field appearance="outline">
                  <mat-label>Token nuevo</mat-label>
                  <input
                    matInput
                    type="password"
                    name="nuevoToken"
                    [ngModel]="nuevoToken()"
                    (ngModelChange)="nuevoToken.set($event)"
                    autocomplete="off"
                  />
                </mat-form-field>
                <div class="token-acciones">
                  <button mat-raised-button color="primary" type="submit" [disabled]="!nuevoToken().trim()">
                    Guardar token
                  </button>
                  <button mat-button type="button" (click)="cerrarTokenForm()">Cancelar</button>
                </div>
              </form>
            </div>

            <div class="instance-acciones">
              <button
                *ngIf="!instance.manual"
                mat-raised-button
                color="primary"
                type="button"
                (click)="vincular(instance)"
                [disabled]="linkingId() === instance.id || !embeddedSignupHabilitado()"
              >
                <mat-icon>login</mat-icon>
                {{ instance.status === 'CONNECTED' ? 'Revincular' : 'Vincular Meta' }}
              </button>

              <ng-container *ngIf="instance.manual">
                <button mat-stroked-button type="button" (click)="probar(instance)" [disabled]="checkingId() === instance.id">
                  <mat-icon>network_check</mat-icon>
                  Probar conexion
                </button>
                <button mat-raised-button color="primary" type="button" (click)="abrirTokenForm(instance)">
                  <mat-icon>key</mat-icon>
                  Actualizar token
                </button>
                <button mat-button type="button" (click)="editarManual(instance)">
                  <mat-icon>edit</mat-icon>
                  Editar datos
                </button>
              </ng-container>
            </div>
          </li>
        </ul>

        <ng-template #emptyState>
          <div class="empty">
            <strong>No hay instancias todavia.</strong>
            <span *ngIf="enEspera()">
              El modulo se activara en cuanto Meta apruebe la aplicacion de WinSuit.
            </span>
            <span *ngIf="embeddedSignupHabilitado()">
              Crea una instancia y abre el login de Meta para autorizar el numero del cliente.
            </span>
            <span *ngIf="manualHabilitado() && !embeddedSignupHabilitado()">
              Carga los datos del numero de prueba en el formulario de la izquierda.
            </span>
          </div>
        </ng-template>
      </article>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page-grid { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); align-items: start; }
    .columna { display: grid; gap: var(--space-4); align-content: start; min-width: 0; }
    .ayuda { color: var(--muted-foreground); font-size: .84rem; }
    .manual-acciones { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
    .panel { padding: var(--space-4); display: grid; gap: var(--space-4); border-radius: var(--radius-md); }
    .drawer-backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(14 24 26 / 32%); backdrop-filter: blur(2px); }
    .connection-drawer { position: fixed; z-index: 51; top: 0; right: 0; width: min(440px, 94vw); height: 100dvh; padding: 1rem; overflow: auto; background: var(--tc-surface); box-shadow: -20px 0 60px rgb(14 24 26 / 18%); }
    .drawer-title, .header-actions, .connection-filters, .filter-pills { display: flex; align-items: center; gap: .5rem; }
    .drawer-title { justify-content: space-between; } .drawer-title p { margin-top: .2rem; color: var(--muted-foreground); font-size: .82rem; }
    .connection-filters { justify-content: space-between; flex-wrap: wrap; }
    .search-box { min-width: min(360px, 100%); min-height: 44px; padding: 0 .7rem; display: flex; align-items: center; gap: .45rem; border-radius: 12px; background: var(--tc-surface-container-low); }
    .search-box input { min-width: 0; width: 100%; border: 0; outline: 0; color: inherit; background: transparent; }
    .filter-pills button { min-height: 36px; padding: 0 .7rem; border: 0; border-radius: 999px; color: var(--muted-foreground); background: transparent; cursor: pointer; }
    .filter-pills button.active { color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); font-weight: 700; }
    .header-row { display: flex; justify-content: space-between; gap: var(--space-4); align-items: start; }
    h2, p { margin: 0; }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; color: var(--primary); font-size: .74rem; }
    .create-form { display: grid; gap: var(--space-3); }
    .create-form button { justify-self: start; }
    button mat-icon { margin-right: var(--space-2); }
    .items { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-3); }
    .items li { display: flex; justify-content: space-between; gap: var(--space-4); align-items: center; border: 0; border-radius: var(--radius-md); padding: var(--space-3); background: var(--mat-sys-surface-container-low); }
    .instance-main { min-width: 0; display: grid; gap: .25rem; }
    .badges { display: flex; gap: .35rem; flex-wrap: wrap; }
    .instance-acciones { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
    .status.manual { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); background: color-mix(in srgb, var(--primary) 12%, var(--card)); }
    .warn { color: var(--warning, var(--destructive)); }
    .check { margin-top: .25rem; font-size: .84rem; }
    .token-form { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
    .token-acciones { display: flex; gap: var(--space-2); align-items: center; }
    .instance-main p, .instance-main small { color: var(--muted-foreground); }
    .status { width: fit-content; border: 1px solid var(--border); border-radius: 999px; padding: .18rem .5rem; font-size: .72rem; background: var(--card); }
    .status.connected { color: var(--success); border-color: color-mix(in srgb, var(--success) 45%, var(--border)); background: color-mix(in srgb, var(--success) 12%, var(--card)); }
    .error { color: var(--destructive); }
    .success { color: var(--success); }
    .empty { display: grid; gap: .3rem; color: var(--muted-foreground); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: var(--space-4); background: var(--mat-sys-surface-container-low); }
    @media (max-width: 980px) { .page-grid { grid-template-columns: 1fr; } .items li { align-items: stretch; flex-direction: column; } .instance-acciones { justify-content: stretch; } }
  `]
})
export class InstanciasComponent {
  private readonly api = inject(AsistenteVentasApiService);
  private facebookSdkPromise: Promise<FacebookSdk> | null = null;

  protected readonly horasVidaToken = HORAS_VIDA_TOKEN;

  protected readonly displayName = signal('');
  protected readonly loading = signal(false);
  protected readonly linkingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly hasInstances = computed(() => this.instances().length > 0);
  protected readonly connectionDrawerOpen = signal(false);
  protected readonly search = signal('');
  protected readonly statusFilter = signal('ALL');
  protected readonly filteredInstances = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.instances().filter((instance) => (this.statusFilter() === 'ALL' || instance.status === this.statusFilter())
      && (!query || `${instance.displayName} ${instance.displayPhoneNumber ?? ''} ${instance.wabaId ?? ''}`.toLowerCase().includes(query)));
  });
  protected readonly canCreate = computed(() => this.displayName().trim().length > 0 && !this.loading());

  /** El super administrador autoriza empresa por empresa quien puede cargar credenciales a mano. */
  protected readonly manualHabilitado = computed(() => this.api.capabilities()?.manualEnabled === true);

  /** Mientras Meta revisa la aplicacion, el Embedded Signup no puede vincular ningun numero. */
  protected readonly embeddedSignupHabilitado = computed(
    () => this.api.capabilities()?.embeddedSignupEnabled === true
  );

  /** Ni Meta ni carga manual: la empresa solo puede esperar a la aprobacion. */
  protected readonly enEspera = computed(() => !this.embeddedSignupHabilitado() && !this.manualHabilitado());

  protected readonly manualNombre = signal('');
  protected readonly manualPhoneNumberId = signal('');
  protected readonly manualWabaId = signal('');
  protected readonly manualToken = signal('');
  protected readonly editandoId = signal<string | null>(null);
  protected readonly savingManual = signal(false);
  protected readonly manualError = signal<string | null>(null);
  protected readonly manualSuccess = signal<string | null>(null);

  protected readonly tokenFormId = signal<string | null>(null);
  protected readonly nuevoToken = signal('');
  protected readonly checkingId = signal<string | null>(null);
  protected readonly checkId = signal<string | null>(null);
  protected readonly checkMessage = signal<string | null>(null);
  protected readonly checkOk = signal(false);

  protected readonly canSaveManual = computed(() =>
    !this.savingManual()
    && this.manualNombre().trim().length > 0
    && this.manualPhoneNumberId().trim().length > 0
    && this.manualWabaId().trim().length > 0
    // Al dar de alta el token es obligatorio; al editar, si se deja vacio se conserva el guardado.
    && (this.editandoId() !== null || this.manualToken().trim().length > 0)
  );

  protected readonly ayudaToken = computed(() =>
    this.editandoId()
      ? 'Dejalo vacio para conservar el token guardado.'
      : 'Se guarda cifrado y no vuelve a mostrarse.'
  );

  constructor() {
    void this.api.ensureCapabilities();
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

  protected async guardarManual(): Promise<void> {
    if (!this.canSaveManual()) return;
    this.savingManual.set(true);
    this.manualError.set(null);
    this.manualSuccess.set(null);
    const editando = this.editandoId() !== null;
    try {
      await firstValueFrom(this.api.saveManualInstance({
        instanceId: this.editandoId(),
        displayName: this.manualNombre().trim(),
        phoneNumberId: this.manualPhoneNumberId().trim(),
        wabaId: this.manualWabaId().trim(),
        accessToken: this.manualToken().trim() || null
      }));
      this.limpiarFormularioManual();
      await this.cargarInstancias();
      this.manualSuccess.set(editando
        ? 'Conexion actualizada.'
        : 'Numero conectado. Ya puedes crear plantillas y flujos sobre el.');
    } catch (error) {
      this.manualError.set(this.extractError(error, 'No se pudo guardar la conexion manual.'));
    } finally {
      this.savingManual.set(false);
    }
  }

  protected editarManual(instance: WhatsAppInstance): void {
    this.connectionDrawerOpen.set(true);
    this.manualError.set(null);
    this.manualSuccess.set(null);
    this.editandoId.set(instance.id);
    this.manualNombre.set(instance.displayName ?? '');
    this.manualPhoneNumberId.set(instance.phoneNumberId ?? '');
    this.manualWabaId.set(instance.wabaId ?? '');
    this.manualToken.set('');
  }

  protected cancelarEdicion(): void {
    this.limpiarFormularioManual();
  }

  protected abrirTokenForm(instance: WhatsAppInstance): void {
    this.tokenFormId.set(instance.id);
    this.nuevoToken.set('');
    this.checkMessage.set(null);
  }

  protected cerrarTokenForm(): void {
    this.tokenFormId.set(null);
    this.nuevoToken.set('');
  }

  protected async guardarToken(instance: WhatsAppInstance): Promise<void> {
    const token = this.nuevoToken().trim();
    if (!token) return;
    this.manualError.set(null);
    this.manualSuccess.set(null);
    try {
      await firstValueFrom(this.api.updateInstanceToken(instance.id, token));
      this.cerrarTokenForm();
      await this.cargarInstancias();
      this.manualSuccess.set('Token actualizado.');
    } catch (error) {
      this.manualError.set(this.extractError(error, 'No se pudo actualizar el token.'));
    }
  }

  protected async probar(instance: WhatsAppInstance): Promise<void> {
    this.checkingId.set(instance.id);
    this.checkId.set(instance.id);
    this.checkMessage.set(null);
    try {
      const resultado = await firstValueFrom(this.api.checkInstance(instance.id));
      this.checkOk.set(resultado.ok);
      this.checkMessage.set(resultado.mensaje);
    } catch (error) {
      this.checkOk.set(false);
      this.checkMessage.set(this.extractError(error, 'No se pudo probar la conexion.'));
    } finally {
      this.checkingId.set(null);
    }
  }

  /** Avisa cuando el token manual pasa de su vida util para que nadie busque el fallo en otro sitio. */
  protected tokenCaducado(instance: WhatsAppInstance): boolean {
    if (!instance.manual || !instance.tokenUpdatedAt) return false;
    return Date.now() - instance.tokenUpdatedAt > HORAS_VIDA_TOKEN * 3600 * 1000;
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

  private limpiarFormularioManual(): void {
    this.editandoId.set(null);
    this.manualNombre.set('');
    this.manualPhoneNumberId.set('');
    this.manualWabaId.set('');
    this.manualToken.set('');
  }

  /** El backend responde {"error": "motivo real"} en los fallos de validacion. */
  private extractError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return fallback;
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

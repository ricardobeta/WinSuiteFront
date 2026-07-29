import { EnvironmentInjector, Injectable, NgZone, inject, runInInjectionContext, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom, tap } from 'rxjs';
import { FirebaseApp } from '@angular/fire/app';
// Importar desde @angular/fire y no desde 'firebase/messaging': @angular/fire trae su propia
// copia anidada del SDK (firebase 12) distinta de la de la raiz (firebase 11), y cada copia
// tiene su registro de componentes. Mezclarlas hace que getMessaging no encuentre la app.
import { Messaging, getMessaging, getToken, isSupported, onMessage } from '@angular/fire/messaging';

import { environment } from '../../../environments/environment';
import { CompanyNotification, NotificationPreferences, NotificationSummary } from '../models/notification.models';

/** Push recibido con la app en primer plano, donde FCM no muestra nada por su cuenta. */
export interface ForegroundPush { title: string; body: string; link?: string; }

@Injectable({ providedIn: 'root' })
export class CompanyNotificationService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(EnvironmentInjector);
  // Por DI y no getApp(): garantiza que provideFirebaseApp ya inicializo la app por defecto.
  private readonly firebaseApp = inject(FirebaseApp);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/tenants/current/notifications`;
  readonly items = signal<CompanyNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly foregroundPush = new Subject<ForegroundPush>();
  private foregroundListenerReady = false;

  load(limit = 30) {
    return this.http.get<NotificationSummary>(this.baseUrl, { params: { limit } }).pipe(
      tap(summary => { this.items.set(summary.items); this.unreadCount.set(summary.unreadCount); })
    );
  }

  markRead(item: CompanyNotification): void {
    if (item.readAt) return;
    item.readAt = Date.now();
    this.items.update(items => [...items]);
    this.unreadCount.update(value => Math.max(0, value - 1));
    this.http.post<void>(`${this.baseUrl}/${encodeURIComponent(item.id)}/read`, {}).subscribe();
  }

  markAllRead(): void {
    const now = Date.now();
    this.items.update(items => items.map(item => ({ ...item, readAt: item.readAt ?? now })));
    this.unreadCount.set(0);
    this.http.post<void>(`${this.baseUrl}/read-all`, {}).subscribe();
  }

  /**
   * Avisa al equipo de una venta recien registrada. Las ventas se escriben directo a RTDB desde
   * el POS, asi que el backend no se entera solo. Es best-effort a proposito: una notificacion
   * fallida no puede tumbar el cierre de una venta que ya esta guardada.
   */
  notifySale(ventaId: string, numero: string, total: number): void {
    this.http.post<void>(`${this.baseUrl}/events/sale`, { ventaId, numero, total })
      .subscribe({ error: error => console.warn('[notificaciones] no se pudo avisar de la venta', error) });
  }

  notifySaleReversal(ventaId: string, numero: string, motivo: string): void {
    this.http.post<void>(`${this.baseUrl}/events/sale-reversal`, { ventaId, numero, motivo })
      .subscribe({ error: error => console.warn('[notificaciones] no se pudo avisar del reverso', error) });
  }

  getPreferences() { return this.http.get<NotificationPreferences>(`${this.baseUrl}/preferences`); }
  savePreferences(value: NotificationPreferences) { return this.http.put<NotificationPreferences>(`${this.baseUrl}/preferences`, value); }

  async enablePush(): Promise<void> {
    try {
      if (!(await this.pushSupported())) throw new Error('PUSH_NOT_SUPPORTED');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('PUSH_DENIED');
      await this.registerDevice();
    } catch (error) {
      // Un unico punto de log: cualquier fallo llega crudo a la consola, tenga o no un codigo
      // traducible. Sin esto, un error inesperado se perdia y la UI solo decia "no se pudo".
      const cause = (error as Error)?.cause as { code?: string; message?: string } | undefined;
      console.error(
        `[push] ${(error as Error)?.message} | causa: ${cause?.code ?? '-'} ${cause?.message ?? '(sin causa)'}`,
        cause ?? error
      );
      throw error;
    }
  }

  /**
   * Reengancha el dispositivo al abrir el workspace. El token de FCM rota (reinstalacion del
   * service worker, limpieza de datos del navegador, otro equipo) y hasta aqui solo se registraba
   * al guardar preferencias, asi que las notificaciones dejaban de llegar sin aviso. No pide
   * permiso: si el usuario nunca lo concedio o desactivo el push, no hace nada.
   */
  async syncPush(): Promise<void> {
    try {
      if (!(await this.pushSupported()) || Notification.permission !== 'granted') return;
      const preferences = await firstValueFrom(this.getPreferences());
      if (!preferences.pushEnabled) return;
      await this.registerDevice();
    } catch {
      // El push es complementario: nunca debe romper el arranque del workspace.
    }
  }

  private async pushSupported(): Promise<boolean> {
    return 'Notification' in window && 'serviceWorker' in navigator && await this.inContext(() => isSupported());
  }

  /**
   * pushManager.subscribe() falla si el worker aun no esta activo, y register() resuelve mucho
   * antes de eso. navigator.serviceWorker.ready no sirve aqui porque se refiere al worker que
   * controla la pagina, que puede ser otro: hay que esperar a este registro en concreto.
   */
  private async activeRegistration(): Promise<ServiceWorkerRegistration> {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    if (registration.active) return registration;
    const pending = registration.installing ?? registration.waiting;
    if (!pending) throw new Error('El service worker no quedo registrado.');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('El service worker no activo a tiempo.')), 10_000);
      pending.addEventListener('statechange', () => {
        if (pending.state === 'activated') { clearTimeout(timeout); resolve(); }
        // redundant = el script fallo al instalar (error de sintaxis, importScripts caido).
        if (pending.state === 'redundant') { clearTimeout(timeout); reject(new Error('El service worker fallo al instalar.')); }
      });
    });
    return registration;
  }

  /**
   * getPushSubscription() del SDK reutiliza cualquier suscripcion existente sin comparar su
   * applicationServerKey. Los navegadores que se suscribieron cuando firebaseVapidKey estaba
   * vacio quedaron atados a la clave por defecto del SDK y jamas recibirian nuestros envios.
   */
  private async dropMismatchedSubscription(registration: ServiceWorkerRegistration): Promise<void> {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const key = subscription.options.applicationServerKey;
    if (key && this.toBase64Url(key) === environment.firebaseVapidKey) return;
    await subscription.unsubscribe();
  }

  private toBase64Url(key: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(key));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Las funciones de @angular/fire se auto-envuelven en la zona de Angular leyendo el contexto de
   * inyeccion. Dentro de un metodo async ese contexto ya se perdio y avisan por consola, asi que
   * lo restauramos explicitamente.
   */
  private inContext<T>(operation: () => T): T {
    return runInInjectionContext(this.injector, operation);
  }

  private async registerDevice(): Promise<void> {
    let registration: ServiceWorkerRegistration;
    try {
      registration = await this.activeRegistration();
    } catch (cause) {
      throw new Error('PUSH_SW_FAILED', { cause });
    }

    let messaging: Messaging;
    try {
      messaging = this.inContext(() => getMessaging(this.firebaseApp));
    } catch (cause) {
      throw new Error('PUSH_MESSAGING_UNAVAILABLE', { cause });
    }

    let token: string;
    try {
      await this.dropMismatchedSubscription(registration);
      const options = environment.firebaseVapidKey
        ? { serviceWorkerRegistration: registration, vapidKey: environment.firebaseVapidKey }
        : { serviceWorkerRegistration: registration };
      token = await this.inContext(() => getToken(messaging, options));
    } catch (cause) {
      throw new Error('PUSH_TOKEN_FAILED', { cause });
    }
    if (!token) throw new Error('PUSH_TOKEN_EMPTY');
    let installationId = localStorage.getItem('winsuite.notificationInstallationId');
    if (!installationId) {
      installationId = crypto.randomUUID();
      localStorage.setItem('winsuite.notificationInstallationId', installationId);
    }
    try {
      await firstValueFrom(this.http.post<void>(`${this.baseUrl}/devices`, {
        installationId, token, platform: navigator.userAgent
      }));
    } catch (cause) {
      throw new Error('PUSH_DEVICE_REJECTED', { cause });
    }
    this.listenForeground(messaging);
  }

  /** Con la pestana activa el service worker no muestra el aviso: lo emitimos a la shell. */
  private listenForeground(messaging: Messaging): void {
    if (this.foregroundListenerReady) return;
    this.foregroundListenerReady = true;
    this.inContext(() => onMessage(messaging, payload => this.zone.run(() => {
      this.load().subscribe({ error: () => undefined });
      this.foregroundPush.next({
        title: payload.notification?.title ?? 'Nueva notificacion',
        body: payload.notification?.body ?? '',
        link: payload.data?.['link'] || undefined
      });
    })));
  }
}

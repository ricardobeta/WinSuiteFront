import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { CompanyNotificationService } from '../../../../core/services/company-notification.service';
import { environment } from '../../../../../environments/environment';

const PUSH_ERRORS: Record<string, string> = {
  PUSH_NOT_SUPPORTED: 'Este navegador no soporta notificaciones push (o estas en modo incognito).',
  PUSH_DENIED: 'El navegador bloqueo las notificaciones. Habilitalas en el candado de la barra de direcciones.',
  PUSH_SW_FAILED: 'No se pudo instalar el service worker de notificaciones. Requiere HTTPS o localhost.',
  PUSH_MESSAGING_UNAVAILABLE: 'No se pudo inicializar Firebase Messaging en este navegador.',
  PUSH_TOKEN_FAILED: 'Firebase rechazo la suscripcion. Revisa la clave VAPID y que la API de FCM este habilitada.',
  PUSH_TOKEN_EMPTY: 'Firebase no devolvio un token para este dispositivo.',
  PUSH_DEVICE_REJECTED: 'No se pudo registrar el dispositivo en el servidor.'
};

@Component({
  selector: 'app-empresa-notifications',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatSlideToggleModule, MatSnackBarModule],
  template: `
    <section class="surface-card preferences">
      <div class="heading"><span class="icon"><mat-icon>notifications_active</mat-icon></span><div><p class="eyebrow">Avisos por empresa</p><h2>Mis notificaciones</h2><p>Elige que novedades quieres recibir mientras trabajas y en tus dispositivos.</p></div></div>
      @if (loading()) { <mat-spinner diameter="36" /> } @else {
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="channel"><div><strong>Notificaciones push</strong><p>Recibe alertas aun cuando no tengas WinSuit abierto.</p></div><mat-slide-toggle formControlName="pushEnabled" /></div>
          <div class="topics">
            <h3>Temas de esta empresa</h3>
            <div class="topic"><mat-icon>point_of_sale</mat-icon><div><strong>Ventas</strong><p>Ventas completadas y novedades comerciales.</p></div><mat-slide-toggle formControlName="sales" /></div>
            <div class="topic"><mat-icon>dynamic_form</mat-icon><div><strong>Formularios del sitio</strong><p>Nuevos registros enviados desde tus sitios.</p></div><mat-slide-toggle formControlName="forms" /></div>
            <div class="topic"><mat-icon>event</mat-icon><div><strong>Calendario y eventos</strong><p>Nuevos eventos, cambios y recordatorios.</p></div><mat-slide-toggle formControlName="calendar" /></div>
          </div>
          <div class="actions"><button mat-flat-button color="primary" type="submit" [disabled]="saving()">Guardar preferencias</button></div>
        </form>
      }
    </section>`,
  styles: [`
    .preferences { padding: 1.4rem; display: grid; gap: 1.25rem; max-width: 820px; } .heading { display: flex; gap: 1rem; align-items: flex-start; }
    .icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }
    .eyebrow { margin: 0; color: var(--primary); text-transform: uppercase; letter-spacing: .1em; font-size: .7rem; } h2 { margin: .15rem 0; } p { margin: .2rem 0 0; color: var(--muted-foreground); }
    form { display: grid; gap: 1rem; } .channel, .topic { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid var(--tc-ghost-border); border-radius: 14px; }
    .topics { display: grid; gap: .65rem; } .topics h3 { margin: .35rem 0; } .topic { grid-template-columns: auto 1fr auto; } .topic > mat-icon { color: var(--primary); }
    .actions { display: flex; justify-content: flex-end; }
  `]
})
export class EmpresaNotificationsComponent {
  private readonly notifications = inject(CompanyNotificationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({ pushEnabled: false, sales: true, forms: true, calendar: true });

  constructor() {
    this.notifications.getPreferences().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: value => this.form.patchValue(value), error: () => this.show('No se pudieron cargar tus preferencias.')
    });
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      const value = { ...this.form.getRawValue(), inApp: true };
      if (value.pushEnabled) await this.notifications.enablePush();
      await new Promise<void>((resolve, reject) => this.notifications.savePreferences(value).subscribe({ next: () => resolve(), error: reject }));
      this.show('Preferencias guardadas.');
    } catch (error) {
      this.form.controls.pushEnabled.setValue(false);
      this.show(this.describe(error));
    } finally { this.saving.set(false); }
  }

  private describe(error: unknown): string {
    const known = PUSH_ERRORS[(error as Error)?.message];
    if (known) return known;
    console.error('[notificaciones] no se pudieron guardar las preferencias', error);
    if (error instanceof HttpErrorResponse) {
      // status 0 = la peticion nunca llego (backend caido, CORS, mixed content).
      return error.status === 0
        ? 'No se pudo contactar al servidor. Revisa que el backend este arriba en ' + environment.apiBaseUrl + '.'
        : `El servidor rechazo el guardado (HTTP ${error.status}).`;
    }
    return 'No se pudo guardar. Revisa la consola del navegador.';
  }

  private show(message: string): void { this.snackBar.open(message, 'Cerrar', { duration: 6000 }); }
}

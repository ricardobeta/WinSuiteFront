import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

@Component({
  selector: 'app-asistente-ventas-shell',
  imports: [RouterOutlet, ModuleShellComponent, MatIconModule],
  template: `
    <app-module-shell
      moduleId="asistente_ventas"
      eyebrow="Asistente de ventas"
      title="Administrador WhatsApp"
      description="Gestiona instancias, plantillas, conversaciones y automatizaciones comerciales de cada empresa."
      icon="forum"
      navigationLabel="Navegación del asistente de ventas"
      [items]="navigationItems"
      [compact]="true"
      [compactOnMobile]="true"
      [immersive]="isFlowRoute()"
    >
      @if (enEspera() && !isFlowRoute()) {
        <section class="aviso-meta" role="status">
          <mat-icon>schedule</mat-icon>
          <div>
            <strong>El modulo todavia no esta operativo</strong>
            <p>
              Estamos completando la autorizacion de la aplicacion con Meta (WhatsApp Business).
              Hasta que la aprueben no se puede vincular ningun numero ni enviar mensajes: podras
              preparar plantillas y flujos, pero quedaran en espera. Muy pronto.
            </p>
          </div>
        </section>
      }

      <router-outlet />
    </app-module-shell>
  `,
  styles: [`
    .aviso-meta {
      display: flex;
      gap: .8rem;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding: .9rem 1rem;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest));
    }
    .aviso-meta mat-icon { color: var(--primary); flex: 0 0 auto; }
    .aviso-meta div { flex: 1; min-width: 0; }
    .aviso-meta p { margin: .15rem 0 0; color: var(--muted-foreground); max-width: 78ch; }
  `],
})
export class AsistenteVentasShellComponent {
  private readonly api = inject(AsistenteVentasApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isFlowRoute = signal(this.router.url.includes('/asistente-ventas/flujos'));

  /** Sin Embedded Signup aprobado y sin permiso de carga manual, el modulo no puede conectar nada. */
  protected readonly enEspera = computed(() => {
    const capacidades = this.api.capabilities();
    return capacidades !== null && !capacidades.embeddedSignupEnabled && !capacidades.manualEnabled;
  });

  constructor() {
    void this.api.ensureCapabilities();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.isFlowRoute.set(this.router.url.includes('/asistente-ventas/flujos')));
  }

  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Instancias', icon: 'hub', route: '/workspace/asistente-ventas/instancias' },
    { label: 'Plantillas', icon: 'edit_note', route: '/workspace/asistente-ventas/plantillas' },
    { label: 'Flujos', icon: 'schema', route: '/workspace/asistente-ventas/flujos' },
    { label: 'Conversaciones', icon: 'chat', route: '/workspace/asistente-ventas/conversaciones' },
    { label: 'Funnels', icon: 'filter_alt', route: '/workspace/asistente-ventas/funnels' },
    { label: 'Base de conocimiento', icon: 'auto_awesome', route: '/workspace/asistente-ventas/conocimiento' },
  ];
}

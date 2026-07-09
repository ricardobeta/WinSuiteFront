import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
  selector: 'app-asistente-ventas-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TourTriggerButtonComponent],
  template: `
    <section class="asistente-shell">
      <header class="asistente-hero surface-card" id="tour-asistente_ventas-header">
        <div>
          <p class="eyebrow">
            Asistente Ventas
            <app-tour-trigger-button (open)="startTourManually()" />
          </p>
          <h1>Administrador WhatsApp</h1>
          <p>
            Gestiona instancias, plantillas, automatizaciones de flujo y funnels de conversion para cada empresa.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" id="tour-asistente_ventas-subnav" aria-label="Navegacion asistente ventas">
        <a routerLink="instancias" routerLinkActive="active-link">Instancias</a>
        <a routerLink="plantillas" routerLinkActive="active-link">Plantillas</a>
        <a routerLink="flujos" routerLinkActive="active-link">Flujos</a>
        <a routerLink="conversaciones" routerLinkActive="active-link">Conversaciones</a>
        <a routerLink="funnels" routerLinkActive="active-link">Funnels</a>
        <a routerLink="conocimiento" routerLinkActive="active-link">Base de conocimiento</a>
      </nav>

      <main id="tour-asistente_ventas-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .asistente-shell { display: grid; gap: 1rem; }
    .asistente-hero { padding: 1.5rem; display: grid; gap: .75rem; background: var(--tc-surface-container-lowest); }
    .asistente-hero h1 { margin: 0; font-size: clamp(1.9rem, 4vw, 2.8rem); }
    .asistente-hero p { margin: 0; max-width: 76ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .11em; color: var(--primary); margin: 0; font-size: .77rem; }
    .subnav { padding: .75rem 1rem; display: flex; flex-wrap: wrap; gap: .45rem; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
  `]
})
export class AsistenteVentasShellComponent {
  private static readonly MODULE_ID = 'asistente_ventas';

  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);

  constructor() {
    if (!this.guidedTour.hasSeenTour(AsistenteVentasShellComponent.MODULE_ID)) {
      afterNextRender(
        () => {
          void loadTourSteps(AsistenteVentasShellComponent.MODULE_ID).then((steps) =>
            this.guidedTour.startTour(AsistenteVentasShellComponent.MODULE_ID, steps)
          );
        },
        { injector: this.injector }
      );
    }
  }

  protected startTourManually(): void {
    void loadTourSteps(AsistenteVentasShellComponent.MODULE_ID).then((steps) =>
      this.guidedTour.startTour(AsistenteVentasShellComponent.MODULE_ID, steps)
    );
  }
}

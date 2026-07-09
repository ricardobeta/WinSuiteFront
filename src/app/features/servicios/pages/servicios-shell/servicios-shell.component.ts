import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
  selector: 'app-servicios-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TourTriggerButtonComponent],
  template: `
    <section class="servicios-shell">
      <header class="servicios-hero surface-card" id="tour-servicios-header">
        <div>
          <p class="eyebrow">
            Modulo Servicios
            <app-tour-trigger-button (open)="startTourManually()" />
          </p>
          <h1>Servicios</h1>
          <p>
            Gestiona el catalogo de servicios, precios y configuraciones que usa tu operacion comercial.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" id="tour-servicios-subnav" aria-label="Navegacion de servicios">
        <a routerLink="lista" routerLinkActive="active-link">Lista</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuracion</a>
      </nav>

      <main class="servicios-content" id="tour-servicios-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .servicios-shell { display: grid; gap: 1rem; }
    .servicios-hero { padding: 1.5rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .servicios-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
    .servicios-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
    .servicios-content { min-width: 0; }
  `]
})
export class ServiciosShellComponent {
  private static readonly MODULE_ID = 'servicios';

  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);

  constructor() {
    if (!this.guidedTour.hasSeenTour(ServiciosShellComponent.MODULE_ID)) {
      afterNextRender(
        () => {
          void loadTourSteps(ServiciosShellComponent.MODULE_ID).then((steps) =>
            this.guidedTour.startTour(ServiciosShellComponent.MODULE_ID, steps)
          );
        },
        { injector: this.injector }
      );
    }
  }

  protected startTourManually(): void {
    void loadTourSteps(ServiciosShellComponent.MODULE_ID).then((steps) =>
      this.guidedTour.startTour(ServiciosShellComponent.MODULE_ID, steps)
    );
  }
}

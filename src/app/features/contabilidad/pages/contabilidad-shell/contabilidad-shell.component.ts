import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
  selector: 'app-contabilidad-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TourTriggerButtonComponent],
  template: `
    <section class="contabilidad-shell">
      <header class="contabilidad-hero surface-card" id="tour-contabilidad-header">
        <div>
          <p class="eyebrow">
            Gestion contable
            <app-tour-trigger-button (open)="startTourManually()" />
          </p>
          <h1>Contabilidad</h1>
          <p>Organiza tu plan de cuentas, asientos, periodos y reportes para tomar decisiones con informacion financiera clara.</p>
        </div>
      </header>

      <nav class="subnav surface-card" id="tour-contabilidad-subnav" aria-label="Navegacion de contabilidad">
        <a routerLink="plan-cuentas" routerLinkActive="active-link">Plan de cuentas</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuracion</a>
        <a routerLink="asientos" routerLinkActive="active-link">Asientos contables</a>
        <a routerLink="compras" routerLinkActive="active-link">Compras</a>
        <a routerLink="cuentas-por-pagar" routerLinkActive="active-link">Cuentas por Pagar</a>
        <a routerLink="reportes" routerLinkActive="active-link">Reportes</a>
        <a routerLink="ats" routerLinkActive="active-link">ATS</a>
        <a routerLink="nomina" routerLinkActive="active-link">Nomina</a>
      </nav>

      <main class="contabilidad-content" id="tour-contabilidad-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .contabilidad-shell { display: grid; gap: 1rem; }
    .contabilidad-hero { padding: 1.5rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .contabilidad-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
    .contabilidad-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
    .contabilidad-content { min-width: 0; }
  `]
})
export class ContabilidadShellComponent {
  private static readonly MODULE_ID = 'contabilidad';

  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);

  constructor() {
    if (!this.guidedTour.hasSeenTour(ContabilidadShellComponent.MODULE_ID)) {
      afterNextRender(
        () => {
          void loadTourSteps(ContabilidadShellComponent.MODULE_ID).then((steps) =>
            this.guidedTour.startTour(ContabilidadShellComponent.MODULE_ID, steps)
          );
        },
        { injector: this.injector }
      );
    }
  }

  protected startTourManually(): void {
    void loadTourSteps(ContabilidadShellComponent.MODULE_ID).then((steps) =>
      this.guidedTour.startTour(ContabilidadShellComponent.MODULE_ID, steps)
    );
  }
}

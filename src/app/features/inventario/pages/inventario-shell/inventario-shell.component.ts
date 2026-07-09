import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
  selector: 'app-inventario-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TourTriggerButtonComponent],
  template: `
    <section class="inventario-shell">
      <header class="inventario-hero surface-card" id="tour-inventario-header">
        <div>
          <p class="eyebrow">
            Modulo Inventario
            <app-tour-trigger-button (open)="startTourManually()" />
          </p>
          <h1>Inventario</h1>
          <p>
            Gestiona productos, proveedores, ordenes de compra, stock y configuracion del inventario.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" id="tour-inventario-subnav" aria-label="Navegacion de inventario">
        <a routerLink="productos" routerLinkActive="active-link">Productos</a>
        <a routerLink="recetas" routerLinkActive="active-link">Recetas</a>
        <a routerLink="proveedores" routerLinkActive="active-link">Proveedores</a>
        <a routerLink="ordenes-compra" routerLinkActive="active-link">Ordenes de compra</a>
        <a routerLink="costos" routerLinkActive="active-link">Costos</a>
        <a routerLink="almacenes" routerLinkActive="active-link">Almacenes</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuracion</a>
      </nav>

      <main class="inventario-content" id="tour-inventario-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .inventario-shell { display: grid; gap: 1rem; }
    .inventario-hero { padding: 1.5rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .inventario-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
    .inventario-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
    .inventario-content { min-width: 0; }
  `]
})
export class InventarioShellComponent {
  private static readonly MODULE_ID = 'inventario';

  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);

  constructor() {
    if (!this.guidedTour.hasSeenTour(InventarioShellComponent.MODULE_ID)) {
      afterNextRender(
        () => {
          void loadTourSteps(InventarioShellComponent.MODULE_ID).then((steps) =>
            this.guidedTour.startTour(InventarioShellComponent.MODULE_ID, steps)
          );
        },
        { injector: this.injector }
      );
    }
  }

  protected startTourManually(): void {
    void loadTourSteps(InventarioShellComponent.MODULE_ID).then((steps) =>
      this.guidedTour.startTour(InventarioShellComponent.MODULE_ID, steps)
    );
  }
}

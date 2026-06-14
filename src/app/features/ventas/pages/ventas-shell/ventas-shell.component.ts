import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-ventas-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="ventas-shell">
      <header class="ventas-hero surface-card">
        <div>
          <p class="eyebrow">Modulo Ventas</p>
          <h1>Punto de Venta</h1>
          <p>
            Gestiona cobros de mostrador, historial de ventas, reversos e indicadores comerciales en tiempo real.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegacion de ventas">
        <a routerLink="pos" routerLinkActive="active-link">POS</a>
        <a routerLink="resumen" routerLinkActive="active-link">Resumen</a>
        <a routerLink="informes" routerLinkActive="active-link">Informes</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuración</a>
      </nav>

      <main class="ventas-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .ventas-shell { display: grid; gap: 1rem; }
    .ventas-hero { padding: 1.5rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .ventas-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
    .ventas-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
    .ventas-content { min-width: 0; }
  `]
})
export class VentasShellComponent {}

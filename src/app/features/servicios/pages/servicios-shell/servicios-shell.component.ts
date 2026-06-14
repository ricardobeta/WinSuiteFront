import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-servicios-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="servicios-shell">
      <header class="servicios-hero surface-card">
        <div>
          <p class="eyebrow">Modulo Servicios</p>
          <h1>Servicios</h1>
          <p>
            Gestiona el catalogo de servicios del tenant y prepara la configuracion funcional del modulo.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegacion de servicios">
        <a routerLink="lista" routerLinkActive="active-link">Lista</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuracion</a>
      </nav>

      <main class="servicios-content">
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
export class ServiciosShellComponent {}

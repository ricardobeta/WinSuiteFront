import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-asistente-ventas-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="asistente-shell">
      <header class="asistente-hero surface-card">
        <div>
          <p class="eyebrow">Asistente Ventas</p>
          <h1>Administrador WhatsApp</h1>
          <p>
            Gestiona instancias, plantillas, automatizaciones de flujo y funnels de conversion para cada empresa.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegacion asistente ventas">
        <a routerLink="instancias" routerLinkActive="active-link">Instancias</a>
        <a routerLink="plantillas" routerLinkActive="active-link">Plantillas</a>
        <a routerLink="flujos" routerLinkActive="active-link">Flujos</a>
        <a routerLink="conversaciones" routerLinkActive="active-link">Conversaciones</a>
        <a routerLink="funnels" routerLinkActive="active-link">Funnels</a>
      </nav>

      <main>
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
export class AsistenteVentasShellComponent {}

import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-contabilidad-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="contabilidad-shell">
      <header class="contabilidad-hero surface-card">
        <div>
          <p class="eyebrow">Gestion contable</p>
          <h1>Contabilidad</h1>
          <p>Organiza tu plan de cuentas, asientos, periodos y reportes para tomar decisiones con informacion financiera clara.</p>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegacion de contabilidad">
        <a routerLink="plan-cuentas" routerLinkActive="active-link">Plan de cuentas</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuracion</a>
        <a routerLink="asientos" routerLinkActive="active-link">Asientos contables</a>
        <a routerLink="reportes" routerLinkActive="active-link">Reportes</a>
      </nav>

      <main class="contabilidad-content">
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
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { text-decoration: none; padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; display: inline-flex; align-items: center; }
    .active-link { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--foreground); }
    .contabilidad-content { min-width: 0; }
  `]
})
export class ContabilidadShellComponent {}

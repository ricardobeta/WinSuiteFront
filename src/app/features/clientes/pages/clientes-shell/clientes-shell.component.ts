import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-clientes-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButtonModule, MatIconModule],
  template: `
    <section class="clientes-shell">
      <header class="clientes-hero surface-card">
        <div>
          <p class="eyebrow">Módulo Clientes</p>
          <h1>Clientes</h1>
          <p>
            Administra la lista de clientes, la configuración de campos personalizados y el flujo
            reutilizable para apertura desde otros módulos.
          </p>
        </div>

        <div class="clientes-actions">
          <a mat-raised-button color="primary" routerLink="lista" routerLinkActive="active-link">
            <mat-icon>group</mat-icon>
            Lista de clientes
          </a>
          <a mat-flat-button class="btn-secondary-tonal" routerLink="configuracion" routerLinkActive="active-link">
            <mat-icon>tune</mat-icon>
            Configuración
          </a>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegación de clientes">
        <a routerLink="lista" routerLinkActive="active-link">Lista</a>
        <a routerLink="configuracion" routerLinkActive="active-link">Configuración</a>
      </nav>

      <main class="clientes-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [`
    .clientes-shell { display: grid; gap: 1rem; }
    .clientes-hero { padding: 1.5rem; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) auto; align-items: end; background: var(--tc-surface-container-lowest); }
    .clientes-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
    .clientes-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
    .clientes-actions { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: flex-end; }
    .clientes-actions a, .subnav a { text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
    .btn-secondary-tonal {
      background: var(--tc-surface-container-highest);
      color: var(--tc-on-surface);
      border-radius: 999px;
    }
    .subnav { padding: .75rem 1rem; display: flex; gap: .5rem; align-items: center; background: var(--tc-surface-container); border-radius: var(--tc-radius-lg); }
    .subnav a { padding: .6rem .9rem; border-radius: 999px; color: inherit; min-height: 44px; }
    .active-link {
      background: color-mix(in srgb, var(--primary) 20%, transparent);
      color: var(--foreground);
    }
    .clientes-content { min-width: 0; }
    @media (max-width: 900px) {
      .clientes-hero { grid-template-columns: 1fr; }
      .clientes-actions { justify-content: flex-start; }
    }
  `]
})
export class ClientesShellComponent {}
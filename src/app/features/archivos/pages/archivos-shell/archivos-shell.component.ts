import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-archivos-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="archivos-shell">
      <header class="archivos-hero surface-card">
        <div>
          <p class="eyebrow">Administrador de archivos</p>
          <h1>Archivos de la empresa</h1>
          <p>
            Centraliza la carga de excels e imagenes para compartirlas con todo el equipo.
          </p>
        </div>
      </header>

      <nav class="subnav surface-card" aria-label="Navegacion de archivos">
        <a routerLink="lista" routerLinkActive="active-link">Listado</a>
      </nav>

      <main class="archivos-content">
        <router-outlet />
      </main>
    </section>
  `,
  styles: [
    `
      .archivos-shell {
        display: grid;
        gap: 1rem;
      }

      .archivos-hero {
        padding: 1.5rem;
        display: grid;
        gap: 1rem;
        background:
          radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 55%),
          var(--tc-surface-container-lowest);
      }

      .archivos-hero h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
      }

      .archivos-hero p {
        margin: 0.35rem 0 0;
        max-width: 70ch;
        color: var(--muted-foreground);
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        margin: 0 0 0.35rem;
        color: var(--primary);
      }

      .subnav {
        padding: 0.75rem 1rem;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
        background: var(--tc-surface-container);
        border-radius: var(--tc-radius-lg);
      }

      .subnav a {
        text-decoration: none;
        padding: 0.6rem 0.9rem;
        border-radius: 999px;
        color: inherit;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }

      .active-link {
        background: color-mix(in srgb, var(--primary) 20%, transparent);
        color: var(--foreground);
      }

      .archivos-content {
        min-width: 0;
      }
    `
  ]
})
export class ArchivosShellComponent {}

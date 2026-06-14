import { Component } from '@angular/core';

@Component({
  selector: 'app-configuracion-servicios',
  standalone: true,
  template: `
    <section class="surface-card config-card">
      <p class="eyebrow">Servicios</p>
      <h2>Configuracion</h2>
      <p>Submodulo en construccion. Proximamente se habilitaran reglas y parametros de servicios.</p>
    </section>
  `,
  styles: [
    `
      .config-card {
        padding: 1.25rem;
        display: grid;
        gap: 0.45rem;
      }
      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: var(--primary);
      }
      h2 {
        margin: 0;
      }
      p {
        margin: 0;
        color: var(--muted-foreground);
      }
    `
  ]
})
export class ConfiguracionServiciosComponent {}

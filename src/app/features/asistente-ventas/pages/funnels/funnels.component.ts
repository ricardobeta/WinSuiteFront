import { Component } from '@angular/core';

@Component({
  selector: 'app-funnels',
  standalone: true,
  template: `
    <section class="surface-card page">
      <h2>Funnels de conversion</h2>
      <p>
        Submodulo inicial listo para conectar metricas por etapa, tasa de avance, abandono y conversion.
      </p>
    </section>
  `,
  styles: [`
    .page { padding: 1rem; display: grid; gap: .6rem; }
    h2, p { margin: 0; }
    p { color: var(--muted-foreground); }
  `]
})
export class FunnelsComponent {}

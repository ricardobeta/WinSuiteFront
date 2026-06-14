import { Component } from '@angular/core';

@Component({
  selector: 'app-plantillas',
  standalone: true,
  template: `
    <section class="surface-card page">
      <h2>Plantillas de mensaje</h2>
      <p>
        Base inicial lista. En el siguiente paso se implementa el editor de variables y envio para aprobacion de Meta.
      </p>
    </section>
  `,
  styles: [`
    .page { padding: 1rem; display: grid; gap: .6rem; }
    h2, p { margin: 0; }
    p { color: var(--muted-foreground); }
  `]
})
export class PlantillasComponent {}

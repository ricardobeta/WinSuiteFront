import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
  selector: 'app-colaboradores-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, TourTriggerButtonComponent],
  template: `
    <section class="surface-card hero-card" id="tour-colaboradores-header">
      <div>
        <p class="eyebrow">
          Colaboradores
          <app-tour-trigger-button (open)="startTourManually()" />
        </p>
        <h2>Gestión de colaboradores y roles</h2>
        <p>Administra colaboradores, roles y accesos segun las responsabilidades de cada equipo.</p>
      </div>
      <div class="actions">
        <a mat-raised-button color="primary" routerLink="/workspace/colaboradores/nuevo">
          <mat-icon>person_add</mat-icon>
          Nuevo colaborador
        </a>
      </div>
    </section>

    <nav class="surface-card tabs" id="tour-colaboradores-subnav" aria-label="Submódulos colaboradores">
      <a routerLink="/workspace/colaboradores/lista" routerLinkActive="active">Lista</a>
      <a routerLink="/workspace/colaboradores/roles" routerLinkActive="active">Roles</a>
    </nav>

    <div id="tour-colaboradores-content">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 1rem;
      }
      .hero-card {
        padding: 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 1rem;
      }
      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: var(--primary);
      }
      h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      p {
        margin: 0.3rem 0 0;
        color: var(--muted-foreground);
      }
      .tabs {
        padding: 0.5rem;
        display: flex;
        gap: 0.5rem;
      }
      .tabs a {
        padding: 0.5rem 0.75rem;
        border-radius: 999px;
        text-decoration: none;
        color: var(--foreground);
      }
      .tabs a.active {
        background: var(--primary);
        color: var(--primary-foreground);
      }
      @media (max-width: 900px) {
        .hero-card {
          flex-direction: column;
          align-items: start;
        }
      }
    `
  ]
})
export class ColaboradoresShellComponent {
  private static readonly MODULE_ID = 'colaboradores';

  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);

  constructor() {
    if (!this.guidedTour.hasSeenTour(ColaboradoresShellComponent.MODULE_ID)) {
      afterNextRender(
        () => {
          void loadTourSteps(ColaboradoresShellComponent.MODULE_ID).then((steps) =>
            this.guidedTour.startTour(ColaboradoresShellComponent.MODULE_ID, steps)
          );
        },
        { injector: this.injector }
      );
    }
  }

  protected startTourManually(): void {
    void loadTourSteps(ColaboradoresShellComponent.MODULE_ID).then((steps) =>
      this.guidedTour.startTour(ColaboradoresShellComponent.MODULE_ID, steps)
    );
  }
}

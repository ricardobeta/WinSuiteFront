import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-nomina-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, MatTabsModule],
  template: `
    <section class="nomina-page">
      <header class="nomina-header surface-card">
        <div>
          <p class="eyebrow">Contabilidad</p>
          <h1>Nomina</h1>
          <p class="muted">Administra empleados, roles de pago, rubros y campos adicionales desde el modulo contable.</p>
        </div>
      </header>

      <section class="nomina-tabs surface-card">
        <nav mat-tab-nav-bar [tabPanel]="tabPanel" mat-stretch-tabs="false" aria-label="Secciones de nomina">
          <a mat-tab-link routerLink="roles" routerLinkActive #rolesActive="routerLinkActive" [active]="rolesActive.isActive">
            <mat-icon>receipt_long</mat-icon>
            Roles de pago
          </a>
          <a mat-tab-link routerLink="empleados" routerLinkActive #empleadosActive="routerLinkActive" [active]="empleadosActive.isActive">
            <mat-icon>badge</mat-icon>
            Empleados
          </a>
          <a mat-tab-link routerLink="rubros" routerLinkActive #rubrosActive="routerLinkActive" [active]="rubrosActive.isActive">
            <mat-icon>category</mat-icon>
            Rubros
          </a>
          <a mat-tab-link routerLink="configuracion" routerLinkActive #configActive="routerLinkActive" [active]="configActive.isActive">
            <mat-icon>dynamic_form</mat-icon>
            Configuracion
          </a>
        </nav>

        <mat-tab-nav-panel #tabPanel>
          <main class="tab-body">
            <router-outlet />
          </main>
        </mat-tab-nav-panel>
      </section>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .nomina-page { display: grid; gap: var(--space-3); }
    .nomina-header { padding: var(--space-4); border-radius: var(--radius-md); background: var(--tc-surface-container-lowest); }
    .nomina-header h1 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.6rem); letter-spacing: 0; }
    .eyebrow { margin: 0 0 .3rem; color: var(--primary); font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .muted { margin: .35rem 0 0; max-width: 72ch; color: var(--muted-foreground); font-size: .9rem; }
    .nomina-tabs { border-radius: var(--radius-md); overflow: hidden; background: var(--tc-surface-container-lowest); }
    .nomina-tabs ::ng-deep .mdc-tab__text-label { display: inline-flex; align-items: center; gap: .4rem; }
    .nomina-tabs ::ng-deep .mdc-tab__text-label mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; }
    .tab-body { display: grid; gap: var(--space-3); padding: var(--space-4); min-width: 0; }
    @media (max-width: 720px) {
      .tab-body { padding: var(--space-3); }
      .nomina-tabs ::ng-deep .mat-mdc-tab-link { min-width: max-content; padding-inline: .75rem; }
    }
  `]
})
export class NominaShellComponent {}

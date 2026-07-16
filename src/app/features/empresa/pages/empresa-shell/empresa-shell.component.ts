import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthorizationService } from '../../../../core/services/authorization.service';

interface CompanyTab { label: string; icon: string; route: string; resource: string; }

@Component({
  selector: 'app-empresa-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, MatTabsModule],
  template: `
    <section class="company-shell">
      <header class="company-hero surface-card">
        <div class="hero-icon"><mat-icon>domain</mat-icon></div>
        <div><p class="eyebrow">Administracion central</p><h1>Configuracion de la empresa</h1><p>Informacion, equipo, seguridad y herramientas compartidas en un solo lugar.</p></div>
      </header>
      <nav mat-tab-nav-bar [tabPanel]="tabPanel" aria-label="Secciones de empresa">
        @for (tab of visibleTabs(); track tab.route) {
          <a mat-tab-link [routerLink]="tab.route" routerLinkActive #active="routerLinkActive" [active]="active.isActive">
            <mat-icon>{{ tab.icon }}</mat-icon><span>{{ tab.label }}</span>
          </a>
        }
      </nav>
      <mat-tab-nav-panel #tabPanel><router-outlet /></mat-tab-nav-panel>
    </section>
  `,
  styles: [`
    .company-shell { display: grid; gap: 1rem; }
    .company-hero { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; }
    .hero-icon { display: grid; place-items: center; width: 54px; height: 54px; flex: 0 0 auto; border-radius: 18px; background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .hero-icon mat-icon { width: auto; height: auto; font-size: 30px; }
    .eyebrow { margin: 0 0 0.25rem; color: var(--primary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; }
    h1 { margin: 0; font-size: clamp(1.35rem, 2.5vw, 1.8rem); }
    .company-hero p:last-child { margin: 0.35rem 0 0; color: var(--muted-foreground); }
    nav { overflow-x: auto; background: var(--tc-surface-container-lowest); border-radius: var(--radius-lg); }
    a { gap: 0.4rem; min-width: max-content; }
    @media (width <= 680px) { .company-hero { align-items: flex-start; } .hero-icon { width: 44px; height: 44px; } }
  `]
})
export class EmpresaShellComponent {
  private readonly authorization = inject(AuthorizationService);
  private readonly tabs: CompanyTab[] = [
    { label: 'Informacion general', icon: 'business', route: '/workspace/empresa/general', resource: 'empresa_general' },
    { label: 'Calendario', icon: 'calendar_month', route: '/workspace/empresa/calendario', resource: 'empresa_calendario' },
    { label: 'Modulos', icon: 'apps', route: '/workspace/empresa/modulos', resource: 'empresa_modulos' },
    { label: 'Colaboradores', icon: 'groups', route: '/workspace/empresa/colaboradores', resource: 'empresa_colaboradores' },
    { label: 'Roles', icon: 'admin_panel_settings', route: '/workspace/empresa/roles', resource: 'empresa_roles' },
    { label: 'Auditoria', icon: 'manage_search', route: '/workspace/empresa/auditoria', resource: 'empresa_auditoria' },
    { label: 'Mis notificaciones', icon: 'notifications_active', route: '/workspace/empresa/notificaciones', resource: 'empresa_notificaciones' }
  ];
  protected readonly visibleTabs = computed(() => this.tabs.filter(tab => this.authorization.canAccess(tab.resource, 'read')));
}

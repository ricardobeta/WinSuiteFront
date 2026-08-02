import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';

interface ItemPanel {
  ruta: string;
  etiqueta: string;
  icono: string;
}

/**
 * Contenedor del panel de super administracion. Es un shell propio y no el del workspace
 * porque el super administrador no tiene empresa activa: no hay selector de empresa,
 * ni modulos, ni copiloto.
 */
@Component({
  selector: 'app-super-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="panel" [class.colapsado]="colapsado()">
      <aside class="barra">
        <div class="marca">
          <mat-icon>admin_panel_settings</mat-icon>
          @if (!colapsado()) {
            <div>
              <strong>WinSuit</strong>
              <small>Plataforma</small>
            </div>
          }
        </div>

        <nav>
          @for (item of items; track item.ruta) {
            <a
              [routerLink]="item.ruta"
              routerLinkActive="activo"
              [matTooltip]="colapsado() ? item.etiqueta : ''"
              matTooltipPosition="right"
            >
              <mat-icon>{{ item.icono }}</mat-icon>
              @if (!colapsado()) {
                <span>{{ item.etiqueta }}</span>
              }
            </a>
          }
        </nav>

        <button mat-icon-button type="button" class="colapsar" (click)="alternarBarra()"
                [matTooltip]="colapsado() ? 'Expandir' : 'Contraer'">
          <mat-icon>{{ colapsado() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </aside>

      <div class="contenido">
        <header>
          <div>
            <p class="eyebrow">Super administracion</p>
            <h1>Panel de plataforma</h1>
          </div>
          <div class="sesion">
            <span>{{ auth.currentUser()?.email }}</span>
            <button mat-stroked-button type="button" (click)="salir()">
              <mat-icon>logout</mat-icon>
              Salir
            </button>
          </div>
        </header>

        <main>
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--tc-surface-container-low); }
    .panel { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    .panel.colapsado { grid-template-columns: 76px 1fr; }
    .barra {
      display: flex; flex-direction: column; gap: .35rem; padding: 1rem .75rem;
      background: var(--sidebar, var(--tc-surface-container)); border-right: 1px solid var(--tc-surface-container-high);
    }
    .marca { display: flex; align-items: center; gap: .6rem; padding: .35rem .5rem 1rem; }
    .marca strong { display: block; font-size: 1rem; }
    .marca small { color: var(--muted-foreground); font-size: .75rem; }
    nav { display: grid; gap: .2rem; flex: 1; }
    nav a {
      display: flex; align-items: center; gap: .7rem; padding: .6rem .7rem; border-radius: var(--tc-radius-md, 10px);
      color: inherit; text-decoration: none; font-size: .92rem;
    }
    nav a:hover { background: var(--tc-surface-container-high); }
    nav a.activo { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); font-weight: 600; }
    .colapsar { align-self: flex-end; }
    .contenido { display: grid; grid-template-rows: auto 1fr; min-width: 0; }
    header {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--tc-surface-container-high);
      background: var(--tc-surface-container-lowest);
    }
    header h1 { margin: 0; font-size: 1.3rem; }
    .eyebrow { margin: 0 0 .2rem; text-transform: uppercase; letter-spacing: .12em; font-size: .7rem; color: var(--primary); }
    .sesion { display: flex; align-items: center; gap: .8rem; }
    .sesion span { color: var(--muted-foreground); font-size: .9rem; }
    main { padding: 1.5rem; min-width: 0; }
    @media (max-width: 860px) {
      .panel, .panel.colapsado { grid-template-columns: 1fr; }
      .barra { flex-direction: row; align-items: center; overflow-x: auto; }
      nav { grid-auto-flow: column; grid-auto-columns: max-content; }
      .marca, .colapsar { display: none; }
      main { padding: 1rem; }
      .sesion span { display: none; }
    }
  `],
})
export class SuperAdminShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly colapsado = signal(false);

  protected readonly items: ItemPanel[] = [
    { ruta: 'empresas', etiqueta: 'Empresas', icono: 'apartment' },
    { ruta: 'cuentas', etiqueta: 'Cuentas', icono: 'manage_accounts' },
    { ruta: 'planes-empresa', etiqueta: 'Planes por empresa', icono: 'workspace_premium' },
    { ruta: 'planes-cuenta', etiqueta: 'Planes por cuenta', icono: 'badge' },
    { ruta: 'complementos', etiqueta: 'Complementos', icono: 'extension' },
    { ruta: 'ordenes', etiqueta: 'Ordenes de compra', icono: 'receipt_long' },
    { ruta: 'ajustes-pago', etiqueta: 'Ajustes de cobro', icono: 'account_balance' },
  ];

  protected alternarBarra(): void {
    this.colapsado.update((valor) => !valor);
  }

  protected async salir(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}

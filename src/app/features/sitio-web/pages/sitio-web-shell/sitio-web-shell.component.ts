import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SitiosService } from '../../services/sitios.service';

/** Shell del sitio seleccionado: tabs Editor | Catalogo* | Pedidos* | Configuracion (*solo ecommerce). */
@Component({
  selector: 'app-sitio-web-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, MatTabsModule],
  template: `
    <div class="shell">
      <div class="barra">
        <a routerLink="/workspace/sitio-web" class="volver" aria-label="Mis sitios">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span class="nombre">{{ config()?.nombre ?? '...' }}</span>
        <nav mat-tab-nav-bar [tabPanel]="panelTabs" class="tabs-nav">
          <a
            mat-tab-link
            routerLink="editor"
            routerLinkActive
            #rlEditor="routerLinkActive"
            [active]="rlEditor.isActive"
            ><mat-icon>edit</mat-icon>&nbsp;Editor</a
          >
          @if (esEcommerce()) {
            <a
              mat-tab-link
              routerLink="catalogo"
              routerLinkActive
              #rlCatalogo="routerLinkActive"
              [active]="rlCatalogo.isActive"
              ><mat-icon>sell</mat-icon>&nbsp;Catalogo</a
            >
            <a
              mat-tab-link
              routerLink="pedidos"
              routerLinkActive
              #rlPedidos="routerLinkActive"
              [active]="rlPedidos.isActive"
              ><mat-icon>receipt_long</mat-icon>&nbsp;Pedidos</a
            >
          }
          <a
            mat-tab-link
            routerLink="formularios"
            routerLinkActive
            #rlFormularios="routerLinkActive"
            [active]="rlFormularios.isActive"
            ><mat-icon>list_alt</mat-icon>&nbsp;Formularios</a
          >
          <a
            mat-tab-link
            routerLink="pagos"
            routerLinkActive
            #rlPagos="routerLinkActive"
            [active]="rlPagos.isActive"
            ><mat-icon>payments</mat-icon>&nbsp;Pagos</a
          >
          <a
            mat-tab-link
            routerLink="configuracion"
            routerLinkActive
            #rlConfig="routerLinkActive"
            [active]="rlConfig.isActive"
            ><mat-icon>tune</mat-icon>&nbsp;Configuracion</a
          >
        </nav>
        @if (config(); as c) {
          <span class="dominio">{{ c.subdominio }}.winsuit.app</span>
        }
      </div>
      <mat-tab-nav-panel #panelTabs class="contenido">
        <router-outlet />
      </mat-tab-nav-panel>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .shell {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .barra {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      background: #fff;
      flex-wrap: wrap;
    }
    .tabs-nav {
      --mat-tab-header-divider-height: 0;
    }
    .tabs-nav a {
      min-width: 0;
      padding: 0 14px;
    }
    .tabs-nav mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .volver {
      display: inline-flex;
      align-items: center;
      color: inherit;
      margin-right: 4px;
    }
    .nombre {
      font-weight: 700;
      margin-right: 16px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dominio {
      margin-left: auto;
      font-family: monospace;
      font-size: 0.82rem;
      opacity: 0.7;
    }
    .contenido {
      flex: 1;
      min-height: 0;
      /* Sin overflow:auto: la cadena usa min-height (nunca scrollea aqui) y un
         overflow!=visible rompe el position:sticky de los paneles del editor. */
      overflow: visible;
    }
  `,
})
export class SitioWebShellComponent {
  private readonly sitiosService = inject(SitiosService);

  /** Route param (withComponentInputBinding o resolucion manual). */
  readonly sitioId = input.required<string>();

  private readonly configResource = resource({
    params: () => ({ sitioId: this.sitioId() }),
    loader: ({ params }) => this.sitiosService.getConfig(params.sitioId),
  });

  readonly config = computed(() => this.configResource.value() ?? null);
  readonly esEcommerce = computed(() => this.config()?.tipo === 'ecommerce');
}

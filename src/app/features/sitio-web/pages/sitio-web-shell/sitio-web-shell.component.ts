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
import { SitiosService } from '../../services/sitios.service';

/** Shell del sitio seleccionado: tabs Editor | Catalogo* | Pedidos* | Configuracion (*solo ecommerce). */
@Component({
  selector: 'app-sitio-web-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  template: `
    <div class="shell">
      <nav class="tabs">
        <a routerLink="/workspace/sitio-web" class="volver" aria-label="Mis sitios">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span class="nombre">{{ config()?.nombre ?? '...' }}</span>
        <a routerLink="editor" routerLinkActive="activo"><mat-icon>edit</mat-icon> Editor</a>
        @if (esEcommerce()) {
          <a routerLink="catalogo" routerLinkActive="activo"><mat-icon>sell</mat-icon> Catalogo</a>
          <a routerLink="pedidos" routerLinkActive="activo"
            ><mat-icon>receipt_long</mat-icon> Pedidos</a
          >
        }
        <a routerLink="formularios" routerLinkActive="activo"
          ><mat-icon>list_alt</mat-icon> Formularios</a
        >
        <a routerLink="pagos" routerLinkActive="activo"><mat-icon>payments</mat-icon> Pagos</a>
        <a routerLink="configuracion" routerLinkActive="activo"
          ><mat-icon>tune</mat-icon> Configuracion</a
        >
        @if (config(); as c) {
          <span class="dominio">{{ c.subdominio }}.winsuit.app</span>
        }
      </nav>
      <div class="contenido">
        <router-outlet />
      </div>
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
    .tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      background: #fff;
      flex-wrap: wrap;
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
    .tabs a:not(.volver) {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      font-weight: 500;
      font-size: 0.92rem;
    }
    .tabs a mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .tabs a.activo {
      background: #eff6ff;
      color: #2563eb;
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

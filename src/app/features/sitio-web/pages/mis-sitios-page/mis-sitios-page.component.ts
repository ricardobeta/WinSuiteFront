import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { SitiosService } from '../../services/sitios.service';
import { ResumenSitio } from '../../models/sitio-web.models';
import { DialogoSitioComponent } from '../../components/dialogo-sitio/dialogo-sitio.component';

@Component({
  selector: 'app-mis-sitios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="encabezado">
      <div>
        <h1>Mis sitios</h1>
        <p class="subtitulo">
          Crea tu ecommerce o landing pages y publicalas en tu propio subdominio.
        </p>
      </div>
      <a mat-flat-button color="primary" routerLink="nuevo">
        <mat-icon>add</mat-icon>
        Crear sitio
      </a>
    </div>

    @if (sitios(); as lista) {
      @if (lista.length === 0) {
        <div class="vacio">
          <mat-icon class="vacio-icono">storefront</mat-icon>
          <h2>Aun no tienes sitios</h2>
          <p>
            Crea tu primer ecommerce o landing page en minutos, con plantillas listas para editar.
          </p>
          <a mat-flat-button color="primary" routerLink="nuevo">Crear mi primer sitio</a>
        </div>
      } @else {
        <div class="grilla">
          @for (sitio of lista; track sitio.sitioId) {
            <div class="card">
              <div class="card-cuerpo">
                <div class="tipo" [class.tipo-ecommerce]="sitio.config.tipo === 'ecommerce'">
                  <mat-icon>{{
                    sitio.config.tipo === 'ecommerce' ? 'shopping_cart' : 'web'
                  }}</mat-icon>
                  {{ sitio.config.tipo === 'ecommerce' ? 'Ecommerce' : 'Landing page' }}
                </div>
                <h2>{{ sitio.config.nombre }}</h2>
                <p class="dominio">{{ sitio.config.subdominio }}.winsuit.app</p>
                <p class="estado">
                  @if (sitio.versionPublicada) {
                    <span class="publicado">● Publicado (v{{ sitio.versionPublicada }})</span>
                  } @else {
                    <span class="borrador">● Borrador sin publicar</span>
                  }
                </p>
              </div>
              <div class="card-acciones">
                <a mat-button color="primary" [routerLink]="[sitio.sitioId, 'editor']">
                  <mat-icon>edit</mat-icon>
                  Editar
                </a>
                <a mat-button [routerLink]="[sitio.sitioId, 'configuracion']">
                  <mat-icon>tune</mat-icon>
                  Configurar
                </a>
                <button mat-icon-button (click)="eliminar(sitio)" aria-label="Eliminar sitio">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 24px;
    }
    .encabezado {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 4px;
    }
    .subtitulo {
      margin: 0;
      opacity: 0.7;
    }
    .grilla {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    .card {
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
    .card-cuerpo {
      padding: 18px;
      flex: 1;
    }
    .tipo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #059669;
      margin-bottom: 10px;
    }
    .tipo mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .tipo-ecommerce {
      background: #eff6ff;
      color: #2563eb;
    }
    .card h2 {
      margin: 0 0 4px;
      font-size: 1.15rem;
    }
    .dominio {
      margin: 0 0 8px;
      font-family: monospace;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .estado {
      margin: 0;
      font-size: 0.85rem;
    }
    .publicado {
      color: #059669;
    }
    .borrador {
      color: #b45309;
    }
    .card-acciones {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    .card-acciones button[mat-icon-button] {
      margin-left: auto;
    }
    .vacio {
      text-align: center;
      padding: 64px 24px;
      max-width: 420px;
      margin-inline: auto;
    }
    .vacio-icono {
      font-size: 56px;
      width: 56px;
      height: 56px;
      opacity: 0.35;
    }
  `,
})
export class MisSitiosPageComponent {
  private readonly sitiosService = inject(SitiosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly sitios = toSignal(this.sitiosService.getSitios());
  readonly eliminando = signal(false);

  async eliminar(sitio: ResumenSitio): Promise<void> {
    const confirmado = await firstValueFrom(this.dialog.open(DialogoSitioComponent, {
      data: {
        titulo: 'Eliminar sitio',
        mensaje: `¿Eliminar "${sitio.config.nombre}"? El sitio publicado dejará de estar disponible y se liberará el subdominio ${sitio.config.subdominio}.`,
        confirmar: 'Eliminar sitio', peligro: true,
      },
      width: '520px',
    }).afterClosed());
    if (!confirmado || this.eliminando()) return;
    this.eliminando.set(true);
    try {
      await this.sitiosService.eliminarSitio(sitio);
      this.snackBar.open('Sitio eliminado', 'OK', { duration: 3000 });
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo eliminar el sitio', 'OK', {
        duration: 4000,
      });
    } finally {
      this.eliminando.set(false);
    }
  }
}

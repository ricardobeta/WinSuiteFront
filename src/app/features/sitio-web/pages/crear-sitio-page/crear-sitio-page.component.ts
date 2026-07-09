import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SUBDOMINIO_REGEX, TipoSitio, slugify } from '@winsuite/bloques';
import { SitiosService } from '../../services/sitios.service';
import { PLANTILLAS_SITIO, PlantillaSitio, plantillasPorTipo } from '../../config/plantillas';
import { esSubdominioReservado } from '../../config/subdominios-reservados';

type EstadoSubdominio =
  | 'sin-verificar'
  | 'verificando'
  | 'disponible'
  | 'ocupado'
  | 'invalido'
  | 'error';

@Component({
  selector: 'app-crear-sitio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="cabecera">
      <a mat-icon-button routerLink=".." aria-label="Volver"><mat-icon>arrow_back</mat-icon></a>
      <h1>Crear sitio</h1>
    </div>

    <div class="pasos">
      <span [class.activo]="paso() === 1">1. Tipo</span>
      <span [class.activo]="paso() === 2">2. Plantilla</span>
      <span [class.activo]="paso() === 3">3. Nombre y direccion</span>
    </div>

    @switch (paso()) {
      @case (1) {
        <h2>¿Que quieres crear?</h2>
        <div class="opciones">
          <button
            class="opcion"
            [class.seleccionada]="tipo() === 'ecommerce'"
            (click)="elegirTipo('ecommerce')"
          >
            <mat-icon>shopping_cart</mat-icon>
            <h3>Ecommerce</h3>
            <p>Tienda online con tus productos del inventario, carrito y pedidos.</p>
          </button>
          <button
            class="opcion"
            [class.seleccionada]="tipo() === 'landing'"
            (click)="elegirTipo('landing')"
          >
            <mat-icon>web</mat-icon>
            <h3>Landing page</h3>
            <p>Pagina de marketing con formularios para captar clientes.</p>
          </button>
        </div>
      }
      @case (2) {
        <h2>Elige una plantilla</h2>
        <div class="opciones">
          @for (p of plantillas(); track p.id) {
            <button
              class="opcion"
              [class.seleccionada]="plantilla()?.id === p.id"
              (click)="elegirPlantilla(p)"
            >
              <div class="muestra" [style.background]="p.colorPreview"></div>
              <h3>{{ p.nombre }}</h3>
              <p>{{ p.descripcion }}</p>
            </button>
          }
        </div>
        <div class="acciones">
          <button mat-button (click)="paso.set(1)">Atras</button>
        </div>
      }
      @case (3) {
        <h2>Nombre y direccion de tu sitio</h2>
        <div class="formulario">
          <label>
            <span>Nombre del sitio</span>
            <input
              type="text"
              [ngModel]="nombre()"
              (ngModelChange)="cambiarNombre($event)"
              placeholder="Mi tienda"
              maxlength="80"
            />
          </label>
          <label>
            <span>Subdominio</span>
            <div class="subdominio">
              <input
                type="text"
                [ngModel]="subdominio()"
                (ngModelChange)="cambiarSubdominio($event)"
                placeholder="mi-tienda"
                maxlength="31"
              />
              <span class="sufijo">.winsuit.app</span>
            </div>
            <span
              class="ayuda"
              [class.error]="
                estadoSubdominio() === 'ocupado' ||
                estadoSubdominio() === 'invalido' ||
                estadoSubdominio() === 'error'
              "
            >
              @switch (estadoSubdominio()) {
                @case ('verificando') {
                  Comprobando disponibilidad...
                }
                @case ('disponible') {
                  ✓ Disponible
                }
                @case ('ocupado') {
                  Ese subdominio ya esta en uso o reservado.
                }
                @case ('invalido') {
                  Solo minusculas, numeros y guiones (3 a 31 caracteres, empieza con letra o
                  numero).
                }
                @case ('error') {
                  No se pudo comprobar la disponibilidad: {{ errorVerificacion() }}
                }
                @default {
                  Sera la direccion publica de tu sitio.
                }
              }
            </span>
          </label>
          <div class="acciones">
            <button mat-button (click)="paso.set(2)">Atras</button>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!puedeCrear() || creando()"
              (click)="crear()"
            >
              {{ creando() ? 'Creando...' : 'Crear sitio' }}
            </button>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 24px;
      max-width: 860px;
      margin-inline: auto;
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
    }
    .pasos {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .pasos span {
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.05);
    }
    .pasos .activo {
      background: #2563eb;
      color: #fff;
      font-weight: 600;
    }
    .opciones {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .opcion {
      text-align: left;
      padding: 20px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      font: inherit;
    }
    .opcion:hover {
      border-color: #93c5fd;
    }
    .opcion.seleccionada {
      border-color: #2563eb;
    }
    .opcion mat-icon {
      font-size: 34px;
      width: 34px;
      height: 34px;
      color: #2563eb;
    }
    .opcion h3 {
      margin: 10px 0 6px;
    }
    .opcion p {
      margin: 0;
      opacity: 0.7;
      font-size: 0.9rem;
    }
    .muestra {
      height: 90px;
      border-radius: 8px;
      opacity: 0.85;
    }
    .formulario {
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 480px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-weight: 600;
    }
    input {
      font: inherit;
      padding: 10px 12px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }
    .subdominio {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .subdominio input {
      flex: 1;
    }
    .sufijo {
      font-family: monospace;
      opacity: 0.7;
    }
    .ayuda {
      font-weight: 400;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .ayuda.error {
      color: #dc2626;
      opacity: 1;
    }
    .acciones {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }
  `,
})
export class CrearSitioPageComponent {
  private readonly sitiosService = inject(SitiosService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly paso = signal<1 | 2 | 3>(1);
  readonly tipo = signal<TipoSitio | null>(null);
  readonly plantilla = signal<PlantillaSitio | null>(null);
  readonly nombre = signal('');
  readonly subdominio = signal('');
  readonly estadoSubdominio = signal<EstadoSubdominio>('sin-verificar');
  readonly errorVerificacion = signal('');
  readonly creando = signal(false);

  private subdominioEditadoManualmente = false;
  private timerVerificacion: ReturnType<typeof setTimeout> | null = null;

  readonly plantillas = computed(() =>
    this.tipo() ? plantillasPorTipo(this.tipo() as TipoSitio) : PLANTILLAS_SITIO,
  );

  readonly puedeCrear = computed(
    () =>
      !!this.tipo() &&
      !!this.plantilla() &&
      this.nombre().trim().length >= 2 &&
      this.estadoSubdominio() === 'disponible',
  );

  elegirTipo(tipo: TipoSitio): void {
    this.tipo.set(tipo);
    this.plantilla.set(null);
    this.paso.set(2);
  }

  elegirPlantilla(plantilla: PlantillaSitio): void {
    this.plantilla.set(plantilla);
    this.paso.set(3);
  }

  cambiarNombre(nombre: string): void {
    this.nombre.set(nombre);
    if (!this.subdominioEditadoManualmente) {
      this.cambiarSubdominio(slugify(nombre), true);
    }
  }

  cambiarSubdominio(valor: string, autogenerado = false): void {
    if (!autogenerado) this.subdominioEditadoManualmente = true;
    const limpio = valor.toLowerCase().trim();
    this.subdominio.set(limpio);

    if (this.timerVerificacion) clearTimeout(this.timerVerificacion);
    if (!SUBDOMINIO_REGEX.test(limpio)) {
      this.estadoSubdominio.set(limpio ? 'invalido' : 'sin-verificar');
      return;
    }
    if (esSubdominioReservado(limpio)) {
      this.estadoSubdominio.set('ocupado');
      return;
    }
    this.estadoSubdominio.set('verificando');
    this.timerVerificacion = setTimeout(async () => {
      try {
        const disponible = await this.sitiosService.subdominioDisponible(limpio);
        // Evita pisar el estado si el usuario siguio escribiendo.
        if (this.subdominio() === limpio) {
          this.estadoSubdominio.set(disponible ? 'disponible' : 'ocupado');
        }
      } catch (error) {
        if (this.subdominio() === limpio) {
          this.errorVerificacion.set((error as Error).message ?? 'error desconocido');
          this.estadoSubdominio.set('error');
        }
      }
    }, 400);
  }

  async crear(): Promise<void> {
    const tipo = this.tipo();
    const plantilla = this.plantilla();
    if (!tipo || !plantilla || this.creando()) return;

    this.creando.set(true);
    try {
      const sitioId = await this.sitiosService.crearSitio({
        tipo,
        nombre: this.nombre().trim(),
        subdominio: this.subdominio(),
        contenidoInicial: plantilla.crearContenido(),
      });
      this.snackBar.open('Sitio creado. ¡A construir!', 'OK', { duration: 3000 });
      await this.router.navigate(['/workspace/sitio-web', sitioId, 'editor']);
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo crear el sitio', 'OK', {
        duration: 5000,
      });
    } finally {
      this.creando.set(false);
    }
  }
}

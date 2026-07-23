import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '../../../../core/services/auth.service';
import { combineLatest } from 'rxjs';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { CatalogosFacturacion, ConfiguracionFacturacion } from '../../../../shared/models/facturacion.models';
import { Almacen } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { AppUserProfile } from '../../../../core/models/auth.models';
import { VentasColaboradoresService } from '../../services/ventas-colaboradores.service';
import { VentasUsuariosAlmacenesService } from '../../services/ventas-usuarios-almacenes.service';
import { VentasAlmacenSesionService } from '../../services/ventas-almacen-sesion.service';
import { VentasPosConfigService } from '../../services/ventas-pos-config.service';
import {
  ModoPos,
  PerfilPos,
  UsuariosAlmacenesConfig,
  UsuarioAlmacenAsignacion
} from '../../models/ventas.models';

interface ColaboradorAlmacenesRow {
  colaborador: AppUserProfile;
  almacenesAsignados: Almacen[];
  almacenesNoAsignados: Almacen[];
}

@Component({
  selector: 'app-ventas-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTabsModule
  ],
  template: `
    <section class="configuracion-container">
      <!-- TAB 1: Métodos de Pago (Solo lectura) -->
      <article class="surface-card panel">
        <header class="panel-header">
          <div>
            <h2>Métodos de Pago</h2>
            <p>Métodos activos derivados de la configuración de Facturación Electrónica</p>
          </div>
          <div class="status-badge" [class.empty]="metodosPagoActivos().length === 0">
            {{ metodosPagoActivos().length }} activo(s)
          </div>
        </header>

        @if (cargandoMetodos()) {
          <div class="loading-state">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Cargando métodos de pago...</p>
          </div>
        } @else if (metodosPagoActivos().length === 0) {
          <div class="empty-state">
            <mat-icon>payment</mat-icon>
            <p>No hay métodos de pago configurados en Facturación Electrónica.</p>
            <a href="/workspace/facturacion/configuracion" class="help-link">
              <mat-icon>open_in_new</mat-icon>
              Ir a configurar métodos
            </a>
          </div>
        } @else {
          <div class="metodos-lista">
            @for (metodo of metodosPagoActivos(); track metodo) {
              <div class="metodo-item">
                <mat-icon>check_circle</mat-icon>
                <span class="metodo-label">{{ metodo }}</span>
              </div>
            }
          </div>
        }
      </article>

      <!-- TAB 2: Asignaciones Colaborador-Almacén -->
      <article class="surface-card panel">
        <header class="panel-header">
          <div>
            <h2>Asignaciones Colaborador-Almacén</h2>
            <p>Define qué almacenes puede operar cada colaborador</p>
          </div>
          <button
            mat-raised-button
            color="primary"
            [disabled]="guardando() || colaboradores().length === 0"
            (click)="guardarAsignaciones()"
          >
            <mat-icon>save</mat-icon>
            Guardar
          </button>
        </header>

        @if (cargandoAsignaciones()) {
          <div class="loading-state">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Cargando asignaciones...</p>
          </div>
        } @else if (colaboradores().length === 0) {
          <div class="empty-state">
            <mat-icon>people</mat-icon>
            <p>No hay colaboradores disponibles en esta empresa.</p>
          </div>
        } @else if (almacenesActivos().length === 0) {
          <div class="empty-state">
            <mat-icon>warehouse</mat-icon>
            <p>No hay almacenes disponibles. Crea almacenes primero.</p>
          </div>
        } @else {
          <div class="asignaciones-tabla">
            <!-- Encabezado -->
            <div class="asignaciones-header">
              <div class="col-colaborador">Colaborador</div>
              <div class="col-almacenes">Almacenes Asignados</div>
            </div>

            <!-- Filas -->
            @for (row of colaboradoresAlmacenesRows(); track row.colaborador.userId) {
              <div class="asignaciones-row">
                <div class="col-colaborador">
                  <span class="colaborador-nombre">{{ row.colaborador.fullName }}</span>
                  <span class="colaborador-email">{{ row.colaborador.email }}</span>
                </div>

                <div class="col-almacenes">
                  <div class="almacenes-chips">
                    @for (almacen of row.almacenesAsignados; track almacen.id) {
                      <mat-chip
                        removable
                        (removed)="toggleAlmacen(row.colaborador.userId, almacen.id ?? '')"
                      >
                        {{ almacen.nombre }}
                        <button matChipRemove>
                          <mat-icon>cancel</mat-icon>
                        </button>
                      </mat-chip>
                    }

                    @if (row.almacenesNoAsignados.length > 0) {
                      <mat-form-field appearance="fill" class="add-almacen-field">
                        <mat-label>+ Agregar</mat-label>
                        <mat-select (selectionChange)="toggleAlmacen(row.colaborador.userId, $event.value)">
                          <mat-option value="">-- Seleccionar --</mat-option>
                          @for (almacen of row.almacenesNoAsignados; track almacen.id) {
                            <mat-option [value]="almacen.id ?? ''">{{ almacen.nombre }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          @if (hayEnCambios()) {
            <div class="cambios-banner">
              <mat-icon>info</mat-icon>
              <span>Tienes cambios sin guardar.</span>
            </div>
          }
        }
      </article>

      <!-- TAB 3: Mi Almacén de Trabajo -->
      <article class="surface-card panel">
        <header class="panel-header">
          <div>
            <h2>Mi Almacén de Trabajo</h2>
            <p>Selecciona el almacén donde deseas trabajar ahora</p>
          </div>
          <div class="user-badge">{{ usuarioActualNombre() }}</div>
        </header>

        @if (cargandoAlmacenesUsuario()) {
          <div class="loading-state">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Cargando almacenes permitidos...</p>
          </div>
        } @else if (almacenesPermitidosUsuario().length === 0) {
          <div class="empty-state warning">
            <mat-icon>lock</mat-icon>
            <p>No tienes almacenes asignados.</p>
            <p class="small-text">Contacta a tu administrador para que te asigne almacenes.</p>
          </div>
        } @else {
          <div class="almacen-selector">
            <mat-form-field appearance="outline" class="almacen-select-field">
              <mat-label>Almacén de Trabajo</mat-label>
              <mat-select
                [value]="almacenActualUsuario()?.id ?? ''"
                (selectionChange)="seleccionarAlmacenUsuario($event.value)"
              >
                @for (almacen of almacenesPermitidosUsuario(); track almacen.id) {
                  <mat-option [value]="almacen.id ?? ''">
                    {{ almacen.nombre }}
                    @if (almacen.esPorDefecto) {
                      <span class="default-badge">(Por defecto)</span>
                    }
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (almacenActualUsuario()) {
              <div class="almacen-detalle">
                <div class="detalle-row">
                  <span class="label">Código:</span>
                  <strong>{{ almacenActualUsuario()!.codigo }}</strong>
                </div>
                <div class="detalle-row">
                  <span class="label">Dirección:</span>
                  <span>{{ almacenActualUsuario()!.direccion ?? 'No especificada' }}</span>
                </div>
              </div>
            }
          </div>
        }
      </article>

      <!-- TAB 4: Perfil de POS por Almacén -->
      <article class="surface-card panel">
        <header class="panel-header">
          <div>
            <h2>Perfil de POS por Almacén</h2>
            <p>Define el modo de operación y la experiencia del punto de venta para cada almacén</p>
          </div>
          @if (perfilEditable()) {
            <button
              mat-raised-button
              color="primary"
              [disabled]="guardandoPerfil()"
              (click)="guardarPerfil()"
            >
              <mat-icon>save</mat-icon>
              Guardar perfil
            </button>
          }
        </header>

        @if (almacenesActivos().length === 0) {
          <div class="empty-state">
            <mat-icon>warehouse</mat-icon>
            <p>No hay almacenes disponibles. Crea almacenes primero.</p>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="almacen-select-field">
            <mat-label>Almacén</mat-label>
            <mat-select
              [value]="perfilAlmacenId()"
              (selectionChange)="seleccionarAlmacenPerfil($event.value)"
            >
              @for (almacen of almacenesActivos(); track almacen.id) {
                <mat-option [value]="almacen.id ?? ''">{{ almacen.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (cargandoPerfil()) {
            <div class="loading-state">
              <mat-spinner diameter="40"></mat-spinner>
              <p>Cargando perfil...</p>
            </div>
          } @else if (perfilEditable(); as perfil) {
            <div class="perfil-grid">
              <mat-form-field appearance="outline">
                <mat-label>Modo de operación</mat-label>
                <mat-select [value]="perfil.modo" (selectionChange)="cambiarModo($event.value)">
                  <mat-option value="RETAIL">Retail (mostrador / escaneo)</mat-option>
                  <mat-option value="RESTAURANTE">Restaurante (cuentas divisibles)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Vista de catálogo por defecto</mat-label>
                <mat-select
                  [value]="perfil.vistaCatalogoPorDefecto"
                  (selectionChange)="actualizarPerfil({ vistaCatalogoPorDefecto: $event.value })"
                >
                  <mat-option value="TARJETAS">Tarjetas</mat-option>
                  <mat-option value="LISTA">Lista</mat-option>
                </mat-select>
              </mat-form-field>

              <div class="toggles-col">
                <mat-slide-toggle
                  [checked]="perfil.escaneoHabilitado"
                  (change)="actualizarPerfil({ escaneoHabilitado: $event.checked })"
                >
                  Habilitar barra de escaneo (lector físico)
                </mat-slide-toggle>

                <mat-slide-toggle
                  [checked]="perfil.autoAgregarAlEscanear"
                  [disabled]="!perfil.escaneoHabilitado"
                  (change)="actualizarPerfil({ autoAgregarAlEscanear: $event.checked })"
                >
                  Agregar automáticamente al escanear
                </mat-slide-toggle>

                <mat-slide-toggle
                  [checked]="perfil.mostrarImagenes"
                  (change)="actualizarPerfil({ mostrarImagenes: $event.checked })"
                >
                  Mostrar imágenes en el catálogo
                </mat-slide-toggle>

                <mat-slide-toggle
                  [checked]="perfil.permitirCuentasAbiertas"
                  (change)="actualizarPerfil({ permitirCuentasAbiertas: $event.checked })"
                >
                  Permitir cuentas abiertas (restaurante)
                </mat-slide-toggle>

                <mat-slide-toggle
                  [checked]="perfil.permitirDividirCuenta"
                  [disabled]="!perfil.permitirCuentasAbiertas"
                  (change)="actualizarPerfil({ permitirDividirCuenta: $event.checked })"
                >
                  Permitir cobrar una cuenta por partes
                </mat-slide-toggle>

                <mat-slide-toggle
                  [checked]="perfil.facturacionAutomatica"
                  (change)="actualizarPerfil({ facturacionAutomatica: $event.checked })"
                >
                  Facturar automáticamente al cobrar (SRI)
                </mat-slide-toggle>
                <p class="toggle-hint">Requiere firma y punto de emisión configurados para el almacén.</p>
              </div>

              @if (perfil.permitirCuentasAbiertas) {
                <mat-form-field appearance="outline">
                  <mat-label>Etiqueta de cuenta</mat-label>
                  <input
                    matInput
                    [value]="perfil.etiquetaCuenta"
                    maxlength="20"
                    (input)="actualizarPerfil({ etiquetaCuenta: asInput($event).value })"
                    placeholder="Mesa, Cuenta, Orden..."
                  />
                </mat-form-field>
              }
            </div>
          }
        }
      </article>
    </section>
  `,
  styles: [`
    .configuracion-container {
      display: grid;
      gap: 1.5rem;
      padding: 1rem;
    }

    .panel {
      padding: 1.5rem;
      border-radius: .9rem;
      display: grid;
      gap: 1rem;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .panel-header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .panel-header p {
      margin: .35rem 0 0;
      color: var(--muted-foreground);
      font-size: .9rem;
    }

    .status-badge, .user-badge {
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      padding: .5rem .75rem;
      border-radius: 999px;
      font-size: .85rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-badge.empty {
      background: color-mix(in srgb, var(--muted-foreground) 15%, transparent);
      color: var(--muted-foreground);
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .8rem;
      padding: 2rem;
      text-align: center;
      color: var(--muted-foreground);
      min-height: 200px;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: .5;
    }

    .empty-state.warning {
      background: color-mix(in srgb, #ff9800 8%, transparent);
    }

    .empty-state p {
      margin: 0;
    }

    .small-text {
      font-size: .85rem;
      margin-top: .5rem;
    }

    .help-link {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      margin-top: .8rem;
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    .help-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .metodos-lista {
      display: grid;
      gap: .75rem;
    }

    .metodo-item {
      display: flex;
      align-items: center;
      gap: .8rem;
      padding: .75rem;
      border: 1px solid color-mix(in srgb, var(--outline) 35%, transparent);
      border-radius: .7rem;
      background: color-mix(in srgb, var(--primary) 8%, transparent);
    }

    .metodo-item mat-icon {
      color: #4caf50;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .metodo-label {
      font-weight: 500;
    }

    .asignaciones-tabla {
      display: grid;
      gap: .5rem;
      border: 1px solid color-mix(in srgb, var(--outline) 30%, transparent);
      border-radius: .75rem;
      overflow: hidden;
    }

    .asignaciones-header {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 1rem;
      padding: .75rem;
      background: color-mix(in srgb, var(--tc-surface-container-low) 90%, transparent);
      font-weight: 600;
      font-size: .85rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      border-bottom: 1px solid color-mix(in srgb, var(--outline) 30%, transparent);
    }

    .asignaciones-row {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 1rem;
      padding: 1rem .75rem;
      border-bottom: 1px solid color-mix(in srgb, var(--outline) 15%, transparent);
      align-items: center;
    }

    .asignaciones-row:last-child {
      border-bottom: none;
    }

    .col-colaborador {
      display: flex;
      flex-direction: column;
      gap: .3rem;
    }

    .colaborador-nombre {
      font-weight: 600;
    }

    .colaborador-email {
      font-size: .85rem;
      color: var(--muted-foreground);
    }

    .col-almacenes {
      min-width: 0;
    }

    .almacenes-chips {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      align-items: center;
    }

    .add-almacen-field {
      max-width: 180px;
    }

    .cambios-banner {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .75rem;
      background: color-mix(in srgb, #ff9800 15%, transparent);
      border-left: 4px solid #ff9800;
      border-radius: .4rem;
      color: #e65100;
      font-size: .9rem;
    }

    .cambios-banner mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .almacen-selector {
      display: grid;
      gap: 1.5rem;
      max-width: 500px;
    }

    .almacen-select-field {
      width: 100%;
    }

    .almacen-detalle {
      display: grid;
      gap: .75rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
      border-radius: .7rem;
    }

    .detalle-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    .detalle-row .label {
      color: var(--muted-foreground);
      font-weight: 600;
    }

    .default-badge {
      font-size: .75rem;
      color: var(--muted-foreground);
      margin-left: .5rem;
    }

    .perfil-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem 1.5rem;
      align-items: start;
      max-width: 760px;
    }

    .toggles-col {
      grid-column: 1 / -1;
      display: grid;
      gap: .85rem;
      padding: 1rem;
      border: 1px solid color-mix(in srgb, var(--outline) 30%, transparent);
      border-radius: .7rem;
    }

    .toggle-hint {
      margin: -.4rem 0 0;
      font-size: .8rem;
      color: var(--muted-foreground);
    }

    @media (max-width: 900px) {
      .panel-header {
        flex-direction: column;
        align-items: stretch;
      }

      .asignaciones-header {
        grid-template-columns: 1fr;
      }

      .asignaciones-row {
        grid-template-columns: 1fr;
        gap: .75rem;
      }
    }
  `]
})
export class VentasConfiguracionComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly facturacionService = inject(FacturacionConfigService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly colaboradoresService = inject(VentasColaboradoresService);
  private readonly usuariosAlmacenesService = inject(VentasUsuariosAlmacenesService);
  private readonly almacenSesionService = inject(VentasAlmacenSesionService);
  private readonly posConfigService = inject(VentasPosConfigService);
  private readonly snackBar = inject(MatSnackBar);

  // Estado: Métodos de Pago
  protected readonly cargandoMetodos = signal(true);
  protected readonly metodosPago = signal<ConfiguracionFacturacion | null>(null);
  protected readonly metodosPagoActivos = computed(() => {
    const config = this.metodosPago();
    return config?.formaPagoActivos ?? [];
  });

  // Estado: Asignaciones
  protected readonly cargandoAsignaciones = signal(true);
  protected readonly colaboradores = signal<AppUserProfile[]>([]);
  protected readonly almacenesActivos = signal<Almacen[]>([]);
  protected readonly asignacionesActuales = signal<UsuariosAlmacenesConfig | null>(null);
  protected readonly asignacionesTrabajo = signal<UsuariosAlmacenesConfig | null>(null);
  protected readonly guardando = signal(false);

  // Estado: Almacén de Usuario
  protected readonly cargandoAlmacenesUsuario = signal(true);
  protected readonly almacenesPermitidosUsuario = signal<Almacen[]>([]);
  protected readonly almacenActualUsuario = computed(() => {
    return this.almacenSesionService.getAlmacenSeleccionado();
  });

  protected readonly usuarioActualNombre = computed(() => {
    return this.authService.currentUser()?.displayName ?? 'Usuario';
  });

  // Estado: Perfil de POS por almacén
  protected readonly perfilAlmacenId = signal<string>('');
  protected readonly perfilEditable = signal<PerfilPos | null>(null);
  protected readonly cargandoPerfil = signal(false);
  protected readonly guardandoPerfil = signal(false);

  protected readonly hayEnCambios = computed(() => {
    const actual = JSON.stringify(this.asignacionesActuales());
    const trabajo = JSON.stringify(this.asignacionesTrabajo());
    return actual !== trabajo;
  });
  protected readonly colaboradoresAlmacenesRows = computed<ColaboradorAlmacenesRow[]>(() => {
    const almacenes = this.almacenesActivos();
    const asignaciones = this.asignacionesTrabajo()?.asignaciones ?? {};

    return this.colaboradores().map((colaborador) => {
      const asignadosIds = new Set(asignaciones[colaborador.userId]?.almacenIds ?? []);
      return {
        colaborador,
        almacenesAsignados: almacenes.filter((almacen) => asignadosIds.has(almacen.id ?? '')),
        almacenesNoAsignados: almacenes.filter((almacen) => !asignadosIds.has(almacen.id ?? ''))
      };
    });
  });

  constructor() {
    this.cargarDatos();
  }

  /**
   * Carga todos los datos necesarios para la pantalla.
   */
  private cargarDatos(): void {
    // Cargar métodos de pago de Facturación
    this.facturacionService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.metodosPago.set(config);
          this.cargandoMetodos.set(false);
        },
        error: () => {
          this.cargandoMetodos.set(false);
          this.mostrarMensaje('No se pudieron cargar los métodos de pago.', 'error');
        }
      });

    // Cargar colaboradores
    this.colaboradoresService
      .getColaboradoresActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (colaboradores) => {
          this.colaboradores.set(colaboradores);
          this.cargandoAsignaciones.set(false);
        },
        error: () => {
          this.cargandoAsignaciones.set(false);
          this.mostrarMensaje('No se pudieron cargar los colaboradores.', 'error');
        }
      });

    // Cargar almacenes activos
    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (almacenes) => {
          this.almacenesActivos.set(almacenes);
        },
        error: () => {
          this.mostrarMensaje('No se pudieron cargar los almacenes.', 'error');
        }
      });

    // Cargar asignaciones actuales
    this.usuariosAlmacenesService
      .getAsignaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asignaciones) => {
          this.asignacionesActuales.set(asignaciones);
          this.asignacionesTrabajo.set(JSON.parse(JSON.stringify(asignaciones)));
        },
        error: () => {
          this.mostrarMensaje('No se pudieron cargar las asignaciones.', 'error');
        }
      });

    // Cargar almacenes permitidos del usuario actual de forma reactiva
    combineLatest([
      this.almacenesService.getAlmacenesActivos(),
      this.usuariosAlmacenesService.getAsignaciones()
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([almacenesActivos, asignaciones]) => {
          const usuarioId = this.authService.currentUser()?.uid;
          if (!usuarioId) {
            this.almacenesPermitidosUsuario.set([]);
            this.cargandoAlmacenesUsuario.set(false);
            return;
          }

          const asignacion = asignaciones?.asignaciones?.[usuarioId];
          if (!asignacion || asignacion.almacenIds.length === 0) {
            this.almacenesPermitidosUsuario.set([]);
            this.cargandoAlmacenesUsuario.set(false);
            return;
          }

          const permitidos = almacenesActivos.filter((a) => asignacion.almacenIds.includes(a.id ?? ''));
          this.almacenesPermitidosUsuario.set(permitidos);
          this.cargandoAlmacenesUsuario.set(false);
        },
        error: () => {
          this.cargandoAlmacenesUsuario.set(false);
          this.almacenesPermitidosUsuario.set([]);
        }
      });
  }

  /**
   * Determina si un almacén está asignado a un colaborador.
   */
  /**
   * Retorna los almacenes no asignados a un colaborador (para el dropdown de agregar).
   */
  /**
   * Toggle de asignación de un almacén a un colaborador.
   */
  protected toggleAlmacen(usuarioId: string, almacenId: string): void {
    const config = this.asignacionesTrabajo();
    if (!config) {
      return;
    }

    if (!config.asignaciones[usuarioId]) {
      config.asignaciones[usuarioId] = {
        usuarioId,
        almacenIds: [],
        asignadoEn: Date.now(),
        asignadoPor: this.authService.currentUser()?.uid ?? 'sistema'
      };
    }

    const asignacion = config.asignaciones[usuarioId];
    const index = asignacion.almacenIds.indexOf(almacenId);

    if (index >= 0) {
      asignacion.almacenIds.splice(index, 1);

      if (asignacion.almacenIds.length === 0) {
        delete config.asignaciones[usuarioId];
      }
    } else {
      asignacion.almacenIds.push(almacenId);
    }

    this.asignacionesTrabajo.set({ ...config });
  }

  /**
   * Guarda las asignaciones modificadas en Firebase.
   */
  protected async guardarAsignaciones(): Promise<void> {
    const config = this.asignacionesTrabajo();
    if (!config) {
      return;
    }

    this.guardando.set(true);
    try {
      await this.usuariosAlmacenesService.guardarAsignaciones(config);
      this.asignacionesActuales.set(JSON.parse(JSON.stringify(config)));
      this.mostrarMensaje('Asignaciones guardadas correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar asignaciones:', error);
      this.mostrarMensaje('Error al guardar asignaciones.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Selecciona el almacén de trabajo del usuario actual.
   */
  protected seleccionarAlmacenUsuario(almacenId: string): void {
    if (!almacenId) {
      return;
    }

    this.almacenSesionService.seleccionarAlmacen(almacenId);
    this.mostrarMensaje('Almacén seleccionado.', 'success');
  }

  /** Carga el perfil de POS del almacén seleccionado. */
  protected async seleccionarAlmacenPerfil(almacenId: string): Promise<void> {
    if (!almacenId) {
      this.perfilAlmacenId.set('');
      this.perfilEditable.set(null);
      return;
    }

    this.perfilAlmacenId.set(almacenId);
    this.cargandoPerfil.set(true);
    try {
      const perfil = await this.posConfigService.getPerfilOnce(almacenId);
      this.perfilEditable.set(perfil);
    } catch (error) {
      console.error('Error al cargar el perfil de POS:', error);
      this.mostrarMensaje('No se pudo cargar el perfil de POS.', 'error');
      this.perfilEditable.set(null);
    } finally {
      this.cargandoPerfil.set(false);
    }
  }

  /** Aplica un cambio parcial al perfil en edición. */
  protected actualizarPerfil(patch: Partial<PerfilPos>): void {
    const perfil = this.perfilEditable();
    if (!perfil) {
      return;
    }
    this.perfilEditable.set({ ...perfil, ...patch });
  }

  /** Cambiar el modo re-deriva defaults sensatos para ese modo, conservando el almacén. */
  protected cambiarModo(modo: ModoPos): void {
    const almacenId = this.perfilAlmacenId();
    if (!almacenId) {
      return;
    }
    this.perfilEditable.set(this.posConfigService.getDefaultPerfil(almacenId, modo));
  }

  protected async guardarPerfil(): Promise<void> {
    const perfil = this.perfilEditable();
    if (!perfil) {
      return;
    }

    this.guardandoPerfil.set(true);
    try {
      await this.posConfigService.guardarPerfil(perfil);
      this.mostrarMensaje('Perfil de POS guardado correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar el perfil de POS:', error);
      this.mostrarMensaje('Error al guardar el perfil de POS.', 'error');
    } finally {
      this.guardandoPerfil.set(false);
    }
  }

  /** Helper de plantilla para leer el value de un evento de input. */
  protected asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }

  /**
   * Muestra un mensaje usando MatSnackBar.
   */
  private mostrarMensaje(mensaje: string, tipo: 'success' | 'error' | 'info'): void {
    const icono = {
      success: 'check_circle',
      error: 'error',
      info: 'info'
    }[tipo];

    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`snackbar-${tipo}`]
    });
  }
}

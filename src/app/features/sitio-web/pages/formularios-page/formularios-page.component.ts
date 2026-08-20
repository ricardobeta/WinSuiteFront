import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CampoClienteDestinoFormulario,
  CampoFormulario,
  FormularioDef,
  TipoIdentificacionClienteFormulario,
} from '@winsuite/bloques';
import { FormulariosService } from '../../services/formularios.service';
import { DialogoSitioComponent } from '../../components/dialogo-sitio/dialogo-sitio.component';
import {
  ConfiguracionClientesService,
  normalizarConfiguracionClientes,
} from '../../../../core/services/configuracion-clientes.service';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';

interface OpcionDestinoCliente {
  valor: CampoClienteDestinoFormulario;
  etiqueta: string;
}

/**
 * Formularios prehechos de la empresa: lista + editor de campos. El widget 'formulario'
 * del editor selecciona uno de estos; cada formulario tiene su pagina de Respuestas.
 */
@Component({
  selector: 'app-formularios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, MatSlideToggleModule],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <div>
          <h2>Formularios</h2>
          <p class="nota">
            Se comparten entre todos tus sitios: crea "Contacto" una vez y usalo en tu ecommerce y
            en tus landings con el bloque <b>Formulario</b>.
          </p>
        </div>
        <button mat-flat-button color="primary" (click)="crear()">
          <mat-icon>add</mat-icon> Nuevo formulario
        </button>
      </header>

      <div class="cuerpo">
        <aside class="lista">
          @for (formulario of formularios(); track formulario.formularioId) {
            <button
              type="button"
              class="item"
              [class.activo]="formulario.formularioId === seleccionId()"
              (click)="seleccionId.set(formulario.formularioId)"
            >
              <mat-icon>list_alt</mat-icon>
              <span class="nombre">{{ formulario.nombre }}</span>
              <small>{{ formulario.campos.length }} campos</small>
            </button>
          } @empty {
            <p class="vacio">Aun no tienes formularios. Crea el primero.</p>
          }
        </aside>

        @if (borrador(); as f) {
          <section class="editor">
            <div class="fila-titulo">
              <label class="crece">
                Nombre del formulario
                <input [(ngModel)]="f.nombre" maxlength="80" (ngModelChange)="marcarSucio()" />
              </label>
              <a mat-stroked-button [routerLink]="[f.formularioId, 'respuestas']">
                <mat-icon>inbox</mat-icon> Ver respuestas
              </a>
            </div>

            <h3>Campos</h3>
            @for (campo of f.campos; track campo.id; let i = $index) {
              <div class="campo-item">
                <div class="orden">
                  <button
                    type="button"
                    [attr.aria-label]="'Subir campo ' + (campo.etiqueta || (i + 1))"
                    [disabled]="i === 0"
                    (click)="moverCampo(i, -1)"
                  >
                    <mat-icon>keyboard_arrow_up</mat-icon>
                  </button>
                  <button
                    type="button"
                    [attr.aria-label]="'Bajar campo ' + (campo.etiqueta || (i + 1))"
                    [disabled]="i === f.campos.length - 1"
                    (click)="moverCampo(i, 1)"
                  >
                    <mat-icon>keyboard_arrow_down</mat-icon>
                  </button>
                </div>
                <div class="crece campos-grid">
                  <input
                    placeholder="Etiqueta"
                    [attr.aria-label]="'Etiqueta del campo ' + (i + 1)"
                    [(ngModel)]="campo.etiqueta"
                    maxlength="200"
                    (ngModelChange)="marcarSucio()"
                  />
                  <select
                    [attr.aria-label]="'Tipo del campo ' + (campo.etiqueta || (i + 1))"
                    [ngModel]="campo.tipo"
                    (ngModelChange)="cambiarTipo(i, $event)"
                  >
                    <option value="texto">Texto</option>
                    <option value="email">Email</option>
                    <option value="telefono">Telefono</option>
                    <option value="textarea">Parrafo</option>
                    <option value="seleccion">Seleccion</option>
                  </select>
                  @if (campo.tipo === 'seleccion') {
                    <input
                      class="ancho-completo"
                      placeholder="Opciones separadas por coma"
                      [attr.aria-label]="'Opciones del campo ' + (campo.etiqueta || (i + 1))"
                      [ngModel]="opcionesTexto(campo)"
                      (ngModelChange)="setOpciones(i, $event)"
                    />
                  }
                  <label class="check">
                    <input
                      type="checkbox"
                      [(ngModel)]="campo.requerido"
                      (ngModelChange)="marcarSucio()"
                    />
                    Obligatorio
                  </label>
                </div>
                <button
                  type="button"
                  class="quitar"
                  title="Eliminar campo"
                  [attr.aria-label]="'Eliminar campo ' + (campo.etiqueta || (i + 1))"
                  (click)="quitarCampo(i)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
            <button mat-stroked-button (click)="agregarCampo()">
              <mat-icon>add</mat-icon> Agregar campo
            </button>

            <label>
              Mensaje al enviar
              <input [(ngModel)]="f.mensajeExito" maxlength="1000" (ngModelChange)="marcarSucio()" />
            </label>

            <section class="integracion-clientes" [class.integracion-activa]="integracionHabilitada(f)">
              <div class="integracion-cabecera">
                <span class="integracion-icono" aria-hidden="true"><mat-icon>person_add_alt</mat-icon></span>
                <div class="integracion-copy">
                  <h3>Crear clientes con las respuestas</h3>
                  <p>Actívalo solo cuando este formulario deba alimentar el módulo de Clientes.</p>
                </div>
                <mat-slide-toggle
                  [checked]="integracionHabilitada(f)"
                  (change)="cambiarIntegracion($event.checked)"
                  aria-label="Crear clientes automáticamente con este formulario"
                >{{ integracionHabilitada(f) ? 'Activado' : 'Desactivado' }}</mat-slide-toggle>
              </div>

              @if (integracionHabilitada(f)) {
                <div class="etiqueta-automatica">
                  <mat-icon>sell</mat-icon>
                  <span>Etiqueta automática</span>
                  <strong>{{ f.nombre }}</strong>
                </div>

                <div class="mapeo-intro">
                  <div>
                    <h4>Vincula los campos</h4>
                    <p>Elige qué dato de Cliente recibirá cada respuesta. Los destinos incompatibles no aparecen.</p>
                  </div>
                  <span>{{ cantidadMapeos(f) }} vinculados</span>
                </div>

                <div class="mapeos" role="group" aria-label="Mapeo de campos del formulario a clientes">
                  @for (campo of f.campos; track campo.id) {
                    <div class="mapeo-fila">
                      <div class="campo-origen">
                        <strong>{{ campo.etiqueta }}</strong>
                        <span>{{ nombreTipoCampo(campo.tipo) }}{{ campo.requerido ? ' · obligatorio' : '' }}</span>
                      </div>
                      <mat-icon class="mapeo-flecha" aria-hidden="true">arrow_forward</mat-icon>
                      <label>
                        <span class="visualmente-oculto">Destino para {{ campo.etiqueta }}</span>
                        <select
                          [ngModel]="destinoMapeado(f, campo.id)"
                          (ngModelChange)="mapearCampo(campo.id, $event)"
                        >
                          <option value="">No vincular</option>
                          @for (destino of destinosDisponibles(f, campo); track destino.valor) {
                            <option [value]="destino.valor">{{ destino.etiqueta }}</option>
                          }
                        </select>
                      </label>
                    </div>
                  }
                </div>

                @if (tieneIdentificacionMapeada(f)) {
                  <label class="tipo-identificacion">
                    Tipo de identificación de estas respuestas
                    <select
                      [ngModel]="f.integracionClientes?.tipoIdentificacion ?? 'cedula'"
                      (ngModelChange)="cambiarTipoIdentificacion($event)"
                    >
                      <option value="cedula">Cédula</option>
                      <option value="ruc">RUC</option>
                      <option value="pasaporte">Pasaporte</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                }

                @if (erroresIntegracion(f).length) {
                  <div class="integracion-errores" role="alert">
                    <mat-icon>error_outline</mat-icon>
                    <div>
                      <strong>Completa la vinculación antes de guardar</strong>
                      <ul>@for (error of erroresIntegracion(f); track error) { <li>{{ error }}</li> }</ul>
                    </div>
                  </div>
                }

                <p class="aviso-publicacion"><mat-icon>publish</mat-icon>Después de guardar, vuelve a publicar los sitios que usan este formulario.</p>
              } @else {
                <p class="solo-respuestas"><mat-icon>inbox</mat-icon>Este formulario solo guardará respuestas. No creará clientes ni etiquetas.</p>
              }
            </section>

            <div class="acciones">
              <button mat-flat-button color="primary" [disabled]="!sucio() || erroresIntegracion(f).length > 0" (click)="guardar()">
                {{ sucio() ? 'Guardar cambios' : 'Guardado' }}
              </button>
              <button mat-button class="peligro" (click)="eliminar()">
                <mat-icon>delete</mat-icon> Eliminar formulario
              </button>
            </div>
          </section>
        } @else {
          <section class="editor sin-seleccion">
            <mat-icon>touch_app</mat-icon>
            <p>Selecciona un formulario de la lista o crea uno nuevo.</p>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 1000px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    h2 {
      margin: 0;
    }
    .nota {
      margin: 4px 0 0;
      opacity: 0.65;
      font-size: 0.88rem;
      max-width: 520px;
    }
    .cuerpo {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 16px;
      align-items: start;
    }
    .lista {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    .item mat-icon {
      color: var(--primary);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .item.activo {
      border-color: var(--primary);
      background: var(--tc-primary-container);
      color: var(--tc-on-primary-container);
    }
    .item .nombre {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .item small {
      opacity: 0.55;
    }
    .vacio {
      opacity: 0.6;
      font-size: 0.88rem;
    }
    .editor {
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      border: 1px solid var(--tc-ghost-border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .editor.sin-seleccion {
      align-items: center;
      padding: 48px;
      opacity: 0.55;
    }
    .fila-titulo {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .crece {
      flex: 1;
      min-width: 200px;
    }
    h3 {
      margin: 8px 0 0;
      font-size: 0.95rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      font-weight: 400;
    }
    input:not([type='checkbox']),
    select {
      font: inherit;
      font-weight: 400;
      padding: 8px 10px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .campo-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px;
      padding: 10px;
    }
    .orden {
      display: flex;
      flex-direction: column;
    }
    .orden button {
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      opacity: 0.6;
      line-height: 0;
    }
    .orden button[disabled] {
      opacity: 0.2;
      cursor: default;
    }
    .campos-grid {
      display: grid;
      grid-template-columns: 1fr 150px;
      gap: 8px;
      align-items: center;
    }
    .ancho-completo {
      grid-column: 1 / -1;
    }
    .quitar {
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.55;
      padding: 4px;
    }
    .quitar:hover {
      color: var(--tc-error);
      opacity: 1;
    }
    .acciones {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 8px;
    }
    .peligro {
      color: var(--tc-error);
    }
    .integracion-clientes {
      margin-top: 10px;
      padding: 18px;
      border-radius: var(--tc-radius-lg, 16px);
      background: var(--tc-surface-container-low);
      display: grid;
      gap: 16px;
    }
    .integracion-clientes.integracion-activa {
      background: color-mix(in srgb, var(--tc-primary-container) 38%, var(--tc-surface-container-low));
    }
    .integracion-cabecera {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .integracion-icono {
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-primary);
    }
    .integracion-copy { flex: 1; min-width: 0; }
    .integracion-copy h3, .mapeo-intro h4 { margin: 0; }
    .integracion-copy p, .mapeo-intro p {
      margin: 4px 0 0;
      color: var(--tc-on-surface-variant);
      font-weight: 400;
      line-height: 1.45;
    }
    .etiqueta-automatica, .aviso-publicacion, .solo-respuestas {
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--tc-on-surface-variant);
    }
    .etiqueta-automatica {
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--tc-surface-container-lowest);
    }
    .etiqueta-automatica mat-icon, .aviso-publicacion mat-icon, .solo-respuestas mat-icon { color: var(--tc-primary); }
    .etiqueta-automatica strong { color: var(--tc-on-surface); }
    .mapeo-intro { display: flex; justify-content: space-between; gap: 16px; align-items: end; }
    .mapeo-intro > span {
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--tc-primary-container);
      color: var(--tc-on-primary-container);
      font-size: .78rem;
      font-weight: 700;
    }
    .mapeos { display: grid; gap: 8px; }
    .mapeo-fila {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) 24px minmax(190px, 1fr);
      align-items: center;
      gap: 12px;
      min-height: 60px;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--tc-surface-container-lowest);
    }
    .campo-origen { display: grid; gap: 2px; min-width: 0; }
    .campo-origen strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .campo-origen span { color: var(--tc-on-surface-variant); font-size: .78rem; }
    .mapeo-flecha { color: var(--tc-primary); opacity: .72; }
    .mapeo-fila label { min-width: 0; }
    .mapeo-fila select, .tipo-identificacion select { min-height: 44px; width: 100%; }
    .tipo-identificacion { max-width: 360px; }
    .integracion-errores {
      display: flex;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      background: var(--tc-error-container);
      color: var(--tc-on-error-container);
    }
    .integracion-errores ul { margin: 4px 0 0; padding-left: 20px; font-weight: 400; }
    .visualmente-oculto {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @media (max-width: 760px) {
      .cuerpo {
        grid-template-columns: 1fr;
      }
      .integracion-cabecera { align-items: flex-start; flex-wrap: wrap; }
      .integracion-cabecera mat-slide-toggle { margin-left: 56px; }
      .mapeo-fila { grid-template-columns: 1fr; gap: 6px; }
      .mapeo-flecha { transform: rotate(90deg); }
      .mapeo-intro { align-items: flex-start; }
    }
  `,
})
export class FormulariosPageComponent {
  private readonly formulariosService = inject(FormulariosService);
  private readonly configuracionClientesService = inject(ConfiguracionClientesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly formularios = toSignal(this.formulariosService.getFormularios(), { initialValue: [] });
  readonly configuracionClientes = toSignal(this.configuracionClientesService.getConfiguracion(), {
    initialValue: normalizarConfiguracionClientes(null),
  });
  readonly seleccionId = signal<string | null>(null);
  readonly sucio = signal(false);

  /** Copia editable del formulario seleccionado (se guarda con el boton). */
  readonly borrador = computed<FormularioDef | null>(() => {
    const id = this.seleccionId();
    const original = this.formularios().find((f) => f.formularioId === id);
    return original ? structuredClone(original) : null;
  });

  marcarSucio(): void {
    this.sucio.set(true);
  }

  async crear(): Promise<void> {
    const nombre = await firstValueFrom(this.dialog.open(DialogoSitioComponent, {
      data: { titulo: 'Nuevo formulario', etiqueta: 'Nombre del formulario', valor: 'Contacto', requerido: true, maxLength: 80 },
      width: '460px',
    }).afterClosed());
    if (!nombre?.trim()) return;
    const formulario = this.formulariosService.crearFormulario(nombre.trim());
    void this.formulariosService
      .guardar(formulario)
      .then(() => this.seleccionId.set(formulario.formularioId))
      .catch(() => this.snackBar.open('No se pudo crear el formulario', 'OK', { duration: 4000 }));
  }

  agregarCampo(): void {
    const f = this.borradorActual();
    if (!f) return;
    f.campos.push({
      id: `c-${Date.now().toString(36)}`,
      tipo: 'texto',
      etiqueta: 'Nuevo campo',
      requerido: false,
    });
    void this.guardarBorrador(f);
  }

  quitarCampo(indice: number): void {
    const f = this.borradorActual();
    if (!f || f.campos.length <= 1) return;
    const [eliminado] = f.campos.splice(indice, 1);
    if (f.integracionClientes) {
      f.integracionClientes.mapeos = f.integracionClientes.mapeos.filter(
        (mapeo) => mapeo.campoFormularioId !== eliminado.id,
      );
    }
    void this.guardarBorrador(f);
  }

  moverCampo(indice: number, delta: number): void {
    const f = this.borradorActual();
    if (!f) return;
    const [campo] = f.campos.splice(indice, 1);
    f.campos.splice(indice + delta, 0, campo);
    void this.guardarBorrador(f);
  }

  cambiarTipo(indice: number, tipo: CampoFormulario['tipo']): void {
    const f = this.borradorActual();
    if (!f) return;
    const actual = f.campos[indice];
    f.campos[indice] =
      tipo === 'seleccion'
        ? { id: actual.id, tipo, etiqueta: actual.etiqueta, requerido: actual.requerido, opciones: ['Opcion 1', 'Opcion 2'] }
        : { id: actual.id, tipo, etiqueta: actual.etiqueta, requerido: actual.requerido };
    if (f.integracionClientes) {
      f.integracionClientes.mapeos = f.integracionClientes.mapeos.filter(
        (mapeo) => mapeo.campoFormularioId !== actual.id || this.esCompatible(f.campos[indice], mapeo.campoCliente),
      );
    }
    void this.guardarBorrador(f);
  }

  setOpciones(indice: number, texto: string): void {
    const f = this.borradorActual();
    if (!f) return;
    const campo = f.campos[indice];
    if (campo.tipo !== 'seleccion') return;
    campo.opciones = texto
      .split(',')
      .map((opcion) => opcion.trim())
      .filter(Boolean);
    this.marcarSucio();
  }

  opcionesTexto(campo: CampoFormulario): string {
    return campo.tipo === 'seleccion' ? campo.opciones.join(', ') : '';
  }

  integracionHabilitada(formulario: FormularioDef): boolean {
    return formulario.integracionClientes?.habilitada === true;
  }

  cambiarIntegracion(habilitada: boolean): void {
    const formulario = this.borradorActual();
    if (!formulario) return;
    if (!formulario.integracionClientes) {
      formulario.integracionClientes = {
        habilitada,
        etiquetaId: `form-${formulario.formularioId}`,
        tipoIdentificacion: 'cedula',
        mapeos: [],
      };
    } else {
      formulario.integracionClientes.habilitada = habilitada;
    }
    if (habilitada && formulario.integracionClientes.mapeos.length === 0) {
      this.aplicarSugerencias(formulario);
    }
    this.marcarSucio();
  }

  destinoMapeado(formulario: FormularioDef, campoId: string): string {
    return formulario.integracionClientes?.mapeos.find((mapeo) => mapeo.campoFormularioId === campoId)?.campoCliente ?? '';
  }

  mapearCampo(campoId: string, destino: string): void {
    const formulario = this.borradorActual();
    const integracion = formulario?.integracionClientes;
    if (!formulario || !integracion) return;
    integracion.mapeos = integracion.mapeos.filter(
      (mapeo) => mapeo.campoFormularioId !== campoId && mapeo.campoCliente !== destino,
    );
    if (destino) {
      integracion.mapeos.push({
        campoFormularioId: campoId,
        campoCliente: destino as CampoClienteDestinoFormulario,
      });
      if (['nombreCompleto', 'email', 'telefono'].includes(destino)) {
        const campo = formulario.campos.find((item) => item.id === campoId);
        if (campo) campo.requerido = true;
      }
    }
    this.marcarSucio();
  }

  cambiarTipoIdentificacion(tipo: TipoIdentificacionClienteFormulario): void {
    const integracion = this.borradorActual()?.integracionClientes;
    if (!integracion) return;
    integracion.tipoIdentificacion = tipo;
    this.marcarSucio();
  }

  cantidadMapeos(formulario: FormularioDef): number {
    return formulario.integracionClientes?.mapeos.length ?? 0;
  }

  tieneIdentificacionMapeada(formulario: FormularioDef): boolean {
    return formulario.integracionClientes?.mapeos.some((mapeo) => mapeo.campoCliente === 'identificacion') ?? false;
  }

  nombreTipoCampo(tipo: CampoFormulario['tipo']): string {
    return ({ texto: 'Texto', email: 'Correo', telefono: 'Teléfono', textarea: 'Párrafo', seleccion: 'Selección' })[tipo];
  }

  destinosDisponibles(formulario: FormularioDef, campo: CampoFormulario): OpcionDestinoCliente[] {
    const actual = this.destinoMapeado(formulario, campo.id);
    const ocupados = new Set(
      (formulario.integracionClientes?.mapeos ?? [])
        .filter((mapeo) => mapeo.campoFormularioId !== campo.id)
        .map((mapeo) => mapeo.campoCliente),
    );
    const base = ([
      { valor: 'nombreCompleto', etiqueta: 'Nombre completo' },
      { valor: 'email', etiqueta: 'Correo electrónico' },
      { valor: 'telefono', etiqueta: 'Teléfono' },
      { valor: 'direccion', etiqueta: 'Dirección' },
      { valor: 'identificacion', etiqueta: 'Identificación' },
    ] satisfies OpcionDestinoCliente[]).filter((opcion) => this.esCompatible(campo, opcion.valor));
    const personalizados = this.configuracionClientes().camposPersonalizados
      .filter((custom) => custom.activo !== false && this.esCompatibleCustom(campo, custom))
      .map((custom) => ({
        valor: `custom:${custom.idCampo}` as CampoClienteDestinoFormulario,
        etiqueta: `${custom.nombreMostrar} · personalizado`,
      }));
    return [...base, ...personalizados].filter((opcion) => opcion.valor === actual || !ocupados.has(opcion.valor));
  }

  erroresIntegracion(formulario: FormularioDef): string[] {
    const integracion = formulario.integracionClientes;
    if (!integracion?.habilitada) return [];
    const errores: string[] = [];
    const mapeoNombre = integracion.mapeos.find((mapeo) => mapeo.campoCliente === 'nombreCompleto');
    const mapeoContacto = integracion.mapeos.find((mapeo) => ['email', 'telefono'].includes(mapeo.campoCliente));
    if (!mapeoNombre) errores.push('Vincula un campo con Nombre completo.');
    if (!mapeoContacto) errores.push('Vincula un correo o teléfono.');
    for (const mapeo of integracion.mapeos) {
      const campo = formulario.campos.find((item) => item.id === mapeo.campoFormularioId);
      if (!campo) errores.push('Elimina una vinculación cuyo campo ya no existe.');
      else if (!this.esCompatible(campo, mapeo.campoCliente)) errores.push(`Revisa la vinculación de “${campo.etiqueta}”.`);
    }
    if (mapeoNombre && !formulario.campos.find((item) => item.id === mapeoNombre.campoFormularioId)?.requerido) {
      errores.push('El campo usado como nombre debe ser obligatorio.');
    }
    if (mapeoContacto && !formulario.campos.find((item) => item.id === mapeoContacto.campoFormularioId)?.requerido) {
      errores.push('El correo o teléfono vinculado debe ser obligatorio.');
    }
    return [...new Set(errores)];
  }

  guardar(): void {
    const f = this.borradorActual();
    if (f) void this.guardarBorrador(f);
  }

  async eliminar(): Promise<void> {
    const f = this.borrador();
    if (!f) return;
    const confirmado = await firstValueFrom(this.dialog.open(DialogoSitioComponent, {
      data: { titulo: 'Eliminar formulario', mensaje: `¿Eliminar el formulario "${f.nombre}"? Los bloques que lo usen quedarán vacíos.`, confirmar: 'Eliminar', peligro: true },
      width: '500px',
    }).afterClosed());
    if (!confirmado) return;
    void this.formulariosService
      .eliminar(f.formularioId)
      .then(() => this.seleccionId.set(null))
      .catch(() => this.snackBar.open('No se pudo eliminar', 'OK', { duration: 4000 }));
  }

  /**
   * El template edita la copia `borrador()` por ngModel (mutable); este metodo la captura
   * para persistirla. computed() devuelve la MISMA instancia mientras no cambie la fuente.
   */
  private borradorActual(): FormularioDef | null {
    return this.borrador();
  }

  private aplicarSugerencias(formulario: FormularioDef): void {
    const integracion = formulario.integracionClientes;
    if (!integracion) return;
    const usados = new Set<string>();
    for (const campo of formulario.campos) {
      const etiqueta = this.normalizarTexto(campo.etiqueta);
      let destino: CampoClienteDestinoFormulario | null = null;
      if (campo.tipo === 'email') destino = 'email';
      else if (campo.tipo === 'telefono') destino = 'telefono';
      else if (campo.tipo === 'texto' && etiqueta.includes('nombre')) destino = 'nombreCompleto';
      else if (campo.tipo === 'texto' && /(cedula|identificacion|documento|ruc)/.test(etiqueta)) destino = 'identificacion';
      else if (['texto', 'textarea'].includes(campo.tipo) && /(direccion|domicilio)/.test(etiqueta)) destino = 'direccion';
      if (!destino || usados.has(destino) || !this.esCompatible(campo, destino)) continue;
      usados.add(destino);
      integracion.mapeos.push({ campoFormularioId: campo.id, campoCliente: destino });
      if (['nombreCompleto', 'email', 'telefono'].includes(destino)) campo.requerido = true;
    }
  }

  private esCompatible(campo: CampoFormulario, destino: CampoClienteDestinoFormulario): boolean {
    if (destino.startsWith('custom:')) {
      const custom = this.configuracionClientes().camposPersonalizados.find(
        (item) => item.idCampo === destino.slice(7),
      );
      return !!custom && this.esCompatibleCustom(campo, custom);
    }
    switch (destino) {
      case 'nombreCompleto': return campo.tipo === 'texto';
      case 'email': return campo.tipo === 'email';
      case 'telefono': return campo.tipo === 'telefono';
      case 'direccion': return campo.tipo === 'texto' || campo.tipo === 'textarea';
      case 'identificacion': return campo.tipo === 'texto';
    }
    return false;
  }

  private esCompatibleCustom(campo: CampoFormulario, custom: CampoPersonalizado): boolean {
    if (['texto', 'textarea'].includes(custom.tipo)) return true;
    if (!['lista_simple', 'catalogo'].includes(custom.tipo) || campo.tipo !== 'seleccion') return false;
    const opcionesDestino = new Set(
      (custom.opciones ?? []).flatMap((opcion) => [this.normalizarTexto(opcion.clave), this.normalizarTexto(opcion.valor)]),
    );
    return campo.opciones.length > 0 && campo.opciones.every((opcion) => opcionesDestino.has(this.normalizarTexto(opcion)));
  }

  private normalizarTexto(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  }

  private async guardarBorrador(formulario: FormularioDef): Promise<void> {
    try {
      const errores = this.erroresIntegracion(formulario);
      if (errores.length) throw new Error(errores[0]);
      await this.formulariosService.guardar(formulario);
      this.sucio.set(false);
    } catch (error) {
      const mensaje = error instanceof Error
        ? error.message
        : 'No se pudo guardar (revisa que todos los campos tengan etiqueta)';
      this.snackBar.open(mensaje, 'OK', {
        duration: 5000,
      });
    }
  }
}

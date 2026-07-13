import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { CampoFormulario, FormularioDef } from '@winsuite/bloques';
import { FormulariosService } from '../../services/formularios.service';
import { DialogoSitioComponent } from '../../components/dialogo-sitio/dialogo-sitio.component';

/**
 * Formularios prehechos de la empresa: lista + editor de campos. El widget 'formulario'
 * del editor selecciona uno de estos; cada formulario tiene su pagina de Respuestas.
 */
@Component({
  selector: 'app-formularios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
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
                  <button type="button" [disabled]="i === 0" (click)="moverCampo(i, -1)">
                    <mat-icon>keyboard_arrow_up</mat-icon>
                  </button>
                  <button
                    type="button"
                    [disabled]="i === f.campos.length - 1"
                    (click)="moverCampo(i, 1)"
                  >
                    <mat-icon>keyboard_arrow_down</mat-icon>
                  </button>
                </div>
                <div class="crece campos-grid">
                  <input
                    placeholder="Etiqueta"
                    [(ngModel)]="campo.etiqueta"
                    maxlength="200"
                    (ngModelChange)="marcarSucio()"
                  />
                  <select
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

            <div class="acciones">
              <button mat-flat-button color="primary" [disabled]="!sucio()" (click)="guardar()">
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
    @media (max-width: 760px) {
      .cuerpo {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FormulariosPageComponent {
  private readonly formulariosService = inject(FormulariosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly formularios = toSignal(this.formulariosService.getFormularios(), { initialValue: [] });
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
    f.campos.splice(indice, 1);
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

  private async guardarBorrador(formulario: FormularioDef): Promise<void> {
    try {
      await this.formulariosService.guardar(formulario);
      this.sucio.set(false);
    } catch {
      this.snackBar.open('No se pudo guardar (revisa que todos los campos tengan etiqueta)', 'OK', {
        duration: 5000,
      });
    }
  }
}

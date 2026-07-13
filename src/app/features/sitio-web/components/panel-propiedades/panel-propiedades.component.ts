import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  Bloque,
  CATALOGO_PRODUCTOS,
  FondoGradiente,
  OverridesResponsive,
  PaginaDoc,
  Viewport,
} from '@winsuite/bloques';
import { CategoriasService } from '../../../inventario/services/categorias.service';
import { FormulariosService } from '../../services/formularios.service';
import { SelectorImagenComponent } from '../selector-imagen/selector-imagen.component';

/**
 * Panel de propiedades del bloque seleccionado. Emite una copia nueva del bloque en cada
 * cambio (inmutable: el editor registra el snapshot en el historial y persiste con debounce).
 */
@Component({
  selector: 'app-panel-propiedades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SlicePipe, MatIconModule, MatExpansionModule, SelectorImagenComponent],
  template: `
    <div class="panel">
      <h3>Propiedades · {{ bloque().tipo }}</h3>

      <mat-accordion multi displayMode="flat">
      <mat-expansion-panel expanded>
        <mat-expansion-panel-header>
          <mat-panel-title><mat-icon>edit_note</mat-icon> Contenido</mat-panel-title>
        </mat-expansion-panel-header>

      @if (variantesDelBloque().length > 1) {
        <div class="campo">
          <span>Diseño</span>
          <div class="variantes">
            @for (opcion of variantesDelBloque(); track opcion.id) {
              <button
                type="button"
                class="variante-btn"
                [class.activa]="varianteActual() === opcion.id"
                [title]="opcion.nombre"
                (click)="patch({ variante: opcion.id })"
              >
                <mat-icon>{{ opcion.icono }}</mat-icon>
                <small>{{ opcion.nombre }}</small>
              </button>
            }
          </div>
        </div>
        @if (b.tipo === 'hero' && varianteActual() === 'partido') {
          <label>
            Lado de la imagen
            <select
              [ngModel]="b.imagenLado ?? 'derecha'"
              (ngModelChange)="patch({ imagenLado: $event })"
            >
              <option value="derecha">Derecha</option>
              <option value="izquierda">Izquierda</option>
            </select>
          </label>
        }
      }

      @switch (bloque().tipo) {
        @case ('hero') {
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          <label>
            Subtitulo
            <textarea
              rows="2"
              [ngModel]="b.subtitulo"
              (ngModelChange)="patch({ subtitulo: $event })"
            ></textarea>
          </label>
          <div class="campo">
            <span>Imagen de fondo</span>
            <app-selector-imagen [url]="b.imagenUrl" (urlChange)="patch({ imagenUrl: $event })" />
          </div>
          <label>
            Alineacion
            <select [ngModel]="b.alineacion" (ngModelChange)="patch({ alineacion: $event })">
              <option value="izquierda">Izquierda</option>
              <option value="centro">Centro</option>
            </select>
          </label>
          <label class="check">
            <input type="checkbox" [ngModel]="!!b.cta" (ngModelChange)="toggleCta($event)" />
            Mostrar boton
          </label>
          @if (b.cta) {
            <label
              >Texto del boton<input
                [ngModel]="b.cta.texto"
                (ngModelChange)="patchCta({ texto: $event })"
            /></label>
            <label
              >Enlace<input [ngModel]="b.cta.enlace" (ngModelChange)="patchCta({ enlace: $event })"
            /></label>
            <label>Estilo
              <select [ngModel]="b.cta.variante ?? 'primario'"
                (ngModelChange)="patchCta({ variante: $event })">
                <option value="primario">Primario</option>
                <option value="secundario">Secundario</option>
              </select>
            </label>
            <h4>Colores del botón principal</h4>
            <div class="fila">
              <label>Fondo
                <input type="color" [ngModel]="b.cta.colorFondo ?? '#f59e0b'"
                  (ngModelChange)="patchCta({ colorFondo: $event })" />
              </label>
              <label>Texto
                <input type="color" [ngModel]="b.cta.colorTexto ?? '#ffffff'"
                  (ngModelChange)="patchCta({ colorTexto: $event, estiloTexto: limpiarColorTexto(b.cta.estiloTexto) })" />
              </label>
            </div>
            <button type="button" class="agregar"
              (click)="patchCta({ colorFondo: undefined, colorTexto: undefined, estiloTexto: limpiarColorTexto(b.cta.estiloTexto) })">
              Usar colores automáticos
            </button>
          }
        }
        @case ('columnas') {
          <p class="ayuda">
            Los textos se editan escribiendo directamente sobre el bloque. Pasa el mouse sobre una
            columna para agregar textos, imagenes o botones.
          </p>
          <div class="fila">
            <button
              type="button"
              class="agregar"
              (click)="agregarColumna()"
              [disabled]="b.columnas.length >= 4"
            >
              <mat-icon>add</mat-icon> Columna
            </button>
            <button
              type="button"
              class="agregar"
              (click)="quitarColumna()"
              [disabled]="b.columnas.length <= 1"
            >
              <mat-icon>remove</mat-icon> Columna
            </button>
          </div>
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.alineacionVertical === 'centro'"
              (ngModelChange)="patch({ alineacionVertical: $event ? 'centro' : 'arriba' })"
            />
            Centrar columnas verticalmente
          </label>
          @for (columna of b.columnas; track columna.id; let ci = $index) {
            @for (elemento of columna.elementos; track elemento.id; let ei = $index) {
              @if (elemento.tipo === 'imagen') {
                <div class="item-lista columna">
                  <span class="mini-titulo">Imagen (columna {{ ci + 1 }})</span>
                  <app-selector-imagen
                    [url]="elemento.url"
                    (urlChange)="patchElementoColumna(ci, ei, { url: $event })"
                  />
                  <input
                    placeholder="Texto alternativo"
                    [ngModel]="elemento.alt"
                    (ngModelChange)="patchElementoColumna(ci, ei, { alt: $event })"
                  />
                </div>
              } @else if (elemento.tipo === 'boton') {
                <div class="item-lista columna">
                  <span class="mini-titulo"
                    >Boton "{{ elemento.texto }}" (columna {{ ci + 1 }})</span
                  >
                  <input
                    placeholder="Enlace"
                    [ngModel]="elemento.enlace"
                    (ngModelChange)="patchElementoColumna(ci, ei, { enlace: $event })"
                  />
                  <select
                    [ngModel]="elemento.variante"
                    (ngModelChange)="patchElementoColumna(ci, ei, { variante: $event })"
                  >
                    <option value="primario">Primario</option>
                    <option value="secundario">Secundario</option>
                  </select>
                  <div class="fila">
                    <label>
                      Fondo
                      <input
                        type="color"
                        [ngModel]="elemento.colorFondo ?? '#2563eb'"
                        (ngModelChange)="patchElementoColumna(ci, ei, { colorFondo: $event })"
                      />
                    </label>
                    <label>
                      Texto
                      <input
                        type="color"
                        [ngModel]="elemento.colorTexto ?? '#ffffff'"
                        (ngModelChange)="patchElementoColumna(ci, ei, { colorTexto: $event })"
                      />
                    </label>
                  </div>
                </div>
              } @else if (elemento.tipo === 'texto') {
                <div class="item-lista columna">
                  <span class="mini-titulo">Texto (columna {{ ci + 1 }})</span>
                  <select
                    [ngModel]="elemento.alineacion ?? 'izquierda'"
                    (ngModelChange)="patchElementoColumna(ci, ei, { alineacion: $event })"
                  >
                    <option value="izquierda">Izquierda</option>
                    <option value="centro">Centro</option>
                  </select>
                </div>
              }
            }
          }
        }
        @case ('texto') {
          <label>
            Contenido
            <textarea
              rows="8"
              [ngModel]="b.contenido"
              (ngModelChange)="patch({ contenido: $event })"
            ></textarea>
          </label>
          <label>
            Alineacion
            <select
              [ngModel]="b.alineacion ?? 'izquierda'"
              (ngModelChange)="patch({ alineacion: $event })"
            >
              <option value="izquierda">Izquierda</option>
              <option value="centro">Centro</option>
            </select>
          </label>
          <h4>Formato</h4>
          <p class="ayuda">Tip: haz click sobre el texto en el canvas y usa la barra flotante.</p>
          <div class="fila">
            <label>
              Tamano (px)
              <input
                type="number"
                min="10"
                max="120"
                placeholder="17"
                [ngModel]="b.estiloTexto?.tamanoPx"
                (ngModelChange)="
                  patchEstiloTexto({ tamanoPx: $event ? numero($event) : undefined, tamano: undefined })
                "
              />
            </label>
            <label>
              Color
              <input
                type="color"
                [ngModel]="b.estiloTexto?.color ?? '#1f2937'"
                (ngModelChange)="patchEstiloTexto({ color: $event })"
              />
            </label>
          </div>
          <div class="fila">
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="b.estiloTexto?.negrita ?? false"
                (ngModelChange)="patchEstiloTexto({ negrita: $event || undefined })"
              />
              <b>Negrita</b>
            </label>
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="b.estiloTexto?.cursiva ?? false"
                (ngModelChange)="patchEstiloTexto({ cursiva: $event || undefined })"
              />
              <i>Cursiva</i>
            </label>
          </div>
        }
        @case ('lienzo') {
          <p class="ayuda">
            Arrastra cada elemento desde su manija azul ✥. Los textos se editan escribiendo sobre
            ellos; usa − / ＋ sobre el elemento para el ancho.
          </p>
          <div class="fila">
            <label class="check">
              <input type="checkbox" [ngModel]="b.cuadricula?.activa ?? false"
                (ngModelChange)="patchCuadricula({ activa: $event })" /> Mostrar cuadrícula
            </label>
            <label class="check">
              <input type="checkbox" [ngModel]="b.cuadricula?.ajustar ?? false"
                (ngModelChange)="patchCuadricula({ ajustar: $event })" /> Ajustar
            </label>
          </div>
          <label>Tamaño de cuadrícula
            <input type="number" min="4" max="100" [ngModel]="b.cuadricula?.tamano ?? 20"
              (ngModelChange)="patchCuadricula({ tamano: numero($event) })" />
          </label>
          <label>
            Alto del lienzo ({{ b.altura }}px)
            <input
              type="range"
              min="160"
              max="900"
              step="20"
              [ngModel]="b.altura"
              (ngModelChange)="patch({ altura: numero($event) })"
            />
          </label>
          @for (elemento of b.elementos; track elemento.id; let ei = $index) {
            <div class="fila controles-elemento">
              <label class="check"><input type="checkbox" [ngModel]="elemento.bloqueado ?? false"
                (ngModelChange)="patchElementoLienzo(ei, { bloqueado: $event || undefined })" /> Bloquear</label>
              <label class="check"><input type="checkbox" [ngModel]="elemento.mantenerProporcion ?? false"
                (ngModelChange)="patchElementoLienzo(ei, { mantenerProporcion: $event || undefined })" /> Proporción</label>
              @if (viewport() !== 'desktop') {
                <label class="check"><input type="checkbox" [ngModel]="elemento.ocultoEn?.[viewport()] ?? false"
                  (ngModelChange)="patchVisibilidadElemento(ei, $event)" /> Ocultar aquí</label>
              }
            </div>
            @if (elemento.tipo === 'texto') {
              <div class="item-lista columna">
                <span class="mini-titulo">Texto: "{{ elemento.contenido | slice: 0 : 24 }}"</span>
                <div class="fila">
                  <input
                    type="number"
                    min="10"
                    max="120"
                    placeholder="Tamano px"
                    [ngModel]="elemento.estiloTexto?.tamanoPx"
                    (ngModelChange)="
                      patchEstiloElementoLienzo(ei, {
                        tamanoPx: $event ? numero($event) : undefined,
                        tamano: undefined,
                      })
                    "
                  />
                  <input
                    type="color"
                    [ngModel]="elemento.estiloTexto?.color ?? '#1f2937'"
                    (ngModelChange)="patchEstiloElementoLienzo(ei, { color: $event })"
                  />
                </div>
                <div class="fila">
                  <label class="check">
                    <input
                      type="checkbox"
                      [ngModel]="elemento.estiloTexto?.negrita ?? false"
                      (ngModelChange)="
                        patchEstiloElementoLienzo(ei, { negrita: $event || undefined })
                      "
                    />
                    <b>Negrita</b>
                  </label>
                  <label class="check">
                    <input
                      type="checkbox"
                      [ngModel]="elemento.estiloTexto?.cursiva ?? false"
                      (ngModelChange)="
                        patchEstiloElementoLienzo(ei, { cursiva: $event || undefined })
                      "
                    />
                    <i>Cursiva</i>
                  </label>
                </div>
              </div>
            } @else if (elemento.tipo === 'boton') {
              <div class="item-lista columna">
                <span class="mini-titulo">Boton "{{ elemento.texto }}"</span>
                <input
                  placeholder="Enlace"
                  [ngModel]="elemento.enlace"
                  (ngModelChange)="patchElementoLienzo(ei, { enlace: $event })"
                />
                <select
                  [ngModel]="elemento.variante"
                  (ngModelChange)="patchElementoLienzo(ei, { variante: $event })"
                >
                  <option value="primario">Primario</option>
                  <option value="secundario">Secundario</option>
                </select>
                <div class="fila">
                  <label>
                    Fondo
                    <input
                      type="color"
                      [ngModel]="elemento.colorFondo ?? '#2563eb'"
                      (ngModelChange)="patchElementoLienzo(ei, { colorFondo: $event })"
                    />
                  </label>
                  <label>
                    Texto
                    <input
                      type="color"
                      [ngModel]="elemento.colorTexto ?? '#ffffff'"
                      (ngModelChange)="patchElementoLienzo(ei, { colorTexto: $event })"
                    />
                  </label>
                </div>
              </div>
            } @else if (elemento.tipo === 'imagen') {
              <div class="item-lista columna">
                <span class="mini-titulo">Imagen</span>
                <app-selector-imagen
                  [url]="elemento.url"
                  (urlChange)="patchElementoLienzo(ei, { url: $event })"
                />
              </div>
            } @else if (elemento.tipo === 'formulario') {
              <div class="item-lista columna">
                <span class="mini-titulo">Formulario</span>
                <label>Formulario prehecho
                  <select [ngModel]="elemento.formularioId"
                    (ngModelChange)="patchElementoLienzo(ei, { formularioId: $event, campos: undefined })">
                    <option value="seleccionar-formulario">— Elige un formulario —</option>
                    @for (formulario of formulariosEmpresa(); track formulario.formularioId) {
                      <option [value]="formulario.formularioId">{{ formulario.nombre }}</option>
                    }
                  </select>
                </label>
                <label>Título<input [ngModel]="elemento.titulo"
                  (ngModelChange)="patchElementoLienzo(ei, { titulo: $event })" /></label>
                <label>Texto del botón<input [ngModel]="elemento.textoBoton"
                  (ngModelChange)="patchElementoLienzo(ei, { textoBoton: $event })" /></label>
                <label>Mensaje de éxito<input [ngModel]="elemento.mensajeExito"
                  (ngModelChange)="patchElementoLienzo(ei, { mensajeExito: $event })" /></label>
              </div>
            } @else if (elemento.tipo === 'html') {
              <div class="item-lista columna">
                <span class="mini-titulo">HTML / JavaScript aislado</span>
                <p class="ayuda">Se ejecuta únicamente al publicar, dentro de un iframe sandbox.</p>
                <textarea rows="8" maxlength="20000" [ngModel]="elemento.codigo"
                  (ngModelChange)="patchElementoLienzo(ei, { codigo: $event })"></textarea>
              </div>
            }
          }
        }
        @case ('imagen') {
          <div class="campo">
            <span>Imagen</span>
            <app-selector-imagen [url]="b.url" (urlChange)="patch({ url: $event })" />
          </div>
          <label
            >Texto alternativo<input [ngModel]="b.alt" (ngModelChange)="patch({ alt: $event })"
          /></label>
          <label
            >Enlace (opcional)<input
              [ngModel]="b.enlace"
              (ngModelChange)="patch({ enlace: $event || undefined })"
          /></label>
        }
        @case ('boton') {
          <label
            >Texto<input [ngModel]="b.texto" (ngModelChange)="patch({ texto: $event })"
          /></label>
          <label
            >Enlace<input [ngModel]="b.enlace" (ngModelChange)="patch({ enlace: $event })"
          /></label>
          <label>
            Estilo
            <select [ngModel]="b.variante" (ngModelChange)="patch({ variante: $event })">
              <option value="primario">Primario</option>
              <option value="secundario">Secundario</option>
            </select>
          </label>
          <label>
            Alineacion
            <select [ngModel]="b.alineacion" (ngModelChange)="patch({ alineacion: $event })">
              <option value="izquierda">Izquierda</option>
              <option value="centro">Centro</option>
            </select>
          </label>
          <h4>Colores del boton</h4>
          <div class="fila">
            <label>
              Fondo
              <input
                type="color"
                [ngModel]="b.colorFondo ?? '#2563eb'"
                (ngModelChange)="patch({ colorFondo: $event })"
              />
            </label>
            <label>
              Texto
              <input
                type="color"
                [ngModel]="b.colorTexto ?? '#ffffff'"
                (ngModelChange)="patch({ colorTexto: $event })"
              />
            </label>
          </div>
          <button
            type="button"
            class="agregar"
            (click)="patch({ colorFondo: undefined, colorTexto: undefined })"
          >
            Usar colores del tema
          </button>
        }
        @case ('html') {
          <p class="ayuda">
            Pega aqui el codigo HTML/JS de un servicio externo (contadores, cuentas regresivas,
            widgets). Por seguridad corre aislado en el sitio publicado; en el editor solo se
            muestra un marcador.
          </p>
          <label>
            Codigo HTML/JS
            <textarea
              rows="10"
              class="codigo"
              spellcheck="false"
              [ngModel]="b.codigo"
              (ngModelChange)="patch({ codigo: $event })"
            ></textarea>
          </label>
          <label>
            Alto del recuadro ({{ b.altura }}px)
            <input
              type="range"
              min="40"
              max="1200"
              step="20"
              [ngModel]="b.altura"
              (ngModelChange)="patch({ altura: numero($event) })"
            />
          </label>
        }
        @case ('pago') {
          <p class="ayuda">
            Este boton lleva a la pagina de pago de tu sitio (/pago), que muestra los metodos que
            configures en la pestaña <b>Pagos</b>.
          </p>
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          <label>
            Texto
            <textarea
              rows="2"
              [ngModel]="b.texto"
              (ngModelChange)="patch({ texto: $event })"
            ></textarea>
          </label>
          <label
            >Texto del boton<input
              [ngModel]="b.textoBoton"
              (ngModelChange)="patch({ textoBoton: $event })"
          /></label>
        }
        @case ('planes') {
          <p class="ayuda">
            Los nombres, precios y caracteristicas se editan escribiendo sobre el bloque. Usa ★
            sobre una card para destacarla.
          </p>
          <div class="fila">
            <label>
              Orientacion
              <select
                [ngModel]="b.orientacion"
                (ngModelChange)="patch({ orientacion: $event })"
              >
                <option value="vertical">Vertical (cards)</option>
                <option value="horizontal">Horizontal (filas)</option>
              </select>
            </label>
            @if (b.orientacion === 'vertical') {
              <label>
                Columnas
                <select
                  [ngModel]="b.columnas ?? 3"
                  (ngModelChange)="patch({ columnas: numero($event) })"
                >
                  <option [ngValue]="2">2</option>
                  <option [ngValue]="3">3</option>
                  <option [ngValue]="4">4</option>
                </select>
              </label>
            }
          </div>
          @for (plan of b.planes; track plan.id; let i = $index) {
            <div class="item-lista columna">
              <span class="mini-titulo">{{ plan.nombre }}</span>
              <div class="fila">
                <label>
                  Precio (vacio = sin precio)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    [ngModel]="plan.precio"
                    (ngModelChange)="patchPlan(i, { precio: $event === null ? undefined : numero($event) })"
                  />
                </label>
                <label>
                  Periodo
                  <input
                    maxlength="30"
                    placeholder="/mes"
                    [ngModel]="plan.periodo"
                    (ngModelChange)="patchPlan(i, { periodo: $event || undefined })"
                  />
                </label>
              </div>
              <input
                placeholder="Enlace del boton (ej. /pago o https://wa.me/...)"
                [ngModel]="plan.ctaEnlace"
                (ngModelChange)="patchPlan(i, { ctaEnlace: $event || undefined })"
              />
              <div class="fila">
                <label>
                  Fondo card
                  <input
                    type="color"
                    [ngModel]="plan.colorFondo ?? '#ffffff'"
                    (ngModelChange)="patchPlan(i, { colorFondo: $event })"
                  />
                </label>
                <label>
                  Texto card
                  <input
                    type="color"
                    [ngModel]="plan.colorTexto ?? '#1c1c1c'"
                    (ngModelChange)="patchPlan(i, { colorTexto: $event })"
                  />
                </label>
              </div>
              <button
                type="button"
                class="agregar"
                (click)="patchPlan(i, { colorFondo: undefined, colorTexto: undefined })"
              >
                Usar colores del tema
              </button>
              <button
                type="button"
                class="quitar"
                [disabled]="b.planes.length <= 1"
                (click)="quitarItem('planes', i)"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
        }
        @case ('faq') {
          <p class="ayuda">
            Escribe directamente sobre las preguntas y respuestas en el canvas; ahi mismo puedes
            agregar o quitar preguntas. En el sitio publicado se muestran plegadas.
          </p>
        }
        @case ('cta') {
          <label
            >Enlace del boton<input
              placeholder="/pago o https://wa.me/..."
              [ngModel]="b.enlace"
              (ngModelChange)="patch({ enlace: $event })"
          /></label>
          <p class="ayuda">El titulo, texto y boton se editan sobre el bloque.</p>
        }
        @case ('caracteristicas') {
          <label>
            Columnas
            <select [ngModel]="b.columnas" (ngModelChange)="patch({ columnas: numero($event) })">
              <option [ngValue]="2">2</option>
              <option [ngValue]="3">3</option>
              <option [ngValue]="4">4</option>
            </select>
          </label>
          <p class="ayuda">
            El icono es un emoji: haz click sobre el y cambialo (Win + . abre el selector de
            emojis). Textos editables sobre el bloque.
          </p>
        }
        @case ('logos') {
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.gris !== false"
              (ngModelChange)="patch({ gris: $event })"
            />
            Logos en escala de grises (color al pasar el mouse)
          </label>
          <p class="ayuda">Agrega o cambia logos con los controles sobre cada imagen.</p>
        }
        @case ('estadisticas') {
          <p class="ayuda">
            Edita cifras y etiquetas sobre el bloque. En el sitio publicado los numeros se animan
            al entrar en pantalla ("+500" cuenta desde 0).
          </p>
        }
        @case ('equipo') {
          <label>
            Columnas
            <select [ngModel]="b.columnas" (ngModelChange)="patch({ columnas: numero($event) })">
              <option [ngValue]="2">2</option>
              <option [ngValue]="3">3</option>
              <option [ngValue]="4">4</option>
            </select>
          </label>
          <p class="ayuda">Foto con el boton 📷 sobre cada persona; nombre y cargo, en el bloque.</p>
        }
        @case ('countdown') {
          <label>
            Fecha y hora objetivo
            <input
              type="datetime-local"
              [ngModel]="fechaLocal(b.fecha)"
              (ngModelChange)="patch({ fecha: aTimestamp($event) })"
            />
          </label>
          <label
            >Mensaje al terminar<input
              [ngModel]="b.mensajeFin"
              (ngModelChange)="patch({ mensajeFin: $event })"
          /></label>
        }
        @case ('espaciador') {
          <label>
            Alto ({{ b.altura }}px)
            <input
              type="range"
              min="8"
              max="300"
              step="4"
              [ngModel]="b.altura"
              (ngModelChange)="patch({ altura: numero($event) })"
            />
          </label>
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.linea ?? false"
              (ngModelChange)="patch({ linea: $event || undefined })"
            />
            Mostrar linea divisoria
          </label>
        }
        @case ('video') {
          <label>
            ID del video de YouTube
            <input
              [ngModel]="b.videoId"
              (ngModelChange)="patch({ videoId: $event })"
              placeholder="dQw4w9WgXcQ"
            />
          </label>
          <p class="ayuda">
            Ej.: en youtube.com/watch?v=<b>dQw4w9WgXcQ</b>, el ID es la parte final.
          </p>
        }
        @case ('mapa') {
          <div class="fila">
            <label
              >Latitud<input
                type="number"
                step="0.0001"
                [ngModel]="b.lat"
                (ngModelChange)="patch({ lat: numero($event) })"
            /></label>
            <label
              >Longitud<input
                type="number"
                step="0.0001"
                [ngModel]="b.lng"
                (ngModelChange)="patch({ lng: numero($event) })"
            /></label>
          </div>
          <label
            >Direccion<input [ngModel]="b.direccion" (ngModelChange)="patch({ direccion: $event })"
          /></label>
          <label
            >Telefono<input [ngModel]="b.telefono" (ngModelChange)="patch({ telefono: $event })"
          /></label>
          <label
            >Horario<textarea
              rows="2"
              [ngModel]="b.horario"
              (ngModelChange)="patch({ horario: $event })"
            ></textarea>
          </label>
        }
        @case ('galeria') {
          <label>
            Columnas
            <select [ngModel]="b.columnas" (ngModelChange)="patch({ columnas: numero($event) })">
              <option [ngValue]="2">2</option>
              <option [ngValue]="3">3</option>
              <option [ngValue]="4">4</option>
            </select>
          </label>
          @for (imagen of b.imagenes; track $index; let i = $index) {
            <div class="item-lista">
              <app-selector-imagen
                [url]="imagen.url"
                (urlChange)="patchItem('imagenes', i, { url: $event })"
              />
              <button type="button" class="quitar" (click)="quitarItem('imagenes', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button
            type="button"
            class="agregar"
            (click)="agregarItem('imagenes', { url: 'https://placehold.co/600x600' })"
          >
            <mat-icon>add</mat-icon> Agregar imagen
          </button>
        }
        @case ('carrusel') {
          <label>
            Autoplay (segundos, vacio = manual)
            <input
              type="number"
              min="2"
              max="30"
              [ngModel]="b.autoplayMs ? b.autoplayMs / 1000 : null"
              (ngModelChange)="patch({ autoplayMs: $event ? numero($event) * 1000 : undefined })"
            />
          </label>
          @for (slide of b.slides; track $index; let i = $index) {
            <div class="item-lista columna">
              <app-selector-imagen
                [url]="slide.imagenUrl"
                (urlChange)="patchItem('slides', i, { imagenUrl: $event })"
              />
              <input
                placeholder="Titulo"
                [ngModel]="slide.titulo"
                (ngModelChange)="patchItem('slides', i, { titulo: $event })"
              />
              <input
                placeholder="Enlace"
                [ngModel]="slide.enlace"
                (ngModelChange)="patchItem('slides', i, { enlace: $event || undefined })"
              />
              <button type="button" class="quitar" (click)="quitarItem('slides', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button
            type="button"
            class="agregar"
            (click)="agregarItem('slides', { imagenUrl: 'https://placehold.co/1200x500' })"
          >
            <mat-icon>add</mat-icon> Agregar slide
          </button>
        }
        @case ('testimonios') {
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          @for (item of b.items; track $index; let i = $index) {
            <div class="item-lista columna">
              <input
                placeholder="Nombre"
                [ngModel]="item.nombre"
                (ngModelChange)="patchItem('items', i, { nombre: $event })"
              />
              <textarea
                rows="2"
                placeholder="Comentario"
                [ngModel]="item.texto"
                (ngModelChange)="patchItem('items', i, { texto: $event })"
              ></textarea>
              <select
                [ngModel]="item.estrellas ?? 5"
                (ngModelChange)="patchItem('items', i, { estrellas: numero($event) })"
              >
                <option [ngValue]="5">★★★★★</option>
                <option [ngValue]="4">★★★★</option>
                <option [ngValue]="3">★★★</option>
                <option [ngValue]="2">★★</option>
                <option [ngValue]="1">★</option>
              </select>
              <button type="button" class="quitar" (click)="quitarItem('items', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button
            type="button"
            class="agregar"
            (click)="
              agregarItem('items', { nombre: 'Cliente', texto: 'Muy buen servicio', estrellas: 5 })
            "
          >
            <mat-icon>add</mat-icon> Agregar testimonio
          </button>
        }
        @case ('metodos-pago') {
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          @for (metodo of metodosDisponibles; track metodo.id) {
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="b.metodos.includes(metodo.id)"
                (ngModelChange)="toggleMetodo(metodo.id, $event)"
              />
              {{ metodo.nombre }}
            </label>
          }
          <label
            >Nota<textarea
              rows="2"
              [ngModel]="b.nota"
              (ngModelChange)="patch({ nota: $event })"
            ></textarea>
          </label>
          <h4>Botón de pago</h4>
          <label>Texto
            <input [ngModel]="b.cta?.texto ?? 'Pagar ahora'"
              (ngModelChange)="patchCta({ texto: $event })" />
          </label>
          <label>Enlace
            <input [ngModel]="b.cta?.enlace ?? '/pago'"
              (ngModelChange)="patchCta({ enlace: $event })" />
          </label>
          <label>Estilo
            <select [ngModel]="b.cta?.variante ?? 'primario'"
              (ngModelChange)="patchCta({ variante: $event })">
              <option value="primario">Primario</option>
              <option value="secundario">Secundario</option>
            </select>
          </label>
          <div class="fila">
            <label>Fondo
              <input type="color" [ngModel]="b.cta?.colorFondo ?? '#f59e0b'"
                (ngModelChange)="patchCta({ colorFondo: $event })" />
            </label>
            <label>Texto
              <input type="color" [ngModel]="b.cta?.colorTexto ?? '#ffffff'"
                (ngModelChange)="patchCta({ colorTexto: $event, estiloTexto: limpiarColorTexto(b.cta?.estiloTexto) })" />
            </label>
          </div>
          <button type="button" class="agregar"
            (click)="patchCta({ colorFondo: undefined, colorTexto: undefined, estiloTexto: limpiarColorTexto(b.cta?.estiloTexto) })">
            Usar colores automáticos
          </button>
        }
        @case ('formulario') {
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          <label>
            Formulario prehecho
            <select
              [ngModel]="b.formularioId"
              (ngModelChange)="patch({ formularioId: $event, campos: undefined })"
            >
              @if (!formularioSeleccionadoExiste()) {
                <option [value]="b.formularioId">— Elige un formulario —</option>
              }
              @for (formulario of formulariosEmpresa(); track formulario.formularioId) {
                <option [value]="formulario.formularioId">{{ formulario.nombre }}</option>
              }
            </select>
          </label>
          @if (formulariosEmpresa().length === 0) {
            <p class="ayuda">
              Aun no tienes formularios prehechos. Crealos en la pestaña <b>Formularios</b> del
              sitio; las respuestas llegan a su propia bandeja.
            </p>
          }
          <label
            >Texto del boton<input
              [ngModel]="b.textoBoton"
              (ngModelChange)="patch({ textoBoton: $event })"
          /></label>
          <label
            >Mensaje de exito<input
              [ngModel]="b.mensajeExito"
              (ngModelChange)="patch({ mensajeExito: $event })"
          /></label>
          @if (b.campos?.length) {
            <p class="ayuda">
              Este bloque aun usa campos propios (version anterior). Al elegir un formulario
              prehecho pasara a usar ese.
            </p>
          }
        }
        @case ('productos') {
          <label
            >Titulo<input [ngModel]="b.titulo" (ngModelChange)="patch({ titulo: $event })"
          /></label>
          <label>
            Origen
            <select [ngModel]="b.origen.modo" (ngModelChange)="cambiarModoOrigen($event)">
              <option value="seleccion">Productos elegidos</option>
              <option value="categoria">Por categoria</option>
            </select>
          </label>
          @if (b.origen.modo === 'categoria') {
            <label>
              Categoria
              <select
                [ngModel]="b.origen.categoriaId"
                (ngModelChange)="patch({ origen: { modo: 'categoria', categoriaId: $event } })"
              >
                @for (categoria of categorias(); track categoria.id) {
                  <option [value]="categoria.id">{{ categoria.nombre }}</option>
                }
              </select>
            </label>
          } @else {
            <div class="lista-productos">
              @for (producto of productosCatalogo(); track producto.productoId) {
                <label class="check">
                  <input
                    type="checkbox"
                    [ngModel]="b.origen.productoIds.includes(producto.productoId)"
                    (ngModelChange)="toggleProducto(producto.productoId, $event)"
                  />
                  {{ producto.nombre }}
                  @if (!producto.visible) {
                    <span class="apagado">(oculto en catalogo)</span>
                  }
                </label>
              } @empty {
                <p class="ayuda">No hay productos en el inventario.</p>
              }
            </div>
          }
          <div class="fila">
            <label>
              Columnas
              <select [ngModel]="b.columnas" (ngModelChange)="patch({ columnas: numero($event) })">
                <option [ngValue]="2">2</option>
                <option [ngValue]="3">3</option>
                <option [ngValue]="4">4</option>
              </select>
            </label>
            <label>
              Ordenar por
              <select [ngModel]="b.ordenar" (ngModelChange)="patch({ ordenar: $event })">
                <option value="nombre">Nombre</option>
                <option value="precio">Precio</option>
              </select>
            </label>
          </div>
          <div class="fila">
            <label>
              Densidad
              <select
                [ngModel]="b.densidad ?? 'normal'"
                (ngModelChange)="patch({ densidad: $event })"
              >
                <option value="normal">Normal</option>
                <option value="compacta">Compacta</option>
              </select>
            </label>
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="b.mostrarPrecio"
                (ngModelChange)="patch({ mostrarPrecio: $event })"
              />
              Mostrar precio
            </label>
          </div>
          <p class="ayuda">
            Cada tarjeta abre la pagina propia del producto (con su descripcion larga y galeria,
            editable en la pestaña Catalogo).
          </p>
        }
        @case ('header') {
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.mostrarLogo"
              (ngModelChange)="patch({ mostrarLogo: $event })"
            />
            Mostrar logo
          </label>
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.mostrarCarrito"
              (ngModelChange)="patch({ mostrarCarrito: $event })"
            />
            Mostrar carrito
          </label>
          <h4>Enlaces de navegacion</h4>
          @for (enlace of b.enlaces; track $index; let i = $index) {
            <div class="item-lista columna">
              <input
                placeholder="Texto"
                [ngModel]="enlace.texto"
                (ngModelChange)="patchItem('enlaces', i, { texto: $event })"
              />
              <select
                [ngModel]="enlace.paginaId"
                (ngModelChange)="patchItem('enlaces', i, { paginaId: $event })"
              >
                @for (pagina of paginasMenu(); track pagina.id) {
                  <option [value]="pagina.id">{{ pagina.titulo }}</option>
                }
              </select>
              <button type="button" class="quitar" (click)="quitarItem('enlaces', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button
            type="button"
            class="agregar"
            (click)="agregarItem('enlaces', { texto: 'Inicio', paginaId: 'home' })"
          >
            <mat-icon>add</mat-icon> Agregar enlace
          </button>
        }
        @case ('footer') {
          <label
            >Texto<textarea
              rows="2"
              [ngModel]="b.texto"
              (ngModelChange)="patch({ texto: $event })"
            ></textarea>
          </label>
          <h4>Redes sociales</h4>
          @for (red of b.redes; track $index; let i = $index) {
            <div class="item-lista columna">
              <select
                [ngModel]="red.tipo"
                (ngModelChange)="patchItem('redes', i, { tipo: $event })"
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <input
                placeholder="https://..."
                [ngModel]="red.url"
                (ngModelChange)="patchItem('redes', i, { url: $event })"
              />
              <button type="button" class="quitar" (click)="quitarItem('redes', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button
            type="button"
            class="agregar"
            (click)="agregarItem('redes', { tipo: 'instagram', url: 'https://instagram.com/' })"
          >
            <mat-icon>add</mat-icon> Agregar red
          </button>
        }
      }

      </mat-expansion-panel>

      <mat-expansion-panel>
        <mat-expansion-panel-header>
          <mat-panel-title><mat-icon>palette</mat-icon> Seccion y fondo</mat-panel-title>
        </mat-expansion-panel-header>
      @if (viewport() !== 'desktop') {
        <div class="badge-vista">
          <mat-icon>{{ viewport() === 'movil' ? 'smartphone' : 'tablet_mac' }}</mat-icon>
          <span
            >Editando vista <b>{{ viewport() }}</b
            >: ancho, espaciado y visibilidad se guardan solo para esta vista.</span
          >
        </div>
        <label class="check">
          <input
            type="checkbox"
            [ngModel]="overridesVp().ocultar ?? false"
            (ngModelChange)="patchOverride({ ocultar: $event || undefined })"
          />
          Ocultar bloque en esta vista
        </label>
      }

      <label>
        Fondo
        <select [ngModel]="tipoFondo()" (ngModelChange)="cambiarTipoFondo($event)">
          <option value="tema">Del tema</option>
          <option value="color">Color</option>
          <option value="gradiente">Gradiente</option>
          <option value="imagen">Imagen</option>
        </select>
      </label>
      @switch (tipoFondo()) {
        @case ('color') {
          <input
            type="color"
            class="color-grande"
            [ngModel]="b.estilos?.fondo ?? '#ffffff'"
            (ngModelChange)="patchEstilos({ fondo: $event })"
          />
        }
        @case ('gradiente') {
          <div class="presets">
            @for (preset of gradientes; track preset.nombre) {
              <button
                type="button"
                class="preset"
                [style.background]="cssGradiente(preset)"
                [title]="preset.nombre"
                (click)="aplicarGradiente(preset)"
              ></button>
            }
          </div>
          <div class="fila">
            <label>
              Desde
              <input
                type="color"
                [ngModel]="b.estilos?.fondoGradiente?.desde ?? '#2563eb'"
                (ngModelChange)="patchGradiente({ desde: $event })"
              />
            </label>
            <label>
              Hasta
              <input
                type="color"
                [ngModel]="b.estilos?.fondoGradiente?.hasta ?? '#9333ea'"
                (ngModelChange)="patchGradiente({ hasta: $event })"
              />
            </label>
          </div>
          <label>
            Angulo ({{ b.estilos?.fondoGradiente?.angulo ?? 135 }}°)
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              [ngModel]="b.estilos?.fondoGradiente?.angulo ?? 135"
              (ngModelChange)="patchGradiente({ angulo: numero($event) })"
            />
          </label>
        }
        @case ('imagen') {
          <div class="campo">
            <app-selector-imagen
              [url]="b.estilos?.fondoImagenUrl"
              (urlChange)="patchEstilos({ fondoImagenUrl: $event })"
            />
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="b.estilos?.fondoVelo ?? false"
                (ngModelChange)="patchEstilos({ fondoVelo: $event || undefined })"
              />
              Oscurecer fondo (texto mas legible)
            </label>
          </div>
        }
      }

      <div class="fila">
        <label>
          Espaciado
          <select [ngModel]="espaciadoVp()" (ngModelChange)="cambiarEspaciado($event)">
            <option value="compacto">Compacto</option>
            <option value="normal">Normal</option>
            <option value="amplio">Amplio</option>
          </select>
        </label>
        <label>
          Ancho del contenido
          <select
            [ngModel]="b.estilos?.anchoContenido ?? 'normal'"
            (ngModelChange)="patchEstilos({ anchoContenido: $event })"
          >
            <option value="estrecho">Estrecho</option>
            <option value="normal">Normal</option>
            <option value="completo">Completo</option>
          </select>
        </label>
      </div>
      <label>
        Ancho del bloque (bloques lado a lado)
        <select [ngModel]="anchoBloqueVp()" (ngModelChange)="cambiarAnchoBloque($event)">
          <option value="completo">Completo (100%)</option>
          <option value="mitad">Mitad (50%)</option>
          <option value="tercio">Un tercio (33%)</option>
          <option value="dosTercios">Dos tercios (66%)</option>
        </select>
      </label>
      </mat-expansion-panel>

      <mat-expansion-panel>
        <mat-expansion-panel-header>
          <mat-panel-title><mat-icon>waves</mat-icon> Divisores de seccion</mat-panel-title>
        </mat-expansion-panel-header>
      @for (posicion of ['divisorArriba', 'divisorAbajo']; track posicion) {
        <div class="campo">
          <span>{{ posicion === 'divisorArriba' ? 'Divisor superior' : 'Divisor inferior' }}</span>
          <div class="fila">
            <select
              [ngModel]="divisorDe(posicion)?.tipo ?? ''"
              (ngModelChange)="cambiarTipoDivisor(posicion, $event)"
            >
              <option value="">Ninguno</option>
              <option value="onda">Onda</option>
              <option value="diagonal">Diagonal</option>
              <option value="curva">Curva</option>
            </select>
            @if (divisorDe(posicion); as divisor) {
              <input
                type="color"
                [ngModel]="divisor.color"
                (ngModelChange)="patchDivisor(posicion, { color: $event })"
              />
            }
          </div>
          @if (divisorDe(posicion); as divisor) {
            <label>
              Alto ({{ divisor.altura ?? 60 }}px)
              <input
                type="range"
                min="20"
                max="200"
                step="10"
                [ngModel]="divisor.altura ?? 60"
                (ngModelChange)="patchDivisor(posicion, { altura: numero($event) })"
              />
            </label>
            <label class="check">
              <input
                type="checkbox"
                [ngModel]="divisor.voltear ?? false"
                (ngModelChange)="patchDivisor(posicion, { voltear: $event || undefined })"
              />
              Voltear horizontalmente
            </label>
          }
        </div>
      }
      <p class="ayuda">
        Tip: usa como color del divisor el fondo de la seccion vecina para lograr el efecto de
        "ola" entre bloques.
      </p>

      @if (viewport() !== 'desktop' && tieneOverridesVp()) {
        <button type="button" class="agregar" (click)="quitarOverridesVp()">
          <mat-icon>restart_alt</mat-icon> Restablecer esta vista como escritorio
        </button>
      }
      <p class="ayuda">
        Con "Mitad" o "Un tercio", el bloque se coloca junto al siguiente. En celulares bajan
        automaticamente uno debajo de otro (salvo que lo ajustes en la vista movil). Tambien puedes
        arrastrar el borde derecho del bloque en el canvas.
      </p>
      </mat-expansion-panel>
      </mat-accordion>
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      font-size: 0.85rem;
    }
    h3 {
      margin: 0;
      font-size: 0.95rem;
      text-transform: capitalize;
    }
    h4 {
      margin: 8px 0 0;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-weight: 600;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      font-weight: 400;
    }
    input:not([type='checkbox']):not([type='color']),
    select,
    textarea {
      font: inherit;
      font-weight: 400;
      padding: 7px 8px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      width: 100%;
      box-sizing: border-box;
    }
    .fila {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .fila-fondo {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .fila-fondo input[type='color'] {
      width: 44px;
      height: 32px;
      padding: 2px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      background: var(--tc-surface-container-lowest);
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-weight: 600;
    }
    .item-lista {
      position: relative;
      display: flex;
      gap: 6px;
      align-items: flex-start;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      padding: 8px;
      padding-right: 30px;
    }
    .item-lista.columna {
      flex-direction: column;
    }
    .quitar {
      position: absolute;
      top: 4px;
      right: 4px;
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.6;
      padding: 2px;
    }
    .quitar mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .agregar {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      align-self: flex-start;
      background: none;
      border: 1px dashed var(--tc-ghost-border);
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 0.82rem;
      color: var(--tc-on-surface);
    }
    .agregar mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .ayuda {
      margin: 0;
      opacity: 0.65;
      font-size: 0.8rem;
    }
    .mini-titulo {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.6;
    }
    .lista-productos {
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .apagado {
      opacity: 0.5;
      font-size: 0.75rem;
    }
    .badge-vista {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--tc-info-container);
      color: var(--tc-on-info-container);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 0.78rem;
    }
    .badge-vista mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .color-grande {
      width: 100%;
      height: 34px;
      padding: 2px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      background: var(--tc-surface-container-lowest);
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 5px;
    }
    .preset {
      aspect-ratio: 1;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
    }
    .preset:hover {
      outline: 2px solid var(--primary);
      outline-offset: 1px;
    }
    .codigo {
      font-family: monospace;
      font-size: 0.78rem;
    }
    mat-expansion-panel {
      box-shadow: none !important;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px !important;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    mat-panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 700;
    }
    mat-panel-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--primary);
    }
    :host ::ng-deep .mat-expansion-panel-body {
      padding: 4px 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    :host ::ng-deep .mat-expansion-panel-header {
      padding: 0 14px;
      height: 44px;
    }
    .variantes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .variante-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 10px;
      min-width: 62px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      cursor: pointer;
      font: inherit;
    }
    .variante-btn small {
      font-size: 0.68rem;
      font-weight: 600;
      opacity: 0.75;
    }
    .variante-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--muted-foreground);
    }
    .variante-btn:hover {
      border-color: var(--primary);
    }
    .variante-btn.activa {
      border-color: var(--primary);
      background: var(--tc-primary-container);
      color: var(--tc-on-primary-container);
    }
    .variante-btn.activa mat-icon {
      color: var(--tc-on-primary-container);
    }
  `,
})
export class PanelPropiedadesComponent {
  private readonly categoriasService = inject(CategoriasService);
  private readonly catalogo = inject(CATALOGO_PRODUCTOS);

  readonly bloque = input.required<Bloque>();
  readonly paginas = input<PaginaDoc[]>([]);
  /** Vista activa del editor: en tablet/movil los ajustes responsive van a overrides. */
  readonly viewport = input<Viewport>('desktop');
  readonly bloqueChange = output<Bloque>();

  private readonly formulariosService = inject(FormulariosService);

  readonly categorias = toSignal(this.categoriasService.getCategorias(), { initialValue: [] });
  readonly productosCatalogo = computed(() => this.catalogo.productos());
  readonly formulariosEmpresa = toSignal(this.formulariosService.getFormularios(), {
    initialValue: [],
  });

  /** Paginas navegables para menus (excluye las de sistema: slug '__x'). */
  readonly paginasMenu = computed(() =>
    this.paginas().filter((pagina) => !pagina.slug.startsWith('__')),
  );

  readonly formularioSeleccionadoExiste = computed(() => {
    const bloque = this.bloque();
    if (bloque.tipo !== 'formulario') return true;
    return this.formulariosEmpresa().some((f) => f.formularioId === bloque.formularioId);
  });

  readonly gradientes: (FondoGradiente & { nombre: string })[] = [
    { nombre: 'Oceano', desde: '#2563eb', hasta: '#06b6d4', angulo: 135 },
    { nombre: 'Atardecer', desde: '#f97316', hasta: '#e11d48', angulo: 135 },
    { nombre: 'Uva', desde: '#7c3aed', hasta: '#db2777', angulo: 135 },
    { nombre: 'Bosque', desde: '#059669', hasta: '#84cc16', angulo: 135 },
    { nombre: 'Noche', desde: '#0f172a', hasta: '#334155', angulo: 160 },
    { nombre: 'Dorado', desde: '#f59e0b', hasta: '#fef3c7', angulo: 135 },
    { nombre: 'Rosa', desde: '#fda4af', hasta: '#fdf2f8', angulo: 160 },
    { nombre: 'Menta', desde: '#a7f3d0', hasta: '#ecfeff', angulo: 160 },
  ];

  /** Tipo de fondo elegido manualmente (mientras aun no hay datos que lo delaten). */
  private readonly tipoFondoManual = signal<'tema' | 'color' | 'gradiente' | 'imagen' | null>(null);

  /** Variantes de diseño disponibles por tipo de bloque (selector visual "Diseño"). */
  private readonly VARIANTES: Record<string, { id: string; nombre: string; icono: string }[]> = {
    hero: [
      { id: 'centrado', nombre: 'Centrado', icono: 'format_align_center' },
      { id: 'partido', nombre: '50 / 50', icono: 'vertical_split' },
      { id: 'tarjeta', nombre: 'Tarjeta', icono: 'branding_watermark' },
    ],
    testimonios: [
      { id: 'tarjetas', nombre: 'Tarjetas', icono: 'view_module' },
      { id: 'cita', nombre: 'Cita', icono: 'format_quote' },
      { id: 'compacto', nombre: 'Lista', icono: 'view_list' },
    ],
    galeria: [
      { id: 'grilla', nombre: 'Grilla', icono: 'grid_view' },
      { id: 'mosaico', nombre: 'Mosaico', icono: 'dashboard' },
    ],
    formulario: [
      { id: 'simple', nombre: 'Simple', icono: 'article' },
      { id: 'tarjeta', nombre: 'Tarjeta', icono: 'wysiwyg' },
    ],
    footer: [
      { id: 'centrado', nombre: 'Centrado', icono: 'align_horizontal_center' },
      { id: 'columnas', nombre: 'Columnas', icono: 'view_column' },
    ],
    productos: [
      { id: 'tarjetas', nombre: 'Tarjetas', icono: 'grid_view' },
      { id: 'lista', nombre: 'Lista', icono: 'view_list' },
    ],
  };

  variantesDelBloque(): { id: string; nombre: string; icono: string }[] {
    return this.VARIANTES[this.bloque().tipo] ?? [];
  }

  varianteActual(): string {
    const primera = this.variantesDelBloque()[0];
    return (this.b.variante as string) ?? primera?.id ?? '';
  }

  private ultimoBloqueId = '';

  constructor() {
    // Al cambiar DE BLOQUE seleccionado, el tipo de fondo vuelve a derivarse de sus datos.
    // Ojo: el effect corre en cada edicion del bloque (la señal input cambia de referencia);
    // sin el guard por id, elegir "Color"/"Imagen" rebotaba a "Del tema" al instante.
    effect(() => {
      const id = this.bloque().id;
      if (id !== this.ultimoBloqueId) {
        this.ultimoBloqueId = id;
        this.tipoFondoManual.set(null);
      }
    });
  }

  tipoFondo(): 'tema' | 'color' | 'gradiente' | 'imagen' {
    const manual = this.tipoFondoManual();
    if (manual) return manual;
    const estilos = this.bloque().estilos;
    if (estilos?.fondoImagenUrl) return 'imagen';
    if (estilos?.fondoGradiente) return 'gradiente';
    if (estilos?.fondo) return 'color';
    return 'tema';
  }

  cambiarTipoFondo(tipo: 'tema' | 'color' | 'gradiente' | 'imagen'): void {
    this.tipoFondoManual.set(tipo);
    if (tipo === 'tema') {
      this.patchEstilos({
        fondo: undefined,
        fondoGradiente: undefined,
        fondoImagenUrl: undefined,
        fondoVelo: undefined,
      });
    } else if (tipo === 'color') {
      // Setear un color de entrada hace visible el picker y deja el estado consistente.
      this.patchEstilos({
        fondo: this.b.estilos?.fondo ?? '#ffffff',
        fondoGradiente: undefined,
        fondoImagenUrl: undefined,
        fondoVelo: undefined,
      });
    } else if (tipo === 'gradiente') {
      const { nombre: _n, ...preset } = this.gradientes[0];
      this.patchEstilos({ fondoGradiente: preset, fondoImagenUrl: undefined, fondoVelo: undefined });
    } else {
      this.patchEstilos({ fondoGradiente: undefined });
    }
  }

  cssGradiente(gradiente: FondoGradiente): string {
    return `linear-gradient(${gradiente.angulo}deg, ${gradiente.desde}, ${gradiente.hasta})`;
  }

  aplicarGradiente(preset: FondoGradiente & { nombre: string }): void {
    const { nombre: _n, ...gradiente } = preset;
    this.patchEstilos({ fondoGradiente: gradiente });
  }

  patchGradiente(cambios: Partial<FondoGradiente>): void {
    const actual = this.bloque().estilos?.fondoGradiente ?? {
      desde: '#2563eb',
      hasta: '#9333ea',
      angulo: 135,
    };
    this.patchEstilos({ fondoGradiente: { ...actual, ...cambios } });
  }

  // --- Overrides responsive de la vista activa (tablet/movil) ---

  overridesVp(): OverridesResponsive {
    const vista = this.viewport();
    if (vista === 'desktop') return {};
    return this.bloque().estilos?.responsive?.[vista] ?? {};
  }

  tieneOverridesVp(): boolean {
    return Object.keys(this.overridesVp()).length > 0;
  }

  patchOverride(cambios: Partial<OverridesResponsive>): void {
    const vista = this.viewport();
    if (vista === 'desktop') return;
    const override: Record<string, unknown> = { ...this.overridesVp(), ...cambios };
    for (const clave of Object.keys(override)) {
      if (override[clave] === undefined) delete override[clave];
    }
    const responsive = { ...this.bloque().estilos?.responsive };
    if (Object.keys(override).length > 0) {
      responsive[vista] = override as OverridesResponsive;
    } else {
      delete responsive[vista];
    }
    this.patchEstilos({
      responsive: Object.keys(responsive).length > 0 ? responsive : undefined,
    });
  }

  // --- Divisores de seccion ---

  divisorDe(posicion: string): { tipo: string; color: string; altura?: number; voltear?: boolean } | undefined {
    return (this.b.estilos ?? {})[posicion];
  }

  cambiarTipoDivisor(posicion: string, tipo: string): void {
    if (!tipo) {
      this.patchEstilos({ [posicion]: undefined });
      return;
    }
    const actual = this.divisorDe(posicion);
    this.patchEstilos({
      [posicion]: { tipo, color: actual?.color ?? '#ffffff', altura: actual?.altura ?? 60 },
    });
  }

  patchDivisor(posicion: string, cambios: object): void {
    const actual = this.divisorDe(posicion);
    if (!actual) return;
    const nuevo = { ...actual, ...cambios } as Record<string, unknown>;
    for (const clave of Object.keys(nuevo)) {
      if (nuevo[clave] === undefined) delete nuevo[clave];
    }
    this.patchEstilos({ [posicion]: nuevo });
  }

  quitarOverridesVp(): void {
    const vista = this.viewport();
    if (vista === 'desktop') return;
    const responsive = { ...this.bloque().estilos?.responsive };
    delete responsive[vista];
    this.patchEstilos({
      responsive: Object.keys(responsive).length > 0 ? responsive : undefined,
    });
  }

  espaciadoVp(): string {
    if (this.viewport() === 'desktop') return this.b.estilos?.paddingY ?? 'normal';
    return this.overridesVp().paddingY ?? this.b.estilos?.paddingY ?? 'normal';
  }

  cambiarEspaciado(valor: 'compacto' | 'normal' | 'amplio'): void {
    if (this.viewport() === 'desktop') {
      this.patchEstilos({ paddingY: valor });
    } else {
      this.patchOverride({ paddingY: valor });
    }
  }

  anchoBloqueVp(): string {
    if (this.viewport() === 'desktop') return this.b.estilos?.anchoBloque ?? 'completo';
    return this.overridesVp().anchoBloque ?? this.b.estilos?.anchoBloque ?? 'completo';
  }

  cambiarAnchoBloque(valor: 'completo' | 'mitad' | 'tercio' | 'dosTercios'): void {
    if (this.viewport() === 'desktop') {
      this.patchEstilos({ anchoBloque: valor });
    } else {
      this.patchOverride({ anchoBloque: valor });
    }
  }

  readonly metodosDisponibles = [
    { id: 'efectivo' as const, nombre: 'Efectivo' },
    { id: 'transferencia' as const, nombre: 'Transferencia bancaria' },
    { id: 'tarjeta' as const, nombre: 'Tarjeta' },
    { id: 'deuna' as const, nombre: 'De Una' },
    { id: 'payphone' as const, nombre: 'Payphone' },
  ];

  /** Acceso laxo para el template (el @switch del template garantiza el tipo real). */
  get b(): any {
    return this.bloque();
  }

  numero(valor: unknown): number {
    return Number(valor);
  }

  /** timestamp (ms) -> valor de <input type=datetime-local> en hora local. */
  fechaLocal(timestamp: number): string {
    const fecha = new Date(timestamp || Date.now());
    const dosDigitos = (n: number): string => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}T${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
  }

  aTimestamp(valor: string): number {
    const ms = new Date(valor).getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }

  patch(cambios: object): void {
    this.bloqueChange.emit({ ...this.bloque(), ...cambios } as Bloque);
  }

  patchEstilos(cambios: object): void {
    const estilos = { ...(this.b.estilos ?? {}), ...cambios };
    for (const clave of Object.keys(estilos)) {
      if ((estilos as Record<string, unknown>)[clave] === undefined) {
        delete (estilos as Record<string, unknown>)[clave];
      }
    }
    this.patch({ estilos });
  }

  patchPlan(indice: number, cambios: object): void {
    const planes = (this.b.planes as Record<string, unknown>[]).map((plan, i) => {
      if (i !== indice) return plan;
      const nuevo = { ...plan, ...cambios } as Record<string, unknown>;
      // Las claves puestas explicitamente en undefined se eliminan (RTDB las rechaza).
      for (const clave of Object.keys(nuevo)) {
        if (nuevo[clave] === undefined) delete nuevo[clave];
      }
      return nuevo;
    });
    this.patch({ planes });
  }

  patchItem(campo: string, indice: number, cambios: object): void {
    const lista = [...(this.b[campo] as object[])];
    lista[indice] = { ...lista[indice], ...cambios };
    this.patch({ [campo]: lista });
  }

  agregarItem(campo: string, item: object): void {
    this.patch({ [campo]: [...(this.b[campo] as object[]), item] });
  }

  quitarItem(campo: string, indice: number): void {
    this.patch({ [campo]: (this.b[campo] as object[]).filter((_, i) => i !== indice) });
  }

  patchEstiloTexto(cambios: object): void {
    const estiloTexto = { ...(this.b.estiloTexto ?? {}), ...cambios };
    for (const clave of Object.keys(estiloTexto)) {
      if ((estiloTexto as Record<string, unknown>)[clave] === undefined) {
        delete (estiloTexto as Record<string, unknown>)[clave];
      }
    }
    this.patch({ estiloTexto });
  }

  patchElementoLienzo(indice: number, cambios: object): void {
    const elementos = (this.b.elementos as object[]).map((elemento, i) =>
      i === indice ? { ...elemento, ...cambios } : elemento,
    );
    this.patch({ elementos });
  }

  patchCuadricula(cambios: object): void {
    this.patch({
      cuadricula: { activa: false, tamano: 20, ajustar: false, ...(this.b.cuadricula ?? {}), ...cambios },
    });
  }

  patchVisibilidadElemento(indice: number, oculto: boolean): void {
    const elemento = this.b.elementos[indice] as { ocultoEn?: object };
    this.patchElementoLienzo(indice, {
      ocultoEn: { ...(elemento.ocultoEn ?? {}), [this.viewport()]: oculto },
    });
  }

  patchEstiloElementoLienzo(indice: number, cambios: object): void {
    const elemento = this.b.elementos[indice] as { estiloTexto?: object };
    const estiloTexto = { ...(elemento.estiloTexto ?? {}), ...cambios };
    for (const clave of Object.keys(estiloTexto)) {
      if ((estiloTexto as Record<string, unknown>)[clave] === undefined) {
        delete (estiloTexto as Record<string, unknown>)[clave];
      }
    }
    this.patchElementoLienzo(indice, { estiloTexto });
  }

  agregarColumna(): void {
    const columnas = [...this.b.columnas];
    if (columnas.length >= 4) return;
    columnas.push({ id: `c-${Date.now().toString(36)}`, elementos: [] });
    this.patch({ columnas });
  }

  quitarColumna(): void {
    const columnas = [...this.b.columnas];
    if (columnas.length <= 1) return;
    columnas.pop();
    this.patch({ columnas });
  }

  patchElementoColumna(ci: number, ei: number, cambios: object): void {
    const columnas = (this.b.columnas as { id: string; elementos: object[] }[]).map((columna) => ({
      ...columna,
      elementos: [...columna.elementos],
    }));
    columnas[ci].elementos[ei] = { ...columnas[ci].elementos[ei], ...cambios };
    this.patch({ columnas });
  }

  toggleCta(mostrar: boolean): void {
    this.patch({
      cta: mostrar
        ? { texto: 'Conocer más', enlace: '#', variante: 'primario', colorFondo: '#f59e0b', colorTexto: '#ffffff' }
        : undefined,
    });
  }

  limpiarColorTexto(estilo?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!estilo) return undefined;
    const { color: _color, ...resto } = estilo;
    return Object.keys(resto).length ? resto : undefined;
  }

  patchCta(cambios: object): void {
    this.patch({ cta: { ...this.b.cta, ...cambios } });
  }

  toggleMetodo(metodo: string, activo: boolean): void {
    const metodos: string[] = this.b.metodos;
    this.patch({ metodos: activo ? [...metodos, metodo] : metodos.filter((m) => m !== metodo) });
  }

  toggleProducto(productoId: string, activo: boolean): void {
    const ids: string[] = this.b.origen.productoIds;
    this.patch({
      origen: {
        modo: 'seleccion',
        productoIds: activo ? [...ids, productoId] : ids.filter((id) => id !== productoId),
      },
    });
  }

  cambiarModoOrigen(modo: 'seleccion' | 'categoria'): void {
    if (modo === 'categoria') {
      const primera = this.categorias()[0];
      this.patch({ origen: { modo: 'categoria', categoriaId: primera?.id ?? '' } });
    } else {
      this.patch({ origen: { modo: 'seleccion', productoIds: [] } });
    }
  }

}

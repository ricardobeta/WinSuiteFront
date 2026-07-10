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
  imports: [FormsModule, SlicePipe, MatIconModule, SelectorImagenComponent],
  template: `
    <div class="panel">
      <h3>Propiedades · {{ bloque().tipo }}</h3>

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
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.mostrarPrecio"
              (ngModelChange)="patch({ mostrarPrecio: $event })"
            />
            Mostrar precio
          </label>
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
                @for (pagina of paginas(); track pagina.id) {
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

      <h4>Seccion</h4>
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
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      background: #fff;
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
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      background: #fff;
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
      border: 1px solid rgba(0, 0, 0, 0.08);
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
      border: 1px dashed rgba(0, 0, 0, 0.25);
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 0.82rem;
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
      border: 1px solid rgba(0, 0, 0, 0.08);
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
      background: #eff6ff;
      color: #1d4ed8;
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
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      background: #fff;
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 5px;
    }
    .preset {
      aspect-ratio: 1;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
    }
    .preset:hover {
      outline: 2px solid #2563eb;
      outline-offset: 1px;
    }
    .codigo {
      font-family: monospace;
      font-size: 0.78rem;
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

  constructor() {
    // Al cambiar de bloque seleccionado, el tipo de fondo vuelve a derivarse de sus datos.
    effect(() => {
      this.bloque().id;
      this.tipoFondoManual.set(null);
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
      this.patchEstilos({ fondoGradiente: undefined, fondoImagenUrl: undefined, fondoVelo: undefined });
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
    this.patch({ cta: mostrar ? { texto: 'Conocer mas', enlace: '#' } : undefined });
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

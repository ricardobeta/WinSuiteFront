import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Bloque, CATALOGO_PRODUCTOS, PaginaDoc } from '@winsuite/bloques';
import { CategoriasService } from '../../../inventario/services/categorias.service';
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
          <div class="fila">
            <label>
              Tamano
              <select
                [ngModel]="b.estiloTexto?.tamano ?? 'normal'"
                (ngModelChange)="patchEstiloTexto({ tamano: $event })"
              >
                <option value="sm">Pequeno</option>
                <option value="normal">Normal</option>
                <option value="lg">Grande</option>
                <option value="xl">Muy grande</option>
                <option value="2xl">Gigante</option>
              </select>
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
                  <select
                    [ngModel]="elemento.estiloTexto?.tamano ?? 'normal'"
                    (ngModelChange)="patchEstiloElementoLienzo(ei, { tamano: $event })"
                  >
                    <option value="sm">Pequeno</option>
                    <option value="normal">Normal</option>
                    <option value="lg">Grande</option>
                    <option value="xl">Muy grande</option>
                    <option value="2xl">Gigante</option>
                  </select>
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
          <h4>Campos</h4>
          @for (campo of b.campos; track campo.id; let i = $index) {
            <div class="item-lista columna">
              <input
                placeholder="Etiqueta"
                [ngModel]="campo.etiqueta"
                (ngModelChange)="patchItem('campos', i, { etiqueta: $event })"
              />
              <select [ngModel]="campo.tipo" (ngModelChange)="cambiarTipoCampo(i, $event)">
                <option value="texto">Texto</option>
                <option value="email">Email</option>
                <option value="telefono">Telefono</option>
                <option value="textarea">Parrafo</option>
                <option value="seleccion">Seleccion</option>
              </select>
              @if (campo.tipo === 'seleccion') {
                <input
                  placeholder="Opciones separadas por coma"
                  [ngModel]="opcionesTexto(campo)"
                  (ngModelChange)="patchItem('campos', i, { opciones: aOpciones($event) })"
                />
              }
              <label class="check">
                <input
                  type="checkbox"
                  [ngModel]="campo.requerido"
                  (ngModelChange)="patchItem('campos', i, { requerido: $event })"
                />
                Obligatorio
              </label>
              <button type="button" class="quitar" (click)="quitarItem('campos', i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button type="button" class="agregar" (click)="agregarCampoFormulario()">
            <mat-icon>add</mat-icon> Agregar campo
          </button>
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
      <label>
        Fondo
        <div class="fila-fondo">
          <input
            type="color"
            [ngModel]="b.estilos?.fondo ?? '#ffffff'"
            (ngModelChange)="patchEstilos({ fondo: $event })"
          />
          <button type="button" class="agregar" (click)="patchEstilos({ fondo: undefined })">
            Fondo del tema
          </button>
        </div>
      </label>
      <div class="campo">
        <span>Imagen de fondo</span>
        <app-selector-imagen
          [url]="b.estilos?.fondoImagenUrl"
          (urlChange)="patchEstilos({ fondoImagenUrl: $event })"
        />
        @if (b.estilos?.fondoImagenUrl) {
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="b.estilos?.fondoVelo ?? false"
              (ngModelChange)="patchEstilos({ fondoVelo: $event || undefined })"
            />
            Oscurecer fondo (texto mas legible)
          </label>
          <button
            type="button"
            class="agregar"
            (click)="patchEstilos({ fondoImagenUrl: undefined, fondoVelo: undefined })"
          >
            Quitar imagen de fondo
          </button>
        }
      </div>
      <div class="fila">
        <label>
          Espaciado
          <select
            [ngModel]="b.estilos?.paddingY ?? 'normal'"
            (ngModelChange)="patchEstilos({ paddingY: $event })"
          >
            <option value="compacto">Compacto</option>
            <option value="normal">Normal</option>
            <option value="amplio">Amplio</option>
          </select>
        </label>
        <label>
          Ancho
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
  `,
})
export class PanelPropiedadesComponent {
  private readonly categoriasService = inject(CategoriasService);
  private readonly catalogo = inject(CATALOGO_PRODUCTOS);

  readonly bloque = input.required<Bloque>();
  readonly paginas = input<PaginaDoc[]>([]);
  readonly bloqueChange = output<Bloque>();

  readonly categorias = toSignal(this.categoriasService.getCategorias(), { initialValue: [] });
  readonly productosCatalogo = computed(() => this.catalogo.productos());

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

  cambiarTipoCampo(indice: number, tipo: string): void {
    if (tipo === 'seleccion') {
      this.patchItem('campos', indice, { tipo, opciones: ['Opcion 1', 'Opcion 2'] });
    } else {
      const campo = { ...(this.b.campos[indice] as Record<string, unknown>) };
      delete campo['opciones'];
      const campos = [...(this.b.campos as object[])];
      campos[indice] = { ...campo, tipo };
      this.patch({ campos });
    }
  }

  agregarCampoFormulario(): void {
    this.agregarItem('campos', {
      id: `c-${Date.now().toString(36)}`,
      tipo: 'texto',
      etiqueta: 'Nuevo campo',
      requerido: false,
    });
  }

  opcionesTexto(campo: { opciones?: string[] }): string {
    return (campo.opciones ?? []).join(', ');
  }

  aOpciones(texto: string): string[] {
    return texto
      .split(',')
      .map((opcion) => opcion.trim())
      .filter(Boolean);
  }
}

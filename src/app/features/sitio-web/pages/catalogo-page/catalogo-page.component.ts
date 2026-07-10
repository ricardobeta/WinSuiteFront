import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductosService } from '../../../inventario/services/productos.service';
import { Producto } from '../../../inventario/models/inventario.models';
import { CatalogoPublicacionService } from '../../services/catalogo-publicacion.service';
import { SelectorImagenComponent } from '../../components/selector-imagen/selector-imagen.component';

/**
 * Catalogo de la tienda: que productos del inventario se muestran en el sitio publico
 * y con que imagenes. El catalogo es del negocio (compartido por sus sitios ecommerce).
 */
@Component({
  selector: 'app-catalogo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    SelectorImagenComponent,
  ],
  template: `
    <div class="pagina">
      <div class="cabecera">
        <div>
          <h2>Catalogo de la tienda</h2>
          <p class="ayuda">
            Activa los productos que quieres mostrar en tu sitio y asignales una imagen. El precio
            se toma del inventario al publicar.
          </p>
        </div>
        <button mat-stroked-button (click)="refrescar()" [disabled]="refrescando()">
          <mat-icon>sync</mat-icon>
          {{ refrescando() ? 'Actualizando...' : 'Actualizar precios' }}
        </button>
      </div>

      <input
        class="buscador"
        type="search"
        placeholder="Buscar producto..."
        (input)="filtro.set($any($event.target).value)"
      />

      <div class="lista">
        @for (producto of productosFiltrados(); track producto.id) {
          <div class="fila" [class.publicado]="esVisible(producto.id!)">
            <mat-slide-toggle
              [checked]="esVisible(producto.id!)"
              (change)="alternarVisible(producto, $event.checked)"
            />
            <div class="datos">
              <strong>{{ producto.nombre }}</strong>
              <span class="precio">{{ producto.precioVenta | currency: 'USD' }}</span>
            </div>
            @if (esVisible(producto.id!)) {
              <div class="imagen">
                <app-selector-imagen
                  [url]="imagenDe(producto.id!)"
                  (urlChange)="cambiarImagen(producto.id!, $event)"
                />
              </div>
              <button
                mat-icon-button
                [title]="'Ficha de tienda (galeria, badge, descripcion)'"
                (click)="fichaAbierta.set(fichaAbierta() === producto.id ? null : producto.id!)"
              >
                <mat-icon>{{ fichaAbierta() === producto.id ? 'expand_less' : 'edit_note' }}</mat-icon>
              </button>
            }
          </div>
          @if (esVisible(producto.id!) && fichaAbierta() === producto.id) {
            <div class="ficha">
              <div class="campo">
                <span class="etiqueta">Galeria (la 2da imagen aparece al pasar el mouse)</span>
                <div class="galeria">
                  @for (imagen of imagenesDe(producto.id!); track $index; let i = $index) {
                    <div class="mini">
                      <img [src]="imagen" alt="" />
                      <button type="button" class="quitar" (click)="quitarImagen(producto.id!, i)">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                  <app-selector-imagen (urlChange)="agregarImagen(producto.id!, $event)" />
                </div>
              </div>
              <label>
                Badge de la tarjeta (ej. "Nuevo", "Oferta")
                <input
                  maxlength="20"
                  [value]="catalogoDe(producto.id!)?.badge ?? ''"
                  (change)="guardarFicha(producto.id!, 'badge', $any($event.target).value)"
                />
              </label>
              <label>
                Descripcion larga (pagina propia del producto)
                <textarea
                  rows="5"
                  maxlength="20000"
                  placeholder="Cuenta todo sobre este producto: beneficios, materiales, medidas..."
                  [value]="catalogoDe(producto.id!)?.descripcionLarga ?? ''"
                  (change)="guardarFicha(producto.id!, 'descripcionLarga', $any($event.target).value)"
                ></textarea>
              </label>
            </div>
          }
        } @empty {
          <p class="vacio">No hay productos activos en el inventario.</p>
        }
      </div>
    </div>
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 860px;
      margin-inline: auto;
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    h2 {
      margin: 0 0 4px;
    }
    .ayuda {
      margin: 0 0 16px;
      opacity: 0.7;
      font-size: 0.9rem;
    }
    .buscador {
      width: 100%;
      font: inherit;
      padding: 10px 12px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      margin-bottom: 14px;
      box-sizing: border-box;
    }
    .lista {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .fila {
      display: flex;
      align-items: center;
      gap: 14px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      padding: 10px 14px;
      background: #fff;
    }
    .fila.publicado {
      border-color: #93c5fd;
    }
    .datos {
      display: flex;
      flex-direction: column;
      min-width: 180px;
    }
    .precio {
      opacity: 0.7;
      font-size: 0.88rem;
    }
    .imagen {
      flex: 1;
    }
    .vacio {
      text-align: center;
      opacity: 0.6;
      padding: 32px;
    }
    .ficha {
      border: 1px solid #93c5fd;
      border-top: none;
      border-radius: 0 0 10px 10px;
      margin-top: -8px;
      padding: 16px 14px 14px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ficha label,
    .ficha .campo {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .ficha input,
    .ficha textarea {
      font: inherit;
      font-weight: 400;
      padding: 8px 10px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      background: #fff;
    }
    .etiqueta {
      font-size: 0.85rem;
    }
    .galeria {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .mini {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .mini img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .mini .quitar {
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      border: none;
      border-radius: 999px;
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .mini .quitar mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
  `,
})
export class CatalogoPageComponent {
  private readonly productosService = inject(ProductosService);
  private readonly catalogoService = inject(CatalogoPublicacionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly filtro = signal('');
  readonly refrescando = signal(false);
  /** Producto con la ficha de tienda expandida. */
  readonly fichaAbierta = signal<string | null>(null);

  private readonly productos = toSignal(this.productosService.getProductos(), { initialValue: [] });
  private readonly catalogo = toSignal(this.catalogoService.getCatalogo(), {
    initialValue: {} as Record<string, import('@winsuite/bloques').ProductoPublicado>,
  });

  readonly productosFiltrados = computed(() => {
    const texto = this.filtro().toLowerCase().trim();
    return this.productos()
      .filter((producto) => producto.activo && producto.id)
      .filter((producto) => !texto || producto.nombre.toLowerCase().includes(texto));
  });

  esVisible(productoId: string): boolean {
    return this.catalogo()[productoId]?.visible ?? false;
  }

  imagenDe(productoId: string): string | undefined {
    return this.catalogo()[productoId]?.imagenes?.[0];
  }

  catalogoDe(productoId: string): import('@winsuite/bloques').ProductoPublicado | undefined {
    return this.catalogo()[productoId];
  }

  /** RTDB elimina arrays vacios; ademas puede devolver la lista como objeto indexado. */
  imagenesDe(productoId: string): string[] {
    const imagenes = this.catalogo()[productoId]?.imagenes;
    if (Array.isArray(imagenes)) return imagenes;
    return Object.values(imagenes ?? {});
  }

  async agregarImagen(productoId: string, url: string): Promise<void> {
    if (!url) return;
    await this.catalogoService.setImagenes(productoId, [...this.imagenesDe(productoId), url]);
  }

  async quitarImagen(productoId: string, indice: number): Promise<void> {
    await this.catalogoService.setImagenes(
      productoId,
      this.imagenesDe(productoId).filter((_, i) => i !== indice),
    );
  }

  async guardarFicha(
    productoId: string,
    campo: 'badge' | 'descripcionLarga',
    valor: string,
  ): Promise<void> {
    const actual = this.catalogoDe(productoId);
    try {
      await this.catalogoService.setFichaTienda(productoId, {
        badge: campo === 'badge' ? valor : actual?.badge,
        descripcionLarga: campo === 'descripcionLarga' ? valor : actual?.descripcionLarga,
      });
    } catch {
      this.snackBar.open('No se pudo guardar la ficha', 'OK', { duration: 4000 });
    }
  }

  async alternarVisible(producto: Producto, visible: boolean): Promise<void> {
    try {
      await this.catalogoService.setVisible(producto, visible);
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo actualizar', 'OK', {
        duration: 4000,
      });
    }
  }

  async cambiarImagen(productoId: string, url: string): Promise<void> {
    const existentes = this.catalogo()[productoId]?.imagenes ?? [];
    await this.catalogoService.setImagenes(productoId, [url, ...existentes.slice(1)]);
  }

  async refrescar(): Promise<void> {
    this.refrescando.set(true);
    try {
      await this.catalogoService.refrescarCatalogo();
      this.snackBar.open('Catalogo actualizado desde el inventario', 'OK', { duration: 3000 });
    } finally {
      this.refrescando.set(false);
    }
  }
}

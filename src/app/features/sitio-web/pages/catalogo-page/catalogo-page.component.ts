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
            }
          </div>
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
  `,
})
export class CatalogoPageComponent {
  private readonly productosService = inject(ProductosService);
  private readonly catalogoService = inject(CatalogoPublicacionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly filtro = signal('');
  readonly refrescando = signal(false);

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

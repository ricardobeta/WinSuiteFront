import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogoProductosPort, ProductoPublicado } from '@winsuite/bloques';
import { ProductosService } from '../../inventario/services/productos.service';
import { CatalogoPublicacionService } from './catalogo-publicacion.service';

/**
 * Implementacion del puerto CATALOGO_PRODUCTOS para el canvas del editor:
 * combina el inventario vivo con el overlay de publicacion (visible/imagenes/slug),
 * de modo que la vitrina del canvas se vea como se vera publicada.
 */
@Injectable()
export class CatalogoEditorAdapter implements CatalogoProductosPort {
  private readonly productosService = inject(ProductosService);
  private readonly catalogoService = inject(CatalogoPublicacionService);

  private readonly inventario = toSignal(this.productosService.getProductos(), {
    initialValue: [],
  });
  private readonly overlay = toSignal(this.catalogoService.getCatalogo(), {
    initialValue: {} as Record<string, ProductoPublicado>,
  });

  readonly productos: Signal<ProductoPublicado[]> = computed(() => {
    const publicados = this.overlay();
    return this.inventario()
      .filter((producto) => producto.activo && producto.id)
      .map((producto) => {
        const existente = publicados[producto.id as string];
        return this.catalogoService.aProductoPublicado(producto, {
          visible: existente?.visible ?? false,
          imagenes: existente?.imagenes ?? [],
          slug: existente?.slug,
        });
      });
  });
}

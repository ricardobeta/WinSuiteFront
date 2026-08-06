import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CategoriaCatalogo, CatalogoProductosPort, ProductoPublicado } from '@winsuite/bloques';
import { ProductosService } from '../../inventario/services/productos.service';
import { CategoriasService } from '../../inventario/services/categorias.service';
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
  private readonly categoriasService = inject(CategoriasService);

  private readonly inventario = toSignal(this.productosService.getProductos(), {
    initialValue: [],
  });
  private readonly overlay = toSignal(this.catalogoService.getCatalogo(), {
    initialValue: {} as Record<string, ProductoPublicado>,
  });
  private readonly config = toSignal(this.catalogoService.getFuentesConfig(), { initialValue: null });
  private readonly categoriasInventario = toSignal(this.categoriasService.getCategorias(), { initialValue: [] });

  readonly productos: Signal<ProductoPublicado[]> = computed(() => {
    const publicados = this.overlay();
    const activas = new Set(this.config()?.fuentesActivas ?? ['inventario', 'manual']);
    const categoriaPorId = new Map(this.categoriasInventario().map((categoria) => [categoria.id, categoria.nombre]));
    const inventario = this.inventario()
      .filter((producto) => producto.activo && producto.id)
      .map((producto) => {
        const existente = publicados[producto.id as string];
        const base = this.catalogoService.aProductoPublicado(producto, {
          visible: existente?.visible ?? false,
          imagenes: existente?.imagenes ?? [],
          slug: existente?.slug,
          categoriaNombre: existente?.categoriaNombre ?? categoriaPorId.get(producto.categoriaId),
        });
        return { ...base, descripcionLarga: existente?.descripcionLarga, badge: existente?.badge };
      });
    const manuales = Object.values(publicados).filter((producto) => producto.fuente?.tipo === 'manual');
    return [
      ...(activas.has('inventario') ? inventario : []),
      ...(activas.has('manual') ? manuales : []),
    ];
  });

  readonly categorias: Signal<CategoriaCatalogo[]> = computed(() => {
    const mapa = new Map<string, CategoriaCatalogo>();
    for (const producto of this.productos()) {
      if (producto.categoriaId) mapa.set(producto.categoriaId, {
        id: producto.categoriaId, nombre: producto.categoriaNombre || producto.categoriaId,
      });
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
}

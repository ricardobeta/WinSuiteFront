import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, update } from '@angular/fire/database';
import { Observable, firstValueFrom } from 'rxjs';
import { ProductoPublicado, slugify } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { ProductosService } from '../../inventario/services/productos.service';
import { Producto } from '../../inventario/models/inventario.models';

/**
 * Capa de publicacion del catalogo: sitios_catalogo/{tenantId}/productos/{productoId}.
 * Guarda el snapshot PUBLICO de cada producto (sin precioCosto ni datos internos).
 * La pestana Catalogo edita visible/imagenes; nombre/precio se refrescan desde el
 * inventario en cada "Publicar" (o con el boton "Actualizar catalogo").
 */
@Injectable({ providedIn: 'root' })
export class CatalogoPublicacionService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly productosService = inject(ProductosService);

  private catalogoPath(): string {
    return `sitios_catalogo/${this.authService.getTenantId()}/productos`;
  }

  getCatalogo(): Observable<Record<string, ProductoPublicado>> {
    return new Observable((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.catalogoPath()),
        (snapshot) => subscriber.next((snapshot.val() ?? {}) as Record<string, ProductoPublicado>),
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async setVisible(producto: Producto, visible: boolean): Promise<void> {
    const productoId = producto.id;
    if (!productoId) return;
    const existente = await get(ref(this.database, `${this.catalogoPath()}/${productoId}`));
    if (existente.exists()) {
      await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), {
        visible,
        actualizadoEn: Date.now(),
      });
      return;
    }
    const publicado = this.aProductoPublicado(producto, { visible, imagenes: [] });
    await update(ref(this.database), { [`${this.catalogoPath()}/${productoId}`]: publicado });
  }

  async setImagenes(productoId: string, imagenes: string[]): Promise<void> {
    await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), {
      imagenes,
      actualizadoEn: Date.now(),
    });
  }

  /** Ficha de tienda del producto: descripcion larga (pagina propia) y badge de la tarjeta. */
  async setFichaTienda(
    productoId: string,
    ficha: { descripcionLarga?: string; badge?: string },
  ): Promise<void> {
    await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), {
      descripcionLarga: ficha.descripcionLarga?.trim() || null,
      badge: ficha.badge?.trim() || null,
      actualizadoEn: Date.now(),
    });
  }

  /**
   * Cambios multipath que refrescan nombre/precio/categoria de todos los productos ya
   * publicados desde el inventario actual. Los usa "Publicar" para no dejar precios viejos.
   */
  async cambiosRefrescoCatalogo(): Promise<Record<string, unknown>> {
    const [catalogo, productos] = await Promise.all([
      get(ref(this.database, this.catalogoPath())),
      firstValueFrom(this.productosService.getProductos()),
    ]);
    const publicados = (catalogo.val() ?? {}) as Record<string, ProductoPublicado>;
    const cambios: Record<string, unknown> = {};
    const ahora = Date.now();

    for (const [productoId, publicado] of Object.entries(publicados)) {
      const producto = productos.find((p) => p.id === productoId);
      if (!producto || !producto.activo) {
        // El producto ya no existe o esta inactivo: se oculta de la tienda.
        cambios[`${this.catalogoPath()}/${productoId}/visible`] = false;
        cambios[`${this.catalogoPath()}/${productoId}/actualizadoEn`] = ahora;
        continue;
      }
      cambios[`${this.catalogoPath()}/${productoId}/nombre`] = producto.nombre;
      cambios[`${this.catalogoPath()}/${productoId}/descripcion`] = producto.descripcion ?? null;
      cambios[`${this.catalogoPath()}/${productoId}/precioVenta`] = producto.precioVenta;
      cambios[`${this.catalogoPath()}/${productoId}/ivaPorcentaje`] = producto.ivaPorcentaje;
      cambios[`${this.catalogoPath()}/${productoId}/categoriaId`] = producto.categoriaId;
      cambios[`${this.catalogoPath()}/${productoId}/slug`] =
        publicado.slug || slugify(producto.nombre);
      cambios[`${this.catalogoPath()}/${productoId}/actualizadoEn`] = ahora;
    }
    return cambios;
  }

  async refrescarCatalogo(): Promise<void> {
    const cambios = await this.cambiosRefrescoCatalogo();
    if (Object.keys(cambios).length > 0) {
      await update(ref(this.database), cambios);
    }
  }

  aProductoPublicado(
    producto: Producto,
    overlay: { visible: boolean; imagenes: string[]; slug?: string },
  ): ProductoPublicado {
    return {
      productoId: producto.id ?? '',
      slug: overlay.slug || slugify(producto.nombre),
      nombre: producto.nombre,
      ...(producto.descripcion ? { descripcion: producto.descripcion } : {}),
      precioVenta: producto.precioVenta,
      ivaPorcentaje: producto.ivaPorcentaje,
      categoriaId: producto.categoriaId,
      imagenes: overlay.imagenes,
      visible: overlay.visible,
      actualizadoEn: Date.now(),
    };
  }
}

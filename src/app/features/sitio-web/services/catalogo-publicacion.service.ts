import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, update } from 'firebase/database';
import { Observable, firstValueFrom, from, switchMap } from 'rxjs';
import { CatalogoFuentesConfig, FuenteCatalogo, ProductoPublicado, slugify } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { ProductosService } from '../../inventario/services/productos.service';
import { CategoriasService } from '../../inventario/services/categorias.service';
import { Producto } from '../../inventario/models/inventario.models';
import { esVendibleEnPos } from '../../inventario/utils/producto.util';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';
import { SitioMediaService } from './sitio-media.service';

/** Desenlace de copiar la foto de inventario al bucket publico de sitios. */
export type ResultadoCopiaImagen =
  | { estado: 'copiada'; url: string }
  | { estado: 'sin-imagen' }
  | { estado: 'sin-cupo' }
  | { estado: 'error'; motivo: string };

/**
 * Capa de publicacion del catalogo: sitios_catalogo/{tenantId}/productos/{productoId}.
 * Guarda el snapshot PUBLICO de cada producto (sin precioCosto ni datos internos).
 * La pestana Catalogo edita visible/imagenes; nombre/precio se refrescan desde el
 * inventario en cada "Publicar" (o con el boton "Actualizar catalogo").
 */
@Injectable({ providedIn: 'root' })
export class CatalogoPublicacionService {
  private readonly database = inject(SITES_DATABASE);
  private readonly authService = inject(AuthService);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);
  private readonly sitioMedia = inject(SitioMediaService);

  private catalogoPath(): string {
    return `sitios_catalogo/${this.authService.getTenantId()}/productos`;
  }

  getCatalogo(): Observable<Record<string, ProductoPublicado>> {
    return from(this.sitesSession.ensureReady()).pipe(switchMap(() => new Observable<Record<string, ProductoPublicado>>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.catalogoPath()),
        (snapshot) => subscriber.next((snapshot.val() ?? {}) as Record<string, ProductoPublicado>),
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    })));
  }

  private configPath(): string { return `sitios_catalogo_config/${this.authService.getTenantId()}`; }

  getFuentesConfig(): Observable<CatalogoFuentesConfig | null> {
    return from(this.sitesSession.ensureReady()).pipe(switchMap(() => new Observable<CatalogoFuentesConfig | null>((subscriber) => {
      const unsubscribe = onValue(ref(this.database, this.configPath()),
        (snapshot) => subscriber.next(snapshot.exists() ? snapshot.val() as CatalogoFuentesConfig : null),
        (error) => subscriber.error(error));
      return () => unsubscribe();
    })));
  }

  async guardarFuentesConfig(fuentesActivas: FuenteCatalogo[]): Promise<void> {
    await this.sitesSession.ensureReady();
    const config: CatalogoFuentesConfig = {
      wizardCompletado: true,
      fuentesActivas: [...new Set(fuentesActivas.filter((fuente) => fuente !== 'dropi'))],
      actualizadoEn: Date.now(),
    };
    await update(ref(this.database, this.configPath()), config);
  }

  /**
   * Publica u oculta un producto del inventario.
   *
   * @returns como acabo la copia de la imagen; el producto se publica en cualquier caso.
   */
  async setVisible(producto: Producto, visible: boolean): Promise<ResultadoCopiaImagen> {
    await this.sitesSession.ensureReady();
    const productoId = producto.id;
    if (!productoId) return { estado: 'sin-imagen' };
    const existente = await get(ref(this.database, `${this.catalogoPath()}/${productoId}`));
    if (existente.exists()) {
      await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), {
        visible,
        actualizadoEn: Date.now(),
      });
      return { estado: 'sin-imagen' };
    }

    // La tienda nunca sirve la foto privada del inventario: se copia al bucket publico.
    const copia: ResultadoCopiaImagen = visible
      ? await this.copiarImagenDeInventario(producto)
      : { estado: 'sin-imagen' };

    const categorias = await this.categoriasService.getCategoriasOnce();
    const publicado = this.aProductoPublicado(producto, {
      visible,
      imagenes: copia.estado === 'copiada' ? [copia.url] : [],
      categoriaNombre: categorias.find((categoria) => categoria.id === producto.categoriaId)?.nombre,
    });
    await update(ref(this.database), { [`${this.catalogoPath()}/${productoId}`]: publicado });

    return copia;
  }

  /**
   * Copia la foto de inventario al bucket publico de sitios.
   *
   * Nunca lanza: una foto no debe impedir publicar el producto. Distingue quedarse sin
   * cupo de un fallo tecnico, porque mandar a comprar plan cuando el problema es otro
   * seria enganoso.
   */
  async copiarImagenDeInventario(producto: Producto): Promise<ResultadoCopiaImagen> {
    const origen = producto.imagen?.url;
    if (!origen) return { estado: 'sin-imagen' };

    try {
      const url = await this.sitioMedia.copiarDesdeUrl(origen, slugify(producto.nombre) || 'producto');
      return url ? { estado: 'copiada', url } : { estado: 'sin-cupo' };
    } catch (error) {
      console.warn('No se pudo copiar la imagen del producto al espacio publico', error);
      return { estado: 'error', motivo: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }

  async setImagenes(productoId: string, imagenes: string[]): Promise<void> {
    await this.sitesSession.ensureReady();
    await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), {
      imagenes,
      actualizadoEn: Date.now(),
    });
  }

  async setVisiblePorId(productoId: string, visible: boolean): Promise<void> {
    await this.sitesSession.ensureReady();
    await update(ref(this.database, `${this.catalogoPath()}/${productoId}`), { visible, actualizadoEn: Date.now() });
  }

  async guardarProductoManual(producto: {
    productoId?: string; nombre: string; descripcion?: string; descripcionLarga?: string;
    precioVenta: number; ivaPorcentaje: number; categoriaNombre: string; badge?: string; imagenes: string[];
    visible: boolean;
  }): Promise<string> {
    await this.sitesSession.ensureReady();
    const productoId = producto.productoId || `web_${push(ref(this.database, this.catalogoPath())).key}`;
    const snapshotExistente = producto.productoId
      ? await get(ref(this.database, `${this.catalogoPath()}/${productoId}`))
      : null;
    const existente = snapshotExistente?.exists() ? snapshotExistente.val() as ProductoPublicado : null;
    if (existente && existente.fuente?.tipo !== 'manual') {
      throw new Error('Solo se pueden editar productos creados en Sitios Web.');
    }
    const publicado: ProductoPublicado = {
      productoId,
      slug: existente?.slug || slugify(producto.nombre) || productoId,
      nombre: producto.nombre.trim(),
      ...(producto.descripcion?.trim() ? { descripcion: producto.descripcion.trim() } : {}),
      ...(producto.descripcionLarga?.trim() ? { descripcionLarga: producto.descripcionLarga.trim() } : {}),
      ...(producto.badge?.trim() ? { badge: producto.badge.trim() } : {}),
      precioVenta: Number(producto.precioVenta.toFixed(2)),
      ivaPorcentaje: producto.ivaPorcentaje,
      categoriaId: slugify(producto.categoriaNombre) || 'sin-categoria',
      categoriaNombre: producto.categoriaNombre.trim() || 'Sin categoria',
      fuente: { tipo: 'manual' },
      imagenes: producto.imagenes.filter(Boolean).slice(0, 10),
      visible: producto.visible,
      actualizadoEn: Date.now(),
    };
    await update(ref(this.database), { [`${this.catalogoPath()}/${productoId}`]: publicado });
    return productoId;
  }

  async eliminarProductoManual(productoId: string): Promise<void> {
    await this.sitesSession.ensureReady();
    const snapshot = await get(ref(this.database, `${this.catalogoPath()}/${productoId}`));
    const producto = snapshot.val() as ProductoPublicado | null;
    if (producto?.fuente?.tipo !== 'manual') throw new Error('Solo se pueden eliminar productos creados en Sitios Web.');
    await remove(ref(this.database, `${this.catalogoPath()}/${productoId}`));
  }

  /** Ficha de tienda del producto: descripcion larga (pagina propia) y badge de la tarjeta. */
  async setFichaTienda(
    productoId: string,
    ficha: { descripcionLarga?: string; badge?: string },
  ): Promise<void> {
    await this.sitesSession.ensureReady();
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
    await this.sitesSession.ensureReady();
    const [catalogo, productos, categorias] = await Promise.all([
      get(ref(this.database, this.catalogoPath())),
      firstValueFrom(this.productosService.getProductos()),
      this.categoriasService.getCategoriasOnce(),
    ]);
    const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]));
    const publicados = (catalogo.val() ?? {}) as Record<string, ProductoPublicado>;
    const cambios: Record<string, unknown> = {};
    const ahora = Date.now();

    for (const [productoId, publicado] of Object.entries(publicados)) {
      if (publicado.fuente?.tipo === 'manual' || publicado.fuente?.tipo === 'dropi') continue;
      const producto = productos.find((p) => p.id === productoId);
      if (!producto || !esVendibleEnPos(producto)) {
        // Se oculta de la tienda si el producto ya no existe, quedo inactivo, o paso a
        // ser materia prima o plantilla de variantes (que no se venden por si mismas).
        cambios[`${this.catalogoPath()}/${productoId}/visible`] = false;
        cambios[`${this.catalogoPath()}/${productoId}/actualizadoEn`] = ahora;
        continue;
      }
      cambios[`${this.catalogoPath()}/${productoId}/nombre`] = producto.nombre;
      cambios[`${this.catalogoPath()}/${productoId}/descripcion`] = producto.descripcion ?? null;
      cambios[`${this.catalogoPath()}/${productoId}/precioVenta`] = producto.precioVenta;
      cambios[`${this.catalogoPath()}/${productoId}/ivaPorcentaje`] = producto.ivaPorcentaje;
      cambios[`${this.catalogoPath()}/${productoId}/categoriaId`] = producto.categoriaId;
      cambios[`${this.catalogoPath()}/${productoId}/categoriaNombre`] = categoriaPorId.get(producto.categoriaId) ?? producto.categoriaId;
      // `imagenes` no se toca aqui: la tienda sirve copias propias del bucket publico y
      // crearlas exige subir bytes y reservar cuota, cosa que este multipath no puede hacer.
      // Se publican al hacer visible el producto o desde "Usar la imagen del inventario".
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
    overlay: { visible: boolean; imagenes: string[]; slug?: string; categoriaNombre?: string },
  ): ProductoPublicado {
    return {
      productoId: producto.id ?? '',
      slug: overlay.slug || slugify(producto.nombre),
      nombre: producto.nombre,
      ...(producto.descripcion ? { descripcion: producto.descripcion } : {}),
      precioVenta: producto.precioVenta,
      ivaPorcentaje: producto.ivaPorcentaje,
      categoriaId: producto.categoriaId,
      categoriaNombre: overlay.categoriaNombre ?? producto.categoriaId,
      fuente: { tipo: 'inventario', referenciaId: producto.id ?? '' },
      imagenes: overlay.imagenes,
      visible: overlay.visible,
      actualizadoEn: Date.now(),
    };
  }
}

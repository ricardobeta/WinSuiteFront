import { SitioConfig, TipoSitio } from '@winsuite/bloques';

/** Resumen para las cards de "Mis sitios". */
export interface ResumenSitio {
  sitioId: string;
  config: SitioConfig;
  versionPublicada: number | null;
}

/** Limites de sitios por tenant (configurable por plan en el futuro). */
export const LIMITES_SITIOS: Record<TipoSitio, number> = {
  ecommerce: 1,
  landing: 3,
};

/** Overlay de publicacion por producto que se edita en la pestana Catalogo. */
export interface PublicacionProducto {
  productoId: string;
  slug: string;
  visible: boolean;
  imagenes: string[];
}

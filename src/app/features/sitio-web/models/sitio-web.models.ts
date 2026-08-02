import { SitioConfig } from '@winsuite/bloques';

/** Resumen para las cards de "Mis sitios". */
export interface ResumenSitio {
  sitioId: string;
  config: SitioConfig;
  versionPublicada: number | null;
}

/** Overlay de publicacion por producto que se edita en la pestana Catalogo. */
export interface PublicacionProducto {
  productoId: string;
  slug: string;
  visible: boolean;
  imagenes: string[];
}

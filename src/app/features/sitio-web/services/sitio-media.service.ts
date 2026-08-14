import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  FirebaseStorage,
  deleteObject,
  getDownloadURL,
  getMetadata,
  list as listStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { SITES_STORAGE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';
import { ArchivoItem } from '../../../shared/models/archivos.models';
import { IMAGEN_PRODUCTO_MAX_BYTES, redimensionarImagen } from '../../../shared/utils/imagen.util';

const TAMANO_MAXIMO = 5 * 1024 * 1024; // debe coincidir con sites-storage.rules
const TAMANO_PAGINA = 50;

/** El plan se quedo sin espacio de imagenes publicas. No es un error de la operacion. */
export class CuotaImagenesPublicasError extends Error {
  constructor() {
    super('Alcanzaste el limite de imagenes publicas de tu plan.');
    this.name = 'CuotaImagenesPublicasError';
  }
}

export interface SitioMediaPage {
  items: ArchivoItem[];
  nextPageToken: string | null;
}

/** Subida de imagenes del sitio a Storage: sitios/{tenantId}/media/... (lectura publica). */
@Injectable({ providedIn: 'root' })
export class SitioMediaService {
  private readonly storage: FirebaseStorage = inject(SITES_STORAGE);
  private readonly authService = inject(AuthService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);
  private readonly http = inject(HttpClient);

  async subirImagen(archivo: File): Promise<string> {
    return (await this.subirImagenComoArchivo(archivo)).downloadUrl;
  }

  /**
   * Copia al bucket publico una imagen que vive en el Storage privado de archivos.
   *
   * <p>Las fotos de producto se cargan en `archivos/{tenantId}/...`, que es privado y sin cache
   * de CDN. Publicarlas tal cual funcionaria (la URL lleva token), pero la tienda las serviria
   * lentas y se romperian si alguien borra el archivo. Por eso la tienda usa siempre una copia
   * propia en el proyecto de sitios.
   *
   * @returns la URL publica, o `null` si la copia no cabe en el plan.
   * @throws si la imagen no se pudo descargar o subir por un motivo distinto a la cuota.
   */
  async copiarDesdeUrl(url: string, nombreSugerido = 'imagen'): Promise<string | null> {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error('No se pudo leer la imagen original.');
    }

    const blob = await respuesta.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error('El archivo original no es una imagen.');
    }

    const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
    const original = new File([blob], `${nombreSugerido}.${extension}`, { type: blob.type });

    // La tienda es publica: se recomprime al mismo tope que el resto de fotos de producto
    // por si el origen es anterior al limite, o se subio sin pasar por el compresor.
    const archivo = await redimensionarImagen(original, { maxBytes: IMAGEN_PRODUCTO_MAX_BYTES });
    if (archivo.size > IMAGEN_PRODUCTO_MAX_BYTES) {
      throw new Error('La imagen supera 1 MB incluso comprimida. Sube una version mas liviana en WebP.');
    }

    try {
      return await this.subirImagen(archivo);
    } catch (error) {
      // Quedarse sin cupo no es un fallo: el producto se publica sin foto.
      if (error instanceof CuotaImagenesPublicasError) {
        return null;
      }
      throw error;
    }
  }

  async subirImagenComoArchivo(archivo: File): Promise<ArchivoItem> {
    await this.sitesSession.ensureReady();
    if (!archivo.type.startsWith('image/')) {
      throw new Error('Solo se permiten imagenes.');
    }
    if (archivo.size > TAMANO_MAXIMO) {
      throw new Error('La imagen supera el maximo de 5 MB.');
    }
    // El bucket de sitios es de lectura publica y esta en otro proyecto, asi que sus reglas
    // no pueden mirar el consumo acumulado: el tope del plan se reserva aqui, antes de subir.
    await this.reservarCuota(archivo.size);
    const tenantId = this.authService.getTenantId();
    const nombre = archivo.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
    const path = `sitios/${tenantId}/media/${Date.now().toString(36)}-${nombre}`;
    const referencia = storageRef(this.storage, path);
    const usuario = this.authService.currentUser();

    let resultado;
    try {
      resultado = await uploadBytes(referencia, archivo, {
        contentType: archivo.type,
        cacheControl: 'public,max-age=31536000,immutable',
        customMetadata: {
          tenantId,
          uploadedBy: usuario?.displayName || usuario?.email || 'WinSuit',
          uploadedById: usuario?.uid ?? '',
          sourceModule: 'sitio_web',
        },
      });
    } catch (error) {
      // La reserva ya descontó del plan: si la subida no llega a existir, se devuelve.
      await this.liberarCuota(archivo.size);
      throw error;
    }

    const downloadUrl = await getDownloadURL(resultado.ref);
    return this.mapArchivo(
      resultado.ref.fullPath,
      resultado.ref.name,
      tenantId,
      resultado.metadata.size,
      resultado.metadata.contentType ?? archivo.type,
      resultado.metadata.timeCreated,
      downloadUrl,
      resultado.metadata.customMetadata,
    );
  }

  async listarImagenes(pageToken?: string | null): Promise<SitioMediaPage> {
    await this.sitesSession.ensureReady();
    const tenantId = this.authService.getTenantId();
    const carpeta = storageRef(this.storage, `sitios/${tenantId}/media`);
    const pagina = await listStorage(carpeta, {
      maxResults: TAMANO_PAGINA,
      ...(pageToken ? { pageToken } : {}),
    });

    const items = await Promise.all(
      pagina.items.map(async (referencia) => {
        const [metadata, downloadUrl] = await Promise.all([
          getMetadata(referencia),
          getDownloadURL(referencia),
        ]);
        return this.mapArchivo(
          referencia.fullPath,
          referencia.name,
          tenantId,
          metadata.size,
          metadata.contentType,
          metadata.timeCreated,
          downloadUrl,
          metadata.customMetadata,
        );
      }),
    );

    items.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return { items, nextPageToken: pagina.nextPageToken ?? null };
  }

  async eliminarImagen(storagePath: string): Promise<void> {
    await this.sitesSession.ensureReady();
    const tenantId = this.authService.getTenantId();
    const prefijo = `sitios/${tenantId}/media/`;
    if (!storagePath.startsWith(prefijo)) {
      throw new Error('La imagen no pertenece al espacio publico del negocio.');
    }

    // Se mide antes de borrar: despues ya no hay metadata que consultar.
    let bytes = 0;
    try {
      bytes = (await getMetadata(storageRef(this.storage, storagePath))).size ?? 0;
    } catch {
      // Sin metadata no se puede devolver la cuota, pero el borrado debe seguir.
    }

    await deleteObject(storageRef(this.storage, storagePath));

    if (bytes > 0) {
      await this.liberarCuota(bytes);
    }
  }

  /** Reserva espacio del plan. Lanza `CuotaImagenesPublicasError` si ya no cabe. */
  private async reservarCuota(bytes: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${environment.apiBaseUrl}/api/tenants/current/sitios/media/reservar`, { bytes }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 402) {
        throw new CuotaImagenesPublicasError();
      }
      throw error;
    }
  }

  private async liberarCuota(bytes: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${environment.apiBaseUrl}/api/tenants/current/sitios/media/liberar`, { bytes }),
      );
    } catch {
      // Si la devolucion falla, el consumo queda alto: es preferible a bloquear la operacion.
    }
  }

  private mapArchivo(
    id: string,
    name: string,
    tenantId: string,
    sizeBytes: number,
    contentType: string | undefined,
    timeCreated: string,
    downloadUrl: string,
    customMetadata?: Record<string, string>,
  ): ArchivoItem {
    return {
      id,
      tenantId,
      name,
      sizeBytes,
      contentType,
      extension: name.split('.').pop()?.toLowerCase(),
      sourceModule: 'sitio_web',
      uploadedBy: customMetadata?.['uploadedBy'] || 'Sitios',
      uploadedById: customMetadata?.['uploadedById'] || undefined,
      uploadedAt: Date.parse(timeCreated) || Date.now(),
      storagePath: id,
      downloadUrl,
    };
  }
}

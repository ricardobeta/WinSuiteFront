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
import { AuthService } from '../../../core/services/auth.service';
import { SITES_STORAGE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';
import { ArchivoItem } from '../../../shared/models/archivos.models';

const TAMANO_MAXIMO = 5 * 1024 * 1024; // debe coincidir con storage.rules
const TAMANO_PAGINA = 50;

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

  async subirImagen(archivo: File): Promise<string> {
    return (await this.subirImagenComoArchivo(archivo)).downloadUrl;
  }

  async subirImagenComoArchivo(archivo: File): Promise<ArchivoItem> {
    await this.sitesSession.ensureReady();
    if (!archivo.type.startsWith('image/')) {
      throw new Error('Solo se permiten imagenes.');
    }
    if (archivo.size > TAMANO_MAXIMO) {
      throw new Error('La imagen supera el maximo de 5 MB.');
    }
    const tenantId = this.authService.getTenantId();
    const nombre = archivo.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
    const path = `sitios/${tenantId}/media/${Date.now().toString(36)}-${nombre}`;
    const referencia = storageRef(this.storage, path);
    const usuario = this.authService.currentUser();
    const resultado = await uploadBytes(referencia, archivo, {
      contentType: archivo.type,
      cacheControl: 'public,max-age=31536000,immutable',
      customMetadata: {
        tenantId,
        uploadedBy: usuario?.displayName || usuario?.email || 'WinSuite',
        uploadedById: usuario?.uid ?? '',
        sourceModule: 'sitio_web',
      },
    });
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
    await deleteObject(storageRef(this.storage, storagePath));
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

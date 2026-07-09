import { Injectable, inject } from '@angular/core';
import { Storage, getDownloadURL, ref as storageRef, uploadBytes } from '@angular/fire/storage';
import { AuthService } from '../../../core/services/auth.service';

const TAMANO_MAXIMO = 5 * 1024 * 1024; // debe coincidir con storage.rules

/** Subida de imagenes del sitio a Storage: sitios/{tenantId}/media/... (lectura publica). */
@Injectable({ providedIn: 'root' })
export class SitioMediaService {
  private readonly storage = inject(Storage);
  private readonly authService = inject(AuthService);

  async subirImagen(archivo: File): Promise<string> {
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
    await uploadBytes(referencia, archivo, { contentType: archivo.type });
    return getDownloadURL(referencia);
  }
}

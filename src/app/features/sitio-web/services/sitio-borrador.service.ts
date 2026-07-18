import { Injectable, inject } from '@angular/core';
import { Database, get, ref, set, update } from 'firebase/database';
import { ContenidoSitio, TemaSitio, TipoSitio, normalizarContenidoRtdb } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';
import { AiSiteBlueprint } from './ai-site-generator.service';

/** Estado del Copiloto IA de un sitio: permite seguir iterando el diseño desde el editor. */
export interface EstadoIaSitio {
  type: TipoSitio;
  blueprint?: AiSiteBlueprint;
  imageUrls: string[];
  formBindings: Record<string, string>;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class SitioBorradorService {
  private readonly database = inject(SITES_DATABASE);
  private readonly authService = inject(AuthService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);

  private borradorPath(sitioId: string): string {
    return `sitios/${this.authService.getTenantId()}/${sitioId}/borrador`;
  }

  async cargar(sitioId: string): Promise<ContenidoSitio | null> {
    await this.sitesSession.ensureReady();
    const snapshot = await get(ref(this.database, this.borradorPath(sitioId)));
    if (!snapshot.exists()) return null;
    // RTDB elimina arrays vacios (p.ej. bloques de una pagina en blanco): normalizar.
    return normalizarContenidoRtdb(snapshot.val());
  }

  /** Guarda el borrador completo (lo invoca el editor con debounce). */
  async guardar(sitioId: string, contenido: ContenidoSitio): Promise<void> {
    await this.sitesSession.ensureReady();
    // RTDB rechaza propiedades undefined (p.ej. al restablecer colores del tema);
    // el round-trip JSON las elimina de forma segura.
    const limpio = JSON.parse(JSON.stringify(contenido)) as ContenidoSitio;
    await set(ref(this.database, this.borradorPath(sitioId)), {
      meta: { updatedAt: Date.now(), updatedBy: this.authService.currentUser()?.uid ?? '' },
      tema: limpio.tema,
      paginas: limpio.paginas,
    });
  }

  private iaPath(sitioId: string): string {
    return `sitios/${this.authService.getTenantId()}/${sitioId}/ia`;
  }

  async cargarIa(sitioId: string): Promise<EstadoIaSitio | null> {
    await this.sitesSession.ensureReady();
    const snapshot = await get(ref(this.database, this.iaPath(sitioId)));
    if (!snapshot.exists()) return null;
    const valor = snapshot.val() as EstadoIaSitio;
    if (!valor?.type) return null;
    return {
      ...valor,
      imageUrls: Array.isArray(valor.imageUrls) ? valor.imageUrls : [],
      formBindings: valor.formBindings && typeof valor.formBindings === 'object'
        ? valor.formBindings
        : {},
    };
  }

  async guardarIa(sitioId: string, estado: Omit<EstadoIaSitio, 'updatedAt'>): Promise<void> {
    await this.sitesSession.ensureReady();
    const limpio = JSON.parse(JSON.stringify({ ...estado, updatedAt: Date.now() })) as EstadoIaSitio;
    await set(ref(this.database, this.iaPath(sitioId)), limpio);
  }

  async guardarTema(sitioId: string, tema: TemaSitio): Promise<void> {
    await this.sitesSession.ensureReady();
    const temaLimpio = JSON.parse(JSON.stringify(tema)) as TemaSitio;
    await update(ref(this.database), {
      [`${this.borradorPath(sitioId)}/tema`]: temaLimpio,
      [`${this.borradorPath(sitioId)}/meta/updatedAt`]: Date.now(),
    });
  }
}

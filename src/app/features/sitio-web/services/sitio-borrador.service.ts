import { Injectable, inject } from '@angular/core';
import { Database, get, ref, set, update } from 'firebase/database';
import { ContenidoSitio, TemaSitio, normalizarContenidoRtdb } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';

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

  async guardarTema(sitioId: string, tema: TemaSitio): Promise<void> {
    await this.sitesSession.ensureReady();
    await update(ref(this.database), {
      [`${this.borradorPath(sitioId)}/tema`]: tema,
      [`${this.borradorPath(sitioId)}/meta/updatedAt`]: Date.now(),
    });
  }
}

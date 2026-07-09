import { Injectable, inject } from '@angular/core';
import { Database, get, ref, set, update } from '@angular/fire/database';
import { ContenidoSitio, PaginaDoc, TemaSitio } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class SitioBorradorService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private borradorPath(sitioId: string): string {
    return `sitios/${this.authService.getTenantId()}/${sitioId}/borrador`;
  }

  async cargar(sitioId: string): Promise<ContenidoSitio | null> {
    const snapshot = await get(ref(this.database, this.borradorPath(sitioId)));
    if (!snapshot.exists()) return null;
    const valor = snapshot.val() as ContenidoSitio & { paginas?: Record<string, PaginaDoc> };
    return { tema: valor.tema, paginas: valor.paginas ?? {} };
  }

  /** Guarda el borrador completo (lo invoca el editor con debounce). */
  async guardar(sitioId: string, contenido: ContenidoSitio): Promise<void> {
    await set(ref(this.database, this.borradorPath(sitioId)), {
      meta: { updatedAt: Date.now(), updatedBy: this.authService.currentUser()?.uid ?? '' },
      tema: contenido.tema,
      paginas: contenido.paginas,
    });
  }

  async guardarTema(sitioId: string, tema: TemaSitio): Promise<void> {
    await update(ref(this.database), {
      [`${this.borradorPath(sitioId)}/tema`]: tema,
      [`${this.borradorPath(sitioId)}/meta/updatedAt`]: Date.now(),
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, ref, update } from 'firebase/database';
import { SitioConfig } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SitiosService } from './sitios.service';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';

@Injectable({ providedIn: 'root' })
export class SitioConfigService {
  private readonly database = inject(SITES_DATABASE);
  private readonly authService = inject(AuthService);
  private readonly sitiosService = inject(SitiosService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);

  private configPath(sitioId: string): string {
    return `sitios/${this.authService.getTenantId()}/${sitioId}/config`;
  }

  async guardar(sitioId: string, cambios: Partial<SitioConfig>): Promise<void> {
    await this.sitesSession.ensureReady();
    const tenantId = this.authService.getTenantId();
    const actualizadoEn = Date.now();
    const updates: Record<string, unknown> = {
      [`${this.configPath(sitioId)}/actualizadoEn`]: actualizadoEn,
      [`sitios_resumen/${tenantId}/${sitioId}/config/actualizadoEn`]: actualizadoEn,
    };
    for (const [key, value] of Object.entries(cambios)) {
      updates[`${this.configPath(sitioId)}/${key}`] = value ?? null;
      updates[`sitios_resumen/${tenantId}/${sitioId}/config/${key}`] = value ?? null;
    }
    await update(ref(this.database), updates);
  }

  /** Cambia el subdominio: reclama el nuevo, actualiza config y libera el anterior. */
  async cambiarSubdominio(config: SitioConfig, nuevoSubdominio: string): Promise<void> {
    const anterior = config.subdominio;
    if (anterior === nuevoSubdominio) return;

    await this.sitiosService.reclamarSubdominio(nuevoSubdominio, config.sitioId);
    try {
      await this.guardar(config.sitioId, { subdominio: nuevoSubdominio });
    } catch (error) {
      await this.sitiosService.liberarSubdominio(nuevoSubdominio).catch(() => undefined);
      throw error;
    }
    await this.sitiosService.liberarSubdominio(anterior).catch(() => undefined);
  }
}

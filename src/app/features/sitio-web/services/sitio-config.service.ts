import { Injectable, inject } from '@angular/core';
import { Database, ref, update } from '@angular/fire/database';
import { SitioConfig } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SitiosService } from './sitios.service';

@Injectable({ providedIn: 'root' })
export class SitioConfigService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly sitiosService = inject(SitiosService);

  private configPath(sitioId: string): string {
    return `sitios/${this.authService.getTenantId()}/${sitioId}/config`;
  }

  async guardar(sitioId: string, cambios: Partial<SitioConfig>): Promise<void> {
    await update(ref(this.database, this.configPath(sitioId)), {
      ...cambios,
      actualizadoEn: Date.now(),
    });
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

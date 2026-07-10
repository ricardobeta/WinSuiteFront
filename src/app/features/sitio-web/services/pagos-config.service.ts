import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { CuentaTransferencia, PagosConfig, pagosConfigSchema } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Configuracion de metodos de pago de la EMPRESA (pagos_config/{tenantId}), compartida
 * entre todos sus sitios. La pagina /pago del renderer muestra los metodos habilitados;
 * el token de Payphone lo usa el server del renderer para confirmar transacciones.
 */
@Injectable({ providedIn: 'root' })
export class PagosConfigService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `pagos_config/${this.authService.getTenantId()}`;
  }

  getConfig(): Observable<PagosConfig> {
    return new Observable<PagosConfig>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getTenantPath()),
        (snapshot) => subscriber.next(this.normalizar((snapshot.val() ?? {}) as PagosConfig)),
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async guardar(config: PagosConfig): Promise<void> {
    const validada = { ...config, actualizadoEn: Date.now() };
    pagosConfigSchema.parse(validada);
    await set(ref(this.database, this.getTenantPath()), validada);
  }

  /** RTDB elimina arrays vacios: restaura cuentas. */
  private normalizar(config: PagosConfig): PagosConfig {
    if (!config.transferencia) return config;
    const cuentas = Array.isArray(config.transferencia.cuentas)
      ? config.transferencia.cuentas
      : (Object.values(config.transferencia.cuentas ?? {}) as CuentaTransferencia[]);
    return { ...config, transferencia: { ...config.transferencia, cuentas } };
  }
}

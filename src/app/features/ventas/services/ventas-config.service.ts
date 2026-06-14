import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionVentas } from '../models/ventas.models';

@Injectable({
  providedIn: 'root'
})
export class VentasConfigService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `ventas/${this.authService.getTenantId()}`;
  }

  private getConfigRef() {
    return ref(this.database, `${this.getTenantPath()}/configuracion/ventas`);
  }

  getConfiguracion(): Observable<ConfiguracionVentas> {
    return new Observable<ConfiguracionVentas>((subscriber) => {
      const unsubscribe = onValue(
        this.getConfigRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next(this.getDefaultConfig());
            return;
          }

          subscriber.next(this.normalizar(snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionVentas> {
    const snapshot = await get(this.getConfigRef());

    if (!snapshot.exists()) {
      return this.getDefaultConfig();
    }

    return this.normalizar(snapshot.val());
  }

  async guardarConfiguracion(configuracion: ConfiguracionVentas): Promise<void> {
    await set(this.getConfigRef(), {
      ...this.getDefaultConfig(),
      ...configuracion
    });
  }

  private normalizar(value: unknown): ConfiguracionVentas {
    const input = value as Partial<ConfiguracionVentas> | null;
    const defaults = this.getDefaultConfig();

    return {
      permitirVentaSinStock: input?.permitirVentaSinStock ?? defaults.permitirVentaSinStock,
      permitirDescuentos: input?.permitirDescuentos ?? defaults.permitirDescuentos,
      descuentoMaximo: Number(input?.descuentoMaximo ?? defaults.descuentoMaximo),
      diasParaReverso: Number(input?.diasParaReverso ?? defaults.diasParaReverso),
      impuestoPorDefecto: Number(input?.impuestoPorDefecto ?? defaults.impuestoPorDefecto),
      prefijoPOS: input?.prefijoPOS ?? defaults.prefijoPOS,
      mostrarCosto: input?.mostrarCosto ?? defaults.mostrarCosto,
      monedaBase: input?.monedaBase ?? defaults.monedaBase
    };
  }

  private getDefaultConfig(): ConfiguracionVentas {
    return {
      permitirVentaSinStock: false,
      permitirDescuentos: true,
      descuentoMaximo: 50,
      diasParaReverso: 30,
      impuestoPorDefecto: 12,
      prefijoPOS: 'VEN-',
      mostrarCosto: false,
      monedaBase: 'USD'
    };
  }
}

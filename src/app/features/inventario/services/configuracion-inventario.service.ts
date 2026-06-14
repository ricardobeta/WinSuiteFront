import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionInventario } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionInventarioService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  private getRootPath(): string {
    return `${this.getTenantPath()}/configuracion/inventario`;
  }

  private getRootRef() {
    return ref(this.database, this.getRootPath());
  }

  getConfiguracion(): Observable<ConfiguracionInventario> {
    return new Observable<ConfiguracionInventario>((subscriber) => {
      const configRef = this.getRootRef();

      const unsubscribe = onValue(
        configRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next(this.getDefaultConfig());
            return;
          }

          subscriber.next(this.normalizarConfiguracion(snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionInventario> {
    const snapshot = await get(this.getRootRef());

    if (!snapshot.exists()) {
      return this.getDefaultConfig();
    }

    return this.normalizarConfiguracion(snapshot.val());
  }

  async guardarConfiguracion(config: ConfiguracionInventario): Promise<void> {
    await set(this.getRootRef(), this.normalizarConfiguracion(config));
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionInventario {
    const raw = value as Partial<ConfiguracionInventario> | null | undefined;
    const defaults = this.getDefaultConfig();

    return {
      metodoCosteoDefecto: raw?.metodoCosteoDefecto ?? defaults.metodoCosteoDefecto,
      permitirStockNegativo: raw?.permitirStockNegativo ?? defaults.permitirStockNegativo,
      prefijoSKU: raw?.prefijoSKU ?? defaults.prefijoSKU,
      monedaBase: raw?.monedaBase ?? defaults.monedaBase,
      simboloMoneda: raw?.simboloMoneda ?? defaults.simboloMoneda,
      alertasStockMinimo: raw?.alertasStockMinimo ?? defaults.alertasStockMinimo,
      impuestoPorDefecto: raw?.impuestoPorDefecto ?? defaults.impuestoPorDefecto,
      metodoPrecioVentaDefecto: raw?.metodoPrecioVentaDefecto ?? defaults.metodoPrecioVentaDefecto,
      porcentajePrecioVentaDefecto: raw?.porcentajePrecioVentaDefecto ?? defaults.porcentajePrecioVentaDefecto
    };
  }

  private getDefaultConfig(): ConfiguracionInventario {
    return {
      metodoCosteoDefecto: 'PROMEDIO',
      permitirStockNegativo: false,
      prefijoSKU: 'PROD-',
      monedaBase: 'USD',
      simboloMoneda: '$',
      alertasStockMinimo: true,
      impuestoPorDefecto: 12,
      metodoPrecioVentaDefecto: 'MARKUP',
      porcentajePrecioVentaDefecto: 30
    };
  }
}

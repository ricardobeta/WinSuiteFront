import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { MetodoPagoVenta, ModoPos, PerfilPos } from '../models/ventas.models';

const METODOS_PAGO_POR_DEFECTO: MetodoPagoVenta[] = [
  'EFECTIVO',
  'TARJETA_CREDITO',
  'TARJETA_DEBITO',
  'TRANSFERENCIA'
];

/**
 * Perfil de POS por almacén/sucursal. Cada almacén define su propio modo
 * (RETAIL vs RESTAURANTE) y las opciones de flujo/UX del punto de venta.
 * Datos en `ventas/{tenantId}/configuracion/perfilesPos/{almacenId}`.
 */
@Injectable({
  providedIn: 'root'
})
export class VentasPosConfigService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `ventas/${this.authService.getTenantId()}`;
  }

  private getPerfilRef(almacenId: string) {
    return ref(this.database, `${this.getTenantPath()}/configuracion/perfilesPos/${almacenId}`);
  }

  /** Observa el perfil del almacén; emite defaults por modo cuando no existe. */
  getPerfil(almacenId: string): Observable<PerfilPos> {
    return new Observable<PerfilPos>((subscriber) => {
      const unsubscribe = onValue(
        this.getPerfilRef(almacenId),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next(this.getDefaultPerfil(almacenId, 'RETAIL'));
            return;
          }

          subscriber.next(this.normalizar(almacenId, snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  /** Lee el perfil una sola vez; devuelve defaults por modo cuando no existe. */
  async getPerfilOnce(almacenId: string): Promise<PerfilPos> {
    const snapshot = await get(this.getPerfilRef(almacenId));

    if (!snapshot.exists()) {
      return this.getDefaultPerfil(almacenId, 'RETAIL');
    }

    return this.normalizar(almacenId, snapshot.val());
  }

  async guardarPerfil(perfil: PerfilPos): Promise<void> {
    const normalizado = this.normalizar(perfil.almacenId, perfil);
    await set(this.getPerfilRef(perfil.almacenId), {
      ...normalizado,
      actualizadoEn: Date.now()
    });
  }

  private normalizar(almacenId: string, value: unknown): PerfilPos {
    const input = value as Partial<PerfilPos> | null;
    const modo: ModoPos = input?.modo === 'RESTAURANTE' ? 'RESTAURANTE' : 'RETAIL';
    const defaults = this.getDefaultPerfil(almacenId, modo);

    return {
      almacenId,
      modo,
      escaneoHabilitado: input?.escaneoHabilitado ?? defaults.escaneoHabilitado,
      autoAgregarAlEscanear: input?.autoAgregarAlEscanear ?? defaults.autoAgregarAlEscanear,
      mostrarImagenes: input?.mostrarImagenes ?? defaults.mostrarImagenes,
      vistaCatalogoPorDefecto: input?.vistaCatalogoPorDefecto ?? defaults.vistaCatalogoPorDefecto,
      categoriasDestacadas: input?.categoriasDestacadas ?? defaults.categoriasDestacadas,
      permitirCuentasAbiertas: input?.permitirCuentasAbiertas ?? defaults.permitirCuentasAbiertas,
      permitirDividirCuenta: input?.permitirDividirCuenta ?? defaults.permitirDividirCuenta,
      etiquetaCuenta: input?.etiquetaCuenta ?? defaults.etiquetaCuenta,
      metodosPagoHabilitados:
        input?.metodosPagoHabilitados && input.metodosPagoHabilitados.length > 0
          ? input.metodosPagoHabilitados
          : defaults.metodosPagoHabilitados,
      facturacionAutomatica: input?.facturacionAutomatica ?? defaults.facturacionAutomatica,
      actualizadoEn: input?.actualizadoEn
    };
  }

  /** Defaults sensatos derivados del modo. */
  getDefaultPerfil(almacenId: string, modo: ModoPos): PerfilPos {
    const esRestaurante = modo === 'RESTAURANTE';
    return {
      almacenId,
      modo,
      escaneoHabilitado: !esRestaurante,
      autoAgregarAlEscanear: true,
      mostrarImagenes: true,
      vistaCatalogoPorDefecto: 'TARJETAS',
      categoriasDestacadas: [],
      permitirCuentasAbiertas: esRestaurante,
      permitirDividirCuenta: esRestaurante,
      etiquetaCuenta: esRestaurante ? 'Mesa' : 'Cuenta',
      metodosPagoHabilitados: [...METODOS_PAGO_POR_DEFECTO],
      facturacionAutomatica: false
    };
  }
}

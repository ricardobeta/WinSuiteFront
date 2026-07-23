import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CuentaAbierta } from '../models/ventas.models';

/**
 * Cuentas abiertas de restaurante, compartidas entre terminales de una sucursal.
 * Persisten en `ventas/{tenantId}/cuentasAbiertas/{almacenId}/{cuentaId}`.
 */
@Injectable({
  providedIn: 'root'
})
export class CuentasAbiertasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getBasePath(almacenId: string): string {
    return `ventas/${this.authService.getTenantId()}/cuentasAbiertas/${almacenId}`;
  }

  /** Observa las cuentas abiertas de un almacén, ordenadas por apertura. */
  getCuentas(almacenId: string): Observable<CuentaAbierta[]> {
    return new Observable<CuentaAbierta[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getBasePath(almacenId)),
        (snapshot) => {
          const val = snapshot.val() as Record<string, CuentaAbierta> | null;
          const cuentas = val ? Object.values(val) : [];
          cuentas.sort((a, b) => a.abiertaEn - b.abiertaEn);
          subscriber.next(cuentas);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarCuenta(cuenta: CuentaAbierta): Promise<void> {
    await set(ref(this.database, `${this.getBasePath(cuenta.almacenId)}/${cuenta.id}`), {
      ...cuenta,
      actualizadoEn: Date.now()
    });
  }

  async eliminarCuenta(almacenId: string, cuentaId: string): Promise<void> {
    await remove(ref(this.database, `${this.getBasePath(almacenId)}/${cuentaId}`));
  }
}

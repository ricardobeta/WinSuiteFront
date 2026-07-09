import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { TipoGastoCompra } from '../models/contabilidad.models';

/**
 * Servicio del submodulo de configuracion "Tipos de Gasto" (compras). Cada tipo de gasto
 * (ej. "Gasto Internet") guarda una plantilla de cuentas de gasto/costo que se precargan al
 * contabilizar una factura de compra. Ademas recuerda el ultimo tipo de gasto usado por
 * proveedor para preseleccionarlo en registros posteriores.
 */
@Injectable({
  providedIn: 'root'
})
export class TiposGastoCompraService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getCollectionPath(): string {
    return `${this.getTenantPath()}/tiposGastoCompra`;
  }

  private getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  private getItemRef(tipoGastoId: string) {
    return ref(this.database, `${this.getCollectionPath()}/${tipoGastoId}`);
  }

  private getPreferenciaProveedorRef(idProv: string) {
    return ref(this.database, `${this.getTenantPath()}/tiposGastoPorProveedor/${idProv}`);
  }

  /** Stream reactivo de todos los tipos de gasto (ordenados por nombre). */
  listar(): Observable<TipoGastoCompra[]> {
    return new Observable<TipoGastoCompra[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => subscriber.next(this.mapear(snapshot.val())),
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  /** Lectura puntual de los tipos de gasto activos. */
  async getActivosOnce(): Promise<TipoGastoCompra[]> {
    const snapshot = await get(this.getCollectionRef());
    return this.mapear(snapshot.val()).filter((tipo) => tipo.activo);
  }

  async getTipoGastoById(tipoGastoId: string): Promise<TipoGastoCompra | null> {
    const snapshot = await get(this.getItemRef(tipoGastoId));
    if (!snapshot.exists()) {
      return null;
    }
    return { ...(snapshot.val() as TipoGastoCompra), id: tipoGastoId };
  }

  async crear(tipoGasto: TipoGastoCompra): Promise<string> {
    const nuevoRef = push(this.getCollectionRef());
    await set(nuevoRef, this.normalizar(tipoGasto, Date.now()));
    return nuevoRef.key!;
  }

  async actualizar(tipoGastoId: string, tipoGasto: TipoGastoCompra): Promise<void> {
    await set(this.getItemRef(tipoGastoId), this.normalizar(tipoGasto, Date.now()));
  }

  async desactivar(tipoGastoId: string): Promise<void> {
    await update(this.getItemRef(tipoGastoId), { activo: false, actualizadoEn: Date.now() });
  }

  /** Devuelve el id del tipo de gasto recordado para un proveedor, o null si no hay. */
  async getTipoGastoDeProveedor(idProv: string): Promise<string | null> {
    if (!idProv) {
      return null;
    }
    const snapshot = await get(this.getPreferenciaProveedorRef(idProv));
    return snapshot.exists() ? String(snapshot.val()) : null;
  }

  /** Recuerda el tipo de gasto usado para un proveedor (para preseleccionarlo luego). */
  async recordarProveedor(idProv: string, tipoGastoId: string): Promise<void> {
    if (!idProv || !tipoGastoId) {
      return;
    }
    await set(this.getPreferenciaProveedorRef(idProv), tipoGastoId);
  }

  private mapear(raw: unknown): TipoGastoCompra[] {
    if (!raw || typeof raw !== 'object') {
      return [];
    }
    return Object.entries(raw as Record<string, TipoGastoCompra>)
      .map(([id, tipo]) => ({ ...tipo, id, cuentasGasto: tipo.cuentasGasto ?? [] }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  private normalizar(tipoGasto: TipoGastoCompra, timestamp: number): Omit<TipoGastoCompra, 'id'> {
    return {
      nombre: tipoGasto.nombre.trim(),
      descripcion: tipoGasto.descripcion?.trim() || '',
      activo: tipoGasto.activo,
      cuentasGasto: (tipoGasto.cuentasGasto ?? []).map((cuenta) => ({
        cuentaId: cuenta.cuentaId,
        codigoCuenta: cuenta.codigoCuenta,
        nombreCuenta: cuenta.nombreCuenta
      })),
      creadoEn: tipoGasto.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    };
  }
}

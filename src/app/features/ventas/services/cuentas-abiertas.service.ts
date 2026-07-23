import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref, runTransaction, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CuentaAbierta } from '../models/ventas.models';

export type ReclamarCuentaResultado =
  | { estado: 'RECLAMADA'; cuenta: CuentaAbierta }
  | { estado: 'OCUPADA'; cuenta: CuentaAbierta }
  | { estado: 'NO_EXISTE'; cuenta: null };

const DURACION_RECLAMO_MS = 5 * 60 * 1000;
const DEVICE_STORAGE_KEY = 'winsuite.pos.deviceId';

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
  private readonly dispositivoId = this.resolverDispositivoId();

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
      tomadaPorDispositivo: null,
      tomadaPorUsuarioId: null,
      tomadaPorNombre: null,
      tomadaEn: null,
      actualizadoEn: Date.now()
    });
  }

  getDispositivoId(): string {
    return this.dispositivoId;
  }

  crearCuentaId(): string {
    const sufijo = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `cuenta-${sufijo}`;
  }

  estaTomadaPorEsteDispositivo(cuenta: CuentaAbierta): boolean {
    return cuenta.tomadaPorDispositivo === this.dispositivoId && this.reclamoVigente(cuenta);
  }

  estaTomadaPorOtroDispositivo(cuenta: CuentaAbierta): boolean {
    return !!cuenta.tomadaPorDispositivo
      && cuenta.tomadaPorDispositivo !== this.dispositivoId
      && this.reclamoVigente(cuenta);
  }

  async reclamarCuenta(
    almacenId: string,
    cuentaId: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<ReclamarCuentaResultado> {
    const cuentaRef = ref(this.database, `${this.getBasePath(almacenId)}/${cuentaId}`);
    const ahora = Date.now();
    let ocupada: CuentaAbierta | null = null;

    const resultado = await runTransaction(cuentaRef, (current: CuentaAbierta | null) => {
      if (!current) {
        return;
      }

      const reclamoAjenoVigente = !!current.tomadaPorDispositivo
        && current.tomadaPorDispositivo !== this.dispositivoId
        && this.reclamoVigente(current, ahora);
      if (reclamoAjenoVigente) {
        ocupada = current;
        return;
      }

      return {
        ...current,
        tomadaPorDispositivo: this.dispositivoId,
        tomadaPorUsuarioId: usuarioId,
        tomadaPorNombre: usuarioNombre,
        tomadaEn: ahora,
        actualizadoEn: ahora
      };
    });

    if (resultado.committed && resultado.snapshot.exists()) {
      return { estado: 'RECLAMADA', cuenta: resultado.snapshot.val() as CuentaAbierta };
    }
    if (ocupada) {
      return { estado: 'OCUPADA', cuenta: ocupada };
    }
    return { estado: 'NO_EXISTE', cuenta: null };
  }

  async actualizarCuentaReclamada(cuenta: CuentaAbierta): Promise<boolean> {
    const cuentaRef = ref(this.database, `${this.getBasePath(cuenta.almacenId)}/${cuenta.id}`);
    const resultado = await runTransaction(cuentaRef, (current: CuentaAbierta | null) => {
      if (!current || current.tomadaPorDispositivo !== this.dispositivoId) {
        return;
      }
      return {
        ...current,
        carrito: cuenta.carrito,
        tomadaPorDispositivo: this.dispositivoId,
        tomadaPorUsuarioId: cuenta.tomadaPorUsuarioId ?? current.tomadaPorUsuarioId ?? null,
        tomadaPorNombre: cuenta.tomadaPorNombre ?? current.tomadaPorNombre ?? null,
        tomadaEn: Date.now(),
        actualizadoEn: Date.now()
      };
    });
    return resultado.committed;
  }

  async retenerCuentaReclamada(cuenta: CuentaAbierta): Promise<boolean> {
    const cuentaRef = ref(this.database, `${this.getBasePath(cuenta.almacenId)}/${cuenta.id}`);
    const resultado = await runTransaction(cuentaRef, (current: CuentaAbierta | null) => {
      if (!current || current.tomadaPorDispositivo !== this.dispositivoId) {
        return;
      }
      return {
        ...current,
        ...cuenta,
        tomadaPorDispositivo: null,
        tomadaPorUsuarioId: null,
        tomadaPorNombre: null,
        tomadaEn: null,
        actualizadoEn: Date.now()
      };
    });
    return resultado.committed;
  }

  async eliminarCuentaReclamada(almacenId: string, cuentaId: string): Promise<boolean> {
    const cuentaRef = ref(this.database, `${this.getBasePath(almacenId)}/${cuentaId}`);
    const resultado = await runTransaction(cuentaRef, (current: CuentaAbierta | null) => {
      if (!current) {
        return null;
      }
      if (
        current.tomadaPorDispositivo
        && current.tomadaPorDispositivo !== this.dispositivoId
        && this.reclamoVigente(current)
      ) {
        return;
      }
      return null;
    });
    return resultado.committed;
  }

  private reclamoVigente(cuenta: CuentaAbierta, ahora = Date.now()): boolean {
    const tomadaEn = Number(cuenta.tomadaEn ?? 0);
    return tomadaEn > 0 && ahora - tomadaEn < DURACION_RECLAMO_MS;
  }

  private resolverDispositivoId(): string {
    try {
      const existente = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (existente) {
        return existente;
      }
      const nuevo = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_STORAGE_KEY, nuevo);
      return nuevo;
    } catch {
      return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}

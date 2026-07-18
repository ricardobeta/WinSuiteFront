import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { CuentaBancaria } from '../models/bancos.models';

/**
 * Catálogo de cuentas bancarias (nodo pequeño: realtime permitido con
 * unsubscribe en teardown, igual que el plan de cuentas).
 */
@Injectable({
  providedIn: 'root'
})
export class BancosCuentasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getCuentasPath(): string {
    return `contabilidad/${this.authService.getTenantId()}/bancos/cuentasBancarias`;
  }

  getCuentas(): Observable<CuentaBancaria[]> {
    const cuentasRef = ref(this.database, this.getCuentasPath());
    return new Observable((subscriber) => {
      const unsubscribe = onValue(
        cuentasRef,
        (snapshot) => {
          const raw = (snapshot.val() ?? {}) as Record<string, CuentaBancaria>;
          const cuentas = Object.entries(raw)
            .map(([id, cuenta]) => ({ ...cuenta, id }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
          subscriber.next(cuentas);
        },
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async getCuentaById(cuentaId: string): Promise<CuentaBancaria | null> {
    const snapshot = await get(ref(this.database, `${this.getCuentasPath()}/${cuentaId}`));
    return snapshot.exists() ? { ...(snapshot.val() as CuentaBancaria), id: cuentaId } : null;
  }

  async crearCuenta(cuenta: Omit<CuentaBancaria, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<string> {
    const nuevaRef = push(ref(this.database, this.getCuentasPath()));
    const payload = { ...cuenta, ...this.audit.createMetadata('crear') };
    await update(ref(this.database), { [`${this.getCuentasPath()}/${nuevaRef.key}`]: payload });
    const cuentaId = nuevaRef.key ?? '';
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'contabilidad', entityType: 'cuentaBancaria', entityId: cuentaId, label: cuenta.nombre },
      summary: `Creó la cuenta bancaria ${cuenta.nombre}`,
      changesAfter: { nombre: cuenta.nombre, banco: cuenta.bancoCodigo, numeroCuenta: cuenta.numeroCuenta }
    });
    return cuentaId;
  }

  async actualizarCuenta(cuentaId: string, cambios: Partial<CuentaBancaria>): Promise<void> {
    const updates: Record<string, unknown> = {};
    const payload = { ...cambios, actualizadoEn: Date.now() };
    for (const [campo, valor] of Object.entries(payload)) {
      updates[`${this.getCuentasPath()}/${cuentaId}/${campo}`] = valor;
    }
    await update(ref(this.database), updates);
    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'contabilidad', entityType: 'cuentaBancaria', entityId: cuentaId, label: cambios.nombre ?? cuentaId },
      summary: `Actualizó la cuenta bancaria ${cambios.nombre ?? cuentaId}`,
      changesAfter: { ...cambios }
    });
  }
}

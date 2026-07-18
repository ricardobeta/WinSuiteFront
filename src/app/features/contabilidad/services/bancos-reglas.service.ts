import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';

export interface ReglaConciliacion {
  id?: string;
  nombre: string;
  cuentaBancariaId?: string | null;
  condicion: {
    campo: 'descripcion';
    operador: 'CONTIENE' | 'EMPIEZA' | 'REGEX';
    valor: string;
    tipoMov?: 'DEBITO' | 'CREDITO' | '';
    montoMax?: number | null;
  };
  accion: {
    cuentaContableId: string;
    contraparteNombre?: string;
    autoConciliar: boolean;
  };
  activa: boolean;
  orden: number;
  creadaEn?: number;
  creadaPor?: string | null;
}

/**
 * Reglas de conciliación del tenant (L2): "si la descripción contiene X,
 * clasificar a la cuenta Y". Nodo pequeño, editable por el cliente.
 */
@Injectable({
  providedIn: 'root'
})
export class BancosReglasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getReglasPath(): string {
    return `contabilidad/${this.authService.getTenantId()}/bancos/reglas`;
  }

  async getReglas(): Promise<ReglaConciliacion[]> {
    const snapshot = await get(ref(this.database, this.getReglasPath()));
    const raw = (snapshot.val() ?? {}) as Record<string, ReglaConciliacion>;
    return Object.entries(raw)
      .map(([id, regla]) => ({ ...regla, id }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  async guardarRegla(regla: ReglaConciliacion): Promise<string> {
    const { id, ...payload } = regla;
    const reglaId = id ?? push(ref(this.database, this.getReglasPath())).key ?? '';
    await update(ref(this.database), {
      [`${this.getReglasPath()}/${reglaId}`]: {
        ...payload,
        ...(id ? {} : this.audit.createMetadata('crear'))
      }
    });
    await this.audit.recordSafe({
      action: id ? 'actualizar' : 'crear',
      target: { module: 'contabilidad', entityType: 'reglaConciliacion', entityId: reglaId, label: regla.nombre },
      summary: `${id ? 'Actualizó' : 'Creó'} la regla de conciliación ${regla.nombre}`
    });
    return reglaId;
  }

  async eliminarRegla(regla: ReglaConciliacion): Promise<void> {
    if (!regla.id) {
      return;
    }
    await remove(ref(this.database, `${this.getReglasPath()}/${regla.id}`));
    await this.audit.recordSafe({
      action: 'eliminar',
      target: { module: 'contabilidad', entityType: 'reglaConciliacion', entityId: regla.id, label: regla.nombre },
      summary: `Eliminó la regla de conciliación ${regla.nombre}`
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, endAt, equalTo, get, orderByChild, push, query, ref, startAt, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';

export type TipoMovimientoTesoreria =
  | 'DEPOSITO'
  | 'TRANSFERENCIA_ENVIADA'
  | 'TRANSFERENCIA_RECIBIDA'
  | 'CHEQUE'
  | 'ND'
  | 'NC';

export type EstadoMovimientoTesoreria = 'REGISTRADO' | 'CONCILIADO' | 'ANULADO';

export interface MovimientoTesoreria {
  id?: string;
  tipo: TipoMovimientoTesoreria;
  cuentaBancariaId: string;
  fecha: string;        // ISO yyyy-MM-dd
  fechaTs: number;
  periodo: string;      // yyyy-MM
  monto: number;        // ingreso +, egreso -
  referencia?: string;
  beneficiario?: string;
  glosa?: string;
  estado: EstadoMovimientoTesoreria;
  asientoId?: string | null;
  matchId?: string | null;
  creadoEn?: number;
  creadoPor?: string | null;
}

/**
 * Movimientos de tesorería (cheques girados, depósitos, transferencias, ND/NC
 * registradas a mano). Son candidatos de conciliación y generan su asiento
 * contable desde la página (patrón pagos a proveedor).
 */
@Injectable({
  providedIn: 'root'
})
export class TesoreriaService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getTesoreriaPath(): string {
    return `contabilidad/${this.authService.getTenantId()}/bancos/tesoreria`;
  }

  async getMovimientosPorCuenta(cuentaBancariaId: string, periodo?: string): Promise<MovimientoTesoreria[]> {
    const snapshot = await get(query(
      ref(this.database, this.getTesoreriaPath()),
      orderByChild('cuentaBancariaId'),
      equalTo(cuentaBancariaId)
    ));
    const raw = (snapshot.val() ?? {}) as Record<string, MovimientoTesoreria>;
    return Object.entries(raw)
      .map(([id, movimiento]) => ({ ...movimiento, id }))
      .filter((movimiento) => !periodo || movimiento.periodo === periodo)
      .sort((a, b) => b.fechaTs - a.fechaTs);
  }

  async getMovimientosPorPeriodo(periodo: string): Promise<MovimientoTesoreria[]> {
    const snapshot = await get(query(
      ref(this.database, this.getTesoreriaPath()),
      orderByChild('periodo'),
      startAt(periodo),
      endAt(periodo)
    ));
    const raw = (snapshot.val() ?? {}) as Record<string, MovimientoTesoreria>;
    return Object.entries(raw)
      .map(([id, movimiento]) => ({ ...movimiento, id }))
      .sort((a, b) => b.fechaTs - a.fechaTs);
  }

  async crearMovimiento(movimiento: Omit<MovimientoTesoreria, 'id' | 'creadoEn'>): Promise<string> {
    const movRef = push(ref(this.database, this.getTesoreriaPath()));
    const movimientoId = movRef.key ?? '';
    await update(ref(this.database), {
      [`${this.getTesoreriaPath()}/${movimientoId}`]: {
        ...movimiento,
        ...this.audit.createMetadata('crear')
      }
    });
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'contabilidad', entityType: 'movimientoTesoreria', entityId: movimientoId, label: movimiento.glosa ?? movimiento.tipo },
      summary: `Registró ${movimiento.tipo} por ${movimiento.monto} en tesorería`,
      changesAfter: { tipo: movimiento.tipo, monto: movimiento.monto, referencia: movimiento.referencia ?? '' }
    });
    return movimientoId;
  }

  async anularMovimiento(movimiento: MovimientoTesoreria): Promise<void> {
    if (!movimiento.id) {
      return;
    }
    if (movimiento.estado === 'CONCILIADO') {
      throw new Error('No se puede anular un movimiento ya conciliado.');
    }
    await update(ref(this.database), {
      [`${this.getTesoreriaPath()}/${movimiento.id}/estado`]: 'ANULADO'
    });
    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'contabilidad', entityType: 'movimientoTesoreria', entityId: movimiento.id, label: movimiento.glosa ?? movimiento.tipo },
      summary: `Anuló el movimiento de tesorería ${movimiento.referencia ?? movimiento.id}`
    });
  }

  async vincularAsiento(movimientoId: string, asientoId: string): Promise<void> {
    await update(ref(this.database), {
      [`${this.getTesoreriaPath()}/${movimientoId}/asientoId`]: asientoId
    });
  }
}

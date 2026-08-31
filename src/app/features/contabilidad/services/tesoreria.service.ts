import { Injectable, inject } from '@angular/core';
import { Database, endAt, equalTo, get, orderByChild, push, query, ref, startAt, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { AsientosContablesService } from './asientos-contables.service';

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
  asientoReversoId?: string | null;
  matchId?: string | null;
  creadoEn?: number;
  creadoPor?: string | null;
  anuladoEn?: number | null;
  anuladoPor?: string | null;
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
  private readonly asientosService = inject(AsientosContablesService);

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
      throw new Error('No se puede anular un movimiento sin identificador.');
    }
    if (movimiento.estado === 'CONCILIADO') {
      throw new Error('No se puede anular un movimiento ya conciliado.');
    }

    // Se vuelve a leer el movimiento para retomar de forma segura una anulación que haya
    // quedado a medias (por ejemplo, después de vincular o aprobar el reverso).
    const movimientoRef = ref(this.database, `${this.getTesoreriaPath()}/${movimiento.id}`);
    const snapshot = await get(movimientoRef);
    if (!snapshot.exists()) {
      throw new Error('El movimiento de tesorería ya no existe.');
    }
    const actual = { ...(snapshot.val() as MovimientoTesoreria), id: movimiento.id };
    if (actual.estado === 'ANULADO') {
      return;
    }
    if (actual.estado === 'CONCILIADO') {
      throw new Error('No se puede anular un movimiento ya conciliado.');
    }
    if (!actual.asientoId) {
      throw new Error('El movimiento no tiene un asiento contable vinculado; no se puede anular sin generar su reverso.');
    }

    const asientoOriginal = await this.asientosService.getAsientoById(actual.asientoId);
    if (!asientoOriginal) {
      throw new Error('No se encontró el asiento contable del movimiento; la anulación fue detenida para no descuadrar la contabilidad.');
    }
    if (asientoOriginal.estado !== 'APROBADO' && asientoOriginal.estado !== 'REVERSADO') {
      throw new Error('El asiento contable del movimiento no está aprobado y no puede reversarse.');
    }

    const periodoOriginal = asientoOriginal.fecha.slice(0, 7);
    let asientoReversoId = actual.asientoReversoId?.trim() || null;
    if (!asientoReversoId && asientoOriginal.estado === 'APROBADO') {
      const reverso = {
        ...this.asientosService.crearReverso(asientoOriginal),
        // El reverso debe afectar el mismo período del asiento original. Se conserva su fecha
        // para que la normalización y la validación del período no puedan moverlo a otro mes.
        fecha: asientoOriginal.fecha,
        periodo: periodoOriginal,
        origenModulo: 'BANCOS' as const,
        origenId: actual.id,
        origenNumero: actual.referencia || actual.id
      };

      // El borrador se vincula antes de aprobarlo. Si falla una llamada posterior, el
      // siguiente intento reutiliza el mismo asiento y no contabiliza dos reversos.
      asientoReversoId = await this.asientosService.guardarBorrador(reverso);
      await update(ref(this.database), {
        [`${this.getTesoreriaPath()}/${actual.id}/asientoReversoId`]: asientoReversoId
      });
      await this.asientosService.aprobarAsiento({ ...reverso, id: asientoReversoId });
    } else if (asientoReversoId) {
      const reversoExistente = await this.asientosService.getAsientoById(asientoReversoId);
      if (!reversoExistente || reversoExistente.asientoReversadoId !== asientoOriginal.id) {
        throw new Error('El reverso vinculado al movimiento no corresponde al asiento original.');
      }
      if (reversoExistente.estado === 'BORRADOR') {
        await this.asientosService.aprobarAsiento({
          ...reversoExistente,
          fecha: asientoOriginal.fecha,
          periodo: periodoOriginal
        });
      } else if (reversoExistente.estado !== 'APROBADO') {
        throw new Error('El asiento de reverso no está disponible para completar la anulación.');
      } else if (reversoExistente.fecha.slice(0, 7) !== periodoOriginal) {
        throw new Error('El asiento de reverso pertenece a otro período contable; la anulación fue detenida para no afectar un mes diferente.');
      }
    } else if (asientoOriginal.estado === 'REVERSADO') {
      throw new Error('El asiento original ya está reversado, pero el movimiento no tiene vinculado su reverso contable.');
    }

    if (asientoOriginal.estado === 'APROBADO') {
      await this.asientosService.marcarReversado(asientoOriginal.id!);
    }

    const timestamp = Date.now();
    await update(ref(this.database), {
      [`${this.getTesoreriaPath()}/${actual.id}/estado`]: 'ANULADO',
      [`${this.getTesoreriaPath()}/${actual.id}/asientoReversoId`]: asientoReversoId,
      [`${this.getTesoreriaPath()}/${actual.id}/anuladoEn`]: timestamp,
      [`${this.getTesoreriaPath()}/${actual.id}/anuladoPor`]: this.authService.currentUser()?.uid ?? null
    });
    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'contabilidad', entityType: 'movimientoTesoreria', entityId: actual.id, label: actual.glosa ?? actual.tipo },
      summary: `Anuló el movimiento de tesorería ${actual.referencia ?? actual.id} y generó su reverso contable`,
      changesAfter: { estado: 'ANULADO', asientoId: actual.asientoId, asientoReversoId }
    });
  }

  async vincularAsiento(movimientoId: string, asientoId: string): Promise<void> {
    await update(ref(this.database), {
      [`${this.getTesoreriaPath()}/${movimientoId}/asientoId`]: asientoId
    });
  }
}

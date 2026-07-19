import { Injectable, inject } from '@angular/core';
import { Database, endAt, equalTo, get, limitToLast, orderByChild, query, ref } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { MatchConciliacion, MovimientoBancario, MovimientosPage } from '../models/bancos.models';

export interface AgregadoBancario {
  totalCreditos: number;
  totalDebitos: number;
  movimientos: number;
  saldoFinal?: number;
  saldoFinalFecha?: string;
  actualizadoEn?: number;
}

/**
 * Lectura de movimientos bancarios y matches desde RTDB.
 * SIEMPRE lecturas puntuales get() paginadas por cursor claveOrden — nunca
 * listeners permanentes (ahorro). El nodo es de escritura solo-backend.
 */
@Injectable({
  providedIn: 'root'
})
export class BancosMovimientosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getBancosPath(): string {
    return `contabilidad/${this.authService.getTenantId()}/bancos`;
  }

  /**
   * Página de movimientos del período, más recientes primero.
   * Cursor = claveOrden (fecha#pushId). Tope 100 por consulta directa a RTDB;
   * para 200/500 usar BancosApiService.getMovimientosPage (server-side).
   */
  async getMovimientosPage(
    cuentaBancariaId: string,
    periodo: string,
    limit = 50,
    cursor: string | null = null
  ): Promise<MovimientosPage> {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error('Selecciona un período válido.');
    }
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const hastaClave = cursor ?? `${periodo}-99#` + String.fromCharCode(0xffff);
    const constraints = [
      orderByChild('claveOrden'),
      endAt(hastaClave),
      limitToLast(boundedLimit + (cursor ? 2 : 1))
    ];
    const movimientosRef = ref(this.database, `${this.getBancosPath()}/movimientos/${cuentaBancariaId}`);
    const snapshot = await get(query(movimientosRef, ...constraints));

    const items: MovimientoBancario[] = [];
    snapshot.forEach((child) => {
      const movimiento = { ...(child.val() as MovimientoBancario), id: child.key ?? undefined };
      if (movimiento.claveOrden !== cursor && movimiento.periodo === periodo) {
        items.push(movimiento);
      }
      return false;
    });

    const hasMore = items.length > boundedLimit;
    if (hasMore) {
      items.shift();
    }
    items.reverse();
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? last.claveOrden : null,
      hasMore
    };
  }

  /**
   * Agregados precalculados por período (escritos por el backend al importar):
   * el dashboard carga con UNA lectura por cuenta, sin tocar los movimientos.
   */
  async getAgregados(cuentaBancariaId: string): Promise<Record<string, AgregadoBancario>> {
    const snapshot = await get(ref(this.database, `${this.getBancosPath()}/agregados/${cuentaBancariaId}`));
    return (snapshot.val() ?? {}) as Record<string, AgregadoBancario>;
  }

  /** Matches del período (para chips de estado en el workspace). */
  async getMatchesPorPeriodo(cuentaBancariaId: string, periodo: string): Promise<MatchConciliacion[]> {
    const matchesRef = ref(this.database, `${this.getBancosPath()}/matches/${cuentaBancariaId}`);
    const snapshot = await get(query(matchesRef, orderByChild('periodo'), equalTo(periodo)));
    const matches: MatchConciliacion[] = [];
    snapshot.forEach((child) => {
      matches.push({ ...(child.val() as MatchConciliacion), id: child.key ?? undefined });
      return false;
    });
    return matches;
  }
}

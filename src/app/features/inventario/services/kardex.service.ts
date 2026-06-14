import { Injectable, inject } from '@angular/core';
import { Database, DataSnapshot, get, onValue, push, ref, runTransaction, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { KardexEntry } from '../models/inventario.models';

export interface ActualizarStockResult {
  exito: boolean;
  saldo: number | null;
}

export interface RegistrarEntradaOCInput {
  productoId: string;
  almacenId: string;
  ordenId: string;
  cantidad: number;
  costoUnitario: number;
  notas?: string;
  userId: string;
}

export interface RegistrarIngresoInicialInput {
  productoId: string;
  almacenId: string;
  cantidad: number;
  costoUnitario: number;
  notas?: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class KardexService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  protected getKardexProductoPath(productoId: string): string {
    return `${this.getTenantPath()}/kardex/${productoId}`;
  }

  protected getKardexProductoRef(productoId: string) {
    return ref(this.database, this.getKardexProductoPath(productoId));
  }

  protected getStockPath(productoId: string, almacenId: string): string {
    return `${this.getTenantPath()}/stock/${productoId}/${almacenId}`;
  }

  protected getStockRef(productoId: string, almacenId: string) {
    return ref(this.database, this.getStockPath(productoId, almacenId));
  }

  getStockTotalesPorProducto(): Observable<Record<string, number>> {
    return new Observable<Record<string, number>>((subscriber) => {
      const stockRootRef = ref(this.database, `${this.getTenantPath()}/stock`);

      const unsubscribe = onValue(
        stockRootRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({});
            return;
          }

          const raw = snapshot.val() as Record<string, Record<string, { cantidad?: number }>>;
          const result: Record<string, number> = {};

          Object.entries(raw).forEach(([productoId, almacenes]) => {
            result[productoId] = Object.values(almacenes ?? {})
              .reduce((sum, stock) => sum + this.safeNumber(stock?.cantidad), 0);
          });

          subscriber.next(result);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getStockPorProductoPorAlmacen(): Observable<Record<string, Record<string, number>>> {
    return new Observable<Record<string, Record<string, number>>>((subscriber) => {
      const stockRootRef = ref(this.database, `${this.getTenantPath()}/stock`);

      const unsubscribe = onValue(
        stockRootRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({});
            return;
          }

          const raw = snapshot.val() as Record<string, Record<string, { cantidad?: number }>>;
          const result: Record<string, Record<string, number>> = {};

          Object.entries(raw).forEach(([productoId, almacenes]) => {
            const stockPorAlmacen: Record<string, number> = {};

            Object.entries(almacenes ?? {}).forEach(([almacenId, stock]) => {
              stockPorAlmacen[almacenId] = this.safeNumber(stock?.cantidad);
            });

            result[productoId] = stockPorAlmacen;
          });

          subscriber.next(result);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getStockActual(productoId: string, almacenId: string): Promise<number> {
    const snapshot = await get(ref(this.database, `${this.getStockPath(productoId, almacenId)}/cantidad`));
    return snapshot.exists() ? Number(snapshot.val()) : 0;
  }

  async actualizarStock(
    productoId: string,
    almacenId: string,
    delta: number,
    permitirStockNegativo = false
  ): Promise<ActualizarStockResult> {
    let saldoResult: number | null = null;

    const transactionResult = await runTransaction(this.getStockRef(productoId, almacenId), (current: unknown) => {
      const stockActual = this.safeNumber((current as { cantidad?: unknown } | null | undefined)?.cantidad);
      const reservadoActual = this.safeNumber((current as { cantidadReservada?: unknown } | null | undefined)?.cantidadReservada);
      const nuevoSaldo = stockActual + delta;

      if (nuevoSaldo < 0 && !permitirStockNegativo) {
        return;
      }

      saldoResult = nuevoSaldo;
      return {
        cantidad: nuevoSaldo,
        cantidadReservada: reservadoActual,
        actualizadoEn: Date.now()
      };
    });

    return {
      exito: transactionResult.committed,
      saldo: transactionResult.committed ? saldoResult : null
    };
  }

  async registrarMovimiento(productoId: string, entry: Omit<KardexEntry, 'id'>): Promise<string> {
    const kardexRef = push(this.getKardexProductoRef(productoId));
    await set(kardexRef, {
      ...entry,
      id: kardexRef.key
    });
    return kardexRef.key!;
  }

  async registrarEntradaDesdeOC(input: RegistrarEntradaOCInput): Promise<string> {
    if (input.cantidad <= 0) {
      throw new Error('La cantidad a registrar debe ser mayor a cero.');
    }

    const resultadoStock = await this.actualizarStock(input.productoId, input.almacenId, input.cantidad, false);
    if (!resultadoStock.exito || resultadoStock.saldo === null) {
      throw new Error('No fue posible actualizar el stock para la recepcion de OC.');
    }

    const movimiento: Omit<KardexEntry, 'id'> = {
      almacenId: input.almacenId,
      tipo: 'ENTRADA',
      motivo: 'OC_RECEPCION',
      cantidad: input.cantidad,
      costoUnitario: input.costoUnitario,
      costoTotal: input.cantidad * input.costoUnitario,
      saldoCantidad: resultadoStock.saldo,
      referenciaId: input.ordenId,
      referenciaTipo: 'OC',
      notas: input.notas ?? '',
      creadoPor: input.userId,
      creadoEn: Date.now()
    };

    return this.registrarMovimiento(input.productoId, movimiento);
  }

  async registrarIngresoInicial(input: RegistrarIngresoInicialInput): Promise<string> {
    if (input.cantidad <= 0) {
      throw new Error('La cantidad inicial debe ser mayor a cero.');
    }

    if (input.costoUnitario < 0) {
      throw new Error('El costo unitario inicial no puede ser negativo.');
    }

    const resultadoStock = await this.actualizarStock(input.productoId, input.almacenId, input.cantidad, false);
    if (!resultadoStock.exito || resultadoStock.saldo === null) {
      throw new Error('No fue posible registrar el stock inicial.');
    }

    const movimiento: Omit<KardexEntry, 'id'> = {
      almacenId: input.almacenId,
      tipo: 'ENTRADA',
      motivo: 'AJUSTE_INVENTARIO',
      cantidad: input.cantidad,
      costoUnitario: input.costoUnitario,
      costoTotal: input.cantidad * input.costoUnitario,
      saldoCantidad: resultadoStock.saldo,
      referenciaId: 'INVENTARIO_INICIAL',
      referenciaTipo: 'MANUAL',
      notas: input.notas ?? 'Ingreso de inventario inicial al crear producto',
      creadoPor: input.userId,
      creadoEn: Date.now()
    };

    return this.registrarMovimiento(input.productoId, movimiento);
  }

  async getMovimientosProducto(productoId: string): Promise<KardexEntry[]> {
    const snapshot = await get(this.getKardexProductoRef(productoId));
    if (!snapshot.exists()) {
      return [];
    }

    return this.normalizarMovimientos(snapshot)
      .sort((a, b) => b.creadoEn - a.creadoEn);
  }

  private normalizarMovimientos(snapshot: DataSnapshot): KardexEntry[] {
    const raw = snapshot.val() as Record<string, KardexEntry>;
    return Object.entries(raw).map(([id, value]) => ({
      ...value,
      id: value.id || id
    }));
  }

  private safeNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, get, ref, runTransaction, set } from '@angular/fire/database';
import { Observable, from, map } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import {
  KardexEntry,
  Producto,
  RecetaAuditoria,
  RecetaItem,
  TipoMovimientoKardex
} from '../models/inventario.models';
import { CostosService } from './costos.service';
import { KardexService } from './kardex.service';
import { ProductosService } from './productos.service';

export interface DisponibilidadIngredienteReceta {
  productoId: string;
  nombre: string;
  unidadId: string;
  cantidadPorReceta: number;
  cantidadRequerida: number;
  stockActual: number;
  faltante: number;
  suficiente: boolean;
}

export interface DisponibilidadRecetaResultado {
  recetaId: string;
  disponible: number;
  ingredientes: DisponibilidadIngredienteReceta[];
  agotado: boolean;
}

export interface ValidacionRecetaVentaResultado {
  esValida: boolean;
  requiereConfirmacion: boolean;
  disponible: number;
  faltantes: DisponibilidadIngredienteReceta[];
  mensajes: string[];
}

export interface CostoIngredienteReceta {
  productoId: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface CostoRecetaResultado {
  recetaId: string;
  costoUnitario: number;
  costoTotal: number;
  detalle: CostoIngredienteReceta[];
}

export interface DescontarInventarioRecetaInput {
  recetaId: string;
  almacenId: string;
  cantidadRecetas: number;
  motivo: 'VENTA' | 'DEVOLUCION';
  referenciaId: string;
  creadoPor: string;
  permitirInventarioNegativo: boolean;
  notas?: string;
}

interface IngredienteBaseResolvido {
  productoId: string;
  nombre: string;
  unidadId: string;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class RecetasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly productosService = inject(ProductosService);
  private readonly costosService = inject(CostosService);
  private readonly kardexService = inject(KardexService);
  private readonly audit = inject(AuditService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  private getRecetaLockPath(recetaId: string, almacenId: string): string {
    return `${this.getTenantPath()}/locks/recetas/${almacenId}/${recetaId}`;
  }

  async calcularDisponibilidadReceta(
    recetaId: string,
    almacenId: string,
    cantidadObjetivo = 1
  ): Promise<DisponibilidadRecetaResultado> {
    const cantidad = Math.max(1, cantidadObjetivo);
    const ingredientesPorReceta = await this.resolverIngredientesBase(recetaId, 1, new Set<string>());

    const detalle = await Promise.all(
      ingredientesPorReceta.map(async (ingrediente) => {
        const stockActual = await this.kardexService.getStockActual(ingrediente.productoId, almacenId);
        const cantidadRequerida = this.roundToFour(ingrediente.cantidad * cantidad);
        const faltante = Math.max(0, cantidadRequerida - stockActual);

        return {
          productoId: ingrediente.productoId,
          nombre: ingrediente.nombre,
          unidadId: ingrediente.unidadId,
          cantidadPorReceta: ingrediente.cantidad,
          cantidadRequerida,
          stockActual,
          faltante,
          suficiente: stockActual >= cantidadRequerida
        } satisfies DisponibilidadIngredienteReceta;
      })
    );

    const maximoPosible = detalle.length === 0
      ? 0
      : detalle.reduce((minimo, row) => {
          const posibles = row.cantidadPorReceta > 0 ? Math.floor(row.stockActual / row.cantidadPorReceta) : 0;
          return Math.min(minimo, posibles);
        }, Number.MAX_SAFE_INTEGER);

    return {
      recetaId,
      disponible: Number.isFinite(maximoPosible) ? Math.max(0, maximoPosible) : 0,
      ingredientes: detalle,
      agotado: detalle.some((row) => !row.suficiente)
    };
  }

  async validarRecetaParaVenta(
    recetaId: string,
    almacenId: string,
    cantidadRecetas: number,
    permitirInventarioNegativo: boolean
  ): Promise<ValidacionRecetaVentaResultado> {
    const cantidad = Math.max(1, cantidadRecetas);
    const disponibilidad = await this.calcularDisponibilidadReceta(recetaId, almacenId, cantidad);
    const faltantes = disponibilidad.ingredientes.filter((item) => !item.suficiente);

    if (faltantes.length === 0) {
      return {
        esValida: true,
        requiereConfirmacion: false,
        disponible: disponibilidad.disponible,
        faltantes: [],
        mensajes: []
      };
    }

    const mensajes = faltantes.map((faltante) =>
      `Falta ${this.roundToFour(faltante.faltante)} en ${faltante.nombre} para completar la receta.`
    );

    return {
      esValida: permitirInventarioNegativo,
      requiereConfirmacion: permitirInventarioNegativo,
      disponible: disponibilidad.disponible,
      faltantes,
      mensajes
    };
  }

  async calcularCostoReceta(recetaId: string, cantidadRecetas = 1): Promise<CostoRecetaResultado> {
    const cantidad = Math.max(1, cantidadRecetas);
    const ingredientesBase = await this.resolverIngredientesBase(recetaId, cantidad, new Set<string>());

    const detalle = await Promise.all(
      ingredientesBase.map(async (ingrediente) => {
        const productoIngrediente = await this.productosService.getProductoById(ingrediente.productoId);

        if (!productoIngrediente) {
          throw new Error('No fue posible cargar uno de los ingredientes de la receta.');
        }

        const cantidadIngrediente = this.roundToFour(ingrediente.cantidad);
        const costoSalida = await this.costosService.calcularCostoSalidaUnitario(
          ingrediente.productoId,
          cantidadIngrediente,
          productoIngrediente.metodoCosteo
        );

        const costoUnitario = cantidadIngrediente > 0 ? this.roundToFour(costoSalida / cantidadIngrediente) : 0;
        const subtotal = this.roundToFour(costoUnitario * cantidadIngrediente);

        return {
          productoId: ingrediente.productoId,
          nombre: ingrediente.nombre,
          cantidad: cantidadIngrediente,
          costoUnitario,
          subtotal
        } satisfies CostoIngredienteReceta;
      })
    );

    const costoTotal = this.roundToFour(detalle.reduce((acc, item) => acc + item.subtotal, 0));

    return {
      recetaId,
      costoUnitario: this.roundToFour(costoTotal / cantidad),
      costoTotal,
      detalle
    };
  }

  async descontarInventarioReceta(input: DescontarInventarioRecetaInput): Promise<void> {
    if (input.cantidadRecetas <= 0) {
      throw new Error('La cantidad de recetas debe ser mayor a cero.');
    }

    const receta = await this.getRecetaByIdOrThrow(input.recetaId);
    const ingredientes = await this.resolverIngredientesBase(input.recetaId, input.cantidadRecetas, new Set<string>());

    const token = await this.acquireRecetaLock(input.recetaId, input.almacenId, input.creadoPor);

    try {
      const signo = input.motivo === 'VENTA' ? -1 : 1;
      const movimientosAplicados: Array<{ productoId: string; cantidad: number }> = [];

      for (const ingrediente of ingredientes) {
        const cantidadMovimiento = this.roundToFour(ingrediente.cantidad * input.cantidadRecetas);
        const delta = this.roundToFour(signo * cantidadMovimiento);

        if (delta === 0) {
          continue;
        }

        const stockResult = await this.kardexService.actualizarStock(
          ingrediente.productoId,
          input.almacenId,
          delta,
          input.permitirInventarioNegativo
        );

        if (!stockResult.exito) {
          for (const aplicado of movimientosAplicados) {
            await this.kardexService.actualizarStock(aplicado.productoId, input.almacenId, -aplicado.cantidad, true);
          }

          throw new Error(`Stock insuficiente para ingrediente ${ingrediente.productoId}.`);
        }

        movimientosAplicados.push({ productoId: ingrediente.productoId, cantidad: delta });

        const productoIngrediente = await this.productosService.getProductoById(ingrediente.productoId);
        if (!productoIngrediente) {
          throw new Error('No se pudo resolver el costo de un ingrediente de receta.');
        }

        const costoTotalSalida = await this.costosService.calcularCostoSalidaUnitario(
          ingrediente.productoId,
          Math.abs(delta),
          productoIngrediente.metodoCosteo
        );
        const costoUnitario = Math.abs(delta) > 0 ? this.roundToFour(costoTotalSalida / Math.abs(delta)) : 0;

        await this.kardexService.registrarMovimiento(ingrediente.productoId, {
          almacenId: input.almacenId,
          tipo: input.motivo === 'VENTA' ? 'SALIDA' : 'ENTRADA',
          motivo: input.motivo === 'VENTA' ? 'RECETA_VENTA' : 'RECETA_DEVOLUCION',
          cantidad: Math.abs(delta),
          costoUnitario,
          costoTotal: this.roundToFour(costoUnitario * Math.abs(delta)),
          saldoCantidad: stockResult.saldo ?? 0,
          referenciaId: input.referenciaId,
          referenciaTipo: 'MANUAL',
          notas: input.notas ?? `Receta ${receta.nombre}`,
          creadoPor: input.creadoPor,
          creadoEn: Date.now()
        } satisfies Omit<KardexEntry, 'id'>);
      }
    } finally {
      await this.releaseRecetaLock(input.recetaId, input.almacenId, token);
    }
  }

  async registrarAuditoriaReceta(entry: Omit<RecetaAuditoria, 'id' | 'creadoEn'>): Promise<void> {
    const action = entry.accion === 'CREADA'
      ? 'crear'
      : entry.accion === 'DESHABILITADA'
        ? 'eliminar'
        : 'actualizar';
    await this.audit.recordSafe({
      action,
      target: { module: 'inventario', entityType: 'receta', entityId: entry.recetaId },
      summary: `Receta ${entry.accion.toLowerCase().replaceAll('_', ' ')}`,
      changesBefore: entry.cambiosAntes ?? null,
      changesAfter: { ...(entry.cambiosDespues ?? {}), _recetaAccion: entry.accion }
    });
  }

  getAuditoriaReceta(recetaId: string): Observable<RecetaAuditoria[]> {
    return from(this.audit.getEventsForEntity('inventario', 'receta', recetaId)).pipe(
      map((events) => events.map((event) => ({
        id: event.id,
        recetaId,
        accion: this.toRecetaAuditAction(event.action, event.changesAfter?.['_recetaAccion']),
        cambiosAntes: event.changesBefore ?? undefined,
        cambiosDespues: event.changesAfter ?? undefined,
        creadoPor: event.userId,
        creadoEn: event.timestamp
      })))
    );
  }

  private toRecetaAuditAction(action: string, stored: unknown): RecetaAuditoria['accion'] {
    if (stored === 'CREADA' || stored === 'EDITADA' || stored === 'INGREDIENTES_CAMBIADOS' || stored === 'DESHABILITADA') {
      return stored;
    }
    return action === 'crear' ? 'CREADA' : action === 'eliminar' ? 'DESHABILITADA' : 'EDITADA';
  }

  private async getRecetaByIdOrThrow(recetaId: string): Promise<Producto> {
    const receta = await this.productosService.getProductoById(recetaId);
    if (!receta || this.getTipoProducto(receta) !== 'RECETA') {
      throw new Error('La receta seleccionada no existe.');
    }

    return receta;
  }

  private getRecetaItemsOrThrow(receta: Producto): RecetaItem[] {
    const items = (receta.recetaItems ?? []).filter((item) => item.cantidad > 0 && !!item.productoId);
    if (items.length === 0) {
      throw new Error('La receta no tiene ingredientes configurados.');
    }

    return items;
  }

  private async resolverIngredientesBase(
    recetaId: string,
    factor: number,
    trail: Set<string>
  ): Promise<IngredienteBaseResolvido[]> {
    if (trail.has(recetaId)) {
      throw new Error('Se detecto una referencia circular entre recetas.');
    }

    const receta = await this.getRecetaByIdOrThrow(recetaId);
    const items = this.getRecetaItemsOrThrow(receta);
    const cantidadFactor = Math.max(0, factor);
    const acumulado = new Map<string, IngredienteBaseResolvido>();

    trail.add(recetaId);

    try {
      for (const item of items) {
        const ingrediente = await this.productosService.getProductoById(item.productoId);
        if (!ingrediente) {
          throw new Error(`No se encontro el ingrediente ${item.productoId} de la receta.`);
        }

        const tipo = this.getTipoProducto(ingrediente);
        const cantidadItem = this.roundToFour(item.cantidad * cantidadFactor);

        if (tipo === 'SIMPLE') {
          const previo = acumulado.get(item.productoId);
          acumulado.set(item.productoId, {
            productoId: item.productoId,
            nombre: ingrediente.nombre,
            unidadId: ingrediente.unidadId,
            cantidad: this.roundToFour((previo?.cantidad ?? 0) + cantidadItem)
          });
          continue;
        }

        const subIngredientes = await this.resolverIngredientesBase(item.productoId, cantidadItem, trail);
        for (const sub of subIngredientes) {
          const previo = acumulado.get(sub.productoId);
          acumulado.set(sub.productoId, {
            productoId: sub.productoId,
            nombre: sub.nombre,
            unidadId: sub.unidadId,
            cantidad: this.roundToFour((previo?.cantidad ?? 0) + sub.cantidad)
          });
        }
      }
    } finally {
      trail.delete(recetaId);
    }

    return Array.from(acumulado.values()).filter((item) => item.cantidad > 0);
  }

  private getTipoProducto(producto: Producto): 'SIMPLE' | 'RECETA' {
    return producto.tipo === 'RECETA' ? 'RECETA' : 'SIMPLE';
  }

  private async acquireRecetaLock(recetaId: string, almacenId: string, userId: string): Promise<string> {
    const lockRef = ref(this.database, this.getRecetaLockPath(recetaId, almacenId));
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();

    const tx = await runTransaction(lockRef, (current: unknown) => {
      const typed = (current ?? null) as { token?: string; expiresAt?: number } | null;
      const expiresAt = typeof typed?.expiresAt === 'number' ? typed.expiresAt : 0;

      if (typed?.token && expiresAt > now) {
        return;
      }

      return {
        token,
        userId,
        creadoEn: now,
        expiresAt: now + 15000
      };
    });

    const tokenActual = tx.snapshot.child('token').val();
    if (!tx.committed || tokenActual !== token) {
      throw new Error('La receta se esta procesando en otra venta. Intenta nuevamente.');
    }

    return token;
  }

  private async releaseRecetaLock(recetaId: string, almacenId: string, token: string): Promise<void> {
    const lockRef = ref(this.database, this.getRecetaLockPath(recetaId, almacenId));

    await runTransaction(lockRef, (current: unknown) => {
      const typed = (current ?? null) as { token?: string } | null;
      if (typed?.token !== token) {
        return current;
      }

      return null;
    });
  }

  private roundToFour(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }
}

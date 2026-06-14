import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { IntegracionContableService } from '../../contabilidad/services/integracion-contable.service';
import { EstadoOrdenCompra, OrdenCompra, OrdenCompraItem, RecepcionOC, RecepcionOrdenCompraItem } from '../models/inventario.models';
import { KardexService } from './kardex.service';
import { ProductosService } from './productos.service';

export interface CrearOrdenCompraInput {
  orden: Omit<OrdenCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'>;
  items: Omit<OrdenCompraItem, 'id'>[];
}

export interface RecibirOrdenCompraItemInput {
  itemId: string;
  productoId: string;
  cantidadRecibida: number;
  costoUnitario: number;
  actualizarPrecioVenta?: boolean;
  precioVentaNuevo?: number;
}

export interface RecibirOrdenCompraInput {
  ordenId: string;
  almacenId: string;
  items: RecibirOrdenCompraItemInput[];
  fechaRecepcion?: number;
  contabilizarRecepcion?: boolean;
  documentoProveedorNumero?: string;
  documentoProveedorFecha?: number | null;
  documentoProveedorSubtotal?: number;
  documentoProveedorIva?: number;
  documentoProveedorTotal?: number;
  documentoProveedorAutorizacion?: string;
  notas?: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenesCompraService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly kardexService = inject(KardexService);
  private readonly productosService = inject(ProductosService);
  private readonly integracionContable = inject(IntegracionContableService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  protected getOrdenesPath(): string {
    return `${this.getTenantPath()}/ordenesCompra`;
  }

  protected getOrdenesRef() {
    return ref(this.database, this.getOrdenesPath());
  }

  protected getItemsPath(ordenId: string): string {
    return `${this.getTenantPath()}/ordenesCompraItems/${ordenId}`;
  }

  protected getItemsRef(ordenId: string) {
    return ref(this.database, this.getItemsPath(ordenId));
  }

  protected getRecepcionesPath(): string {
    return `${this.getTenantPath()}/recepcionesOC`;
  }

  protected getRecepcionesRef() {
    return ref(this.database, this.getRecepcionesPath());
  }

  private getConsecutivoOCPath(): string {
    return `${this.getTenantPath()}/consecutivos/ordenesCompra`;
  }

  private getConsecutivoOCRef() {
    return ref(this.database, this.getConsecutivoOCPath());
  }

  private getOrdenRef(ordenId: string) {
    return ref(this.database, `${this.getOrdenesPath()}/${ordenId}`);
  }

  private getItemRef(ordenId: string, itemId: string) {
    return ref(this.database, `${this.getItemsPath(ordenId)}/${itemId}`);
  }

  getOrdenesCompra(): Observable<OrdenCompra[]> {
    return new Observable<OrdenCompra[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getOrdenesRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, OrdenCompra>;
          const ordenes = Object.entries(raw)
            .map(([id, orden]) => ({
              ...orden,
              id
            }));

          const uniqueById = new Map<string, OrdenCompra>();
          ordenes.forEach((orden) => {
            if (!orden.id) {
              return;
            }
            uniqueById.set(orden.id, orden);
          });

          const uniqueByNumero = new Map<string, OrdenCompra>();
          uniqueById.forEach((orden) => {
            const key = (orden.numero || '').trim().toUpperCase();
            if (!key) {
              uniqueByNumero.set(orden.id!, orden);
              return;
            }

            const actual = uniqueByNumero.get(key);
            if (!actual || (orden.actualizadoEn ?? 0) >= (actual.actualizadoEn ?? 0)) {
              uniqueByNumero.set(key, orden);
            }
          });

          const ordenesNormalizadas = Array.from(uniqueByNumero.values())
            .sort((a, b) => b.creadoEn - a.creadoEn);

          subscriber.next(ordenesNormalizadas);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async crearOrdenCompra(input: CrearOrdenCompraInput): Promise<string> {
    const ordenRef = push(this.getOrdenesRef());
    const timestamp = Date.now();
    const ordenId = ordenRef.key!;
    const numero = await this.generarNumeroOrdenCompra();

    await set(ordenRef, {
      ...input.orden,
      numero,
      creadoEn: timestamp,
      actualizadoEn: timestamp
    });

    const itemsPayload: Record<string, Omit<OrdenCompraItem, 'id'>> = {};
    input.items.forEach((item) => {
      const itemRef = push(this.getItemsRef(ordenId));
      itemsPayload[itemRef.key!] = {
        ...item,
        cantidadRecibida: item.cantidadRecibida ?? 0
      };
    });

    await set(this.getItemsRef(ordenId), itemsPayload);

    return ordenId;
  }

  private async generarNumeroOrdenCompra(): Promise<string> {
    const usedNumbers = await this.obtenerNumerosOCExistentes();

    const tx = await runTransaction(this.getConsecutivoOCRef(), (current: unknown) => {
      const actual = typeof current === 'number' && Number.isFinite(current) ? current : 0;
      return actual + 1;
    });

    let next = typeof tx.snapshot?.val() === 'number' ? Number(tx.snapshot.val()) : 1;
    if (!Number.isFinite(next) || next < 1) {
      next = 1;
    }

    let numero = this.formatearNumeroOC(next);
    while (usedNumbers.has(numero)) {
      next += 1;
      numero = this.formatearNumeroOC(next);
    }

    await set(this.getConsecutivoOCRef(), next);
    return numero;
  }

  private async obtenerNumerosOCExistentes(): Promise<Set<string>> {
    const snapshot = await get(this.getOrdenesRef());
    if (!snapshot.exists()) {
      return new Set<string>();
    }

    const raw = snapshot.val() as Record<string, OrdenCompra>;
    return new Set(
      Object.values(raw)
        .map((orden) => (orden.numero || '').trim())
        .filter((numero) => numero.length > 0)
    );
  }

  private formatearNumeroOC(consecutivo: number): string {
    return `OC-${String(Math.floor(consecutivo)).padStart(4, '0')}`;
  }

  async actualizarOrdenCompra(ordenId: string, orden: Partial<OrdenCompra>): Promise<void> {
    await update(this.getOrdenRef(ordenId), {
      ...orden,
      actualizadoEn: Date.now()
    });
  }

  async getOrdenCompraById(ordenId: string): Promise<OrdenCompra | null> {
    const snapshot = await get(this.getOrdenRef(ordenId));
    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...(snapshot.val() as OrdenCompra),
      id: ordenId
    };
  }

  async getItemsOrden(ordenId: string): Promise<OrdenCompraItem[]> {
    const snapshot = await get(this.getItemsRef(ordenId));
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, OrdenCompraItem>;
    return Object.entries(raw).map(([id, item]) => ({
      ...item,
      id
    }));
  }

  async reemplazarItemsOrden(ordenId: string, items: Omit<OrdenCompraItem, 'id'>[]): Promise<void> {
    const itemsPayload: Record<string, Omit<OrdenCompraItem, 'id'>> = {};

    items.forEach((item) => {
      const itemRef = push(this.getItemsRef(ordenId));
      itemsPayload[itemRef.key!] = {
        ...item,
        cantidadRecibida: item.cantidadRecibida ?? 0
      };
    });

    await set(this.getItemsRef(ordenId), itemsPayload);
    await this.actualizarOrdenCompra(ordenId, {});
  }

  async cambiarEstadoOrdenCompra(ordenId: string, estado: EstadoOrdenCompra): Promise<void> {
    if (estado === 'RECIBIDA' || estado === 'RECIBIDA_PARCIAL') {
      throw new Error('El estado RECIBIDA se define solamente desde el flujo de recepcion.');
    }

    await this.actualizarOrdenCompra(ordenId, { estado });
  }

  async recibirOrdenCompra(input: RecibirOrdenCompraInput): Promise<EstadoOrdenCompra> {
    const itemsOrden = await this.getItemsOrden(input.ordenId);
    const itemsPorId = new Map(itemsOrden.map((item) => [item.id!, item]));

    const recepcionesMap: Record<string, RecepcionOrdenCompraItem> = {};

    for (const itemInput of input.items) {
      if (itemInput.cantidadRecibida <= 0) {
        continue;
      }

      const itemActual = itemsPorId.get(itemInput.itemId);
      if (!itemActual) {
        throw new Error(`El item ${itemInput.itemId} no existe en la orden.`);
      }

      const pendiente = itemActual.cantidad - (itemActual.cantidadRecibida ?? 0);
      if (itemInput.cantidadRecibida > pendiente) {
        throw new Error(`La cantidad recibida supera el pendiente para el item ${itemInput.itemId}.`);
      }

      await this.kardexService.registrarEntradaDesdeOC({
        productoId: itemInput.productoId,
        almacenId: input.almacenId,
        ordenId: input.ordenId,
        cantidad: itemInput.cantidadRecibida,
        costoUnitario: itemInput.costoUnitario,
        notas: input.notas,
        userId: input.userId
      });

      await runTransaction(ref(this.database, `${this.getItemsPath(input.ordenId)}/${itemInput.itemId}/cantidadRecibida`), (current: unknown) => {
        const actual = typeof current === 'number' && Number.isFinite(current) ? current : 0;
        return actual + itemInput.cantidadRecibida;
      });

      if (itemInput.actualizarPrecioVenta && Number(itemInput.precioVentaNuevo) > 0) {
        await this.productosService.actualizarProducto(itemInput.productoId, {
          precioVenta: Number(itemInput.precioVentaNuevo)
        });
      }

      recepcionesMap[itemInput.itemId] = {
        cantidadRecibida: itemInput.cantidadRecibida,
        costoUnitario: itemInput.costoUnitario
      };
    }

    const orden = await this.getOrdenCompraById(input.ordenId);
    if (!orden) {
      throw new Error('Orden de compra no encontrada.');
    }

    const recepcionRef = push(this.getRecepcionesRef());
    const recepcionId = recepcionRef.key!;
    const recepcion: RecepcionOC = {
      id: recepcionId,
      ordenId: input.ordenId,
      almacenId: input.almacenId,
      items: recepcionesMap,
      contabilizarRecepcion: input.contabilizarRecepcion ?? false,
      documentoProveedorNumero: input.documentoProveedorNumero ?? '',
      documentoProveedorFecha: input.documentoProveedorFecha ?? null,
      documentoProveedorSubtotal: Number(input.documentoProveedorSubtotal ?? 0),
      documentoProveedorIva: Number(input.documentoProveedorIva ?? 0),
      documentoProveedorTotal: Number(input.documentoProveedorTotal ?? 0),
      documentoProveedorAutorizacion: input.documentoProveedorAutorizacion ?? '',
      notas: input.notas ?? '',
      creadoPor: input.userId,
      creadoEn: input.fechaRecepcion ?? Date.now()
    };
    const { id: _recepcionId, ...recepcionPayload } = recepcion;
    await set(recepcionRef, recepcionPayload);

    const itemsActualizados = await this.getItemsOrden(input.ordenId);
    const estado = this.calcularEstadoRecepcion(itemsActualizados);

    await update(this.getOrdenRef(input.ordenId), {
      estado,
      actualizadoEn: Date.now()
    });

    await this.integracionContable.contabilizarRecepcionOrdenCompra(orden, itemsOrden, recepcion);

    return estado;
  }

  private calcularEstadoRecepcion(items: OrdenCompraItem[]): EstadoOrdenCompra {
    if (items.length === 0) {
      return 'ENVIADA';
    }

    const todosRecibidos = items.every((item) => (item.cantidadRecibida ?? 0) >= item.cantidad);
    if (todosRecibidos) {
      return 'RECIBIDA';
    }

    const algunoRecibido = items.some((item) => (item.cantidadRecibida ?? 0) > 0);
    return algunoRecibido ? 'RECIBIDA_PARCIAL' : 'ENVIADA';
  }
}

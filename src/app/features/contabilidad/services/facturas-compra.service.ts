import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { KardexService } from '../../inventario/services/kardex.service';
import { EstadoFacturaCompra, FacturaCompra, FacturaCompraItem } from '../models/compras.models';
import { IntegracionContableService } from './integracion-contable.service';

export interface CrearFacturaCompraInput {
  factura: Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'>;
  items: Omit<FacturaCompraItem, 'id'>[];
}

@Injectable({
  providedIn: 'root'
})
export class FacturasCompraService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly kardexService = inject(KardexService);
  private readonly integracionContable = inject(IntegracionContableService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getFacturasPath(): string {
    return `${this.getTenantPath()}/facturasCompra`;
  }

  private getFacturasRef() {
    return ref(this.database, this.getFacturasPath());
  }

  private getFacturaRef(facturaId: string) {
    return ref(this.database, `${this.getFacturasPath()}/${facturaId}`);
  }

  private getItemsPath(facturaId: string): string {
    return `${this.getTenantPath()}/facturasCompraItems/${facturaId}`;
  }

  private getItemsRef(facturaId: string) {
    return ref(this.database, this.getItemsPath(facturaId));
  }

  private getConsecutivoRef() {
    return ref(this.database, `${this.getTenantPath()}/secuencias/facturasCompra`);
  }

  getFacturasCompra(): Observable<FacturaCompra[]> {
    return new Observable<FacturaCompra[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getFacturasRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const raw = snapshot.val() as Record<string, FacturaCompra>;
          const facturas = Object.entries(raw)
            .map(([id, factura]) => ({ ...factura, id }))
            .sort((a, b) => (b.creadoEn ?? 0) - (a.creadoEn ?? 0));
          subscriber.next(facturas);
        },
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async getFacturaCompraById(facturaId: string): Promise<FacturaCompra | null> {
    const snapshot = await get(this.getFacturaRef(facturaId));
    if (!snapshot.exists()) {
      return null;
    }
    return { ...(snapshot.val() as FacturaCompra), id: facturaId };
  }

  async getItems(facturaId: string): Promise<FacturaCompraItem[]> {
    const snapshot = await get(this.getItemsRef(facturaId));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, FacturaCompraItem>;
    return Object.entries(raw).map(([id, item]) => ({ ...item, id }));
  }

  async crearFacturaCompra(input: CrearFacturaCompraInput): Promise<string> {
    const facturaRef = push(this.getFacturasRef());
    const facturaId = facturaRef.key!;
    const timestamp = Date.now();
    const numero = await this.generarNumero();

    await set(facturaRef, {
      ...input.factura,
      numero,
      creadoEn: timestamp,
      actualizadoEn: timestamp
    });
    await this.escribirItems(facturaId, input.items);

    return facturaId;
  }

  async actualizarFacturaCompra(facturaId: string, factura: Partial<FacturaCompra>): Promise<void> {
    await update(this.getFacturaRef(facturaId), {
      ...factura,
      actualizadoEn: Date.now()
    });
  }

  async reemplazarItems(facturaId: string, items: Omit<FacturaCompraItem, 'id'>[]): Promise<void> {
    await this.escribirItems(facturaId, items);
    await this.actualizarFacturaCompra(facturaId, {});
  }

  private async escribirItems(facturaId: string, items: Omit<FacturaCompraItem, 'id'>[]): Promise<void> {
    const payload: Record<string, Omit<FacturaCompraItem, 'id'>> = {};
    items.forEach((item) => {
      const itemRef = push(this.getItemsRef(facturaId));
      payload[itemRef.key!] = item;
    });
    await set(this.getItemsRef(facturaId), payload);
  }

  /**
   * Registra la factura (BORRADOR → REGISTRADA): alimenta inventario si aplica
   * y dispara la contabilización automática.
   */
  async registrarFacturaCompra(facturaId: string): Promise<void> {
    const factura = await this.getFacturaCompraById(facturaId);
    if (!factura) {
      throw new Error('Factura de compra no encontrada.');
    }
    if (factura.estado === 'ANULADA') {
      throw new Error('La factura está anulada.');
    }

    const items = await this.getItems(facturaId);
    const userId = this.authService.currentUser()?.uid ?? 'sistema';

    // 1) Contabilizar primero: valida las cuentas y crea el asiento. Si falla (p. ej. una
    //    cuenta sin configurar), lanza el error y no se altera inventario ni el estado.
    await this.integracionContable.contabilizarFacturaCompra({ ...factura, estado: 'REGISTRADA' }, items);

    // 2) Alimentar inventario (solo si aplica) una vez confirmado el asiento.
    //    Nota de crédito (04) = devolución → salida de stock; el resto = entrada.
    const esNotaCredito = factura.tipoComprobante === '04';
    if (factura.alimentaInventario && factura.almacenId) {
      for (const item of items) {
        if (!item.productoId || item.cantidad <= 0) {
          continue;
        }
        const movimientoInput = {
          productoId: item.productoId,
          almacenId: factura.almacenId,
          ordenId: facturaId,
          cantidad: item.cantidad,
          costoUnitario: item.costoUnitario,
          notas: `${esNotaCredito ? 'NC' : 'Factura'} compra ${factura.numero ?? ''}`.trim(),
          userId
        };
        if (esNotaCredito) {
          await this.kardexService.registrarSalidaDevolucion(movimientoInput);
        } else {
          await this.kardexService.registrarEntradaDesdeOC(movimientoInput);
        }
      }
    }

    // 3) Marcar como registrada.
    await this.actualizarFacturaCompra(facturaId, { estado: 'REGISTRADA' });
  }

  async cambiarEstado(facturaId: string, estado: EstadoFacturaCompra): Promise<void> {
    await this.actualizarFacturaCompra(facturaId, { estado });
  }

  private async generarNumero(): Promise<string> {
    const tx = await runTransaction(this.getConsecutivoRef(), (current: unknown) => {
      const actual = typeof current === 'number' && Number.isFinite(current) ? current : 0;
      return actual + 1;
    });
    const next = typeof tx.snapshot?.val() === 'number' ? Number(tx.snapshot.val()) : 1;
    return `FC-${String(Math.max(1, next)).padStart(4, '0')}`;
  }
}

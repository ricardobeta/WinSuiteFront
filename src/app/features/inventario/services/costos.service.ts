import { Injectable, inject } from '@angular/core';
import { Database, get, ref } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import {
  CostoAnalisisResultado,
  CostoAnalisisRow,
  KardexEntry,
  MetodoCosteo,
  Producto
} from '../models/inventario.models';

interface Layer {
  qty: number;
  cost: number;
}

@Injectable({
  providedIn: 'root'
})
export class CostosService {
  private readonly db = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  async calcularAnalisisCostos(metodo: MetodoCosteo, productoId?: string): Promise<CostoAnalisisResultado> {
    const [productosSnapshot, kardexSnapshot] = await Promise.all([
      get(ref(this.db, `${this.getTenantPath()}/productos`)),
      get(ref(this.db, `${this.getTenantPath()}/kardex`))
    ]);

    const productosRaw = (productosSnapshot.val() as Record<string, Producto> | null) ?? {};
    const kardexRaw = (kardexSnapshot.val() as Record<string, Record<string, KardexEntry>> | null) ?? {};

    const productos = Object.entries(productosRaw)
      .map(([id, producto]) => ({ ...producto, id }))
      .filter((producto) => !productoId || producto.id === productoId);

    const rows: CostoAnalisisRow[] = productos.map((producto) => {
      const movimientos = Object.values(kardexRaw[producto.id!] ?? {})
        .sort((a, b) => a.creadoEn - b.creadoEn);

      return this.calcularFilaProducto(producto.id!, producto.nombre, movimientos, metodo);
    });

    const valorTotalInventario = rows.reduce((sum, row) => sum + row.valorTotal, 0);
    const cogsTotal = rows.reduce((sum, row) => sum + row.cogs, 0);
    const ventasEstimadas = rows.reduce((sum, row) => sum + row.salidas * row.costoPromedio * 1.25, 0);
    const margenBrutoEstimado = ventasEstimadas > 0 ? ((ventasEstimadas - cogsTotal) / ventasEstimadas) * 100 : 0;

    return {
      rows,
      valorTotalInventario,
      cogsTotal,
      margenBrutoEstimado
    };
  }

  async calcularCostoSalidaUnitario(productoId: string, cantidad: number, metodo: MetodoCosteo): Promise<number> {
    if (cantidad <= 0) {
      return 0;
    }

    const kardexSnapshot = await get(ref(this.db, `${this.getTenantPath()}/kardex/${productoId}`));
    const movimientos = kardexSnapshot.exists()
      ? Object.values(kardexSnapshot.val() as Record<string, KardexEntry>).sort((a, b) => a.creadoEn - b.creadoEn)
      : [];

    const layers = this.construirCapas(movimientos, metodo);
    const costoTotal = this.estimarCostoConsumo(layers, cantidad, metodo);

    return cantidad > 0 ? costoTotal / cantidad : 0;
  }

  private calcularFilaProducto(
    productoId: string,
    productoNombre: string,
    movimientos: KardexEntry[],
    metodo: MetodoCosteo
  ): CostoAnalisisRow {
    let entradas = 0;
    let salidas = 0;
    let saldoFinal = 0;
    let cogs = 0;
    let costoPromedio = 0;
    let saldoInicial = 0;
    const layers: Layer[] = [];

    movimientos.forEach((movimiento, index) => {
      const esEntrada = this.esEntrada(movimiento);
      const esSalida = this.esSalida(movimiento);

      if (index === 0 && movimiento.saldoCantidad !== undefined) {
        saldoInicial = 0;
      }

      if (esEntrada) {
        entradas += movimiento.cantidad;
        saldoFinal += movimiento.cantidad;
        layers.push({ qty: movimiento.cantidad, cost: movimiento.costoUnitario });
      }

      if (esSalida) {
        salidas += movimiento.cantidad;
        saldoFinal -= movimiento.cantidad;
        cogs += this.estimarCostoConsumo(layers, movimiento.cantidad, metodo);
      }
    });

    const totalQty = layers.reduce((sum, layer) => sum + layer.qty, 0);
    const totalValue = layers.reduce((sum, layer) => sum + layer.qty * layer.cost, 0);
    costoPromedio = totalQty > 0 ? totalValue / totalQty : 0;

    return {
      productoId,
      producto: productoNombre,
      saldoInicial,
      entradas,
      salidas,
      saldoFinal: Math.max(0, saldoFinal),
      costoPromedio,
      valorTotal: Math.max(0, saldoFinal) * costoPromedio,
      cogs
    };
  }

  private construirCapas(movimientos: KardexEntry[], metodo: MetodoCosteo): Layer[] {
    const layers: Layer[] = [];

    movimientos.forEach((movimiento) => {
      const esEntrada = this.esEntrada(movimiento);
      const esSalida = this.esSalida(movimiento);

      if (esEntrada) {
        layers.push({ qty: movimiento.cantidad, cost: movimiento.costoUnitario });
      }

      if (esSalida) {
        this.estimarCostoConsumo(layers, movimiento.cantidad, metodo);
      }
    });

    return layers;
  }

  private estimarCostoConsumo(layers: Layer[], cantidad: number, metodo: MetodoCosteo): number {
    let restante = cantidad;
    let costo = 0;

    if (metodo === 'PROMEDIO') {
      const totalQty = layers.reduce((sum, layer) => sum + layer.qty, 0);
      const totalValue = layers.reduce((sum, layer) => sum + layer.qty * layer.cost, 0);
      const costoPromedio = totalQty > 0 ? totalValue / totalQty : 0;

      const qtyConsumida = Math.min(restante, totalQty);
      costo = qtyConsumida * costoPromedio;
      restante -= qtyConsumida;

      let pendiente = qtyConsumida;
      while (pendiente > 0 && layers.length > 0) {
        const layer = layers[0];
        const qty = Math.min(layer.qty, pendiente);
        layer.qty -= qty;
        pendiente -= qty;

        if (layer.qty <= 0) {
          layers.shift();
        }
      }

      return costo;
    }

    while (restante > 0 && layers.length > 0) {
      const idx = metodo === 'LIFO' ? layers.length - 1 : 0;
      const layer = layers[idx];
      const qty = Math.min(layer.qty, restante);

      costo += qty * layer.cost;
      layer.qty -= qty;
      restante -= qty;

      if (layer.qty <= 0) {
        layers.splice(idx, 1);
      }
    }

    return costo;
  }

  private esEntrada(mov: KardexEntry): boolean {
    if (mov.tipo === 'ENTRADA') {
      return true;
    }
    if (mov.tipo === 'AJUSTE') {
      return mov.cantidad > 0;
    }
    return mov.tipo === 'TRASLADO' && mov.motivo === 'TRASLADO_ENTRADA';
  }

  private esSalida(mov: KardexEntry): boolean {
    if (mov.tipo === 'SALIDA') {
      return true;
    }
    if (mov.tipo === 'AJUSTE') {
      return mov.cantidad < 0;
    }
    return mov.tipo === 'TRASLADO' && mov.motivo === 'TRASLADO_SALIDA';
  }
}

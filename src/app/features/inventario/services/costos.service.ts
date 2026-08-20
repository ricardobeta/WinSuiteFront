import { Injectable, inject } from '@angular/core';
import { Database, get, ref } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import {
  CostoAnalisisFiltros,
  CostoAnalisisResultado,
  KardexEntry,
  MetodoCosteo,
  Producto
} from '../models/inventario.models';
import {
  calcularCostoProducto,
  calcularCostoSalidaDesdeMovimientos
} from '../utils/costos-calculo.util';

@Injectable({
  providedIn: 'root'
})
export class CostosService {
  private readonly db = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  async calcularAnalisisCostos(filtros: CostoAnalisisFiltros): Promise<CostoAnalisisResultado> {
    this.validarFiltros(filtros);

    const [productosSnapshot, kardexSnapshot, stockSnapshot] = await Promise.all([
      get(ref(this.db, `${this.getTenantPath()}/productos`)),
      get(ref(this.db, `${this.getTenantPath()}/kardex`)),
      get(ref(this.db, `${this.getTenantPath()}/stock`))
    ]);

    const productosRaw = (productosSnapshot.val() as Record<string, Producto> | null) ?? {};
    const kardexRaw = (kardexSnapshot.val() as Record<string, Record<string, KardexEntry>> | null) ?? {};
    const stockRaw = (stockSnapshot.val() as Record<string, Record<string, { cantidad?: unknown }>> | null) ?? {};
    const esCorteActual = this.esCorteActual(filtros.fechaHasta);

    const productos = Object.entries(productosRaw)
      .map(([id, producto]) => ({ ...producto, id }))
      .filter((producto) => !filtros.productoId || producto.id === filtros.productoId);

    const calculos = productos.map((producto) => {
      const movimientos = Object.entries(kardexRaw[producto.id!] ?? {})
        .map(([id, movimiento]) => ({ ...movimiento, id: movimiento.id || id }));
      const saldoRegistrado = esCorteActual
        ? this.sumarStockProducto(stockRaw[producto.id!] ?? {})
        : null;

      return calcularCostoProducto({
        productoId: producto.id!,
        producto: producto.nombre,
        sku: producto.sku,
        movimientos,
        metodo: filtros.metodo,
        fechaDesde: filtros.fechaDesde,
        fechaHasta: filtros.fechaHasta,
        saldoRegistrado
      });
    }).filter(({ row }) =>
      !!filtros.productoId
      || row.movimientosPeriodo > 0
      || Math.abs(row.saldoInicial) > 0.000001
      || Math.abs(row.saldoRegistrado ?? 0) > 0.000001
    );

    const rows = calculos.map((calculo) => calculo.row)
      .sort((a, b) => b.valorTotal - a.valorTotal || a.producto.localeCompare(b.producto));
    const movimientos = calculos.flatMap((calculo) => calculo.movimientos)
      .sort((a, b) => a.fecha - b.fecha || a.producto.localeCompare(b.producto));

    return {
      rows,
      movimientos,
      valorInicialInventario: this.sumar(rows.map((row) => row.valorInicial)),
      valorEntradasTotal: this.sumar(rows.map((row) => row.valorEntradas)),
      costoSalidasTotal: this.sumar(rows.map((row) => row.costoSalidas)),
      valorTotalInventario: this.sumar(rows.map((row) => row.valorTotal)),
      cogsTotal: this.sumar(rows.map((row) => row.costoVentas)),
      diferenciaConciliacion: this.sumar(rows.map((row) => row.diferenciaConciliacion)),
      productosRevisar: rows.filter((row) => row.estado === 'REVISAR').length,
      esCorteActual,
      generadoEn: Date.now()
    };
  }

  async calcularCostoSalidaUnitario(productoId: string, cantidad: number, metodo: MetodoCosteo): Promise<number> {
    if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;

    const kardexSnapshot = await get(ref(this.db, `${this.getTenantPath()}/kardex/${productoId}`));
    const movimientos = kardexSnapshot.exists()
      ? Object.entries(kardexSnapshot.val() as Record<string, KardexEntry>)
          .map(([id, movimiento]) => ({ ...movimiento, id: movimiento.id || id }))
      : [];

    return calcularCostoSalidaDesdeMovimientos(movimientos, cantidad, metodo);
  }

  private validarFiltros(filtros: CostoAnalisisFiltros): void {
    if (!['FIFO', 'LIFO', 'PROMEDIO'].includes(filtros.metodo)) {
      throw new Error('Selecciona un metodo de costeo valido.');
    }
    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      throw new Error('La fecha inicial no puede ser posterior a la fecha final.');
    }
  }

  private sumarStockProducto(almacenes: Record<string, { cantidad?: unknown }>): number {
    return this.redondearCantidad(Object.values(almacenes).reduce(
      (total, stock) => total + this.numeroSeguro(stock?.cantidad),
      0
    ));
  }

  private esCorteActual(fechaHasta?: number): boolean {
    if (!fechaHasta) return true;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    return fechaHasta >= inicioHoy.getTime();
  }

  private sumar(valores: number[]): number {
    return Math.round((valores.reduce((total, valor) => total + valor, 0) + Number.EPSILON) * 100) / 100;
  }

  private numeroSeguro(value: unknown): number {
    const numero = Number(value);
    return Number.isFinite(numero) ? numero : 0;
  }

  private redondearCantidad(value: number): number {
    return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  }
}

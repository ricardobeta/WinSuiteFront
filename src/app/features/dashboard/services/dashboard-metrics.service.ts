import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref } from '@angular/fire/database';
import { EChartsCoreOption } from 'echarts/core';
import { combineLatest, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ClientesService } from '../../../core/services/clientes.service';
import { ServiciosService } from '../../../core/services/servicios.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReportesContablesService } from '../../contabilidad/services/reportes-contables.service';
import { KardexService } from '../../inventario/services/kardex.service';
import { ProductosService } from '../../inventario/services/productos.service';
import { Producto } from '../../inventario/models/inventario.models';
import { FacturaSriRegistro } from '../../../shared/models/factura.models';
import { VentaDocumento, VentaPago } from '../../ventas/models/ventas.models';
import { VentasService } from '../../ventas/services/ventas.service';
import { DashboardDataMap, DashboardTableRow } from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class DashboardMetricsService {
  private readonly ventasService = inject(VentasService);
  private readonly clientesService = inject(ClientesService);
  private readonly productosService = inject(ProductosService);
  private readonly kardexService = inject(KardexService);
  private readonly serviciosService = inject(ServiciosService);
  private readonly reportesService = inject(ReportesContablesService);
  private readonly database = inject(Database);
  private readonly auth = inject(AuthService);

  getDashboardData(): Observable<DashboardDataMap> {
    return from(this.auth.waitForInitialBootstrap()).pipe(
      switchMap(() => combineLatest([
        this.ventasService.getVentas(),
        this.ventasService.getPagosPorVenta(),
        this.clientesService.getClientes(),
        this.productosService.getProductos(),
        this.kardexService.getStockTotalesPorProducto(),
        this.serviciosService.getServicios(),
        this.observeSriFacturas(),
        this.getAccountingMonthData()
      ])),
      map(([ventas, pagos, clientes, productos, stock, servicios, facturasSri, accounting]) => {
        const completadas = ventas.filter((venta) => venta.estado === 'COMPLETADA');
        const ventasHoy = this.filterToday(completadas);
        const facturasAutorizadas = facturasSri.filter((factura) => this.isSriAuthorized(factura));
        const facturasAutorizadasHoy = facturasAutorizadas.filter((factura) => this.isToday(factura.autorizadaEn ?? factura.actualizadoEn));
        const ultimos7Dias = this.lastDays(7);
        const ventas7Dias = this.groupSalesByDay(completadas, ultimos7Dias);
        const pagos7Dias = this.groupPayments(completadas, pagos, this.startOfDay(ultimos7Dias[0]).getTime(), Date.now());
        const lowStockRows = this.getLowStockRows(productos, stock);
        const totalHoy = this.sumSales(ventasHoy);
        const transaccionesHoy = ventasHoy.length;

        return {
          'sales-today': {
            metric: {
              value: this.currency(totalHoy),
              helper: 'Ventas completadas desde las 00:00.',
              tone: totalHoy > 0 ? 'good' : 'neutral'
            }
          },
          'average-ticket': {
            metric: {
              value: this.currency(transaccionesHoy ? totalHoy / transaccionesHoy : 0),
              helper: `${transaccionesHoy} transacciones hoy.`,
              tone: transaccionesHoy > 0 ? 'good' : 'neutral'
            }
          },
          'transactions-today': {
            metric: {
              value: String(transaccionesHoy),
              helper: `${ventas.filter((venta) => venta.estado === 'REVERTIDA').length} reversos historicos.`,
              tone: transaccionesHoy > 0 ? 'good' : 'neutral'
            }
          },
          'active-customers': {
            metric: {
              value: String(clientes.length),
              helper: `${this.countRecent(clientes.map((cliente) => cliente.creadoEn))} nuevos en 30 dias.`,
              tone: clientes.length > 0 ? 'good' : 'neutral'
            }
          },
          'active-services': {
            metric: {
              value: String(servicios.filter((servicio) => servicio.activo).length),
              helper: `${servicios.length} servicios registrados.`,
              tone: servicios.some((servicio) => servicio.activo) ? 'good' : 'neutral'
            }
          },
          'sri-authorized-invoices': {
            metric: {
              value: String(facturasAutorizadas.length),
              helper: `${facturasAutorizadasHoy.length} autorizadas hoy.`,
              tone: facturasAutorizadas.length > 0 ? 'good' : 'neutral'
            }
          },
          'sales-last-7-days': {
            chartOptions: this.salesTrendOptions(ventas7Dias.labels, ventas7Dias.values),
            emptyMessage: ventas7Dias.values.some((value) => value > 0) ? undefined : 'Aun no hay ventas para graficar.'
          },
          'payment-methods': {
            chartOptions: this.paymentMethodsOptions(pagos7Dias),
            emptyMessage: pagos7Dias.every((item) => item.value === 0) ? 'Sin pagos registrados en los ultimos 7 dias.' : undefined
          },
          'low-stock-products': {
            rows: lowStockRows,
            emptyMessage: lowStockRows.length ? undefined : 'No hay productos bajo minimo.'
          },
          'inventory-value': {
            metric: {
              value: this.currency(this.inventoryValue(productos, stock)),
              helper: `${productos.filter((producto) => producto.activo).length} productos activos.`,
              tone: 'neutral'
            }
          },
          'accounting-month-result': {
            chartOptions: this.accountingOptions(accounting),
            emptyMessage: accounting.totalIngresos + accounting.totalCostos + accounting.totalGastos === 0
              ? 'Sin asientos aprobados para el mes actual.'
              : undefined
          }
        };
      })
    );
  }

  private observeAccountingPulse(): Observable<unknown> {
    return new Observable<unknown>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `contabilidad/${this.auth.getTenantId()}/asientos`),
        (snapshot) => subscriber.next(snapshot.val()),
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  private observeSriFacturas(): Observable<FacturaSriRegistro[]> {
    return new Observable<FacturaSriRegistro[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `Facturacion/${this.auth.getTenantId()}/facturas`),
        (snapshot) => {
          const facturas: FacturaSriRegistro[] = [];
          snapshot.forEach((child) => {
            const value = child.val() as Partial<FacturaSriRegistro> | null;
            if (!value) {
              return false;
            }

            facturas.push({
              ventaId: value.ventaId ?? child.key ?? '',
              ventaNumero: value.ventaNumero ?? '',
              claveAcceso: value.claveAcceso ?? '',
              estadoSri: value.estadoSri ?? '',
              autorizada: value.autorizada === true,
              numeroAutorizacion: value.numeroAutorizacion ?? null,
              fechaAutorizacion: value.fechaAutorizacion ?? null,
              autorizadaEn: typeof value.autorizadaEn === 'number' ? value.autorizadaEn : null,
              ambiente: value.ambiente ?? null,
              establecimiento: value.establecimiento ?? null,
              puntoEmision: value.puntoEmision ?? null,
              secuencial: value.secuencial ?? null,
              total: Number(value.total ?? 0),
              moneda: value.moneda ?? 'USD',
              clienteId: value.clienteId ?? null,
              clienteNombre: value.clienteNombre ?? '',
              firmaId: value.firmaId ?? null,
              mensajes: value.mensajes ?? null,
              creadoEn: typeof value.creadoEn === 'number' ? value.creadoEn : 0,
              actualizadoEn: typeof value.actualizadoEn === 'number' ? value.actualizadoEn : 0
            });

            return false;
          });

          subscriber.next(facturas);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    }).pipe(catchError(() => of([])));
  }

  private getAccountingMonthData(): Observable<{ totalIngresos: number; totalCostos: number; totalGastos: number; resultadoNeto: number }> {
    const today = new Date();
    const desde = this.dateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    const hasta = this.dateInput(today);
    return this.observeAccountingPulse().pipe(
      switchMap(() => from(this.reportesService.generarEstadoResultadoIntegral(desde, hasta))),
      map((value) => ({
        totalIngresos: value.totalIngresos,
        totalCostos: value.totalCostos,
        totalGastos: value.totalGastos,
        resultadoNeto: value.resultadoNeto
      })),
      catchError(() => of({ totalIngresos: 0, totalCostos: 0, totalGastos: 0, resultadoNeto: 0 }))
    );
  }

  private filterToday(ventas: VentaDocumento[]): VentaDocumento[] {
    const from = this.startOfDay(new Date()).getTime();
    const to = this.endOfDay(new Date()).getTime();
    return ventas.filter((venta) => venta.creadoEn >= from && venta.creadoEn <= to);
  }

  private isToday(timestamp: number | null | undefined): boolean {
    if (typeof timestamp !== 'number' || timestamp <= 0) {
      return false;
    }

    const from = this.startOfDay(new Date()).getTime();
    const to = this.endOfDay(new Date()).getTime();
    return timestamp >= from && timestamp <= to;
  }

  private isSriAuthorized(factura: FacturaSriRegistro): boolean {
    const estado = (factura.estadoSri ?? '').trim().toUpperCase();
    return factura.autorizada === true || estado === 'AUTORIZADO' || estado === 'AUTORIZADA';
  }

  private groupSalesByDay(ventas: VentaDocumento[], days: Date[]): { labels: string[]; values: number[] } {
    const labels = days.map((day) => this.shortDay(day));
    const values = days.map((day) => {
      const from = this.startOfDay(day).getTime();
      const to = this.endOfDay(day).getTime();
      return this.round(ventas.filter((venta) => venta.creadoEn >= from && venta.creadoEn <= to).reduce((sum, venta) => sum + venta.total, 0));
    });

    return { labels, values };
  }

  private groupPayments(
    ventas: VentaDocumento[],
    pagosPorVenta: Record<string, VentaPago[]>,
    from: number,
    to: number
  ): Array<{ name: string; value: number }> {
    const totals = new Map([
      ['Efectivo', 0],
      ['Tarjeta', 0],
      ['Transferencia', 0],
      ['QR', 0],
      ['Credito cliente', 0]
    ]);

    ventas
      .filter((venta) => venta.creadoEn >= from && venta.creadoEn <= to)
      .forEach((venta) => {
        const pagos = venta.id ? pagosPorVenta[venta.id] ?? [] : [];
        if (!pagos.length) {
          totals.set('Efectivo', (totals.get('Efectivo') ?? 0) + venta.total);
          return;
        }

        pagos.forEach((pago) => {
          const key = pago.metodo === 'EFECTIVO'
            ? 'Efectivo'
            : pago.metodo === 'TARJETA_CREDITO' || pago.metodo === 'TARJETA_DEBITO'
              ? 'Tarjeta'
              : pago.metodo === 'TRANSFERENCIA'
                ? 'Transferencia'
                : pago.metodo === 'QR'
                  ? 'QR'
                  : 'Credito cliente';
          totals.set(key, (totals.get(key) ?? 0) + pago.monto);
        });
      });

    return Array.from(totals.entries()).map(([name, value]) => ({ name, value: this.round(value) }));
  }

  private getLowStockRows(productos: Producto[], stock: Record<string, number>): DashboardTableRow[] {
    return productos
      .filter((producto) => producto.activo)
      .map((producto) => {
        const cantidad = stock[producto.id ?? ''] ?? 0;
        return { producto, cantidad };
      })
      .filter(({ producto, cantidad }) => cantidad <= producto.stockMinimo)
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 6)
      .map(({ producto, cantidad }) => ({
        label: producto.nombre,
        value: `${cantidad} u.`,
        helper: `Minimo ${producto.stockMinimo}`,
        tone: cantidad <= 0 ? 'danger' : 'warning'
      }));
  }

  private salesTrendOptions(labels: string[], values: number[]): EChartsCoreOption {
    return {
      color: ['#066b5e'],
      tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => this.currency(Number(value ?? 0)) },
      grid: { left: 8, right: 8, top: 18, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: labels, boundaryGap: false },
      yAxis: { type: 'value', axisLabel: { formatter: (value: number) => this.compact(value) } },
      series: [
        {
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.18 },
          symbolSize: 7,
          data: values
        }
      ]
    };
  }

  private paymentMethodsOptions(values: Array<{ name: string; value: number }>): EChartsCoreOption {
    return {
      color: ['#066b5e', '#3a647d', '#00b09f', '#ff9f43', '#8b5cf6'],
      tooltip: { trigger: 'item', valueFormatter: (value: unknown) => this.currency(Number(value ?? 0)) },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}' },
          data: values
        }
      ]
    };
  }

  private accountingOptions(value: { totalIngresos: number; totalCostos: number; totalGastos: number; resultadoNeto: number }): EChartsCoreOption {
    return {
      color: ['#066b5e', '#ff9f43', '#3a647d', '#00b09f'],
      tooltip: { trigger: 'axis', valueFormatter: (item: unknown) => this.currency(Number(item ?? 0)) },
      grid: { left: 8, right: 8, top: 18, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: ['Ingresos', 'Costos', 'Gastos', 'Resultado'] },
      yAxis: { type: 'value', axisLabel: { formatter: (item: number) => this.compact(item) } },
      series: [{ type: 'bar', data: [value.totalIngresos, value.totalCostos, value.totalGastos, value.resultadoNeto] }]
    };
  }

  private inventoryValue(productos: Producto[], stock: Record<string, number>): number {
    return this.round(
      productos.reduce((sum, producto) => {
        const cantidad = stock[producto.id ?? ''] ?? 0;
        return sum + cantidad * Number(producto.precioCosto || 0);
      }, 0)
    );
  }

  private sumSales(ventas: VentaDocumento[]): number {
    return this.round(ventas.reduce((sum, venta) => sum + venta.total, 0));
  }

  private countRecent(timestamps: Array<number | undefined>): number {
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return timestamps.filter((value) => typeof value === 'number' && value >= from).length;
  }

  private lastDays(count: number): Date[] {
    const today = new Date();
    return Array.from({ length: count }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - index)));
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private shortDay(date: Date): string {
    return date.toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit' });
  }

  private dateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private currency(value: number): string {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);
  }

  private compact(value: number): string {
    return new Intl.NumberFormat('es-EC', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}

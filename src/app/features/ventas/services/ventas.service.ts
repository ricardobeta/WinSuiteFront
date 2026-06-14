import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { IntegracionContableService } from '../../contabilidad/services/integracion-contable.service';
import { CostosService } from '../../inventario/services/costos.service';
import { KardexService } from '../../inventario/services/kardex.service';
import { ProductosService } from '../../inventario/services/productos.service';
import { RecetasService } from '../../inventario/services/recetas.service';
import {
  ConfirmarVentaInput,
  MetodoPagoState,
  SesionCaja,
  VentaDetalle,
  VentaDocumento,
  VentaItem,
  VentaPago
} from '../models/ventas.models';
import { VentasConfigService } from './ventas-config.service';

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly costosService = inject(CostosService);
  private readonly kardexService = inject(KardexService);
  private readonly productosService = inject(ProductosService);
  private readonly recetasService = inject(RecetasService);
  private readonly ventasConfig = inject(VentasConfigService);
  private readonly integracionContable = inject(IntegracionContableService);

  private getTenantPath(): string {
    return `ventas/${this.authService.getTenantId()}`;
  }

  private getDocumentosPath(): string {
    return `${this.getTenantPath()}/documentos`;
  }

  private getVentasItemsPath(): string {
    return `${this.getTenantPath()}/ventasItems`;
  }

  private getVentasPagosPath(): string {
    return `${this.getTenantPath()}/ventasPagos`;
  }

  private getSesionesPath(): string {
    return `${this.getTenantPath()}/sesiones`;
  }

  private getContadorPath(): string {
    return `${this.getTenantPath()}/secuencias/ventas`;
  }

  getVentas(): Observable<VentaDocumento[]> {
    return new Observable<VentaDocumento[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getDocumentosPath()),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Omit<VentaDocumento, 'id'>>;
          const ventas = Object.entries(raw)
            .map(([id, venta]) => ({ ...venta, id }))
            .sort((a, b) => b.creadoEn - a.creadoEn);

          subscriber.next(ventas);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getPagosPorVenta(): Observable<Record<string, VentaPago[]>> {
    return new Observable<Record<string, VentaPago[]>>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getVentasPagosPath()),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({});
            return;
          }

          const raw = snapshot.val() as Record<string, Record<string, Omit<VentaPago, 'id'>>>;
          const result: Record<string, VentaPago[]> = {};

          Object.entries(raw).forEach(([ventaId, pagosMap]) => {
            result[ventaId] = Object.entries(pagosMap ?? {}).map(([pagoId, pago]) => ({
              ...pago,
              id: pagoId
            }));
          });

          subscriber.next(result);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getVentaDetalle(ventaId: string): Promise<VentaDetalle | null> {
    const documentoSnapshot = await get(ref(this.database, `${this.getDocumentosPath()}/${ventaId}`));
    if (!documentoSnapshot.exists()) {
      return null;
    }

    const itemsSnapshot = await get(ref(this.database, `${this.getVentasItemsPath()}/${ventaId}`));
    const pagosSnapshot = await get(ref(this.database, `${this.getVentasPagosPath()}/${ventaId}`));

    const items = itemsSnapshot.exists()
      ? Object.entries(itemsSnapshot.val() as Record<string, Omit<VentaItem, 'id'>>).map(([id, value]) => ({ ...value, id }))
      : [];

    const pagos = pagosSnapshot.exists()
      ? Object.entries(pagosSnapshot.val() as Record<string, Omit<VentaPago, 'id'>>).map(([id, value]) => ({ ...value, id }))
      : [];

    return {
      documento: { ...(documentoSnapshot.val() as Omit<VentaDocumento, 'id'>), id: ventaId },
      items,
      pagos
    };
  }

  async ensureSesionActiva(vendedorId: string, vendedorNombre: string, almacenId: string): Promise<SesionCaja> {
    const sesionesSnapshot = await get(ref(this.database, this.getSesionesPath()));

    if (sesionesSnapshot.exists()) {
      const entries = Object.entries(sesionesSnapshot.val() as Record<string, SesionCaja>);
      const sesionActiva = entries.find(([, sesion]) => sesion.vendedorId === vendedorId && sesion.estado === 'ABIERTA');

      if (sesionActiva) {
        const [sesionId, sesion] = sesionActiva;

        if (sesion.almacenId !== almacenId) {
          await update(ref(this.database, `${this.getSesionesPath()}/${sesionId}`), {
            almacenId,
            actualizadoEn: Date.now()
          });

          return {
            ...sesion,
            almacenId,
            id: sesionId
          };
        }

        return {
          ...sesion,
          id: sesionId
        };
      }
    }

    const nuevaSesionRef = push(ref(this.database, this.getSesionesPath()));
    const nuevaSesion: Omit<SesionCaja, 'id'> = {
      vendedorId,
      vendedorNombre,
      almacenId,
      estado: 'ABIERTA',
      fondoInicial: 0,
      fondoCierre: null,
      totalVentas: 0,
      cantidadVentas: 0,
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalOtros: 0,
      abiertaEn: Date.now(),
      cerradaEn: null
    };

    await set(nuevaSesionRef, nuevaSesion);

    return {
      ...nuevaSesion,
      id: nuevaSesionRef.key ?? undefined
    };
  }

  async confirmarVenta(input: ConfirmarVentaInput): Promise<string> {
    if (input.items.length === 0) {
      throw new Error('Agrega al menos un producto o servicio antes de cobrar.');
    }

    const totalPagos = this.roundToTwo(input.pagos.reduce((acum, pago) => acum + this.roundToTwo(this.safeNumber(pago.monto)), 0));
    const subtotalBruto = input.items.reduce((acum, item) => acum + (item.precioUnitario * item.cantidad), 0);
    const descuentoItems = input.items.reduce((acum, item) => {
      const base = this.roundToTwo(item.precioUnitario * item.cantidad);
      const descuentoItem = this.roundToTwo(Math.min(base, base * (item.descuentoItem / 100)));
      return this.roundToTwo(acum + descuentoItem);
    }, 0);

    const subtotalNetoItems = input.items.reduce((acum, item) => {
      const base = this.roundToTwo(item.precioUnitario * item.cantidad);
      const descuentoItem = this.roundToTwo(Math.min(base, base * (item.descuentoItem / 100)));
      return this.roundToTwo(acum + Math.max(0, base - descuentoItem));
    }, 0);

    const descuentoGlobal = this.roundToTwo(Math.max(0, subtotalNetoItems * (input.descuentoGlobal / 100)));
    const descuentoTotal = this.roundToTwo(descuentoItems + descuentoGlobal);

    const impuesto = input.items.reduce((acum, item) => {
      const base = this.roundToTwo(item.precioUnitario * item.cantidad);
      const descuentoItem = this.roundToTwo(Math.min(base, base * (item.descuentoItem / 100)));
      const baseNeta = this.roundToTwo(Math.max(0, base - descuentoItem));
      const proporcion = subtotalNetoItems > 0 ? baseNeta / subtotalNetoItems : 0;
      const descuentoGlobalItem = this.roundToTwo(descuentoGlobal * proporcion);
      const baseImponibleItem = this.roundToTwo(Math.max(0, baseNeta - descuentoGlobalItem));
      const ivaPorcentaje = Number.isFinite(item.ivaPorcentaje) ? Math.max(0, item.ivaPorcentaje) : input.impuestoPorcentaje;

      return this.roundToTwo(acum + this.roundToTwo(baseImponibleItem * (ivaPorcentaje / 100)));
    }, 0);

    const total = this.roundToTwo(Math.max(0, subtotalNetoItems - descuentoGlobal) + impuesto);

    if (Math.abs(totalPagos - total) > 0.01) {
      throw new Error('La suma de los pagos no coincide con el total.');
    }

    const config = await this.ventasConfig.getConfiguracionOnce();

    const costosUnitarios = new Map<string, number>();
    for (const item of input.items) {
      const itemTipo = item.itemTipo ?? 'PRODUCTO';
      if (itemTipo === 'SERVICIO') {
        costosUnitarios.set(item.productoId, 0);
        continue;
      }

      if (itemTipo === 'RECETA') {
        const costoReceta = await this.recetasService.calcularCostoReceta(item.productoId, item.cantidad);
        costosUnitarios.set(item.productoId, this.roundToTwo(costoReceta.costoUnitario));
        continue;
      }

      const producto = await this.productosService.getProductoById(item.productoId);

      if (!producto) {
        throw new Error(`No se encontro configuracion de costeo para ${item.nombre}.`);
      }

      const costoUnitarioCalculado = await this.costosService.calcularCostoSalidaUnitario(
        item.productoId,
        item.cantidad,
        producto.metodoCosteo
      );

      const costoUnitario = Number.isFinite(costoUnitarioCalculado) && costoUnitarioCalculado > 0
        ? costoUnitarioCalculado
        : this.safeNumber(producto.precioCosto);

      costosUnitarios.set(item.productoId, costoUnitario);
    }

    const ventaRef = push(ref(this.database, this.getDocumentosPath()));
    const ventaId = ventaRef.key;

    if (!ventaId) {
      throw new Error('No se pudo crear el identificador de la venta.');
    }

    const movimientosAplicados: Array<{
      itemTipo: 'PRODUCTO' | 'RECETA';
      productoId: string;
      cantidad: number;
      permitirInventarioNegativo: boolean;
    }> = [];

    for (const item of input.items) {
      const itemTipo = item.itemTipo ?? 'PRODUCTO';
      if (itemTipo === 'SERVICIO') {
        continue;
      }

      if (itemTipo === 'RECETA') {
        const permitirInventarioNegativo = config.permitirVentaSinStock || item.permitirInventarioNegativo === true;
        const validacionReceta = await this.recetasService.validarRecetaParaVenta(
          item.productoId,
          input.almacenId,
          item.cantidad,
          permitirInventarioNegativo
        );

        if (!validacionReceta.esValida) {
          for (const aplicado of movimientosAplicados) {
            if (aplicado.itemTipo === 'PRODUCTO') {
              await this.kardexService.actualizarStock(aplicado.productoId, input.almacenId, aplicado.cantidad, true);
              continue;
            }

            await this.recetasService.descontarInventarioReceta({
              recetaId: aplicado.productoId,
              almacenId: input.almacenId,
              cantidadRecetas: aplicado.cantidad,
              motivo: 'DEVOLUCION',
              referenciaId: `ROLLBACK-${ventaId}`,
              creadoPor: input.vendedorId,
              permitirInventarioNegativo: true,
              notas: 'Rollback de receta por error en confirmacion de venta'
            });
          }

          throw new Error(validacionReceta.mensajes[0] ?? `Stock insuficiente para receta ${item.nombre}.`);
        }

        await this.recetasService.descontarInventarioReceta({
          recetaId: item.productoId,
          almacenId: input.almacenId,
          cantidadRecetas: item.cantidad,
          motivo: 'VENTA',
          referenciaId: ventaId,
          creadoPor: input.vendedorId,
          permitirInventarioNegativo,
          notas: `Venta de receta ${item.nombre}`
        });

        movimientosAplicados.push({
          itemTipo: 'RECETA',
          productoId: item.productoId,
          cantidad: item.cantidad,
          permitirInventarioNegativo
        });
        continue;
      }

      const salida = await this.kardexService.actualizarStock(
        item.productoId,
        input.almacenId,
        -item.cantidad,
        config.permitirVentaSinStock
      );

      if (!salida.exito) {
        for (const aplicado of movimientosAplicados) {
          if (aplicado.itemTipo === 'PRODUCTO') {
            await this.kardexService.actualizarStock(aplicado.productoId, input.almacenId, aplicado.cantidad, true);
            continue;
          }

          await this.recetasService.descontarInventarioReceta({
            recetaId: aplicado.productoId,
            almacenId: input.almacenId,
            cantidadRecetas: aplicado.cantidad,
            motivo: 'DEVOLUCION',
            referenciaId: `ROLLBACK-${ventaId}`,
            creadoPor: input.vendedorId,
            permitirInventarioNegativo: true,
            notas: 'Rollback de receta por error en confirmacion de venta'
          });
        }

        throw new Error(`Stock insuficiente para ${item.nombre}.`);
      }

      movimientosAplicados.push({
        itemTipo: 'PRODUCTO',
        productoId: item.productoId,
        cantidad: item.cantidad,
        permitirInventarioNegativo: config.permitirVentaSinStock
      });
    }

    const numero = await this.generarNumeroVenta(config.prefijoPOS);
    const venta: Omit<VentaDocumento, 'id'> = {
      numero,
      sesionId: input.sesionId,
      clienteId: input.clienteId,
      clienteNombre: input.clienteNombre,
      vendedorId: input.vendedorId,
      vendedorNombre: input.vendedorNombre,
      almacenId: input.almacenId,
      estado: 'COMPLETADA',
      subtotal: this.roundToTwo(subtotalBruto),
      descuento: this.roundToTwo(descuentoTotal),
      impuesto: this.roundToTwo(impuesto),
      total,
      moneda: config.monedaBase,
      notas: input.notas,
      creadoEn: Date.now(),
      revertidaEn: null,
      revertidaPor: null,
      motivoReverso: null,
      ventaOriginalId: null
    };

    await set(ventaRef, venta);

    const ventaItemsRef = ref(this.database, `${this.getVentasItemsPath()}/${ventaId}`);
    const itemsPayload = input.items.reduce<Record<string, Omit<VentaItem, 'id'>>>((acc, item) => {
      const itemRef = push(ventaItemsRef);
      const itemId = itemRef.key;

      if (itemId) {
        const baseItem = item.precioUnitario * item.cantidad;
        const descuentoItemMonto = Math.min(baseItem, baseItem * (item.descuentoItem / 100));
        const subtotalItem = Math.max(0, baseItem - descuentoItemMonto);
        const proporcion = subtotalNetoItems > 0 ? subtotalItem / subtotalNetoItems : 0;
        const descuentoGlobalItem = descuentoGlobal * proporcion;
        const baseImponibleItem = Math.max(0, subtotalItem - descuentoGlobalItem);
        const ivaPorcentaje = Number.isFinite(item.ivaPorcentaje) ? Math.max(0, item.ivaPorcentaje) : input.impuestoPorcentaje;

        acc[itemId] = {
          itemTipo: item.itemTipo ?? 'PRODUCTO',
          productoId: item.productoId,
          sku: item.sku,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: this.roundToTwo(item.precioUnitario),
          costoUnitario: this.roundToTwo(costosUnitarios.get(item.productoId) ?? 0),
          descuentoItem: item.descuentoItem,
          ivaPorcentajeItem: ivaPorcentaje,
          subtotalItem: this.roundToTwo(subtotalItem),
          impuestoItem: this.roundToTwo(baseImponibleItem * (ivaPorcentaje / 100))
        };
      }

      return acc;
    }, {});

    await set(ventaItemsRef, itemsPayload);

    const ventaPagosRef = ref(this.database, `${this.getVentasPagosPath()}/${ventaId}`);
    const pagosPayload = input.pagos.reduce<Record<string, Omit<VentaPago, 'id'>>>((acc, pago) => {
      const pagoRef = push(ventaPagosRef);
      const pagoId = pagoRef.key;

      if (pagoId) {
        acc[pagoId] = {
          metodo: pago.metodo,
          monto: this.roundToTwo(this.safeNumber(pago.monto)),
          referencia: pago.referencia,
          creadoEn: Date.now()
        };
      }

      return acc;
    }, {});

    await set(ventaPagosRef, pagosPayload);

    for (const item of input.items) {
      const itemTipo = item.itemTipo ?? 'PRODUCTO';
      if (itemTipo === 'SERVICIO' || itemTipo === 'RECETA') {
        continue;
      }

      const costoUnitario = costosUnitarios.get(item.productoId) ?? 0;
      const saldo = await this.kardexService.getStockActual(item.productoId, input.almacenId);
      await this.kardexService.registrarMovimiento(item.productoId, {
        almacenId: input.almacenId,
        tipo: 'SALIDA',
        motivo: 'VENTA',
        cantidad: item.cantidad,
        costoUnitario,
        costoTotal: costoUnitario * item.cantidad,
        saldoCantidad: saldo,
        referenciaId: ventaId,
        referenciaTipo: 'MANUAL',
        notas: `Venta ${numero}`,
        creadoPor: input.vendedorId,
        creadoEn: Date.now()
      });
    }

    await this.acumularSesion(input.sesionId, total, input.pagos);

    const detalle = await this.getVentaDetalle(ventaId);
    if (detalle) {
      await this.integracionContable.contabilizarVenta(detalle);
    }

    return ventaId;
  }

  async revertirVenta(ventaId: string, motivo: string, userId: string): Promise<void> {
    const detalle = await this.getVentaDetalle(ventaId);
    if (!detalle) {
      throw new Error('Venta no encontrada.');
    }

    if (detalle.documento.estado !== 'COMPLETADA') {
      throw new Error('Solo se pueden revertir ventas completadas.');
    }

    const config = await this.ventasConfig.getConfiguracionOnce();
    const ahora = Date.now();
    const diasTranscurridos = (ahora - detalle.documento.creadoEn) / (1000 * 60 * 60 * 24);

    if (diasTranscurridos > config.diasParaReverso) {
      throw new Error('La venta está fuera de la ventana permitida para reverso.');
    }

    for (const item of detalle.items) {
      const itemTipo = item.itemTipo ?? 'PRODUCTO';
      if (itemTipo === 'SERVICIO') {
        continue;
      }

      if (itemTipo === 'RECETA') {
        await this.recetasService.descontarInventarioReceta({
          recetaId: item.productoId,
          almacenId: detalle.documento.almacenId,
          cantidadRecetas: item.cantidad,
          motivo: 'DEVOLUCION',
          referenciaId: ventaId,
          creadoPor: userId,
          permitirInventarioNegativo: true,
          notas: motivo
        });
        continue;
      }

      await this.kardexService.actualizarStock(item.productoId, detalle.documento.almacenId, item.cantidad, true);

      const saldo = await this.kardexService.getStockActual(item.productoId, detalle.documento.almacenId);
      await this.kardexService.registrarMovimiento(item.productoId, {
        almacenId: detalle.documento.almacenId,
        tipo: 'ENTRADA',
        motivo: 'DEVOLUCION',
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        costoTotal: item.costoUnitario * item.cantidad,
        saldoCantidad: saldo,
        referenciaId: ventaId,
        referenciaTipo: 'MANUAL',
        notas: motivo,
        creadoPor: userId,
        creadoEn: Date.now()
      });
    }

    await update(ref(this.database, `${this.getDocumentosPath()}/${ventaId}`), {
      estado: 'REVERTIDA',
      revertidaEn: Date.now(),
      revertidaPor: userId,
      motivoReverso: motivo
    });

    await this.integracionContable.contabilizarReversoVenta({
      ...detalle,
      documento: {
        ...detalle.documento,
        estado: 'REVERTIDA',
        revertidaEn: Date.now(),
        revertidaPor: userId,
        motivoReverso: motivo
      }
    });
  }

  private async generarNumeroVenta(prefijo: string): Promise<string> {
    const contadorRef = ref(this.database, this.getContadorPath());

    const result = await runTransaction(contadorRef, (current: unknown) => {
      const actual = typeof current === 'number' ? current : 0;
      return actual + 1;
    });

    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `${prefijo}${String(secuencia).padStart(6, '0')}`;
  }

  private async acumularSesion(sesionId: string, totalVenta: number, pagos: MetodoPagoState[]): Promise<void> {
    const sessionRef = ref(this.database, `${this.getSesionesPath()}/${sesionId}`);

    await runTransaction(sessionRef, (current: unknown) => {
      const sesion = (current ?? {}) as Partial<SesionCaja>;
      const totalEfectivo = pagos
        .filter((pago) => pago.metodo === 'EFECTIVO')
        .reduce((acum, pago) => acum + this.roundToTwo(this.safeNumber(pago.monto)), 0);
      const totalTarjeta = pagos
        .filter((pago) => pago.metodo === 'TARJETA_CREDITO' || pago.metodo === 'TARJETA_DEBITO')
        .reduce((acum, pago) => acum + this.roundToTwo(this.safeNumber(pago.monto)), 0);
      const totalOtros = pagos
        .filter((pago) => !['EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO'].includes(pago.metodo))
        .reduce((acum, pago) => acum + this.roundToTwo(this.safeNumber(pago.monto)), 0);

      return {
        ...sesion,
        totalVentas: this.roundToTwo(this.safeNumber(sesion.totalVentas) + this.roundToTwo(totalVenta)),
        cantidadVentas: this.safeNumber(sesion.cantidadVentas) + 1,
        totalEfectivo: this.roundToTwo(this.safeNumber(sesion.totalEfectivo) + totalEfectivo),
        totalTarjeta: this.roundToTwo(this.safeNumber(sesion.totalTarjeta) + totalTarjeta),
        totalOtros: this.roundToTwo(this.safeNumber(sesion.totalOtros) + totalOtros)
      };
    });
  }

  private safeNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private roundToTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, get, limitToLast, onValue, orderByChild, push, query, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { OrdenCompra, OrdenCompraItem, Producto, RecepcionOC } from '../../inventario/models/inventario.models';
import { ProductosService } from '../../inventario/services/productos.service';
import { ProveedoresService } from '../../inventario/services/proveedores.service';
import { VentaDetalle, VentaItem } from '../../ventas/models/ventas.models';
import { FacturaCompra, FacturaCompraItem } from '../models/compras.models';
import {
  AsientoContable,
  AsientoContableLinea,
  ConfiguracionIntegracionContable,
  CuentaPorPagarManualAsiento,
  MapeoCategoriaContable,
  MapeoProveedorContable,
  ModoAsientoAutomatico,
  OrigenAsientoAutomatico,
  OrigenModuloContable,
  PendienteContabilizacion,
  TipoGastoCompra
} from '../models/contabilidad.models';

const DIA_MS = 24 * 60 * 60 * 1000;
import { AsientosContablesService } from './asientos-contables.service';
import { PlanCuentasService } from './plan-cuentas.service';
import { TiposGastoCompraService } from './tipos-gasto-compra.service';

type EstadoOrigenContable = 'DESACTIVADA' | 'ASIENTO_GENERADO' | 'PENDIENTE';

@Injectable({
  providedIn: 'root'
})
export class IntegracionContableService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly productosService = inject(ProductosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly tiposGastoService = inject(TiposGastoCompraService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getIntegracionesRef() {
    return ref(this.database, `${this.getTenantPath()}/configuracion/integraciones`);
  }

  private getMapeosCategoriasRef() {
    return ref(this.database, `${this.getTenantPath()}/mapeosAutomaticos/categorias`);
  }

  private getMapeoCategoriaRef(categoriaId: string) {
    return ref(this.database, `${this.getTenantPath()}/mapeosAutomaticos/categorias/${categoriaId}`);
  }

  private getMapeosProveedoresRef() {
    return ref(this.database, `${this.getTenantPath()}/mapeosAutomaticos/proveedores`);
  }

  private getMapeoProveedorRef(proveedorId: string) {
    return ref(this.database, `${this.getTenantPath()}/mapeosAutomaticos/proveedores/${proveedorId}`);
  }

  private getAsientoOrigenRef(origenTipo: OrigenAsientoAutomatico, origenId: string) {
    return ref(this.database, `${this.getTenantPath()}/asientosOrigen/${origenTipo}/${origenId}`);
  }

  private getPendientesPath(): string {
    return `${this.getTenantPath()}/pendientesContabilizacion`;
  }

  private getPendientesRef() {
    return ref(this.database, this.getPendientesPath());
  }

  getConfiguracion(): Observable<ConfiguracionIntegracionContable> {
    return new Observable<ConfiguracionIntegracionContable>((subscriber) => {
      const unsubscribe = onValue(
        this.getIntegracionesRef(),
        (snapshot) => subscriber.next(snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion()),
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionIntegracionContable> {
    const snapshot = await get(this.getIntegracionesRef());
    return snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion();
  }

  /** Modo con que se guardan los asientos automáticos: 'APROBADO' o 'BORRADOR'. */
  async modoAsientoAutomatico(): Promise<ModoAsientoAutomatico> {
    const config = await this.getConfiguracionOnce();
    return config.modoAsientoAutomatico;
  }

  /**
   * Indica si la contabilidad está activada (toggle "Generar asientos automáticos"). Es el gate
   * único que decide si cualquier módulo debe generar asientos contables.
   */
  async contabilidadActiva(): Promise<boolean> {
    const config = await this.getConfiguracionOnce();
    return config.habilitarAsientosAutomaticos;
  }

  async guardarConfiguracion(configuracion: ConfiguracionIntegracionContable): Promise<void> {
    await set(this.getIntegracionesRef(), {
      ...this.getDefaultConfiguracion(),
      ...configuracion,
      actualizadoEn: Date.now()
    });
  }

  getMapeosCategorias(): Observable<MapeoCategoriaContable[]> {
    return new Observable<MapeoCategoriaContable[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getMapeosCategoriasRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, MapeoCategoriaContable>;
          subscriber.next(Object.entries(raw).map(([categoriaId, mapeo]) => ({ ...mapeo, categoriaId })));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarMapeoCategoria(mapeo: MapeoCategoriaContable): Promise<void> {
    await set(this.getMapeoCategoriaRef(mapeo.categoriaId), {
      ...mapeo,
      actualizadoEn: Date.now()
    });
  }

  getMapeosProveedores(): Observable<MapeoProveedorContable[]> {
    return new Observable<MapeoProveedorContable[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getMapeosProveedoresRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const raw = snapshot.val() as Record<string, MapeoProveedorContable>;
          subscriber.next(Object.entries(raw).map(([proveedorId, mapeo]) => ({ ...mapeo, proveedorId })));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarMapeoProveedor(mapeo: MapeoProveedorContable): Promise<void> {
    await set(this.getMapeoProveedorRef(mapeo.proveedorId), {
      ...mapeo,
      actualizadoEn: Date.now()
    });
  }

  async eliminarMapeoProveedor(proveedorId: string): Promise<void> {
    await remove(this.getMapeoProveedorRef(proveedorId));
  }

  private async getMapeosProveedoresOnce(): Promise<Map<string, MapeoProveedorContable>> {
    const snapshot = await get(this.getMapeosProveedoresRef());
    if (!snapshot.exists()) {
      return new Map();
    }
    const raw = snapshot.val() as Record<string, MapeoProveedorContable>;
    return new Map(Object.entries(raw).map(([proveedorId, mapeo]) => [proveedorId, { ...mapeo, proveedorId }]));
  }

  /** Devuelve la cuenta override de un proveedor para el campo dado, o '' si no está configurada. */
  private cuentaOverrideProveedor(
    contexto: { mapeosProveedores: Map<string, MapeoProveedorContable> },
    proveedorId: string | null | undefined,
    campo: 'cuentaInventarioId' | 'cuentaCuentasPorPagarId'
  ): string {
    if (!proveedorId) {
      return '';
    }
    const valor = contexto.mapeosProveedores.get(proveedorId)?.[campo];
    return typeof valor === 'string' ? valor : '';
  }

  getPendientes(): Observable<PendienteContabilizacion[]> {
    return new Observable<PendienteContabilizacion[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getPendientesRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, PendienteContabilizacion>;
          const pendientes = Object.entries(raw)
            .map(([id, pendiente]) => ({ ...pendiente, id }))
            .filter((pendiente) => pendiente.estado !== 'RESUELTO')
            .sort((a, b) => b.creadoEn - a.creadoEn);
          subscriber.next(pendientes);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getPendientesOnce(limit = 50): Promise<PendienteContabilizacion[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const snapshot = await get(query(
      this.getPendientesRef(),
      orderByChild('creadoEn'),
      limitToLast(boundedLimit)
    ));
    if (!snapshot.exists()) {
      return [];
    }

    const pendientes: PendienteContabilizacion[] = [];
    snapshot.forEach((child) => {
      const pendiente = child.val() as PendienteContabilizacion;
      if (pendiente.estado !== 'RESUELTO') {
        pendientes.push({ ...pendiente, id: child.key ?? undefined });
      }
      return false;
    });
    return pendientes.sort((a, b) => b.creadoEn - a.creadoEn);
  }

  getEstadoOrigen(origenTipo: OrigenAsientoAutomatico, origenId: string): Observable<EstadoOrigenContable> {
    return new Observable<EstadoOrigenContable>((subscriber) => {
      let asientoGenerado = false;
      let tienePendiente = false;

      const emit = () => {
        if (asientoGenerado) {
          subscriber.next('ASIENTO_GENERADO');
        } else if (tienePendiente) {
          subscriber.next('PENDIENTE');
        } else {
          subscriber.next('DESACTIVADA');
        }
      };

      const unsubAsiento = onValue(this.getAsientoOrigenRef(origenTipo, origenId), (snapshot) => {
        asientoGenerado = snapshot.exists();
        emit();
      });
      const unsubPendiente = onValue(this.getPendientesRef(), (snapshot) => {
        if (!snapshot.exists()) {
          tienePendiente = false;
          emit();
          return;
        }
        const raw = snapshot.val() as Record<string, PendienteContabilizacion>;
        tienePendiente = Object.values(raw).some((pendiente) =>
          pendiente.origenTipo === origenTipo &&
          pendiente.origenId === origenId &&
          pendiente.estado !== 'RESUELTO'
        );
        emit();
      });

      return () => {
        unsubAsiento();
        unsubPendiente();
      };
    });
  }

  async contabilizarVenta(detalle: VentaDetalle): Promise<void> {
    await this.ejecutarSeguro('VENTA_POS', detalle.documento.id ?? '', detalle.documento.numero, 'VENTAS', async () => {
      const config = await this.getConfiguracionOnce();
      if (!config.habilitarAsientosAutomaticos) {
        return;
      }
      await this.validarNoContabilizado('VENTA_POS', detalle.documento.id ?? '');
      const contexto = await this.crearContexto(config);
      const productos = await this.cargarProductos(detalle.items);
      const lineas: AsientoContableLinea[] = [];

      for (const pago of detalle.pagos) {
        const cuentaId = pago.metodo === 'CREDITO_CLIENTE' ? config.cuentaCuentasPorCobrarId : config.cuentaCajaBancoId;
        lineas.push(this.crearLinea(contexto, cuentaId, `Cobro ${pago.metodo}`, pago.monto, 0));
      }

      if (detalle.documento.descuento > 0) {
        lineas.push(this.crearLinea(contexto, this.requerir(config.cuentaDescuentosVentasId, 'Cuenta de descuentos en ventas'), 'Descuento en venta', detalle.documento.descuento, 0));
      }

      for (const item of detalle.items) {
        const producto = productos.get(item.productoId);
        const cuentaIngreso = item.itemTipo === 'SERVICIO'
          ? this.resolverCuenta(contexto, producto, 'cuentaIngresoServiciosId', config.cuentaVentasServiciosId, 'Cuenta de ventas servicios')
          : this.resolverCuenta(contexto, producto, 'cuentaIngresoProductosId', config.cuentaVentasProductosId, 'Cuenta de ventas productos');
        lineas.push(this.crearLinea(contexto, cuentaIngreso, item.nombre, 0, item.subtotalItem));
      }

      if (detalle.documento.impuesto > 0) {
        lineas.push(this.crearLinea(contexto, this.requerir(config.cuentaIvaVentasId, 'Cuenta de IVA ventas'), 'IVA ventas', 0, detalle.documento.impuesto));
      }

      for (const item of detalle.items.filter((row) => row.itemTipo !== 'SERVICIO')) {
        const costo = this.roundToTwo(item.costoUnitario * item.cantidad);
        if (costo <= 0) {
          continue;
        }
        const producto = productos.get(item.productoId);
        const cuentaCosto = this.resolverCuenta(contexto, producto, 'cuentaCostoVentaId', config.cuentaCostoVentasId, 'Cuenta de costo de ventas');
        const cuentaInventario = this.resolverCuenta(contexto, producto, 'cuentaInventarioId', config.cuentaInventarioId, 'Cuenta de inventario');
        lineas.push(this.crearLinea(contexto, cuentaCosto, `Costo ${item.nombre}`, costo, 0));
        lineas.push(this.crearLinea(contexto, cuentaInventario, `Salida inventario ${item.nombre}`, 0, costo));
      }

      await this.guardarAsiento(config, {
        fecha: this.fechaDesdeTimestamp(detalle.documento.creadoEn),
        periodo: '',
        tipo: 'AJUSTE',
        glosa: `Venta POS ${detalle.documento.numero}`,
        referencia: detalle.documento.numero,
        estado: 'BORRADOR',
        origen: 'VENTA_POS',
        origenTipo: 'VENTA_POS',
        origenId: detalle.documento.id ?? null,
        origenNumero: detalle.documento.numero,
        origenModulo: 'VENTAS',
        lineas,
        totalDebe: 0,
        totalHaber: 0,
        diferencia: 0
      });
    });
  }

  async contabilizarReversoVenta(detalle: VentaDetalle): Promise<void> {
    await this.ejecutarSeguro('REVERSO_VENTA', detalle.documento.id ?? '', detalle.documento.numero, 'VENTAS', async () => {
      const config = await this.getConfiguracionOnce();
      if (!config.habilitarAsientosAutomaticos) {
        return;
      }
      await this.validarNoContabilizado('REVERSO_VENTA', detalle.documento.id ?? '');
      const snapshot = await get(this.getAsientoOrigenRef('VENTA_POS', detalle.documento.id ?? ''));
      if (!snapshot.exists()) {
        throw new Error('No existe asiento original de la venta para reversar.');
      }

      const asientoOriginalId = String(snapshot.val()?.asientoId ?? '');
      const asientoOriginal = await this.asientosService.getAsientoById(asientoOriginalId);
      if (!asientoOriginal) {
        throw new Error('No se pudo cargar el asiento original de la venta.');
      }

      const reverso: AsientoContable = {
        ...this.asientosService.crearReverso(asientoOriginal),
        fecha: this.fechaDesdeTimestamp(Date.now()),
        glosa: `Reverso venta POS ${detalle.documento.numero}`,
        referencia: detalle.documento.numero,
        origen: 'REVERSO_VENTA',
        origenTipo: 'REVERSO_VENTA',
        origenId: detalle.documento.id ?? null,
        origenNumero: detalle.documento.numero,
        origenModulo: 'VENTAS'
      };
      await this.guardarAsiento(config, reverso);
    });
  }

  async contabilizarRecepcionOrdenCompra(orden: OrdenCompra, items: OrdenCompraItem[], recepcion: RecepcionOC): Promise<void> {
    await this.ejecutarSeguro('RECEPCION_OC', recepcion.id ?? orden.id ?? '', orden.numero, 'INVENTARIO', async () => {
      const config = await this.getConfiguracionOnce();
      if (!config.habilitarAsientosAutomaticos) {
        return;
      }
      if (!recepcion.contabilizarRecepcion || !recepcion.documentoProveedorNumero) {
        throw new Error('Recepcion sin factura/documento de proveedor asociado.');
      }
      await this.validarNoContabilizado('RECEPCION_OC', recepcion.id ?? orden.id ?? '');

      const contexto = await this.crearContexto(config);
      const productos = await this.cargarProductos(items.map((item) => ({
        productoId: item.productoId
      }) as VentaItem));
      const lineas: AsientoContableLinea[] = [];

      for (const item of items) {
        const cantidad = recepcion.items[item.id ?? '']?.cantidadRecibida ?? 0;
        if (cantidad <= 0) {
          continue;
        }
        const producto = productos.get(item.productoId);
        const monto = this.roundToTwo(cantidad * item.costoUnitario);
        // Prioridad de cuenta de inventario: override por proveedor → mapeo por categoría → global.
        const overrideProv = this.cuentaOverrideProveedor(contexto, orden.proveedorId, 'cuentaInventarioId');
        const cuentaDebe = overrideProv
          ? this.requerir(overrideProv, 'Cuenta de inventario')
          : this.resolverCuenta(contexto, producto, 'cuentaInventarioId', config.cuentaInventarioId, 'Cuenta de inventario');
        lineas.push(this.crearLinea(contexto, cuentaDebe, item.descripcion, monto, 0));
      }

      if ((recepcion.documentoProveedorIva ?? 0) > 0) {
        lineas.push(this.crearLinea(contexto, this.requerir(config.cuentaIvaComprasId, 'Cuenta de IVA compras'), 'IVA compras', recepcion.documentoProveedorIva ?? 0, 0));
      }

      const totalHaber = lineas.reduce((total, linea) => total + linea.debe, 0);
      // Cuenta por pagar: override por proveedor → global.
      const cuentaPorPagarId = this.cuentaOverrideProveedor(contexto, orden.proveedorId, 'cuentaCuentasPorPagarId') || config.cuentaCuentasPorPagarId;
      lineas.push(this.crearLinea(contexto, this.requerir(cuentaPorPagarId, 'Cuenta por pagar proveedores'), `Factura proveedor ${recepcion.documentoProveedorNumero}`, 0, totalHaber));

      await this.guardarAsiento(config, {
        fecha: this.fechaDesdeTimestamp(recepcion.documentoProveedorFecha ?? recepcion.creadoEn),
        periodo: '',
        tipo: 'AJUSTE',
        glosa: `Recepcion OC ${orden.numero} - Factura ${recepcion.documentoProveedorNumero}`,
        referencia: recepcion.documentoProveedorNumero,
        estado: 'BORRADOR',
        origen: 'RECEPCION_OC',
        origenTipo: 'RECEPCION_OC',
        origenId: recepcion.id ?? null,
        origenNumero: orden.numero,
        origenModulo: 'INVENTARIO',
        lineas,
        totalDebe: 0,
        totalHaber: 0,
        diferencia: 0
      });
    });
  }

  /**
   * Contabiliza una factura de compra registrada. Respeta el gate global de contabilidad
   * (`habilitarAsientosAutomaticos`): si está desactivado no se genera asiento. Cuando está
   * activo, los errores de configuración se propagan al llamador para mostrarlos en pantalla.
   */
  async contabilizarFacturaCompra(factura: FacturaCompra, items: FacturaCompraItem[]): Promise<void> {
    const origenId = factura.id ?? '';
    if (!origenId) {
      throw new Error('La factura de compra no tiene identificador.');
    }

    // Idempotencia: si ya tiene asiento, no se duplica ni se lanza error.
    const yaContabilizado = await get(this.getAsientoOrigenRef('FACTURA_COMPRA', origenId));
    if (yaContabilizado.exists()) {
      return;
    }

    const tipoGasto = factura.tipoGastoId ? await this.tiposGastoService.getTipoGastoById(factura.tipoGastoId) : null;
    const lineas = await this.construirLineasAsientoCompra(factura, items, tipoGasto);
    await this.guardarAsientoCompra(factura, lineas);
  }

  /**
   * Construye (sin guardar) las líneas del asiento de una factura de compra. El DEBE de gasto
   * se determina por el Tipo de Gasto (plantilla de cuentas); si no hay tipo de gasto se usa la
   * cuenta global de compras como fallback. IVA, retenciones y cuenta por pagar se derivan de la
   * factura. Con varias cuentas de gasto, la primera recibe la base y el resto quedan en 0 para
   * que el usuario reparta en el formulario de revisión.
   */
  async construirLineasAsientoCompra(
    factura: FacturaCompra,
    items: FacturaCompraItem[],
    tipoGasto: TipoGastoCompra | null,
    opciones: { lenient?: boolean } = {}
  ): Promise<AsientoContableLinea[]> {
    // En modo lenient (borrador para el formulario de revisión) las cuentas que falten en la
    // configuración global no lanzan error: la línea se crea SIN cuenta para que el usuario la
    // elija en el popup. En modo estricto (contabilización directa) sí se exige cada cuenta.
    const lenient = opciones.lenient === true;
    const esNotaCredito = factura.tipoComprobante === '04';
    const config = await this.getConfiguracionOnce();
    const contexto = await this.crearContexto(config);
    const documento = this.documentoFacturaCompra(factura);
    const productos = factura.alimentaInventario
      ? await this.cargarProductos(items.map((item) => ({ productoId: item.productoId ?? '' }) as VentaItem))
      : new Map<string, Producto>();
    let lineas: AsientoContableLinea[] = [];

    let baseItems = 0;
    let baseGasto = 0;
    for (const item of items) {
      const base = this.roundToTwo(item.subtotal);
      if (base <= 0) {
        continue;
      }
      baseItems += base;
      if (factura.alimentaInventario && item.productoId) {
        const producto = productos.get(item.productoId);
        // Prioridad de cuenta de inventario: override por proveedor → mapeo por categoría → global.
        const overrideProv = this.cuentaOverrideProveedor(contexto, factura.proveedorId, 'cuentaInventarioId');
        const cuentaInventario = overrideProv
          ? this.resolverCuentaRequerida(contexto, overrideProv, 'Cuenta de inventario', lenient)
          : this.resolverCuenta(contexto, producto, 'cuentaInventarioId', config.cuentaInventarioId, 'Cuenta de inventario', lenient);
        lineas.push(this.crearLineaFlexible(contexto, cuentaInventario, this.descripcionCompra(item.descripcion, documento), base, 0));
      } else {
        baseGasto += base;
      }
    }

    // Fallback (típico en registro manual sin ítems): usar totalSinImpuestos como base del gasto.
    const totalSinImp = this.roundToTwo(factura.totalSinImpuestos ?? 0);
    if (baseItems <= 0 && totalSinImp > 0) {
      baseGasto += totalSinImp;
    }

    // DEBE de gasto/costo: distribuido por las cuentas del tipo de gasto (o cuenta global).
    if (baseGasto > 0) {
      const cuentasGasto = tipoGasto?.cuentasGasto ?? [];
      if (cuentasGasto.length > 0) {
        cuentasGasto.forEach((cuenta, index) => {
          lineas.push(this.crearLineaFlexible(
            contexto,
            this.resolverCuentaRequerida(contexto, cuenta.cuentaId, `Cuenta de gasto ${cuenta.nombreCuenta}`, lenient),
            this.descripcionCompra(cuenta.nombreCuenta, documento),
            index === 0 ? this.roundToTwo(baseGasto) : 0,
            0
          ));
        });
      } else {
        lineas.push(this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, config.cuentaGastoComprasId, 'Cuenta de gasto/compras', lenient), this.descripcionCompra('Compra', documento), this.roundToTwo(baseGasto), 0));
      }
    }

    if ((factura.montoIva ?? 0) > 0) {
      lineas.push(this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, config.cuentaIvaComprasId, 'Cuenta de IVA compras', lenient), this.descripcionCompra('IVA compras', documento), factura.montoIva, 0));
    }

    if (lineas.length === 0) {
      throw new Error('El comprobante no tiene montos para contabilizar (subtotal e IVA en cero).');
    }

    const totalDebe = lineas.reduce((total, linea) => total + linea.debe, 0);

    const totalRetRenta = this.roundToTwo((factura.retencionesRenta ?? []).reduce((total, ret) => total + Number(ret.valRetAir ?? 0), 0));
    const totalRetIva = this.roundToTwo((factura.retencionesIva ?? []).reduce((total, ret) => total + Number(ret.valRetIva ?? 0), 0));

    if (totalRetRenta > 0) {
      lineas.push(this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, config.cuentaRetencionFuenteXPagarId, 'Retención en la fuente por pagar', lenient), 'Retención fuente renta', 0, totalRetRenta));
    }
    if (totalRetIva > 0) {
      lineas.push(this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, config.cuentaRetencionIvaXPagarId, 'Retención IVA por pagar', lenient), 'Retención IVA', 0, totalRetIva));
    }

    const porPagar = this.roundToTwo(totalDebe - totalRetRenta - totalRetIva);
    // Cuenta por pagar: override por proveedor → global.
    const cuentaPorPagarId = this.cuentaOverrideProveedor(contexto, factura.proveedorId, 'cuentaCuentasPorPagarId') || config.cuentaCuentasPorPagarId;
    lineas.push(this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, cuentaPorPagarId, 'Cuenta por pagar proveedores', lenient), this.descripcionCompra('Factura proveedor', documento), 0, porPagar));
    lineas = lineas.map((linea) => ({
      ...linea,
      descripcion: this.descripcionCompra(linea.descripcion, documento)
    }));

    // Nota de crédito de compra = reversa/devolución: se invierte debe ↔ haber.
    if (esNotaCredito) {
      lineas = lineas.map((linea) => ({ ...linea, debe: linea.haber, haber: linea.debe }));
    }

    return lineas;
  }

  /**
   * Persiste el asiento de una factura de compra a partir de las líneas ya definidas/revisadas
   * por el usuario. Es idempotente: si la factura ya tiene asiento, no hace nada.
   */
  async guardarAsientoCompra(factura: FacturaCompra, lineas: AsientoContableLinea[]): Promise<void> {
    const origenId = factura.id ?? '';
    if (!origenId) {
      throw new Error('La factura de compra no tiene identificador.');
    }
    if (!lineas || lineas.length === 0) {
      throw new Error('El asiento no tiene líneas para contabilizar.');
    }

    const yaContabilizado = await get(this.getAsientoOrigenRef('FACTURA_COMPRA', origenId));
    if (yaContabilizado.exists()) {
      return;
    }

    const config = await this.getConfiguracionOnce();
    // Gate de contabilidad: si está desactivada, no se genera asiento (la factura igual se registra).
    if (!config.habilitarAsientosAutomaticos) {
      return;
    }
    const esNotaCredito = factura.tipoComprobante === '04';
    const documento = `${factura.establecimiento}-${factura.puntoEmision}-${factura.secuencial}`;
    const etiqueta = esNotaCredito ? 'Nota de crédito compra' : 'Factura de compra';

    // Adjuntar al asiento los datos de la Cuenta por Pagar para que, si el asiento queda en
    // borrador, al aprobarlo se genere la CxP automáticamente (sin capturar nada a mano). No aplica
    // a notas de crédito (reducen el pasivo) ni cuando no queda saldo por pagar.
    const porPagar = Math.round((Number(factura.importeTotal ?? 0) - Number(factura.totalRetencion ?? 0)) * 100) / 100;
    let cuentaPorPagarManual: CuentaPorPagarManualAsiento | null = null;
    if (!esNotaCredito && porPagar > 0) {
      const proveedor = factura.proveedorId ? await this.proveedoresService.getProveedorById(factura.proveedorId) : null;
      const diasCredito = Number(proveedor?.diasCredito ?? 0);
      const fechaEmisionTs = Number(factura.fechaEmision ?? factura.creadoEn ?? Date.now());
      cuentaPorPagarManual = {
        proveedorId: factura.proveedorId ?? '',
        proveedorNombre: factura.razonSocialProv,
        proveedorIdentificacion: factura.idProv,
        fechaVencimiento: this.fechaDesdeTimestamp(fechaEmisionTs + diasCredito * DIA_MS),
        referencia: documento,
        montoOriginal: porPagar
      };
    }

    await this.guardarAsiento(config, {
      fecha: this.fechaDesdeTimestamp(factura.fechaEmision ?? factura.creadoEn),
      periodo: '',
      tipo: 'AJUSTE',
      glosa: `${etiqueta} ${documento} - ${factura.razonSocialProv}`,
      referencia: documento,
      estado: 'BORRADOR',
      origen: 'FACTURA_COMPRA',
      origenTipo: 'FACTURA_COMPRA',
      origenId,
      origenNumero: factura.numero ?? documento,
      origenModulo: 'COMPRAS',
      lineas,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0,
      cuentaPorPagarManual
    });
  }

  // ===== Cuentas por Pagar (subledger) =====

  /**
   * Construye (sin guardar) las líneas del asiento de un pago a proveedor: un DEBE por cada
   * documento aplicado contra la cuenta por pagar (override por proveedor → cuenta indicada) y un
   * HABER total contra la cuenta de caja/banco de origen. En modo lenient las cuentas faltantes
   * quedan vacías para que el usuario las complete en la revisión.
   */
  async construirLineasPagoProveedor(
    input: {
      cuentaPorPagarId: string;
      cuentaOrigenId: string;
      proveedorId?: string | null;
      glosa: string;
      aplicaciones: { documentoNumero: string; monto: number }[];
    },
    opciones: { lenient?: boolean } = {}
  ): Promise<AsientoContableLinea[]> {
    const lenient = opciones.lenient === true;
    const config = await this.getConfiguracionOnce();
    const contexto = await this.crearContexto(config);
    const cuentaPorPagarId = this.cuentaOverrideProveedor(contexto, input.proveedorId, 'cuentaCuentasPorPagarId') || input.cuentaPorPagarId;
    const lineas: AsientoContableLinea[] = [];
    for (const aplicacion of input.aplicaciones) {
      const monto = this.roundToTwo(aplicacion.monto);
      if (monto <= 0) {
        continue;
      }
      lineas.push(this.crearLineaFlexible(
        contexto,
        this.resolverCuentaRequerida(contexto, cuentaPorPagarId, 'Cuenta por pagar proveedores', lenient),
        `Pago ${input.glosa} · ${aplicacion.documentoNumero}`.trim(),
        monto,
        0
      ));
    }
    const total = this.roundToTwo(lineas.reduce((suma, linea) => suma + linea.debe, 0));
    lineas.push(this.crearLineaFlexible(
      contexto,
      this.resolverCuentaRequerida(contexto, input.cuentaOrigenId, 'Cuenta caja/banco', lenient),
      `Pago a proveedor ${input.glosa}`.trim(),
      0,
      total
    ));
    return lineas;
  }

  async guardarAsientoPagoProveedor(
    pago: { id?: string; numero?: string; fecha: number; glosa: string },
    lineas: AsientoContableLinea[]
  ): Promise<string | null> {
    return this.guardarAsientoSubledger('PAGO_PROVEEDOR', pago.id ?? '', pago.numero ?? null, pago.fecha, `Pago a proveedor ${pago.glosa}`.trim(), lineas);
  }

  /**
   * Construye (sin guardar) el asiento de una cuenta por pagar manual (préstamo, servicio sin
   * factura, provisión, etc.): DEBE cuenta contrapartida (gasto/activo) / HABER cuenta por pagar.
   */
  async construirLineasCxPManual(
    input: {
      cuentaContrapartidaId: string;
      cuentaPorPagarId: string;
      proveedorId?: string | null;
      monto: number;
      glosa: string;
    },
    opciones: { lenient?: boolean } = {}
  ): Promise<AsientoContableLinea[]> {
    const lenient = opciones.lenient === true;
    const config = await this.getConfiguracionOnce();
    const contexto = await this.crearContexto(config);
    const cuentaPorPagarId = this.cuentaOverrideProveedor(contexto, input.proveedorId, 'cuentaCuentasPorPagarId') || input.cuentaPorPagarId;
    const monto = this.roundToTwo(input.monto);
    return [
      this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, input.cuentaContrapartidaId, 'Cuenta contrapartida (gasto/activo)', lenient), input.glosa, monto, 0),
      this.crearLineaFlexible(contexto, this.resolverCuentaRequerida(contexto, cuentaPorPagarId, 'Cuenta por pagar proveedores', lenient), input.glosa, 0, monto)
    ];
  }

  async guardarAsientoCxPManual(
    documento: { id?: string; numero?: string; fecha: number; glosa: string },
    lineas: AsientoContableLinea[]
  ): Promise<string | null> {
    return this.guardarAsientoSubledger('CXP_MANUAL', documento.id ?? '', documento.numero ?? null, documento.fecha, documento.glosa, lineas);
  }

  /**
   * Genera el asiento de reverso de un documento/pago del subledger (para anulaciones), invirtiendo
   * debe↔haber del asiento original. Es idempotente y respeta el gate global de contabilidad.
   */
  async reversarAsientoSubledger(
    origenTipoOriginal: OrigenAsientoAutomatico,
    origenId: string,
    origenTipoReverso: OrigenAsientoAutomatico,
    numero: string | null,
    glosa: string
  ): Promise<void> {
    if (!origenId) {
      return;
    }
    const config = await this.getConfiguracionOnce();
    if (!config.habilitarAsientosAutomaticos) {
      return;
    }
    const snapshot = await get(this.getAsientoOrigenRef(origenTipoOriginal, origenId));
    if (!snapshot.exists()) {
      return;
    }
    const yaReversado = await get(this.getAsientoOrigenRef(origenTipoReverso, origenId));
    if (yaReversado.exists()) {
      return;
    }
    const asientoOriginal = await this.asientosService.getAsientoById(String(snapshot.val()?.asientoId ?? ''));
    if (!asientoOriginal) {
      return;
    }
    const reverso: AsientoContable = {
      ...this.asientosService.crearReverso(asientoOriginal),
      fecha: this.fechaDesdeTimestamp(Date.now()),
      glosa,
      referencia: numero ?? '',
      origen: origenTipoReverso,
      origenTipo: origenTipoReverso,
      origenId,
      origenNumero: numero,
      origenModulo: 'CUENTAS_POR_PAGAR'
    };
    await this.guardarAsiento(config, reverso);
  }

  /** Persiste un asiento del subledger e informa el id del asiento resultante (o null si no aplica). */
  private async guardarAsientoSubledger(
    origenTipo: OrigenAsientoAutomatico,
    origenId: string,
    origenNumero: string | null,
    fechaTimestamp: number,
    glosa: string,
    lineas: AsientoContableLinea[]
  ): Promise<string | null> {
    if (!origenId) {
      throw new Error('El documento no tiene identificador.');
    }
    if (!lineas || lineas.length === 0) {
      throw new Error('El asiento no tiene líneas para contabilizar.');
    }
    const yaContabilizado = await get(this.getAsientoOrigenRef(origenTipo, origenId));
    if (yaContabilizado.exists()) {
      return String(yaContabilizado.val()?.asientoId ?? '') || null;
    }
    const config = await this.getConfiguracionOnce();
    if (!config.habilitarAsientosAutomaticos) {
      return null;
    }
    await this.guardarAsiento(config, {
      fecha: this.fechaDesdeTimestamp(fechaTimestamp),
      periodo: '',
      tipo: 'AJUSTE',
      glosa,
      referencia: origenNumero ?? '',
      estado: 'BORRADOR',
      origen: origenTipo,
      origenTipo,
      origenId,
      origenNumero,
      origenModulo: 'CUENTAS_POR_PAGAR',
      lineas,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    });
    const snapshot = await get(this.getAsientoOrigenRef(origenTipo, origenId));
    return snapshot.exists() ? String(snapshot.val()?.asientoId ?? '') || null : null;
  }

  async reintentarPendiente(pendiente: PendienteContabilizacion): Promise<void> {
    if (!pendiente.id) {
      return;
    }
    await update(ref(this.database, `${this.getPendientesPath()}/${pendiente.id}`), {
      actualizadoEn: Date.now(),
      detalle: `${pendiente.detalle}\nReintento manual pendiente: vuelve a ejecutar la operacion origen o recontabiliza desde el modulo correspondiente.`
    });
  }

  private async ejecutarSeguro(
    origenTipo: OrigenAsientoAutomatico,
    origenId: string,
    origenNumero: string | null | undefined,
    origenModulo: OrigenModuloContable,
    action: () => Promise<void>
  ): Promise<void> {
    if (!origenId) {
      return;
    }
    try {
      await action();
    } catch (error) {
      await this.registrarPendiente({
        origenTipo,
        origenId,
        origenNumero: origenNumero ?? null,
        origenModulo,
        motivo: error instanceof Error ? error.message : 'No se pudo generar el asiento automatico.',
        detalle: error instanceof Error ? error.stack ?? error.message : 'Error desconocido',
        estado: 'PENDIENTE',
        creadoEn: Date.now(),
        actualizadoEn: Date.now()
      });
    }
  }

  private async guardarAsiento(config: ConfiguracionIntegracionContable, asiento: AsientoContable): Promise<void> {
    const asientoId = config.modoAsientoAutomatico === 'APROBADO'
      ? await this.asientosService.aprobarAsiento(asiento)
      : await this.asientosService.guardarBorrador(asiento);

    if (asiento.origenTipo && asiento.origenId) {
      await set(this.getAsientoOrigenRef(asiento.origenTipo, asiento.origenId), {
        asientoId,
        origenTipo: asiento.origenTipo,
        origenId: asiento.origenId,
        origenNumero: asiento.origenNumero ?? null,
        creadoEn: Date.now()
      });
      await this.resolverPendientes(asiento.origenTipo, asiento.origenId);
    }
  }

  private async validarNoContabilizado(origenTipo: OrigenAsientoAutomatico, origenId: string): Promise<void> {
    const snapshot = await get(this.getAsientoOrigenRef(origenTipo, origenId));
    if (snapshot.exists()) {
      throw new Error('El documento ya tiene asiento contable generado.');
    }
  }

  private async crearContexto(config: ConfiguracionIntegracionContable) {
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    const mapeos = await this.getMapeosCategoriasOnce();
    const mapeosProveedores = await this.getMapeosProveedoresOnce();
    return { config, cuentasPorId, mapeos, mapeosProveedores };
  }

  private async getMapeosCategoriasOnce(): Promise<Map<string, MapeoCategoriaContable>> {
    const snapshot = await get(this.getMapeosCategoriasRef());
    if (!snapshot.exists()) {
      return new Map();
    }
    const raw = snapshot.val() as Record<string, MapeoCategoriaContable>;
    return new Map(Object.entries(raw).map(([categoriaId, mapeo]) => [categoriaId, { ...mapeo, categoriaId }]));
  }

  private async cargarProductos(items: Array<Pick<VentaItem, 'productoId'>>): Promise<Map<string, Producto>> {
    const productos = new Map<string, Producto>();
    for (const item of items) {
      if (!item.productoId || productos.has(item.productoId)) {
        continue;
      }
      const producto = await this.productosService.getProductoById(item.productoId);
      if (producto) {
        productos.set(item.productoId, producto);
      }
    }
    return productos;
  }

  private resolverCuenta(
    contexto: {
      cuentasPorId: Map<string, { id?: string; codigo: string; nombre: string; estado: string; permiteMovimiento: boolean }>;
      mapeos: Map<string, MapeoCategoriaContable>;
    },
    producto: Producto | undefined,
    campoCategoria: keyof MapeoCategoriaContable,
    cuentaGlobalId: string,
    nombreCuenta: string,
    lenient = false
  ): string {
    const categoriaId = producto?.categoriaId ?? '';
    const desdeCategoria = contexto.mapeos.get(categoriaId)?.[campoCategoria];
    const candidato = typeof desdeCategoria === 'string' && desdeCategoria ? desdeCategoria : cuentaGlobalId;
    return this.resolverCuentaRequerida(contexto, candidato, nombreCuenta, lenient);
  }

  /**
   * Resuelve una cuenta obligatoria. En modo estricto exige que exista y sea válida (lanza si no).
   * En modo lenient devuelve '' cuando la cuenta falta o no es válida, para dejar que el usuario la
   * complete en el formulario de revisión.
   */
  private resolverCuentaRequerida(
    contexto: { cuentasPorId: Map<string, { estado: string; permiteMovimiento: boolean }> },
    cuentaId: string | undefined,
    nombre: string,
    lenient: boolean
  ): string {
    if (!lenient) {
      return this.requerir(cuentaId, nombre, contexto.cuentasPorId);
    }
    if (!cuentaId) {
      return '';
    }
    const cuenta = contexto.cuentasPorId.get(cuentaId);
    if (!cuenta || cuenta.estado !== 'ACTIVA' || !cuenta.permiteMovimiento) {
      return '';
    }
    return cuentaId;
  }

  private requerir(cuentaId: string | undefined, nombre: string, cuentasPorId?: Map<string, { estado: string; permiteMovimiento: boolean }>): string {
    if (!cuentaId) {
      throw new Error(`Falta configurar ${nombre}.`);
    }
    const cuenta = cuentasPorId?.get(cuentaId);
    if (cuenta && (cuenta.estado !== 'ACTIVA' || !cuenta.permiteMovimiento)) {
      throw new Error(`${nombre} debe ser una cuenta activa de movimiento.`);
    }
    return cuentaId;
  }

  private crearLinea(
    contexto: { cuentasPorId: Map<string, { codigo: string; nombre: string; estado: string; permiteMovimiento: boolean }> },
    cuentaId: string,
    descripcion: string,
    debe: number,
    haber: number
  ): AsientoContableLinea {
    const cuenta = contexto.cuentasPorId.get(cuentaId);
    if (!cuenta) {
      throw new Error(`La cuenta configurada ${cuentaId} no existe.`);
    }
    this.requerir(cuentaId, cuenta.nombre, contexto.cuentasPorId);
    return {
      id: `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      cuentaId,
      codigoCuenta: cuenta.codigo,
      nombreCuenta: cuenta.nombre,
      descripcion,
      debe: this.roundToTwo(debe),
      haber: this.roundToTwo(haber)
    };
  }

  /**
   * Crea una línea de asiento tolerante: si la cuenta es vacía o no existe, la línea queda SIN
   * cuenta (campos en blanco) para que el usuario la seleccione en el formulario de revisión.
   */
  private crearLineaFlexible(
    contexto: { cuentasPorId: Map<string, { codigo: string; nombre: string; estado: string; permiteMovimiento: boolean }> },
    cuentaId: string,
    descripcion: string,
    debe: number,
    haber: number
  ): AsientoContableLinea {
    const cuenta = cuentaId ? contexto.cuentasPorId.get(cuentaId) : undefined;
    return {
      id: `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      cuentaId: cuenta ? cuentaId : '',
      codigoCuenta: cuenta?.codigo ?? '',
      nombreCuenta: cuenta?.nombre ?? '',
      descripcion,
      debe: this.roundToTwo(debe),
      haber: this.roundToTwo(haber)
    };
  }

  private documentoFacturaCompra(factura: FacturaCompra): string {
    return [factura.establecimiento, factura.puntoEmision, factura.secuencial]
      .map((parte) => String(parte ?? '').trim())
      .filter(Boolean)
      .join('-');
  }

  private descripcionCompra(descripcion: string, documento: string): string {
    const base = descripcion.trim() || 'Compra';
    if (!documento || base.includes(documento)) {
      return base;
    }
    return `${base} - Factura #${documento}`;
  }

  private async registrarPendiente(pendiente: Omit<PendienteContabilizacion, 'id'>): Promise<void> {
    const pendientesSnapshot = await get(this.getPendientesRef());
    if (pendientesSnapshot.exists()) {
      const raw = pendientesSnapshot.val() as Record<string, PendienteContabilizacion>;
      const existente = Object.entries(raw).find(([, value]) =>
        value.origenTipo === pendiente.origenTipo &&
        value.origenId === pendiente.origenId &&
        value.estado !== 'RESUELTO'
      );
      if (existente) {
        await update(ref(this.database, `${this.getPendientesPath()}/${existente[0]}`), {
          ...pendiente,
          creadoEn: existente[1].creadoEn,
          actualizadoEn: Date.now()
        });
        return;
      }
    }

    const pendienteRef = push(this.getPendientesRef());
    await set(pendienteRef, pendiente);
  }

  private async resolverPendientes(origenTipo: OrigenAsientoAutomatico, origenId: string): Promise<void> {
    const pendientesSnapshot = await get(this.getPendientesRef());
    if (!pendientesSnapshot.exists()) {
      return;
    }
    const raw = pendientesSnapshot.val() as Record<string, PendienteContabilizacion>;
    for (const [id, pendiente] of Object.entries(raw)) {
      if (pendiente.origenTipo === origenTipo && pendiente.origenId === origenId) {
        await remove(ref(this.database, `${this.getPendientesPath()}/${id}`));
      }
    }
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionIntegracionContable {
    const raw = value as Partial<ConfiguracionIntegracionContable> | null;
    const defaults = this.getDefaultConfiguracion();
    return {
      ...defaults,
      ...raw,
      habilitarAsientosAutomaticos: raw?.habilitarAsientosAutomaticos ?? defaults.habilitarAsientosAutomaticos,
      modoAsientoAutomatico: raw?.modoAsientoAutomatico ?? defaults.modoAsientoAutomatico
    };
  }

  private getDefaultConfiguracion(): ConfiguracionIntegracionContable {
    return {
      habilitarAsientosAutomaticos: false,
      modoAsientoAutomatico: 'BORRADOR',
      cuentaCajaBancoId: '',
      cuentaCuentasPorCobrarId: '',
      cuentaCuentasPorPagarId: '',
      cuentaVentasProductosId: '',
      cuentaVentasServiciosId: '',
      cuentaIvaVentasId: '',
      cuentaIvaComprasId: '',
      cuentaInventarioId: '',
      cuentaCostoVentasId: '',
      cuentaDescuentosVentasId: '',
      cuentaGastoComprasId: '',
      cuentaRetencionFuenteXPagarId: '',
      cuentaRetencionIvaXPagarId: ''
    };
  }

  private fechaDesdeTimestamp(value: number): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}

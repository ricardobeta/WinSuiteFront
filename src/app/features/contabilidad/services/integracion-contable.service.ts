import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { OrdenCompra, OrdenCompraItem, Producto, RecepcionOC } from '../../inventario/models/inventario.models';
import { ProductosService } from '../../inventario/services/productos.service';
import { VentaDetalle, VentaItem } from '../../ventas/models/ventas.models';
import {
  AsientoContable,
  AsientoContableLinea,
  ConfiguracionIntegracionContable,
  MapeoCategoriaContable,
  OrigenAsientoAutomatico,
  PendienteContabilizacion
} from '../models/contabilidad.models';
import { AsientosContablesService } from './asientos-contables.service';
import { PlanCuentasService } from './plan-cuentas.service';

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
        const cuentaDebe = this.resolverCuenta(contexto, producto, 'cuentaInventarioId', config.cuentaInventarioId, 'Cuenta de inventario');
        lineas.push(this.crearLinea(contexto, cuentaDebe, item.descripcion, monto, 0));
      }

      if ((recepcion.documentoProveedorIva ?? 0) > 0) {
        lineas.push(this.crearLinea(contexto, this.requerir(config.cuentaIvaComprasId, 'Cuenta de IVA compras'), 'IVA compras', recepcion.documentoProveedorIva ?? 0, 0));
      }

      const totalHaber = lineas.reduce((total, linea) => total + linea.debe, 0);
      lineas.push(this.crearLinea(contexto, this.requerir(config.cuentaCuentasPorPagarId, 'Cuenta por pagar proveedores'), `Factura proveedor ${recepcion.documentoProveedorNumero}`, 0, totalHaber));

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
    origenModulo: 'VENTAS' | 'INVENTARIO',
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
    return { config, cuentasPorId, mapeos };
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
    nombreCuenta: string
  ): string {
    const categoriaId = producto?.categoriaId ?? '';
    const desdeCategoria = contexto.mapeos.get(categoriaId)?.[campoCategoria];
    return this.requerir(typeof desdeCategoria === 'string' && desdeCategoria ? desdeCategoria : cuentaGlobalId, nombreCuenta, contexto.cuentasPorId);
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
      cuentaDescuentosVentasId: ''
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

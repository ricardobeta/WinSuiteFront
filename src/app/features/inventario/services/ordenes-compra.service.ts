import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable, firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ComprasXmlService } from '../../contabilidad/services/compras-xml.service';
import { CrearFacturaCompraInput, FacturasCompraService } from '../../contabilidad/services/facturas-compra.service';
import { FacturaCompra, FacturaCompraItem } from '../../contabilidad/models/compras.models';
import {
  EstadoOrdenCompra,
  EstadoOrdenCompraLegacy,
  OrdenCompra,
  OrdenCompraItem,
  RecepcionOC,
  RecepcionOrdenCompraItem
} from '../models/inventario.models';
import { KardexService } from './kardex.service';
import { ProductosService } from './productos.service';
import { ProveedoresService } from './proveedores.service';

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

/** Comprobante del proveedor adjuntado en la orden de compra (XML del SRI y/o PDF del RIDE). */
export interface ComprobanteCompraRef {
  xmlArchivoId?: string | null;
  xmlStoragePath?: string | null;
  pdfArchivoId?: string | null;
  pdfDownloadUrl?: string | null;
}

export interface RecibirOrdenCompraInput {
  ordenId: string;
  almacenId: string;
  items: RecibirOrdenCompraItemInput[];
  fechaRecepcion?: number;
  comprobante?: ComprobanteCompraRef;
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
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly comprasXml = inject(ComprasXmlService);
  private readonly facturasCompra = inject(FacturasCompraService);

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

  /**
   * Normaliza los estados del flujo antiguo (5 estados, con pantalla de recepcion separada) al
   * flujo actual de 3 estados. Las OC guardadas antes del cambio se leen ya normalizadas; no hay
   * migracion de datos: al volver a guardarlas quedan con el estado nuevo.
   */
  normalizarEstado(estado: EstadoOrdenCompraLegacy | undefined): EstadoOrdenCompra {
    if (estado === 'ENVIADA') {
      return 'BORRADOR';
    }
    if (estado === 'RECIBIDA_PARCIAL') {
      return 'RECIBIDA';
    }
    return estado ?? 'BORRADOR';
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
              id,
              estado: this.normalizarEstado(orden.estado)
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

    const orden = snapshot.val() as OrdenCompra;
    return {
      ...orden,
      id: ordenId,
      estado: this.normalizarEstado(orden.estado)
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
    if (estado === 'RECIBIDA') {
      throw new Error('El estado RECIBIDA se define solamente al registrar la entrada de mercaderia.');
    }

    await this.actualizarOrdenCompra(ordenId, { estado });
  }

  /**
   * Registra la entrada de mercaderia de una OC: es el unico punto del modulo que incrementa stock
   * y escribe kardex. No genera asiento contable; en su lugar deja un borrador en
   * Contabilidad > Compras para que el asiento lo produzca el flujo contable si el negocio lo usa.
   */
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

    // El borrador contable se crea siempre, incluso con la contabilidad desactivada: asi el
    // historico ya esta en Compras el dia que el negocio empiece a llevar contabilidad.
    const facturaCompraId = await this.crearBorradorCompraDesdeOC(orden, itemsOrden, input.comprobante);

    const recepcionRef = push(this.getRecepcionesRef());
    const recepcionId = recepcionRef.key!;
    const recepcion: RecepcionOC = {
      id: recepcionId,
      ordenId: input.ordenId,
      almacenId: input.almacenId,
      items: recepcionesMap,
      facturaCompraId,
      xmlArchivoId: input.comprobante?.xmlArchivoId ?? null,
      pdfArchivoId: input.comprobante?.pdfArchivoId ?? null,
      notas: input.notas ?? '',
      creadoPor: input.userId,
      creadoEn: input.fechaRecepcion ?? Date.now()
    };
    const { id: _recepcionId, ...recepcionPayload } = recepcion;
    await set(recepcionRef, recepcionPayload);

    await update(this.getOrdenRef(input.ordenId), {
      estado: 'RECIBIDA' as EstadoOrdenCompra,
      actualizadoEn: Date.now()
    });

    return 'RECIBIDA';
  }

  /**
   * Deja un borrador en Contabilidad > Compras a partir de la OC recibida. Si hay XML del proveedor
   * se parsea y se reutiliza el mapeo XML→FacturaCompra de contabilidad; si no, se arma con los
   * datos de la propia OC y el contador completa los campos del SRI.
   *
   * Nunca genera asiento: la factura nace en BORRADOR y el asiento lo produce
   * `FacturasCompraService.registrarFacturaCompra()` cuando el contador la registre.
   *
   * Un fallo aqui no revierte la entrada de stock ya confirmada; se reporta y se devuelve `null`.
   */
  private async crearBorradorCompraDesdeOC(
    orden: OrdenCompra,
    items: OrdenCompraItem[],
    comprobante?: ComprobanteCompraRef
  ): Promise<string | null> {
    try {
      const archivos = {
        archivoId: comprobante?.xmlArchivoId ?? null,
        xmlStoragePath: comprobante?.xmlStoragePath ?? null,
        pdfArchivoId: comprobante?.pdfArchivoId ?? null,
        pdfDownloadUrl: comprobante?.pdfDownloadUrl ?? null
      };

      let borrador: CrearFacturaCompraInput | null = null;

      if (comprobante?.xmlStoragePath) {
        try {
          const parsed = await firstValueFrom(this.comprasXml.parseXml(comprobante.xmlStoragePath));
          const duplicado = await this.facturasCompra.buscarDuplicadoDocumento({
            claveAcceso: parsed.claveAcceso,
            establecimiento: parsed.establecimiento,
            puntoEmision: parsed.puntoEmision,
            secuencial: parsed.secuencial,
            idProv: parsed.idProv,
            tipoComprobante: parsed.tipoComprobante
          });
          if (duplicado?.id) {
            // El comprobante ya estaba cargado en Compras: se enlaza a la OC en vez de duplicarlo.
            await this.facturasCompra.actualizarFacturaCompra(duplicado.id, {
              ordenCompraId: orden.id ?? null,
              proveedorId: orden.proveedorId
            });
            return duplicado.id;
          }
          borrador = this.facturasCompra.construirBorradorDesdeParsed(parsed, archivos);
        } catch (error) {
          // Si el parseo falla (backend caido, XML invalido) igual se deja el borrador con los
          // datos de la OC y el XML adjunto, para que el contador no pierda el registro.
          console.error('No se pudo analizar el XML de la factura; se usan los datos de la OC.', error);
        }
      }

      borrador ??= await this.construirBorradorDesdeOrden(orden, items, archivos);

      const factura: CrearFacturaCompraInput['factura'] = {
        ...borrador.factura,
        // El stock ya lo movio esta recepcion: la factura no debe volver a alimentarlo.
        alimentaInventario: false,
        almacenId: null,
        ordenCompraId: orden.id ?? null,
        proveedorId: orden.proveedorId
      };

      return await this.facturasCompra.crearFacturaCompra({ factura, items: borrador.items });
    } catch (error) {
      console.error('No fue posible crear el borrador de compra desde la orden de compra.', error);
      return null;
    }
  }

  /** Arma el borrador contable con los datos de la OC cuando no hay XML que parsear. */
  private async construirBorradorDesdeOrden(
    orden: OrdenCompra,
    items: OrdenCompraItem[],
    archivos: { archivoId: string | null; xmlStoragePath: string | null; pdfArchivoId: string | null; pdfDownloadUrl: string | null }
  ): Promise<CrearFacturaCompraInput> {
    const proveedor = orden.proveedorId ? await this.proveedoresService.getProveedorById(orden.proveedorId) : null;
    const ahora = Date.now();

    const itemsFactura: Omit<FacturaCompraItem, 'id'>[] = items.map((item) => {
      const subtotal = this.redondear2(item.cantidad * item.costoUnitario);
      const iva = this.redondear2(subtotal * Number(item.impuestoPorcentaje ?? 0) / 100);
      return {
        productoId: item.productoId,
        codigoPrincipal: '',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        descuento: 0,
        ivaPorcentaje: Number(item.impuestoPorcentaje ?? 0),
        subtotal,
        iva,
        total: this.redondear2(subtotal + iva)
      };
    });

    const factura: Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'> = {
      estado: 'BORRADOR',
      origen: 'MANUAL',
      docModificado: null,
      tpIdProv: '01',
      idProv: (proveedor?.ruc ?? '').trim(),
      razonSocialProv: (proveedor?.nombre ?? '').trim(),
      parteRel: 'NO',
      codSustento: '01',
      tipoComprobante: '01',
      // Datos del SRI: los completa el contador al registrar el borrador.
      establecimiento: '',
      puntoEmision: '',
      secuencial: '',
      autorizacion: '',
      claveAcceso: '',
      fechaEmision: orden.fechaEmision ?? ahora,
      fechaRegistro: ahora,
      baseNoGraIva: 0,
      baseImponible: 0,
      baseImpGrav: this.redondear2(orden.subtotal ?? 0),
      baseImpExe: 0,
      montoIce: 0,
      montoIva: this.redondear2(orden.impuesto ?? 0),
      totalSinImpuestos: this.redondear2(orden.subtotal ?? 0),
      importeTotal: this.redondear2(orden.total ?? 0),
      formasDePago: [],
      pagoExterior: { pagoLocExt: '01' },
      retencionesRenta: [],
      retencionesIva: [],
      totalRetencion: 0,
      alimentaInventario: false,
      tipoGastoId: null,
      archivoId: archivos.archivoId,
      xmlStoragePath: archivos.xmlStoragePath,
      pdfArchivoId: archivos.pdfArchivoId,
      pdfDownloadUrl: archivos.pdfDownloadUrl,
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema'
    };

    return { factura, items: itemsFactura };
  }

  private redondear2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, endAt, get, limitToLast, orderByChild, push, query, ref, runTransaction, set, startAt, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { KardexService } from '../../inventario/services/kardex.service';
import { AsientoContableLinea } from '../models/contabilidad.models';
import {
  EstadoFacturaCompra,
  FacturaCompra,
  FacturaCompraItem,
  FacturaCompraParsed,
  TIPO_COMPROBANTE_NOTA_CREDITO,
  TipoIdProveedor
} from '../models/compras.models';
import { CuentasPorPagarService } from './cuentas-por-pagar.service';
import { IntegracionContableService } from './integracion-contable.service';

export interface CrearFacturaCompraInput {
  factura: Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'>;
  items: Omit<FacturaCompraItem, 'id'>[];
}

/** Referencias a los archivos (XML/PDF) asociados a la compra al construir el borrador. */
export interface ArchivosCompraRef {
  archivoId?: string | null;
  xmlStoragePath?: string | null;
  pdfArchivoId?: string | null;
  pdfDownloadUrl?: string | null;
}

export interface FacturasCompraPageCursor {
  value: number;
  key: string;
}

export interface FacturasCompraPageResult {
  items: FacturaCompra[];
  nextCursor: FacturasCompraPageCursor | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FacturasCompraService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);
  private readonly kardexService = inject(KardexService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly cuentasPorPagar = inject(CuentasPorPagarService);

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

  async getFacturasCompraPage(
    periodo: string,
    limit = 50,
    cursor: FacturasCompraPageCursor | null = null
  ): Promise<FacturasCompraPageResult> {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error('Selecciona un periodo contable valido.');
    }

    const [anio, mes] = periodo.split('-').map(Number);
    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0).getTime();
    const hasta = new Date(anio, mes, 1, 0, 0, 0, 0).getTime() - 1;
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const constraints = [orderByChild('fechaEmision'), startAt(desde)];
    constraints.push(cursor ? endAt(cursor.value, cursor.key) : endAt(hasta));
    constraints.push(limitToLast(boundedLimit + (cursor ? 2 : 1)));

    const snapshot = await get(query(this.getFacturasRef(), ...constraints));
    const items: FacturaCompra[] = [];
    snapshot.forEach((child) => {
      if (child.key !== cursor?.key) {
        items.push({ ...(child.val() as FacturaCompra), id: child.key ?? undefined });
      }
      return false;
    });

    const hasMore = items.length > boundedLimit;
    if (hasMore) {
      items.shift();
    }
    items.reverse();
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasMore && last?.id
        ? { value: Number(last.fechaEmision), key: last.id }
        : null,
      hasMore
    };
  }

  async getFacturasCompraPorPeriodo(anio: number, mes: number): Promise<FacturaCompra[]> {
    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0).getTime();
    const hasta = new Date(anio, mes, 1, 0, 0, 0, 0).getTime() - 1;
    const snapshot = await get(query(
      this.getFacturasRef(),
      orderByChild('fechaEmision'),
      startAt(desde),
      endAt(hasta)
    ));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, FacturaCompra>;
    return Object.entries(raw)
      .map(([id, factura]) => ({ ...factura, id }))
      .sort((a, b) => (b.fechaEmision ?? 0) - (a.fechaEmision ?? 0));
  }

  async getFacturaCompraById(facturaId: string): Promise<FacturaCompra | null> {
    const snapshot = await get(this.getFacturaRef(facturaId));
    if (!snapshot.exists()) {
      return null;
    }
    return { ...(snapshot.val() as FacturaCompra), id: facturaId };
  }

  /**
   * Busca una factura de compra ya cargada que coincida con el documento del XML (misma clave de
   * acceso o mismo establecimiento-puntoEmisión-secuencial del mismo proveedor y tipo). Ignora las
   * anuladas y prioriza una que ya esté REGISTRADA. Sirve para avisar de duplicados antes de crear.
   */
  async buscarDuplicadoDocumento(parsed: {
    claveAcceso?: string;
    establecimiento: string;
    puntoEmision: string;
    secuencial: string;
    idProv: string;
    tipoComprobante: string;
  }): Promise<FacturaCompra | null> {
    const snapshot = await get(this.getFacturasRef());
    if (!snapshot.exists()) {
      return null;
    }
    const raw = snapshot.val() as Record<string, FacturaCompra>;
    const clave = (parsed.claveAcceso ?? '').trim();
    const tipo = parsed.tipoComprobante || '01';
    const candidatos = Object.entries(raw)
      .map(([id, factura]) => ({ ...factura, id }))
      .filter((factura) => factura.estado !== 'ANULADA')
      .filter((factura) => {
        const mismaClave = !!clave && (factura.claveAcceso === clave || factura.autorizacion === clave);
        const mismoDoc = factura.establecimiento === parsed.establecimiento
          && factura.puntoEmision === parsed.puntoEmision
          && factura.secuencial === parsed.secuencial
          && factura.idProv === parsed.idProv
          && factura.tipoComprobante === tipo;
        return mismaClave || mismoDoc;
      });
    if (candidatos.length === 0) {
      return null;
    }
    return candidatos.find((factura) => factura.estado === 'REGISTRADA') ?? candidatos[0];
  }

  async getItems(facturaId: string): Promise<FacturaCompraItem[]> {
    const snapshot = await get(this.getItemsRef(facturaId));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, FacturaCompraItem>;
    return Object.entries(raw).map(([id, item]) => ({ ...item, id }));
  }

  /**
   * Construye el borrador (factura + items) de una compra a partir de un XML ya parseado. Es la
   * fuente única de mapeo XML→FacturaCompra que comparten el formulario y la carga masiva. Deja la
   * factura en estado BORRADOR; el usuario luego completa/aprueba/contabiliza.
   */
  construirBorradorDesdeParsed(parsed: FacturaCompraParsed, archivos: ArchivosCompraRef = {}): CrearFacturaCompraInput {
    const fecha = this.timestampDesdeIso(parsed.fechaEmision);
    const esNc = parsed.tipoComprobante === TIPO_COMPROBANTE_NOTA_CREDITO;
    const partesDocMod = (parsed.numDocModificado ?? '').split('-');

    const items: Omit<FacturaCompraItem, 'id'>[] = (parsed.items ?? []).map((item) => {
      const cantidad = this.num(item.cantidad);
      const costo = this.num(item.precioUnitario);
      const ivaPorcentaje = this.num(item.ivaPorcentaje);
      const subtotal = this.round2(cantidad * costo);
      const ivaValor = this.round2(subtotal * ivaPorcentaje / 100);
      return {
        productoId: null,
        codigoPrincipal: item.codigoPrincipal ?? '',
        descripcion: String(item.descripcion ?? ''),
        cantidad,
        costoUnitario: costo,
        descuento: this.num(item.descuento),
        ivaPorcentaje,
        subtotal,
        iva: ivaValor,
        total: this.round2(subtotal + ivaValor)
      };
    });

    const factura: Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'> = {
      estado: 'BORRADOR',
      origen: 'XML',
      docModificado: esNc
        ? {
            tipoComprobante: parsed.codDocModificado || '01',
            establecimiento: partesDocMod[0] ?? '',
            puntoEmision: partesDocMod[1] ?? '',
            secuencial: partesDocMod[2] ?? '',
            fechaEmision: this.timestampDesdeIso(parsed.fechaEmisionDocSustento) || null
          }
        : null,
      tpIdProv: (parsed.tpIdProv as TipoIdProveedor) ?? '01',
      idProv: (parsed.idProv ?? '').trim(),
      razonSocialProv: (parsed.razonSocialProv ?? '').trim(),
      parteRel: 'NO',
      codSustento: '01',
      tipoComprobante: parsed.tipoComprobante || '01',
      establecimiento: (parsed.establecimiento ?? '').trim(),
      puntoEmision: (parsed.puntoEmision ?? '').trim(),
      secuencial: (parsed.secuencial ?? '').trim(),
      autorizacion: parsed.claveAcceso ?? '',
      claveAcceso: parsed.claveAcceso ?? '',
      fechaEmision: fecha,
      fechaRegistro: fecha,
      baseNoGraIva: this.num(parsed.baseNoGraIva),
      baseImponible: this.num(parsed.baseImponible),
      baseImpGrav: this.num(parsed.baseImpGrav),
      baseImpExe: this.num(parsed.baseImpExe),
      montoIce: this.num(parsed.montoIce),
      montoIva: this.num(parsed.montoIva),
      totalSinImpuestos: this.num(parsed.totalSinImpuestos),
      importeTotal: this.num(parsed.importeTotal),
      formasDePago: [],
      pagoExterior: { pagoLocExt: '01' },
      retencionesRenta: [],
      retencionesIva: [],
      totalRetencion: 0,
      alimentaInventario: false,
      tipoGastoId: null,
      archivoId: archivos.archivoId ?? null,
      xmlStoragePath: archivos.xmlStoragePath ?? null,
      pdfArchivoId: archivos.pdfArchivoId ?? null,
      pdfDownloadUrl: archivos.pdfDownloadUrl ?? null,
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema'
    };

    return { factura, items };
  }

  private timestampDesdeIso(iso?: string): number {
    if (!iso) {
      return Date.now();
    }
    const partes = iso.split('-').map((p) => Number(p));
    if (partes.length === 3 && partes.every((n) => Number.isFinite(n))) {
      return new Date(partes[0], partes[1] - 1, partes[2]).getTime();
    }
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? Date.now() : fecha.getTime();
  }

  private num(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async crearFacturaCompra(input: CrearFacturaCompraInput): Promise<string> {
    const facturaRef = push(this.getFacturasRef());
    const facturaId = facturaRef.key!;
    const timestamp = Date.now();
    const numero = await this.generarNumero();

    await set(facturaRef, {
      ...input.factura,
      numero,
      ...this.audit.createMetadata('crear', null, timestamp)
    });
    await this.escribirItems(facturaId, input.items);
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'contabilidad', entityType: 'factura_compra', entityId: facturaId, label: numero },
      summary: `Creo la factura de compra ${numero}`,
      changesAfter: {
        numero,
        proveedor: input.factura.razonSocialProv,
        total: input.factura.importeTotal,
        estado: input.factura.estado
      }
    });

    return facturaId;
  }

  async actualizarFacturaCompra(facturaId: string, factura: Partial<FacturaCompra>): Promise<void> {
    const actual = await this.getFacturaCompraById(facturaId);
    await update(this.getFacturaRef(facturaId), {
      ...factura,
      ...this.audit.createMetadata('actualizar', actual)
    });

    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'contabilidad', entityType: 'factura_compra', entityId: facturaId, label: factura.numero ?? actual?.numero ?? facturaId },
      summary: `Actualizo la factura de compra ${factura.numero ?? actual?.numero ?? facturaId}`,
      changesBefore: actual ? { estado: actual.estado, total: actual.importeTotal, proveedor: actual.razonSocialProv } : null,
      changesAfter: { estado: factura.estado, total: factura.importeTotal, proveedor: factura.razonSocialProv }
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
   *
   * Si se pasan `lineasAsiento` (revisadas por el usuario en el formulario de asiento), se
   * persisten tal cual; en caso contrario se generan automáticamente desde el tipo de gasto.
   */
  async registrarFacturaCompra(facturaId: string, lineasAsiento?: AsientoContableLinea[]): Promise<void> {
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
    //    Solo se contabiliza si la contabilidad está activada; si no, la factura igual se registra.
    const facturaRegistrada: FacturaCompra = { ...factura, estado: 'REGISTRADA' };
    if (await this.integracionContable.contabilidadActiva()) {
      if (lineasAsiento && lineasAsiento.length > 0) {
        await this.integracionContable.guardarAsientoCompra(facturaRegistrada, lineasAsiento);
      } else {
        await this.integracionContable.contabilizarFacturaCompra(facturaRegistrada, items);
      }
    }

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
    await this.audit.recordSafe({
      action: 'aprobar',
      target: { module: 'contabilidad', entityType: 'factura_compra', entityId: facturaId, label: factura.numero ?? facturaId },
      summary: `Registro la factura de compra ${factura.numero ?? facturaId}`,
      changesBefore: { estado: factura.estado },
      changesAfter: { estado: 'REGISTRADA' }
    });

    // 4) Sincronizar el subledger de Cuentas por Pagar (documento-espejo, sin generar asiento).
    //    Una falla aquí no debe revertir la factura ya registrada.
    try {
      await this.cuentasPorPagar.sincronizarDesdeFacturaCompra(facturaRegistrada);
    } catch (error) {
      console.error('No se pudo sincronizar la factura con Cuentas por Pagar.', error);
    }
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

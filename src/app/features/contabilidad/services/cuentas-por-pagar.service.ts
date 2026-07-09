import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ProveedoresService } from '../../inventario/services/proveedores.service';
import { FacturaCompra } from '../models/compras.models';
import { AsientoContableLinea } from '../models/contabilidad.models';
import {
  AgingProveedor,
  ConfiguracionCuentasPorPagar,
  DocumentoPorPagar,
  EstadoDocumentoPorPagar,
  PagoProveedor
} from '../models/cuentas-por-pagar.models';
import { ConfiguracionContableService } from './configuracion-contable.service';
import { IntegracionContableService } from './integracion-contable.service';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface CrearDocumentoManualInput {
  proveedorId?: string | null;
  proveedorNombre: string;
  proveedorIdentificacion?: string;
  fechaEmision: number;
  fechaVencimiento: number;
  moneda: string;
  glosa: string;
  montoOriginal: number;
}

export interface RegistrarPagoInput {
  proveedorId?: string | null;
  proveedorNombre: string;
  fecha: number;
  cuentaOrigenId: string;
  metodoPago: PagoProveedor['metodoPago'];
  referencia?: string;
  glosa: string;
  aplicaciones: { documentoId: string; documentoNumero: string; monto: number }[];
}

/**
 * Subledger de Cuentas por Pagar: documentos por pagar (obligaciones) y pagos/egresos a proveedor.
 * Reconcilia contra la cuenta de control CxP del mayor. Los documentos con origen FACTURA_COMPRA
 * reutilizan el asiento del módulo Compras (no generan otro); los manuales generan su propio asiento.
 */
@Injectable({
  providedIn: 'root'
})
export class CuentasPorPagarService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly configuracionContable = inject(ConfiguracionContableService);
  private readonly proveedoresService = inject(ProveedoresService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getConfiguracionRef() {
    return ref(this.database, `${this.getTenantPath()}/configuracion/cuentasPorPagar`);
  }

  private getDocumentosPath(): string {
    return `${this.getTenantPath()}/documentosPorPagar`;
  }

  private getDocumentosRef() {
    return ref(this.database, this.getDocumentosPath());
  }

  private getDocumentoRef(id: string) {
    return ref(this.database, `${this.getDocumentosPath()}/${id}`);
  }

  private getPagosPath(): string {
    return `${this.getTenantPath()}/pagosProveedor`;
  }

  private getPagosRef() {
    return ref(this.database, this.getPagosPath());
  }

  private getPagoRef(id: string) {
    return ref(this.database, `${this.getPagosPath()}/${id}`);
  }

  private getAsientoOrigenFacturaVal(facturaId: string) {
    return get(ref(this.database, `${this.getTenantPath()}/asientosOrigen/FACTURA_COMPRA/${facturaId}`));
  }

  // ===== Configuración =====

  getConfiguracion(): Observable<ConfiguracionCuentasPorPagar> {
    return new Observable<ConfiguracionCuentasPorPagar>((subscriber) => {
      const unsubscribe = onValue(
        this.getConfiguracionRef(),
        (snapshot) => subscriber.next(snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion()),
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionCuentasPorPagar> {
    const snapshot = await get(this.getConfiguracionRef());
    return snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion();
  }

  async guardarConfiguracion(configuracion: ConfiguracionCuentasPorPagar): Promise<void> {
    await set(this.getConfiguracionRef(), {
      ...this.getDefaultConfiguracion(),
      ...configuracion,
      actualizadoEn: Date.now()
    });
  }

  // ===== Documentos por pagar =====

  getDocumentos(): Observable<DocumentoPorPagar[]> {
    return new Observable<DocumentoPorPagar[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getDocumentosRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const raw = snapshot.val() as Record<string, DocumentoPorPagar>;
          const documentos = Object.entries(raw)
            .map(([id, documento]) => ({ ...documento, id }))
            .sort((a, b) => (b.fechaEmision ?? 0) - (a.fechaEmision ?? 0));
          subscriber.next(documentos);
        },
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async getDocumentosOnce(): Promise<DocumentoPorPagar[]> {
    const snapshot = await get(this.getDocumentosRef());
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, DocumentoPorPagar>;
    return Object.entries(raw).map(([id, documento]) => ({ ...documento, id }));
  }

  async getDocumentoById(id: string): Promise<DocumentoPorPagar | null> {
    const snapshot = await get(this.getDocumentoRef(id));
    return snapshot.exists() ? { ...(snapshot.val() as DocumentoPorPagar), id } : null;
  }

  private async getDocumentoPorOrigen(origenTipo: DocumentoPorPagar['origenTipo'], origenId: string): Promise<DocumentoPorPagar | null> {
    const documentos = await this.getDocumentosOnce();
    return documentos.find((documento) => documento.origenTipo === origenTipo && documento.origenId === origenId) ?? null;
  }

  /**
   * Crea/actualiza el documento-espejo del subledger cuando una factura de compra queda REGISTRADA.
   * NO genera asiento (ya lo generó el módulo Compras): toma el asientoId del índice de origen. Es
   * idempotente y respeta las fuentes activas de la configuración del módulo.
   */
  async sincronizarDesdeFacturaCompra(factura: FacturaCompra): Promise<void> {
    const facturaId = factura.id ?? '';
    if (!facturaId) {
      return;
    }
    const config = await this.getConfiguracionOnce();
    if (!config.habilitarCuentasPorPagar || !config.fuenteFacturasCompra) {
      return;
    }
    if (await this.getDocumentoPorOrigen('FACTURA_COMPRA', facturaId)) {
      return; // ya sincronizado
    }

    const esNotaCredito = factura.tipoComprobante === '04';
    const signo = esNotaCredito ? -1 : 1;
    const porPagar = this.round2((Number(factura.importeTotal ?? 0) - Number(factura.totalRetencion ?? 0)) * signo);
    if (porPagar === 0) {
      return; // pagada de contado / totalmente retenida: no genera saldo por pagar
    }

    const proveedor = factura.proveedorId ? await this.proveedoresService.getProveedorById(factura.proveedorId) : null;
    const diasCredito = Number(proveedor?.diasCredito ?? 0);
    const fechaEmision = Number(factura.fechaEmision ?? factura.creadoEn ?? Date.now());
    const asientoSnapshot = await this.getAsientoOrigenFacturaVal(facturaId);
    const asientoId = asientoSnapshot.exists() ? String(asientoSnapshot.val()?.asientoId ?? '') || null : null;
    const documento = `${factura.establecimiento}-${factura.puntoEmision}-${factura.secuencial}`;

    const timestamp = Date.now();
    const documentoRef = push(this.getDocumentosRef());
    const nuevo: DocumentoPorPagar = {
      numero: await this.generarNumeroDocumento(),
      origenTipo: 'FACTURA_COMPRA',
      origenId: facturaId,
      origenNumero: factura.numero ?? documento,
      proveedorId: factura.proveedorId ?? null,
      proveedorNombre: factura.razonSocialProv,
      proveedorIdentificacion: factura.idProv,
      fechaEmision,
      fechaVencimiento: fechaEmision + diasCredito * DIA_MS,
      moneda: 'USD',
      glosa: `${esNotaCredito ? 'NC compra' : 'Factura compra'} ${documento}`,
      montoOriginal: porPagar,
      saldoPendiente: porPagar,
      estadoPago: 'PENDIENTE',
      asientoId,
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema',
      creadoEn: timestamp,
      actualizadoEn: timestamp
    };
    await set(documentoRef, nuevo);
  }

  /**
   * Crea una cuenta por pagar manual (préstamo, servicio sin factura, provisión…). Si la contabilidad
   * está activa persiste el asiento (DEBE contrapartida / HABER CxP) desde las líneas revisadas.
   */
  async crearDocumentoManual(input: CrearDocumentoManualInput, lineasAsiento?: AsientoContableLinea[]): Promise<string> {
    const config = await this.getConfiguracionOnce();
    if (!config.fuenteManual) {
      throw new Error('Las cuentas por pagar manuales están desactivadas en la configuración del módulo.');
    }
    const monto = this.round2(input.montoOriginal);
    if (monto <= 0) {
      throw new Error('El monto de la cuenta por pagar debe ser mayor a cero.');
    }
    await this.validarPeriodo(input.fechaEmision);

    const timestamp = Date.now();
    const documentoRef = push(this.getDocumentosRef());
    const documentoId = documentoRef.key!;
    const numero = await this.generarNumeroDocumento();

    let asientoId: string | null = null;
    if (lineasAsiento && lineasAsiento.length > 0 && await this.integracionContable.contabilidadActiva()) {
      asientoId = await this.integracionContable.guardarAsientoCxPManual(
        { id: documentoId, numero, fecha: input.fechaEmision, glosa: input.glosa },
        lineasAsiento
      );
    }

    const nuevo: DocumentoPorPagar = {
      numero,
      origenTipo: 'MANUAL',
      origenId: documentoId,
      origenNumero: numero,
      proveedorId: input.proveedorId ?? null,
      proveedorNombre: input.proveedorNombre,
      proveedorIdentificacion: input.proveedorIdentificacion ?? '',
      fechaEmision: input.fechaEmision,
      fechaVencimiento: input.fechaVencimiento,
      moneda: input.moneda || 'USD',
      glosa: input.glosa,
      montoOriginal: monto,
      saldoPendiente: monto,
      estadoPago: 'PENDIENTE',
      asientoId,
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema',
      creadoEn: timestamp,
      actualizadoEn: timestamp
    };
    await set(documentoRef, nuevo);
    return documentoId;
  }

  /** Anula un documento manual: reversa su asiento y lo marca ANULADA. Bloquea si ya tuvo abonos. */
  async anularDocumento(id: string): Promise<void> {
    const documento = await this.getDocumentoById(id);
    if (!documento) {
      throw new Error('Documento por pagar no encontrado.');
    }
    if (documento.estadoPago === 'ANULADA') {
      return;
    }
    if (documento.origenTipo !== 'MANUAL') {
      throw new Error('Solo se pueden anular cuentas por pagar manuales. Anula la factura desde el módulo Compras.');
    }
    if (this.round2(documento.saldoPendiente) !== this.round2(documento.montoOriginal)) {
      throw new Error('No se puede anular: el documento ya tiene pagos aplicados. Anula primero los pagos.');
    }
    await this.integracionContable.reversarAsientoSubledger(
      'CXP_MANUAL',
      id,
      'REVERSO_CXP_MANUAL',
      documento.numero ?? null,
      `Reverso CxP manual ${documento.numero ?? ''}`.trim()
    );
    await update(this.getDocumentoRef(id), {
      estadoPago: 'ANULADA' as EstadoDocumentoPorPagar,
      saldoPendiente: 0,
      actualizadoEn: Date.now()
    });
  }

  // ===== Pagos / egresos =====

  getPagos(): Observable<PagoProveedor[]> {
    return new Observable<PagoProveedor[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getPagosRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const raw = snapshot.val() as Record<string, PagoProveedor>;
          const pagos = Object.entries(raw)
            .map(([id, pago]) => ({ ...pago, id }))
            .sort((a, b) => (b.fecha ?? 0) - (a.fecha ?? 0));
          subscriber.next(pagos);
        },
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async getPagoById(id: string): Promise<PagoProveedor | null> {
    const snapshot = await get(this.getPagoRef(id));
    return snapshot.exists() ? { ...(snapshot.val() as PagoProveedor), id } : null;
  }

  /**
   * Registra un pago a proveedor: valida saldos y período, contabiliza (DEBE CxP / HABER banco desde
   * las líneas revisadas), descuenta el saldo pendiente de cada documento aplicado con transacción
   * (evita sobre-pago concurrente) y guarda el pago.
   */
  async registrarPago(input: RegistrarPagoInput, lineasAsiento?: AsientoContableLinea[]): Promise<string> {
    const aplicaciones = (input.aplicaciones ?? []).filter((aplicacion) => this.round2(aplicacion.monto) > 0);
    if (aplicaciones.length === 0) {
      throw new Error('Selecciona al menos un documento y un monto a pagar.');
    }
    if (!input.cuentaOrigenId) {
      throw new Error('Selecciona la cuenta de origen (caja/banco).');
    }
    const montoTotal = this.round2(aplicaciones.reduce((suma, aplicacion) => suma + Number(aplicacion.monto), 0));
    if (montoTotal <= 0) {
      throw new Error('El monto del pago debe ser mayor a cero.');
    }
    await this.validarPeriodo(input.fecha);

    // Validación previa de saldos (la transacción vuelve a validar por concurrencia).
    for (const aplicacion of aplicaciones) {
      const documento = await this.getDocumentoById(aplicacion.documentoId);
      if (!documento || documento.estadoPago === 'ANULADA') {
        throw new Error('Uno de los documentos ya no está disponible para pago.');
      }
      if (this.round2(aplicacion.monto) > this.round2(documento.saldoPendiente)) {
        throw new Error(`El abono a ${documento.numero ?? 'documento'} excede su saldo pendiente.`);
      }
    }

    const timestamp = Date.now();
    const pagoRef = push(this.getPagosRef());
    const pagoId = pagoRef.key!;
    const numero = await this.generarNumeroPago();

    let asientoId: string | null = null;
    if (lineasAsiento && lineasAsiento.length > 0 && await this.integracionContable.contabilidadActiva()) {
      asientoId = await this.integracionContable.guardarAsientoPagoProveedor(
        { id: pagoId, numero, fecha: input.fecha, glosa: input.glosa },
        lineasAsiento
      );
    }

    // Descontar saldos de forma atómica por documento.
    for (const aplicacion of aplicaciones) {
      await this.aplicarAbono(aplicacion.documentoId, this.round2(aplicacion.monto));
    }

    const nuevo: PagoProveedor = {
      numero,
      proveedorId: input.proveedorId ?? null,
      proveedorNombre: input.proveedorNombre,
      fecha: input.fecha,
      cuentaOrigenId: input.cuentaOrigenId,
      metodoPago: input.metodoPago,
      referencia: input.referencia ?? '',
      glosa: input.glosa,
      montoTotal,
      aplicaciones: aplicaciones.map((aplicacion) => ({
        documentoId: aplicacion.documentoId,
        documentoNumero: aplicacion.documentoNumero,
        monto: this.round2(aplicacion.monto)
      })),
      asientoId,
      estado: 'REGISTRADO',
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema',
      creadoEn: timestamp,
      actualizadoEn: timestamp
    };
    await set(pagoRef, nuevo);
    return pagoId;
  }

  /** Anula un pago: reversa su asiento y restaura el saldo pendiente de los documentos aplicados. */
  async anularPago(id: string): Promise<void> {
    const pago = await this.getPagoById(id);
    if (!pago) {
      throw new Error('Pago no encontrado.');
    }
    if (pago.estado === 'ANULADO') {
      return;
    }
    await this.integracionContable.reversarAsientoSubledger(
      'PAGO_PROVEEDOR',
      id,
      'REVERSO_PAGO_PROVEEDOR',
      pago.numero ?? null,
      `Reverso pago a proveedor ${pago.numero ?? ''}`.trim()
    );
    for (const aplicacion of pago.aplicaciones ?? []) {
      await this.restaurarAbono(aplicacion.documentoId, this.round2(aplicacion.monto));
    }
    await update(this.getPagoRef(id), {
      estado: 'ANULADO',
      actualizadoEn: Date.now()
    });
  }

  private async aplicarAbono(documentoId: string, monto: number): Promise<void> {
    const result = await runTransaction(this.getDocumentoRef(documentoId), (current: DocumentoPorPagar | null) => {
      if (!current) {
        return current;
      }
      const saldo = this.round2((current.saldoPendiente ?? 0) - monto);
      if (saldo < -0.005) {
        return; // aborta: sobre-pago
      }
      const saldoFinal = Math.max(0, saldo);
      return {
        ...current,
        saldoPendiente: saldoFinal,
        estadoPago: (saldoFinal <= 0 ? 'PAGADA' : 'PARCIAL') as EstadoDocumentoPorPagar,
        actualizadoEn: Date.now()
      };
    });
    if (!result.committed) {
      throw new Error('No se pudo aplicar el abono (saldo insuficiente o documento modificado).');
    }
  }

  private async restaurarAbono(documentoId: string, monto: number): Promise<void> {
    await runTransaction(this.getDocumentoRef(documentoId), (current: DocumentoPorPagar | null) => {
      if (!current) {
        return current;
      }
      const saldo = this.round2(Math.min(current.montoOriginal ?? 0, (current.saldoPendiente ?? 0) + monto));
      return {
        ...current,
        saldoPendiente: saldo,
        estadoPago: (saldo >= this.round2(current.montoOriginal ?? 0) ? 'PENDIENTE' : 'PARCIAL') as EstadoDocumentoPorPagar,
        actualizadoEn: Date.now()
      };
    });
  }

  // ===== Consultas / reportes =====

  async getSaldoProveedor(proveedorId: string | null): Promise<number> {
    const documentos = await this.getDocumentosOnce();
    return this.round2(documentos
      .filter((documento) => (documento.proveedorId ?? null) === proveedorId && documento.estadoPago !== 'ANULADA')
      .reduce((suma, documento) => suma + Number(documento.saldoPendiente ?? 0), 0));
  }

  /** Antigüedad de saldos (aging) por proveedor a una fecha de corte. */
  async getAging(fechaCorte: number = Date.now()): Promise<AgingProveedor[]> {
    const documentos = await this.getDocumentosOnce();
    const porProveedor = new Map<string, AgingProveedor>();

    for (const documento of documentos) {
      const saldo = this.round2(documento.saldoPendiente ?? 0);
      if (documento.estadoPago === 'ANULADA' || saldo <= 0) {
        continue;
      }
      const clave = documento.proveedorId ?? `sin:${documento.proveedorNombre}`;
      const fila = porProveedor.get(clave) ?? {
        proveedorId: documento.proveedorId ?? null,
        proveedorNombre: documento.proveedorNombre,
        porVencer: 0,
        tramo1_30: 0,
        tramo31_60: 0,
        tramo61_90: 0,
        tramoMas90: 0,
        total: 0
      };
      const diasVencidos = Math.floor((fechaCorte - documento.fechaVencimiento) / DIA_MS);
      if (diasVencidos <= 0) {
        fila.porVencer = this.round2(fila.porVencer + saldo);
      } else if (diasVencidos <= 30) {
        fila.tramo1_30 = this.round2(fila.tramo1_30 + saldo);
      } else if (diasVencidos <= 60) {
        fila.tramo31_60 = this.round2(fila.tramo31_60 + saldo);
      } else if (diasVencidos <= 90) {
        fila.tramo61_90 = this.round2(fila.tramo61_90 + saldo);
      } else {
        fila.tramoMas90 = this.round2(fila.tramoMas90 + saldo);
      }
      fila.total = this.round2(fila.total + saldo);
      porProveedor.set(clave, fila);
    }

    return Array.from(porProveedor.values()).sort((a, b) => b.total - a.total);
  }

  // ===== Helpers privados =====

  private async validarPeriodo(fechaTimestamp: number): Promise<void> {
    if (!(await this.integracionContable.contabilidadActiva())) {
      return; // sin contabilidad activa no hay período que validar
    }
    await this.configuracionContable.validarPeriodoParaMovimiento(this.fechaIso(fechaTimestamp));
  }

  private async generarNumeroDocumento(): Promise<string> {
    return this.generarNumeroConsecutivo('documentosPorPagar', 'CXP');
  }

  private async generarNumeroPago(): Promise<string> {
    return this.generarNumeroConsecutivo('pagosProveedor', 'PP');
  }

  private async generarNumeroConsecutivo(secuencia: string, prefijo: string): Promise<string> {
    const secuenciaRef = ref(this.database, `${this.getTenantPath()}/secuencias/${secuencia}`);
    const tx = await runTransaction(secuenciaRef, (current: unknown) => {
      const actual = typeof current === 'number' && Number.isFinite(current) ? current : 0;
      return actual + 1;
    });
    const next = typeof tx.snapshot?.val() === 'number' ? Number(tx.snapshot.val()) : 1;
    return `${prefijo}-${String(Math.max(1, next)).padStart(4, '0')}`;
  }

  private fechaIso(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionCuentasPorPagar {
    const raw = value as Partial<ConfiguracionCuentasPorPagar> | null;
    return { ...this.getDefaultConfiguracion(), ...raw };
  }

  private getDefaultConfiguracion(): ConfiguracionCuentasPorPagar {
    return {
      habilitarCuentasPorPagar: false,
      cuentaPorPagarDefaultId: '',
      cuentaCajaBancoEgresoDefaultId: '',
      fuenteFacturasCompra: true,
      fuenteManual: true,
      fuenteRetenciones: false,
      fuenteNomina: false
    };
  }

  private round2(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}

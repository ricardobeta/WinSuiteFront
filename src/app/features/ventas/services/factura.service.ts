import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ClientesService } from '../../../core/services/clientes.service';
import { FacturacionConfigService } from '../../../core/services/facturacion-config.service';
import { AlmacenesService } from '../../inventario/services/almacenes.service';
import { VentasService } from './ventas.service';
import { VentaDetalle, VentaItem, VentaPago } from '../models/ventas.models';
import {
  Factura,
  FacturaAmbiente,
  FacturaDetalle,
  FacturaEmisionResultado,
  FacturaEstadoPaso,
  FacturaFormaPago,
  FacturaPago,
  FacturaTipoIdentificacionComprador,
  FacturaTipoEmision,
  SriResponse
} from '../../../shared/models/factura.models';

interface EmitirFacturaOptions {
  onStep?: (step: FacturaEstadoPaso) => void;
  intervaloMs?: number;
  intentosMaximos?: number;
  soloGenerar?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FacturaService {
  private readonly http = inject(HttpClient);
  private readonly clientesService = inject(ClientesService);
  private readonly facturacionConfig = inject(FacturacionConfigService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly ventasService = inject(VentasService);

  async buildInvoiceForVenta(ventaId: string): Promise<Factura> {
    const detalle = await this.getDetalleVentaOrThrow(ventaId);
    const config = await this.facturacionConfig.getConfiguracionOnce();

    const almacen = await firstValueFrom(this.almacenesService.getAlmacenesActivos()).then((almacenes) => {
      return almacenes.find((item) => item.id === detalle.documento.almacenId) ?? null;
    });

    // Obtener tanto el establecimiento como el punto de emisión de la nueva configuración
    const confPuntoYEstab = await firstValueFrom(
      this.facturacionConfig.getPuntoYEstablecimientoParaAlmacen(detalle.documento.almacenId)
    );

    const firma = await firstValueFrom(this.facturacionConfig.getFirmaParaAlmacen(detalle.documento.almacenId));

    if (!firma) {
      throw new Error('No hay firma electrónica asociada al punto de emisión del almacén.');
    }

    if (!confPuntoYEstab) {
      throw new Error('No hay establecimiento y punto de emisión disponibles para el almacén de la venta.');
    }

    const empresaRuc = firma.ruc?.trim() || this.extractRucFromTenantFallback();
    const razonSocial = firma.razonSocial?.trim() || 'SIN RAZON SOCIAL';
    const fechaEmision = this.formatDateYYYYMMDD(detalle.documento.creadoEn);
    const cliente = await this.resolveCliente(detalle.documento.clienteId, detalle.documento.clienteNombre);
    const detalles = detalle.items.map((item) => this.mapDetalle(item));
    const pagos = this.mapPagos(detalle.pagos);
    const totalSinImpuestos = this.round(detalle.documento.subtotal - detalle.documento.descuento);

    return {
      ambiente: this.mapAmbiente(config.ambienteActivo),
      tipoEmision: 'NORMAL',
      ruc: empresaRuc,
      razonSocial,
      nombreComercial: firma.nombreComercial ?? firma.nombreArchivo ?? razonSocial,
      dirMatriz: almacen?.direccion?.trim() || 'SIN DIRECCION',
      // Usar establecimiento y punto de emisión de la configuración
      establecimiento: this.pad3(confPuntoYEstab.establecimiento.codigo),
      puntoEmision: this.pad3(confPuntoYEstab.puntoEmision.codigo),
      secuencial: null,  // Backend lo reserva de forma atómica
      claveAcceso: null, // Backend lo genera
      fechaEmision,
      dirEstablecimiento: almacen?.direccion?.trim() || 'SIN DIRECCION',
      contribuyenteEspecial: null,
      obligadoContabilidad: null,
      tipoIdentificacionComprador: cliente.tipoIdentificacion,
      identificacionComprador: cliente.identificacion,
      razonSocialComprador: cliente.nombreCompleto,
      direccionComprador: cliente.direccion || 'SIN DIRECCION',
      totalSinImpuestos,
      totalDescuentos: this.round(detalle.documento.descuento),
      totalConImpuestos: this.round(totalSinImpuestos + detalle.documento.impuesto),
      propina: 0,
      importeTotal: this.round(detalle.documento.total),
      moneda: detalle.documento.moneda || 'USD',
      detalles,
      pagos,
      digitalSignature: null
    };
  }

  async emitirYAutorizarFactura(
    ventaId: string,
    options: EmitirFacturaOptions = {}
  ): Promise<FacturaEmisionResultado> {
    const intervaloMs = options.intervaloMs ?? 3000;
    const intentosMaximos = options.intentosMaximos ?? 40;
    const soloGenerar = options.soloGenerar ?? environment.facturacion?.soloGenerarEnPruebas ?? false;

    options.onStep?.('armando');
    const detalle = await this.getDetalleVentaOrThrow(ventaId);
    const firma = await firstValueFrom(this.facturacionConfig.getFirmaParaAlmacen(detalle.documento.almacenId));
    const firmaId = firma?.id;
    if (!firmaId) {
      throw new Error('No se pudo resolver la firma para enviar la factura.');
    }

    const solicitud = await this.buildInvoiceForVenta(ventaId);

    options.onStep?.('generando');
    const facturaGenerada = await firstValueFrom(
      this.http.post<Factura>(`${environment.apiBaseUrl}/api/invoices`, solicitud)
    );

    const claveAcceso = facturaGenerada.claveAcceso ?? solicitud.claveAcceso;
    if (!claveAcceso) {
      throw new Error('El backend no retornó clave de acceso para la factura.');
    }

    if (soloGenerar) {
      options.onStep?.('autorizada');
      return {
        facturaGenerada,
        respuestaFirma: {
          estado: 'OMITIDO_MODO_PRUEBA',
          mensajes: 'Firmado y envío omitidos por bandera soloGenerarEnPruebas.'
        },
        respuestaAutorizacion: {
          estado: 'GENERADA_MODO_PRUEBA',
          mensajes: 'Autorización SRI omitida por bandera soloGenerarEnPruebas.'
        },
        claveAcceso
      };
    }
    
    options.onStep?.('firmando');
    const respuestaFirma = await firstValueFrom(
      this.http.post<SriResponse>(`${environment.apiBaseUrl}/api/invoices/sign-send`, facturaGenerada, {
        headers: { 'X-Firma-Id': firmaId }
      })
    );

    options.onStep?.('autorizando');
    const respuestaAutorizacion = await this.esperarAutorizacion(claveAcceso, intervaloMs, intentosMaximos);

    options.onStep?.('autorizada');

    return {
      facturaGenerada,
      respuestaFirma,
      respuestaAutorizacion,
      claveAcceso
    };
  }

  async consultarEstado(accessKey: string): Promise<SriResponse> {
    return firstValueFrom(
      this.http.get<SriResponse>(`${environment.apiBaseUrl}/api/invoices/status/${encodeURIComponent(accessKey)}`)
    );
  }

  private async esperarAutorizacion(accessKey: string, intervaloMs: number, intentosMaximos: number): Promise<SriResponse> {
    for (let intento = 0; intento < intentosMaximos; intento++) {
      const estado = await this.consultarEstado(accessKey);
      const normalizado = (estado.estado ?? '').trim().toUpperCase();

      if (normalizado === 'AUTORIZADO' || normalizado === 'AUTORIZADA') {
        return estado;
      }

      if (normalizado === 'RECHAZADO' || normalizado === 'ERROR' || normalizado === 'DEVUELTA') {
        return estado;
      }

      await this.delay(intervaloMs);
    }

    throw new Error('Se agotó el tiempo de espera para la autorización SRI.');
  }

  private async getDetalleVentaOrThrow(ventaId: string): Promise<VentaDetalle> {
    const detalle = await this.ventasService.getVentaDetalle(ventaId);
    if (!detalle) {
      throw new Error('Venta no encontrada.');
    }

    return detalle;
  }

  private async resolveCliente(clienteId: string | null, clienteNombre: string): Promise<{ identificacion: string; nombreCompleto: string; direccion: string; tipoIdentificacion: FacturaTipoIdentificacionComprador }> {
    if (!clienteId) {
      return {
        identificacion: '9999999999999',
        nombreCompleto: 'CONSUMIDOR FINAL',
        direccion: 'SIN DIRECCION',
        tipoIdentificacion: 'CONSUMIDOR_FINAL'
      };
    }

    const cliente = await firstValueFrom(this.clientesService.getClienteById(clienteId));
    if (!cliente) {
      return {
        identificacion: '9999999999999',
        nombreCompleto: clienteNombre || 'CONSUMIDOR FINAL',
        direccion: 'SIN DIRECCION',
        tipoIdentificacion: 'CONSUMIDOR_FINAL'
      };
    }

    return {
      identificacion: cliente.identificacion,
      nombreCompleto: cliente.nombreCompleto,
      direccion: cliente.direccion || 'SIN DIRECCION',
      tipoIdentificacion: this.mapTipoIdentificacion(cliente.tipoDeIdentificacion)
    };
  }

  private mapTipoIdentificacion(tipo: string): FacturaTipoIdentificacionComprador {
    switch ((tipo ?? '').toLowerCase()) {
      case 'ruc':
        return 'RUC';
      case 'cedula':
        return 'CEDULA';
      case 'pasaporte':
        return 'PASAPORTE';
      default:
        return 'CONSUMIDOR_FINAL';
    }
  }

  private mapAmbiente(value: string | null): FacturaAmbiente {
    return value === '2' || value === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBA';
  }

  private mapDetalle(item: VentaItem): FacturaDetalle {
    const subtotalSinDescuento = this.round(item.precioUnitario * item.cantidad);
    const descuento = this.round(subtotalSinDescuento - item.subtotalItem);
    const baseImponible = this.round(Math.max(0, item.subtotalItem));

    return {
      codigoPrincipal: item.sku || item.productoId,
      codigoAuxiliar: item.productoId,
      descripcion: item.nombre,
      cantidad: this.round(item.cantidad),
      precioUnitario: this.round(item.precioUnitario),
      descuento,
      precioTotalSinImpuesto: baseImponible,
      detallesAdicionales: {},
      impuestos: [
        {
          codigo: 'IVA',
          codigoPorcentaje: this.mapCodigoIva(item.ivaPorcentajeItem),
          tarifa: this.round(item.ivaPorcentajeItem),
          baseImponible,
          valor: this.round(item.impuestoItem)
        }
      ]
    };
  }

  private mapCodigoIva(ivaPorcentaje: number): FacturaDetalle['impuestos'][number]['codigoPorcentaje'] {
    switch (Math.round(ivaPorcentaje)) {
      case 0:
        return 'IVA_0';
      case 5:
        return 'IVA_5';
      case 12:
        return 'IVA_12';
      case 13:
        return 'IVA_13';
      case 14:
        return 'IVA_14';
      case 15:
        return 'IVA_15';
      default:
        return 'IVA_0';
    }
  }

  private mapPagos(pagos: VentaPago[]): FacturaPago[] {
    if (!pagos.length) {
      return [
        {
          formaPago: 'EFECTIVO',
          total: 0
        }
      ];
    }

    return pagos.map((pago) => ({
      formaPago: this.mapFormaPago(pago.metodo),
      total: this.round(pago.monto),
      plazo: null,
      unidadTiempo: null
    }));
  }

  private mapFormaPago(metodo: string): FacturaFormaPago {
    const normalized = (metodo ?? '').trim().toUpperCase();

    if (normalized === 'EFECTIVO' || normalized === '01') {
      return 'EFECTIVO';
    }

    if (normalized === 'TARJETA_CREDITO' || normalized === 'TARJETA_DEBITO' || normalized === '03') {
      return 'TARJETA_CREDITO';
    }

    if (normalized === 'TRANSFERENCIA' || normalized === '04' || normalized === 'QR') {
      return 'TRANSFERENCIA';
    }

    if (normalized === 'CHEQUE' || normalized === '02') {
      return 'CHEQUE';
    }

    if (normalized === 'DEPOSITO' || normalized === '05') {
      return 'DEPOSITO';
    }

    if (normalized === 'COMPENSACION' || normalized === 'CREDITO_CLIENTE') {
      return 'COMPENSACION';
    }

    if (normalized === 'ENDOSO_TITULOS' || normalized === '20') {
      return 'ENDOSO_TITULOS';
    }

    if (normalized === 'ENDOSO_TITULOS_VALOR' || normalized === '21') {
      return 'ENDOSO_TITULOS_VALOR';
    }

    return 'EFECTIVO';
  }

  private pad3(value: string): string {
    const digits = (value ?? '').replace(/\D/g, '');
    return digits.padStart(3, '0').slice(-3);
  }

  private formatDateYYYYMMDD(epochMillis: number | undefined): string {
    const source = epochMillis ? new Date(epochMillis) : new Date();
    const year = source.getFullYear();
    const month = `${source.getMonth() + 1}`.padStart(2, '0');
    const day = `${source.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private round(value: number): number {
    return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractRucFromTenantFallback(): string {
    return '0000000000001';
  }
}

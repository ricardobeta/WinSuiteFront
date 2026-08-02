import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Storage, getDownloadURL, ref as storageRef, uploadBytes } from '@angular/fire/storage';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ConfirmacionPago,
  CrearOrden,
  MetodosPago,
  OrdenCompra,
} from '../models/platform.models';
import { AuthService } from './auth.service';

/** Tope del comprobante. Es una foto o un PDF de un deposito, no hace falta mas. */
const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;

/**
 * Compra de planes y complementos. Ningun importe se calcula aqui: la orden se pide al backend
 * y es el quien fija el total contra el catalogo.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(Storage);
  private readonly authService = inject(AuthService);

  private readonly base = `${environment.apiBaseUrl}/api/tenants/current/orders`;

  metodosPago(): Promise<MetodosPago> {
    return firstValueFrom(this.http.get<MetodosPago>(`${this.base}/metodos-pago`));
  }

  misOrdenes(): Promise<OrdenCompra[]> {
    return firstValueFrom(this.http.get<OrdenCompra[]>(this.base));
  }

  obtener(orderId: string): Promise<OrdenCompra> {
    return firstValueFrom(this.http.get<OrdenCompra>(`${this.base}/${orderId}`));
  }

  crear(orden: CrearOrden): Promise<OrdenCompra> {
    return firstValueFrom(this.http.post<OrdenCompra>(this.base, orden));
  }

  anular(orderId: string): Promise<OrdenCompra> {
    return firstValueFrom(this.http.post<OrdenCompra>(`${this.base}/${orderId}/anular`, {}));
  }

  confirmarPayphone(id: number, clientTransactionId: string): Promise<ConfirmacionPago> {
    return firstValueFrom(
      this.http.post<ConfirmacionPago>(`${this.base}/payphone/confirmar`, { id, clientTransactionId }),
    );
  }

  /**
   * Sube el comprobante y lo registra en la orden. Va a su propia carpeta de Storage: es un
   * documento de la relacion con WinSuit y no consume la cuota de archivos de la empresa.
   */
  async subirComprobante(orderId: string, archivo: File, referencia: string): Promise<OrdenCompra> {
    if (archivo.size > MAX_COMPROBANTE_BYTES) {
      throw new Error('El comprobante no puede pesar mas de 5 MB.');
    }
    const tenantId = this.authService.getTenantId();
    const nombre = archivo.name.replace(/[^\w.\-]+/g, '_');
    const destino = storageRef(this.storage, `comprobantes/${tenantId}/${orderId}/${nombre}`);
    await uploadBytes(destino, archivo, { contentType: archivo.type || 'application/octet-stream' });
    const url = await getDownloadURL(destino);

    return firstValueFrom(
      this.http.post<OrdenCompra>(`${this.base}/${orderId}/comprobante`, {
        url,
        nombre: archivo.name,
        referencia,
      }),
    );
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref, update } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { EstadoPedidoWeb, PedidoWeb } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';

/** Bandeja de pedidos del ecommerce (los escribe el renderer via Admin SDK). */
@Injectable({ providedIn: 'root' })
export class PedidosWebService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `pedidos_web/${this.authService.getTenantId()}`;
  }

  getPedidos(): Observable<PedidoWeb[]> {
    return new Observable<PedidoWeb[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getTenantPath()),
        (snapshot) => {
          const valor = (snapshot.val() ?? {}) as Record<string, PedidoWeb>;
          const pedidos = Object.entries(valor)
            .map(([id, pedido]) => ({ ...pedido, id }))
            .sort((a, b) => b.creadoEn - a.creadoEn);
          subscriber.next(pedidos);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async cambiarEstado(pedidoId: string, estado: EstadoPedidoWeb): Promise<void> {
    await update(ref(this.database, `${this.getTenantPath()}/${pedidoId}`), { estado });
  }
}

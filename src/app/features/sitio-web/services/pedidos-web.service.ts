import { Injectable, inject } from '@angular/core';
import { Database, endAt, equalTo, get, limitToLast, orderByChild, query, ref, update } from '@angular/fire/database';
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

  async getPedidosPage(
    sitioId: string,
    limit = 25,
    cursor: string | null = null,
  ): Promise<{ items: PedidoWeb[]; nextCursor: string | null; hasMore: boolean }> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const constraints = [orderByChild('sitioId'), equalTo(sitioId)];
    if (cursor) constraints.push(endAt(sitioId, cursor));
    constraints.push(limitToLast(boundedLimit + (cursor ? 2 : 1)));
    const snapshot = await get(query(ref(this.database, this.getTenantPath()), ...constraints));
    const items: PedidoWeb[] = [];
    snapshot.forEach((child) => {
      if (child.key !== cursor) {
        items.push({ ...(child.val() as PedidoWeb), id: child.key ?? undefined });
      }
      return false;
    });
    const hasMore = items.length > boundedLimit;
    if (hasMore) items.shift();
    items.reverse();
    return {
      items,
      nextCursor: hasMore && items.length ? items.at(-1)?.id ?? null : null,
      hasMore,
    };
  }

  async cambiarEstado(pedidoId: string, estado: EstadoPedidoWeb): Promise<void> {
    await update(ref(this.database, `${this.getTenantPath()}/${pedidoId}`), { estado });
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { Producto } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  protected getCollectionPath(): string {
    return `${this.getTenantPath()}/productos`;
  }

  protected getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  protected getItemPath(productoId: string): string {
    return `${this.getCollectionPath()}/${productoId}`;
  }

  protected getItemRef(productoId: string) {
    return ref(this.database, this.getItemPath(productoId));
  }

  getProductos(): Observable<Producto[]> {
    return new Observable<Producto[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Producto>;
          const productos = Object.entries(raw)
            .map(([id, producto]) => ({
              ...producto,
              id
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          subscriber.next(productos);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getProductoById(productoId: string): Promise<Producto | null> {
    const snapshot = await get(this.getItemRef(productoId));
    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...(snapshot.val() as Producto),
      id: productoId
    };
  }

  async crearProducto(producto: Omit<Producto, 'id'>): Promise<string> {
    const productoRef = push(this.getCollectionRef());
    const timestamp = Date.now();

    await set(productoRef, {
      ...producto,
      creadoEn: timestamp,
      actualizadoEn: timestamp
    });

    return productoRef.key!;
  }

  async actualizarProducto(productoId: string, producto: Partial<Producto>): Promise<void> {
    await update(this.getItemRef(productoId), {
      ...producto,
      actualizadoEn: Date.now()
    });
  }
}

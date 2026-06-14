import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { Proveedor } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  protected getCollectionPath(): string {
    return `${this.getTenantPath()}/proveedores`;
  }

  protected getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  protected getItemPath(proveedorId: string): string {
    return `${this.getCollectionPath()}/${proveedorId}`;
  }

  protected getItemRef(proveedorId: string) {
    return ref(this.database, this.getItemPath(proveedorId));
  }

  getProveedores(): Observable<Proveedor[]> {
    return new Observable<Proveedor[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Proveedor>;
          const proveedores = Object.entries(raw)
            .map(([id, proveedor]) => ({
              ...proveedor,
              id
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          subscriber.next(proveedores);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getProveedorById(proveedorId: string): Promise<Proveedor | null> {
    const snapshot = await get(this.getItemRef(proveedorId));
    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...(snapshot.val() as Proveedor),
      id: proveedorId
    };
  }

  async crearProveedor(proveedor: Omit<Proveedor, 'id'>): Promise<string> {
    const proveedorRef = push(this.getCollectionRef());
    const timestamp = Date.now();

    await set(proveedorRef, {
      ...proveedor,
      creadoEn: timestamp,
      actualizadoEn: timestamp
    });

    return proveedorRef.key!;
  }

  async actualizarProveedor(proveedorId: string, proveedor: Partial<Proveedor>): Promise<void> {
    await update(this.getItemRef(proveedorId), {
      ...proveedor,
      actualizadoEn: Date.now()
    });
  }
}

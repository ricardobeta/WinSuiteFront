import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { Proveedor } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

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
      ...this.audit.createMetadata('crear', null, timestamp)
    });

    const proveedorId = proveedorRef.key!;
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'inventario', entityType: 'proveedor', entityId: proveedorId, label: proveedor.nombre },
      summary: `Creo el proveedor ${proveedor.nombre}`,
      changesAfter: { nombre: proveedor.nombre, ruc: proveedor.ruc }
    });

    return proveedorId;
  }

  async actualizarProveedor(proveedorId: string, proveedor: Partial<Proveedor>): Promise<void> {
    const actual = await this.getProveedorById(proveedorId);
    await update(this.getItemRef(proveedorId), {
      ...proveedor,
      ...this.audit.createMetadata('actualizar', actual)
    });

    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'inventario', entityType: 'proveedor', entityId: proveedorId, label: proveedor.nombre ?? actual?.nombre ?? proveedorId },
      summary: `Actualizo el proveedor ${proveedor.nombre ?? actual?.nombre ?? proveedorId}`,
      changesBefore: actual ? { nombre: actual.nombre, ruc: actual.ruc } : null,
      changesAfter: { nombre: proveedor.nombre, ruc: proveedor.ruc }
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { Almacen, AlmacenStockRow, Producto } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class AlmacenesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  protected getCollectionPath(): string {
    return `${this.getTenantPath()}/almacenes`;
  }

  protected getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  protected getItemPath(almacenId: string): string {
    return `${this.getCollectionPath()}/${almacenId}`;
  }

  protected getItemRef(almacenId: string) {
    return ref(this.database, this.getItemPath(almacenId));
  }

  getAlmacenes(): Observable<Almacen[]> {
    return new Observable<Almacen[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Almacen>;
          const almacenes = Object.entries(raw)
            .map(([id, almacen]) => ({
              ...almacen,
              id
            }))
            .sort((a, b) => Number(b.esPorDefecto) - Number(a.esPorDefecto) || a.nombre.localeCompare(b.nombre));

          subscriber.next(almacenes);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getAlmacenesActivos(): Observable<Almacen[]> {
    return new Observable<Almacen[]>((subscriber) => {
      const subscription = this.getAlmacenes().subscribe({
        next: (almacenes) => subscriber.next(almacenes.filter((almacen) => almacen.activo !== false)),
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete()
      });

      return () => subscription.unsubscribe();
    });
  }

  async guardarAlmacen(almacen: Omit<Almacen, 'id'> & { id?: string }): Promise<string> {
    const timestamp = Date.now();

    if (almacen.id) {
      const actual = await this.getAlmacenById(almacen.id);
      await set(this.getItemRef(almacen.id), {
        codigo: almacen.codigo,
        nombre: almacen.nombre,
        tipo: almacen.tipo,
        direccion: almacen.direccion ?? '',
        responsableId: almacen.responsableId ?? '',
        esPorDefecto: !!almacen.esPorDefecto,
        activo: almacen.activo,
        ...this.audit.createMetadata('actualizar', actual ?? almacen, timestamp)
      });
      await this.audit.recordSafe({
        action: 'actualizar',
        target: { module: 'inventario', entityType: 'almacen', entityId: almacen.id, label: almacen.nombre },
        summary: `Actualizo el almacen ${almacen.nombre}`,
        changesBefore: actual ? { codigo: actual.codigo, nombre: actual.nombre } : null,
        changesAfter: { codigo: almacen.codigo, nombre: almacen.nombre }
      });
      return almacen.id;
    }

    const refAlmacen = push(this.getCollectionRef());
    await set(refAlmacen, {
      codigo: almacen.codigo,
      nombre: almacen.nombre,
      tipo: almacen.tipo,
      direccion: almacen.direccion ?? '',
      responsableId: almacen.responsableId ?? '',
      esPorDefecto: !!almacen.esPorDefecto,
      activo: almacen.activo,
      ...this.audit.createMetadata('crear', null, timestamp)
    });

    const almacenId = refAlmacen.key!;
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'inventario', entityType: 'almacen', entityId: almacenId, label: almacen.nombre },
      summary: `Creo el almacen ${almacen.nombre}`,
      changesAfter: { codigo: almacen.codigo, nombre: almacen.nombre }
    });

    return almacenId;
  }

  async eliminarAlmacen(almacenId: string): Promise<void> {
    const actual = await this.getAlmacenById(almacenId);
    await remove(this.getItemRef(almacenId));
    await this.audit.recordSafe({
      action: 'eliminar',
      target: { module: 'inventario', entityType: 'almacen', entityId: almacenId, label: actual?.nombre ?? almacenId },
      summary: `Elimino el almacen ${actual?.nombre ?? almacenId}`,
      changesBefore: actual ? { codigo: actual.codigo, nombre: actual.nombre } : null
    });
  }

  async marcarComoDefault(nuevoId: string): Promise<void> {
    const almacenes = await this.getAlmacenesOnce();
    const updates: Record<string, unknown> = {};

    almacenes.forEach((almacen) => {
      if (!almacen.id) {
        return;
      }

      updates[`${this.getCollectionPath()}/${almacen.id}/esPorDefecto`] = almacen.id === nuevoId;
      updates[`${this.getCollectionPath()}/${almacen.id}/actualizadoEn`] = Date.now();
    });

    await update(ref(this.database), updates);
    await this.audit.recordSafe({
      action: 'configurar',
      target: { module: 'inventario', entityType: 'almacen', entityId: nuevoId, label: 'Almacen por defecto' },
      summary: 'Configuro el almacen por defecto'
    });
  }

  getStockDetallePorAlmacen(almacenId: string): Observable<AlmacenStockRow[]> {
    return new Observable<AlmacenStockRow[]>((subscriber) => {
      const productosRef = ref(this.database, `${this.getTenantPath()}/productos`);
      const stockRef = ref(this.database, `${this.getTenantPath()}/stock`);

      let productos: Record<string, Producto> = {};
      let stock: Record<string, Record<string, { cantidad?: number; cantidadReservada?: number }>> = {};

      const emit = () => {
        const rows: AlmacenStockRow[] = Object.entries(productos).map(([productoId, producto]) => {
          const stockAlmacen = stock[productoId]?.[almacenId];
          const cantidad = Number(stockAlmacen?.cantidad ?? 0);
          const reservado = Number(stockAlmacen?.cantidadReservada ?? 0);
          const disponible = cantidad - reservado;
          const stockMinimo = Number(producto.stockMinimo ?? 0);

          return {
            productoId,
            sku: producto.sku,
            nombre: producto.nombre,
            cantidad,
            reservado,
            disponible,
            stockMinimo,
            bajoMinimo: disponible < stockMinimo,
            valorTotal: cantidad * Number(producto.precioCosto ?? 0)
          };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        subscriber.next(rows);
      };

      const unsubProductos = onValue(
        productosRef,
        (snapshot) => {
          productos = (snapshot.val() as Record<string, Producto>) ?? {};
          emit();
        },
        (error) => subscriber.error(error)
      );

      const unsubStock = onValue(
        stockRef,
        (snapshot) => {
          stock = (snapshot.val() as Record<string, Record<string, { cantidad?: number; cantidadReservada?: number }>>) ?? {};
          emit();
        },
        (error) => subscriber.error(error)
      );

      return () => {
        unsubProductos();
        unsubStock();
      };
    });
  }

  private async getAlmacenesOnce(): Promise<Almacen[]> {
    const snapshot = await get(this.getCollectionRef());
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, Almacen>;
    return Object.entries(raw).map(([id, almacen]) => ({ ...almacen, id }));
  }

  private async getAlmacenById(almacenId: string): Promise<Almacen | null> {
    const snapshot = await get(this.getItemRef(almacenId));
    if (!snapshot.exists()) {
      return null;
    }

    return { ...(snapshot.val() as Almacen), id: almacenId };
  }
}

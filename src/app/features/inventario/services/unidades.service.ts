import { Injectable, inject } from '@angular/core';
import { Database, onValue, push, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { Unidad } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  private getCollectionPath(): string {
    return `${this.getTenantPath()}/unidades`;
  }

  private getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  private getItemRef(unidadId: string) {
    return ref(this.database, `${this.getCollectionPath()}/${unidadId}`);
  }

  getUnidades(): Observable<Unidad[]> {
    return new Observable<Unidad[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Unidad>;
          const unidades = Object.entries(raw)
            .map(([id, unidad]) => ({
              ...unidad,
              id
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          subscriber.next(unidades);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarUnidad(unidad: Unidad): Promise<void> {
    if (unidad.id) {
      const { id, ...payload } = unidad;
      await set(this.getItemRef(id), payload);
      return;
    }

    const unidadRef = push(this.getCollectionRef());
    await set(unidadRef, {
      nombre: unidad.nombre,
      abreviatura: unidad.abreviatura,
      tipo: unidad.tipo,
      activo: unidad.activo ?? true
    });
  }

  async eliminarUnidad(unidadId: string): Promise<void> {
    await remove(this.getItemRef(unidadId));
  }
}

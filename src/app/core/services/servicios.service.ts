import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { Servicio } from '../../shared/models/servicios.models';

@Injectable({
  providedIn: 'root'
})
export class ServiciosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `servicios/${this.authService.getTenantId()}`;
  }

  protected getCollectionPath(): string {
    return `${this.getTenantPath()}/lista`;
  }

  protected getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  protected getItemPath(servicioId: string): string {
    return `${this.getCollectionPath()}/${servicioId}`;
  }

  protected getItemRef(servicioId: string) {
    return ref(this.database, this.getItemPath(servicioId));
  }

  getServicios(): Observable<Servicio[]> {
    return new Observable<Servicio[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Servicio>;
          const servicios = Object.entries(raw)
            .map(([id, servicio]) => ({
              ...servicio,
              impuestoPorcentaje: Number.isFinite(Number(servicio.impuestoPorcentaje))
                ? Math.max(0, Number(servicio.impuestoPorcentaje))
                : 12,
              id
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          subscriber.next(servicios);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getServicioById(servicioId: string): Promise<Servicio | null> {
    const snapshot = await get(this.getItemRef(servicioId));
    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...(snapshot.val() as Servicio),
      impuestoPorcentaje: Number.isFinite(Number((snapshot.val() as Servicio).impuestoPorcentaje))
        ? Math.max(0, Number((snapshot.val() as Servicio).impuestoPorcentaje))
        : 12,
      id: servicioId
    };
  }

  async crearServicio(servicio: Omit<Servicio, 'id'>): Promise<string> {
    const servicioRef = push(this.getCollectionRef());
    const timestamp = Date.now();

    await set(servicioRef, {
      ...servicio,
      impuestoPorcentaje: Number.isFinite(Number(servicio.impuestoPorcentaje))
        ? Math.max(0, Number(servicio.impuestoPorcentaje))
        : 12,
      creadoEn: timestamp,
      actualizadoEn: timestamp
    });

    return servicioRef.key!;
  }

  async actualizarServicio(servicioId: string, servicio: Partial<Servicio>): Promise<void> {
    await update(this.getItemRef(servicioId), {
      ...servicio,
      ...(servicio.impuestoPorcentaje === undefined
        ? {}
        : {
            impuestoPorcentaje: Number.isFinite(Number(servicio.impuestoPorcentaje))
              ? Math.max(0, Number(servicio.impuestoPorcentaje))
              : 12
          }),
      actualizadoEn: Date.now()
    });
  }

  async eliminarServicio(servicioId: string): Promise<void> {
    const servicioRef = this.getItemRef(servicioId);
    await remove(servicioRef);
  }
}

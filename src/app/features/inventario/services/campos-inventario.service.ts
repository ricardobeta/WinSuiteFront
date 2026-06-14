import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { EntidadCamposInventario } from '../models/inventario.models';
import { CampoPersonalizado } from '../../../shared/models/clientes.models';

@Injectable({
  providedIn: 'root'
})
export class CamposInventarioService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  private getEntidadPath(entidad: EntidadCamposInventario): string {
    return `${this.getTenantPath()}/camposPersonalizados/${entidad}`;
  }

  private getEntidadRef(entidad: EntidadCamposInventario) {
    return ref(this.database, this.getEntidadPath(entidad));
  }

  private getCampoRef(entidad: EntidadCamposInventario, idCampo: string) {
    return ref(this.database, `${this.getEntidadPath(entidad)}/${idCampo}`);
  }

  getCampos(entidad: EntidadCamposInventario): Observable<CampoPersonalizado[]> {
    return new Observable<CampoPersonalizado[]>((subscriber) => {
      const camposRef = this.getEntidadRef(entidad);

      const unsubscribe = onValue(
        camposRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          subscriber.next(this.normalizarCampos(snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getCamposOnce(entidad: EntidadCamposInventario): Promise<CampoPersonalizado[]> {
    const snapshot = await get(this.getEntidadRef(entidad));

    if (!snapshot.exists()) {
      return [];
    }

    return this.normalizarCampos(snapshot.val());
  }

  async guardarCampo(entidad: EntidadCamposInventario, campo: CampoPersonalizado): Promise<void> {
    const campoNormalizado = this.normalizarCampo(campo);
    await set(this.getCampoRef(entidad, campoNormalizado.idCampo), campoNormalizado);
  }

  async eliminarCampo(entidad: EntidadCamposInventario, idCampo: string): Promise<void> {
    await remove(this.getCampoRef(entidad, idCampo));
  }

  private normalizarCampos(value: unknown): CampoPersonalizado[] {
    const raw = (value as Record<string, CampoPersonalizado> | null | undefined) ?? {};

    return Object.values(raw)
      .filter((campo) => !!campo && !!campo.idCampo && !!campo.nombreMostrar && !!campo.tipo)
      .map((campo) => this.normalizarCampo(campo))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  private normalizarCampo(campo: CampoPersonalizado): CampoPersonalizado {
    const base: CampoPersonalizado = {
      idCampo: campo.idCampo,
      nombreMostrar: campo.nombreMostrar,
      tipo: campo.tipo,
      requerido: campo.requerido ?? false,
      orden: campo.orden ?? 0
    };

    if (campo.tipo === 'lista_simple' || campo.tipo === 'lista_multiple' || campo.tipo === 'catalogo') {
      return {
        ...base,
        opciones: Array.isArray(campo.opciones)
          ? campo.opciones
              .filter((opcion) => opcion && opcion.clave !== undefined && opcion.valor !== undefined)
              .map((opcion) => ({
                clave: opcion.clave,
                valor: opcion.valor
              }))
          : []
      };
    }

    return base;
  }
}

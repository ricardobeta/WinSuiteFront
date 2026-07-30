import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { CampoPersonalizado, ConfiguracionClientes } from '../../shared/models/clientes.models';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionClientesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getConfigPath(): string {
    return `clientes/${this.authService.getTenantId()}/configuracion`;
  }

  getConfiguracion(): Observable<ConfiguracionClientes> {
    return new Observable<ConfiguracionClientes>((subscriber) => {
      const configRef = ref(this.database, this.getConfigPath());

      const unsubscribe = onValue(
        configRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({ camposPersonalizados: [] });
            return;
          }

          subscriber.next(this.normalizarConfiguracion(snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarConfiguracion(config: ConfiguracionClientes): Promise<void> {
    const configRef = ref(this.database, this.getConfigPath());
    await set(configRef, this.normalizarConfiguracion(config));
  }

  async agregarCampo(campo: CampoPersonalizado): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = [...config.camposPersonalizados, campo].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    await this.guardarConfiguracion({ camposPersonalizados });
  }

  /**
   * Reemplaza un campo por su idCampo, nunca por posicion: el copiloto puede haber reordenado
   * la lista entre que se abrio el dialogo y se guardo.
   */
  async actualizarCampo(campo: CampoPersonalizado): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = config.camposPersonalizados
      .map((existente) => (existente.idCampo === campo.idCampo ? campo : existente))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    await this.guardarConfiguracion({ camposPersonalizados });
  }

  async eliminarCampo(idCampo: string): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = config.camposPersonalizados.filter((campo) => campo.idCampo !== idCampo);

    await this.guardarConfiguracion({ camposPersonalizados });
  }

  private async getConfiguracionOnce(): Promise<ConfiguracionClientes> {
    const snapshot = await get(ref(this.database, this.getConfigPath()));

    if (!snapshot.exists()) {
      return { camposPersonalizados: [] };
    }

    return this.normalizarConfiguracion(snapshot.val());
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionClientes {
    const configuracion = value as Partial<ConfiguracionClientes> | null | undefined;
    const campos = Array.isArray(configuracion?.camposPersonalizados)
      ? configuracion.camposPersonalizados
      : [];

    return {
      camposPersonalizados: campos.map((campo) => {
        const campoNormalizado: CampoPersonalizado = {
          idCampo: campo.idCampo,
          nombreMostrar: campo.nombreMostrar,
          tipo: campo.tipo
        };

        if (campo.requerido !== undefined) {
          campoNormalizado.requerido = campo.requerido;
        }

        if (campo.orden !== undefined) {
          campoNormalizado.orden = campo.orden;
        }

        // Sin estas dos, cada lectura descartaba lo que se hubiera guardado y la siguiente
        // escritura lo borraba del nodo: un campo desactivado volvia a estar activo.
        if (campo.visibleEnLista !== undefined) {
          campoNormalizado.visibleEnLista = campo.visibleEnLista;
        }

        if (campo.activo !== undefined) {
          campoNormalizado.activo = campo.activo;
        }

        if (Array.isArray(campo.opciones)) {
          campoNormalizado.opciones = campo.opciones
            .filter((opcion) => opcion && opcion.clave !== undefined && opcion.valor !== undefined)
            .map((opcion) => ({
              clave: opcion.clave,
              valor: opcion.valor
            }));
        }

        return campoNormalizado;
      })
    };
  }
}
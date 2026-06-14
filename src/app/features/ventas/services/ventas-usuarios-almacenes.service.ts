import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { UsuariosAlmacenesConfig, UsuarioAlmacenAsignacion } from '../models/ventas.models';

@Injectable({
  providedIn: 'root'
})
export class VentasUsuariosAlmacenesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getConfigPath(): string {
    return `ventas/${this.authService.getTenantId()}/configuracion/usuariosAlmacenes`;
  }

  /**
   * Obtiene la configuración de asignaciones usuario-almacén en tiempo real.
   */
  getAsignaciones(): Observable<UsuariosAlmacenesConfig> {
    return new Observable<UsuariosAlmacenesConfig>((subscriber) => {
      const configRef = ref(this.database, this.getConfigPath());

      const unsubscribe = onValue(
        configRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({ asignaciones: {} });
            return;
          }

          const data = snapshot.val() as Partial<UsuariosAlmacenesConfig>;
          subscriber.next({
            asignaciones: data.asignaciones ?? {},
            actualizadoEn: data.actualizadoEn
          });
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Obtiene la configuración actual sin suscripción (lectura única).
   */
  async getAsignacionesOnce(): Promise<UsuariosAlmacenesConfig> {
    const snapshot = await get(ref(this.database, this.getConfigPath()));
    if (!snapshot.exists()) {
      return { asignaciones: {} };
    }

    const data = snapshot.val() as Partial<UsuariosAlmacenesConfig>;
    return {
      asignaciones: data.asignaciones ?? {},
      actualizadoEn: data.actualizadoEn
    };
  }

  /**
   * Guarda la configuración completa de asignaciones usuario-almacén.
   */
  async guardarAsignaciones(config: UsuariosAlmacenesConfig): Promise<void> {
    const configRef = ref(this.database, this.getConfigPath());

    // Intentar escribir la configuración completa. Si las reglas de seguridad
    // del tenant sólo permiten escribir nodos hijos, haremos fallback a
    // escrituras por usuario bajo `.../asignaciones/{usuarioId}`.
    try {
      await set(configRef, {
        asignaciones: config.asignaciones,
        actualizadoEn: Date.now()
      });
      return;
    } catch (err) {
      console.warn('guardarAsignaciones: escritura completa falló, intentando por usuario', err);
    }

    // Fallback: escribir cada asignación individualmente en el path esperado
    const asignaciones = config.asignaciones ?? {};
    const promises: Promise<void>[] = [];

    for (const [usuarioId, asignacion] of Object.entries(asignaciones)) {
      const userRef = ref(this.database, `${this.getConfigPath()}/asignaciones/${usuarioId}`);
      promises.push(
        set(userRef, asignacion).catch((err) => {
          console.error(`Error escribiendo asignacion usuario ${usuarioId}:`, err);
          throw err;
        }) as Promise<void>
      );
    }

    // Ejecutar escrituras por usuario
    await Promise.all(promises);

    // Intentar actualizar timestamp si es posible
    try {
      await set(ref(this.database, `${this.getConfigPath()}/actualizadoEn`), Date.now());
    } catch {
      // Silenciar: timestamp no crítico
    }
  }

  /**
   * Obtiene los almacenes permitidos para un usuario específico.
   */
  async getAlmacenesPermitidosDelUsuario(usuarioId: string): Promise<string[]> {
    const config = await this.getAsignacionesOnce();
    const asignacion = config.asignaciones[usuarioId];
    return asignacion?.almacenIds ?? [];
  }

  /**
   * Asigna múltiples almacenes a un usuario (crea o actualiza la asignación).
   */
  async asignarAlmacenesAlUsuario(
    usuarioId: string,
    almacenIds: string[],
    asignadoPorUsuarioId: string
  ): Promise<void> {
    const asignacion: UsuarioAlmacenAsignacion = {
      usuarioId,
      almacenIds: almacenIds.filter((id) => id.trim() !== ''),
      asignadoEn: Date.now(),
      asignadoPor: asignadoPorUsuarioId
    };

    const userRef = ref(this.database, `${this.getConfigPath()}/asignaciones/${usuarioId}`);
    await set(userRef, asignacion);

    // Actualizar timestamp del conjunto si es posible
    try {
      await set(ref(this.database, `${this.getConfigPath()}/actualizadoEn`), Date.now());
    } catch {
      // Ignorar si falla
    }
  }

  /**
   * Desasigna un almacén de un usuario.
   */
  async desasignarAlmacenDelUsuario(usuarioId: string, almacenId: string): Promise<void> {
    const config = await this.getAsignacionesOnce();
    const asignacion = config.asignaciones[usuarioId];

    if (!asignacion) {
      return;
    }

    asignacion.almacenIds = asignacion.almacenIds.filter((id) => id !== almacenId);

    if (asignacion.almacenIds.length === 0) {
      delete config.asignaciones[usuarioId];
    }

    await this.guardarAsignaciones(config);
  }

  /**
   * Elimina todas las asignaciones de un usuario.
   */
  async eliminarAsignacionesDelUsuario(usuarioId: string): Promise<void> {
    const config = await this.getAsignacionesOnce();
    delete config.asignaciones[usuarioId];
    await this.guardarAsignaciones(config);
  }
}

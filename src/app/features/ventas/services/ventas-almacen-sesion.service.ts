import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { combineLatest, map, Observable, Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AlmacenesService } from '../../inventario/services/almacenes.service';
import { Almacen } from '../../inventario/models/inventario.models';
import { VentasUsuariosAlmacenesService } from './ventas-usuarios-almacenes.service';
import { UsuariosAlmacenesConfig } from '../models/ventas.models';

/**
 * Gestiona la selección del almacén de trabajo actual para un usuario.
 * Persiste en localStorage y valida acceso según asignaciones.
 */
@Injectable({
  providedIn: 'root'
})
export class VentasAlmacenSesionService {
  private readonly authService = inject(AuthService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly usuariosAlmacenesService = inject(VentasUsuariosAlmacenesService);

  private readonly almacenSeleccionadoId = signal<string | null>(null);
  private usuarioIdActual: string | null = null;
  private sessionSubscription: Subscription | null = null;

  readonly almacenSeleccionado = computed(() => {
    const id = this.almacenSeleccionadoId();
    if (!id) {
      return null;
    }

    return this.almacenesPermitidosSignal().find((almacen) => almacen.id === id) ?? null;
  });

  readonly almacenesPermitidosSignal = signal<Almacen[]>([]);

  constructor() {
    effect(() => {
      const usuario = this.authService.currentUser();
      this.initializeSession(usuario?.uid ?? null);
    }, { allowSignalWrites: true });
  }

  /**
   * Inicializa la sesión resolviendo almacenes permitidos e intentando cargar
   * la selección guardada del usuario actual.
   */
  private initializeSession(usuarioId: string | null): void {
    if (!usuarioId) {
      this.sessionSubscription?.unsubscribe();
      this.sessionSubscription = null;
      this.almacenSeleccionadoId.set(null);
      this.almacenesPermitidosSignal.set([]);
      this.usuarioIdActual = null;
      return;
    }

    if (this.usuarioIdActual === usuarioId && this.sessionSubscription) {
      return;
    }

    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    this.usuarioIdActual = usuarioId;

    // Cargar almacenes permitidos y actualizar signal
    this.sessionSubscription = combineLatest([
      this.almacenesService.getAlmacenesActivos(),
      this.usuariosAlmacenesService.getAsignaciones()
    ])
      .pipe(
        map(([almacenes, config]) => this.resolverAlmacenesPermitidos(usuarioId, almacenes, config))
      )
      .subscribe((almacenesPermitidos) => {
        this.almacenesPermitidosSignal.set(almacenesPermitidos);

        // Intentar cargar selección guardada
        const seleccionado = this.cargarSeleccionGuardada();
        if (seleccionado && almacenesPermitidos.find((a) => a.id === seleccionado)) {
          this.almacenSeleccionadoId.set(seleccionado);
        } else if (almacenesPermitidos.length > 0) {
          // Fallback: usar primer almacén permitido o default
          const almacenDefault = almacenesPermitidos.find((a) => a.esPorDefecto) ?? almacenesPermitidos[0];
          const fallbackId = almacenDefault?.id ?? null;
          this.almacenSeleccionadoId.set(fallbackId);
          if (fallbackId) {
            this.guardarSeleccion(fallbackId);
          }
        } else {
          this.almacenSeleccionadoId.set(null);
        }
      });
  }

  /**
   * Obtiene el almacén de trabajo actual.
   */
  readonly getAlmacenSeleccionado = (): Almacen | null => {
    return this.almacenSeleccionado();
  };

  /**
   * Obtiene el listado de almacenes permitidos para el usuario actual.
   */
  getAlmacenesPermitidos(): Almacen[] {
    return this.almacenesPermitidosSignal();
  }

  /**
   * Selecciona un nuevo almacén de trabajo (validando que esté permitido).
   */
  readonly seleccionarAlmacen = (almacenId: string): void => {
    if (!this.almacenesPermitidosSignal().find((a) => a.id === almacenId)) {
      console.warn(`Almacén ${almacenId} no permitido para usuario.`);
      return;
    }

    this.almacenSeleccionadoId.set(almacenId);
    this.guardarSeleccion(almacenId);
  };

  /**
   * Retorna si el usuario tiene almacenes permitidos (puede operar POS).
   */
  tieneAlmacenesPermitidos(): boolean {
    return this.almacenesPermitidosSignal().length > 0;
  }

  /**
   * Retorna true si el usuario puede operar en un almacén específico.
   */
  puedeOperarEnAlmacen(almacenId: string): boolean {
    return this.almacenesPermitidosSignal().some((a) => a.id === almacenId);
  }

  /**
   * Resuelve los almacenes permitidos para un usuario según su asignación y almacenes activos disponibles.
   */
  private resolverAlmacenesPermitidos(
    usuarioId: string,
    almacenesActivos: Almacen[],
    config: UsuariosAlmacenesConfig
  ): Almacen[] {
    const asignacion = config.asignaciones[usuarioId];
    if (!asignacion || asignacion.almacenIds.length === 0) {
      return []; // Usuario sin asignaciones
    }

    return almacenesActivos.filter((almacen) =>
      asignacion.almacenIds.includes(almacen.id ?? '')
    );
  }

  /**
   * Carga la selección de almacén guardada en localStorage.
   */
  private cargarSeleccionGuardada(): string | null {
    if (!this.usuarioIdActual) {
      return null;
    }

    const key = this.getStorageKey();
    const guardado = localStorage.getItem(key);
    if (!guardado) {
      return null;
    }

    try {
      return JSON.parse(guardado);
    } catch {
      return guardado;
    }
  }

  /**
   * Guarda la selección de almacén en localStorage.
   */
  private guardarSeleccion(almacenId: string): void {
    const key = this.getStorageKey();
    localStorage.setItem(key, JSON.stringify(almacenId));
  }

  /**
   * Genera la clave de localStorage para el usuario y tenant actuales.
   */
  private getStorageKey(): string {
    const tenantId = this.authService.getTenantId();
    return `winsuite.pos.almacenSeleccionado.${tenantId}.${this.usuarioIdActual}`;
  }

  /**
   * Limpia la sesión (usado en logout).
   */
  limpiarSesion(): void {
    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    this.almacenSeleccionadoId.set(null);
    this.almacenesPermitidosSignal.set([]);
    this.usuarioIdActual = null;
  }
}

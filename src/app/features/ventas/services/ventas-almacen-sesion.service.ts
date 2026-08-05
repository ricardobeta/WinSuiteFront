import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subscription, combineLatest, retry } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AlmacenesService } from '../../inventario/services/almacenes.service';
import { Almacen } from '../../inventario/models/inventario.models';
import { VentasUsuariosAlmacenesService } from './ventas-usuarios-almacenes.service';
import { UsuarioAlmacenAsignacion } from '../models/ventas.models';

/** Estado de la resolución de almacenes permitidos para la sesión actual. */
export type EstadoAlmacenSesion = 'cargando' | 'listo' | 'error';

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
  private readonly almacenesActivos = signal<Almacen[]>([]);
  private readonly asignaciones = signal<Record<string, UsuarioAlmacenAsignacion>>({});
  private readonly usuarioIdSignal = signal<string | null>(null);

  /** Estado de carga: distingue "todavía no sé" de "de verdad no tiene almacenes". */
  readonly estado = signal<EstadoAlmacenSesion>('cargando');

  private sesionKey: string | null = null;
  private tenantIdActual: string | null = null;
  private sessionSubscription: Subscription | null = null;

  readonly almacenesPermitidosSignal = computed<Almacen[]>(() => {
    if (this.estado() !== 'listo') {
      return [];
    }

    const usuarioId = this.usuarioIdSignal();
    if (!usuarioId) {
      return [];
    }

    const activos = this.almacenesActivos();
    const asignaciones = this.asignaciones();
    const almacenIds = asignaciones[usuarioId]?.almacenIds ?? [];

    if (almacenIds.length > 0) {
      const permitidos = new Set(almacenIds);
      return activos.filter((almacen) => permitidos.has(almacen.id ?? ''));
    }

    // Sin asignación propia no bloqueamos ni al administrador ni a las empresas
    // que todavía no repartieron almacenes: en ese caso el POS opera con todos
    // los almacenes activos hasta que alguien configure las asignaciones.
    if (this.esAdministrador() || Object.keys(asignaciones).length === 0) {
      return activos;
    }

    return [];
  });

  readonly almacenSeleccionado = computed(() => {
    const id = this.almacenSeleccionadoId();
    if (!id) {
      return null;
    }

    return this.almacenesPermitidosSignal().find((almacen) => almacen.id === id) ?? null;
  });

  /** true sólo cuando ya se resolvió el acceso y el usuario realmente no puede operar. */
  readonly sinAlmacenesPermitidos = computed(
    () => this.estado() === 'listo' && this.almacenesPermitidosSignal().length === 0
  );

  readonly cargandoAlmacenesPermitidos = computed(() => this.estado() === 'cargando');
  readonly errorAlmacenesPermitidos = computed(() => this.estado() === 'error');

  constructor() {
    effect(() => {
      const usuarioId = this.authService.currentUser()?.uid ?? null;
      this.initializeSession(usuarioId, this.resolverTenantId());
    }, { allowSignalWrites: true });

    // Mantiene la selección coherente con los almacenes que el usuario puede operar.
    effect(() => {
      const permitidos = this.almacenesPermitidosSignal();
      if (this.estado() !== 'listo') {
        return;
      }

      const seleccionActual = this.almacenSeleccionadoId();
      if (seleccionActual && permitidos.some((almacen) => almacen.id === seleccionActual)) {
        return;
      }

      const guardado = this.cargarSeleccionGuardada();
      if (guardado && permitidos.some((almacen) => almacen.id === guardado)) {
        this.almacenSeleccionadoId.set(guardado);
        return;
      }

      if (permitidos.length === 0) {
        this.almacenSeleccionadoId.set(null);
        return;
      }

      const almacenDefault = permitidos.find((almacen) => almacen.esPorDefecto) ?? permitidos[0];
      const fallbackId = almacenDefault?.id ?? null;
      this.almacenSeleccionadoId.set(fallbackId);
      if (fallbackId) {
        this.guardarSeleccion(fallbackId);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Inicializa la sesión resolviendo almacenes permitidos para el usuario y la
   * empresa activos. Se vuelve a suscribir si cambia cualquiera de los dos.
   */
  private initializeSession(usuarioId: string | null, tenantId: string | null): void {
    const key = usuarioId && tenantId ? `${tenantId}::${usuarioId}` : null;

    if (key && key === this.sesionKey && this.sessionSubscription) {
      return;
    }

    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    this.sesionKey = key;
    this.tenantIdActual = tenantId;
    this.usuarioIdSignal.set(usuarioId);
    this.almacenesActivos.set([]);
    this.asignaciones.set({});
    this.almacenSeleccionadoId.set(null);
    this.estado.set('cargando');

    if (!key) {
      // Sin usuario o sin empresa resuelta todavía: seguimos en "cargando" para
      // no mostrar el bloqueo de "no tienes almacenes asignados" por adelantado.
      return;
    }

    this.sessionSubscription = combineLatest([
      this.almacenesService.getAlmacenesActivos(),
      this.usuariosAlmacenesService.getAsignaciones()
    ])
      // Justo después del login las reglas de RTDB pueden rechazar la lectura
      // mientras el token todavía no trae el sessionId/sessionVersion vigentes.
      .pipe(retry({ count: 3, delay: 1500 }))
      .subscribe({
        next: ([almacenes, config]) => {
          this.almacenesActivos.set(almacenes);
          this.asignaciones.set(config.asignaciones ?? {});
          this.estado.set('listo');
        },
        error: (error) => {
          console.error('[ventas] No se pudieron resolver los almacenes permitidos:', error);
          this.sessionSubscription = null;
          this.sesionKey = null;
          this.estado.set('error');
        }
      });
  }

  /** Reintenta la resolución de almacenes tras un fallo de lectura. */
  recargar(): void {
    this.sesionKey = null;
    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    this.initializeSession(this.authService.currentUser()?.uid ?? null, this.resolverTenantId());
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
   * Los administradores no dependen de una asignación explícita.
   */
  private esAdministrador(): boolean {
    return (this.authService.currentProfile()?.role ?? '').toUpperCase() === 'ADMIN';
  }

  /**
   * Resuelve la empresa activa sin propagar la excepción de `getTenantId()`
   * cuando el bootstrap de sesión todavía no terminó.
   */
  private resolverTenantId(): string | null {
    try {
      return this.authService.getTenantId();
    } catch {
      return null;
    }
  }

  /**
   * Carga la selección de almacén guardada en localStorage.
   */
  private cargarSeleccionGuardada(): string | null {
    const key = this.getStorageKey();
    if (!key) {
      return null;
    }

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
    if (!key) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(almacenId));
  }

  /**
   * Genera la clave de localStorage para el usuario y tenant actuales.
   */
  private getStorageKey(): string | null {
    const usuarioId = this.usuarioIdSignal();
    if (!this.tenantIdActual || !usuarioId) {
      return null;
    }

    return `winsuite.pos.almacenSeleccionado.${this.tenantIdActual}.${usuarioId}`;
  }

  /**
   * Limpia la sesión (usado en logout).
   */
  limpiarSesion(): void {
    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    this.sesionKey = null;
    this.tenantIdActual = null;
    this.almacenSeleccionadoId.set(null);
    this.almacenesActivos.set([]);
    this.asignaciones.set({});
    this.usuarioIdSignal.set(null);
    this.estado.set('cargando');
  }
}

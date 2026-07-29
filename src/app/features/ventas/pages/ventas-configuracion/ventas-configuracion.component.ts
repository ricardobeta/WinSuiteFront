import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { combineLatest } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { AppUserProfile } from '../../../../core/models/auth.models';
import { ConfiguracionFacturacion } from '../../../../shared/models/facturacion.models';
import { Almacen } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { ModoPos, PerfilPos, UsuariosAlmacenesConfig } from '../../models/ventas.models';
import { VentasAlmacenSesionService } from '../../services/ventas-almacen-sesion.service';
import { VentasColaboradoresService } from '../../services/ventas-colaboradores.service';
import { VentasPosConfigService } from '../../services/ventas-pos-config.service';
import { VentasUsuariosAlmacenesService } from '../../services/ventas-usuarios-almacenes.service';

interface ColaboradorAlmacenesRow {
  colaborador: AppUserProfile;
  almacenesAsignados: Almacen[];
  almacenesNoAsignados: Almacen[];
}

@Component({
  selector: 'app-ventas-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTabsModule
  ],
  templateUrl: './ventas-configuracion.component.html',
  styleUrl: './ventas-configuracion.component.scss'
})
export class VentasConfiguracionComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly facturacionService = inject(FacturacionConfigService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly colaboradoresService = inject(VentasColaboradoresService);
  private readonly usuariosAlmacenesService = inject(VentasUsuariosAlmacenesService);
  private readonly almacenSesionService = inject(VentasAlmacenSesionService);
  private readonly posConfigService = inject(VentasPosConfigService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly selectedTabIndex = signal(0);
  protected readonly cargandoMetodos = signal(true);
  protected readonly metodosPago = signal<ConfiguracionFacturacion | null>(null);
  protected readonly metodosPagoActivos = computed(() => this.metodosPago()?.formaPagoActivos ?? []);

  protected readonly cargandoAsignaciones = signal(true);
  protected readonly colaboradores = signal<AppUserProfile[]>([]);
  protected readonly almacenesActivos = signal<Almacen[]>([]);
  protected readonly asignacionesActuales = signal<UsuariosAlmacenesConfig | null>(null);
  protected readonly asignacionesTrabajo = signal<UsuariosAlmacenesConfig | null>(null);
  protected readonly guardando = signal(false);

  protected readonly cargandoAlmacenesUsuario = signal(true);
  protected readonly almacenesPermitidosUsuario = signal<Almacen[]>([]);
  protected readonly almacenActualUsuario = computed(() => this.almacenSesionService.getAlmacenSeleccionado());
  protected readonly usuarioActualNombre = computed(() => this.authService.currentUser()?.displayName ?? 'Usuario');

  protected readonly perfilAlmacenId = signal<string>('');
  protected readonly perfilEditable = signal<PerfilPos | null>(null);
  protected readonly perfilOriginal = signal<PerfilPos | null>(null);
  protected readonly cargandoPerfil = signal(false);
  protected readonly guardandoPerfil = signal(false);

  protected readonly hayEnCambios = computed(() =>
    JSON.stringify(this.asignacionesActuales()) !== JSON.stringify(this.asignacionesTrabajo())
  );
  protected readonly hayCambiosPerfil = computed(() =>
    JSON.stringify(this.perfilOriginal()) !== JSON.stringify(this.perfilEditable())
  );
  protected readonly colaboradoresAlmacenesRows = computed<ColaboradorAlmacenesRow[]>(() => {
    const almacenes = this.almacenesActivos();
    const asignaciones = this.asignacionesTrabajo()?.asignaciones ?? {};
    return this.colaboradores().map((colaborador) => {
      const asignadosIds = new Set(asignaciones[colaborador.userId]?.almacenIds ?? []);
      return {
        colaborador,
        almacenesAsignados: almacenes.filter((almacen) => asignadosIds.has(almacen.id ?? '')),
        almacenesNoAsignados: almacenes.filter((almacen) => !asignadosIds.has(almacen.id ?? ''))
      };
    });
  });

  constructor() { this.cargarDatos(); }

  protected toggleAlmacen(usuarioId: string, almacenId: string): void {
    if (!almacenId) return;
    const config = this.asignacionesTrabajo();
    if (!config) return;
    const trabajo = structuredClone(config);
    if (!trabajo.asignaciones[usuarioId]) {
      trabajo.asignaciones[usuarioId] = {
        usuarioId, almacenIds: [], asignadoEn: Date.now(), asignadoPor: this.authService.currentUser()?.uid ?? 'sistema'
      };
    }
    const asignacion = trabajo.asignaciones[usuarioId];
    const index = asignacion.almacenIds.indexOf(almacenId);
    index >= 0 ? asignacion.almacenIds.splice(index, 1) : asignacion.almacenIds.push(almacenId);
    if (asignacion.almacenIds.length === 0) delete trabajo.asignaciones[usuarioId];
    this.asignacionesTrabajo.set(trabajo);
  }

  protected async guardarAsignaciones(): Promise<void> {
    const config = this.asignacionesTrabajo();
    if (!config || !this.hayEnCambios()) return;
    this.guardando.set(true);
    try {
      await this.usuariosAlmacenesService.guardarAsignaciones(config);
      this.asignacionesActuales.set(structuredClone(config));
      this.mostrarMensaje('Asignaciones guardadas correctamente.', 'success');
    } catch {
      this.mostrarMensaje('No se pudieron guardar las asignaciones.', 'error');
    } finally { this.guardando.set(false); }
  }

  protected seleccionarAlmacenUsuario(almacenId: string): void {
    if (!almacenId) return;
    this.almacenSesionService.seleccionarAlmacen(almacenId);
    this.mostrarMensaje('Almacén de trabajo actualizado.', 'success');
  }

  protected async seleccionarAlmacenPerfil(almacenId: string): Promise<void> {
    if (!almacenId) {
      this.perfilAlmacenId.set(''); this.perfilEditable.set(null); this.perfilOriginal.set(null); return;
    }
    this.perfilAlmacenId.set(almacenId);
    this.cargandoPerfil.set(true);
    try {
      const perfil = await this.posConfigService.getPerfilOnce(almacenId);
      this.perfilEditable.set(perfil);
      this.perfilOriginal.set(structuredClone(perfil));
    } catch {
      this.mostrarMensaje('No se pudo cargar el perfil de POS.', 'error');
      this.perfilEditable.set(null); this.perfilOriginal.set(null);
    } finally { this.cargandoPerfil.set(false); }
  }

  protected actualizarPerfil(patch: Partial<PerfilPos>): void {
    const perfil = this.perfilEditable();
    if (perfil) this.perfilEditable.set({ ...perfil, ...patch });
  }

  protected cambiarModo(modo: ModoPos): void {
    const almacenId = this.perfilAlmacenId();
    if (almacenId) this.perfilEditable.set(this.posConfigService.getDefaultPerfil(almacenId, modo));
  }

  protected async guardarPerfil(): Promise<void> {
    const perfil = this.perfilEditable();
    if (!perfil || !this.hayCambiosPerfil()) return;
    this.guardandoPerfil.set(true);
    try {
      await this.posConfigService.guardarPerfil(perfil);
      this.perfilOriginal.set(structuredClone(perfil));
      this.mostrarMensaje('Perfil de POS guardado correctamente.', 'success');
    } catch {
      this.mostrarMensaje('No se pudo guardar el perfil de POS.', 'error');
    } finally { this.guardandoPerfil.set(false); }
  }

  protected asInput(event: Event): HTMLInputElement { return event.target as HTMLInputElement; }

  private cargarDatos(): void {
    this.facturacionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => { this.metodosPago.set(config); this.cargandoMetodos.set(false); },
      error: () => { this.cargandoMetodos.set(false); this.mostrarMensaje('No se pudieron cargar los métodos de pago.', 'error'); }
    });
    this.colaboradoresService.getColaboradoresActivos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (colaboradores) => { this.colaboradores.set(colaboradores); this.cargandoAsignaciones.set(false); },
      error: () => { this.cargandoAsignaciones.set(false); this.mostrarMensaje('No se pudieron cargar los colaboradores.', 'error'); }
    });
    this.almacenesService.getAlmacenesActivos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (almacenes) => this.almacenesActivos.set(almacenes),
      error: () => this.mostrarMensaje('No se pudieron cargar los almacenes.', 'error')
    });
    this.usuariosAlmacenesService.getAsignaciones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (asignaciones) => { this.asignacionesActuales.set(asignaciones); this.asignacionesTrabajo.set(structuredClone(asignaciones)); },
      error: () => this.mostrarMensaje('No se pudieron cargar las asignaciones.', 'error')
    });
    combineLatest([this.almacenesService.getAlmacenesActivos(), this.usuariosAlmacenesService.getAsignaciones()])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ([almacenes, asignaciones]) => {
          const usuarioId = this.authService.currentUser()?.uid;
          const ids = usuarioId ? asignaciones?.asignaciones?.[usuarioId]?.almacenIds ?? [] : [];
          this.almacenesPermitidosUsuario.set(almacenes.filter((almacen) => ids.includes(almacen.id ?? '')));
          this.cargandoAlmacenesUsuario.set(false);
        },
        error: () => { this.cargandoAlmacenesUsuario.set(false); this.almacenesPermitidosUsuario.set([]); }
      });
  }

  private mostrarMensaje(mensaje: string, tipo: 'success' | 'error' | 'info'): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${tipo}`] });
  }
}

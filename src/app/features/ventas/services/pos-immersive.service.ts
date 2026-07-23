import { Injectable, signal } from '@angular/core';

/**
 * Modo inmersivo del POS: oculta el chrome de la aplicación (sidebar/topbar y
 * el shell del módulo) y activa la Fullscreen API del navegador para una
 * experiencia de tablet/celular a pantalla completa.
 *
 * Los shells (`WorkspaceShellComponent`, `ModuleShellComponent`/`VentasShellComponent`)
 * leen `immersive()` para ocultar su cromo. El POS invoca `toggle()`.
 */
@Injectable({
  providedIn: 'root'
})
export class PosImmersiveService {
  private readonly immersiveState = signal(false);
  /** True cuando el POS está en modo pantalla completa/inmersivo. */
  readonly immersive = this.immersiveState.asReadonly();

  private fullscreenListenerBound = false;

  private readonly onFullscreenChange = (): void => {
    // Si el usuario sale de fullscreen con Escape, sincronizamos el estado.
    if (!document.fullscreenElement && this.immersiveState()) {
      this.immersiveState.set(false);
    }
  };

  /** Alterna el modo inmersivo (y la Fullscreen API del navegador). */
  async toggle(): Promise<void> {
    if (this.immersiveState()) {
      await this.desactivar();
    } else {
      await this.activar();
    }
  }

  async activar(): Promise<void> {
    this.ensureListener();
    this.immersiveState.set(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen puede fallar (permisos/gesto); el modo inmersivo sigue activo por CSS.
    }
  }

  async desactivar(): Promise<void> {
    this.immersiveState.set(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignorar
    }
  }

  private ensureListener(): void {
    if (this.fullscreenListenerBound) {
      return;
    }
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.fullscreenListenerBound = true;
  }
}

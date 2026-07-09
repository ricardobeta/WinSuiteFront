import { Injectable, computed, signal } from '@angular/core';
import { ContenidoSitio } from '@winsuite/bloques';

const LIMITE_HISTORIAL = 50;

/**
 * Undo/redo por snapshots JSON del contenido del sitio (los documentos son pequenos).
 * Se provee A NIVEL DE COMPONENTE en editor-page (una instancia por editor abierto).
 */
@Injectable()
export class EditorHistorialService {
  private readonly pila = signal<string[]>([]);
  private readonly indice = signal(-1);

  readonly puedeDeshacer = computed(() => this.indice() > 0);
  readonly puedeRehacer = computed(() => this.indice() < this.pila().length - 1);

  reiniciar(contenido: ContenidoSitio): void {
    this.pila.set([JSON.stringify(contenido)]);
    this.indice.set(0);
  }

  registrar(contenido: ContenidoSitio): void {
    const snapshot = JSON.stringify(contenido);
    const actual = this.pila()[this.indice()];
    if (snapshot === actual) return;

    const nuevaPila = [...this.pila().slice(0, this.indice() + 1), snapshot].slice(
      -LIMITE_HISTORIAL,
    );
    this.pila.set(nuevaPila);
    this.indice.set(nuevaPila.length - 1);
  }

  deshacer(): ContenidoSitio | null {
    if (!this.puedeDeshacer()) return null;
    this.indice.update((i) => i - 1);
    return JSON.parse(this.pila()[this.indice()]) as ContenidoSitio;
  }

  rehacer(): ContenidoSitio | null {
    if (!this.puedeRehacer()) return null;
    this.indice.update((i) => i + 1);
    return JSON.parse(this.pila()[this.indice()]) as ContenidoSitio;
  }
}

import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { Categoria } from '../models/inventario.models';

@Injectable({
  providedIn: 'root'
})
export class CategoriasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `inventario/${this.authService.getTenantId()}`;
  }

  private getCollectionPath(): string {
    return `${this.getTenantPath()}/categorias`;
  }

  private getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  private getItemRef(categoriaId: string) {
    return ref(this.database, `${this.getCollectionPath()}/${categoriaId}`);
  }

  getCategorias(): Observable<Categoria[]> {
    return new Observable<Categoria[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Categoria>;
          const categorias = Object.entries(raw)
            .map(([id, categoria]) => ({
              ...categoria,
              id
            }))
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

          subscriber.next(categorias);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getCategoriasOnce(): Promise<Categoria[]> {
    const snapshot = await get(this.getCollectionRef());
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, Categoria>;
    return Object.entries(raw)
      .map(([id, categoria]) => ({
        ...categoria,
        id
      }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  async guardarCategoria(categoria: Categoria): Promise<void> {
    if (categoria.id) {
      const { id, ...payload } = categoria;
      await set(this.getItemRef(id), payload);
      return;
    }

    const categoriaRef = push(this.getCollectionRef());
    await set(categoriaRef, {
      nombre: categoria.nombre,
      categoriaPadreId: categoria.categoriaPadreId ?? null,
      color: categoria.color ?? '',
      icono: categoria.icono ?? '',
      orden: categoria.orden ?? 0,
      activo: categoria.activo ?? true
    });
  }

  async eliminarCategoria(categoriaId: string): Promise<void> {
    await remove(this.getItemRef(categoriaId));
  }
}

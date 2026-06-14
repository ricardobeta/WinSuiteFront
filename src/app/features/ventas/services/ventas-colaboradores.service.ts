import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Database, ref, get } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AppUserProfile } from '../../../core/models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class VentasColaboradoresService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  /**
   * Obtiene la lista de colaboradores activos del tenant actual.
   * Filtra automáticamente usuarios inactivos desde tenant_users en Firebase.
   */
  getColaboradoresActivos(): Observable<AppUserProfile[]> {
    return new Observable((observer) => {
      const tenantId = this.authService.tenantId();
      if (!tenantId) {
        observer.next([]);
        observer.complete();
        return;
      }

      const dbRef = ref(this.database, `tenant_users/${tenantId}`);
      get(dbRef)
        .then((snapshot) => {
          if (!snapshot.exists()) {
            observer.next([]);
            observer.complete();
            return;
          }

          const usuarios = snapshot.val() as Record<string, any>;
          const usuarios_activos: AppUserProfile[] = Object.entries(usuarios)
            .map(([, user]: [string, any]) => user as AppUserProfile)
            .filter((usuario: AppUserProfile) => usuario?.active !== false)
            .sort((a: AppUserProfile, b: AppUserProfile) => 
              (a.fullName ?? '').localeCompare(b.fullName ?? '')
            );

          observer.next(usuarios_activos);
          observer.complete();
        })
        .catch((error) => {
          console.error('Error fetching colaboradores:', error);
          observer.next([]);
          observer.complete();
        });
    });
  }
}

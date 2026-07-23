import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Operaciones server-side del submódulo Nómina. El cálculo vive en el frontend; el backend solo
 * emite los comprobantes en PDF.
 */
@Injectable({
  providedIn: 'root'
})
export class NominaPdfApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/nomina`;

  /** Sin `empleadoId` descarga el juego completo del rol, una pagina por empleado. */
  descargarComprobantes(rolId: string, empleadoId?: string): Promise<Blob> {
    const params = empleadoId ? new HttpParams().set('empleadoId', empleadoId) : undefined;
    return firstValueFrom(this.http.get(`${this.baseUrl}/roles/${rolId}/comprobantes/pdf`, {
      params,
      responseType: 'blob'
    }));
  }
}

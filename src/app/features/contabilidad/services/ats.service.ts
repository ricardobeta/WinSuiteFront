import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface AtsResult {
  xml: string;
  numeroCompras: number;
  totalBaseImponible: string;
  totalIva: string;
  totalRetencion: string;
}

@Injectable({
  providedIn: 'root'
})
export class AtsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/ats`;

  generar(anio: number, mes: number, incluirBorradores = false): Observable<AtsResult> {
    return this.http.post<AtsResult>(`${this.baseUrl}/generar`, { anio, mes, incluirBorradores });
  }
}

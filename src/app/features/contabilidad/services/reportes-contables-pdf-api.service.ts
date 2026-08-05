import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportesContablesPdfApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/reportes`;

  /** `fechaDesde` activa el modo PERIODO: el PDF trae solo los montos acumulados en el rango. */
  descargarEstadoSituacionFinancieraPdf(fechaCorte: string, fechaDesde?: string): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/estados-financieros/pdf`, {
      tipo: 'ESF',
      fechaCorte,
      fechaDesde: fechaDesde?.trim() || null
    }, { responseType: 'blob' }));
  }

  descargarEstadoResultadoIntegralPdf(fechaDesde: string, fechaHasta: string): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/estados-financieros/pdf`, {
      tipo: 'ERI',
      fechaDesde,
      fechaHasta
    }, { responseType: 'blob' }));
  }
}

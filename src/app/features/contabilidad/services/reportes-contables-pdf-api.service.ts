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

  descargarEstadoSituacionFinancieraPdf(fechaCorte: string): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/estados-financieros/pdf`, {
      tipo: 'ESF',
      fechaCorte
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

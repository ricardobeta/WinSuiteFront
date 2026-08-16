import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  EstadoResultadoIntegralResultado,
  EstadoSituacionFinancieraResultado
} from '../models/contabilidad.models';

@Injectable({
  providedIn: 'root'
})
export class ReportesContablesPdfApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/reportes`;

  consultarEstadoSituacionFinanciera(fechaCorte: string, fechaDesde?: string): Promise<EstadoSituacionFinancieraResultado> {
    return firstValueFrom(this.http.post<EstadoSituacionFinancieraResultado>(`${this.baseUrl}/estados-financieros/consulta`, {
      tipo: 'ESF',
      fechaCorte,
      fechaDesde: fechaDesde?.trim() || null
    }));
  }

  consultarEstadoResultadoIntegral(fechaDesde: string, fechaHasta: string): Promise<EstadoResultadoIntegralResultado> {
    return firstValueFrom(this.http.post<EstadoResultadoIntegralResultado>(`${this.baseUrl}/estados-financieros/consulta`, {
      tipo: 'ERI',
      fechaDesde,
      fechaHasta
    }));
  }

  /** `fechaDesde` activa la vista por rango con apertura, movimiento y cierre. */
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

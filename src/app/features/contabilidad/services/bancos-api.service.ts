import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AnalisisExtracto,
  ContraparteMatch,
  MapeoExtracto,
  MovimientosPage,
  ResultadoConciliacion,
  ResultadoImportacion,
  ResumenConciliacion
} from '../models/bancos.models';

/**
 * Operaciones server-side del submódulo Bancos: parseo/importación de
 * extractos, motor de conciliación, sugerencias IA, resumen y PDF.
 */
@Injectable({
  providedIn: 'root'
})
export class BancosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/bancos`;

  analizarExtracto(cuentaBancariaId: string, storagePath: string, nombreArchivo: string): Promise<AnalisisExtracto> {
    return firstValueFrom(this.http.post<AnalisisExtracto>(`${this.baseUrl}/extractos/analizar`, {
      cuentaBancariaId,
      storagePath,
      nombreArchivo
    }));
  }

  importarExtracto(input: {
    cuentaBancariaId: string;
    storagePath: string;
    nombreArchivo: string;
    mapeo: MapeoExtracto;
    guardarPlantilla: boolean;
    plantillaId?: string | null;
  }): Promise<ResultadoImportacion> {
    return firstValueFrom(this.http.post<ResultadoImportacion>(`${this.baseUrl}/extractos/importar`, input));
  }

  ejecutarConciliacion(cuentaBancariaId: string, periodo: string): Promise<ResultadoConciliacion> {
    return firstValueFrom(this.http.post<ResultadoConciliacion>(`${this.baseUrl}/conciliacion/ejecutar`, {
      cuentaBancariaId,
      periodo
    }));
  }

  sugerenciasIa(cuentaBancariaId: string, periodo: string): Promise<ResultadoConciliacion> {
    return firstValueFrom(this.http.post<ResultadoConciliacion>(`${this.baseUrl}/conciliacion/sugerencias-ia`, {
      cuentaBancariaId,
      periodo
    }));
  }

  crearMatchManual(input: {
    cuentaBancariaId: string;
    periodo: string;
    movimientoIds: string[];
    contrapartes: ContraparteMatch[];
    motivo?: string;
  }): Promise<{ matchId: string }> {
    return firstValueFrom(this.http.post<{ matchId: string }>(`${this.baseUrl}/conciliacion/matches`, input));
  }

  resolverMatch(input: {
    cuentaBancariaId: string;
    matchId: string;
    accion: 'ACEPTAR' | 'RECHAZAR';
    asientoId?: string | null;
  }): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/conciliacion/matches/resolver`, input));
  }

  getResumen(cuentaBancariaId: string, periodo: string): Promise<ResumenConciliacion> {
    const params = new HttpParams().set('cuentaBancariaId', cuentaBancariaId).set('periodo', periodo);
    return firstValueFrom(this.http.get<ResumenConciliacion>(`${this.baseUrl}/conciliacion/resumen`, { params }));
  }

  explicarDescuadre(cuentaBancariaId: string, periodo: string): Promise<{ explicacion: string }> {
    return firstValueFrom(this.http.post<{ explicacion: string }>(`${this.baseUrl}/conciliacion/explicar`, {
      cuentaBancariaId,
      periodo
    }));
  }

  /** Paginación server-side para tamaños de página de 200/500. */
  getMovimientosPage(cuentaBancariaId: string, limit: number, cursor: string | null): Promise<MovimientosPage> {
    let params = new HttpParams().set('cuentaBancariaId', cuentaBancariaId).set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    return firstValueFrom(this.http.get<MovimientosPage>(`${this.baseUrl}/movimientos`, { params }));
  }

  descargarConciliacionPdf(cuentaBancariaId: string, periodo: string): Promise<Blob> {
    const params = new HttpParams().set('cuentaBancariaId', cuentaBancariaId).set('periodo', periodo);
    return firstValueFrom(this.http.get(`${this.baseUrl}/reportes/conciliacion/pdf`, {
      params,
      responseType: 'blob'
    }));
  }
}

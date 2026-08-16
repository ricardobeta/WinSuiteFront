import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AnalisisExtracto,
  ContraparteMatch,
  HojaExtractoResumen,
  MapeoExtracto,
  MovimientosPage,
  PlantillaDisponible,
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

  /** Hojas del archivo, sin llamar a la IA. */
  listarHojas(storagePath: string, nombreArchivo: string): Promise<HojaExtractoResumen[]> {
    return firstValueFrom(this.http.post<HojaExtractoResumen[]>(`${this.baseUrl}/extractos/hojas`, {
      storagePath,
      nombreArchivo
    }));
  }

  /** Plantillas del banco con su compatibilidad real contra la hoja; no consume IA. */
  listarPlantillas(
    cuentaBancariaId: string,
    storagePath: string,
    nombreArchivo: string,
    hojaIndex: number | null = null
  ): Promise<PlantillaDisponible[]> {
    return firstValueFrom(this.http.post<PlantillaDisponible[]>(`${this.baseUrl}/extractos/plantillas`, {
      cuentaBancariaId,
      storagePath,
      nombreArchivo,
      hojaIndex
    }));
  }

  /** plantillaId: aplicar esa plantilla. forzarIa: ignorar plantillas y detectar con IA. */
  analizarExtracto(
    cuentaBancariaId: string,
    storagePath: string,
    nombreArchivo: string,
    hojaIndex: number | null = null,
    opciones: { plantillaId?: string | null; forzarIa?: boolean } = {}
  ): Promise<AnalisisExtracto> {
    return firstValueFrom(this.http.post<AnalisisExtracto>(`${this.baseUrl}/extractos/analizar`, {
      cuentaBancariaId,
      storagePath,
      nombreArchivo,
      hojaIndex,
      plantillaId: opciones.plantillaId ?? null,
      forzarIa: opciones.forzarIa ?? false
    }));
  }

  /** Recalcula preview y contadores con el mapeo ajustado a mano; no consume IA. */
  previsualizar(storagePath: string, nombreArchivo: string, mapeo: MapeoExtracto): Promise<AnalisisExtracto> {
    return firstValueFrom(this.http.post<AnalisisExtracto>(`${this.baseUrl}/extractos/previsualizar`, {
      storagePath,
      nombreArchivo,
      mapeo
    }));
  }

  importarExtracto(input: {
    cuentaBancariaId: string;
    storagePath: string;
    nombreArchivo: string;
    mapeo: MapeoExtracto;
    guardarPlantilla: boolean;
    plantillaId?: string | null;
    nombrePlantilla?: string | null;
    saldoInicial?: number | null;
    saldoFinal?: number | null;
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

  /** Vuelve al modo manual: descarta las sugerencias vivas del período. */
  descartarSugerencias(cuentaBancariaId: string, periodo: string): Promise<{ descartadas: number }> {
    return firstValueFrom(this.http.post<{ descartadas: number }>(
      `${this.baseUrl}/conciliacion/sugerencias/descartar`, { cuentaBancariaId, periodo }));
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

  /**
   * Rehace saldos y totales del período y devuelve el resumen. Los saldos son
   * opcionales: si se envían, corrigen el corte que se confirmó al importar.
   */
  recalcularPeriodo(
    cuentaBancariaId: string,
    periodo: string,
    saldos?: { saldoInicial?: number | null; saldoFinal?: number | null }
  ): Promise<ResumenConciliacion> {
    return firstValueFrom(this.http.post<ResumenConciliacion>(`${this.baseUrl}/conciliacion/recalcular`, {
      cuentaBancariaId,
      periodo,
      saldoInicial: saldos?.saldoInicial ?? null,
      saldoFinal: saldos?.saldoFinal ?? null
    }));
  }

  /** Observaciones del contador sobre el período (texto libre). */
  guardarObservaciones(cuentaBancariaId: string, periodo: string, observaciones: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/conciliacion/observaciones`, {
      cuentaBancariaId,
      periodo,
      observaciones
    }));
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

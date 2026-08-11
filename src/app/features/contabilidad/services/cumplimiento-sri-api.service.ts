import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CandidatosPage,
  ComprobanteCandidato,
  ExpedienteDevolucionIva,
  ExportacionRecienteSri,
  ExportacionSri,
  LineaElegible,
  ProyectoInmobiliario,
  ProyectoInmobiliarioInput,
  VistaPreviaDevolucionIva
} from '../models/cumplimiento-sri.models';

@Injectable({ providedIn: 'root' })
export class CumplimientoSriApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/cumplimiento-sri`;
  private readonly refundUrl = `${this.baseUrl}/devolucion-iva-inmobiliarios`;

  listarProyectos(incluirInactivos = false): Promise<ProyectoInmobiliario[]> {
    const params = new HttpParams().set('incluirInactivos', incluirInactivos);
    return firstValueFrom(this.http.get<ProyectoInmobiliario[]>(`${this.baseUrl}/proyectos-inmobiliarios`, { params }));
  }

  crearProyecto(input: ProyectoInmobiliarioInput): Promise<ProyectoInmobiliario> {
    return firstValueFrom(this.http.post<ProyectoInmobiliario>(`${this.baseUrl}/proyectos-inmobiliarios`, input));
  }

  actualizarProyecto(id: string, input: ProyectoInmobiliarioInput): Promise<ProyectoInmobiliario> {
    return firstValueFrom(this.http.put<ProyectoInmobiliario>(`${this.baseUrl}/proyectos-inmobiliarios/${id}`, input));
  }

  desactivarProyecto(id: string): Promise<ProyectoInmobiliario> {
    return firstValueFrom(this.http.delete<ProyectoInmobiliario>(`${this.baseUrl}/proyectos-inmobiliarios/${id}`));
  }

  listarCandidatos(input: { periodo: string; proveedor?: string; sustento?: string; cursor?: string | null; limit?: number }): Promise<CandidatosPage> {
    let params = new HttpParams().set('periodo', input.periodo).set('limit', input.limit ?? 30);
    if (input.proveedor?.trim()) params = params.set('proveedor', input.proveedor.trim());
    if (input.sustento) params = params.set('sustento', input.sustento);
    if (input.cursor) params = params.set('cursor', input.cursor);
    return firstValueFrom(this.http.get<CandidatosPage>(`${this.refundUrl}/candidatos`, { params }));
  }

  obtenerCandidatos(periodo: string, ids: string[]): Promise<ComprobanteCandidato[]> {
    let params = new HttpParams().set('periodo', periodo);
    ids.forEach((id) => { params = params.append('ids', id); });
    return firstValueFrom(this.http.get<ComprobanteCandidato[]>(`${this.refundUrl}/candidatos/seleccionados`, { params }));
  }

  obtenerOCrearExpediente(proyectoId: string, periodo: string): Promise<ExpedienteDevolucionIva> {
    return firstValueFrom(this.http.post<ExpedienteDevolucionIva>(`${this.refundUrl}/expedientes`, { proyectoId, periodo }));
  }

  guardarExpediente(expedienteId: string, revision: number, lineas: LineaElegible[]): Promise<ExpedienteDevolucionIva> {
    return firstValueFrom(this.http.put<ExpedienteDevolucionIva>(`${this.refundUrl}/expedientes/${expedienteId}`, { revision, lineas }));
  }

  previsualizar(expedienteId: string): Promise<VistaPreviaDevolucionIva> {
    return firstValueFrom(this.http.post<VistaPreviaDevolucionIva>(`${this.refundUrl}/expedientes/${expedienteId}/preview`, {}));
  }

  exportar(expedienteId: string): Promise<HttpResponse<Blob>> {
    return firstValueFrom(this.http.post(`${this.refundUrl}/expedientes/${expedienteId}/export`, {}, {
      observe: 'response', responseType: 'blob'
    }));
  }

  historial(expedienteId: string): Promise<ExportacionSri[]> {
    return firstValueFrom(this.http.get<ExportacionSri[]>(`${this.refundUrl}/expedientes/${expedienteId}/exportaciones`));
  }

  exportacionesRecientes(limit = 5): Promise<ExportacionRecienteSri[]> {
    const params = new HttpParams().set('limit', limit);
    return firstValueFrom(this.http.get<ExportacionRecienteSri[]>(`${this.refundUrl}/exportaciones-recientes`, { params }));
  }
}

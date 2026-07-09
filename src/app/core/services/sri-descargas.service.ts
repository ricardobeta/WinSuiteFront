import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  SriConnectionCheck,
  SriDownloadJob,
  SriDownloadRequest,
  SriWorkerConfigRequest,
  SriWorkerRunRequest
} from '../../shared/models/sri.models';

@Injectable({
  providedIn: 'root'
})
export class SriDescargasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/sri`;
  private readonly workerBaseUrl = environment.sriWorkerBaseUrl;

  /**
   * Comprobar conexion: llama al worker local, que a su vez hace healthcheck a
   * Spring (con el token que el interceptor adjunta). ready=true si ambos OK.
   */
  checkConnection(): Observable<SriConnectionCheck> {
    return this.http.get<SriConnectionCheck>(`${this.workerBaseUrl}/health/chain`);
  }

  /** Dispara la descarga en el worker local (el interceptor adjunta el token). */
  runOnWorker(payload: SriWorkerRunRequest): Observable<{ jobId: string; status: string }> {
    return this.http.post<{ jobId: string; status: string }>(`${this.workerBaseUrl}/run`, payload);
  }

  /** Guarda las credenciales SRI SOLO en el worker local (no en el cloud). */
  saveWorkerConfig(payload: SriWorkerConfigRequest): Observable<{ status: string; credencialesConfiguradas: boolean }> {
    return this.http.post<{ status: string; credencialesConfiguradas: boolean }>(`${this.workerBaseUrl}/config`, payload);
  }

  startDownload(payload: SriDownloadRequest): Observable<SriDownloadJob> {
    return this.http.post<SriDownloadJob>(`${this.baseUrl}/descargas`, payload);
  }

  getJob(jobId: string): Observable<SriDownloadJob> {
    return this.http.get<SriDownloadJob>(`${this.baseUrl}/descargas/${jobId}`);
  }

  listJobs(): Observable<SriDownloadJob[]> {
    return this.http.get<SriDownloadJob[]>(`${this.baseUrl}/descargas`);
  }
}

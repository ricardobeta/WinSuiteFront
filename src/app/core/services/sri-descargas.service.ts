import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  SriConfigRequest,
  SriDownloadJob,
  SriDownloadRequest,
  SriScheduleRequest
} from '../../shared/models/sri.models';

@Injectable({
  providedIn: 'root'
})
export class SriDescargasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/sri`;

  saveConfig(payload: SriConfigRequest): Observable<SriDownloadJob> {
    return this.http.post<SriDownloadJob>(`${this.baseUrl}/configuracion`, payload);
  }

  updateSchedule(payload: SriScheduleRequest): Observable<SriDownloadJob> {
    return this.http.patch<SriDownloadJob>(`${this.baseUrl}/configuracion/programacion`, payload);
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

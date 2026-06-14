import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Servicio } from '../models/servicio.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ServiciosService {
  private readonly API_URL = `${environment.apiBaseUrl}/servicios`;

  constructor(private http: HttpClient) {}

  getServicios(): Observable<Servicio[]> {
    return this.http.get<Servicio[]>(this.API_URL);
  }

  getServicioById(id: string): Observable<Servicio> {
    return this.http.get<Servicio>(`${this.API_URL}/${id}`);
  }

  createServicio(servicio: Servicio): Observable<Servicio> {
    return this.http.post<Servicio>(this.API_URL, servicio);
  }

  updateServicio(id: string, servicio: Servicio): Observable<Servicio> {
    return this.http.put<Servicio>(`${this.API_URL}/${id}`, servicio);
  }

  deleteServicio(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}

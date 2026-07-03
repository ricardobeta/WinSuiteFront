import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { FacturaCompraParsed } from '../models/compras.models';

@Injectable({
  providedIn: 'root'
})
export class ComprasXmlService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/compras`;

  /** Envía el storagePath del XML ya subido y devuelve los campos autocompletados. */
  parseXml(storagePath: string): Observable<FacturaCompraParsed> {
    return this.http.post<FacturaCompraParsed>(`${this.baseUrl}/parse-xml`, { storagePath });
  }
}

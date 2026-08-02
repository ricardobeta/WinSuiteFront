import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** La clave del cliente nunca vuelve del backend: solo se sabe si hay una guardada. */
export interface ConectorIaView {
  provider: 'gemini' | 'anthropic';
  model: string | null;
  alcance: 'todas' | 'whatsapp';
  habilitado: boolean;
  tieneClavePropia: boolean;
  updatedAt?: number | null;
}

export interface GuardarConectorIa {
  provider: 'gemini' | 'anthropic';
  model: string | null;
  /** Vacio conserva la clave que ya estaba guardada. */
  apiKey: string;
  alcance: 'todas' | 'whatsapp';
  habilitado: boolean;
}

export interface PruebaConexionIa {
  ok: boolean;
  mensaje: string;
  provider: string;
  usoClavePropia: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiConnectorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/tenants/current/ai-connector`;

  obtener(): Observable<ConectorIaView> {
    return this.http.get<ConectorIaView>(this.base);
  }

  guardar(payload: GuardarConectorIa): Observable<ConectorIaView> {
    return this.http.put<ConectorIaView>(this.base, payload);
  }

  borrarClave(): Observable<ConectorIaView> {
    return this.http.delete<ConectorIaView>(`${this.base}/key`);
  }

  probar(): Observable<PruebaConexionIa> {
    return this.http.post<PruebaConexionIa>(`${this.base}/test`, {});
  }
}

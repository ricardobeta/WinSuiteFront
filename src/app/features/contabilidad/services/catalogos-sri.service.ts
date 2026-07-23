import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CatalogoItem } from '../models/compras.models';

/** Entrada cruda del endpoint de catálogos del backend. */
interface CatalogEntry {
  code: string;
  value: string;
}

/**
 * Carga los catálogos de códigos SRI servidos por el backend (`/api/catalogs/{nombre}`).
 * Cachea cada catálogo por su vida en memoria (`shareReplay`).
 */
@Injectable({
  providedIn: 'root'
})
export class CatalogosSriService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/catalogs`;

  private retencionRenta$?: Observable<CatalogoItem[]>;
  private retencionIva$?: Observable<CatalogoItem[]>;

  /** Códigos de retención en la fuente de renta (código de retención AIR). */
  getRetencionRenta(): Observable<CatalogoItem[]> {
    if (!this.retencionRenta$) {
      this.retencionRenta$ = this.cargar('retencionRenta');
    }
    return this.retencionRenta$;
  }

  /** Códigos de porcentaje de retención de IVA. El % se puede derivar de la descripción. */
  getRetencionIva(): Observable<CatalogoItem[]> {
    if (!this.retencionIva$) {
      this.retencionIva$ = this.cargar('retencionIva');
    }
    return this.retencionIva$;
  }

  /** Extrae el porcentaje de la descripción de un código de retención de IVA (ej. "Retención IVA 30%" -> 30). */
  static porcentajeDesdeDescripcion(descripcion: string | undefined | null): number | null {
    if (!descripcion) {
      return null;
    }
    const match = descripcion.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return match ? Number(match[1].replace(',', '.')) : null;
  }

  private cargar(nombre: string): Observable<CatalogoItem[]> {
    return this.http.get<CatalogEntry[]>(`${this.baseUrl}/${nombre}`).pipe(
      map((entries) => (entries ?? []).map((e) => ({ codigo: e.code, descripcion: e.value }))),
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }
}

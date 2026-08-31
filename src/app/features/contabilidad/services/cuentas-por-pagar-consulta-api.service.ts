import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CarteraCxpResultado,
  DetalleProveedorCxpResultado,
  HistorialCxpResultado,
  TrazabilidadDocumentoCxp,
  TramoCartera
} from '../models/cuentas-por-pagar-consulta.models';
import { EstadoDocumentoPorPagar, OrigenDocumentoPorPagar } from '../models/cuentas-por-pagar.models';

@Injectable({ providedIn: 'root' })
export class CuentasPorPagarConsultaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contabilidad/cuentas-por-pagar`;

  consultarCartera(input: {
    fechaCorte: string;
    proveedorClave?: string | null;
    tramo?: TramoCartera;
    busqueda?: string;
    pagina?: number;
    limite?: number;
  }): Promise<CarteraCxpResultado> {
    return firstValueFrom(this.http.post<CarteraCxpResultado>(`${this.baseUrl}/consulta/cartera`, {
      fechaCorte: input.fechaCorte,
      proveedorClave: input.proveedorClave || null,
      tramo: input.tramo ?? 'TODOS',
      busqueda: input.busqueda?.trim() || null,
      pagina: input.pagina ?? 0,
      limite: input.limite ?? 25
    }));
  }

  consultarProveedor(input: {
    fechaCorte: string;
    proveedorClave: string;
    pagina?: number;
    limite?: number;
  }): Promise<DetalleProveedorCxpResultado> {
    return firstValueFrom(this.http.post<DetalleProveedorCxpResultado>(`${this.baseUrl}/consulta/cartera/proveedor`, {
      fechaCorte: input.fechaCorte,
      proveedorClave: input.proveedorClave,
      pagina: input.pagina ?? 0,
      limite: input.limite ?? 100
    }));
  }

  consultarHistorial(input: {
    fechaDesde: string;
    fechaHasta: string;
    proveedorClave?: string | null;
    estado?: 'TODOS' | EstadoDocumentoPorPagar;
    origen?: 'TODOS' | OrigenDocumentoPorPagar;
    busqueda?: string;
    pagina?: number;
    limite?: number;
  }): Promise<HistorialCxpResultado> {
    return firstValueFrom(this.http.post<HistorialCxpResultado>(`${this.baseUrl}/consulta/documentos`, {
      fechaDesde: input.fechaDesde,
      fechaHasta: input.fechaHasta,
      proveedorClave: input.proveedorClave || null,
      estado: input.estado ?? 'TODOS',
      origen: input.origen ?? 'TODOS',
      busqueda: input.busqueda?.trim() || null,
      pagina: input.pagina ?? 0,
      limite: input.limite ?? 25
    }));
  }

  consultarTrazabilidad(documentoId: string): Promise<TrazabilidadDocumentoCxp> {
    return firstValueFrom(this.http.get<TrazabilidadDocumentoCxp>(
      `${this.baseUrl}/documentos/${encodeURIComponent(documentoId)}/trazabilidad`
    ));
  }
}

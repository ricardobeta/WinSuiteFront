import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Identifica el ConfigToolSet del backend, p. ej. 'inventario.configuracion'. */
export interface ConfigScreenContext {
  route: string;
  module: string;
  page: string;
  screenKey: string;
}

export interface ConfigChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type ConfigActionRiesgo = 'BAJO' | 'MEDIO' | 'ALTO';

export interface ConfigPlanAction {
  id: string;
  tipo: string;
  entidad: string;
  operacion: string;
  resumen: string;
  detalle: string | null;
  payload: Record<string, unknown>;
  riesgo: ConfigActionRiesgo;
  advertencias: string[];
  origen: string;
  dependeDe: string[];
}

export interface ConfigPlanResponse {
  text: string;
  plan: ConfigPlanAction[];
  usedSources: string[];
  avisos: string[];
  planTruncado: boolean;
  iteraciones: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ConfigApprovedAction {
  id: string;
  tipo: string;
  payload: Record<string, unknown>;
  dependeDe: string[];
}

export type ConfigActionEstado = 'APLICADA' | 'OMITIDA' | 'RECHAZADA' | 'ERROR';

export interface ConfigActionOutcome {
  id: string;
  tipo: string;
  estado: ConfigActionEstado;
  mensaje: string;
  recursoId: string | null;
}

export interface ConfigApplyResponse {
  resultados: ConfigActionOutcome[];
  aplicadas: number;
  omitidas: number;
  rechazadas: number;
  fallidas: number;
}

const RIESGOS: ConfigActionRiesgo[] = ['BAJO', 'MEDIO', 'ALTO'];
const ESTADOS: ConfigActionEstado[] = ['APLICADA', 'OMITIDA', 'RECHAZADA', 'ERROR'];

/**
 * Cliente del Copiloto de Configuracion. Es generico a proposito: sirve para cualquier
 * pantalla de ajustes, lo unico que cambia es el screenKey del contexto.
 *
 * Las respuestas se sanean antes de llegar al componente: aunque el backend valida, el
 * contenido lo origina un modelo y la UI no debe romperse por un campo ausente.
 */
@Injectable({ providedIn: 'root' })
export class AiConfigCopilotService {
  private readonly http = inject(HttpClient);
  private readonly baseEndpoint = `${environment.apiBaseUrl}/api/tenants/current/ai/config-copilot`;

  ask(
    message: string,
    context: ConfigScreenContext,
    history: ConfigChatTurn[] = []
  ): Observable<ConfigPlanResponse> {
    return this.http
      .post<ConfigPlanResponse>(`${this.baseEndpoint}/ask`, { message, context, history })
      .pipe(map((response) => this.sanearPlan(response)));
  }

  /**
   * Produce un plan a partir de un documento que el usuario ya subio con el modulo Archivos.
   * Solo viaja el archivoId: los bytes ya estan en Storage y el backend extrae el texto ahi,
   * asi que el documento no se reenvia ni sale del servidor.
   */
  importarDocumento(
    context: ConfigScreenContext,
    archivoId: string
  ): Observable<ConfigPlanResponse> {
    return this.http
      .post<ConfigPlanResponse>(`${this.baseEndpoint}/documento`, { context, archivoId })
      .pipe(map((response) => this.sanearPlan(response)));
  }

  apply(
    context: ConfigScreenContext,
    acciones: ConfigApprovedAction[]
  ): Observable<ConfigApplyResponse> {
    return this.http
      .post<ConfigApplyResponse>(`${this.baseEndpoint}/apply`, { context, acciones })
      .pipe(map((response) => this.sanearResultado(response)));
  }

  private sanearPlan(response: ConfigPlanResponse | null): ConfigPlanResponse {
    return {
      text: response?.text ?? '',
      plan: (response?.plan ?? []).filter((accion) => !!accion?.id && !!accion?.tipo).map((accion) => ({
        ...accion,
        resumen: accion.resumen ?? accion.tipo,
        detalle: accion.detalle ?? null,
        payload: accion.payload ?? {},
        riesgo: RIESGOS.includes(accion.riesgo) ? accion.riesgo : 'MEDIO',
        advertencias: accion.advertencias ?? [],
        dependeDe: accion.dependeDe ?? []
      })),
      usedSources: response?.usedSources ?? [],
      avisos: response?.avisos ?? [],
      planTruncado: response?.planTruncado ?? false,
      iteraciones: response?.iteraciones ?? 0,
      inputTokens: response?.inputTokens ?? 0,
      outputTokens: response?.outputTokens ?? 0
    };
  }

  private sanearResultado(response: ConfigApplyResponse | null): ConfigApplyResponse {
    return {
      resultados: (response?.resultados ?? []).map((resultado) => ({
        ...resultado,
        estado: ESTADOS.includes(resultado.estado) ? resultado.estado : 'ERROR',
        mensaje: resultado.mensaje ?? '',
        recursoId: resultado.recursoId ?? null
      })),
      aplicadas: response?.aplicadas ?? 0,
      omitidas: response?.omitidas ?? 0,
      rechazadas: response?.rechazadas ?? 0,
      fallidas: response?.fallidas ?? 0
    };
  }
}

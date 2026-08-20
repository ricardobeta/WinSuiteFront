import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AiAnswer,
  AiConfigView,
  ConnectionCheck,
  ConversationMessage,
  ConversationSummary,
  FlowDefinition,
  FunnelDefinition,
  FunnelMetrics,
  KnowledgeItem,
  SourceTypeDto,
  WhatsAppCapabilities,
  WhatsAppInstance,
  WhatsAppTemplate
} from '../models/asistente-ventas.models';

@Injectable({
  providedIn: 'root'
})
export class AsistenteVentasApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/tenants/current/whatsapp`;

  /**
   * Lo consultan el shell y la pantalla de instancias, asi que se pide una sola vez por sesion:
   * cambia con la aprobacion de Meta o con el permiso que da el super administrador, no al navegar.
   */
  private readonly capabilitiesSignal = signal<WhatsAppCapabilities | null>(null);
  private capabilitiesPromise: Promise<WhatsAppCapabilities | null> | null = null;

  readonly capabilities = this.capabilitiesSignal.asReadonly();

  async ensureCapabilities(): Promise<WhatsAppCapabilities | null> {
    if (this.capabilitiesSignal()) return this.capabilitiesSignal();
    this.capabilitiesPromise ??= firstValueFrom(
      this.http.get<WhatsAppCapabilities>(`${this.baseUrl}/capabilities`)
    )
      .then((respuesta) => {
        this.capabilitiesSignal.set(respuesta);
        return respuesta;
      })
      .catch(() => {
        // Sin respuesta no se bloquea la pantalla: se deja como estaba y se reintenta luego.
        this.capabilitiesPromise = null;
        return null;
      });
    return this.capabilitiesPromise;
  }

  listInstances(): Observable<WhatsAppInstance[]> {
    return this.http.get<WhatsAppInstance[]>(`${this.baseUrl}/instances`);
  }

  createInstance(payload: { displayName: string }): Observable<WhatsAppInstance> {
    return this.http.post<WhatsAppInstance>(`${this.baseUrl}/instances`, payload);
  }

  startLinkSession(instanceId: string): Observable<{
    instanceId: string;
    loginUrl: string;
    expiresAt: number;
    appId: string;
    configId: string;
    state: string;
    graphApiVersion: string;
  }> {
    return this.http.post<{
      instanceId: string;
      loginUrl: string;
      expiresAt: number;
      appId: string;
      configId: string;
      state: string;
      graphApiVersion: string;
    }>(
      `${this.baseUrl}/instances/${instanceId}/link-session`,
      {}
    );
  }

  completeLinkSession(
    instanceId: string,
    payload: { code: string; state: string; wabaId: string; phoneNumberId: string }
  ): Observable<WhatsAppInstance> {
    return this.http.post<WhatsAppInstance>(
      `${this.baseUrl}/instances/${instanceId}/link-session/complete`,
      payload
    );
  }

  /** Alta o edicion de una conexion cargada a mano (numero de prueba de Meta). */
  saveManualInstance(payload: {
    instanceId?: string | null;
    displayName: string;
    phoneNumberId: string;
    wabaId: string;
    businessAccountId?: string | null;
    accessToken?: string | null;
  }): Observable<WhatsAppInstance> {
    return this.http.post<WhatsAppInstance>(`${this.baseUrl}/instances/manual`, payload);
  }

  updateInstanceToken(instanceId: string, accessToken: string): Observable<WhatsAppInstance> {
    return this.http.put<WhatsAppInstance>(`${this.baseUrl}/instances/${instanceId}/token`, { accessToken });
  }

  checkInstance(instanceId: string): Observable<ConnectionCheck> {
    return this.http.post<ConnectionCheck>(`${this.baseUrl}/instances/${instanceId}/check`, {});
  }

  listTemplates(): Observable<WhatsAppTemplate[]> {
    return this.http.get<WhatsAppTemplate[]>(`${this.baseUrl}/templates`);
  }

  saveTemplate(payload: Partial<WhatsAppTemplate>): Observable<WhatsAppTemplate> {
    return this.http.post<WhatsAppTemplate>(`${this.baseUrl}/templates`, payload);
  }

  submitTemplate(templateId: string): Observable<WhatsAppTemplate> {
    return this.http.post<WhatsAppTemplate>(`${this.baseUrl}/templates/${templateId}/submit`, {});
  }

  listFlows(): Observable<FlowDefinition[]> {
    return this.http.get<FlowDefinition[]>(`${this.baseUrl}/flows`);
  }

  saveFlow(payload: Partial<FlowDefinition>): Observable<FlowDefinition> {
    return this.http.post<FlowDefinition>(`${this.baseUrl}/flows`, payload);
  }

  publishFlow(flowId: string): Observable<FlowDefinition> {
    return this.http.post<FlowDefinition>(`${this.baseUrl}/flows/${flowId}/publish`, {});
  }

  listFunnels(): Observable<FunnelDefinition[]> {
    return this.http.get<FunnelDefinition[]>(`${this.baseUrl}/funnels`);
  }

  saveFunnel(payload: Partial<FunnelDefinition>): Observable<FunnelDefinition> {
    return this.http.post<FunnelDefinition>(`${this.baseUrl}/funnels`, payload);
  }

  getFunnelMetrics(flowId: string): Observable<FunnelMetrics> {
    return this.http.get<FunnelMetrics>(`${this.baseUrl}/funnels/${flowId}/metrics`);
  }

  listMessages(conversationId: string): Observable<ConversationMessage[]> {
    return this.http.get<ConversationMessage[]>(`${this.baseUrl}/conversations/${conversationId}/messages`);
  }

  listConversations(): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${this.baseUrl}/conversations`);
  }

  // ---- IA / Base de conocimiento ----
  private readonly aiUrl = `${this.baseUrl}/ai`;

  getAiConfig(): Observable<AiConfigView> {
    return this.http.get<AiConfigView>(`${this.aiUrl}/config`);
  }

  /** El proveedor y la clave los administra el conector de IA de la empresa. */
  saveAiConfig(payload: { systemPrompt?: string; enabled: boolean }): Observable<AiConfigView> {
    return this.http.put<AiConfigView>(`${this.aiUrl}/config`, payload);
  }

  listKnowledge(): Observable<KnowledgeItem[]> {
    return this.http.get<KnowledgeItem[]>(`${this.aiUrl}/knowledge`);
  }

  indexKnowledge(payload: { source: string; content: string }): Observable<{ chunks: number }> {
    return this.http.post<{ chunks: number }>(`${this.aiUrl}/knowledge`, payload);
  }

  deleteKnowledge(chunkId: string): Observable<void> {
    return this.http.delete<void>(`${this.aiUrl}/knowledge/${chunkId}`);
  }

  clearKnowledge(): Observable<void> {
    return this.http.delete<void>(`${this.aiUrl}/knowledge`);
  }

  getSourceTypes(): Observable<SourceTypeDto[]> {
    return this.http.get<SourceTypeDto[]>(`${this.aiUrl}/source-types`);
  }

  saveSourceTypes(types: SourceTypeDto[]): Observable<SourceTypeDto[]> {
    return this.http.put<SourceTypeDto[]>(`${this.aiUrl}/source-types`, types);
  }

  aiAnswer(payload: { query: string; useRag: boolean }): Observable<AiAnswer> {
    return this.http.post<AiAnswer>(`${this.aiUrl}/answer`, payload);
  }

  sendMessage(payload: {
    instanceId: string;
    conversationId: string;
    toPhone: string;
    type: string;
    body: string;
  }): Observable<ConversationMessage> {
    return this.http.post<ConversationMessage>(`${this.baseUrl}/messages`, payload);
  }
}

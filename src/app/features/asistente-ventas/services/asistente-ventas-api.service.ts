import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ConversationMessage,
  ConversationSummary,
  FlowDefinition,
  FunnelDefinition,
  WhatsAppInstance,
  WhatsAppTemplate
} from '../models/asistente-ventas.models';

@Injectable({
  providedIn: 'root'
})
export class AsistenteVentasApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/tenants/current/whatsapp`;

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

  listMessages(conversationId: string): Observable<ConversationMessage[]> {
    return this.http.get<ConversationMessage[]>(`${this.baseUrl}/conversations/${conversationId}/messages`);
  }

  listConversations(): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${this.baseUrl}/conversations`);
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

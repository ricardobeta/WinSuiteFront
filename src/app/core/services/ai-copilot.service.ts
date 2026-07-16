import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CopilotScreenContext {
  route: string;
  module: string;
  page: string;
}

export interface CopilotNavigationSuggestion {
  label: string;
  route: string;
}

export interface CopilotAnswer {
  text: string;
  usedSources: string[];
  navigation: CopilotNavigationSuggestion[];
  inputTokens: number;
  outputTokens: number;
}

@Injectable({ providedIn: 'root' })
export class AiCopilotService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/tenants/current/ai/copilot/ask`;

  ask(message: string, context: CopilotScreenContext): Observable<CopilotAnswer> {
    return this.http.post<CopilotAnswer>(this.endpoint, { message, context });
  }
}

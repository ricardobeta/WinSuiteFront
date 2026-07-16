import { Component, Input, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  AiCopilotService,
  CopilotNavigationSuggestion,
  CopilotScreenContext
} from '../../../../core/services/ai-copilot.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  navigation?: CopilotNavigationSuggestion[];
}

@Component({
  selector: 'app-global-copilot',
  templateUrl: './global-copilot.component.html',
  styleUrl: './global-copilot.component.scss'
})
export class GlobalCopilotComponent {
  @Input({ required: true }) context!: CopilotScreenContext;

  private readonly copilot = inject(AiCopilotService);
  private readonly router = inject(Router);

  protected readonly isOpen = signal(false);
  protected readonly isSending = signal(false);
  protected readonly draft = signal('');
  protected readonly messages = signal<ChatMessage[]>([]);

  protected toggle(): void {
    this.isOpen.update((value) => !value);
  }

  protected updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected useExample(question: string): void {
    this.draft.set(question);
    this.send();
  }

  protected send(): void {
    const question = this.draft().trim();
    if (!question || this.isSending()) {
      return;
    }
    this.messages.update((items) => [...items, { role: 'user', text: question }]);
    this.draft.set('');
    this.isSending.set(true);

    this.copilot.ask(question, this.context).pipe(
      finalize(() => this.isSending.set(false))
    ).subscribe({
      next: (answer) => this.messages.update((items) => [...items, {
        role: 'assistant',
        text: answer.text,
        sources: answer.usedSources,
        navigation: answer.navigation
      }]),
      error: (error: HttpErrorResponse) => this.messages.update((items) => [...items, {
        role: 'assistant',
        text: error.error?.error ?? 'No pude responder en este momento. Revisa la configuracion de IA e intenta nuevamente.'
      }])
    });
  }

  protected navigate(route: string): void {
    void this.router.navigateByUrl(route);
    this.isOpen.set(false);
  }
}

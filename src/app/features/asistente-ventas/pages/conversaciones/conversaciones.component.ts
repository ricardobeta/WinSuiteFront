import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ConversationMessage, ConversationSummary } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

@Component({
  selector: 'app-conversaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="inbox">
      <aside class="surface-card conversations">
        <div class="header-row">
          <div>
            <p class="eyebrow">Bandeja</p>
            <h2>Conversaciones</h2>
          </div>
          <button type="button" class="ghost" (click)="loadConversations()">Actualizar</button>
        </div>

        <button type="button"
          class="conversation-row"
          *ngFor="let conversation of conversations()"
          [class.active]="selectedConversation()?.conversationId === conversation.conversationId"
          (click)="selectConversation(conversation)">
          <strong>{{ conversation.contactPhone }}</strong>
          <span>{{ conversation.lastDirection }} · {{ conversation.status }}</span>
          <small>{{ conversation.lastMessage }}</small>
        </button>

        <div class="empty" *ngIf="conversations().length === 0">Aun no hay conversaciones guardadas.</div>
      </aside>

      <main class="surface-card thread">
        <ng-container *ngIf="selectedConversation(); else noSelection">
          <div class="thread-header">
            <div>
              <p class="eyebrow">Contacto</p>
              <h2>{{ selectedConversation()?.contactPhone }}</h2>
            </div>
          </div>

          <div class="messages">
            <article *ngFor="let message of messages()" class="message" [class.outbound]="message.direction === 'OUTBOUND'">
              <span>{{ message.direction }}</span>
              <p>{{ renderBody(message) }}</p>
            </article>
          </div>

          <form class="composer" (ngSubmit)="sendManualMessage()">
            <input [(ngModel)]="manualBody" name="manualBody" placeholder="Escribe una respuesta" />
            <button type="submit" [disabled]="!manualBody.trim() || sending()">Enviar</button>
          </form>
        </ng-container>

        <ng-template #noSelection>
          <div class="empty thread-empty">Selecciona una conversacion para ver mensajes.</div>
        </ng-template>
      </main>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .inbox { min-height: 640px; display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 1rem; }
    .conversations, .thread { padding: 1rem; border-radius: 8px; }
    .conversations { display: grid; gap: .65rem; align-content: start; }
    .thread { display: grid; grid-template-rows: auto 1fr auto; gap: 1rem; }
    .header-row, .thread-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    h2, p { margin: 0; }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; color: var(--primary); font-size: .72rem; }
    button { min-height: 38px; border: 0; border-radius: 6px; padding: 0 .75rem; background: var(--primary); color: white; font-weight: 650; cursor: pointer; }
    .ghost { background: transparent; color: inherit; border: 1px solid color-mix(in srgb, var(--outline) 60%, transparent); }
    .conversation-row { display: grid; gap: .25rem; text-align: left; background: transparent; color: inherit; border: 1px solid color-mix(in srgb, var(--outline) 50%, transparent); padding: .7rem; }
    .conversation-row.active { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
    .conversation-row span, .conversation-row small, .empty { color: var(--muted-foreground); }
    .messages { display: flex; flex-direction: column; gap: .6rem; overflow: auto; min-height: 0; }
    .message { max-width: min(680px, 82%); border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: 8px; padding: .65rem .75rem; background: var(--tc-surface-container-lowest); }
    .message.outbound { align-self: flex-end; background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest)); }
    .message span { display: block; margin-bottom: .25rem; font-size: .7rem; color: var(--muted-foreground); }
    .composer { display: grid; grid-template-columns: 1fr auto; gap: .6rem; }
    input { min-height: 42px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--outline) 55%, transparent); padding: 0 .75rem; background: transparent; color: inherit; }
    .thread-empty { align-self: center; justify-self: center; }
    @media (max-width: 920px) { .inbox { grid-template-columns: 1fr; } .thread { min-height: 520px; } }
  `]
})
export class ConversacionesComponent {
  private readonly api = inject(AsistenteVentasApiService);

  protected readonly conversations = signal<ConversationSummary[]>([]);
  protected readonly selectedConversation = signal<ConversationSummary | null>(null);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly sending = signal(false);
  protected manualBody = '';

  constructor() {
    void this.loadConversations();
  }

  protected async loadConversations(): Promise<void> {
    const conversations = await firstValueFrom(this.api.listConversations());
    this.conversations.set(conversations ?? []);
    const selected = this.selectedConversation();
    if (selected) {
      const refreshed = conversations.find((conversation) => conversation.conversationId === selected.conversationId);
      this.selectedConversation.set(refreshed ?? null);
      if (refreshed) await this.loadMessages(refreshed.conversationId);
    }
  }

  protected async selectConversation(conversation: ConversationSummary): Promise<void> {
    this.selectedConversation.set(conversation);
    await this.loadMessages(conversation.conversationId);
  }

  protected async sendManualMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || !this.manualBody.trim()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.api.sendMessage({
        instanceId: conversation.instanceId,
        conversationId: conversation.conversationId,
        toPhone: conversation.contactPhone,
        type: 'TEXT',
        body: this.manualBody.trim()
      }));
      this.manualBody = '';
      await this.loadMessages(conversation.conversationId);
      await this.loadConversations();
    } finally {
      this.sending.set(false);
    }
  }

  protected renderBody(message: ConversationMessage): string {
    if (message.type === 'BUTTONS' || message.type === 'LIST') {
      try {
        const parsed = JSON.parse(message.body);
        const options = (parsed.options ?? []).map((option: { label: string }) => option.label).join(', ');
        return `${parsed.text}${options ? ' · ' + options : ''}`;
      } catch {
        return message.body;
      }
    }
    return message.body;
  }

  private async loadMessages(conversationId: string): Promise<void> {
    this.messages.set((await firstValueFrom(this.api.listMessages(conversationId))) ?? []);
  }
}

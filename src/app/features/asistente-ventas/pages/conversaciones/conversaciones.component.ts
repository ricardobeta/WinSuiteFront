import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, interval } from 'rxjs';

import { ConversationMessage, ConversationSummary } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

@Component({
  selector: 'app-conversaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  template: `
    <section class="inbox" [class.thread-open]="mobileThreadOpen()">
      <aside class="conversations">
        <div class="inbox-head">
          <div><h2>Conversaciones</h2><p>{{ visibleConversations().length }} contactos</p></div>
          <button mat-icon-button type="button" (click)="loadConversations(false)" aria-label="Actualizar conversaciones"><mat-icon>refresh</mat-icon></button>
        </div>
        <label class="search-box"><mat-icon>search</mat-icon><input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Buscar por teléfono o mensaje" /></label>
        <div class="filter-row"><button type="button" [class.active]="statusFilter() === 'ALL'" (click)="statusFilter.set('ALL')">Todas</button><button type="button" [class.active]="statusFilter() === 'ACTIVE'" (click)="statusFilter.set('ACTIVE')">Activas</button><button type="button" [class.active]="statusFilter() === 'UNMATCHED'" (click)="statusFilter.set('UNMATCHED')">Sin flujo</button></div>

        <div class="conversation-list">
          @if (loading() && !conversations().length) { @for (_ of [1,2,3,4,5]; track $index) { <div class="row-skeleton"></div> } }
          @for (conversation of visibleConversations(); track conversation.conversationId) {
            <button type="button" class="conversation-row" [class.active]="selectedConversation()?.conversationId === conversation.conversationId" (click)="selectConversation(conversation)">
              <span class="avatar">{{ conversation.contactPhone.slice(-2) }}</span>
              <span class="conversation-copy"><span><strong>{{ conversation.contactPhone }}</strong><time>{{ conversation.updatedAt | date:'dd/MM · HH:mm' }}</time></span><small>{{ conversation.lastMessage || 'Sin vista previa' }}</small><em>{{ conversation.status }}</em></span>
            </button>
          } @empty {
            @if (!loading()) { <div class="empty"><mat-icon>forum</mat-icon><strong>No hay conversaciones</strong><span>Ajusta los filtros o espera el primer mensaje de un cliente.</span></div> }
          }
        </div>
        <div class="refresh-status"><span [class.live]="documentVisible()"></span>{{ documentVisible() ? 'Actualización automática cada 15 s' : 'Actualización pausada' }}</div>
      </aside>

      <main class="thread">
        @if (selectedConversation(); as selected) {
          <header class="thread-header">
            <button mat-icon-button type="button" class="mobile-back" (click)="mobileThreadOpen.set(false)" aria-label="Volver"><mat-icon>arrow_back</mat-icon></button>
            <span class="avatar large">{{ selected.contactPhone.slice(-2) }}</span>
            <div><h2>{{ selected.contactPhone }}</h2><p>{{ selected.status }} · {{ selected.lastDirection === 'INBOUND' ? 'Cliente escribió' : 'Última respuesta enviada' }}</p></div>
          </header>
          <div #messagesHost class="messages">
            @if (messagesLoading()) { <div class="messages-loading">Cargando conversación…</div> }
            @for (message of messages(); track message.id) {
              <article class="message" [class.outbound]="message.direction === 'OUTBOUND'"><p>{{ renderBody(message) }}</p><span>{{ message.createdAt | date:'HH:mm' }} · {{ message.status }}</span></article>
            }
          </div>
          <form class="composer" (ngSubmit)="sendManualMessage()"><input [(ngModel)]="manualBody" name="manualBody" placeholder="Escribe una respuesta" autocomplete="off" /><button mat-icon-button color="primary" type="submit" [disabled]="!manualBody.trim() || sending()" aria-label="Enviar"><mat-icon>send</mat-icon></button></form>
        } @else {
          <div class="thread-empty"><span><mat-icon>chat_bubble_outline</mat-icon></span><h2>Selecciona una conversación</h2><p>Los mensajes y la respuesta manual aparecerán aquí.</p></div>
        }
      </main>
      @if (errorMessage()) { <div class="inbox-error"><mat-icon>error</mat-icon>{{ errorMessage() }}<button type="button" (click)="loadConversations(false)">Reintentar</button></div> }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .inbox { position: relative; height: calc(100dvh - var(--topbar-height, 72px) - 12rem); min-height: 620px; display: grid; grid-template-columns: minmax(290px, 340px) minmax(0, 1fr); overflow: hidden; border-radius: var(--tc-radius-lg); background: var(--tc-surface-container-lowest); box-shadow: inset 0 0 0 1px var(--tc-ghost-border); }
    .conversations { min-width: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; background: var(--tc-surface-container-low); }
    .inbox-head, .thread-header { padding: .8rem 1rem; display: flex; align-items: center; gap: .65rem; }
    .inbox-head { justify-content: space-between; } h2, p { margin: 0; } h2 { font-family: var(--tc-font-family-heading); font-size: 1.1rem; }
    .inbox-head p, .thread-header p { color: var(--muted-foreground); font-size: .76rem; }
    .search-box { margin: 0 .75rem .55rem; min-height: 44px; padding: 0 .65rem; display: flex; align-items: center; gap: .45rem; border-radius: 12px; background: var(--tc-surface-container-lowest); }
    .search-box mat-icon { color: var(--muted-foreground); font-size: 20px; width: 20px; height: 20px; } .search-box input { min-width: 0; width: 100%; border: 0; outline: 0; color: inherit; background: transparent; }
    .filter-row { padding: 0 .75rem .55rem; display: flex; gap: .3rem; overflow-x: auto; } .filter-row button { min-height: 34px; padding: 0 .65rem; border: 0; border-radius: 999px; color: var(--muted-foreground); background: transparent; cursor: pointer; white-space: nowrap; } .filter-row button.active { color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); font-weight: 700; }
    .conversation-list { min-height: 0; padding: 0 .45rem; overflow: auto; display: grid; align-content: start; gap: .2rem; }
    .conversation-row { min-height: 76px; padding: .55rem; display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: .6rem; border: 0; border-radius: 13px; color: inherit; background: transparent; cursor: pointer; text-align: left; } .conversation-row:hover, .conversation-row.active { background: var(--tc-surface-container-lowest); } .conversation-row.active { box-shadow: 0 8px 20px color-mix(in srgb, var(--tc-on-surface) 7%, transparent); }
    .avatar { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 14px; color: var(--tc-on-primary-container); background: var(--tc-primary-container); font-weight: 800; } .avatar.large { width: 44px; height: 44px; }
    .conversation-copy { min-width: 0; display: grid; gap: .15rem; } .conversation-copy > span { display: flex; justify-content: space-between; gap: .4rem; } .conversation-copy time, .conversation-copy small { color: var(--muted-foreground); font-size: .72rem; } .conversation-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .conversation-copy em { width: fit-content; color: var(--primary); font-size: .62rem; font-style: normal; font-weight: 700; text-transform: lowercase; }
    .refresh-status { min-height: 38px; padding: .5rem .8rem; display: flex; align-items: center; gap: .4rem; color: var(--muted-foreground); font-size: .68rem; } .refresh-status > span { width: 7px; height: 7px; border-radius: 50%; background: var(--muted-foreground); } .refresh-status > span.live { background: var(--tc-success); }
    .thread { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; } .thread-header { min-height: 66px; box-shadow: 0 8px 20px color-mix(in srgb, var(--tc-on-surface) 5%, transparent); }
    .messages { min-height: 0; padding: 1rem clamp(1rem, 4vw, 3rem); overflow: auto; display: flex; flex-direction: column; gap: .55rem; background: color-mix(in srgb, var(--tc-primary-container) 8%, var(--tc-surface)); }
    .message { max-width: min(680px, 80%); padding: .6rem .75rem; align-self: flex-start; border-radius: 14px 14px 14px 4px; background: var(--tc-surface-container-lowest); box-shadow: 0 6px 18px color-mix(in srgb, var(--tc-on-surface) 6%, transparent); } .message.outbound { align-self: flex-end; border-radius: 14px 14px 4px 14px; background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest)); } .message p { white-space: pre-wrap; line-height: 1.45; } .message span { display: block; margin-top: .25rem; color: var(--muted-foreground); font-size: .66rem; text-align: right; }
    .composer { padding: .65rem; display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: .4rem; } .composer input { min-width: 0; min-height: 44px; padding: 0 .8rem; border: 0; border-radius: 13px; outline: 0; color: inherit; background: var(--tc-surface-container-low); }
    .thread-empty, .empty { display: grid; place-items: center; align-content: center; gap: .4rem; color: var(--muted-foreground); text-align: center; } .thread-empty > span { width: 62px; height: 62px; display: grid; place-items: center; border-radius: 20px; color: var(--primary); background: var(--tc-primary-container); } .thread-empty p { max-width: 38ch; }
    .empty { min-height: 220px; padding: 1rem; } .empty mat-icon { width: 36px; height: 36px; font-size: 36px; } .row-skeleton { height: 70px; border-radius: 13px; background: linear-gradient(90deg, var(--tc-surface-container-lowest), var(--tc-surface-container-highest), var(--tc-surface-container-lowest)); background-size: 200% 100%; animation: shimmer 1.4s infinite; } @keyframes shimmer { to { background-position: -200% 0; } }
    .inbox-error { position: absolute; right: 1rem; bottom: 1rem; min-height: 46px; padding: .55rem .75rem; display: flex; align-items: center; gap: .45rem; border-radius: 12px; color: var(--tc-on-error-container); background: var(--tc-error-container); } .inbox-error button { margin-left: .5rem; border: 0; color: inherit; background: transparent; font-weight: 700; cursor: pointer; }
    .mobile-back { display: none; }
    @media (max-width: 760px) { .inbox { height: calc(100dvh - 11rem); min-height: 560px; grid-template-columns: 1fr; } .thread { display: none; position: absolute; inset: 0; z-index: 4; background: var(--tc-surface-container-lowest); } .inbox.thread-open .thread { display: grid; } .mobile-back { display: inline-grid; } .message { max-width: 90%; } }
  `]
})
export class ConversacionesComponent {
  private readonly api = inject(AsistenteVentasApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messagesHost = viewChild<ElementRef<HTMLElement>>('messagesHost');
  protected readonly conversations = signal<ConversationSummary[]>([]);
  protected readonly selectedConversation = signal<ConversationSummary | null>(null);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly sending = signal(false);
  protected readonly loading = signal(false);
  protected readonly messagesLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal('ALL');
  protected readonly mobileThreadOpen = signal(false);
  protected readonly documentVisible = signal(document.visibilityState === 'visible');
  protected manualBody = '';

  protected readonly visibleConversations = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.conversations().filter((item) => (this.statusFilter() === 'ALL' || item.status === this.statusFilter())
      && (!query || `${item.contactPhone} ${item.lastMessage}`.toLowerCase().includes(query)));
  });

  constructor() {
    void this.loadConversations(false);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', this.onVisibilityChange));
    interval(15_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (document.visibilityState === 'visible') void this.loadConversations(true);
    });
  }

  private readonly onVisibilityChange = (): void => this.documentVisible.set(document.visibilityState === 'visible');

  protected async loadConversations(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const conversations = await firstValueFrom(this.api.listConversations());
      this.conversations.set(conversations ?? []);
      const selected = this.selectedConversation();
      if (selected) {
        const refreshed = conversations.find((item) => item.conversationId === selected.conversationId);
        this.selectedConversation.set(refreshed ?? null);
        if (refreshed) await this.loadMessages(refreshed.conversationId, silent);
      }
    } catch {
      if (!silent) this.errorMessage.set('No pudimos actualizar la bandeja.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async selectConversation(conversation: ConversationSummary): Promise<void> {
    this.selectedConversation.set(conversation);
    this.mobileThreadOpen.set(true);
    await this.loadMessages(conversation.conversationId, false);
  }

  protected async sendManualMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || !this.manualBody.trim()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.api.sendMessage({ instanceId: conversation.instanceId, conversationId: conversation.conversationId, toPhone: conversation.contactPhone, type: 'TEXT', body: this.manualBody.trim() }));
      this.manualBody = '';
      await this.loadMessages(conversation.conversationId, true);
      await this.loadConversations(true);
    } finally { this.sending.set(false); }
  }

  protected renderBody(message: ConversationMessage): string {
    if (message.type === 'BUTTONS' || message.type === 'LIST') {
      try { const parsed = JSON.parse(message.body); const options = (parsed.options ?? []).map((option: { label: string }) => option.label).join(', '); return `${parsed.text}${options ? ' · ' + options : ''}`; } catch { return message.body; }
    }
    return message.body;
  }

  private async loadMessages(conversationId: string, silent: boolean): Promise<void> {
    if (!silent) this.messagesLoading.set(true);
    try {
      this.messages.set((await firstValueFrom(this.api.listMessages(conversationId))) ?? []);
      setTimeout(() => { const host = this.messagesHost()?.nativeElement; if (host) host.scrollTop = host.scrollHeight; });
    } finally { this.messagesLoading.set(false); }
  }
}

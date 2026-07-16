import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-public-copilot-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="heading"><span><mat-icon>auto_awesome</mat-icon></span><div><p>Asistente WinSuite</p><h2 mat-dialog-title>Te ayudo a comenzar</h2></div><button mat-icon-button mat-dialog-close aria-label="Cerrar"><mat-icon>close</mat-icon></button></div>
    <mat-dialog-content>
      <div class="privacy"><mat-icon>shield</mat-icon><span>Este asistente solo usa informacion publica de WinSuite. No puede ver datos de empresas.</span></div>
      <div class="messages" aria-live="polite">
        <div class="assistant">Hola. Puedo explicarte que es WinSuite, como crear tu cuenta o como funciona el acceso con Google.</div>
        @for (message of messages(); track $index) {<div [class]="message.role">{{ message.text }}</div>}
        @if (loading()) {<div class="assistant typing"><mat-spinner diameter="18" /> Buscando una respuesta...</div>}
      </div>
      @if (messages().length === 0) {<div class="suggestions">@for (prompt of prompts; track prompt) {<button mat-stroked-button type="button" (click)="ask(prompt)">{{ prompt }}</button>}</div>}
      <form (ngSubmit)="ask(question.value)"><mat-form-field appearance="outline"><mat-label>Escribe tu pregunta</mat-label><textarea matInput [formControl]="question" rows="2" maxlength="1000"></textarea><button mat-icon-button matSuffix type="submit" [disabled]="question.invalid || loading()"><mat-icon>send</mat-icon></button></mat-form-field></form>
    </mat-dialog-content>
  `,
  styles: [`
    :host { display: block; width: min(620px, 92vw); } .heading { display: grid; grid-template-columns: auto 1fr auto; gap: .75rem; align-items: center; padding: 1rem 1.25rem 0; }
    .heading > span { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); } .heading p, h2 { margin: 0; } .heading p { color: var(--primary); font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; }
    mat-dialog-content { display: grid; gap: .85rem; } .privacy { display: flex; gap: .5rem; padding: .65rem .75rem; border-radius: 10px; background: var(--tc-surface-container-low); color: var(--muted-foreground); font-size: .78rem; }
    .messages { display: flex; flex-direction: column; gap: .6rem; max-height: 340px; overflow: auto; } .assistant, .user { max-width: 88%; padding: .7rem .85rem; border-radius: 14px; white-space: pre-wrap; line-height: 1.45; } .assistant { align-self: flex-start; background: var(--tc-surface-container-low); } .user { align-self: flex-end; background: var(--primary); color: var(--primary-foreground); } .typing { display: flex; align-items: center; gap: .5rem; }
    .suggestions { display: flex; flex-wrap: wrap; gap: .5rem; } form, mat-form-field { width: 100%; } textarea { resize: none; }
  `]
})
export class PublicCopilotDialogComponent {
  private readonly http = inject(HttpClient);
  protected readonly question = new FormControl('', { nonNullable: true, validators: Validators.required });
  protected readonly messages = signal<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  protected readonly loading = signal(false);
  protected readonly prompts = ['Que es WinSuite?', 'Como me registro con Google?', 'Puedo manejar varias empresas?'];

  protected ask(text: string): void {
    const value = text.trim(); if (!value || this.loading()) return;
    this.messages.update(items => [...items, { role: 'user', text: value }]); this.question.setValue(''); this.loading.set(true);
    this.http.post<{ text: string }>(`${environment.apiBaseUrl}/api/public/copilot/ask`, { message: value }).subscribe({
      next: answer => { this.messages.update(items => [...items, { role: 'assistant', text: answer.text }]); this.loading.set(false); },
      error: () => { this.messages.update(items => [...items, { role: 'assistant', text: 'No pude responder ahora. Puedes continuar con el registro y pedir ayuda mas tarde.' }]); this.loading.set(false); }
    });
  }
}

import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-dashboard-widget-shell',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <article class="widget-shell" [class.editing]="editing()">
      <header class="widget-header">
        @if (editing()) {
          <button
            type="button"
            class="drag-handle dashboard-drag-handle"
            matTooltip="Arrastrar"
            aria-label="Arrastrar widget"
          >
            <mat-icon>drag_indicator</mat-icon>
          </button>
        }

        <div class="title-group">
          <span class="material-symbols-outlined widget-icon">{{ icon() }}</span>
          <div>
            <h3>{{ title() }}</h3>
            <p>{{ subtitle() }}</p>
          </div>
        </div>

        @if (editing()) {
          <div class="widget-actions">
            <button class="no-drag" mat-icon-button type="button" matTooltip="Duplicar" (click)="duplicate.emit()">
              <mat-icon>content_copy</mat-icon>
            </button>
            <button class="no-drag" mat-icon-button color="warn" type="button" matTooltip="Quitar" (click)="remove.emit()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      </header>

      <div class="widget-body">
        @if (emptyMessage()) {
          <div class="empty-state">
            <span class="material-symbols-outlined">query_stats</span>
            <p>{{ emptyMessage() }}</p>
          </div>
        } @else {
          <ng-content />
        }
      </div>
    </article>
  `,
  styles: [`
    .widget-shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: .75rem;
      padding: .95rem;
      border: 1px solid color-mix(in srgb, var(--primary) 13%, var(--border));
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-lowest);
      box-shadow: 0 10px 22px rgb(0 0 0 / 9%);
      overflow: hidden;
    }

    .widget-shell.editing {
      border-color: color-mix(in srgb, var(--primary) 48%, var(--border));
      outline: 2px dashed color-mix(in srgb, var(--primary) 42%, transparent);
      outline-offset: -5px;
      box-shadow: 0 12px 28px color-mix(in srgb, var(--primary) 14%, transparent);
    }

    .widget-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: flex-start;
      gap: .75rem;
      min-width: 0;
    }

    .drag-handle {
      width: 32px;
      height: 32px;
      border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
      border-radius: var(--radius-md);
      display: grid;
      place-items: center;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest));
      cursor: grab;
      padding: 0;
      flex: 0 0 auto;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .title-group {
      display: flex;
      align-items: flex-start;
      gap: .65rem;
      min-width: 0;
    }

    .widget-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      display: grid;
      place-items: center;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 13%, var(--tc-surface-container-lowest));
      font-size: 20px;
      flex: 0 0 auto;
    }

    h3 {
      margin: 0;
      font-size: .98rem;
      line-height: 1.2;
    }

    p {
      margin: .2rem 0 0;
      color: var(--muted-foreground);
      font-size: .8rem;
      line-height: 1.3;
    }

    .widget-actions {
      display: flex;
      align-items: center;
      gap: .2rem;
      flex: 0 0 auto;
    }

    .widget-header:not(:has(.drag-handle)) {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .widget-body {
      min-height: 0;
      overflow: hidden;
    }

    .empty-state {
      height: 100%;
      min-height: 120px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: .35rem;
      color: var(--muted-foreground);
      text-align: center;
    }

    .empty-state .material-symbols-outlined {
      font-size: 34px;
      color: var(--primary);
    }

    :host-context(html.theme-dark) .widget-shell {
      border-color: color-mix(in srgb, var(--primary) 18%, #2a3437);
      background: #151b1e;
      box-shadow: 0 16px 30px rgb(0 0 0 / 30%);
    }

    :host-context(html.theme-dark) .widget-shell.editing {
      border-color: color-mix(in srgb, var(--primary) 52%, #2a3437);
      box-shadow: 0 16px 36px color-mix(in srgb, var(--primary) 18%, transparent);
    }
  `]
})
export class DashboardWidgetShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly icon = input.required<string>();
  readonly editing = input(false);
  readonly emptyMessage = input<string | null | undefined>(null);

  readonly remove = output<void>();
  readonly duplicate = output<void>();
}

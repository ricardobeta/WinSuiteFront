import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DashboardWidgetDefinition, DashboardWidgetId } from '../../models/dashboard.models';

export interface DashboardWidgetPickerData {
  widgets: DashboardWidgetDefinition[];
}

@Component({
  selector: 'app-dashboard-widget-picker',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Agregar metrica</h2>
    <mat-dialog-content>
      <div class="widget-list">
        @for (widget of data.widgets; track widget.id) {
          <button type="button" class="widget-option" (click)="select(widget.id)">
            <span class="material-symbols-outlined">{{ widget.icon }}</span>
            <span>
              <strong>{{ widget.title }}</strong>
              <small>{{ widget.subtitle }}</small>
            </span>
            <mat-icon>add</mat-icon>
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .widget-list {
      display: grid;
      gap: .55rem;
      min-width: min(560px, 78vw);
      max-height: min(520px, 70vh);
      overflow: auto;
    }

    .widget-option {
      border: 1px solid color-mix(in srgb, var(--outline, var(--border)) 50%, transparent);
      background: var(--card);
      color: var(--foreground);
      border-radius: var(--radius-md);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: .75rem;
      padding: .75rem;
      text-align: left;
      cursor: pointer;
    }

    .widget-option:hover {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, var(--card));
    }

    .material-symbols-outlined {
      color: var(--primary);
    }

    strong,
    small {
      display: block;
    }

    small {
      margin-top: .2rem;
      color: var(--muted-foreground);
    }
  `]
})
export class DashboardWidgetPickerComponent {
  protected readonly data = inject<DashboardWidgetPickerData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DashboardWidgetPickerComponent, DashboardWidgetId>);

  protected select(widgetId: DashboardWidgetId): void {
    this.dialogRef.close(widgetId);
  }
}

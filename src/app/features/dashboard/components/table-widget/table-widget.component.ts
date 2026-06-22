import { Component, input } from '@angular/core';

import { DashboardTableRow } from '../../models/dashboard.models';

@Component({
  selector: 'app-table-widget',
  standalone: true,
  template: `
    <div class="table-widget">
      @for (row of rows(); track row.label) {
        <div class="row" [class]="row.tone ?? 'neutral'">
          <div>
            <strong>{{ row.label }}</strong>
            @if (row.helper) {
              <small>{{ row.helper }}</small>
            }
          </div>
          <span>{{ row.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .table-widget {
      height: 100%;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: .45rem;
      padding-right: .15rem;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      padding: .55rem .65rem;
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-low);
    }

    strong,
    span {
      font-size: .86rem;
      line-height: 1.25;
    }

    small {
      display: block;
      margin-top: .15rem;
      color: var(--muted-foreground);
      font-size: .76rem;
    }

    span {
      font-weight: 800;
      white-space: nowrap;
    }

    .warning span {
      color: var(--warning);
    }

    .danger span {
      color: var(--destructive);
    }
  `]
})
export class TableWidgetComponent {
  readonly rows = input<DashboardTableRow[]>([]);
}

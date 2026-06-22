import { Component, input } from '@angular/core';

import { DashboardMetricValue } from '../../models/dashboard.models';

@Component({
  selector: 'app-metric-card-widget',
  standalone: true,
  template: `
    <div class="metric-card" [class]="value()?.tone ?? 'neutral'">
      <strong>{{ value()?.value ?? '-' }}</strong>
      @if (value()?.label) {
        <span>{{ value()?.label }}</span>
      }
      @if (value()?.helper) {
        <p>{{ value()?.helper }}</p>
      }
      @if (value()?.trend) {
        <small>{{ value()?.trend }}</small>
      }
    </div>
  `,
  styles: [`
    .metric-card {
      height: 100%;
      display: grid;
      align-content: end;
      gap: .35rem;
      min-height: 92px;
    }

    strong {
      font-size: clamp(1.55rem, 2.4vw, 2.2rem);
      line-height: 1.05;
      overflow-wrap: anywhere;
    }

    span,
    p,
    small {
      color: var(--muted-foreground);
    }

    p {
      margin: 0;
      font-size: .82rem;
      line-height: 1.35;
    }

    small {
      font-size: .78rem;
      font-weight: 700;
    }

    .good small,
    .good strong {
      color: var(--primary);
    }

    .warning strong {
      color: var(--warning);
    }

    .danger strong {
      color: var(--destructive);
    }
  `]
})
export class MetricCardWidgetComponent {
  readonly value = input<DashboardMetricValue | null | undefined>(null);
}

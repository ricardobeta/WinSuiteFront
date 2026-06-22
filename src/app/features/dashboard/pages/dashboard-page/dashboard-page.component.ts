import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Gridster, GridsterConfig, GridsterItem as GridsterItemComponent, GridsterItemConfig } from 'angular-gridster2';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { environment } from '../../../../../environments/environment';
import { DASHBOARD_WIDGETS, findWidgetDefinition } from '../../config/dashboard-defaults';
import { ChartWidgetComponent } from '../../components/chart-widget/chart-widget.component';
import { DashboardEditToolbarComponent } from '../../components/dashboard-edit-toolbar/dashboard-edit-toolbar.component';
import { DashboardWidgetPickerComponent } from '../../components/dashboard-widget-picker/dashboard-widget-picker.component';
import { DashboardWidgetShellComponent } from '../../components/dashboard-widget-shell/dashboard-widget-shell.component';
import { MetricCardWidgetComponent } from '../../components/metric-card-widget/metric-card-widget.component';
import { TableWidgetComponent } from '../../components/table-widget/table-widget.component';
import { DashboardConfigService } from '../../services/dashboard-config.service';
import { DashboardMetricsService } from '../../services/dashboard-metrics.service';
import { DashboardDataMap, DashboardLayoutItem, DashboardWidgetData, DashboardWidgetDefinition, DashboardWidgetId } from '../../models/dashboard.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    Gridster,
    GridsterItemComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    ChartWidgetComponent,
    DashboardEditToolbarComponent,
    DashboardWidgetShellComponent,
    MetricCardWidgetComponent,
    TableWidgetComponent
  ],
  template: `
    <section class="dashboard-page">
      <header class="dashboard-header">
        <div class="dashboard-title-group">
          <div class="dashboard-kicker">
            <span class="material-symbols-outlined">space_dashboard</span>
            <span>Inicio operativo</span>
          </div>
          <h1>Dashboard</h1>
          <p>Metricas operativas del negocio en tiempo real.</p>
          <div class="dashboard-chips">
            <span>
              <span class="material-symbols-outlined">widgets</span>
              {{ visibleItems().length }} widgets
            </span>
            <span>
              <span class="material-symbols-outlined">sync</span>
              Tiempo real
            </span>
            @if (editing()) {
              <span class="editing-chip">
                <span class="material-symbols-outlined">drag_indicator</span>
                Modo edicion
              </span>
            }
          </div>
        </div>

        <div class="dashboard-actions">
          @if (editing()) {
            <p class="edit-hint">Usa el icono de arrastre de cada widget para moverlo.</p>
          }
          <app-dashboard-edit-toolbar
            [editing]="editing()"
            (edit)="startEditing()"
            (add)="openWidgetPicker()"
            (reset)="resetLayout()"
            (publish)="publishTenantDefault()"
            (cancel)="cancelEditing()"
            (save)="saveLayout()"
          />
        </div>
      </header>

      @if (loading()) {
        <section class="loading-card surface-card">
          <span class="material-symbols-outlined">dashboard</span>
          <p>Cargando dashboard...</p>
        </section>
      } @else {
        <gridster [options]="gridOptions()" class="dashboard-grid" [class.editing]="editing()">
          @for (item of visibleItems(); track item.instanceId) {
            <gridster-item [item]="item">
              @if (definitionFor(item.widgetId); as definition) {
                <app-dashboard-widget-shell
                  [title]="definition.title"
                  [subtitle]="definition.subtitle"
                  [icon]="definition.icon"
                  [editing]="editing()"
                  [emptyMessage]="dataFor(definition.id)?.emptyMessage"
                  (remove)="removeWidget(item.instanceId)"
                  (duplicate)="duplicateWidget(item)"
                >
                  @switch (definition.kind) {
                    @case ('metric') {
                      <app-metric-card-widget [value]="dataFor(definition.id)?.metric" />
                    }
                    @case ('chart') {
                      <app-chart-widget [options]="dataFor(definition.id)?.chartOptions ?? {}" />
                    }
                    @case ('table') {
                      <app-table-widget [rows]="dataFor(definition.id)?.rows ?? []" />
                    }
                  }
                </app-dashboard-widget-shell>
              }
            </gridster-item>
          }
        </gridster>
      }

      <button
        mat-fab
        color="primary"
        type="button"
        class="help-fab"
        matTooltip="Contactar ayuda"
        aria-label="Contactar ayuda por WhatsApp"
        (click)="openHelp()"
      >
        <mat-icon>support_agent</mat-icon>
      </button>
    </section>
  `,
  styles: [`
    .dashboard-page {
      position: relative;
      min-height: calc(100dvh - var(--topbar-height) - 48px);
      display: grid;
      gap: 1rem;
      margin: calc(var(--space-6) * -1);
      padding: var(--space-6);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--primary) 6%, transparent), transparent 260px),
        var(--tc-surface-container-low);
    }

    .dashboard-header {
      position: relative;
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.1rem;
      border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
      border-radius: var(--radius-md);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), transparent 46%),
        var(--tc-surface-container-lowest);
      box-shadow: 0 12px 28px rgb(0 0 0 / 10%);
    }

    .dashboard-title-group {
      min-width: 0;
      display: grid;
      align-content: center;
      gap: .35rem;
    }

    .dashboard-kicker,
    .dashboard-chips,
    .dashboard-chips span {
      display: inline-flex;
      align-items: center;
    }

    .dashboard-kicker {
      gap: .35rem;
      color: var(--primary);
      font-size: .78rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .dashboard-kicker .material-symbols-outlined {
      font-size: 18px;
      letter-spacing: 0;
    }

    .dashboard-header h1 {
      margin: 0;
      font-size: clamp(1.7rem, 2.8vw, 2.35rem);
      line-height: 1.1;
    }

    .dashboard-header p {
      margin: .3rem 0 0;
      color: var(--muted-foreground);
    }

    .dashboard-chips {
      gap: .5rem;
      flex-wrap: wrap;
      margin-top: .35rem;
    }

    .dashboard-chips > span {
      gap: .3rem;
      min-height: 28px;
      padding: .28rem .55rem;
      border-radius: 999px;
      color: var(--muted-foreground);
      background: var(--tc-surface-container-low);
      font-size: .78rem;
      font-weight: 700;
      line-height: 1;
    }

    .dashboard-chips .material-symbols-outlined {
      font-size: 17px;
    }

    .dashboard-chips .editing-chip {
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, var(--card));
    }

    .dashboard-actions {
      display: grid;
      align-content: center;
      justify-items: end;
      gap: .55rem;
      min-width: min(520px, 48vw);
    }

    .edit-hint {
      margin: 0;
      color: var(--primary);
      font-size: .82rem;
      font-weight: 700;
      text-align: right;
    }

    .dashboard-grid {
      min-height: 720px;
      background: transparent;
    }

    gridster-item {
      background: transparent !important;
      overflow: visible;
      border-radius: var(--radius-md);
    }

    .dashboard-grid.editing gridster-item {
      cursor: grab;
    }

    .dashboard-grid.editing {
      padding: .35rem;
      border: 1px dashed color-mix(in srgb, var(--primary) 38%, transparent);
      border-radius: var(--radius-md);
      background:
        linear-gradient(color-mix(in srgb, var(--primary) 5%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--primary) 5%, transparent) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    .loading-card {
      min-height: 360px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: .5rem;
      color: var(--muted-foreground);
    }

    .loading-card .material-symbols-outlined {
      font-size: 40px;
      color: var(--primary);
    }

    .help-fab {
      position: fixed;
      right: 1.35rem;
      bottom: 1.35rem;
      z-index: 40;
      box-shadow: 0 14px 34px rgb(0 0 0 / 22%);
    }

    @media (max-width: 900px) {
      .dashboard-header {
        align-items: stretch;
        flex-direction: column;
      }

      .dashboard-actions {
        justify-items: stretch;
        min-width: 0;
      }

      .edit-hint {
        text-align: left;
      }

      .dashboard-grid {
        min-height: 980px;
      }
    }

    :host-context(html.theme-dark) .dashboard-page {
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 260px),
        #0d1113;
    }

    :host-context(html.theme-dark) .dashboard-header {
      border-color: color-mix(in srgb, var(--primary) 24%, #263238);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent), transparent 46%),
        #151b1e;
      box-shadow: 0 18px 38px rgb(0 0 0 / 34%);
    }
  `]
})
export class DashboardPageComponent {
  private readonly configService = inject(DashboardConfigService);
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly authorization = inject(AuthorizationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly items = signal<DashboardLayoutItem[]>([]);
  private readonly snapshotBeforeEdit = signal<DashboardLayoutItem[]>([]);
  protected readonly widgetData = toSignal(this.metricsService.getDashboardData(), { initialValue: {} as DashboardDataMap });

  protected readonly availableWidgets = computed(() =>
    DASHBOARD_WIDGETS.filter((widget) => this.canUseWidget(widget))
  );

  protected readonly visibleItems = computed(() =>
    this.items().filter((item) => {
      const definition = findWidgetDefinition(item.widgetId);
      return !!definition && this.canUseWidget(definition);
    })
  );

  protected readonly gridOptions = signal<GridsterConfig>({
    gridType: 'scrollVertical',
    compactType: 'compactUp',
    margin: 12,
    outerMargin: false,
    minCols: 12,
    maxCols: 12,
    minRows: 8,
    mobileBreakpoint: 760,
    displayGrid: 'onDrag&Resize',
    pushItems: true,
    draggable: {
      enabled: false,
      dragHandleClass: 'dashboard-drag-handle',
      ignoreContentClass: 'no-drag',
      ignoreContent: true
    },
    resizable: {
      enabled: false,
      handles: {
        s: true,
        e: true,
        n: true,
        w: true,
        se: true,
        ne: true,
        sw: true,
        nw: true
      }
    },
    itemChangeCallback: (item) => this.syncGridItem(item)
  });

  constructor() {
    void this.loadLayout();
  }

  protected definitionFor(widgetId: DashboardWidgetId): DashboardWidgetDefinition | undefined {
    return findWidgetDefinition(widgetId);
  }

  protected dataFor(widgetId: DashboardWidgetId): DashboardWidgetData | undefined {
    return this.widgetData()[widgetId];
  }

  protected startEditing(): void {
    this.snapshotBeforeEdit.set(this.cloneItems(this.items()));
    this.editing.set(true);
    this.setGridEditing(true);
  }

  protected cancelEditing(): void {
    this.items.set(this.cloneItems(this.snapshotBeforeEdit()));
    this.editing.set(false);
    this.setGridEditing(false);
  }

  protected async saveLayout(): Promise<void> {
    await this.configService.saveUserLayout(this.visibleItems());
    this.editing.set(false);
    this.setGridEditing(false);
    this.showSuccess('Dashboard personal guardado.', 'save');
  }

  protected async publishTenantDefault(): Promise<void> {
    await this.configService.publishTenantDefault(this.visibleItems());
    this.showSuccess('Dashboard base del negocio actualizado.', 'business');
  }

  protected async resetLayout(): Promise<void> {
    const layout = await this.configService.resetUserLayout();
    this.items.set(this.cloneItems(layout.items));
    this.showSuccess('Se restablecio el dashboard.', 'restart_alt');
  }

  protected openWidgetPicker(): void {
    const dialogRef = this.dialog.open(DashboardWidgetPickerComponent, {
      width: '680px',
      maxWidth: '94vw',
      data: {
        widgets: this.availableWidgets()
      }
    });

    dialogRef.afterClosed().subscribe((widgetId?: DashboardWidgetId) => {
      if (!widgetId) {
        return;
      }
      this.addWidget(widgetId);
    });
  }

  protected removeWidget(instanceId: string): void {
    this.items.update((items) => items.filter((item) => item.instanceId !== instanceId));
  }

  protected duplicateWidget(item: DashboardLayoutItem): void {
    const copy = {
      ...item,
      instanceId: `${item.widgetId}-${Date.now()}`,
      x: 0,
      y: this.nextRow()
    };
    this.items.update((items) => [...items, copy]);
  }

  protected openHelp(): void {
    const phone = environment.support?.whatsappPhone?.replace(/[^\d]/g, '') ?? '';
    if (!phone) {
      this.showSuccess('Configura environment.support.whatsappPhone para activar WhatsApp.', 'support_agent');
      return;
    }

    const user = this.auth.currentUser();
    const template = environment.support?.whatsappMessage || 'Hola, necesito ayuda con Winsuite.';
    const message = [
      template,
      '',
      `Usuario: ${user?.displayName || user?.email || 'Usuario Winsuite'}`,
      `Tenant: ${this.auth.tenantId() ?? 'sin tenant'}`,
      `Ruta: ${this.router.url}`
    ].join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  private async loadLayout(): Promise<void> {
    try {
      const layout = await this.configService.getResolvedLayout();
      this.items.set(this.cloneItems(layout.items));
    } finally {
      this.loading.set(false);
    }
  }

  private addWidget(widgetId: DashboardWidgetId): void {
    const definition = findWidgetDefinition(widgetId);
    if (!definition) {
      return;
    }

    this.items.update((items) => [
      ...items,
      {
        instanceId: `${widgetId}-${Date.now()}`,
        widgetId,
        x: 0,
        y: this.nextRow(),
        cols: definition.defaultCols,
        rows: definition.defaultRows
      }
    ]);
  }

  private canUseWidget(widget: DashboardWidgetDefinition): boolean {
    return !widget.moduleKey || this.authorization.canAccess(widget.moduleKey, 'read');
  }

  private syncGridItem(item: GridsterItemConfig): void {
    const changed = item as DashboardLayoutItem;
    this.items.update((items) =>
      items.map((current) => current.instanceId === changed.instanceId ? { ...current, ...changed } : current)
    );
  }

  private setGridEditing(enabled: boolean): void {
    this.gridOptions.update((options) => ({
      ...options,
      displayGrid: enabled ? 'always' : 'onDrag&Resize',
      draggable: {
        ...(options.draggable ?? {}),
        enabled,
        ignoreContent: true,
        dragHandleClass: 'dashboard-drag-handle',
        ignoreContentClass: 'no-drag'
      },
      resizable: {
        ...(options.resizable ?? {}),
        enabled
      }
    }));
    this.gridOptions()['api']?.optionsChanged?.();
  }

  private nextRow(): number {
    return this.items().reduce((max, item) => Math.max(max, Number(item.y ?? 0) + Number(item.rows ?? 1)), 0);
  }

  private cloneItems(items: DashboardLayoutItem[]): DashboardLayoutItem[] {
    return items.map((item) => ({ ...item }));
  }

  private showSuccess(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

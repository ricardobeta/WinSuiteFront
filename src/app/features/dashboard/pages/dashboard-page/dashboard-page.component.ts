import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Gridster, GridsterConfig, GridsterItem as GridsterItemComponent, GridsterItemConfig } from 'angular-gridster2';
import { firstValueFrom, map } from 'rxjs';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';
import { ChartWidgetComponent } from '../../components/chart-widget/chart-widget.component';
import { DashboardEditToolbarComponent } from '../../components/dashboard-edit-toolbar/dashboard-edit-toolbar.component';
import { DashboardWidgetPickerComponent } from '../../components/dashboard-widget-picker/dashboard-widget-picker.component';
import { DashboardWidgetShellComponent } from '../../components/dashboard-widget-shell/dashboard-widget-shell.component';
import { MetricCardWidgetComponent } from '../../components/metric-card-widget/metric-card-widget.component';
import { TableWidgetComponent } from '../../components/table-widget/table-widget.component';
import { DASHBOARD_WIDGETS, findWidgetDefinition, normalizeDashboardLayoutItem } from '../../config/dashboard-defaults';
import {
  DashboardLayoutItem,
  DashboardMobileSection,
  DashboardSnapshot,
  DashboardWidgetData,
  DashboardWidgetDefinition,
  DashboardWidgetId
} from '../../models/dashboard.models';
import { DashboardConfigService } from '../../services/dashboard-config.service';
import { DashboardMetricsService } from '../../services/dashboard-metrics.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Gridster,
    GridsterItemComponent,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    ChartWidgetComponent,
    DashboardEditToolbarComponent,
    DashboardWidgetShellComponent,
    MetricCardWidgetComponent,
    TableWidgetComponent,
    TourTriggerButtonComponent
  ],
  template: `
    <section class="dashboard-page" [class.editing-page]="editing()">
      <header class="dashboard-header" id="tour-dashboard-header">
        <div class="dashboard-heading">
          <div class="title-line">
            <span class="heading-icon material-symbols-outlined" aria-hidden="true">space_dashboard</span>
            <div>
              <p class="eyebrow">Dashboard</p>
              <h1>Resumen del negocio</h1>
            </div>
            <app-tour-trigger-button (open)="startTourManually()" />
          </div>

          <div class="snapshot-status" aria-live="polite">
            @if (refreshing()) {
              <span class="status-dot refreshing"></span>
              Actualizando indicadores…
            } @else if (snapshot(); as currentSnapshot) {
              <span class="status-dot" [class.stale]="dataError()"></span>
              {{ dataError() ? 'Datos sin actualizar' : 'Actualizado' }} {{ formatUpdatedAt(currentSnapshot.updatedAt) }}
            } @else {
              <span class="status-dot stale"></span>
              Sin datos disponibles
            }

            @if (editing()) {
              <span class="widget-count">{{ visibleItems().length }} widgets</span>
            }
          </div>
        </div>

        <div class="header-actions">
          <button
            mat-icon-button
            type="button"
            class="refresh-button"
            matTooltip="Actualizar indicadores"
            aria-label="Actualizar indicadores"
            [disabled]="refreshing() || loading() || auth.bootstrapState() === 'error'"
            (click)="refreshDashboard()"
          >
            <mat-icon [class.spin]="refreshing()">refresh</mat-icon>
          </button>

          <app-dashboard-edit-toolbar
            [editing]="editing()"
            [canPublish]="canPublishBase()"
            (edit)="startEditing()"
            (add)="openWidgetPicker()"
            (reset)="confirmResetLayout()"
            (publish)="confirmPublishTenantDefault()"
            (cancel)="cancelEditing()"
            (save)="saveLayout()"
          />
        </div>
      </header>

      @if (refreshing()) {
        <mat-progress-bar class="refresh-progress" mode="indeterminate" aria-label="Actualizando dashboard" />
      }

      @if (auth.bootstrapState() === 'error') {
        <section class="state-card error-state" role="alert">
          <span class="state-icon material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <div>
            <h2>No pudimos preparar tu espacio de trabajo</h2>
            <p>{{ auth.bootstrapError() || 'No fue posible cargar la empresa, los permisos y los módulos de esta sesión.' }}</p>
          </div>
          <div class="state-actions">
            <button mat-raised-button color="primary" type="button" [disabled]="retryingBootstrap()" (click)="retryBootstrap()">
              <mat-icon>refresh</mat-icon>
              {{ retryingBootstrap() ? 'Reintentando…' : 'Reintentar' }}
            </button>
            <button mat-button type="button" (click)="returnToLogin()">Volver a iniciar sesión</button>
          </div>
        </section>
      } @else if (loading()) {
        <section class="state-card loading-state" aria-live="polite">
          <span class="state-icon material-symbols-outlined" aria-hidden="true">dashboard</span>
          <div>
            <h2>Preparando tu resumen</h2>
            <p>Estamos cargando los indicadores y la configuración del dashboard.</p>
          </div>
        </section>
      } @else {
        @if (dataError()) {
          <section class="inline-alert" [class.stale-alert]="snapshot()" role="status">
            <mat-icon>{{ snapshot() ? 'schedule' : 'error_outline' }}</mat-icon>
            <p>
              <strong>{{ snapshot() ? 'Mostramos la última información disponible.' : 'No pudimos cargar los indicadores.' }}</strong>
              {{ dataError() }}
            </p>
            <button mat-button type="button" [disabled]="refreshing()" (click)="refreshDashboard()">Reintentar</button>
          </section>
        }

        @if (!visibleItems().length) {
          <section class="state-card empty-dashboard">
            <span class="state-icon material-symbols-outlined" aria-hidden="true">space_dashboard</span>
            <div>
              <h2>Tu dashboard aún no tiene widgets</h2>
              <p>Agrega los indicadores que necesitas para seguir el estado del negocio.</p>
            </div>
            <button mat-raised-button color="primary" type="button" (click)="startEditing(); openWidgetPicker()">
              <mat-icon>add</mat-icon>
              Agregar widget
            </button>
          </section>
        } @else if (!isMobile()) {
          <gridster [options]="gridOptions()" id="tour-dashboard-grid" class="dashboard-grid" [class.editing]="editing()">
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
                    <ng-container
                      [ngTemplateOutlet]="widgetContent"
                      [ngTemplateOutletContext]="{ definition: definition }"
                    />
                  </app-dashboard-widget-shell>
                }
              </gridster-item>
            }
          </gridster>
        } @else {
          <div id="tour-dashboard-grid" class="mobile-dashboard">
            <section aria-labelledby="mobile-summary-title">
              <div class="section-heading">
                <div>
                  <p class="section-kicker">Hoy</p>
                  <h2 id="mobile-summary-title">Indicadores clave</h2>
                </div>
              </div>

              <div class="mobile-kpi-grid">
                @for (item of mobileSummaryItems(); track item.instanceId) {
                  @if (definitionFor(item.widgetId); as definition) {
                    <article class="mobile-kpi">
                      <header>
                        <span class="material-symbols-outlined" aria-hidden="true">{{ definition.icon }}</span>
                        <h3>{{ definition.title }}</h3>
                      </header>
                      <app-metric-card-widget [value]="dataFor(definition.id)?.metric" />
                    </article>
                  }
                }
              </div>
            </section>

            @if (mobileAlertItems().length) {
              <section aria-labelledby="mobile-alert-title">
                <div class="section-heading">
                  <div>
                    <p class="section-kicker">Atención</p>
                    <h2 id="mobile-alert-title">Alertas operativas</h2>
                  </div>
                </div>

                <div class="mobile-stack">
                  @for (item of mobileAlertItems(); track item.instanceId) {
                    @if (definitionFor(item.widgetId); as definition) {
                      <app-dashboard-widget-shell
                        [title]="definition.title"
                        [subtitle]="definition.subtitle"
                        [icon]="definition.icon"
                        [editing]="false"
                        [emptyMessage]="dataFor(definition.id)?.emptyMessage"
                      >
                        <ng-container
                          [ngTemplateOutlet]="widgetContent"
                          [ngTemplateOutletContext]="{ definition: definition }"
                        />
                      </app-dashboard-widget-shell>
                    }
                  }
                </div>
              </section>
            }

            @if (mobileAnalysisItems().length) {
              <mat-accordion class="more-indicators">
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>monitoring</mat-icon>
                      Más indicadores
                    </mat-panel-title>
                    <mat-panel-description>{{ mobileAnalysisItems().length }} disponibles</mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="mobile-stack analysis-stack">
                    @for (item of mobileAnalysisItems(); track item.instanceId) {
                      @if (definitionFor(item.widgetId); as definition) {
                        <app-dashboard-widget-shell
                          [title]="definition.title"
                          [subtitle]="definition.subtitle"
                          [icon]="definition.icon"
                          [editing]="false"
                          [emptyMessage]="dataFor(definition.id)?.emptyMessage"
                        >
                          <ng-container
                            [ngTemplateOutlet]="widgetContent"
                            [ngTemplateOutletContext]="{ definition: definition }"
                          />
                        </app-dashboard-widget-shell>
                      }
                    }
                  </div>
                </mat-expansion-panel>
              </mat-accordion>
            }
          </div>
        }
      }
    </section>

    <ng-template #widgetContent let-definition="definition">
      <div class="widget-content" [class.table-content]="definition.kind === 'table'">
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

        @if (definition.actionRoute && definition.actionLabel) {
          <a mat-button color="primary" class="widget-action" [routerLink]="definition.actionRoute">
            {{ definition.actionLabel }}
            <mat-icon>arrow_forward</mat-icon>
          </a>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .dashboard-page {
      min-height: calc(100dvh - var(--topbar-height) - 48px);
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
      gap: 1rem;
      margin: calc(var(--space-6) * -1);
      padding: var(--space-6);
      background: var(--tc-surface-container-low);
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 92px;
      padding: 1rem 1.15rem;
      border: 1px solid color-mix(in srgb, var(--primary) 14%, var(--border));
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-lowest);
      box-shadow: 0 8px 20px rgb(0 0 0 / 7%);
    }

    .dashboard-heading,
    .dashboard-heading > div,
    .title-line,
    .snapshot-status,
    .header-actions,
    .state-actions {
      min-width: 0;
    }

    .dashboard-heading {
      display: grid;
      gap: .45rem;
    }

    .title-line,
    .snapshot-status,
    .header-actions,
    .state-actions,
    .mobile-kpi header,
    .mat-mdc-card-title {
      display: flex;
      align-items: center;
    }

    .title-line {
      gap: .7rem;
    }

    .heading-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border-radius: var(--radius-md);
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
    }

    .eyebrow,
    .section-kicker {
      margin: 0;
      color: var(--primary);
      font-size: .72rem;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    h1 {
      margin: .12rem 0 0;
      font-size: clamp(1.35rem, 2.2vw, 1.85rem);
      line-height: 1.1;
    }

    .snapshot-status {
      gap: .4rem;
      color: var(--muted-foreground);
      font-size: .8rem;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent);
    }

    .status-dot.stale {
      background: var(--warning);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--warning) 14%, transparent);
    }

    .status-dot.refreshing {
      animation: pulse 1.2s ease-in-out infinite;
    }

    .widget-count {
      margin-left: .3rem;
      padding-left: .7rem;
      border-left: 1px solid var(--border);
      color: var(--primary);
    }

    .header-actions {
      display: flex;
      justify-content: flex-end;
      gap: .65rem;
    }

    .refresh-button {
      width: 44px;
      height: 44px;
      flex: 0 0 auto;
    }

    .refresh-progress {
      margin-top: -.65rem;
      border-radius: 999px;
      overflow: hidden;
    }

    .spin {
      animation: spin .8s linear infinite;
    }

    .dashboard-grid {
      width: 100% !important;
      min-width: 0;
      min-height: max(760px, calc(100dvh - var(--topbar-height) - 156px));
      overflow: visible !important;
      background: transparent;
    }

    gridster-item {
      overflow: visible;
      border-radius: var(--radius-md);
      background: transparent !important;
    }

    .dashboard-grid.editing {
      padding: .35rem;
      border: 1px dashed color-mix(in srgb, var(--primary) 38%, transparent);
      border-radius: var(--radius-md);
    }

    .dashboard-grid.editing gridster-item {
      cursor: grab;
    }

    .widget-content {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: grid;
    }

    .table-content {
      grid-template-rows: minmax(0, 1fr) auto;
      gap: .3rem;
    }

    .widget-action {
      width: fit-content;
      min-height: 40px;
      justify-self: end;
    }

    .state-card {
      min-height: 320px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: .8rem;
      padding: 2rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-lowest);
      text-align: center;
    }

    .state-card h2,
    .section-heading h2 {
      margin: 0;
    }

    .state-card p {
      max-width: 580px;
      margin: .35rem 0 0;
      color: var(--muted-foreground);
      line-height: 1.55;
    }

    .state-icon {
      font-size: 44px;
      color: var(--primary);
    }

    .error-state .state-icon {
      color: var(--destructive);
    }

    .state-actions {
      display: flex;
      justify-content: center;
      gap: .5rem;
      flex-wrap: wrap;
    }

    .state-actions button,
    .empty-dashboard button {
      min-height: 44px;
    }

    .inline-alert {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: .7rem;
      padding: .7rem .85rem;
      border: 1px solid color-mix(in srgb, var(--destructive) 28%, var(--border));
      border-radius: var(--radius-md);
      color: var(--destructive);
      background: color-mix(in srgb, var(--destructive) 7%, var(--tc-surface-container-lowest));
    }

    .inline-alert.stale-alert {
      border-color: color-mix(in srgb, var(--warning) 38%, var(--border));
      color: var(--foreground);
      background: color-mix(in srgb, var(--warning) 9%, var(--tc-surface-container-lowest));
    }

    .inline-alert p {
      margin: 0;
      color: inherit;
      font-size: .86rem;
    }

    .inline-alert strong {
      margin-right: .25rem;
    }

    .mobile-dashboard {
      display: grid;
      gap: 1rem;
    }

    .section-heading {
      margin-bottom: .65rem;
    }

    .section-heading h2 {
      margin-top: .12rem;
      font-size: 1.1rem;
    }

    .mobile-kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: .65rem;
    }

    .mobile-kpi {
      min-width: 0;
      min-height: 172px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: .65rem;
      padding: .85rem;
      border: 1px solid color-mix(in srgb, var(--primary) 12%, var(--border));
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-lowest);
      box-shadow: 0 6px 16px rgb(0 0 0 / 6%);
      overflow: hidden;
    }

    .mobile-kpi header {
      gap: .4rem;
      min-width: 0;
      color: var(--primary);
    }

    .mobile-kpi header .material-symbols-outlined {
      font-size: 20px;
    }

    .mobile-kpi h3 {
      min-width: 0;
      margin: 0;
      color: var(--foreground);
      font-size: .82rem;
      line-height: 1.25;
    }

    .mobile-stack,
    .analysis-stack {
      display: grid;
      gap: .75rem;
    }

    .mobile-stack app-dashboard-widget-shell {
      display: block;
      min-height: 300px;
    }

    .analysis-stack app-dashboard-widget-shell {
      min-height: 320px;
    }

    .more-indicators mat-panel-title {
      gap: .45rem;
      font-weight: 750;
    }

    .more-indicators mat-panel-description {
      justify-content: flex-end;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      50% { opacity: .35; transform: scale(.82); }
    }

    @media (max-width: 900px) {
      .dashboard-header {
        align-items: stretch;
        flex-direction: column;
      }

      .header-actions {
        justify-content: space-between;
      }
    }

    @media (max-width: 759px) {
      .dashboard-page {
        min-height: calc(100dvh - var(--topbar-height));
        gap: .75rem;
        margin: calc(var(--space-4) * -1);
        padding: var(--space-4);
      }

      .dashboard-page.editing-page {
        padding-bottom: 5.25rem;
      }

      .dashboard-header {
        align-items: center;
        flex-direction: row;
        min-height: auto;
        padding: .75rem;
      }

      .heading-icon,
      .title-line app-tour-trigger-button {
        display: none;
      }

      .header-actions {
        align-items: center;
        flex: 0 0 auto;
      }

      .header-actions app-dashboard-edit-toolbar {
        flex: 0 0 auto;
      }

      .inline-alert {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .inline-alert button {
        grid-column: 2;
        justify-self: start;
      }

      .state-card {
        min-height: 280px;
        padding: 1.25rem;
      }
    }

    @media (max-width: 390px) {
      .mobile-kpi-grid {
        gap: .5rem;
      }

      .mobile-kpi {
        min-height: 180px;
        padding: .7rem;
      }
    }

    :host-context(html.theme-dark) .dashboard-page {
      background: #0d1113;
    }

    :host-context(html.theme-dark) .dashboard-header,
    :host-context(html.theme-dark) .state-card,
    :host-context(html.theme-dark) .mobile-kpi {
      background: #151b1e;
    }

    @media (prefers-reduced-motion: reduce) {
      .spin,
      .status-dot.refreshing {
        animation: none;
      }
    }
  `]
})
export class DashboardPageComponent {
  private readonly configService = inject(DashboardConfigService);
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly authorization = inject(AuthorizationService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly retryingBootstrap = signal(false);
  protected readonly dataError = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly items = signal<DashboardLayoutItem[]>([]);
  protected readonly snapshot = signal<DashboardSnapshot | null>(null);
  private readonly snapshotBeforeEdit = signal<DashboardLayoutItem[]>([]);

  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 759px)').pipe(map((state) => state.matches)),
    { initialValue: typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches }
  );

  protected readonly availableWidgets = computed(() =>
    DASHBOARD_WIDGETS.filter((widget) => this.canUseWidget(widget))
  );

  protected readonly visibleItems = computed(() =>
    this.items().filter((item) => {
      const definition = findWidgetDefinition(item.widgetId);
      return !!definition && this.canUseWidget(definition);
    })
  );

  protected readonly mobileSummaryItems = computed(() =>
    this.itemsForMobileSection('summary').slice(0, 4)
  );

  protected readonly mobileAlertItems = computed(() =>
    this.itemsForMobileSection('alert')
  );

  protected readonly mobileAnalysisItems = computed(() => {
    const remainingSummary = this.itemsForMobileSection('summary').slice(4);
    return [...remainingSummary, ...this.itemsForMobileSection('analysis')];
  });

  protected readonly canPublishBase = computed(() =>
    this.authorization.canAccess('empresa_modulos', 'update')
  );

  protected readonly gridOptions = signal<GridsterConfig>({
    gridType: 'verticalFixed',
    fixedRowHeight: 70,
    setGridSize: true,
    compactType: 'compactUp',
    margin: 12,
    outerMargin: false,
    minCols: 12,
    maxCols: 12,
    minRows: 10,
    mobileBreakpoint: 0,
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
      handles: { s: true, e: true, n: true, w: true, se: true, ne: true, sw: true, nw: true }
    },
    itemChangeCallback: (item) => this.syncGridItem(item)
  });

  constructor() {
    void this.initializeDashboard();
  }

  protected definitionFor(widgetId: DashboardWidgetId): DashboardWidgetDefinition | undefined {
    return findWidgetDefinition(widgetId);
  }

  protected dataFor(widgetId: DashboardWidgetId): DashboardWidgetData | undefined {
    return this.snapshot()?.data[widgetId];
  }

  protected formatUpdatedAt(timestamp: number): string {
    return new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
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
    try {
      await this.configService.saveUserLayout(this.visibleItems());
      this.editing.set(false);
      this.setGridEditing(false);
      this.showSuccess('Dashboard personal guardado.', 'save');
    } catch {
      this.showError('No pudimos guardar la personalización. Inténtalo nuevamente.');
    }
  }

  protected async confirmPublishTenantDefault(): Promise<void> {
    const confirmed = await this.confirm({
      title: 'Publicar dashboard como base',
      message: 'Este diseño se convertirá en la base para las personas de la empresa. Sus diseños personales no se modificarán.',
      confirmText: 'Publicar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.configService.publishTenantDefault(this.visibleItems());
      this.showSuccess('Dashboard base del negocio actualizado.', 'business');
    } catch {
      this.showError('No pudimos publicar el dashboard base.');
    }
  }

  protected async confirmResetLayout(): Promise<void> {
    const confirmed = await this.confirm({
      title: 'Restablecer dashboard',
      message: 'Se descartará tu diseño personal y volverás a la configuración base del negocio.',
      confirmText: 'Restablecer',
      cancelText: 'Conservar diseño'
    });
    if (!confirmed) {
      return;
    }

    try {
      const layout = await this.configService.resetUserLayout();
      this.items.set(this.cloneItems(layout.items));
      this.snapshotBeforeEdit.set(this.cloneItems(layout.items));
      this.showSuccess('Dashboard restablecido.', 'restart_alt');
    } catch {
      this.showError('No pudimos restablecer el dashboard.');
    }
  }

  protected openWidgetPicker(): void {
    const dialogRef = this.dialog.open(DashboardWidgetPickerComponent, {
      width: '680px',
      maxWidth: '94vw',
      data: { widgets: this.availableWidgets() }
    });

    dialogRef.afterClosed().subscribe((widgetId?: DashboardWidgetId) => {
      if (widgetId) {
        this.addWidget(widgetId);
      }
    });
  }

  protected removeWidget(instanceId: string): void {
    this.items.update((items) => items.filter((item) => item.instanceId !== instanceId));
  }

  protected duplicateWidget(item: DashboardLayoutItem): void {
    const definition = findWidgetDefinition(item.widgetId);
    const copy: DashboardLayoutItem = {
      ...item,
      instanceId: `${item.widgetId}-${Date.now()}`,
      x: 0,
      y: this.nextRow(),
      rows: Math.max(Number(item.rows ?? 1), definition?.minRows ?? 1),
      minItemRows: definition?.minRows
    };
    this.items.update((items) => [...items, copy]);
  }

  protected async refreshDashboard(): Promise<void> {
    if (this.refreshing()) {
      return;
    }

    this.refreshing.set(true);
    try {
      const nextSnapshot = await firstValueFrom(this.metricsService.getDashboardSnapshot());
      this.snapshot.set(nextSnapshot);
      this.dataError.set(null);
    } catch {
      this.dataError.set('La actualización no se completó. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      this.refreshing.set(false);
    }
  }

  protected async retryBootstrap(): Promise<void> {
    if (this.retryingBootstrap()) {
      return;
    }

    this.retryingBootstrap.set(true);
    try {
      await this.auth.retryBootstrap();
      await this.initializeDashboard();
    } catch {
      // AuthService mantiene el mensaje contextual para el siguiente intento.
    } finally {
      this.retryingBootstrap.set(false);
    }
  }

  protected async returnToLogin(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  protected startTourManually(): void {
    void loadTourSteps('dashboard').then((steps) => this.guidedTour.startTour('dashboard', steps));
  }

  private async initializeDashboard(): Promise<void> {
    if (this.auth.bootstrapState() === 'error') {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.dataError.set(null);

    const [layoutResult, metricsResult] = await Promise.allSettled([
      this.configService.getResolvedLayout(),
      firstValueFrom(this.metricsService.getDashboardSnapshot())
    ]);

    if (layoutResult.status === 'fulfilled') {
      this.items.set(this.cloneItems(layoutResult.value.items));
    } else {
      this.dataError.set('No pudimos cargar la configuración del dashboard.');
    }

    if (metricsResult.status === 'fulfilled') {
      this.snapshot.set(metricsResult.value);
    } else {
      this.dataError.set('No pudimos cargar los indicadores. Reintenta cuando tu conexión esté disponible.');
    }

    this.loading.set(false);
    if (layoutResult.status === 'fulfilled') {
      this.maybeStartTour();
    }
  }

  private maybeStartTour(): void {
    if (this.guidedTour.hasSeenTour('dashboard')) {
      return;
    }

    afterNextRender(
      () => {
        void loadTourSteps('dashboard').then((steps) => this.guidedTour.startTour('dashboard', steps));
      },
      { injector: this.injector }
    );
  }

  private addWidget(widgetId: DashboardWidgetId): void {
    const definition = findWidgetDefinition(widgetId);
    if (!definition) {
      return;
    }

    this.items.update((items) => [
      ...items,
      normalizeDashboardLayoutItem({
        instanceId: `${widgetId}-${Date.now()}`,
        widgetId,
        x: 0,
        y: this.nextRow(),
        cols: definition.defaultCols,
        rows: definition.defaultRows,
        minItemRows: definition.minRows
      })
    ]);
  }

  private itemsForMobileSection(section: DashboardMobileSection): DashboardLayoutItem[] {
    return this.visibleItems()
      .filter((item) => findWidgetDefinition(item.widgetId)?.mobileSection === section)
      .sort((left, right) => {
        const leftOrder = findWidgetDefinition(left.widgetId)?.mobileOrder ?? 99;
        const rightOrder = findWidgetDefinition(right.widgetId)?.mobileOrder ?? 99;
        return leftOrder - rightOrder;
      });
  }

  private canUseWidget(widget: DashboardWidgetDefinition): boolean {
    return !widget.moduleKey || this.authorization.canAccess(widget.moduleKey, 'read');
  }

  private syncGridItem(item: GridsterItemConfig): void {
    const changed = item as DashboardLayoutItem;
    const definition = findWidgetDefinition(changed.widgetId);
    this.items.update((items) =>
      items.map((current) => current.instanceId === changed.instanceId
        ? {
            ...current,
            ...changed,
            rows: Math.max(Number(changed.rows ?? 1), definition?.minRows ?? 1),
            minItemRows: definition?.minRows
          }
        : current)
    );
  }

  private setGridEditing(enabled: boolean): void {
    this.gridOptions.update((options) => ({
      ...options,
      displayGrid: enabled ? 'onDrag&Resize' : 'none',
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

  private async confirm(data: ConfirmDialogData): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      data
    });
    return firstValueFrom(dialogRef.afterClosed(), { defaultValue: false });
  }

  private showSuccess(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

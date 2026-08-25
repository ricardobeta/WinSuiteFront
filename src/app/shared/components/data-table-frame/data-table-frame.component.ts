import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { ResolvedTableView, TableColumnDefinition } from '../../models/table-preferences.models';
import { isOperationalTableRegistered } from '../../config/operational-tables.registry';
import {
  TableColumnPickerDialogComponent,
  TableColumnPickerDialogData
} from '../table-column-picker-dialog/table-column-picker-dialog.component';
import { DataTableFramePaginatorIntl } from './data-table-frame-paginator-intl';

@Component({
  selector: 'app-data-table-frame',
  providers: [
    DataTableFramePaginatorIntl,
    { provide: MatPaginatorIntl, useExisting: DataTableFramePaginatorIntl }
  ],
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <section class="data-table-frame">
      <div class="data-table-toolbar">
        @if (showSearch) {
          <mat-form-field appearance="outline" class="data-table-search" subscriptSizing="dynamic">
            <mat-label>{{ searchPlaceholder }}</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input
              matInput
              type="search"
              [value]="searchValue"
              [attr.aria-label]="searchPlaceholder"
              (input)="onSearchInput($event)"
            />
          </mat-form-field>
        }
        <div class="data-table-tools">
          <div class="data-table-filters"><ng-content select="[table-filters]" /></div>
        </div>
      </div>

      @if (horizontalOverflow()) {
        <p class="data-table-scroll-hint">
          <mat-icon aria-hidden="true">swipe</mat-icon>
          Desliza horizontalmente para ver más columnas
        </p>
      }

      <div
        class="data-table-surface"
        [class.can-scroll-backward]="canScrollBackward()"
        [class.can-scroll-forward]="canScrollForward()"
      >
        @if (preferencesEnabled()) {
          <div class="table-surface-tools">
            <button
              mat-icon-button
              type="button"
              class="columns-menu-button"
              [matTooltip]="sourceTooltip()"
              aria-label="Configurar columnas de la tabla"
              (click)="openColumnPicker()"
            >
              <mat-icon>more_vert</mat-icon>
              @if (view().source !== 'default') {
                <span class="view-dot" aria-hidden="true"></span>
              }
            </button>
          </div>
        }
        <div
          #tableViewport
          class="data-table-viewport"
          tabindex="0"
          aria-label="Tabla desplazable horizontalmente"
          (scroll)="onViewportScroll()"
        >
          <ng-content />
        </div>
      </div>

      @if (showPaginator) {
        <mat-paginator
          [length]="total"
          [pageIndex]="pageIndex"
          [pageSize]="pageSize"
          [pageSizeOptions]="pageSizeOptions"
          [showFirstLastButtons]="showFirstLastButtons"
          (page)="pageChange.emit($event)"
        />
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; max-width: 100%; }
    .data-table-frame { min-width: 0; max-width: 100%; display: grid; gap: .75rem; }
    .data-table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
    .data-table-search { flex: 1 1 280px; max-width: 440px; }
    .data-table-tools { min-width: 0; margin-inline-start: auto; display: flex; align-items: center; justify-content: flex-end; gap: .65rem; flex-wrap: wrap; }
    .data-table-filters { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: .65rem; flex-wrap: wrap; }
    .data-table-filters:empty { display: none; }
    .data-table-toolbar:not(:has(.data-table-search)):has(.data-table-filters:empty) { display: none; }
    .data-table-surface {
      position: relative;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      border-radius: var(--tc-radius-md);
      background: var(--tc-surface-container-lowest);
      isolation: isolate;
    }
    .data-table-surface::before,
    .data-table-surface::after {
      position: absolute;
      inset-block: 44px 0;
      z-index: 3;
      width: 18px;
      pointer-events: none;
      content: '';
      opacity: 0;
      transition: opacity .16s ease;
    }
    .data-table-surface::before { inset-inline-start: 0; background: linear-gradient(90deg, rgb(0 0 0 / 13%), transparent); }
    .data-table-surface::after { inset-inline-end: 0; background: linear-gradient(-90deg, rgb(0 0 0 / 13%), transparent); }
    .data-table-surface.can-scroll-backward::before,
    .data-table-surface.can-scroll-forward::after { opacity: 1; }
    .data-table-scroll-hint {
      display: none;
      align-items: center;
      gap: .4rem;
      margin: 0;
      color: var(--muted-foreground);
      font-size: .8rem;
      font-weight: 650;
    }
    .data-table-scroll-hint mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .table-surface-tools {
      display: flex;
      min-height: 44px;
      align-items: center;
      justify-content: flex-end;
      padding-inline: .25rem;
      border-bottom: 1px solid var(--tc-ghost-border);
      background: var(--tc-surface-container-low);
    }
    .columns-menu-button {
      position: relative;
      flex: 0 0 auto;
      color: var(--muted-foreground);
    }
    .columns-menu-button:hover { color: var(--foreground); }
    .view-dot { position: absolute; inset-block-start: 7px; inset-inline-end: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 2px var(--tc-surface-container-low); }
    .data-table-viewport {
      display: block;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      overflow-x: auto;
      touch-action: pan-x pan-y;
      overscroll-behavior-inline: contain;
      scrollbar-gutter: stable;
      background: var(--tc-surface-container-lowest);
    }
    .data-table-viewport:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 30%, transparent); outline-offset: 2px; }
    mat-paginator { border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    @media (max-width: 720px) {
      .data-table-toolbar { align-items: stretch; }
      .data-table-search { max-width: none; flex-basis: 100%; }
      .data-table-tools { width: 100%; justify-content: space-between; margin-inline-start: 0; }
      .data-table-filters { justify-content: flex-start; }
      .data-table-scroll-hint { display: inline-flex; }
      .table-surface-tools { min-height: 40px; }
      mat-paginator { max-width: 100%; overflow-x: auto; }
    }
    @media (prefers-reduced-motion: reduce) {
      .data-table-surface::before, .data-table-surface::after { transition: none; }
    }
  `]
})
export class DataTableFrameComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('tableViewport') private tableViewport?: ElementRef<HTMLElement>;
  @Input() searchPlaceholder = 'Buscar';
  @Input() searchValue = '';
  @Input() showSearch = true;
  @Input() showPaginator = true;
  @Input() total = 0;
  @Input() pageIndex = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: readonly number[] = [10, 25, 50];
  /** Las tablas paginadas por cursor lo apagan: no conocen la ultima pagina. */
  @Input() showFirstLastButtons = true;
  /** Sustituye la etiqueta de rango cuando `total` es una cota y no el total real. */
  @Input() rangeLabel: ((pageIndex: number, pageSize: number, length: number) => string) | null = null;
  @Input() tableModule = '';
  @Input() tableId = '';
  @Input() columns: readonly TableColumnDefinition[] = [];
  @Input() lockedColumnIds: readonly string[] = ['acciones', 'actions', 'seleccion', 'selection'];

  @Output() readonly searchChange = new EventEmitter<string>();
  @Output() readonly pageChange = new EventEmitter<PageEvent>();
  @Output() readonly visibleColumnsChange = new EventEmitter<readonly string[]>();

  protected readonly view = signal<ResolvedTableView>({
    visibleColumnIds: [],
    source: 'default',
    updatedAt: null,
    updatedBy: null
  });
  protected readonly preferencesEnabled = signal(false);
  protected readonly horizontalOverflow = signal(false);
  protected readonly canScrollBackward = signal(false);
  protected readonly canScrollForward = signal(false);

  private readonly catalog = signal<readonly TableColumnDefinition[]>([]);
  private readonly searchInput = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogs = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly preferences = inject(TablePreferencesService);
  private readonly paginatorIntl = inject(DataTableFramePaginatorIntl);
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewInitialized = false;
  private loadedKey = '';
  private loadSequence = 0;

  constructor() {
    this.searchInput
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchChange.emit(value));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // El paginador es OnPush y solo relee la etiqueta cuando `intl.changes` emite.
    if (changes['rangeLabel'] || changes['total'] || changes['pageIndex'] || changes['pageSize']) {
      this.paginatorIntl.rangeLabelFn = this.rangeLabel;
      this.paginatorIntl.changes.next();
    }
    if (changes['columns'] || changes['lockedColumnIds']) {
      this.setCatalog(this.columns.length > 0 ? this.normalizeColumns(this.columns) : []);
    }
    if (this.viewInitialized && (changes['tableModule'] || changes['tableId'] || changes['columns'])) {
      queueMicrotask(() => void this.initializePreferences());
    }
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.observer = new MutationObserver(() => {
      if (this.columns.length === 0) this.refreshDiscoveredColumns();
      this.applyColumnVisibility();
      queueMicrotask(() => this.updateOverflowState());
    });
    this.observer.observe(this.elementRef.nativeElement, { childList: true, subtree: true });
    queueMicrotask(() => {
      if (this.columns.length === 0) this.refreshDiscoveredColumns();
      void this.initializePreferences();
      this.setupOverflowObserver();
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
  }

  protected onViewportScroll(): void {
    this.updateOverflowState();
  }

  private setupOverflowObserver(): void {
    const viewport = this.tableViewport?.nativeElement;
    if (!viewport) return;
    this.updateOverflowState();
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.updateOverflowState());
    this.resizeObserver.observe(viewport);
    const content = viewport.firstElementChild;
    if (content instanceof HTMLElement) this.resizeObserver.observe(content);
  }

  private updateOverflowState(): void {
    const viewport = this.tableViewport?.nativeElement;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const overflow = maxScroll > 2;
    this.horizontalOverflow.set(overflow);
    this.canScrollBackward.set(overflow && viewport.scrollLeft > 2);
    this.canScrollForward.set(overflow && viewport.scrollLeft < maxScroll - 2);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue = value;
    this.searchInput.next(value);
  }

  protected openColumnPicker(): void {
    const catalog = this.catalog();
    if (!this.preferencesEnabled() || catalog.length === 0) return;

    this.dialogs.open<TableColumnPickerDialogComponent, TableColumnPickerDialogData, ResolvedTableView>(
      TableColumnPickerDialogComponent,
      {
        width: '560px',
        maxWidth: 'calc(100vw - 1rem)',
        autoFocus: 'input',
        data: {
          moduleId: this.tableModule,
          tableId: this.tableId,
          columns: catalog,
          view: this.view(),
          canPublishCompany: (this.auth.currentProfile()?.role ?? '').toUpperCase() === 'ADMIN'
        }
      }
    ).afterClosed().subscribe((resolved) => {
      if (resolved) {
        this.setView(resolved);
        this.snackBar.open('Configuración de columnas actualizada.', 'Cerrar', {
          duration: 2600,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
    });
  }

  protected sourceTooltip(): string {
    if (this.view().source === 'personal') return 'Columnas · vista personal';
    if (this.view().source === 'company') return 'Columnas · vista de la empresa';
    return 'Elegir columnas visibles';
  }

  private async initializePreferences(): Promise<void> {
    const catalog = this.catalog();
    const key = `${this.tableModule}/${this.tableId}`;
    const enabled = /^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(key)
      && isOperationalTableRegistered(this.tableModule, this.tableId)
      && catalog.some((column) => !column.locked);
    this.preferencesEnabled.set(enabled);
    if (!enabled) return;

    if (this.loadedKey === key) {
      const reconciled = this.view().source === 'default'
        ? this.preferences.defaultView(catalog)
        : this.preferences.reconcile(this.view(), catalog);
      this.setView(reconciled);
      return;
    }

    const sequence = ++this.loadSequence;
    this.setView(this.preferences.defaultView(catalog));
    try {
      const resolved = await this.preferences.getResolvedView(
        { moduleId: this.tableModule, tableId: this.tableId },
        catalog
      );
      if (sequence !== this.loadSequence) return;
      this.loadedKey = key;
      this.setView(resolved);
    } catch (error) {
      console.error('No se pudo cargar la configuración de columnas.', error);
    }
  }

  private setCatalog(columns: readonly TableColumnDefinition[]): void {
    this.catalog.set(columns);
    if (this.viewInitialized) queueMicrotask(() => void this.initializePreferences());
  }

  private refreshDiscoveredColumns(): void {
    const headers = Array.from(this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
      'th[class*="mat-column-"], .mat-mdc-header-cell[class*="mat-column-"], th[data-column-id]'
    ));
    const seen = new Set<string>();
    const discovered: TableColumnDefinition[] = [];

    for (const header of headers) {
      const cssClass = Array.from(header.classList).find((name) => name.startsWith('mat-column-'));
      const id = header.dataset['columnId'] ?? cssClass?.slice('mat-column-'.length);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = (header.textContent ?? '').replace(/\s+/g, ' ').trim() || id;
      discovered.push({
        id,
        domId: id,
        label,
        defaultVisible: true,
        locked: this.lockedColumnIds.includes(id)
      });
    }

    const previous = this.catalog();
    if (this.sameCatalog(previous, discovered)) return;
    this.setCatalog(discovered);
  }

  private normalizeColumns(columns: readonly TableColumnDefinition[]): TableColumnDefinition[] {
    const seen = new Set<string>();
    return columns
      .filter((column) => !!column.id && !!column.label && !seen.has(column.id) && seen.add(column.id))
      .map((column) => ({
        ...column,
        group: column.group ?? 'standard',
        defaultVisible: column.defaultVisible !== false,
        locked: column.locked || this.lockedColumnIds.includes(column.id)
      }));
  }

  private sameCatalog(
    left: readonly TableColumnDefinition[],
    right: readonly TableColumnDefinition[]
  ): boolean {
    return left.length === right.length && left.every((column, index) =>
      column.id === right[index]?.id && column.label === right[index]?.label
    );
  }

  private setView(view: ResolvedTableView): void {
    this.view.set(view);
    this.visibleColumnsChange.emit(view.visibleColumnIds);
    queueMicrotask(() => this.applyColumnVisibility());
  }

  private applyColumnVisibility(): void {
    // Sin preferencias activas no hay ninguna vista resuelta y `visibleColumnIds` esta vacio:
    // seguir adelante ocultaria TODAS las columnas menos las bloqueadas. Una tabla que no
    // participa del sistema de preferencias se muestra tal como la declaro la pantalla.
    if (!this.preferencesEnabled()) return;
    const catalog = this.catalog();
    if (catalog.length === 0) return;
    const visibleIds = new Set(this.view().visibleColumnIds);
    const visibilityByDomId = new Map(
      catalog.map((column) => [column.domId ?? column.id, visibleIds.has(column.id) || !!column.locked])
    );
    const cells = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('[class*="mat-column-"], [data-column-id]');
    for (const cell of Array.from(cells)) {
      const cssClass = Array.from(cell.classList).find((name) => name.startsWith('mat-column-'));
      const domId = cell.dataset['columnId'] ?? cssClass?.slice('mat-column-'.length);
      if (!domId || !visibilityByDomId.has(domId)) continue;
      if (visibilityByDomId.get(domId)) cell.style.removeProperty('display');
      else cell.style.setProperty('display', 'none', 'important');
    }
  }
}

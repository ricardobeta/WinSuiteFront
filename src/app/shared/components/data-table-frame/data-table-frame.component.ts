import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-data-table-frame',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule],
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
        <div class="data-table-filters"><ng-content select="[table-filters]" /></div>
      </div>

      <div class="data-table-viewport" tabindex="0" aria-label="Tabla desplazable horizontalmente">
        <ng-content />
      </div>

      @if (showPaginator) {
        <mat-paginator
          [length]="total"
          [pageIndex]="pageIndex"
          [pageSize]="pageSize"
          [pageSizeOptions]="pageSizeOptions"
          showFirstLastButtons
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
    .data-table-filters { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: .65rem; flex-wrap: wrap; }
    .data-table-filters:empty { display: none; }
    .data-table-viewport {
      display: block;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scrollbar-gutter: stable;
      border-radius: var(--tc-radius-md);
      background: var(--tc-surface-container-lowest);
    }
    .data-table-viewport:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 30%, transparent); outline-offset: 2px; }
    mat-paginator { border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    @media (max-width: 720px) {
      .data-table-toolbar { align-items: stretch; }
      .data-table-search { max-width: none; flex-basis: 100%; }
      .data-table-filters { width: 100%; justify-content: flex-start; }
    }
  `],
})
export class DataTableFrameComponent {
  @Input() searchPlaceholder = 'Buscar';
  @Input() searchValue = '';
  @Input() showSearch = true;
  @Input() showPaginator = true;
  @Input() total = 0;
  @Input() pageIndex = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: readonly number[] = [10, 25, 50];

  @Output() readonly searchChange = new EventEmitter<string>();
  @Output() readonly pageChange = new EventEmitter<PageEvent>();

  private readonly searchInput = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.searchInput
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchChange.emit(value));
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue = value;
    this.searchInput.next(value);
  }
}

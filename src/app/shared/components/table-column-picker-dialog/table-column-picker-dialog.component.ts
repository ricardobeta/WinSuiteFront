import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import {
  ResolvedTableView,
  TableColumnDefinition,
  TablePreferenceIdentity
} from '../../models/table-preferences.models';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

export interface TableColumnPickerDialogData extends TablePreferenceIdentity {
  columns: readonly TableColumnDefinition[];
  view: ResolvedTableView;
  canPublishCompany: boolean;
}

@Component({
  selector: 'app-table-column-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  template: `
    <header class="dialog-heading">
      <span class="heading-icon" aria-hidden="true"><mat-icon>view_column</mat-icon></span>
      <div>
        <h2 mat-dialog-title>Columnas de la tabla</h2>
        <p>{{ sourceLabel() }}</p>
      </div>
    </header>

    <mat-dialog-content>
      <div class="picker-tools">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Buscar una columna</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input
            matInput
            type="search"
            autocomplete="off"
            [value]="query()"
            (input)="setQuery($event)"
          />
        </mat-form-field>
        <div class="selection-summary" aria-live="polite">
          <strong>{{ selectedCount() }}</strong>
          <span>seleccionadas</span>
        </div>
      </div>

      <div class="quick-actions">
        <button mat-button type="button" (click)="selectAll()">Seleccionar todas</button>
        <button mat-button type="button" (click)="restore()">
          {{ data.view.source === 'personal' ? 'Usar vista de la empresa' : 'Restablecer selección' }}
        </button>
      </div>

      @if (standardColumns().length > 0) {
        <section class="column-group" aria-labelledby="standard-columns-title">
          <h3 id="standard-columns-title">Campos estándar</h3>
          <div class="column-options">
            @for (column of standardColumns(); track column.id) {
              <mat-checkbox
                [checked]="isSelected(column.id)"
                [disabled]="saving()"
                (change)="toggle(column.id, $event.checked)"
              >
                {{ column.label }}
              </mat-checkbox>
            }
          </div>
        </section>
      }

      @if (customColumns().length > 0) {
        <section class="column-group" aria-labelledby="custom-columns-title">
          <h3 id="custom-columns-title">Campos personalizados</h3>
          <div class="column-options">
            @for (column of customColumns(); track column.id) {
              <mat-checkbox
                [checked]="isSelected(column.id)"
                [disabled]="saving()"
                (change)="toggle(column.id, $event.checked)"
              >
                {{ column.label }}
              </mat-checkbox>
            }
          </div>
        </section>
      }

      @if (standardColumns().length === 0 && customColumns().length === 0) {
        <div class="no-results">
          <mat-icon>search_off</mat-icon>
          <p>No encontramos columnas con ese nombre.</p>
        </div>
      }

      @if (!hasSelection()) {
        <p class="validation-message" role="alert">Selecciona al menos una columna de datos.</p>
      }
      @if (errorMessage()) {
        <p class="error-message" role="alert">{{ errorMessage() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="saving()" mat-dialog-close>Cancelar</button>
      <button
        mat-stroked-button
        type="button"
        [disabled]="saving() || !hasSelection()"
        (click)="savePersonal()"
      >
        Guardar solo para mí
      </button>
      @if (data.canPublishCompany) {
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="saving() || !hasSelection()"
          (click)="saveCompany()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar para la empresa' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; width: min(34rem, calc(100vw - 1rem)); }
    .dialog-heading { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .85rem; align-items: center; padding: 1.25rem 1.5rem .5rem; }
    .dialog-heading h2 { margin: 0; padding: 0; font: 700 1.3rem/1.25 Manrope, Inter, sans-serif; }
    .dialog-heading p { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .85rem; }
    .heading-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: var(--tc-radius-md); background: var(--tc-primary-container); color: var(--tc-on-primary-container); }
    mat-dialog-content { display: grid; gap: 1rem; max-height: min(66vh, 38rem); padding-block-start: .75rem !important; }
    .picker-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .75rem; align-items: center; }
    .selection-summary { min-width: 6.5rem; padding: .55rem .75rem; border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); display: grid; text-align: center; }
    .selection-summary strong { font-size: 1.05rem; color: var(--primary); }
    .selection-summary span { color: var(--muted-foreground); font-size: .72rem; }
    .quick-actions { display: flex; justify-content: space-between; gap: .5rem; flex-wrap: wrap; }
    .column-group { display: grid; gap: .6rem; }
    .column-group h3 { margin: 0; color: var(--muted-foreground); font-size: .78rem; letter-spacing: .04em; text-transform: uppercase; }
    .column-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem .75rem; padding: .65rem; border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    mat-checkbox { min-width: 0; min-height: 44px; display: flex; align-items: center; overflow-wrap: anywhere; }
    .no-results { min-height: 9rem; display: grid; place-content: center; justify-items: center; gap: .4rem; color: var(--muted-foreground); text-align: center; }
    .no-results mat-icon { width: 32px; height: 32px; font-size: 32px; }
    .no-results p, .validation-message, .error-message { margin: 0; }
    .validation-message, .error-message { padding: .7rem .8rem; border-radius: var(--tc-radius-md); background: color-mix(in srgb, var(--tc-error) 10%, transparent); color: var(--tc-error); font-size: .84rem; }
    mat-dialog-actions { gap: .4rem; padding: 1rem 1.5rem 1.25rem; flex-wrap: wrap; }
    @media (max-width: 560px) {
      .dialog-heading { padding-inline: 1rem; }
      mat-dialog-content { padding-inline: 1rem !important; }
      .picker-tools { grid-template-columns: 1fr; }
      .selection-summary { grid-template-columns: auto auto; justify-content: center; gap: .35rem; }
      .column-options { grid-template-columns: 1fr; }
      mat-dialog-actions { align-items: stretch; padding-inline: 1rem; }
      mat-dialog-actions button { flex: 1 1 100%; }
    }
  `]
})
export class TableColumnPickerDialogComponent {
  protected readonly data = inject<TableColumnPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TableColumnPickerDialogComponent, ResolvedTableView>);
  private readonly dialogs = inject(MatDialog);
  private readonly preferences = inject(TablePreferencesService);

  protected readonly query = signal('');
  protected readonly selected = signal(new Set(this.data.view.visibleColumnIds));
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  private readonly selectableColumns = this.data.columns.filter((column) => !column.locked);
  protected readonly selectedCount = computed(() =>
    this.selectableColumns.filter((column) => this.selected().has(column.id)).length
  );
  protected readonly hasSelection = computed(() => this.selectedCount() > 0);
  protected readonly standardColumns = computed(() =>
    this.filteredColumns().filter((column) => column.group !== 'custom')
  );
  protected readonly customColumns = computed(() =>
    this.filteredColumns().filter((column) => column.group === 'custom')
  );
  protected readonly sourceLabel = computed(() => {
    if (this.data.view.source === 'personal') return 'Estás usando una vista personal.';
    if (this.data.view.source === 'company') return 'Estás usando la vista definida por la empresa.';
    return 'Estás usando la vista predeterminada de WinSuit.';
  });

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
    this.errorMessage.set('');
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.selectableColumns.map((column) => column.id)));
    this.errorMessage.set('');
  }

  protected async restore(): Promise<void> {
    if (this.data.view.source !== 'personal') {
      this.selected.set(new Set(
        this.selectableColumns
          .filter((column) => column.defaultVisible !== false)
          .map((column) => column.id)
      ));
      return;
    }

    await this.runSave(() => this.preferences.resetPersonal(this.identity(), this.data.columns));
  }

  protected async savePersonal(): Promise<void> {
    await this.runSave(() => this.preferences.savePersonal(
      this.identity(),
      [...this.selected()],
      this.data.columns
    ));
  }

  protected async saveCompany(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialogs.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data: {
        title: 'Guardar vista para la empresa',
        message: 'Esta selección será la vista inicial de esta tabla para los colaboradores que no tengan una personalización propia.',
        confirmText: 'Guardar para la empresa'
      }
    }).afterClosed());
    if (!confirmed) return;

    await this.runSave(() => this.preferences.publishCompany(
      this.identity(),
      [...this.selected()],
      this.data.columns
    ));
  }

  private filteredColumns(): TableColumnDefinition[] {
    const query = this.normalize(this.query());
    if (!query) return this.selectableColumns;
    return this.selectableColumns.filter((column) => this.normalize(column.label).includes(query));
  }

  private async runSave(operation: () => Promise<ResolvedTableView>): Promise<void> {
    if (this.saving() || !this.hasSelection()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    try {
      this.dialogRef.close(await operation());
    } catch (error) {
      this.errorMessage.set(error instanceof Error
        ? error.message
        : 'No pudimos guardar la configuración. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  private identity(): TablePreferenceIdentity {
    return { moduleId: this.data.moduleId, tableId: this.data.tableId };
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}

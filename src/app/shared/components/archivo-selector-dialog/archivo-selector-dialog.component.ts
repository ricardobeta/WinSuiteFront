import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ArchivosService } from '../../../core/services/archivos.service';
import { ArchivoUploaderComponent } from '../archivo-uploader/archivo-uploader.component';
import { ArchivoItem } from '../../models/archivos.models';

export interface ArchivoSelectorDialogData {
  title?: string;
  subtitle?: string;
  sourceModule?: string;
  allowUpload?: boolean;
}

export interface ArchivoSelectorDialogResult {
  action: 'selected' | 'uploaded';
  archivo: ArchivoItem;
}

@Component({
  selector: 'app-archivo-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ArchivoUploaderComponent
  ],
  template: `
    <section class="selector-shell">
      <header class="selector-hero surface-card">
        <div class="hero-copy">
          <p class="eyebrow">Archivos de la empresa</p>
          <h2>{{ data.title ?? 'Buscar, reutilizar o subir archivo' }}</h2>
          <p>{{ data.subtitle ?? 'Encuentra un documento existente o sube uno nuevo sin salir de esta ventana.' }}</p>

          <div class="hero-pills">
            <mat-chip-listbox aria-label="Resumen del selector">
              <mat-chip-option disabled>{{ files().length }} cargados</mat-chip-option>
              <mat-chip-option disabled>{{ filteredFiles().length }} visibles</mat-chip-option>
            </mat-chip-listbox>
          </div>
        </div>

        <div class="hero-actions">
          <mat-button-toggle-group [value]="mode()" (change)="setMode($event.value)" aria-label="Modo del selector">
            <mat-button-toggle value="search">
              <mat-icon>search</mat-icon>
              Buscar
            </mat-button-toggle>
            @if (data.allowUpload ?? true) {
              <mat-button-toggle value="upload">
                <mat-icon>cloud_upload</mat-icon>
                Subir
              </mat-button-toggle>
            }
          </mat-button-toggle-group>

          <button mat-icon-button type="button" mat-dialog-close aria-label="Cerrar ventana">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </header>

      @if (mode() === 'search') {
        <section class="search-workflow">
          <form class="search-bar surface-card" [formGroup]="filterForm">
            <mat-form-field appearance="outline">
              <mat-label>Buscar archivo</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput formControlName="search" placeholder="Nombre, usuario, modulo o tipo" />
              @if (filterForm.get('search')?.value) {
                <button mat-icon-button matSuffix type="button" aria-label="Limpiar busqueda" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
          </form>

          <section class="results-panel surface-card">
            <div class="results-header">
              <div>
                <p class="eyebrow">Resultados</p>
                <h3>{{ filteredFiles().length }} archivos encontrados</h3>
                <p>Selecciona uno existente para reutilizarlo.</p>
              </div>
            </div>

            @if (filteredFiles().length === 0) {
              <div class="empty-state">
                <mat-icon>search_off</mat-icon>
                <h4>No encontramos coincidencias</h4>
                <p>Prueba con otro nombre o cambia al modo subir si necesitas crear uno nuevo.</p>
                <div class="empty-actions">
                  <button mat-stroked-button type="button" (click)="clearSearch()">Limpiar búsqueda</button>
                  @if (data.allowUpload ?? true) {
                    <button mat-raised-button color="primary" type="button" (click)="setMode('upload')">
                      Ir a subir
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="files-list">
                @for (item of filteredFiles(); track item.id) {
                  <article class="file-row">
                    <div class="file-main">
                      <div class="file-icon">
                        <mat-icon>{{ iconFor(item) }}</mat-icon>
                      </div>

                      <div class="file-info">
                        <div class="file-title-line">
                          <h4>{{ item.name }}</h4>
                          <mat-chip>{{ typeLabel(item) }}</mat-chip>
                        </div>
                        <p>
                          {{ formatModule(item.sourceModule || 'general') }} · {{ formatBytes(item.sizeBytes) }} ·
                          {{ item.uploadedBy || 'Equipo' }}
                        </p>
                      </div>
                    </div>

                    <button mat-raised-button color="primary" type="button" (click)="useExisting(item)">
                      Usar
                    </button>
                  </article>
                }
              </div>
            }
          </section>
        </section>
      }

      @if (mode() === 'upload' && (data.allowUpload ?? true)) {
        <section class="upload-panel surface-card">
          <div class="upload-header">
            <div>
              <p class="eyebrow">Subir nuevo</p>
              <h3>Si no existe, cárgalo aquí</h3>
              <p>Usa esta vista para añadir un archivo nuevo sin mezclarla con la búsqueda.</p>
            </div>

            <button mat-stroked-button type="button" (click)="setMode('search')">
              Volver a buscar
            </button>
          </div>
          <mat-divider />
          <app-archivo-uploader
            [sourceModule]="data.sourceModule ?? 'archivos'"
            (uploaded)="onUploaded($event)"
            (failed)="onUploadFailed($event)"
          />
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .selector-shell {
        display: grid;
        gap: 1rem;
        width: min(1120px, calc(100vw - 1.5rem));
        max-width: calc(100vw - 1.5rem);
        max-height: 92vh;
        overflow: auto;
        overflow-x: hidden;
        padding: 0.25rem;
        margin: 0 auto;
      }

      .selector-hero {
        padding: 1.35rem 1.5rem;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        background:
          radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 50%),
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--card)), var(--card));
      }

      .hero-copy {
        display: grid;
        gap: 0.4rem;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
      }

      .hero-actions mat-button-toggle-group {
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in srgb, var(--primary) 4%, var(--tc-surface-container-low));
        border: 1px solid color-mix(in srgb, var(--primary) 14%, var(--tc-ghost-border));
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 35%);
      }

      .hero-actions mat-button-toggle {
        min-width: 112px;
        color: var(--muted-foreground);
      }

      /* Ensure label content and icon inherit the toggle color and have proper contrast */
      .hero-actions mat-button-toggle .mat-button-toggle-label-content,
      .hero-actions mat-button-toggle mat-icon {
        color: currentColor;
        opacity: 0.98;
      }

      /* Inactive toggle state - explicit color for better legibility */
      .hero-actions mat-button-toggle:not(.mat-button-toggle-checked) .mat-button-toggle-label-content,
      .hero-actions mat-button-toggle:not(.mat-button-toggle-checked) mat-icon {
        color: var(--muted-foreground);
      }

      .hero-actions mat-button-toggle:hover {
        color: var(--foreground);
      }

      :host ::ng-deep .hero-actions .mat-button-toggle-button {
        padding-inline: 1rem;
        min-height: 42px;
      }

      :host ::ng-deep .hero-actions .mat-button-toggle-checked {
        background: color-mix(in srgb, var(--primary) 14%, var(--primary-container));
        color: var(--on-primary-container);
      }

      :host ::ng-deep .hero-actions .mat-button-toggle-checked .mat-button-toggle-label-content {
        color: var(--on-primary-container);
      }

      :host ::ng-deep .hero-actions .mat-button-toggle-label-content {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
      }

      .selector-hero h2,
      .results-header h3,
      .upload-header h3 {
        margin: 0;
      }

      .selector-hero p,
      .results-header p,
      .upload-header p {
        margin: 0;
        color: var(--muted-foreground);
      }

      .hero-pills {
        margin-top: 0.35rem;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        color: var(--primary);
      }

      .search-bar {
        display: grid;
        padding: 1rem 1.15rem 0.9rem;
        background: color-mix(in srgb, var(--primary) 3%, var(--card));
      }

      .search-bar mat-form-field {
        width: 100%;
      }

      .search-workflow {
        display: grid;
        gap: 1rem;
      }

      .results-panel,
      .upload-panel {
        padding: 1.25rem;
      }

      .results-panel {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }

      .results-header {
        display: grid;
        gap: 0.35rem;
      }

      .empty-state {
        padding: 2rem 1rem;
        display: grid;
        gap: 0.5rem;
        justify-items: center;
        text-align: center;
        color: var(--muted-foreground);
      }

      .empty-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 0.25rem;
      }

      .empty-state mat-icon {
        font-size: 2.25rem;
        width: 2.25rem;
        height: 2.25rem;
      }

      .files-list {
        display: grid;
        gap: 0.75rem;
      }

      .file-row {
        display: flex;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--tc-ghost-border));
        background: color-mix(in srgb, var(--primary) 4%, var(--card));
        box-shadow: 0 8px 20px rgb(15 23 42 / 4%);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }

      .file-row:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 26px rgb(15 23 42 / 7%);
        border-color: color-mix(in srgb, var(--primary) 22%, var(--tc-ghost-border));
      }

      .file-main {
        display: flex;
        gap: 0.9rem;
        align-items: center;
        min-width: 0;
      }

      .file-icon {
        width: 46px;
        height: 46px;
        border-radius: 0.9rem;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--primary) 12%, var(--card));
        border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--tc-ghost-border));
        flex-shrink: 0;
      }

      .file-icon mat-icon {
        color: var(--primary);
      }

      .file-info {
        min-width: 0;
      }

      .file-title-line {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .file-title-line h4 {
        margin: 0;
        font-size: 1rem;
      }

      .file-info p {
        margin: 0.35rem 0 0;
        color: var(--muted-foreground);
      }

      .upload-panel {
        display: grid;
        gap: 1rem;
      }

      .upload-header {
        display: grid;
        gap: 0.4rem;
      }

      @media (max-width: 900px) {
        .selector-hero,
        .file-row {
          flex-direction: column;
          align-items: stretch;
        }

        .selector-hero {
          padding: 1.15rem 1.15rem 1.25rem;
        }

        .upload-panel {
          position: static;
        }

        .file-main {
          align-items: start;
        }

        .hero-actions {
          width: 100%;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .hero-actions mat-button-toggle-group {
          width: 100%;
        }

        .hero-actions mat-button-toggle {
          flex: 1 1 0;
        }
      }

      :host-context(html.theme-dark) .selector-shell {
        max-width: calc(100vw - 1.5rem);
      }

      :host-context(html.theme-dark) .hero-actions mat-button-toggle-group {
        background: color-mix(in srgb, var(--primary) 6%, var(--card));
        border-color: color-mix(in srgb, var(--primary) 22%, var(--tc-ghost-border));
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%);
      }

      :host-context(html.theme-dark) .hero-actions mat-button-toggle {
        color: var(--muted-foreground);
      }

      :host-context(html.theme-dark) ::ng-deep .hero-actions .mat-button-toggle-checked {
        background: color-mix(in srgb, var(--primary) 22%, var(--card));
        color: var(--primary-foreground);
      }

      /* Dark-mode: ensure inactive toggles remain legible against darker background */
      :host-context(html.theme-dark) .hero-actions mat-button-toggle:not(.mat-button-toggle-checked) .mat-button-toggle-label-content,
      :host-context(html.theme-dark) .hero-actions mat-button-toggle:not(.mat-button-toggle-checked) mat-icon {
        color: var(--muted-foreground);
      }

      :host-context(html.theme-dark) .selector-hero {
        background:
          radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 50%),
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--card)), var(--card));
      }

      :host-context(html.theme-dark) .search-bar {
        background: color-mix(in srgb, var(--primary) 6%, var(--card));
      }

      :host-context(html.theme-dark) .file-row {
        background: color-mix(in srgb, var(--primary) 8%, var(--card));
        box-shadow: 0 10px 24px rgb(0 0 0 / 18%);
      }

      :host-context(html.theme-dark) .file-row:hover {
        box-shadow: 0 14px 30px rgb(0 0 0 / 24%);
      }
    `
  ]
})
export class ArchivoSelectorDialogComponent implements OnInit {
  protected readonly data = inject<ArchivoSelectorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ArchivoSelectorDialogComponent, ArchivoSelectorDialogResult | null>);
  private readonly archivosService = inject(ArchivosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly files = signal<ArchivoItem[]>([]);
  protected readonly filteredFiles = signal<ArchivoItem[]>([]);
  protected readonly mode = signal<'search' | 'upload'>('search');
  protected readonly filterForm = this.fb.nonNullable.group({
    search: ''
  });

  protected readonly selectedCountLabel = computed(() => `${this.filteredFiles().length} visibles`);

  ngOnInit(): void {
    this.archivosService
      .getArchivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.files.set(items);
        this.applyFilter();
      });

    this.filterForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilter());
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) {
      return '0 B';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  protected formatModule(moduleKey: string): string {
    return moduleKey ? `${moduleKey.charAt(0).toUpperCase()}${moduleKey.slice(1)}` : 'General';
  }

  protected setMode(mode: 'search' | 'upload'): void {
    this.mode.set(mode);
  }

  protected clearSearch(): void {
    this.filterForm.setValue({ search: '' });
  }

  protected typeLabel(item: ArchivoItem): string {
    const extension = item.extension ?? item.name.split('.').pop()?.toLowerCase();
    if (extension === 'xls' || extension === 'xlsx') {
      return 'Excel';
    }
    if (extension === 'csv') {
      return 'CSV';
    }
    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
      return 'Imagen';
    }
    return 'Archivo';
  }

  protected iconFor(item: ArchivoItem): string {
    const extension = item.extension ?? item.name.split('.').pop()?.toLowerCase();
    if (extension === 'xls' || extension === 'xlsx' || extension === 'csv') {
      return 'description';
    }
    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
      return 'image';
    }
    return 'draft';
  }

  protected useExisting(item: ArchivoItem): void {
    this.dialogRef.close({ action: 'selected', archivo: item });
  }

  protected onUploaded(item: ArchivoItem): void {
    this.dialogRef.close({ action: 'uploaded', archivo: item });
  }

  protected onUploadFailed(event: { file: File; error: string }): void {
    console.error('Archivo upload failed', event.file.name, event.error);
  }

  private applyFilter(): void {
    const term = this.filterForm.getRawValue().search.trim().toLowerCase();
    const items = this.files().filter((item) => {
      if (!term) {
        return true;
      }

      const haystack = [
        item.name,
        item.uploadedBy,
        item.sourceModule,
        item.contentType,
        item.extension
      ]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });

    this.filteredFiles.set(items);
  }
}

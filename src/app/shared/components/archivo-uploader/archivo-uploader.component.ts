import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ArchivosService } from '../../../core/services/archivos.service';
import {
  ARCHIVO_ALLOWED_EXTENSIONS,
  ARCHIVO_MAX_FILE_BYTES,
  ARCHIVO_MAX_TOTAL_BYTES,
  ArchivoItem,
  ArchivosUsage
} from '../../models/archivos.models';

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

interface UploadView {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
  item?: ArchivoItem;
}

@Component({
  selector: 'app-archivo-uploader',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatChipsModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <section class="uploader-card surface-card" [class.disabled]="disabled">
      <div class="uploader-header">
        <div class="title">
          <p class="eyebrow">Archivos</p>
          <h3>Sube archivos compartidos</h3>
          <p class="support">
            Arrastra y suelta archivos o usa el selector. Max {{ formatBytes(maxFileBytes) }} por archivo.
          </p>
        </div>

        <div class="quota" aria-live="polite">
          <span>
            Uso {{ formatBytes(usage().totalBytes) }} / {{ formatBytes(maxTotalBytes) }}
          </span>
          <mat-progress-bar mode="determinate" [value]="usagePercent()"></mat-progress-bar>
        </div>
      </div>

      <div
        class="dropzone"
        [class.drag-over]="isDragOver()"
        [class.disabled]="disabled"
        (click)="onDropzoneClick(fileInput)"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        <input
          #fileInput
          type="file"
          [accept]="accept"
          [multiple]="true"
          [disabled]="disabled"
          (change)="onFilesSelected($event)"
          hidden
        />

        <div class="dropzone-content">
          <div class="drop-visual">
            <mat-icon>cloud_upload</mat-icon>
          </div>
          <div>
            <h4>Arrastra y suelta aqui</h4>
            <p>o haz clic para seleccionar archivos</p>
          </div>
        </div>

        <div class="dropzone-footer">
          <mat-chip-listbox aria-label="Tipos permitidos">
            <mat-chip-option disabled>Excel</mat-chip-option>
            <mat-chip-option disabled>CSV</mat-chip-option>
            <mat-chip-option disabled>Imagenes</mat-chip-option>
          </mat-chip-listbox>
          <span class="hint">Total disponible: {{ formatBytes(maxTotalBytes - usage().totalBytes) }}</span>
        </div>
      </div>

      @if (disabled) {
        <div class="locked-banner">
          <mat-icon>lock</mat-icon>
          <span>No tienes permisos para cargar archivos.</span>
        </div>
      }

      @if (uploads().length > 0) {
        <div class="uploads">
          @for (upload of uploads(); track upload.id) {
            <article class="upload-row" [class.error]="upload.status === 'error'">
              <div class="upload-info">
                <div>
                  <p class="file-name">{{ upload.file.name }}</p>
                  <p class="file-meta">
                    {{ formatBytes(upload.file.size) }} · {{ statusLabel(upload) }}
                  </p>
                </div>

                @if (upload.status === 'success') {
                  <mat-icon class="success-icon">check_circle</mat-icon>
                }
              </div>

              @if (upload.status === 'uploading') {
                <mat-progress-bar mode="determinate" [value]="upload.progress"></mat-progress-bar>
              } @else if (upload.status === 'error') {
                <p class="error-text">{{ upload.error }}</p>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .uploader-card {
        position: relative;
        overflow: hidden;
        padding: 1.5rem;
        display: grid;
        gap: 1.25rem;
        background:
          radial-gradient(circle at 10% 10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 55%),
          linear-gradient(135deg, rgba(6, 107, 94, 0.08), transparent 60%),
          var(--card);
        border-color: color-mix(in srgb, var(--primary) 12%, var(--tc-ghost-border));
        box-shadow: 0 10px 28px rgb(15 23 42 / 7%);
        animation: fade-up 0.45s ease both;
      }

      .uploader-card.disabled {
        opacity: 0.85;
      }

      .uploader-header {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
        align-items: end;
      }

      .title h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .support {
        margin: 0.35rem 0 0;
        color: var(--muted-foreground);
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        color: var(--primary);
      }

      .quota {
        display: grid;
        gap: 0.35rem;
        font-weight: 500;
        color: var(--foreground);
      }

      .dropzone {
        border: 2px dashed color-mix(in srgb, var(--primary) 40%, var(--tc-ghost-border));
        border-radius: 1.25rem;
        padding: 1.5rem;
        display: grid;
        gap: 1rem;
        cursor: pointer;
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent),
          color-mix(in srgb, var(--primary) 4%, var(--card));
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 40%);
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;
      }

      .dropzone.disabled {
        cursor: not-allowed;
        filter: grayscale(0.2);
      }

      .dropzone.drag-over {
        border-color: var(--primary);
        box-shadow: 0 12px 30px rgba(6, 107, 94, 0.22), inset 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent);
        transform: translateY(-2px);
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%),
          color-mix(in srgb, var(--primary) 8%, var(--card));
      }

      .dropzone-content {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1rem;
        align-items: center;
      }

      .dropzone-content h4 {
        margin: 0;
        font-size: 1.05rem;
      }

      .dropzone-content p {
        margin: 0.35rem 0 0;
        color: var(--muted-foreground);
      }

      .drop-visual {
        width: 56px;
        height: 56px;
        border-radius: 1rem;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--primary) 14%, var(--card));
        border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--tc-ghost-border));
      }

      .drop-visual mat-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: var(--primary);
      }

      .dropzone-footer {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
      }

      .hint {
        color: var(--muted-foreground);
        font-size: 0.85rem;
      }

      .locked-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--destructive) 12%, transparent);
        color: var(--destructive);
        font-weight: 500;
      }

      .uploads {
        display: grid;
        gap: 0.75rem;
      }

      .upload-row {
        padding: 0.85rem 1rem;
        border-radius: 0.85rem;
        background: color-mix(in srgb, var(--primary) 4%, var(--card));
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--tc-ghost-border));
        display: grid;
        gap: 0.5rem;
      }

      .upload-row.error {
        border-color: color-mix(in srgb, var(--destructive) 35%, transparent);
      }

      .upload-info {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
      }

      .file-name {
        margin: 0;
        font-weight: 600;
      }

      .file-meta {
        margin: 0.2rem 0 0;
        color: var(--muted-foreground);
        font-size: 0.85rem;
      }

      .success-icon {
        color: var(--success);
      }

      .error-text {
        margin: 0;
        color: var(--destructive);
        font-size: 0.85rem;
      }

      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 900px) {
        .uploader-header {
          grid-template-columns: 1fr;
        }

        .dropzone-content {
          grid-template-columns: 1fr;
          text-align: center;
        }

        .drop-visual {
          margin: 0 auto;
        }

        .dropzone-footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      :host-context(html.theme-dark) .uploader-card {
        background:
          radial-gradient(circle at 10% 10%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 52%),
          linear-gradient(135deg, rgba(38, 210, 191, 0.14), transparent 62%),
          var(--card);
        box-shadow: 0 12px 28px rgb(0 0 0 / 28%);
      }

      :host-context(html.theme-dark) .dropzone {
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent), transparent),
          color-mix(in srgb, var(--primary) 8%, var(--card));
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 4%);
      }

      :host-context(html.theme-dark) .dropzone.drag-over {
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 30%, transparent), transparent 70%),
          color-mix(in srgb, var(--primary) 12%, var(--card));
        box-shadow: 0 12px 30px rgb(0 0 0 / 28%), inset 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent);
      }

      :host-context(html.theme-dark) .upload-row {
        background: color-mix(in srgb, var(--primary) 8%, var(--card));
        border-color: color-mix(in srgb, var(--primary) 16%, var(--tc-ghost-border));
      }
    `
  ]
})
export class ArchivoUploaderComponent implements OnInit {
  @Input() sourceModule = 'archivos';
  @Input() disabled = false;

  @Output() uploaded = new EventEmitter<ArchivoItem>();
  @Output() failed = new EventEmitter<{ file: File; error: string }>();

  protected readonly maxFileBytes = ARCHIVO_MAX_FILE_BYTES;
  protected readonly maxTotalBytes = ARCHIVO_MAX_TOTAL_BYTES;
  protected readonly accept = '.xls,.xlsx,.csv,image/*';

  protected readonly usage = signal<ArchivosUsage>({ totalBytes: 0, totalCount: 0 });
  protected readonly uploads = signal<UploadView[]>([]);
  protected readonly isDragOver = signal(false);
  protected readonly usagePercent = computed(() => {
    const total = this.usage().totalBytes;
    return Math.min(100, Math.round((total / this.maxTotalBytes) * 100));
  });

  private readonly archivosService = inject(ArchivosService);
  private readonly destroyRef = inject(DestroyRef);
  private dragCounter = 0;

  ngOnInit(): void {
    this.archivosService
      .getUsage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((usage) => this.usage.set(usage));
  }

  protected onDropzoneClick(fileInput: HTMLInputElement): void {
    if (this.disabled) {
      return;
    }
    fileInput.click();
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    if (!files.length) {
      return;
    }

    this.handleFiles(files);

    if (input) {
      input.value = '';
    }
  }

  protected onDragEnter(event: DragEvent): void {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    this.dragCounter += 1;
    this.isDragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) {
      this.isDragOver.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    this.dragCounter = 0;
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    if (!files.length) {
      return;
    }

    this.handleFiles(files);
  }

  protected statusLabel(upload: UploadView): string {
    switch (upload.status) {
      case 'uploading':
        return `Subiendo ${upload.progress}%`;
      case 'success':
        return 'Carga completada';
      case 'error':
        return 'Error en la carga';
      default:
        return 'En cola';
    }
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
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  private handleFiles(files: File[]): void {
    const allowedExtensions = new Set(ARCHIVO_ALLOWED_EXTENSIONS);

    files.forEach((file) => {
      if (file.size > this.maxFileBytes) {
        const errorMessage = 'El archivo supera el limite de 2 MB.';
        this.failed.emit({ file, error: errorMessage });
        this.pushUpload({
          file,
          status: 'error',
          progress: 0,
          error: errorMessage
        });
        return;
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!extension || !allowedExtensions.has(extension as (typeof ARCHIVO_ALLOWED_EXTENSIONS)[number])) {
        const errorMessage = 'Tipo de archivo no permitido.';
        this.failed.emit({ file, error: errorMessage });
        this.pushUpload({
          file,
          status: 'error',
          progress: 0,
          error: errorMessage
        });
        return;
      }

      const uploadId = `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      this.pushUpload({ file, status: 'queued', progress: 0, id: uploadId });

      this.archivosService
        .uploadArchivo(file, { sourceModule: this.sourceModule })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (event) => {
            this.updateUpload(uploadId, {
              progress: event.progress,
              status: event.status,
              item: event.item
            });

            if (event.status === 'success' && event.item) {
              this.uploaded.emit(event.item);
            }
          },
          error: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'No se pudo subir el archivo.';
            this.updateUpload(uploadId, {
              status: 'error',
              progress: 0,
              error: errorMessage
            });
            this.failed.emit({ file, error: errorMessage });
          }
        });
    });
  }

  private pushUpload(entry: Omit<UploadView, 'id'> & { id?: string }): void {
    const upload: UploadView = {
      id: entry.id ?? `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      file: entry.file,
      status: entry.status,
      progress: entry.progress,
      error: entry.error,
      item: entry.item
    };

    this.uploads.update((current) => [upload, ...current].slice(0, 8));
  }

  private updateUpload(id: string, patch: Partial<UploadView>): void {
    this.uploads.update((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }
}

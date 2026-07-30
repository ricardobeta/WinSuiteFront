import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ArchivosService } from '../../../core/services/archivos.service';
import { ArchivoItem } from '../../models/archivos.models';

export interface DocumentoImportDialogData {
  /** Titulo del dialogo, por ejemplo "Importar el PDF del RUC". */
  titulo: string;
  /** Que documento se espera y de donde sacarlo. */
  ayuda: string;
  /** Modulo con el que queda etiquetado el archivo subido. */
  sourceModule: string;
}

/**
 * Elige el documento del que partira el copiloto: uno nuevo o uno que la empresa ya subio.
 *
 * Reutiliza el modulo Archivos en lugar de subir el fichero a un endpoint propio. Eso hace que
 * el documento quede archivado y reutilizable, respeta la cuota que ese modulo ya controla y
 * evita un endpoint multipart nuevo. Lo que se devuelve es el ArchivoItem elegido; quien abre
 * el dialogo se encarga de mandar su id al backend.
 *
 * Solo PDF: de una foto o un escaneo no se puede extraer texto, y el copiloto no interpreta
 * imagenes. Filtrar aqui evita que el usuario descubra eso despues de subir.
 */
@Component({
  selector: 'app-documento-import-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>

    <mat-dialog-content>
      <p class="ayuda">{{ data.ayuda }}</p>

      <div class="modos" role="tablist">
        <button
          type="button"
          role="tab"
          [class.activo]="modo() === 'subir'"
          [attr.aria-selected]="modo() === 'subir'"
          (click)="modo.set('subir')"
        >
          <mat-icon>upload_file</mat-icon>Subir archivo
        </button>
        <button
          type="button"
          role="tab"
          [class.activo]="modo() === 'existente'"
          [attr.aria-selected]="modo() === 'existente'"
          (click)="modo.set('existente')"
        >
          <mat-icon>folder_open</mat-icon>Elegir uno ya subido
        </button>
      </div>

      @if (modo() === 'subir') {
        <label class="dropzone">
          <input type="file" accept="application/pdf,.pdf" (change)="seleccionarArchivo($event)" />
          <mat-icon>picture_as_pdf</mat-icon>
          <span>Elige el PDF desde tu equipo</span>
          <small>Solo PDF, hasta 2 MB.</small>
        </label>

        @if (subiendo()) {
          <mat-progress-bar mode="determinate" [value]="progreso()" aria-label="Subiendo" />
        }
      } @else {
        @if (pdfs().length === 0) {
          <p class="vacio">
            <mat-icon>info</mat-icon>
            Todavía no hay PDF subidos en esta empresa. Sube uno desde la otra pestaña.
          </p>
        } @else {
          <ul class="archivos">
            @for (archivo of pdfs(); track archivo.id) {
              <li>
                <button type="button" (click)="elegir(archivo)">
                  <mat-icon>picture_as_pdf</mat-icon>
                  <span class="nombre">{{ archivo.name }}</span>
                  <span class="meta">{{ archivo.uploadedAt | date: 'dd/MM/yyyy' }}</span>
                </button>
              </li>
            }
          </ul>
        }
      }

      @if (error()) {
        <p class="error" role="alert"><mat-icon>error</mat-icon>{{ error() }}</p>
      }

      <p class="privacidad">
        <mat-icon>lock</mat-icon>
        El PDF se queda en WinSuite. Para leerlo se extrae su texto en el servidor y solo ese
        texto se envía al proveedor de IA.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" [disabled]="subiendo()">Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: grid; gap: .9rem; padding-top: .5rem; }
    .ayuda { margin: 0; color: var(--muted-foreground); font-size: .88rem; }
    .modos { display: flex; gap: .4rem; }
    .modos button { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .8rem; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--muted-foreground); font-size: .82rem; font-weight: 600; cursor: pointer; }
    .modos button.activo { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
    .modos mat-icon, .vacio mat-icon, .error mat-icon, .privacidad mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .dropzone { display: grid; justify-items: center; gap: .3rem; padding: 1.6rem 1rem; border: 1px dashed var(--border); border-radius: 12px; text-align: center; cursor: pointer; }
    .dropzone input { display: none; }
    .dropzone mat-icon { width: 34px; height: 34px; color: var(--primary); font-size: 34px; }
    .dropzone small { color: var(--muted-foreground); }
    .archivos { display: grid; gap: .35rem; max-height: 16rem; margin: 0; padding: 0; overflow: auto; list-style: none; }
    .archivos button { display: flex; align-items: center; gap: .5rem; width: 100%; padding: .5rem .65rem; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--foreground); text-align: left; cursor: pointer; }
    .archivos button:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .archivos mat-icon { flex-shrink: 0; color: var(--primary); }
    .nombre { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { color: var(--muted-foreground); font-size: .76rem; white-space: nowrap; }
    .vacio, .error, .privacidad { display: flex; align-items: center; gap: .4rem; margin: 0; font-size: .82rem; }
    .vacio, .privacidad { color: var(--muted-foreground); }
    .error { color: var(--destructive); }
  `]
})
export class DocumentoImportDialogComponent {
  protected readonly data = inject<DocumentoImportDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DocumentoImportDialogComponent, ArchivoItem>);
  private readonly archivosService = inject(ArchivosService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modo = signal<'subir' | 'existente'>('subir');
  protected readonly subiendo = signal(false);
  protected readonly progreso = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly pdfs = signal<ArchivoItem[]>([]);

  constructor() {
    this.archivosService
      .getArchivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (archivos) => this.pdfs.set(archivos.filter((archivo) => this.esPdf(archivo))),
        error: () => this.error.set('No se pudo cargar la lista de archivos ya subidos.')
      });
  }

  protected seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      this.error.set('Solo puedo leer PDF. Descarga el documento del portal en vez de fotografiarlo.');
      return;
    }

    this.error.set(null);
    this.subiendo.set(true);
    this.progreso.set(0);

    this.archivosService
      .uploadArchivo(file, { sourceModule: this.data.sourceModule })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evento) => {
          this.progreso.set(evento.progress);
          if (evento.status === 'success' && evento.item) {
            this.subiendo.set(false);
            this.dialogRef.close(evento.item);
          }
        },
        error: (fallo: Error) => {
          this.subiendo.set(false);
          this.error.set(fallo.message || 'No se pudo subir el archivo.');
        }
      });
  }

  protected elegir(archivo: ArchivoItem): void {
    this.dialogRef.close(archivo);
  }

  private esPdf(archivo: ArchivoItem): boolean {
    return /pdf/i.test(archivo.extension ?? '') || /pdf/i.test(archivo.contentType ?? '');
  }
}

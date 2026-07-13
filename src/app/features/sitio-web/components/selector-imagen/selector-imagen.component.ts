import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult,
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { SitioMediaService } from '../../services/sitio-media.service';

/** Campo de imagen publica: seleccionar o subir exclusivamente al Storage de Sites. */
@Component({
  selector: 'app-selector-imagen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="selector">
      @if (url()) {
        <img class="previa" [src]="url()" alt="Imagen seleccionada" />
      }
      <div class="controles">
        <button type="button" class="subir" (click)="abrirArchivos()">
          <mat-icon>photo_library</mat-icon>
          Mis archivos
        </button>
        <label class="subir" [class.subiendo]="subiendo()">
          <mat-icon>upload</mat-icon>
          {{ subiendo() ? 'Subiendo...' : 'Subir' }}
          <input
            type="file"
            accept="image/*"
            (change)="subir($event)"
            [disabled]="subiendo()"
            hidden
          />
        </label>
        @if (url()) {
          <button type="button" class="quitar" (click)="urlChange.emit('')">
            <mat-icon>delete_outline</mat-icon>
            Quitar
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .selector {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .previa {
      max-height: 90px;
      width: auto;
      max-width: 100%;
      border-radius: 6px;
      object-fit: cover;
      align-self: flex-start;
    }
    .controles {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .subir {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      white-space: nowrap;
      background: #fff;
    }
    .subir.subiendo {
      opacity: 0.6;
      pointer-events: none;
    }
    .subir mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }
    .quitar {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: 0;
      background: transparent;
      color: var(--warn, #b91c1c);
      cursor: pointer;
    }
  `,
})
export class SelectorImagenComponent {
  private readonly mediaService = inject(SitioMediaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  /** Abre el popup compartido de archivos de winsuite (buscar/reutilizar/subir). */
  async abrirArchivos(): Promise<void> {
    const ref = this.dialog.open<
      ArchivoSelectorDialogComponent,
      unknown,
      ArchivoSelectorDialogResult | null
    >(ArchivoSelectorDialogComponent, {
      data: {
        title: 'Imagenes de tu sitio',
        subtitle: 'Reutiliza una imagen ya subida o carga una nueva.',
        sourceModule: 'sitio_web',
        storageTarget: 'sites',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
      },
      maxWidth: '95vw',
      autoFocus: false,
    });
    const resultado = await firstValueFrom(ref.afterClosed());
    if (resultado?.archivo?.downloadUrl) {
      this.urlChange.emit(resultado.archivo.downloadUrl);
    }
  }

  readonly url = input<string | undefined>(undefined);
  readonly urlChange = output<string>();
  readonly subiendo = signal(false);

  async subir(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendo.set(true);
    try {
      const url = await this.mediaService.subirImagen(archivo);
      this.urlChange.emit(url);
    } catch (error) {
      this.snackBar.open((error as Error).message ?? 'No se pudo subir la imagen', 'OK', {
        duration: 4000,
      });
    } finally {
      this.subiendo.set(false);
      (evento.target as HTMLInputElement).value = '';
    }
  }
}

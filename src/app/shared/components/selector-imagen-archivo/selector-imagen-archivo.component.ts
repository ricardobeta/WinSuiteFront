import { ChangeDetectionStrategy, Component, Injector, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, last, tap } from 'rxjs';

import { ArchivosService } from '../../../core/services/archivos.service';
import { IMAGEN_PRODUCTO_MAX_BYTES, redimensionarImagen } from '../../utils/imagen.util';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult
} from '../archivo-selector-dialog/archivo-selector-dialog.component';

/** Valor que expone el control al formulario. */
export interface ImagenArchivoValor {
  url: string;
  archivoId?: string;
  storagePath?: string;
}

const EXTENSIONES_IMAGEN = ['png', 'jpg', 'jpeg', 'webp'];

/**
 * Campo de imagen respaldado por el Storage privado de la empresa (ArchivosService).
 * Comprime antes de subir para no agotar la cuota del plan.
 *
 * Es el gemelo de `app-selector-imagen` de sitio-web, que sube al Storage publico de
 * sitios. Aquel sirve a la tienda web; este a las pantallas internas.
 */
@Component({
  selector: 'app-selector-imagen-archivo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatProgressBarModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorImagenArchivoComponent),
      multi: true
    }
  ],
  template: `
    <div class="selector">
      <div
        class="lienzo"
        [class.vacio]="!valor()?.url"
        [class.invalido]="invalido()"
        [class.deshabilitado]="deshabilitado()"
      >
        @if (valor()?.url) {
          <img [src]="valor()!.url" [alt]="etiqueta()" loading="lazy" />
        } @else {
          <div class="placeholder">
            <mat-icon>add_photo_alternate</mat-icon>
            <span>Sin imagen</span>
          </div>
        }

        @if (subiendo()) {
          <div class="progreso">
            <mat-progress-bar mode="determinate" [value]="progreso()" />
          </div>
        }
      </div>

      <div class="controles">
        <button
          type="button"
          class="accion"
          [disabled]="subiendo() || deshabilitado()"
          (click)="fileInput.click()"
        >
          <mat-icon>upload</mat-icon>
          {{ subiendo() ? 'Subiendo...' : (valor()?.url ? 'Cambiar' : 'Subir') }}
        </button>
        <input
          #fileInput
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          [disabled]="subiendo() || deshabilitado()"
          (change)="subir($event)"
        />

        <button
          type="button"
          class="accion"
          [disabled]="subiendo() || deshabilitado()"
          (click)="abrirArchivos()"
        >
          <mat-icon>photo_library</mat-icon>
          Mis archivos
        </button>

        @if (valor()?.url) {
          <button
            type="button"
            class="accion quitar"
            [disabled]="subiendo() || deshabilitado()"
            (click)="quitar()"
          >
            <mat-icon>delete_outline</mat-icon>
            Quitar
          </button>
        }
      </div>

      @if (ayuda()) {
        <p class="ayuda">{{ ayuda() }}</p>
      }
    </div>
  `,
  styles: [`
    .selector { display: grid; gap: .6rem; justify-items: start; }
    .lienzo {
      position: relative;
      width: 100%;
      max-width: 220px;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      overflow: hidden;
      background: var(--tc-surface-container-low);
      display: grid;
      place-items: center;
    }
    .lienzo.vacio { outline: 1px dashed var(--tc-ghost-border); outline-offset: -1px; }
    .lienzo.invalido { outline: 2px dashed var(--tc-error); outline-offset: -2px; }
    .lienzo.deshabilitado { opacity: .6; }
    .lienzo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .placeholder { display: grid; justify-items: center; gap: .35rem; color: var(--muted-foreground); }
    .placeholder mat-icon { font-size: 34px; width: 34px; height: 34px; }
    .placeholder span { font-size: .8rem; }
    .progreso { position: absolute; inset: auto 0 0 0; }
    .controles { display: flex; flex-wrap: wrap; gap: .4rem; }
    .accion {
      display: inline-flex; align-items: center; gap: .3rem;
      min-height: 44px; padding: .55rem .75rem; border-radius: 8px; cursor: pointer;
      font-size: .82rem; white-space: nowrap;
      border: 1px solid var(--tc-ghost-border);
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .accion:disabled, .accion.inactiva { opacity: .55; pointer-events: none; }
    .accion mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .accion.quitar { color: var(--tc-error); border-color: transparent; background: transparent; }
    .ayuda { margin: 0; font-size: .78rem; color: var(--muted-foreground); }
  `]
})
export class SelectorImagenArchivoComponent implements ControlValueAccessor {
  private readonly archivosService = inject(ArchivosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  /** Modulo que se registra en la metadata del archivo subido. */
  readonly sourceModule = input('general');
  readonly etiqueta = input('Imagen');
  readonly ayuda = input('');
  /** Pinta el borde de error cuando el formulario ya marco el control. */
  readonly invalido = input(false);
  /** Peso maximo tras comprimir. Por defecto, el tope de imagen de producto. */
  readonly maxBytes = input(IMAGEN_PRODUCTO_MAX_BYTES);

  protected readonly valor = signal<ImagenArchivoValor | null>(null);
  protected readonly subiendo = signal(false);
  protected readonly progreso = signal(0);
  protected readonly deshabilitado = signal(false);

  private onChange: (valor: ImagenArchivoValor | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(valor: ImagenArchivoValor | null): void {
    this.valor.set(valor?.url ? valor : null);
  }

  registerOnChange(fn: (valor: ImagenArchivoValor | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.deshabilitado.set(disabled);
  }

  protected async subir(evento: Event): Promise<void> {
    // `input` es el simbolo de signals de Angular; se evita sombrearlo.
    const elemento = evento.target as HTMLInputElement;
    const archivo = elemento.files?.[0];
    elemento.value = '';

    if (!archivo) {
      return;
    }

    this.subiendo.set(true);
    this.progreso.set(0);

    try {
      const optimizado = await redimensionarImagen(archivo, { maxBytes: this.maxBytes() });

      if (optimizado.size > this.maxBytes()) {
        this.snackBar.open(
          `La imagen sigue pesando ${this.enMegas(optimizado.size)} tras comprimirla. ` +
            `El maximo es ${this.enMegas(this.maxBytes())}: guardala como WebP o recortala antes de subirla.`,
          'Cerrar',
          { duration: 6000 }
        );
        return;
      }

      const evento$ = this.archivosService
        .uploadArchivo(optimizado, { sourceModule: this.sourceModule() })
        .pipe(tap((evento) => this.progreso.set(evento.progress)));

      const final = await firstValueFrom(evento$.pipe(last()));
      if (final.item) {
        this.emitir({
          url: final.item.downloadUrl,
          archivoId: final.item.id,
          storagePath: final.item.storagePath
        });
      }
    } catch (error) {
      this.snackBar.open(
        error instanceof Error ? error.message : 'No se pudo subir la imagen.',
        'Cerrar',
        { duration: 4000 }
      );
    } finally {
      this.subiendo.set(false);
      this.progreso.set(0);
    }
  }

  protected async abrirArchivos(): Promise<void> {
    const ref = this.dialog.open<ArchivoSelectorDialogComponent, unknown, ArchivoSelectorDialogResult | null>(
      ArchivoSelectorDialogComponent,
      {
        injector: this.injector,
        data: {
          title: 'Imagenes de la empresa',
          subtitle: 'Reutiliza una imagen ya subida o carga una nueva.',
          sourceModule: this.sourceModule(),
          storageTarget: 'principal',
          extensions: EXTENSIONES_IMAGEN
        },
        maxWidth: '95vw',
        autoFocus: false
      }
    );

    const resultado = await firstValueFrom(ref.afterClosed());
    if (resultado?.archivo?.downloadUrl) {
      this.emitir({
        url: resultado.archivo.downloadUrl,
        archivoId: resultado.archivo.id,
        storagePath: resultado.archivo.storagePath
      });
    }
  }

  /**
   * Limpia la referencia pero deja el archivo en el Storage: puede estar en uso
   * en otro producto. El borrado real se hace desde el modulo de Archivos.
   */
  protected quitar(): void {
    this.emitir(null);
  }

  private enMegas(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.0', '')} MB`;
  }

  private emitir(valor: ImagenArchivoValor | null): void {
    this.valor.set(valor);
    this.onChange(valor);
    this.onTouched();
  }
}

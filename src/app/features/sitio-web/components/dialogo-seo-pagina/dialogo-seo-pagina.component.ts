import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PaginaDoc } from '@winsuite/bloques';
import { SelectorImagenComponent } from '../selector-imagen/selector-imagen.component';

export interface DialogoSeoPaginaData {
  pagina: PaginaDoc;
  tituloGlobal: string;
  descripcionGlobal: string;
  imagenGlobal?: string;
  urlBase: string;
}

@Component({
  selector: 'app-dialogo-seo-pagina',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, SelectorImagenComponent],
  template: `
    <h2 mat-dialog-title>SEO de “{{ data.pagina.titulo }}”</h2>
    <mat-dialog-content>
      <p class="intro">
        Los campos vacios usan la configuracion general del sitio. La vista previa es
        orientativa; cada buscador o red puede recortar el contenido.
      </p>

      <label>
        Titulo para buscadores
        <input [(ngModel)]="titulo" maxlength="200" [placeholder]="data.tituloGlobal" />
        <small>{{ titulo.length }}/200</small>
      </label>
      <label>
        Descripcion
        <textarea
          [(ngModel)]="descripcion"
          rows="3"
          maxlength="300"
          [placeholder]="data.descripcionGlobal"
        ></textarea>
        <small>{{ descripcion.length }}/300</small>
      </label>

      <div class="campo">
        <span>Imagen social propia de esta pagina</span>
        <app-selector-imagen
          [url]="imagen || data.imagenGlobal"
          (urlChange)="imagen = $event"
        />
        <small>Recomendado: 1200 × 630 px, HTTPS, JPG/WebP y menos de 300 KB.</small>
      </div>
      @if (imagen || data.imagenGlobal) {
        <label>
          Texto alternativo de la imagen
          <input [(ngModel)]="imagenAlt" maxlength="200" />
        </label>
      }

      <label class="check">
        <input type="checkbox" [(ngModel)]="noIndex" />
        Ocultar esta pagina de buscadores y del sitemap
      </label>

      <section class="preview" aria-label="Vista previa en buscadores">
        <span>{{ dominioMuestra }}</span>
        <strong>{{ titulo.trim() || data.tituloGlobal || data.pagina.titulo }}</strong>
        <p>{{ descripcion.trim() || data.descripcionGlobal }}</p>
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="guardar()">Guardar SEO</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      width: min(620px, 86vw);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .intro {
      margin: 0;
      color: var(--tc-on-surface-variant);
      line-height: 1.45;
    }
    label,
    .campo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-weight: 600;
    }
    input:not([type='checkbox']),
    textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      font: inherit;
      font-weight: 400;
    }
    small {
      color: var(--tc-on-surface-variant);
      font-weight: 400;
    }
    .check {
      min-height: 44px;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .preview {
      padding: 14px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px;
      background: var(--tc-surface-container-low);
      display: grid;
      gap: 4px;
    }
    .preview span {
      color: var(--tc-on-surface-variant);
      font-size: 0.78rem;
    }
    .preview strong {
      color: #1a0dab;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .preview p {
      margin: 0;
      line-height: 1.4;
    }
  `,
})
export class DialogoSeoPaginaComponent {
  readonly data = inject<DialogoSeoPaginaData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoSeoPaginaComponent>);

  titulo = this.data.pagina.seo?.title ?? '';
  descripcion = this.data.pagina.seo?.description ?? '';
  imagen = this.data.pagina.seo?.ogImageUrl ?? '';
  imagenAlt = this.data.pagina.seo?.ogImageAlt ?? '';
  noIndex = this.data.pagina.seo?.noIndex ?? false;
  readonly dominioMuestra = `${this.data.urlBase}/${this.data.pagina.slug}`.replace(/\/$/, '');

  guardar(): void {
    const seo: NonNullable<PaginaDoc['seo']> = {
      ...(this.titulo.trim() ? { title: this.titulo.trim() } : {}),
      ...(this.descripcion.trim() ? { description: this.descripcion.trim() } : {}),
      ...(this.imagen ? { ogImageUrl: this.imagen } : {}),
      ...((this.imagen || this.data.imagenGlobal)
        ? {
            ogImageAlt:
              this.imagenAlt.trim() || this.descripcion.trim() || this.data.descripcionGlobal,
          }
        : {}),
      ...(this.noIndex ? { noIndex: true } : {}),
    };
    this.ref.close(seo);
  }
}

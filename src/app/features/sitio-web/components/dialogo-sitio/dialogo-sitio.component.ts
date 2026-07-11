import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface DialogoSitioData {
  titulo: string;
  mensaje?: string;
  etiqueta?: string;
  valor?: string;
  confirmar?: string;
  peligro?: boolean;
  requerido?: boolean;
  maxLength?: number;
}

@Component({
  selector: 'app-dialogo-sitio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      @if (data.mensaje) { <p>{{ data.mensaje }}</p> }
      @if (data.etiqueta) {
        <mat-form-field appearance="outline" class="campo">
          <mat-label>{{ data.etiqueta }}</mat-label>
          <input matInput [(ngModel)]="valor" [maxlength]="data.maxLength ?? 80" autofocus
            (keydown.enter)="aceptar()" />
          @if (data.maxLength) { <mat-hint align="end">{{ valor.length }}/{{ data.maxLength }}</mat-hint> }
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button [class.peligro]="data.peligro" [disabled]="data.requerido && !valor.trim()"
        (click)="aceptar()">{{ data.confirmar ?? 'Aceptar' }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { min-width: min(420px, 75vw); color: #475569; }
    .campo { display: block; width: 100%; margin-top: 12px; }
    .peligro { --mdc-filled-button-container-color: #b91c1c; --mdc-filled-button-label-text-color: #fff; }
  `,
})
export class DialogoSitioComponent {
  protected readonly data = inject<DialogoSitioData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoSitioComponent, string | boolean>);
  protected valor = this.data.valor ?? '';

  protected aceptar(): void {
    if (this.data.requerido && !this.valor.trim()) return;
    this.ref.close(this.data.etiqueta ? this.valor.trim() : true);
  }
}

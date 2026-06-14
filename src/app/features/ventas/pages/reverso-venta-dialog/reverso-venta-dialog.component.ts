import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ReversoVentaDialogData {
  numeroVenta: string;
  clienteNombre: string;
}

@Component({
  selector: 'app-reverso-venta-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>Revertir venta {{ data.numeroVenta }}</h2>

    <mat-dialog-content>
      <p class="help-text">
        Esta accion devolvera stock al almacen original y marcara la venta como REVERTIDA.
      </p>

      <p class="help-subtext">
        Cliente: <strong>{{ data.clienteNombre || 'CLIENTE FINAL' }}</strong>
      </p>

      <mat-form-field appearance="outline">
        <mat-label>Motivo del reverso</mat-label>
        <textarea
          matInput
          rows="4"
          [formControl]="motivoControl"
          placeholder="Ejemplo: Error en metodo de pago o venta duplicada"
        ></textarea>
        @if (motivoControl.hasError('required') && motivoControl.touched) {
          <mat-error>El motivo es obligatorio.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close(undefined)">Cancelar</button>
      <button mat-raised-button color="warn" type="button" [disabled]="motivoControl.invalid" (click)="confirmar()">
        Confirmar reverso
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: grid; gap: .75rem; min-width: min(540px, 90vw); padding-top: .5rem; }
    mat-form-field { width: 100%; }
    .help-text { margin: 0; color: var(--muted-foreground); }
    .help-subtext { margin: 0; color: var(--foreground); }
  `]
})
export class ReversoVentaDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<ReversoVentaDialogComponent, string | undefined>);
  protected readonly data = inject<ReversoVentaDialogData>(MAT_DIALOG_DATA);

  protected readonly motivoControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected confirmar(): void {
    const motivo = this.motivoControl.value.trim();
    if (!motivo) {
      this.motivoControl.markAsTouched();
      return;
    }

    this.dialogRef.close(motivo);
  }
}

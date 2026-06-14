import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface FacturaConfirmDialogData {
  numeroVenta: string;
  clienteNombre: string;
  total: number;
  almacenNombre: string;
  firmaNombre: string;
}

@Component({
  selector: 'app-factura-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Confirmar facturación</h2>
    <mat-dialog-content class="content">
      <p>Vas a iniciar el proceso de autorización SRI para esta venta.</p>

      <div class="summary">
        <div><span>Venta</span><strong>{{ data.numeroVenta }}</strong></div>
        <div><span>Cliente</span><strong>{{ data.clienteNombre }}</strong></div>
        <div><span>Total</span><strong>{{ data.total | number:'1.2-2' }}</strong></div>
        <div><span>Almacén</span><strong>{{ data.almacenNombre }}</strong></div>
        <div><span>Firma</span><strong>{{ data.firmaNombre }}</strong></div>
      </div>

      <p class="hint">El sistema generará la factura, la firmará y consultará su autorización hasta completar el proceso.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="true">
        <mat-icon>receipt_long</mat-icon>
        Facturar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .content { display: grid; gap: 1rem; color: var(--foreground); }
    .summary {
      display: grid;
      gap: .6rem;
      padding: .75rem;
      border: 1px solid var(--border);
      border-radius: .75rem;
      background: var(--card);
      color: var(--card-foreground);
    }
    .summary div { display: flex; justify-content: space-between; gap: 1rem; }
    .summary span { color: var(--muted-foreground); }
    .summary strong { color: var(--card-foreground); }
    .hint { margin: 0; color: var(--muted-foreground); font-size: .92rem; }
  `]
})
export class FacturaConfirmDialogComponent {
  protected readonly data = inject<FacturaConfirmDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<FacturaConfirmDialogComponent>);
}

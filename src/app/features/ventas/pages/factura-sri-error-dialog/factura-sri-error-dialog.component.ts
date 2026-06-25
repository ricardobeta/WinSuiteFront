import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface FacturaSriErrorDialogData {
  estadoSri: string;
  claveAcceso: string | null;
  mensaje: string;
}

@Component({
  selector: 'app-factura-sri-error-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <mat-icon color="warn">error</mat-icon>
      <div>
        <p class="eyebrow">Respuesta del SRI</p>
        <h2 mat-dialog-title>Factura no autorizada</h2>
      </div>
    </div>

    <mat-dialog-content>
      <section class="status-box">
        <p><strong>Estado:</strong> {{ data.estadoSri || 'ERROR' }}</p>
        @if (data.claveAcceso) {
          <p><strong>Clave de acceso:</strong> <span class="access-key">{{ data.claveAcceso }}</span></p>
        }
      </section>

      <section>
        <h3>Motivo reportado</h3>
        <p class="message">{{ data.mensaje || 'El SRI no devolvió un detalle del error.' }}</p>
      </section>

      <section class="hint">
        <h3>Qué revisar</h3>
        <ul>
          <li>RUC, razón social, dirección matriz y establecimiento.</li>
          <li>Identificación y datos del cliente.</li>
          <li>Totales, impuestos, descuentos y forma de pago.</li>
          <li>Ambiente configurado para la empresa y certificado usado.</li>
        </ul>
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header { display: flex; align-items: center; gap: .75rem; padding: 1rem 1.25rem 0; }
    h2 { margin: 0; }
    .eyebrow { margin: 0 0 .15rem; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted-foreground); }
    .status-box { border: 1px solid color-mix(in srgb, #dc2626 35%, transparent); background: color-mix(in srgb, #fee2e2 55%, transparent); border-radius: .75rem; padding: .75rem; margin-bottom: .75rem; }
    .status-box p, .message { margin: .25rem 0; }
    .access-key { word-break: break-all; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .85rem; }
    h3 { margin: .75rem 0 .35rem; font-size: .95rem; }
    .hint { color: var(--muted-foreground); }
    ul { margin: .25rem 0 0; padding-left: 1.15rem; }
  `]
})
export class FacturaSriErrorDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: FacturaSriErrorDialogData) {}
}

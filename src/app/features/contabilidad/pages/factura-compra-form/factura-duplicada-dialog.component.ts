import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { FacturaCompra } from '../../models/compras.models';

export interface FacturaDuplicadaDialogData {
  factura: FacturaCompra;
}

export type FacturaDuplicadaAccion = 'ver' | undefined;

/**
 * Aviso de factura de compra duplicada: se muestra al cargar un XML cuyo documento ya existe.
 * Permite ir a la factura existente o continuar de todos modos.
 */
@Component({
  selector: 'app-factura-duplicada-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class.warn]="registrada" [class.info]="!registrada">{{ registrada ? 'error' : 'info' }}</mat-icon>
      Factura ya {{ registrada ? 'registrada' : 'cargada' }}
    </h2>

    <mat-dialog-content>
      <p>
        @if (registrada) {
          Esta factura <strong>ya fue registrada con éxito</strong> en el sistema.
        } @else {
          Ya existe una factura con este documento (en estado <strong>{{ estadoLabel }}</strong>).
        }
        No se cargó el XML.
      </p>
      <dl class="detalle">
        <div><dt>Número interno</dt><dd>{{ data.factura.numero || '—' }}</dd></div>
        <div><dt>Documento</dt><dd>{{ documento }}</dd></div>
        <div><dt>Proveedor</dt><dd>{{ data.factura.razonSocialProv }}</dd></div>
        <div><dt>Estado</dt><dd>{{ estadoLabel }}</dd></div>
      </dl>
      <p class="nota">Para evitar un duplicado contable, sube un XML diferente o revisa la factura existente.</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="'ver'" type="button">
        <mat-icon>open_in_new</mat-icon>
        Ver factura existente
      </button>
      <button mat-raised-button color="primary" [mat-dialog-close]="undefined" type="button">
        <mat-icon>upload_file</mat-icon>
        Subir otro XML
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: .5rem; }
    mat-icon.warn { color: #b3261e; }
    mat-icon.info { color: var(--primary); }
    .detalle { display: grid; gap: .4rem; margin: 1rem 0 0; min-width: min(460px, 78vw); }
    .detalle div { display: grid; grid-template-columns: 150px 1fr; gap: .5rem; }
    .detalle dt { margin: 0; color: var(--muted-foreground); }
    .detalle dd { margin: 0; font-weight: 600; }
    .nota { margin: 1rem 0 0; padding: .7rem .9rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 560px) { .detalle div { grid-template-columns: 1fr; gap: 0; } }
  `]
})
export class FacturaDuplicadaDialogComponent {
  protected readonly data = inject<FacturaDuplicadaDialogData>(MAT_DIALOG_DATA);

  protected readonly registrada = this.data.factura.estado === 'REGISTRADA';
  protected readonly estadoLabel = { BORRADOR: 'Borrador', REGISTRADA: 'Registrada', ANULADA: 'Anulada' }[this.data.factura.estado];
  protected readonly documento = `${this.data.factura.establecimiento}-${this.data.factura.puntoEmision}-${this.data.factura.secuencial}`;
}

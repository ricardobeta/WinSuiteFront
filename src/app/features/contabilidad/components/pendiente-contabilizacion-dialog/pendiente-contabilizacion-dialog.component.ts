import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { PendienteContabilizacion } from '../../models/contabilidad.models';

@Component({
  selector: 'app-pendiente-contabilizacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Detalle pendiente contable</h2>

    <mat-dialog-content class="dialog-content">
      <section class="summary">
        <mat-icon>warning</mat-icon>
        <div>
          <h3>{{ data.motivo }}</h3>
          <p>{{ etiquetaOrigen(data.origenTipo) }} · {{ data.origenNumero || data.origenId }}</p>
        </div>
        <mat-chip>{{ data.estado }}</mat-chip>
      </section>

      <section class="grid">
        <div>
          <span>Modulo origen</span>
          <strong>{{ data.origenModulo }}</strong>
        </div>
        <div>
          <span>Tipo origen</span>
          <strong>{{ etiquetaOrigen(data.origenTipo) }}</strong>
        </div>
        <div>
          <span>ID origen</span>
          <strong>{{ data.origenId }}</strong>
        </div>
        <div>
          <span>Creado</span>
          <strong>{{ data.creadoEn | date:'short' }}</strong>
        </div>
      </section>

      <section class="help-box">
        <h3>Que revisar</h3>
        <p>{{ recomendacion(data) }}</p>
      </section>

      <section class="detail-box">
        <h3>Detalle tecnico</h3>
        <pre>{{ data.detalle || data.motivo }}</pre>
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { display: grid; gap: 1rem; min-width: min(720px, 82vw); }
    .summary { display: grid; grid-template-columns: auto 1fr auto; gap: .75rem; align-items: center; padding: .9rem; border-radius: .5rem; background: color-mix(in srgb, #f59e0b 14%, transparent); }
    .summary mat-icon { color: #7a4b00; }
    .summary h3, .summary p, .help-box h3, .help-box p, .detail-box h3 { margin: 0; }
    .summary p, .grid span { color: var(--muted-foreground); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .grid div, .help-box, .detail-box { padding: .85rem; border-radius: .5rem; background: var(--tc-surface-container); }
    .grid div { display: grid; gap: .2rem; }
    .detail-box pre { white-space: pre-wrap; overflow: auto; max-height: 260px; margin: .5rem 0 0; font-size: .82rem; }
    @media (max-width: 760px) {
      .dialog-content { min-width: 0; }
      .summary, .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PendienteContabilizacionDialogComponent {
  protected readonly data = inject<PendienteContabilizacion>(MAT_DIALOG_DATA);

  protected etiquetaOrigen(origenTipo: PendienteContabilizacion['origenTipo']): string {
    const labels: Record<PendienteContabilizacion['origenTipo'], string> = {
      VENTA_POS: 'Venta POS',
      REVERSO_VENTA: 'Reverso de venta',
      RECEPCION_OC: 'Recepcion de orden de compra',
      REVERSO_RECEPCION_OC: 'Reverso de recepcion',
      FACTURA_COMPRA: 'Factura de compra',
      REVERSO_FACTURA_COMPRA: 'Reverso de factura de compra',
      ROL_PAGO: 'Rol de pago',
      REVERSO_ROL_PAGO: 'Reverso de rol de pago',
      CXP_MANUAL: 'Cuenta por pagar manual',
      REVERSO_CXP_MANUAL: 'Reverso CxP manual',
      PAGO_PROVEEDOR: 'Pago a proveedor',
      REVERSO_PAGO_PROVEEDOR: 'Reverso pago a proveedor'
    };
    return labels[origenTipo] ?? origenTipo;
  }

  protected recomendacion(pendiente: PendienteContabilizacion): string {
    if (pendiente.motivo.toLowerCase().includes('falta configurar')) {
      return 'Complete la cuenta faltante en Contabilidad > Configuracion > Integraciones o en el mapeo de categoria correspondiente.';
    }
    if (pendiente.motivo.toLowerCase().includes('periodo')) {
      return 'Revise que el periodo contable de la fecha del documento exista y este abierto.';
    }
    if (pendiente.origenTipo === 'RECEPCION_OC') {
      return 'Verifique que la recepcion tenga documento de proveedor, IVA correcto y cuentas de inventario, IVA compras y cuentas por pagar configuradas.';
    }
    if (pendiente.origenTipo === 'VENTA_POS') {
      return 'Verifique cuentas de caja/banco, cuentas por cobrar, ventas, IVA ventas, inventario y costo de ventas segun el tipo de producto.';
    }
    if (pendiente.origenTipo === 'ROL_PAGO') {
      return 'Revise las cuentas de Nomina, el periodo contable y los empleados incluidos en el rol de pago.';
    }
    return 'Revise la configuracion de integracion contable y vuelva a ejecutar o reintentar la operacion origen.';
  }
}

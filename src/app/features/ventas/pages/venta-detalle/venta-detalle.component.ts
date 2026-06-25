import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { VentaDetalle } from '../../models/ventas.models';
import { VentasService } from '../../services/ventas.service';
import { FacturaService, FacturaSriError } from '../../services/factura.service';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { FacturaConfirmDialogComponent } from '../factura-confirm-dialog/factura-confirm-dialog.component';
import { FacturaSriErrorDialogComponent } from '../factura-sri-error-dialog/factura-sri-error-dialog.component';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { FacturaEmisionEstado } from '../../../../shared/models/factura.models';

@Component({
  selector: 'app-venta-detalle',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    DatePipe
  ],
  template: `
    <section class="surface-card detalle-card">
      <header class="header">
        <a mat-button routerLink="/workspace/ventas/resumen">Volver</a>
        <div>
          <p class="eyebrow">Ventas</p>
          <h2>Detalle de venta</h2>
          @if (modoPruebaSoloGenerar) {
            <p class="modo-prueba-badge">Modo prueba activo: solo GENERADO</p>
          }
        </div>
        <div class="header-actions">
          @if (emision()?.documentosDisponibles) {
            <button mat-stroked-button type="button" (click)="descargar('ride')"><mat-icon>picture_as_pdf</mat-icon> RIDE</button>
            <button mat-stroked-button type="button" (click)="descargar('xml')"><mat-icon>code</mat-icon> XML</button>
          }
          <button
            mat-raised-button
            color="primary"
            type="button"
            [disabled]="cargando() || facturando() || !puedeSolicitarFacturacion()"
            (click)="facturar()"
          >
            @if (facturando()) {
              <mat-spinner diameter="18"></mat-spinner>
              {{ pasoFactura() }}
            } @else {
              <span class="button-content">
                <mat-icon>receipt_long</mat-icon>
                <span>{{ etiquetaBotonFacturar() }}</span>
              </span>
            }
          </button>
        </div>
      </header>

      @if (cargando()) {
        <p>Cargando detalle...</p>
      } @else if (!detalle()) {
        <p>No se encontro la venta solicitada.</p>
      } @else {
        <section class="summary">
          <p><strong>Numero:</strong> {{ detalle()!.documento.numero }}</p>
          <p><strong>Cliente:</strong> {{ detalle()!.documento.clienteNombre }}</p>
          <p><strong>Fecha:</strong> {{ detalle()!.documento.creadoEn | date:'short' }}</p>
          <p><strong>Estado:</strong> {{ detalle()!.documento.estado }}</p>
          <p>
            <strong>Contabilidad:</strong>
            <span class="contabilidad-badge" [class.generated]="estadoContable() === 'ASIENTO_GENERADO'" [class.pending]="estadoContable() === 'PENDIENTE'">
              {{ etiquetaEstadoContable() }}
            </span>
          </p>
          @if (emision()) {
            <p><strong>SRI:</strong> {{ emision()!.estadoSri }} · {{ emision()!.numeroAutorizacion || 'Sin autorización' }}</p>
            <p><strong>Correo:</strong> {{ etiquetaCorreo(emision()!) }}</p>
          }
        </section>

        <section>
          <h3>Items</h3>
          <div class="line-items">
            @for (item of detalle()!.items; track item.id) {
              <article>
                <p>{{ item.nombre }} · {{ item.sku }}</p>
                <p>{{ item.cantidad }} x {{ formatMoney(item.precioUnitario) }}</p>
                <strong>{{ formatMoney(item.subtotalItem) }}</strong>
              </article>
            }
          </div>
        </section>

        <section>
          <h3>Pagos</h3>
          <div class="line-items">
            @for (pago of detalle()!.pagos; track pago.id) {
              <article>
                <p>{{ pago.metodo }}</p>
                <p>{{ pago.referencia || 'Sin referencia' }}</p>
                <strong>{{ formatMoney(pago.monto) }}</strong>
              </article>
            }
          </div>
        </section>

        <section class="totales">
          <p>Subtotal: <strong>{{ formatMoney(detalle()!.documento.subtotal) }}</strong></p>
          <p>Descuento: <strong>{{ formatMoney(detalle()!.documento.descuento) }}</strong></p>
          <p>Impuesto: <strong>{{ formatMoney(detalle()!.documento.impuesto) }}</strong></p>
          <p>Total: <strong>{{ formatMoney(detalle()!.documento.total) }}</strong></p>
        </section>
      }
    </section>
  `,
  styles: [`
    .detalle-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .header { display: flex; align-items: center; gap: .8rem; justify-content: space-between; flex-wrap: wrap; }
    .header h2 { margin: 0; }
    .header-actions { display: inline-flex; gap: .5rem; align-items: center; }
    .button-content { display: inline-flex; align-items: center; gap: .35rem; }
    .modo-prueba-badge {
      margin: .35rem 0 0;
      display: inline-block;
      font-size: .75rem;
      font-weight: 700;
      letter-spacing: .03em;
      padding: .2rem .5rem;
      border-radius: 999px;
      color: #664d03;
      background: #fff3cd;
      border: 1px solid #ffecb5;
    }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
    .summary p { margin: 0; }
    .contabilidad-badge { display: inline-flex; align-items: center; min-height: 24px; padding: .1rem .5rem; border-radius: 999px; font-size: .78rem; font-weight: 700; background: color-mix(in srgb, var(--outline) 20%, transparent); color: var(--muted-foreground); }
    .contabilidad-badge.generated { background: color-mix(in srgb, #0f766e 16%, transparent); color: #0f5f59; }
    .contabilidad-badge.pending { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #7a4b00; }
    .line-items { display: grid; gap: .5rem; }
    .line-items article { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .65rem; padding: .6rem .75rem; display: flex; justify-content: space-between; gap: .5rem; align-items: center; }
    .line-items p { margin: 0; }
    .totales { border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); padding-top: .75rem; display: grid; gap: .25rem; }
    .totales p { margin: 0; display: flex; justify-content: space-between; }
    @media (max-width: 900px) { .summary { grid-template-columns: 1fr; } .line-items article { flex-direction: column; align-items: flex-start; } }
  `]
})
export class VentaDetalleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly ventasService = inject(VentasService);
  private readonly facturaService = inject(FacturaService);
  private readonly facturacionService = inject(FacturacionConfigService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detalle = signal<VentaDetalle | null>(null);
  protected readonly ventaId = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly facturando = signal(false);
  protected readonly pasoFactura = signal('');
  protected readonly puedeFacturar = signal(false);
  protected readonly estadoContable = signal<'DESACTIVADA' | 'ASIENTO_GENERADO' | 'PENDIENTE'>('DESACTIVADA');
  protected readonly emision = signal<FacturaEmisionEstado | null>(null);
  protected readonly modoPruebaSoloGenerar = false;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.ventaId.set(id);

      if (!id) {
        this.detalle.set(null);
        this.cargando.set(false);
        return;
      }

      this.cargando.set(true);
      this.integracionContable
        .getEstadoOrigen('VENTA_POS', id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((estado) => this.estadoContable.set(estado));

      void this.ventasService.getVentaDetalle(id)
        .then(async (detalle) => {
          this.detalle.set(detalle);

          void this.facturaService.getEmision(id).then((emision) => this.emision.set(emision)).catch(() => undefined);

          if (detalle?.documento.almacenId) {
            const firma = await firstValueFrom(this.facturacionService.getFirmaParaAlmacen(detalle.documento.almacenId));
            this.puedeFacturar.set(!!firma);
          } else {
            this.puedeFacturar.set(false);
          }
        })
        .finally(() => this.cargando.set(false));
    });
  }

  protected formatMoney(value: number | null | undefined): string {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    if (!isFinite(n)) return '0.00';

    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.round(n * 100) / 100);
  }

  protected etiquetaEstadoContable(): string {
    switch (this.estadoContable()) {
      case 'ASIENTO_GENERADO':
        return 'Asiento generado';
      case 'PENDIENTE':
        return 'Pendiente contable';
      default:
        return 'Contabilidad desactivada';
    }
  }

  protected async facturar(): Promise<void> {
    const detalle = this.detalle();
    const ventaId = this.ventaId();
    if (!detalle || !ventaId) {
      return;
    }
    if (!this.puedeSolicitarFacturacion()) {
      const emision = this.emision();
      const estado = (emision?.estadoSri ?? '').trim().toUpperCase();
      const mensaje = emision?.autorizada || estado === 'AUTORIZADO' || estado === 'AUTORIZADA'
        ? 'Esta venta ya tiene una factura autorizada.'
        : 'Ya existe una emisión en proceso para esta venta.';
      this.snackBar.open(mensaje, 'Cerrar', { duration: 2800 });
      return;
    }

    const firma = await firstValueFrom(this.facturacionService.getFirmaParaAlmacen(detalle.documento.almacenId));
    const almacen = await firstValueFrom(this.facturacionService.getPuntoEmisionParaAlmacen(detalle.documento.almacenId));

    if (!firma || !almacen) {
      this.snackBar.open('No hay punto de emisión o firma configurados para este almacén.', 'Cerrar', { duration: 2800 });
      return;
    }

    const dialogRef = this.dialog.open(FacturaConfirmDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        numeroVenta: detalle.documento.numero,
        clienteNombre: detalle.documento.clienteNombre || 'CONSUMIDOR FINAL',
        total: detalle.documento.total,
        almacenNombre: almacen.descripcion || almacen.codigo,
        firmaNombre: firma.nombreArchivo
      }
    });

    const confirmado = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmado) {
      return;
    }

    if (this.modoPruebaSoloGenerar) {
      this.snackBar.open('Modo prueba activo: solo se ejecutará el paso GENERADO.', 'Cerrar', { duration: 2800 });
    }

    this.facturando.set(true);
    this.pasoFactura.set('Generando...');

    try {
      const resultado = await this.facturaService.emitirYAutorizarFactura(ventaId, {
        onStep: (step) => {
          switch (step) {
            case 'armando':
              this.pasoFactura.set('Preparando factura...');
              break;
            case 'generando':
              this.pasoFactura.set('Generando factura...');
              break;
            case 'firmando':
              this.pasoFactura.set('Firmando y enviando...');
              break;
            case 'autorizando':
              this.pasoFactura.set('Consultando autorización SRI...');
              break;
            case 'autorizada':
              this.pasoFactura.set('Autorizada');
              break;
            default:
              this.pasoFactura.set('');
          }
        }
      });
      this.emision.set(resultado.emision ?? null);

      const esModoPrueba = (resultado.respuestaAutorizacion.estado ?? '').includes('MODO_PRUEBA');
      const mensaje = esModoPrueba
        ? `Factura generada (modo prueba). Clave de acceso: ${resultado.claveAcceso}`
        : `Factura autorizada. Nro autorización: ${resultado.respuestaAutorizacion.numeroAutorizacion ?? 'N/D'}`;

      this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la facturación.';
      if (error instanceof FacturaSriError) {
        if (error.emision) {
          this.emision.set(error.emision);
        } else {
          await this.refrescarEmision();
        }
        this.mostrarErrorSri(error.estadoSri, error.claveAcceso, error.mensajes || message);
      } else {
        this.snackBar.open(message, 'Cerrar', { duration: 3500 });
      }
    } finally {
      this.facturando.set(false);
      this.pasoFactura.set('');
    }
  }

  protected etiquetaCorreo(emision: FacturaEmisionEstado): string {
    if (emision.emailEstado === 'SENT') {
      return `Enviado por ${emision.emailCanal === 'TENANT_SMTP' ? 'correo de la empresa' : 'WinSuite'}${emision.emailFallbackAplicado ? ' (respaldo)' : ''}`;
    }
    if (emision.emailEstado === 'SKIPPED_NO_RECIPIENT') return 'Sin destinatario; documentos disponibles';
    if (emision.emailEstado === 'FAILED') return `Fallido: ${emision.emailError || 'revisa la configuración'}`;
    return emision.emailEstado || 'Pendiente';
  }

  private async refrescarEmision(): Promise<void> {
    const ventaId = this.ventaId();
    if (!ventaId) return;
    try {
      this.emision.set(await this.facturaService.getEmision(ventaId));
    } catch {
      // Si no se puede refrescar, el popup igual mostrara el error recibido.
    }
  }

  private mostrarErrorSri(estadoSri: string, claveAcceso: string | null, mensaje: string): void {
    this.dialog.open(FacturaSriErrorDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { estadoSri, claveAcceso, mensaje }
    });
  }

  protected puedeSolicitarFacturacion(): boolean {
    if (!this.puedeFacturar()) return false;
    const emision = this.emision();
    if (!emision?.claveAcceso && !emision?.estadoSri) return true;

    const estado = (emision.estadoSri ?? '').trim().toUpperCase();
    return estado === 'ERROR';
  }

  protected etiquetaBotonFacturar(): string {
    const emision = this.emision();
    const estado = (emision?.estadoSri ?? '').trim().toUpperCase();
    if (emision?.autorizada || estado === 'AUTORIZADO' || estado === 'AUTORIZADA') return 'Facturada';
    if (['NO_AUTORIZADO', 'NO AUTORIZADO', 'RECHAZADO', 'DEVUELTA'].includes(estado)) return 'No autorizada';
    if (estado === 'ERROR') return 'Reintentar facturación';
    if (emision?.claveAcceso || estado) return 'Emisión en proceso';
    return 'Facturar';
  }

  protected descargar(tipo: 'ride' | 'xml'): void {
    const ventaId = this.ventaId();
    if (!ventaId) return;
    this.facturaService.descargarDocumento(ventaId, tipo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `factura-${this.emision()?.claveAcceso || ventaId}.${tipo === 'ride' ? 'pdf' : 'xml'}`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('No se pudo descargar el documento.', 'Cerrar', { duration: 2800 })
    });
  }
}

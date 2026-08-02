import { DOCUMENT } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';

import { MetodoPago, MetodosPago, OrdenCompra } from '../../../../core/models/platform.models';
import { OrdersService } from '../../../../core/services/orders.service';

/** Lo que se quiere comprar. El importe no viaja: lo pone el backend desde el catalogo. */
export interface CheckoutData {
  titulo: string;
  descripcion: string;
  planId?: string | null;
  complementos?: { addonId: string; cantidad: number }[];
}

type Fase = 'metodo' | 'payphone' | 'instrucciones' | 'listo';

/**
 * Compra de un plan o de un complemento.
 *
 * <p>Con tarjeta se monta la Cajita oficial de Payphone, que cobra y devuelve al navegador a
 * esta misma pagina con el identificador de la transaccion; la confirmacion la hace el servidor.
 * Con transferencia o QR la orden queda a la espera de que el super administrador verifique el
 * deposito.
 */
@Component({
  selector: 'app-checkout-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>shopping_cart</mat-icon>
      {{ data.titulo }}
    </h2>

    <mat-dialog-content>
      @if (cargando()) {
        <div class="centro"><mat-spinner diameter="36" /></div>
      }

      @if (error()) {
        <p class="error">
          <mat-icon>error_outline</mat-icon>
          {{ error() }}
        </p>
      }

      @switch (fase()) {
        @case ('metodo') {
          <p class="detalle">{{ data.descripcion }}</p>

          @if (!hayMetodos() && !cargando()) {
            <p class="vacio">
              Ahora mismo no hay ningun metodo de pago habilitado. Escribe a WinSuit y activamos tu
              ampliacion a mano.
            </p>
          } @else {
            <mat-radio-group [(ngModel)]="metodo" class="metodos">
              @if (metodos()?.payphoneHabilitado) {
                <mat-radio-button value="payphone">
                  <strong>Tarjeta de credito o debito</strong>
                  <small>Se activa al instante, procesado por Payphone.</small>
                </mat-radio-button>
              }
              @if (metodos()?.transferenciaHabilitada) {
                <mat-radio-button value="transferencia">
                  <strong>Transferencia bancaria</strong>
                  <small>Se activa cuando confirmemos el deposito.</small>
                </mat-radio-button>
              }
              @if (metodos()?.qrHabilitado) {
                <mat-radio-button value="qr">
                  <strong>Pago con QR</strong>
                  <small>Se activa cuando confirmemos el deposito.</small>
                </mat-radio-button>
              }
            </mat-radio-group>
          }
        }

        @case ('payphone') {
          <p class="detalle">
            Total a pagar: <strong>{{ totalTexto() }}</strong>
          </p>
          <p class="nota">
            Completa el pago en el recuadro de Payphone. Al terminar volveras aqui y activaremos tu
            compra automaticamente.
          </p>
          <div id="pp-button"></div>
        }

        @case ('instrucciones') {
          <p class="detalle">
            Total a pagar: <strong>{{ totalTexto() }}</strong>
          </p>

          @if (metodo === 'qr' && metodos()?.qrImagenUrl) {
            <img class="qr" [src]="metodos()!.qrImagenUrl!" alt="Codigo QR para el pago" />
            @if (metodos()?.qrInstrucciones) {
              <p class="nota">{{ metodos()!.qrInstrucciones }}</p>
            }
          }

          @if (metodo === 'transferencia') {
            @if (metodos()?.transferenciaInstrucciones) {
              <p class="nota">{{ metodos()!.transferenciaInstrucciones }}</p>
            }
            @for (cuenta of metodos()?.cuentas ?? []; track cuenta.numero) {
              <div class="cuenta">
                <strong>{{ cuenta.banco }}</strong>
                <span>{{ cuenta.tipo }} &middot; {{ cuenta.numero }}</span>
                <span>{{ cuenta.titular }} &middot; {{ cuenta.identificacion }}</span>
              </div>
            }
          }

          <p class="nota">
            Usa el numero de orden <strong>{{ orden()?.id }}</strong> como referencia y adjunta el
            comprobante.
          </p>

          <mat-form-field appearance="outline" class="ancho">
            <mat-label>Numero de documento o referencia</mat-label>
            <input matInput [(ngModel)]="referencia" maxlength="60" />
          </mat-form-field>

          <div class="archivo">
            <button mat-stroked-button type="button" (click)="selector.click()">
              <mat-icon>attach_file</mat-icon>
              {{ archivo() ? archivo()!.name : 'Adjuntar comprobante' }}
            </button>
            <input
              #selector
              type="file"
              hidden
              accept="image/*,application/pdf"
              (change)="elegirArchivo($event)"
            />
          </div>
        }

        @case ('listo') {
          <div class="listo">
            <mat-icon>check_circle</mat-icon>
            <p>{{ mensajeFinal() }}</p>
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @switch (fase()) {
        @case ('metodo') {
          <button mat-button type="button" (click)="cerrar(false)">Cancelar</button>
          <button
            mat-raised-button
            color="primary"
            type="button"
            [disabled]="!metodo || cargando()"
            (click)="continuar()"
          >
            Continuar
          </button>
        }
        @case ('payphone') {
          <button mat-button type="button" (click)="cerrar(false)">Cancelar</button>
        }
        @case ('instrucciones') {
          <button mat-button type="button" (click)="cerrar(true)">Lo hare despues</button>
          <button
            mat-raised-button
            color="primary"
            type="button"
            [disabled]="!archivo() || cargando()"
            (click)="enviarComprobante()"
          >
            Enviar comprobante
          </button>
        }
        @case ('listo') {
          <button mat-raised-button color="primary" type="button" (click)="cerrar(true)">
            Entendido
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: .5rem; }
    .centro { display: grid; place-items: center; padding: 1rem; }
    .detalle { margin: 0 0 1rem; }
    .nota { margin: 0 0 1rem; color: var(--muted-foreground); font-size: .9rem; }
    .vacio { margin: 0; color: var(--muted-foreground); }
    .error { display: flex; align-items: center; gap: .4rem; margin: 0 0 1rem; color: #b3261e; }
    .metodos { display: grid; gap: .6rem; }
    .metodos mat-radio-button strong { display: block; }
    .metodos mat-radio-button small { color: var(--muted-foreground); }
    .cuenta {
      display: grid; gap: .15rem; padding: .7rem; margin-bottom: .6rem;
      border-radius: var(--tc-radius-md, 10px); background: var(--tc-surface-container-low);
    }
    .cuenta span { color: var(--muted-foreground); font-size: .9rem; }
    .qr { display: block; max-width: 240px; margin: 0 auto 1rem; border-radius: var(--tc-radius-md, 10px); }
    .ancho { width: 100%; }
    .archivo { margin-top: .3rem; }
    .listo { display: grid; justify-items: center; gap: .6rem; text-align: center; padding: 1rem 0; }
    .listo mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: var(--primary); }
    .listo p { margin: 0; }
  `],
})
export class CheckoutDialogComponent implements OnInit {
  protected readonly data = inject<CheckoutData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CheckoutDialogComponent>);
  private readonly ordersService = inject(OrdersService);
  private readonly documento = inject(DOCUMENT);

  protected readonly fase = signal<Fase>('metodo');
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly metodos = signal<MetodosPago | null>(null);
  protected readonly orden = signal<OrdenCompra | null>(null);
  protected readonly archivo = signal<File | null>(null);

  protected metodo: MetodoPago | null = null;
  protected referencia = '';

  protected readonly hayMetodos = computed(() => {
    const metodos = this.metodos();
    return (
      !!metodos &&
      (metodos.payphoneHabilitado || metodos.transferenciaHabilitada || metodos.qrHabilitado)
    );
  });

  protected readonly totalTexto = computed(() => {
    const orden = this.orden();
    if (!orden) return '';
    return `${orden.moneda || 'USD'} ${(orden.totalCentavos / 100).toFixed(2)}`;
  });

  protected readonly mensajeFinal = signal(
    'Recibimos tu comprobante. En cuanto verifiquemos el deposito activaremos tu compra.',
  );

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      const metodos = await this.ordersService.metodosPago();
      this.metodos.set(metodos);
      // Se preselecciona el primero disponible para ahorrar un clic.
      this.metodo = metodos.payphoneHabilitado
        ? 'payphone'
        : metodos.transferenciaHabilitada
          ? 'transferencia'
          : metodos.qrHabilitado
            ? 'qr'
            : null;
    } catch {
      this.error.set('No pudimos cargar los metodos de pago. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async continuar(): Promise<void> {
    if (!this.metodo) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      const orden = await this.ordersService.crear({
        metodoPago: this.metodo,
        planId: this.data.planId ?? null,
        complementos: this.data.complementos ?? [],
      });
      this.orden.set(orden);

      if (this.metodo === 'payphone') {
        this.fase.set('payphone');
        await this.montarCajita(orden);
      } else {
        this.fase.set('instrucciones');
      }
    } catch (e) {
      this.error.set(this.mensajeDeError(e, 'No pudimos crear la orden.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement | null;
    this.archivo.set(input?.files?.[0] ?? null);
  }

  protected async enviarComprobante(): Promise<void> {
    const orden = this.orden();
    const archivo = this.archivo();
    if (!orden || !archivo) return;

    this.cargando.set(true);
    this.error.set('');
    try {
      await this.ordersService.subirComprobante(orden.id, archivo, this.referencia);
      this.fase.set('listo');
    } catch (e) {
      this.error.set(this.mensajeDeError(e, 'No pudimos registrar el comprobante.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cerrar(recargar: boolean): void {
    this.dialogRef.close(recargar);
  }

  /**
   * Cajita de Pagos oficial de Payphone. Los montos van en centavos y el clientTransactionId es
   * nuestro id de orden: es lo que despues permite confirmar el cobro contra la orden correcta.
   */
  private async montarCajita(orden: OrdenCompra): Promise<void> {
    const metodos = this.metodos();
    if (!metodos?.payphoneToken) {
      this.error.set('El pago con tarjeta no esta disponible ahora mismo.');
      return;
    }
    await this.cargarRecursosPayphone();

    const PPaymentButtonBox = (
      globalThis as unknown as {
        PPaymentButtonBox?: new (config: object) => { render: (id: string) => void };
      }
    ).PPaymentButtonBox;
    if (!PPaymentButtonBox) {
      this.error.set('No pudimos cargar el formulario de pago. Revisa tu conexion.');
      return;
    }

    new PPaymentButtonBox({
      token: metodos.payphoneToken,
      clientTransactionId: orden.id,
      amount: orden.totalCentavos,
      amountWithoutTax: orden.totalCentavos,
      currency: 'USD',
      storeId: metodos.payphoneStoreId,
      reference: `WinSuit ${orden.id}`,
      lang: 'es',
    }).render('pp-button');
  }

  private cargarRecursosPayphone(): Promise<void> {
    return new Promise((resolver) => {
      if (this.documento.getElementById('pp-box-js')) {
        resolver();
        return;
      }
      const css = this.documento.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css';
      this.documento.head.appendChild(css);

      const script = this.documento.createElement('script');
      script.id = 'pp-box-js';
      script.type = 'module';
      script.src = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js';
      script.onload = () => resolver();
      script.onerror = () => resolver();
      this.documento.head.appendChild(script);
    });
  }

  private mensajeDeError(error: unknown, porDefecto: string): string {
    const cuerpo = (error as { error?: { error?: string } })?.error;
    if (cuerpo?.error) return cuerpo.error;
    if (error instanceof Error && error.message) return error.message;
    return porDefecto;
  }
}

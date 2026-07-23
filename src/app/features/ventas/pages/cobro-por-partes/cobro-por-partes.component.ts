import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { ClienteFormDialogComponent } from '../../../../shared/components/cliente-form-dialog/cliente-form-dialog.component';
import { ClienteDialogData } from '../../../../shared/models/clientes.models';
import { CarritoItem, MetodoPagoVenta } from '../../models/ventas.models';
import { calcularResumenVenta, obtenerTarifaIva } from '../../services/ventas-calculos.util';

export interface CobroPorPartesCliente {
  id: string;
  nombre: string;
  identificacion: string;
}

export interface CobroPorPartesRequest {
  items: CarritoItem[];
  clienteId: string | null;
  clienteNombre: string;
  metodoPago: MetodoPagoVenta;
  referencia: string;
  efectivoRecibido: number | null;
}

const ETIQUETAS_METODO: Record<MetodoPagoVenta, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'Tarjeta de crédito',
  TARJETA_DEBITO: 'Tarjeta de débito',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CREDITO_CLIENTE: 'Crédito cliente'
};

function claveItem(item: Pick<CarritoItem, 'itemTipo' | 'productoId'>): string {
  return `${item.itemTipo}:${item.productoId}`;
}

@Component({
  selector: 'app-cobro-por-partes',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <section class="split-shell">
      <header class="split-header">
        <div>
          <p class="eyebrow">Cobro secuencial</p>
          <h2>Cobrar {{ etiquetaCuenta().toLowerCase() }} por partes</h2>
          <p>Selecciona lo que pagará una persona. El resto seguirá disponible en la cuenta principal.</p>
        </div>

        <div class="header-actions">
          @if (comprasCompletadas() > 0) {
            <span class="completed-badge">
              <mat-icon>check_circle</mat-icon>
              {{ comprasCompletadas() }} compra(s) realizada(s)
            </span>
          }
          <button mat-stroked-button type="button" [disabled]="procesando()" (click)="salir.emit()">
            <mat-icon>arrow_back</mat-icon>
            Volver al POS
          </button>
        </div>
      </header>

      @if (mensajeResultado()) {
        <div class="result-banner">
          <mat-icon>task_alt</mat-icon>
          <span>{{ mensajeResultado() }}</span>
        </div>
      }

      <div class="split-layout">
        <article class="surface-card split-panel account-panel">
          <header class="step-head">
            <span class="step-number">1</span>
            <div>
              <h3>Artículos y cantidades</h3>
              <p>{{ unidadesPendientes() }} unidad(es) pendientes en la cuenta principal</p>
            </div>
          </header>

          <div class="pending-items">
            @for (item of items(); track item.itemTipo + ':' + item.productoId) {
              <section class="pending-item" [class.selected]="cantidadSeleccionada(item) > 0">
                <div class="item-copy">
                  <p class="item-name">{{ item.nombre }}</p>
                  <p class="item-meta">
                    {{ item.sku }} · quedan {{ item.cantidad }} ·
                    {{ totalLinea(item) | number:'1.2-2' }}
                  </p>
                  <p class="item-tax">
                    IVA {{ tarifaIva(item) | number:'1.0-2' }}%
                  </p>
                </div>

                <div class="quantity-zone">
                  <button
                    type="button"
                    class="quantity-btn"
                    aria-label="Quitar una unidad"
                    [disabled]="cantidadSeleccionada(item) === 0 || procesando()"
                    (click)="cambiarCantidad(item, -1)"
                  >
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="quantity-value">{{ cantidadSeleccionada(item) }}</span>
                  <button
                    type="button"
                    class="quantity-btn"
                    aria-label="Agregar una unidad"
                    [disabled]="cantidadSeleccionada(item) >= item.cantidad || procesando()"
                    (click)="cambiarCantidad(item, 1)"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                </div>

                <div class="item-shortcuts">
                  @if (cantidadSeleccionada(item) > 0) {
                    <button mat-button type="button" [disabled]="procesando()" (click)="seleccionarCantidad(item, 0)">
                      Quitar
                    </button>
                  }
                  <button mat-stroked-button type="button" [disabled]="procesando()" (click)="seleccionarCantidad(item, item.cantidad)">
                    Todo
                  </button>
                </div>
              </section>
            }
          </div>
        </article>

        <article class="surface-card split-panel checkout-panel">
          <section class="checkout-step">
            <header class="step-head compact">
              <span class="step-number">2</span>
              <div>
                <h3>Cliente</h3>
                <p>Selecciona a quién corresponde esta compra.</p>
              </div>
            </header>

            <div class="customer-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Cliente</mat-label>
                <mat-select [value]="clienteId()" [disabled]="procesando()" (selectionChange)="seleccionarCliente($event.value)">
                  <mat-option [value]="null">Consumidor final</mat-option>
                  @for (cliente of clientesDisponibles(); track cliente.id) {
                    <mat-option [value]="cliente.id">
                      {{ cliente.nombre }} · {{ cliente.identificacion }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button type="button" [disabled]="procesando()" (click)="crearCliente()">
                <mat-icon>person_add</mat-icon>
                Nuevo
              </button>
            </div>
          </section>

          <section class="checkout-step">
            <header class="step-head compact">
              <span class="step-number">3</span>
              <div>
                <h3>Pago</h3>
                <p>Esta compra acepta una forma de pago.</p>
              </div>
            </header>

            <div class="payment-methods">
              @for (metodo of metodosNormalizados(); track metodo) {
                <button
                  mat-stroked-button
                  type="button"
                  class="payment-method"
                  [class.active]="metodoPago() === metodo"
                  [disabled]="procesando()"
                  (click)="metodoPago.set(metodo)"
                >
                  <mat-icon>{{ iconoMetodo(metodo) }}</mat-icon>
                  {{ etiquetaMetodo(metodo) }}
                </button>
              }
            </div>

            @if (metodoPago() !== 'EFECTIVO') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="reference-field">
                <mat-label>Referencia (opcional)</mat-label>
                <input
                  matInput
                  [value]="referencia()"
                  [disabled]="procesando()"
                  (input)="setReferencia($event)"
                />
              </mat-form-field>
            } @else {
              <div class="cash-row">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Efectivo recibido</mat-label>
                  <input
                    matInput
                    type="number"
                    min="0"
                    step="0.01"
                    [value]="efectivoRecibido() ?? ''"
                    [disabled]="procesando()"
                    (input)="setEfectivo($event)"
                  />
                </mat-form-field>
                <button mat-stroked-button type="button" [disabled]="procesando() || resumenSeleccion().total <= 0" (click)="efectivoExacto()">
                  Exacto
                </button>
              </div>
              @if (cambio() !== null) {
                <p class="change-line">Cambio <strong>{{ cambio() | number:'1.2-2' }}</strong></p>
              }
            }
          </section>

          <section class="purchase-summary">
            <div>
              <span>Artículos seleccionados</span>
              <strong>{{ unidadesSeleccionadas() }}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{{ resumenSeleccion().subtotalBruto | number:'1.2-2' }}</strong>
            </div>
            @if (resumenSeleccion().descuentoItems > 0) {
              <div>
                <span>Descuentos por artículo</span>
                <strong>-{{ resumenSeleccion().descuentoItems | number:'1.2-2' }}</strong>
              </div>
            }
            <section class="tax-breakdown" aria-label="Desglose de IVA por tarifa">
              <div class="tax-breakdown-head">
                <strong>Desglose de IVA</strong>
                <span>Base</span>
                <span>IVA</span>
              </div>
              @for (iva of resumenSeleccion().desgloseIva; track iva.tarifa) {
                <div class="tax-breakdown-row">
                  <span>Tarifa {{ iva.tarifa | number:'1.0-2' }}%</span>
                  <span>{{ iva.baseImponible | number:'1.2-2' }}</span>
                  <strong>{{ iva.impuesto | number:'1.2-2' }}</strong>
                </div>
              }
            </section>
            <div class="tax-total">
              <span>IVA total</span>
              <strong>{{ resumenSeleccion().impuesto | number:'1.2-2' }}</strong>
            </div>
            <div class="purchase-total">
              <span>Total de esta compra</span>
              <strong>{{ resumenSeleccion().total | number:'1.2-2' }}</strong>
            </div>
          </section>

          @if (errorValidacion()) {
            <p class="validation-error">
              <mat-icon>info</mat-icon>
              {{ errorValidacion() }}
            </p>
          }

          <footer class="checkout-actions">
            <button mat-stroked-button type="button" [disabled]="procesando() || unidadesSeleccionadas() === 0" (click)="limpiarSeleccion()">
              Limpiar selección
            </button>
            <button
              mat-flat-button
              color="primary"
              type="button"
              [disabled]="procesando() || unidadesSeleccionadas() === 0 || !!errorValidacion()"
              (click)="confirmar()"
            >
              <mat-icon>payments</mat-icon>
              {{ procesando() ? 'Procesando...' : 'Cobrar esta selección' }}
            </button>
          </footer>
        </article>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .split-shell { display: grid; gap: 1rem; min-width: 0; }
    .split-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: .25rem 0;
    }
    .split-header h2 { margin: .15rem 0 0; font-size: clamp(1.35rem, 2vw, 1.8rem); }
    .split-header p:not(.eyebrow) { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow {
      margin: 0; color: var(--primary); font-size: .75rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: .09em;
    }
    .header-actions { display: flex; align-items: center; justify-content: flex-end; gap: .65rem; flex-wrap: wrap; }
    .completed-badge, .result-banner {
      display: inline-flex; align-items: center; gap: .4rem; color: #166534;
      background: #dcfce7; border: 1px solid #86efac; border-radius: 999px;
      padding: .45rem .75rem; font-size: .85rem; font-weight: 700;
    }
    .completed-badge mat-icon, .result-banner mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .result-banner { border-radius: .75rem; justify-content: center; }
    .split-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(340px, .85fr); gap: 1rem; align-items: start; min-width: 0; }
    .split-panel { padding: 1rem; display: grid; gap: 1rem; min-width: 0; }
    .checkout-panel { position: sticky; top: .75rem; }
    .step-head { display: flex; align-items: center; gap: .75rem; }
    .step-head h3 { margin: 0; font-size: 1.05rem; }
    .step-head p { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    .step-head.compact { align-items: flex-start; }
    .step-number {
      flex: 0 0 32px; width: 32px; height: 32px; display: grid; place-items: center;
      border-radius: 50%; color: var(--mat-sys-on-primary, #fff); background: var(--primary);
      font-weight: 800;
    }
    .pending-items { display: grid; gap: .65rem; }
    .pending-item {
      display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: .75rem; align-items: center;
      border: 1px solid color-mix(in srgb, var(--outline) 42%, transparent);
      border-radius: .8rem; padding: .75rem; min-width: 0;
    }
    .pending-item.selected {
      border-color: color-mix(in srgb, var(--primary) 60%, transparent);
      background: color-mix(in srgb, var(--primary) 7%, transparent);
    }
    .item-copy { min-width: 0; }
    .item-name { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
    .item-meta { margin: .25rem 0 0; color: var(--muted-foreground); font-size: .82rem; }
    .item-tax {
      display: inline-flex; margin: .35rem 0 0; padding: .15rem .45rem;
      border-radius: 999px; color: var(--primary);
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      font-size: .76rem; font-weight: 750;
    }
    .quantity-zone { display: inline-flex; align-items: center; gap: .35rem; }
    .quantity-btn {
      width: 44px; height: 44px; display: grid; place-items: center; padding: 0;
      border: 1px solid color-mix(in srgb, var(--outline) 55%, transparent);
      border-radius: .7rem; color: inherit; background: var(--tc-surface-container-lowest); cursor: pointer;
    }
    .quantity-btn:disabled { opacity: .42; cursor: default; }
    .quantity-value { min-width: 2.2ch; text-align: center; font-weight: 800; font-size: 1.05rem; }
    .item-shortcuts { display: inline-flex; align-items: center; gap: .35rem; }
    .checkout-step { display: grid; gap: .75rem; }
    .checkout-step + .checkout-step { padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); }
    .customer-row, .cash-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .55rem; align-items: center; }
    .customer-row mat-form-field, .cash-row mat-form-field, .reference-field { width: 100%; }
    .payment-methods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
    .payment-method { justify-content: flex-start; min-height: 48px; overflow: hidden; }
    .payment-method.active {
      border-color: var(--primary); color: var(--primary);
      background: color-mix(in srgb, var(--primary) 9%, transparent);
    }
    .change-line { margin: -.25rem 0 0; text-align: right; }
    .change-line strong { color: #15803d; font-size: 1.1rem; }
    .purchase-summary {
      display: grid; gap: .4rem; padding: .85rem;
      border: 1px dashed color-mix(in srgb, var(--outline) 48%, transparent);
      border-radius: .8rem;
    }
    .purchase-summary > div { display: flex; justify-content: space-between; gap: 1rem; }
    .purchase-summary span { color: var(--muted-foreground); }
    .tax-breakdown {
      display: grid; gap: .35rem; margin-top: .25rem; padding: .55rem 0;
      border-top: 1px solid color-mix(in srgb, var(--outline) 30%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--outline) 30%, transparent);
    }
    .tax-breakdown-head, .tax-breakdown-row {
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(4.5rem, auto) minmax(4.5rem, auto);
      align-items: center; gap: .65rem;
    }
    .tax-breakdown-head { font-size: .78rem; }
    .tax-breakdown-head span, .tax-breakdown-row span:not(:first-child), .tax-breakdown-row strong {
      text-align: right;
    }
    .tax-breakdown-row { font-size: .88rem; }
    .tax-breakdown-row > span:first-child { color: inherit; font-weight: 650; }
    .tax-total strong { color: var(--primary); }
    .purchase-total {
      margin-top: .25rem; padding-top: .55rem;
      border-top: 1px dashed color-mix(in srgb, var(--outline) 48%, transparent);
      font-size: 1.08rem;
    }
    .purchase-total strong { color: var(--primary); font-size: 1.25rem; }
    .validation-error {
      display: flex; align-items: center; gap: .4rem; margin: 0; padding: .65rem .75rem;
      border-radius: .65rem; color: #991b1b; background: #fee2e2; font-size: .86rem;
    }
    .validation-error mat-icon { flex: 0 0 auto; font-size: 19px; width: 19px; height: 19px; }
    .checkout-actions {
      display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .6rem;
      padding-top: .25rem;
    }
    .checkout-actions button:last-child { min-height: 48px; }

    @media (max-width: 900px) {
      .split-header { flex-direction: column; }
      .header-actions { width: 100%; justify-content: space-between; }
      .split-layout { grid-template-columns: 1fr; }
      .checkout-panel { position: static; }
    }

    @media (max-width: 600px) {
      .split-shell { padding-bottom: 6.5rem; }
      .split-panel { padding: .75rem; border-radius: .75rem; }
      .header-actions { align-items: stretch; flex-direction: column; }
      .header-actions button { width: 100%; }
      .completed-badge { justify-content: center; border-radius: .65rem; }
      .pending-item { grid-template-columns: 1fr; gap: .6rem; }
      .quantity-zone { justify-content: center; }
      .item-shortcuts { display: grid; grid-template-columns: 1fr 1fr; }
      .item-shortcuts button { width: 100%; }
      .customer-row, .cash-row { grid-template-columns: 1fr; }
      .customer-row button, .cash-row button { width: 100%; }
      .payment-methods { grid-template-columns: 1fr; }
      .checkout-actions {
        position: fixed; left: .5rem; right: .5rem; bottom: .5rem; z-index: 20;
        grid-template-columns: 1fr; padding: .65rem;
        border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent);
        border-radius: .85rem; background: var(--mat-sys-surface, var(--background));
        box-shadow: 0 -8px 24px rgb(0 0 0 / 14%);
      }
      .checkout-actions button { width: 100%; }
    }
  `]
})
export class CobroPorPartesComponent {
  private readonly dialog = inject(MatDialog);

  readonly items = input.required<CarritoItem[]>();
  readonly clientes = input<CobroPorPartesCliente[]>([]);
  readonly metodosPago = input<string[]>([]);
  readonly etiquetaCuenta = input('Cuenta');
  readonly impuestoPorDefecto = input(0);
  readonly camposPersonalizados = input<ClienteDialogData['camposPersonalizados']>([]);
  readonly procesando = input(false);
  readonly comprasCompletadas = input(0);
  readonly resetToken = input(0);
  readonly mensajeResultado = input('');

  readonly cobrar = output<CobroPorPartesRequest>();
  readonly salir = output<void>();

  protected readonly seleccion = signal<Record<string, number>>({});
  protected readonly clienteId = signal<string | null>(null);
  protected readonly clientesCreados = signal<CobroPorPartesCliente[]>([]);
  protected readonly metodoPago = signal<MetodoPagoVenta>('EFECTIVO');
  protected readonly referencia = signal('');
  protected readonly efectivoRecibido = signal<number | null>(null);
  private ultimoReset = -1;

  protected readonly clientesDisponibles = computed(() => {
    const porId = new Map<string, CobroPorPartesCliente>();
    for (const cliente of [...this.clientes(), ...this.clientesCreados()]) {
      porId.set(cliente.id, cliente);
    }
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly metodosNormalizados = computed<MetodoPagoVenta[]>(() => {
    const validos = this.metodosPago()
      .filter((metodo): metodo is MetodoPagoVenta => metodo in ETIQUETAS_METODO);
    return validos.length > 0 ? validos : ['EFECTIVO'];
  });

  protected readonly itemsSeleccionados = computed(() =>
    this.items()
      .map((item) => ({
        ...item,
        cantidad: Math.min(item.cantidad, Math.max(0, this.seleccion()[claveItem(item)] ?? 0))
      }))
      .filter((item) => item.cantidad > 0)
  );

  protected readonly resumenSeleccion = computed(() =>
    calcularResumenVenta(this.itemsSeleccionados(), 0, this.impuestoPorDefecto())
  );

  protected readonly unidadesSeleccionadas = computed(() =>
    this.itemsSeleccionados().reduce((acum, item) => acum + item.cantidad, 0)
  );

  protected readonly unidadesPendientes = computed(() =>
    this.items().reduce((acum, item) => acum + item.cantidad, 0)
  );

  protected readonly cambio = computed(() => {
    const recibido = this.efectivoRecibido();
    if (recibido === null || this.metodoPago() !== 'EFECTIVO') {
      return null;
    }
    return Math.max(0, this.round(recibido - this.resumenSeleccion().total));
  });

  protected readonly errorValidacion = computed(() => {
    if (this.unidadesSeleccionadas() === 0) {
      return '';
    }
    if (this.metodoPago() === 'EFECTIVO') {
      const recibido = this.efectivoRecibido();
      if (recibido !== null && recibido < this.resumenSeleccion().total) {
        return 'El efectivo recibido es menor que el total de esta compra.';
      }
    }
    return '';
  });

  constructor() {
    effect(() => {
      const token = this.resetToken();
      const metodos = this.metodosNormalizados();
      if (token === this.ultimoReset) {
        return;
      }
      this.ultimoReset = token;
      this.seleccion.set({});
      this.clienteId.set(null);
      this.metodoPago.set(metodos[0] ?? 'EFECTIVO');
      this.referencia.set('');
      this.efectivoRecibido.set(null);
    });
  }

  protected cantidadSeleccionada(item: CarritoItem): number {
    return Math.min(item.cantidad, Math.max(0, this.seleccion()[claveItem(item)] ?? 0));
  }

  protected cambiarCantidad(item: CarritoItem, delta: number): void {
    this.seleccionarCantidad(item, this.cantidadSeleccionada(item) + delta);
  }

  protected seleccionarCantidad(item: CarritoItem, cantidad: number): void {
    const normalizada = Math.max(0, Math.min(item.cantidad, Math.floor(cantidad)));
    this.seleccion.update((actual) => ({ ...actual, [claveItem(item)]: normalizada }));
  }

  protected limpiarSeleccion(): void {
    this.seleccion.set({});
  }

  protected seleccionarCliente(clienteId: string | null): void {
    this.clienteId.set(clienteId ?? null);
  }

  protected async crearCliente(): Promise<void> {
    const dialogRef = this.dialog.open(ClienteFormDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      data: {
        camposPersonalizados: this.camposPersonalizados() ?? [],
        modo: 'popup'
      } satisfies ClienteDialogData
    });
    const resultado = await firstValueFrom(dialogRef.afterClosed());
    const cliente = resultado?.cliente;
    if (!cliente?.id) {
      return;
    }

    this.clientesCreados.update((actual) => [
      ...actual.filter((item) => item.id !== cliente.id),
      {
        id: cliente.id as string,
        nombre: cliente.nombreCompleto,
        identificacion: cliente.identificacion
      }
    ]);
    this.clienteId.set(cliente.id);
  }

  protected etiquetaMetodo(metodo: MetodoPagoVenta): string {
    return ETIQUETAS_METODO[metodo];
  }

  protected iconoMetodo(metodo: MetodoPagoVenta): string {
    switch (metodo) {
      case 'EFECTIVO': return 'payments';
      case 'TARJETA_CREDITO':
      case 'TARJETA_DEBITO': return 'credit_card';
      case 'TRANSFERENCIA': return 'account_balance';
      case 'QR': return 'qr_code_2';
      case 'CREDITO_CLIENTE': return 'person';
    }
  }

  protected totalLinea(item: CarritoItem): number {
    return calcularResumenVenta([item], 0, this.impuestoPorDefecto()).total;
  }

  protected tarifaIva(item: CarritoItem): number {
    return obtenerTarifaIva(item, this.impuestoPorDefecto());
  }

  protected setReferencia(event: Event): void {
    this.referencia.set((event.target as HTMLInputElement).value);
  }

  protected setEfectivo(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.efectivoRecibido.set(Number.isFinite(value) && value > 0 ? this.round(value) : null);
  }

  protected efectivoExacto(): void {
    this.efectivoRecibido.set(this.resumenSeleccion().total);
  }

  protected confirmar(): void {
    const items = this.itemsSeleccionados();
    if (items.length === 0 || this.errorValidacion()) {
      return;
    }

    const clienteId = this.clienteId();
    const cliente = clienteId
      ? this.clientesDisponibles().find((item) => item.id === clienteId)
      : null;

    this.cobrar.emit({
      items,
      clienteId,
      clienteNombre: cliente?.nombre ?? 'CLIENTE FINAL',
      metodoPago: this.metodoPago(),
      referencia: this.referencia().trim(),
      efectivoRecibido: this.efectivoRecibido()
    });
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

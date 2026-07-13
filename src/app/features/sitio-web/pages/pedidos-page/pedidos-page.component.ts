import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { EstadoPedidoWeb } from '@winsuite/bloques';
import { PedidosWebService } from '../../services/pedidos-web.service';

@Component({
  selector: 'app-pedidos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, MatIconModule, MatButtonModule],
  template: `
    <div class="pagina">
      <h2>Pedidos del sitio</h2>
      <button mat-stroked-button type="button" [disabled]="cargando()" (click)="recargar()">
        <mat-icon>refresh</mat-icon> Actualizar
      </button>
      @if (pedidos().length === 0 && !cargando()) {
        <div class="vacio">
          <mat-icon>receipt_long</mat-icon>
          <p>Aun no hay pedidos. Cuando publiques tu tienda y recibas pedidos, apareceran aqui.</p>
        </div>
      } @else {
        <div class="tabla">
          @for (pedido of pedidos(); track pedido.id) {
            <div class="pedido">
              <div class="cabecera">
                <strong>{{ pedido.cliente.nombre }}</strong>
                <span class="fecha">{{ pedido.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                <select
                  class="estado"
                  [value]="pedido.estado"
                  (change)="cambiarEstado(pedido.id!, $event)"
                  [class]="'estado-' + pedido.estado"
                >
                  <option value="nuevo">Nuevo</option>
                  <option value="pagado">Pagado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              @if (pedido.pago; as pago) {
                <div class="pago-info">
                  💳 Pagado con {{ pago.metodo }}
                  @if (pago.autorizacion) {
                    · autorizacion {{ pago.autorizacion }}
                  }
                  · {{ pago.pagadoEn | date: 'dd/MM/yyyy HH:mm' }}
                </div>
              }
              <div class="detalle">
                <span>📞 {{ pedido.cliente.telefono }}</span>
                @if (pedido.cliente.direccion) {
                  <span>📍 {{ pedido.cliente.direccion }}</span>
                }
              </div>
              <ul class="items">
                @for (item of pedido.items; track item.productoId) {
                  <li>
                    {{ item.cantidad }} × {{ item.nombre }} —
                    {{ item.precioUnitario * item.cantidad | currency: 'USD' }}
                  </li>
                }
              </ul>
              <div class="total">Total: {{ pedido.total | currency: 'USD' }}</div>
            </div>
          }
        </div>
        @if (hayMas()) {
          <button mat-stroked-button type="button" [disabled]="cargando()" (click)="cargarMas()">
            {{ cargando() ? 'Cargando...' : 'Cargar más pedidos' }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 860px;
      margin-inline: auto;
    }
    h2 {
      margin-top: 0;
    }
    .vacio {
      text-align: center;
      opacity: 0.6;
      padding: 48px 0;
    }
    .tabla {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pedido {
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px;
      padding: 14px 16px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .fecha {
      opacity: 0.6;
      font-size: 0.85rem;
    }
    .estado {
      margin-left: auto;
      font: inherit;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--tc-ghost-border);
      font-size: 0.82rem;
      color: var(--tc-on-surface);
    }
    .estado-nuevo {
      background: var(--tc-warning-container);
      color: var(--tc-on-warning-container);
    }
    .estado-pagado {
      background: var(--tc-success-container);
      color: var(--tc-on-success-container);
      font-weight: 700;
    }
    .pago-info {
      margin-top: 6px;
      font-size: 0.82rem;
      color: var(--tc-on-success-container);
      background: var(--tc-success-container);
      border-radius: 8px;
      padding: 5px 10px;
      display: inline-block;
    }
    .estado-confirmado {
      background: var(--tc-info-container);
      color: var(--tc-on-info-container);
    }
    .estado-entregado {
      background: var(--tc-success-container);
      color: var(--tc-on-success-container);
    }
    .estado-cancelado {
      background: var(--tc-error-container);
      color: var(--tc-on-error-container);
    }
    .detalle {
      display: flex;
      gap: 16px;
      font-size: 0.88rem;
      opacity: 0.85;
      margin-top: 6px;
      flex-wrap: wrap;
    }
    .items {
      margin: 8px 0 4px;
      padding-left: 18px;
      font-size: 0.9rem;
    }
    .total {
      font-weight: 700;
      text-align: right;
    }
  `,
})
export class PedidosPageComponent {
  private readonly pedidosService = inject(PedidosWebService);

  readonly sitioId = input.required<string>();

  readonly pedidos = signal<import('@winsuite/bloques').PedidoWeb[]>([]);
  readonly cargando = signal(false);
  readonly hayMas = signal(false);
  private readonly cursor = signal<string | null>(null);

  constructor() {
    toObservable(this.sitioId)
      .pipe(takeUntilDestroyed())
      .subscribe((sitioId) => void this.cargar(sitioId, true));
  }

  recargar(): void {
    void this.cargar(this.sitioId(), true);
  }

  cargarMas(): void {
    void this.cargar(this.sitioId(), false);
  }

  private async cargar(sitioId: string, reiniciar: boolean): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    try {
      const page = await this.pedidosService.getPedidosPage(
        sitioId,
        25,
        reiniciar ? null : this.cursor(),
      );
      this.pedidos.update((actuales) => reiniciar ? page.items : [...actuales, ...page.items]);
      this.cursor.set(page.nextCursor);
      this.hayMas.set(page.hasMore);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarEstado(pedidoId: string, evento: Event): void {
    const estado = (evento.target as HTMLSelectElement).value as EstadoPedidoWeb;
    void this.pedidosService.cambiarEstado(pedidoId, estado).then(() => {
      this.pedidos.update((pedidos) =>
        pedidos.map((pedido) => pedido.id === pedidoId ? { ...pedido, estado } : pedido),
      );
    });
  }
}

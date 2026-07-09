import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { EstadoPedidoWeb } from '@winsuite/bloques';
import { PedidosWebService } from '../../services/pedidos-web.service';

@Component({
  selector: 'app-pedidos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, MatIconModule],
  template: `
    <div class="pagina">
      <h2>Pedidos del sitio</h2>
      @if (pedidosDelSitio().length === 0) {
        <div class="vacio">
          <mat-icon>receipt_long</mat-icon>
          <p>Aun no hay pedidos. Cuando publiques tu tienda y recibas pedidos, apareceran aqui.</p>
        </div>
      } @else {
        <div class="tabla">
          @for (pedido of pedidosDelSitio(); track pedido.id) {
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
                  <option value="confirmado">Confirmado</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
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
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 10px;
      padding: 14px 16px;
      background: #fff;
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
      border: 1px solid rgba(0, 0, 0, 0.15);
      font-size: 0.82rem;
    }
    .estado-nuevo {
      background: #fef3c7;
    }
    .estado-confirmado {
      background: #dbeafe;
    }
    .estado-entregado {
      background: #d1fae5;
    }
    .estado-cancelado {
      background: #fee2e2;
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

  private readonly pedidos = toSignal(this.pedidosService.getPedidos(), { initialValue: [] });
  readonly pedidosDelSitio = computed(() =>
    this.pedidos().filter((pedido) => pedido.sitioId === this.sitioId()),
  );

  cambiarEstado(pedidoId: string, evento: Event): void {
    const estado = (evento.target as HTMLSelectElement).value as EstadoPedidoWeb;
    void this.pedidosService.cambiarEstado(pedidoId, estado);
  }
}

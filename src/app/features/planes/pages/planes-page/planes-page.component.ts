import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';

import {
  ComplementoPlataforma,
  ESTADOS_ORDEN,
  OrdenCompra,
  PlanEmpresa,
  RECURSOS_META,
  RecursoPlataforma,
  SIN_LIMITE,
} from '../../../../core/models/platform.models';
import { OrdersService } from '../../../../core/services/orders.service';
import { PlanService } from '../../../../core/services/plan.service';
import { CheckoutDialogComponent, CheckoutData } from '../../components/checkout-dialog/checkout-dialog.component';

/**
 * Plan de la empresa: que incluye, cuanto se lleva consumido y que se puede comprar cuando
 * algo se agota.
 */
@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatProgressBarModule, MatTooltipModule, MatDialogModule],
  template: `
    <div class="pagina">
      <section class="surface-card bloque">
        <div class="cabecera">
          <div>
            <p class="eyebrow">Tu plan</p>
            <h2>{{ planService.nombrePlan() }}</h2>
            @if (planService.suspendida()) {
              <p class="suspendida">
                <mat-icon>warning</mat-icon>
                Tu suscripcion esta suspendida. Escribe a WinSuit para reactivarla.
              </p>
            } @else {
              <p class="sub">Consumo del periodo {{ planService.uso()?.periodo }}</p>
            }
          </div>
          <button mat-stroked-button type="button" (click)="recargar()" [disabled]="planService.cargando()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>

        <div class="consumo">
          @for (recurso of planService.recursos(); track recurso.recurso) {
            <article [class.destacado]="recurso.recurso === recursoDestacado()" [class.agotado]="recurso.agotado">
              <header>
                <span>{{ etiqueta(recurso.recurso) }}</span>
                <strong>{{ formatear(recurso.recurso, recurso.consumido) }} / {{ textoLimite(recurso.limite) }}</strong>
              </header>
              @if (recurso.porcentaje !== null) {
                <mat-progress-bar mode="determinate" [value]="recurso.porcentaje" />
              }
              <footer>
                @if (recurso.bolsa > 0) {
                  <small>Saldo comprado: {{ formatear(recurso.recurso, recurso.bolsa) }}</small>
                } @else {
                  <small>&nbsp;</small>
                }
                @if (recurso.agotado) {
                  <small class="aviso">Agotado</small>
                }
              </footer>
            </article>
          }
        </div>
      </section>

      @if (complementos().length > 0) {
        <section class="surface-card bloque">
          <div>
            <p class="eyebrow">Complementos</p>
            <h3>Amplia solo lo que necesitas</h3>
            <p class="sub">Se suman a tu plan actual sin tener que cambiarlo.</p>
          </div>

          <div class="tarjetas">
            @for (addon of complementos(); track addon.id) {
              <article [class.destacado]="esDelRecursoDestacado(addon)">
                <h4>{{ addon.nombre }}</h4>
                @if (addon.descripcion) {
                  <p>{{ addon.descripcion }}</p>
                }
                <p class="precio">{{ addon.moneda || 'USD' }} {{ addon.precio ?? 0 }}</p>
                <button mat-raised-button color="primary" type="button" (click)="comprarComplemento(addon)">
                  Comprar
                </button>
              </article>
            }
          </div>
        </section>
      }

      @if (planService.planesDisponibles().length > 0) {
        <section class="surface-card bloque">
          <div>
            <p class="eyebrow">Planes</p>
            <h3>Cambiar de plan</h3>
          </div>

          <div class="tarjetas">
            @for (plan of planService.planesDisponibles(); track plan.id) {
              <article [class.actual]="plan.id === planService.plan()?.planId">
                <h4>{{ plan.nombre }}</h4>
                @if (plan.descripcion) {
                  <p>{{ plan.descripcion }}</p>
                }
                <p class="precio">{{ plan.moneda || 'USD' }} {{ plan.precioMensual ?? 0 }} / mes</p>
                @if (plan.id === planService.plan()?.planId) {
                  <span class="pastilla">Tu plan actual</span>
                } @else {
                  <button mat-raised-button color="primary" type="button" (click)="contratarPlan(plan)">
                    Contratar
                  </button>
                }
              </article>
            }
          </div>
        </section>
      }

      @if (ordenes().length > 0) {
        <section class="surface-card bloque">
          <div>
            <p class="eyebrow">Compras</p>
            <h3>Tus ordenes</h3>
          </div>

          <div class="ordenes">
            @for (orden of ordenes(); track orden.id) {
              <article>
                <div class="linea">
                  <strong>{{ resumenDeOrden(orden) }}</strong>
                  <span class="estado" [class.pagada]="orden.estado === 'PAGADA'"
                    [class.pendiente]="orden.estado === 'PENDIENTE_PAGO' || orden.estado === 'PENDIENTE_VERIFICACION'">
                    {{ etiquetaEstado(orden.estado) }}
                  </span>
                </div>
                <div class="linea">
                  <small>{{ fecha(orden.createdAt) }}</small>
                  <small>{{ orden.moneda || 'USD' }} {{ (orden.totalCentavos / 100).toFixed(2) }}</small>
                </div>
                @if (orden.motivoRechazo) {
                  <small class="aviso">{{ orden.motivoRechazo }}</small>
                }
              </article>
            }
          </div>
        </section>
      }

      @if (mensajeCompra()) {
        <p class="surface-card bloque nota">{{ mensajeCompra() }}</p>
      }
    </div>
  `,
  styles: [`
    .pagina { display: grid; gap: 1rem; align-content: start; }
    .bloque { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .cabecera { display: flex; align-items: start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 1.5rem; }
    h3 { margin: 0; font-size: 1.1rem; }
    h4 { margin: 0 0 .3rem; font-size: 1rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .suspendida { display: flex; align-items: center; gap: .4rem; margin: .4rem 0 0; color: #b3261e; }
    .consumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: .8rem; }
    .consumo article {
      display: grid; gap: .4rem; padding: .85rem; border-radius: var(--tc-radius-md, 10px);
      background: var(--tc-surface-container-low); border: 1px solid transparent;
    }
    .consumo article.destacado { border-color: var(--primary); }
    .consumo article.agotado { background: color-mix(in srgb, red 7%, var(--tc-surface-container-low)); }
    .consumo header { display: flex; justify-content: space-between; gap: .5rem; align-items: baseline; }
    .consumo header span { color: var(--muted-foreground); font-size: .85rem; }
    .consumo footer { display: flex; justify-content: space-between; color: var(--muted-foreground); }
    .aviso { color: #b3261e; font-weight: 600; }
    .tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .8rem; }
    .tarjetas article {
      display: grid; gap: .35rem; align-content: start; padding: 1rem;
      border-radius: var(--tc-radius-md, 10px); background: var(--tc-surface-container-low);
      border: 1px solid transparent;
    }
    .tarjetas article.destacado, .tarjetas article.actual { border-color: var(--primary); }
    .tarjetas p { margin: 0; color: var(--muted-foreground); font-size: .9rem; }
    .precio { font-size: 1.15rem; font-weight: 700; color: var(--foreground); margin: .3rem 0 .6rem !important; }
    .pastilla {
      justify-self: start; padding: .2rem .65rem; border-radius: 999px; font-size: .78rem;
      background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary);
    }
    .nota { padding: 1rem 1.25rem; margin: 0; color: var(--muted-foreground); }
    .ordenes { display: grid; gap: .6rem; }
    .ordenes article {
      display: grid; gap: .25rem; padding: .8rem;
      border-radius: var(--tc-radius-md, 10px); background: var(--tc-surface-container-low);
    }
    .linea { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
    .linea small { color: var(--muted-foreground); }
    .estado {
      padding: .15rem .6rem; border-radius: 999px; font-size: .75rem;
      background: var(--tc-surface-container-high); color: var(--muted-foreground);
    }
    .estado.pagada { background: color-mix(in srgb, green 16%, transparent); color: #1b5e20; }
    .estado.pendiente { background: color-mix(in srgb, orange 18%, transparent); color: #8a5300; }
  `],
})
export class PlanesPageComponent implements OnInit {
  protected readonly planService = inject(PlanService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly ordersService = inject(OrdersService);

  /** Recurso que disparo el aviso de limite, para resaltarlo al llegar desde el dialogo. */
  protected readonly recursoDestacado = signal<string>('');
  protected readonly mensajeCompra = signal<string>('');
  protected readonly ordenes = signal<OrdenCompra[]>([]);

  protected readonly complementos = computed(() =>
    this.planService.complementos().filter((addon) => addon.aplicaA === 'empresa'),
  );

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.recursoDestacado.set(params.get('recurso') ?? '');
    void this.planService.refresh();
    void this.cargarOrdenes();

    // Retorno de la Cajita de Payphone: el cobro solo cuenta cuando lo confirma el servidor.
    const transaccion = params.get('id');
    const orden = params.get('clientTransactionId');
    if (transaccion && orden) {
      void this.confirmarPago(Number(transaccion), orden);
    }
  }

  protected recargar(): void {
    void this.planService.refresh();
    void this.cargarOrdenes();
  }

  protected etiquetaEstado(estado: OrdenCompra['estado']): string {
    return ESTADOS_ORDEN[estado] ?? estado;
  }

  protected fecha(epoch: number | null | undefined): string {
    return epoch ? new Date(epoch).toLocaleDateString('es-EC') : '';
  }

  protected resumenDeOrden(orden: OrdenCompra): string {
    const items = orden.items ?? [];
    if (items.length === 0) return 'Compra';
    const primero = items[0].nombre;
    return items.length === 1 ? primero : `${primero} y ${items.length - 1} mas`;
  }

  protected comprarComplemento(addon: ComplementoPlataforma): void {
    this.abrirCheckout({
      titulo: addon.nombre,
      descripcion: addon.descripcion ?? 'Se suma a tu plan actual sin cambiarlo.',
      complementos: [{ addonId: addon.id, cantidad: 1 }],
    });
  }

  protected contratarPlan(plan: PlanEmpresa): void {
    this.abrirCheckout({
      titulo: `Contratar ${plan.nombre}`,
      descripcion: plan.descripcion ?? 'El plan queda activo por un mes desde que se acredita el pago.',
      planId: plan.id,
    });
  }

  protected etiqueta(recurso: RecursoPlataforma): string {
    return RECURSOS_META[recurso].label;
  }

  protected esDelRecursoDestacado(addon: ComplementoPlataforma): boolean {
    return !!this.recursoDestacado() && addon.recurso === this.recursoDestacado();
  }

  protected textoLimite(limite: number | null): string {
    if (limite === null) return 'Sin definir';
    if (limite === SIN_LIMITE) return 'Sin limite';
    return limite.toLocaleString('es-EC');
  }

  protected formatear(recurso: RecursoPlataforma, valor: number): string {
    if (RECURSOS_META[recurso].unidad !== 'bytes') {
      return valor.toLocaleString('es-EC');
    }
    const unidades = ['B', 'KB', 'MB', 'GB'];
    if (valor === 0) return '0 B';
    const indice = Math.min(Math.floor(Math.log(valor) / Math.log(1024)), unidades.length - 1);
    const escalado = valor / Math.pow(1024, indice);
    return `${escalado >= 10 || indice === 0 ? Math.round(escalado) : escalado.toFixed(1)} ${unidades[indice]}`;
  }

  private abrirCheckout(data: CheckoutData): void {
    this.mensajeCompra.set('');
    this.dialog
      .open(CheckoutDialogComponent, { data, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((recargar) => {
        if (recargar) {
          this.recargar();
        }
      });
  }

  private async cargarOrdenes(): Promise<void> {
    try {
      this.ordenes.set(await this.ordersService.misOrdenes());
    } catch {
      // El listado de compras es informativo: si falla, la pagina sigue siendo util.
      this.ordenes.set([]);
    }
  }

  private async confirmarPago(transaccion: number, ordenId: string): Promise<void> {
    // Los parametros se limpian de la URL para que recargar no reintente la confirmacion.
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.mensajeCompra.set('Confirmando tu pago con Payphone...');
    try {
      const respuesta = await this.ordersService.confirmarPayphone(transaccion, ordenId);
      this.mensajeCompra.set(
        respuesta.aprobada
          ? 'Pago aprobado. Tu plan ya esta actualizado.'
          : (respuesta.mensaje ?? 'El pago no fue aprobado.'),
      );
      this.recargar();
    } catch {
      this.mensajeCompra.set(
        'No pudimos confirmar el pago. Si te cobraron, escribe a WinSuit con el numero de orden ' +
          ordenId +
          '.',
      );
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AgingProveedor } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';

@Component({
  selector: 'app-cxp-aging',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="aging-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Cuentas por Pagar</p>
          <h2>Antiguedad de saldos</h2>
          <p>Saldo pendiente por proveedor clasificado por dias vencidos (a la fecha de hoy).</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/cuentas-por-pagar">Volver</a>
      </header>

      @if (filas().length === 0) {
        <section class="surface-card empty">No hay saldos pendientes.</section>
      } @else {
        <section class="surface-card table-card">
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th class="num">Por vencer</th>
                  <th class="num">1-30</th>
                  <th class="num">31-60</th>
                  <th class="num">61-90</th>
                  <th class="num">+90</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (fila of filas(); track fila.proveedorId ?? fila.proveedorNombre) {
                  <tr>
                    <td>{{ fila.proveedorNombre }}</td>
                    <td class="num">{{ fila.porVencer | number:'1.2-2' }}</td>
                    <td class="num">{{ fila.tramo1_30 | number:'1.2-2' }}</td>
                    <td class="num">{{ fila.tramo31_60 | number:'1.2-2' }}</td>
                    <td class="num">{{ fila.tramo61_90 | number:'1.2-2' }}</td>
                    <td class="num alerta">{{ fila.tramoMas90 | number:'1.2-2' }}</td>
                    <td class="num total">{{ fila.total | number:'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>Total general</td>
                  <td class="num">{{ totales().porVencer | number:'1.2-2' }}</td>
                  <td class="num">{{ totales().t1 | number:'1.2-2' }}</td>
                  <td class="num">{{ totales().t2 | number:'1.2-2' }}</td>
                  <td class="num">{{ totales().t3 | number:'1.2-2' }}</td>
                  <td class="num alerta">{{ totales().t4 | number:'1.2-2' }}</td>
                  <td class="num total">{{ totales().total | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .aging-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-card { padding: .5rem; background: var(--tc-surface-container-lowest); }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { padding: .6rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .74rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-weight: 600; }
    .alerta { color: #b3261e; }
    tfoot td { font-weight: 600; border-top: 2px solid color-mix(in srgb, var(--outline) 55%, transparent); }
    .empty { padding: 2rem; text-align: center; color: var(--muted-foreground); background: var(--tc-surface-container-lowest); }
  `]
})
export class CxpAgingComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);

  protected readonly filas = signal<AgingProveedor[]>([]);

  protected readonly totales = computed(() => this.filas().reduce((acumulado, fila) => ({
    porVencer: acumulado.porVencer + fila.porVencer,
    t1: acumulado.t1 + fila.tramo1_30,
    t2: acumulado.t2 + fila.tramo31_60,
    t3: acumulado.t3 + fila.tramo61_90,
    t4: acumulado.t4 + fila.tramoMas90,
    total: acumulado.total + fila.total
  }), { porVencer: 0, t1: 0, t2: 0, t3: 0, t4: 0, total: 0 }));

  async ngOnInit(): Promise<void> {
    this.filas.set(await this.service.getAging());
  }
}

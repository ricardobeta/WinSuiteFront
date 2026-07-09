import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';

import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { MetodoPagoVenta, VentaDocumento, VentaPago } from '../../models/ventas.models';
import { VentasService } from '../../services/ventas.service';

type RangoModo = 'hoy' | 'ultima-semana' | 'rango';

interface CajaDiariaRow {
  fecha: string;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  qr: number;
  creditoCliente: number;
  total: number;
}

interface IngresoVendedorRow {
  fecha: string;
  vendedor: string;
  transacciones: number;
  total: number;
}

@Component({
  selector: 'app-ventas-informes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, MatSelectModule, DecimalPipe],
  template: `
    <section class="surface-card informes-card">
      <header>
        <p class="eyebrow">Ventas</p>
        <h2>Informes</h2>
        <p>KPIs base del periodo cargado en tiempo real.</p>
      </header>

      <section class="kpi-grid">
        <article>
          <p>Total vendido</p>
          <strong>{{ totalVentas() | number:'1.2-2' }}</strong>
        </article>
        <article>
          <p>Transacciones</p>
          <strong>{{ totalTransacciones() }}</strong>
        </article>
        <article>
          <p>Ticket promedio</p>
          <strong>{{ ticketPromedio() | number:'1.2-2' }}</strong>
        </article>
        <article>
          <p>Tasa de reverso</p>
          <strong>{{ tasaReverso() | number:'1.2-2' }}%</strong>
        </article>
      </section>

      <section class="rankings">
        <article>
          <h3>Ventas por estado</h3>
          <ul>
            <li>Completadas: {{ completadas() }}</li>
            <li>Revertidas: {{ revertidas() }}</li>
            <li>Anuladas: {{ anuladas() }}</li>
          </ul>
        </article>
      </section>

      <section class="report-card">
        <header class="report-header">
          <div>
            <h3>Ingreso caja diaria</h3>
            <p>Resumen diario por metodo de pago.</p>
          </div>

          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Periodo</mat-label>
              <mat-select [ngModel]="cajaModo()" (ngModelChange)="onCajaModoChange($event)">
                <mat-option value="hoy">Hoy</mat-option>
                <mat-option value="ultima-semana">Ultima semana</mat-option>
                <mat-option value="rango">Rango personalizado</mat-option>
              </mat-select>
            </mat-form-field>

            @if (cajaModo() === 'rango') {
              <mat-form-field appearance="outline">
                <mat-label>Desde</mat-label>
                <input matInput [matDatepicker]="pickerCajaDesde" [ngModel]="cajaDesdeDate()" (ngModelChange)="onCajaDesdeChange($event)" />
                <mat-datepicker-toggle matSuffix [for]="pickerCajaDesde"></mat-datepicker-toggle>
                <mat-datepicker #pickerCajaDesde></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Hasta</mat-label>
                <input matInput [matDatepicker]="pickerCajaHasta" [ngModel]="cajaHastaDate()" (ngModelChange)="onCajaHastaChange($event)" />
                <mat-datepicker-toggle matSuffix [for]="pickerCajaHasta"></mat-datepicker-toggle>
                <mat-datepicker #pickerCajaHasta></mat-datepicker>
              </mat-form-field>
            }

          </div>
        </header>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Efectivo</th>
                <th>Tarjeta</th>
                <th>Transferencia</th>
                <th>QR</th>
                <th>Credito cliente</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of cajaRowsPaginadas(); track row.fecha) {
                <tr>
                  <td>{{ row.fecha }}</td>
                  <td>{{ row.efectivo | number:'1.2-2' }}</td>
                  <td>{{ row.tarjeta | number:'1.2-2' }}</td>
                  <td>{{ row.transferencia | number:'1.2-2' }}</td>
                  <td>{{ row.qr | number:'1.2-2' }}</td>
                  <td>{{ row.creditoCliente | number:'1.2-2' }}</td>
                  <td><strong>{{ row.total | number:'1.2-2' }}</strong></td>
                </tr>
              }
              @if (cajaDiariaRows().length === 0) {
                <tr>
                  <td colspan="7" class="empty-cell">Sin datos para el rango seleccionado.</td>
                </tr>
              } @else {
                <tr class="total-row">
                  <td><strong>Total acumulado</strong></td>
                  <td><strong>{{ cajaTotales().efectivo | number:'1.2-2' }}</strong></td>
                  <td><strong>{{ cajaTotales().tarjeta | number:'1.2-2' }}</strong></td>
                  <td><strong>{{ cajaTotales().transferencia | number:'1.2-2' }}</strong></td>
                  <td><strong>{{ cajaTotales().qr | number:'1.2-2' }}</strong></td>
                  <td><strong>{{ cajaTotales().creditoCliente | number:'1.2-2' }}</strong></td>
                  <td><strong>{{ cajaTotales().total | number:'1.2-2' }}</strong></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <mat-paginator
          [length]="cajaDiariaRows().length"
          [pageIndex]="cajaPageIndex()"
          [pageSize]="cajaPageSize()"
          [pageSizeOptions]="pageSizeOptions"
          showFirstLastButtons
          (page)="onCajaPage($event)"
        ></mat-paginator>
      </section>

      <section class="report-card">
        <header class="report-header">
          <div>
            <h3>Ingresos diarios por vendedor</h3>
            <p>Totales y transacciones por vendedor en cada dia.</p>
          </div>

          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Periodo</mat-label>
              <mat-select [ngModel]="vendedorModo()" (ngModelChange)="onVendedorModoChange($event)">
                <mat-option value="hoy">Hoy</mat-option>
                <mat-option value="ultima-semana">Ultima semana</mat-option>
                <mat-option value="rango">Rango personalizado</mat-option>
              </mat-select>
            </mat-form-field>

            @if (vendedorModo() === 'rango') {
              <mat-form-field appearance="outline">
                <mat-label>Desde</mat-label>
                <input matInput [matDatepicker]="pickerVendDesde" [ngModel]="vendedorDesdeDate()" (ngModelChange)="onVendedorDesdeChange($event)" />
                <mat-datepicker-toggle matSuffix [for]="pickerVendDesde"></mat-datepicker-toggle>
                <mat-datepicker #pickerVendDesde></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Hasta</mat-label>
                <input matInput [matDatepicker]="pickerVendHasta" [ngModel]="vendedorHastaDate()" (ngModelChange)="onVendedorHastaChange($event)" />
                <mat-datepicker-toggle matSuffix [for]="pickerVendHasta"></mat-datepicker-toggle>
                <mat-datepicker #pickerVendHasta></mat-datepicker>
              </mat-form-field>
            }

          </div>
        </header>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Transacciones</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of vendedorRowsPaginadas(); track row.fecha + '-' + row.vendedor) {
                <tr>
                  <td>{{ row.fecha }}</td>
                  <td>{{ row.vendedor }}</td>
                  <td>{{ row.transacciones }}</td>
                  <td><strong>{{ row.total | number:'1.2-2' }}</strong></td>
                </tr>
              }
              @if (ingresosPorVendedorRows().length === 0) {
                <tr>
                  <td colspan="4" class="empty-cell">Sin datos para el rango seleccionado.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <mat-paginator
          [length]="ingresosPorVendedorRows().length"
          [pageIndex]="vendedorPageIndex()"
          [pageSize]="vendedorPageSize()"
          [pageSizeOptions]="pageSizeOptions"
          showFirstLastButtons
          (page)="onVendedorPage($event)"
        ></mat-paginator>
      </section>
    </section>
  `,
  styles: [`
    .informes-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    header h2 { margin: 0; }
    header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .kpi-grid article { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .7rem; padding: .85rem; }
    .kpi-grid p { margin: 0; color: var(--muted-foreground); }
    .kpi-grid strong { font-size: 1.35rem; }
    .rankings article { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .7rem; padding: .85rem; }
    .rankings h3 { margin: 0 0 .55rem; }
    .rankings ul { margin: 0; padding-left: 1rem; display: grid; gap: .35rem; }
    .report-card { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .7rem; padding: .85rem; display: grid; gap: .75rem; }
    .report-header { display: flex; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
    .report-header h3 { margin: 0; }
    .report-header p { margin: .25rem 0 0; color: var(--muted-foreground); }
    .filters-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .filters-row mat-form-field { min-width: 170px; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); }
    th { color: var(--muted-foreground); font-weight: 600; }
    .empty-cell { text-align: center; color: var(--muted-foreground); }
    .total-row td { background: color-mix(in srgb, var(--primary) 10%, transparent); }
    @media (max-width: 980px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr; } }
  `]
})
export class VentasInformesComponent {
  private readonly ventasService = inject(VentasService);
  private readonly destroyRef = inject(DestroyRef);

  // Adaptadores Date↔ISO para los datepickers (los rangos se guardan como string ISO).
  protected readonly ventas = signal<VentaDocumento[]>([]);
  protected readonly pagosPorVenta = signal<Record<string, VentaPago[]>>({});

  protected readonly cajaModo = signal<RangoModo>('hoy');
  protected readonly cajaDesde = signal('');
  protected readonly cajaHasta = signal('');
  protected readonly cajaDesdeDate = signal<Date | null>(null);
  protected readonly cajaHastaDate = signal<Date | null>(null);
  protected readonly vendedorModo = signal<RangoModo>('hoy');
  protected readonly vendedorDesde = signal('');
  protected readonly vendedorHasta = signal('');
  protected readonly vendedorDesdeDate = signal<Date | null>(null);
  protected readonly vendedorHastaDate = signal<Date | null>(null);
  protected readonly pageSizeOptions = [5, 10, 20];
  protected readonly cajaPageIndex = signal(0);
  protected readonly cajaPageSize = signal(10);
  protected readonly vendedorPageIndex = signal(0);
  protected readonly vendedorPageSize = signal(10);
  protected readonly ventasCompletadas = computed(() =>
    this.ventas().filter((venta) => venta.estado === 'COMPLETADA')
  );

  protected readonly totalVentas = computed(() =>
    this.ventasCompletadas().reduce((acum, venta) => acum + venta.total, 0)
  );
  protected readonly totalTransacciones = computed(() => this.ventas().length);
  protected readonly ticketPromedio = computed(() => {
    const total = this.totalVentas();
    const count = this.ventasCompletadas().length;
    return count === 0 ? 0 : total / count;
  });
  protected readonly completadas = computed(() => this.ventas().filter((venta) => venta.estado === 'COMPLETADA').length);
  protected readonly revertidas = computed(() => this.ventas().filter((venta) => venta.estado === 'REVERTIDA').length);
  protected readonly anuladas = computed(() => this.ventas().filter((venta) => venta.estado === 'ANULADA').length);
  protected readonly tasaReverso = computed(() => {
    const total = this.totalTransacciones();
    if (total === 0) {
      return 0;
    }

    return (this.revertidas() / total) * 100;
  });

  protected readonly ventasCajaFiltradas = computed(() => {
    const { from, to } = this.resolverRango(this.cajaModo(), this.cajaDesde(), this.cajaHasta());
    return this.ventasCompletadas().filter((venta) => venta.creadoEn >= from && venta.creadoEn <= to);
  });

  protected readonly cajaDiariaRows = computed(() => {
    const grouped = new Map<string, CajaDiariaRow>();

    this.ventasCajaFiltradas().forEach((venta) => {
      const fecha = this.formatearFecha(venta.creadoEn);
      const base = grouped.get(fecha) ?? {
        fecha,
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        qr: 0,
        creditoCliente: 0,
        total: 0
      };

      const pagos = venta.id ? (this.pagosPorVenta()[venta.id] ?? []) : [];
      if (pagos.length === 0) {
        base.efectivo += venta.total;
      } else {
        pagos.forEach((pago) => {
          switch (pago.metodo as MetodoPagoVenta) {
            case 'EFECTIVO':
              base.efectivo += pago.monto;
              break;
            case 'TARJETA_CREDITO':
            case 'TARJETA_DEBITO':
              base.tarjeta += pago.monto;
              break;
            case 'TRANSFERENCIA':
              base.transferencia += pago.monto;
              break;
            case 'QR':
              base.qr += pago.monto;
              break;
            case 'CREDITO_CLIENTE':
              base.creditoCliente += pago.monto;
              break;
            default:
              base.efectivo += pago.monto;
              break;
          }
        });
      }

      base.total = base.efectivo + base.tarjeta + base.transferencia + base.qr + base.creditoCliente;
      grouped.set(fecha, base);
    });

    return Array.from(grouped.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  protected readonly cajaTotalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.cajaDiariaRows().length / this.cajaPageSize()))
  );

  protected readonly cajaTotales = computed(() =>
    this.cajaDiariaRows().reduce(
      (acc, row) => {
        acc.efectivo += row.efectivo;
        acc.tarjeta += row.tarjeta;
        acc.transferencia += row.transferencia;
        acc.qr += row.qr;
        acc.creditoCliente += row.creditoCliente;
        acc.total += row.total;
        return acc;
      },
      {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        qr: 0,
        creditoCliente: 0,
        total: 0
      }
    )
  );

  protected readonly cajaRowsPaginadas = computed(() => {
    const pageSize = this.cajaPageSize();
    const currentPage = Math.min(this.cajaPageIndex(), this.cajaTotalPaginas() - 1);
    const start = currentPage * pageSize;
    return this.cajaDiariaRows().slice(start, start + pageSize);
  });

  protected readonly ventasVendedorFiltradas = computed(() => {
    const { from, to } = this.resolverRango(this.vendedorModo(), this.vendedorDesde(), this.vendedorHasta());
    return this.ventasCompletadas().filter((venta) => venta.creadoEn >= from && venta.creadoEn <= to);
  });

  protected readonly ingresosPorVendedorRows = computed(() => {
    const grouped = new Map<string, IngresoVendedorRow>();

    this.ventasVendedorFiltradas().forEach((venta) => {
      const fecha = this.formatearFecha(venta.creadoEn);
      const vendedor = venta.vendedorNombre || 'Sin nombre';
      const key = `${fecha}::${vendedor}`;
      const base = grouped.get(key) ?? {
        fecha,
        vendedor,
        transacciones: 0,
        total: 0
      };

      base.transacciones += 1;
      base.total += venta.total;
      grouped.set(key, base);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const byDate = b.fecha.localeCompare(a.fecha);
      if (byDate !== 0) {
        return byDate;
      }
      return a.vendedor.localeCompare(b.vendedor);
    });
  });

  protected readonly vendedorTotalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.ingresosPorVendedorRows().length / this.vendedorPageSize()))
  );

  protected readonly vendedorRowsPaginadas = computed(() => {
    const pageSize = this.vendedorPageSize();
    const currentPage = Math.min(this.vendedorPageIndex(), this.vendedorTotalPaginas() - 1);
    const start = currentPage * pageSize;
    return this.ingresosPorVendedorRows().slice(start, start + pageSize);
  });

  constructor() {
    this.ventasService
      .getVentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ventas) => this.ventas.set(ventas));

    this.ventasService
      .getPagosPorVenta()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pagos) => this.pagosPorVenta.set(pagos));

    const hoy = this.formatearFechaInput(new Date());
    this.cajaDesde.set(hoy);
    this.cajaHasta.set(hoy);
    this.vendedorDesde.set(hoy);
    this.vendedorHasta.set(hoy);
    this.cajaDesdeDate.set(new Date());
    this.cajaHastaDate.set(new Date());
    this.vendedorDesdeDate.set(new Date());
    this.vendedorHastaDate.set(new Date());
  }

  protected onCajaModoChange(modo: RangoModo): void {
    this.cajaModo.set(modo);
    this.cajaPageIndex.set(0);
  }

  protected onCajaDesdeChange(valor: Date | null): void {
    this.cajaDesdeDate.set(valor);
    this.cajaDesde.set(dateAIso(valor));
    this.cajaPageIndex.set(0);
  }

  protected onCajaHastaChange(valor: Date | null): void {
    this.cajaHastaDate.set(valor);
    this.cajaHasta.set(dateAIso(valor));
    this.cajaPageIndex.set(0);
  }

  protected onCajaPage(event: PageEvent): void {
    this.cajaPageIndex.set(event.pageIndex);
    this.cajaPageSize.set(event.pageSize);
  }

  protected onVendedorModoChange(modo: RangoModo): void {
    this.vendedorModo.set(modo);
    this.vendedorPageIndex.set(0);
  }

  protected onVendedorDesdeChange(valor: Date | null): void {
    this.vendedorDesdeDate.set(valor);
    this.vendedorDesde.set(dateAIso(valor));
    this.vendedorPageIndex.set(0);
  }

  protected onVendedorHastaChange(valor: Date | null): void {
    this.vendedorHastaDate.set(valor);
    this.vendedorHasta.set(dateAIso(valor));
    this.vendedorPageIndex.set(0);
  }

  protected onVendedorPage(event: PageEvent): void {
    this.vendedorPageIndex.set(event.pageIndex);
    this.vendedorPageSize.set(event.pageSize);
  }

  private resolverRango(modo: RangoModo, fromInput: string, toInput: string): { from: number; to: number } {
    const now = new Date();

    if (modo === 'hoy') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      return { from, to };
    }

    if (modo === 'ultima-semana') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      return { from: start, to: end };
    }

    const parsedFrom = fromInput ? new Date(`${fromInput}T00:00:00`).getTime() : 0;
    const parsedTo = toInput ? new Date(`${toInput}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER;
    return {
      from: Number.isFinite(parsedFrom) ? parsedFrom : 0,
      to: Number.isFinite(parsedTo) ? parsedTo : Number.MAX_SAFE_INTEGER
    };
  }

  private formatearFecha(timestamp: number): string {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatearFechaInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

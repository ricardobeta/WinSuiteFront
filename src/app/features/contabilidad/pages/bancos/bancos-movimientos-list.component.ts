import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageEvent } from '@angular/material/paginator';
import { debounceTime, startWith } from 'rxjs';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import {
  CuentaBancaria,
  EstadoConciliacionMovimiento,
  MovimientoBancario
} from '../../models/bancos.models';
import { BancosApiService } from '../../services/bancos-api.service';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { BancosMovimientosService } from '../../services/bancos-movimientos.service';

@Component({
  selector: 'app-bancos-movimientos-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="movs-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Movimientos bancarios</h2>
          <p class="support">Consulta los movimientos importados del extracto por cuenta y período.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos/extractos/importar">
            <mat-icon>upload_file</mat-icon>
            Importar extracto
          </a>
          <a mat-flat-button color="primary" class="cta"
             [routerLink]="['/workspace/contabilidad/bancos/conciliacion']"
             [queryParams]="{ cuenta: cuenta.value, periodo: periodo.value }">
            <mat-icon>fact_check</mat-icon>
            Conciliar período
          </a>
        </div>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Neto página</p>
          <p class="kpi-value">{{ netoPagina() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Créditos página</p>
          <p class="kpi-value">{{ creditosPagina() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Débitos página</p>
          <p class="kpi-value">{{ debitosPagina() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Pendientes página</p>
          <p class="kpi-value">{{ pendientesPagina() }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Filtrar página cargada</mat-label>
          <input matInput [formControl]="busqueda" autocomplete="off" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cuenta bancaria</mat-label>
          <mat-select [formControl]="cuenta">
            @for (item of cuentas(); track item.id) {
              <mat-option [value]="item.id">{{ item.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Período obligatorio</mat-label>
          <input matInput type="month" [formControl]="periodo" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [formControl]="estado">
            <mat-option value="">Todos</mat-option>
            <mat-option value="PENDIENTE">Pendiente</mat-option>
            <mat-option value="SUGERIDO">Sugerido</mat-option>
            <mat-option value="CONCILIADO">Conciliado</mat-option>
            <mat-option value="DESCARTADO">Descartado</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" type="button" class="search-button"
                (click)="buscar()" [disabled]="!periodo.value || !cuenta.value || cargando()">
          <mat-icon>search</mat-icon>
          Buscar
        </button>
      </section>

      <section class="surface-card table-card">
        @if (!cuenta.value || !periodo.value) {
          <div class="empty-state">
            <mat-icon>date_range</mat-icon>
            <h3>Selecciona cuenta y período</h3>
            <p>La consulta no se ejecutará hasta que elijas cuenta bancaria y mes.</p>
          </div>
        } @else if (!consultaRealizada()) {
          <div class="empty-state">
            <mat-icon>manage_search</mat-icon>
            <h3>Consulta pendiente</h3>
            <p>Presiona Buscar para cargar los movimientos del período.</p>
          </div>
        } @else if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando movimientos…</h3>
          </div>
        } @else if (movimientos().length === 0) {
          <div class="empty-state">
            <mat-icon>account_balance</mat-icon>
            <h3>Sin movimientos</h3>
            <p>No hay movimientos importados para esta cuenta en el período.</p>
          </div>
        } @else {
          <app-data-table-frame
            [showSearch]="false"
            [total]="totalPaginador()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[50, 100, 200, 500]"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="movimientosFiltrados()" class="movs-table">
              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
              </ng-container>

              <ng-container matColumnDef="descripcion">
                <th mat-header-cell *matHeaderCellDef>Descripción</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ row.descripcion }}</span>
                    @if (row.referencia) {
                      <span class="doc-sub">Ref: {{ row.referencia }}</span>
                    }
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="monto">
                <th mat-header-cell *matHeaderCellDef class="num">Monto</th>
                <td mat-cell *matCellDef="let row" class="num" [class.neg]="row.monto < 0">
                  {{ row.monto | currency: 'USD':'symbol-narrow':'1.2-2' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="saldo">
                <th mat-header-cell *matHeaderCellDef class="num">Saldo</th>
                <td mat-cell *matCellDef="let row" class="num">
                  {{ row.saldoLinea != null ? (row.saldoLinea | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Conciliación</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="estadoClase(row.estadoConciliacion)">{{ estadoLabel(row.estadoConciliacion) }}</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </app-data-table-frame>
        }
      </section>
    </section>
  `,
  styles: [`
    .movs-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .header-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }
    .filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: minmax(220px, 2fr) 1.2fr 200px 1fr auto; gap: .75rem; align-items: start; }
    .search-button { min-height: 56px; }
    .table-card { padding: 1rem 1.25rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .doc-cell { display: grid; }
    .doc-num { font-weight: 500; }
    .doc-sub { font-size: .78rem; color: var(--muted-foreground); }
    td.num, th.num { text-align: right; }
    .movs-table td.neg { color: var(--destructive); }
    .pill { display: inline-flex; border-radius: 999px; padding: .15rem .6rem; font-size: .75rem; font-weight: 600; }
    .pill-pendiente { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #b45309; }
    .pill-sugerido { background: color-mix(in srgb, #7c3aed 16%, transparent); color: #6d28d9; }
    .pill-conciliado { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill-descartado { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    @media (max-width: 1100px) { .filters-card { grid-template-columns: 1fr 1fr; } .kpi-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) { .filters-card, .kpi-row { grid-template-columns: 1fr; } }
  `]
})
export class BancosMovimientosListComponent {
  private readonly movimientosService = inject(BancosMovimientosService);
  private readonly api = inject(BancosApiService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['fecha', 'descripcion', 'monto', 'saldo', 'estado'];
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly movimientos = signal<MovimientoBancario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly consultaRealizada = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(50);
  protected readonly hasMore = signal(false);

  protected readonly busqueda = new FormControl('', { nonNullable: true });
  protected readonly cuenta = new FormControl('', { nonNullable: true });
  protected readonly periodo = new FormControl('', { nonNullable: true });
  protected readonly estado = new FormControl<'' | EstadoConciliacionMovimiento>('', { nonNullable: true });

  private readonly filtroTexto = signal('');
  private readonly cursores = new Map<number, string | null>();

  protected readonly movimientosFiltrados = computed(() => {
    const texto = this.filtroTexto().toLowerCase();
    const estadoFiltro = this.estadoFiltro();
    return this.movimientos().filter((movimiento) => {
      const coincideTexto = !texto
        || movimiento.descripcion.toLowerCase().includes(texto)
        || movimiento.referencia.toLowerCase().includes(texto);
      const coincideEstado = !estadoFiltro || movimiento.estadoConciliacion === estadoFiltro;
      return coincideTexto && coincideEstado;
    });
  });

  private readonly estadoFiltro = signal<'' | EstadoConciliacionMovimiento>('');

  protected readonly netoPagina = computed(() =>
    this.movimientosFiltrados().reduce((total, movimiento) => total + movimiento.monto, 0));
  protected readonly creditosPagina = computed(() =>
    this.movimientosFiltrados().filter((movimiento) => movimiento.monto > 0)
      .reduce((total, movimiento) => total + movimiento.monto, 0));
  protected readonly debitosPagina = computed(() =>
    this.movimientosFiltrados().filter((movimiento) => movimiento.monto < 0)
      .reduce((total, movimiento) => total + movimiento.monto, 0));
  protected readonly pendientesPagina = computed(() =>
    this.movimientosFiltrados().filter((movimiento) => movimiento.estadoConciliacion === 'PENDIENTE').length);

  protected readonly totalPaginador = computed(() =>
    this.pageIndex() * this.pageSize() + this.movimientos().length + (this.hasMore() ? 1 : 0));

  constructor() {
    this.busqueda.valueChanges
      .pipe(debounceTime(250), startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => this.filtroTexto.set(valor));
    this.estado.valueChanges
      .pipe(startWith(this.estado.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => this.estadoFiltro.set(valor));
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => {
        this.cuentas.set(cuentas);
        const preseleccion = this.route.snapshot.queryParamMap.get('cuenta');
        if (preseleccion && cuentas.some((cuenta) => cuenta.id === preseleccion)) {
          this.cuenta.setValue(preseleccion);
        }
      });
  }

  protected buscar(): void {
    this.cursores.clear();
    this.cursores.set(0, null);
    this.pageIndex.set(0);
    void this.cargarPagina(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.buscar();
      return;
    }
    this.pageIndex.set(event.pageIndex);
    void this.cargarPagina(event.pageIndex);
  }

  private async cargarPagina(pageIndex: number): Promise<void> {
    const cuentaId = this.cuenta.value;
    const periodo = this.periodo.value;
    if (!cuentaId || !periodo) {
      return;
    }
    this.cargando.set(true);
    this.consultaRealizada.set(true);
    try {
      const cursor = this.cursores.get(pageIndex) ?? null;
      const limit = this.pageSize();
      // Hasta 100 filas: RTDB directo con cursor. 200/500: página compuesta por el backend.
      const page = limit <= 100
        ? await this.movimientosService.getMovimientosPage(cuentaId, periodo, limit, cursor)
        : await this.api.getMovimientosPage(cuentaId, limit, cursor ?? this.cursorInicialPeriodo(periodo));
      const items = limit <= 100
        ? page.items
        : page.items.filter((movimiento) => movimiento.periodo === periodo);
      this.movimientos.set(items);
      this.hasMore.set(page.hasMore);
      if (page.nextCursor) {
        this.cursores.set(pageIndex + 1, page.nextCursor);
      }
    } catch {
      this.snackBar.open('No se pudieron cargar los movimientos.', 'OK', { duration: 4500 });
      this.movimientos.set([]);
      this.hasMore.set(false);
    } finally {
      this.cargando.set(false);
    }
  }

  private cursorInicialPeriodo(periodo: string): string {
    return `${periodo}-99#` + String.fromCharCode(0xffff);
  }

  protected estadoLabel(estado: EstadoConciliacionMovimiento): string {
    return ({
      PENDIENTE: 'Pendiente',
      SUGERIDO: 'Sugerido',
      CONCILIADO: 'Conciliado',
      DESCARTADO: 'Descartado'
    } as Record<string, string>)[estado] ?? estado;
  }

  protected estadoClase(estado: EstadoConciliacionMovimiento): string {
    return ({
      PENDIENTE: 'pill pill-pendiente',
      SUGERIDO: 'pill pill-sugerido',
      CONCILIADO: 'pill pill-conciliado',
      DESCARTADO: 'pill pill-descartado'
    } as Record<string, string>)[estado] ?? 'pill';
  }
}

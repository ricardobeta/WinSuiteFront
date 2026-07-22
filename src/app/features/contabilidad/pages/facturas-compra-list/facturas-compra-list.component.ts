import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageEvent } from '@angular/material/paginator';
import { debounceTime, firstValueFrom, startWith } from 'rxjs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { EstadoFacturaCompra, FacturaCompra, TIPOS_COMPROBANTE, TIPO_COMPROBANTE_NOTA_CREDITO } from '../../models/compras.models';
import { FacturasCompraPageCursor, FacturasCompraService } from '../../services/facturas-compra.service';
import { PeriodoContableService } from '../../services/periodo-contable.service';

@Component({
  selector: 'app-facturas-compra-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="compras-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Compras</p>
          <h2>Facturas de compra</h2>
          <p class="support">Registra las facturas de tus proveedores para contabilizarlas y alimentar el ATS del período.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/compras/carga-masiva">
            <mat-icon>upload_file</mat-icon>
            Carga masiva
          </a>
          <a mat-flat-button color="primary" class="cta" routerLink="/workspace/contabilidad/compras/nueva">
            <mat-icon>add</mat-icon>
            Nueva factura
          </a>
        </div>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Total página cargada</p>
          <p class="kpi-value">{{ totalPeriodo() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Comprobantes página</p>
          <p class="kpi-value">{{ facturasFiltradas().length }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">IVA página</p>
          <p class="kpi-value">{{ totalIva() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Retenciones página</p>
          <p class="kpi-value">{{ totalRetencion() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Filtrar página cargada</mat-label>
          <input matInput [formControl]="busqueda" autocomplete="off" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Período obligatorio</mat-label>
          <input matInput type="month" [formControl]="periodo" />
          <mat-hint>Selecciona el mes a consultar</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select [formControl]="tipo">
            <mat-option value="">Todos</mat-option>
            @for (t of tiposComprobante; track t.codigo) {
              <mat-option [value]="t.codigo">{{ t.descripcion }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [formControl]="estado">
            <mat-option value="">Todos</mat-option>
            <mat-option value="BORRADOR">Borrador</mat-option>
            <mat-option value="REGISTRADA">Registrada</mat-option>
            <mat-option value="ANULADA">Anulada</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" type="button" class="search-button" (click)="buscar()" [disabled]="!periodo.value || cargando()">
          <mat-icon>search</mat-icon>
          Buscar
        </button>
      </section>

      <section class="surface-card table-card">
        @if (!periodo.value) {
          <div class="empty-state">
            <mat-icon>date_range</mat-icon>
            <h3>Selecciona un período</h3>
            <p>La consulta no se ejecutará hasta que elijas un mes.</p>
          </div>
        } @else if (!consultaRealizada()) {
          <div class="empty-state">
            <mat-icon>manage_search</mat-icon>
            <h3>Consulta pendiente</h3>
            <p>Presiona Buscar para cargar hasta 50 compras del período seleccionado.</p>
          </div>
        } @else if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando compras</h3>
          </div>
        } @else if (facturas().length === 0) {
          <div class="empty-state">
            <mat-icon>receipt_long</mat-icon>
            <h3>Sin facturas de compra</h3>
            <p>No existen compras en el período seleccionado.</p>
          </div>
        } @else {
          <app-data-table-frame
            [showSearch]="false"
            [total]="totalPaginador()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[50, 100]"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="facturasFiltradas()" class="compras-table">
              <ng-container matColumnDef="documento">
                <th mat-header-cell *matHeaderCellDef>Comprobante</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ documento(row) }}</span>
                    <span class="doc-sub">{{ row.numero }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="proveedor">
                <th mat-header-cell *matHeaderCellDef>Proveedor</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ row.razonSocialProv }}</span>
                    <span class="doc-sub">{{ row.idProv }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="esNc(row) ? 'pill-void' : 'pill-info'">{{ tipoLabel(row) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Emisión</th>
                <td mat-cell *matCellDef="let row">{{ row.fechaEmision | date: 'dd/MM/yyyy' }}</td>
              </ng-container>

              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="num">Total</th>
                <td mat-cell *matCellDef="let row" class="num" [class.neg]="esNc(row)">{{ montoConSigno(row) | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="inventario">
                <th mat-header-cell *matHeaderCellDef>Inventario</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.alimentaInventario) {
                    <span class="pill pill-info"><mat-icon>inventory_2</mat-icon> Sí</span>
                  } @else {
                    <span class="pill pill-muted">Solo contable</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="estadoClase(row.estado)">{{ estadoLabel(row.estado) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Acciones">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="editar(row)">
                      <mat-icon>{{ row.estado === 'BORRADOR' ? 'edit' : 'visibility' }}</mat-icon>
                      <span>{{ row.estado === 'BORRADOR' ? 'Editar' : 'Ver' }}</span>
                    </button>
                    @if (row.estado !== 'ANULADA') {
                      <button mat-menu-item (click)="anular(row)">
                        <mat-icon>block</mat-icon>
                        <span>Anular</span>
                      </button>
                    }
                  </mat-menu>
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
    .compras-page { display: grid; gap: 1rem; }
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
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 30%, transparent); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }

    .filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: minmax(260px, 2fr) 220px 1fr 1fr auto; gap: .75rem; align-items: start; }
    .filters-card .search { grid-column: 1; }
    .search-button { min-height: 56px; }
    .compras-table td.num.neg { color: var(--destructive); }

    .table-card { padding: .5rem .5rem; }
    .table-wrap { overflow: auto; }
    .compras-table { width: 100%; background: transparent; }
    .compras-table th.num, .compras-table td.num { text-align: right; }
    .doc-cell { display: grid; }
    .doc-num { font-weight: 600; }
    .doc-sub { font-size: .78rem; color: var(--muted-foreground); }
    .compras-table tr.mat-mdc-row:hover { background: color-mix(in srgb, var(--primary) 5%, transparent); }

    .pill { display: inline-flex; align-items: center; gap: .3rem; padding: .28rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 600; }
    .pill mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    .pill-muted { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    .pill-info { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .pill-draft { background: color-mix(in srgb, #b7791f 16%, transparent); color: #9c6412; }
    .pill-ok { background: color-mix(in srgb, var(--success, #1a7f52) 16%, transparent); color: var(--success, #1a7f52); }
    .pill-void { background: color-mix(in srgb, var(--destructive) 14%, transparent); color: var(--destructive); }

    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; }
    .empty-state mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: color-mix(in srgb, var(--primary) 55%, transparent); }
    .empty-state h3 { margin: .25rem 0 0; }
    .empty-state p { margin: 0 0 .5rem; color: var(--muted-foreground); max-width: 42ch; }

    @media (max-width: 900px) {
      .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filters-card { grid-template-columns: 1fr; }
    }
  `]
})
export class FacturasCompraListComponent implements OnInit {
  private readonly facturasService = inject(FacturasCompraService);
  private readonly periodoService = inject(PeriodoContableService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['documento', 'proveedor', 'tipo', 'fecha', 'total', 'inventario', 'estado', 'acciones'];
  protected readonly tiposComprobante = TIPOS_COMPROBANTE;

  protected readonly facturas = signal<FacturaCompra[]>([]);
  protected readonly busqueda = new FormControl('', { nonNullable: true });
  protected readonly periodo = new FormControl(this.periodoService.getPeriodoInicial('compras'), { nonNullable: true });
  protected readonly tipo = new FormControl('', { nonNullable: true });
  protected readonly estado = new FormControl('', { nonNullable: true });

  private readonly busquedaSignal = signal('');
  private readonly periodoSignal = signal('');
  private readonly tipoSignal = signal('');
  private readonly estadoSignal = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(50);
  protected readonly cargando = signal(false);
  protected readonly consultaRealizada = signal(false);
  protected readonly hasMore = signal(false);
  private readonly cursors = new Map<number, FacturasCompraPageCursor | null>([[0, null]]);

  protected readonly facturasFiltradas = computed(() => {
    const texto = this.busquedaSignal().trim().toLowerCase();
    const periodo = this.periodoSignal();
    const estado = this.estadoSignal();
    const tipo = this.tipoSignal();
    return this.facturas().filter((factura) => {
      if (periodo && this.periodoDe(factura) !== periodo) {
        return false;
      }
      if (tipo && (factura.tipoComprobante || '01') !== tipo) {
        return false;
      }
      if (estado && factura.estado !== estado) {
        return false;
      }
      if (texto) {
        const haystack = `${factura.razonSocialProv} ${factura.idProv} ${this.documento(factura)} ${factura.numero ?? ''}`.toLowerCase();
        if (!haystack.includes(texto)) {
          return false;
        }
      }
      return true;
    });
  });
  protected readonly totalPaginador = computed(() =>
    this.pageIndex() * this.pageSize() + this.facturas().length + (this.hasMore() ? 1 : 0)
  );

  // Las NC restan en los KPIs (netean el período).
  protected readonly totalPeriodo = computed(() =>
    this.facturasFiltradas().filter((f) => f.estado !== 'ANULADA').reduce((total, f) => total + this.signo(f) * Number(f.importeTotal ?? 0), 0)
  );
  protected readonly totalIva = computed(() =>
    this.facturasFiltradas().filter((f) => f.estado !== 'ANULADA').reduce((total, f) => total + this.signo(f) * Number(f.montoIva ?? 0), 0)
  );
  protected readonly totalRetencion = computed(() =>
    this.facturasFiltradas().filter((f) => f.estado !== 'ANULADA').reduce((total, f) => total + this.signo(f) * Number(f.totalRetencion ?? 0), 0)
  );

  constructor() {
    this.busqueda.valueChanges.pipe(startWith(''), debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.busquedaSignal.set(value ?? ''));
    this.periodo.valueChanges.pipe(startWith(this.periodo.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.periodoSignal.set(value ?? '');
        this.periodoService.setPeriodo('compras', value ?? '');
        this.reiniciarConsulta();
      });
    this.tipo.valueChanges.pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.tipoSignal.set(value ?? ''));
    this.estado.valueChanges.pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.estadoSignal.set(value ?? ''));
  }

  ngOnInit(): void {
    if (this.periodo.value) {
      this.buscar();
    }
  }

  protected buscar(): void {
    if (!this.periodo.value) {
      return;
    }
    this.cursors.clear();
    this.cursors.set(0, null);
    void this.cargarPagina(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.buscar();
      return;
    }

    if (this.cursors.has(event.pageIndex)) {
      void this.cargarPagina(event.pageIndex);
    }
  }

  private async cargarPagina(pageIndex: number): Promise<void> {
    const periodo = this.periodo.value;
    if (!periodo || !this.cursors.has(pageIndex)) {
      return;
    }

    this.cargando.set(true);
    this.consultaRealizada.set(true);
    try {
      const page = await this.facturasService.getFacturasCompraPage(
        periodo,
        this.pageSize(),
        this.cursors.get(pageIndex) ?? null
      );
      this.facturas.set(page.items);
      this.pageIndex.set(pageIndex);
      this.hasMore.set(page.hasMore);
      if (page.nextCursor) {
        this.cursors.set(pageIndex + 1, page.nextCursor);
      } else {
        this.cursors.delete(pageIndex + 1);
      }
    } catch (error) {
      this.facturas.set([]);
      this.hasMore.set(false);
      this.toast(error instanceof Error ? error.message : 'No se pudieron cargar las compras.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  private reiniciarConsulta(): void {
    this.facturas.set([]);
    this.pageIndex.set(0);
    this.hasMore.set(false);
    this.consultaRealizada.set(false);
    this.cursors.clear();
    this.cursors.set(0, null);
  }

  protected documento(factura: FacturaCompra): string {
    return `${factura.establecimiento}-${factura.puntoEmision}-${factura.secuencial}`;
  }

  protected esNc(factura: FacturaCompra): boolean {
    return factura.tipoComprobante === TIPO_COMPROBANTE_NOTA_CREDITO;
  }

  protected tipoLabel(factura: FacturaCompra): string {
    const codigo = factura.tipoComprobante || '01';
    return this.tiposComprobante.find((t) => t.codigo === codigo)?.descripcion ?? 'Comprobante';
  }

  private signo(factura: FacturaCompra): number {
    return this.esNc(factura) ? -1 : 1;
  }

  protected montoConSigno(factura: FacturaCompra): number {
    return this.signo(factura) * Number(factura.importeTotal ?? 0);
  }

  protected estadoLabel(estado: EstadoFacturaCompra): string {
    return { BORRADOR: 'Borrador', REGISTRADA: 'Registrada', ANULADA: 'Anulada' }[estado];
  }

  protected estadoClase(estado: EstadoFacturaCompra): string {
    return { BORRADOR: 'pill-draft', REGISTRADA: 'pill-ok', ANULADA: 'pill-void' }[estado];
  }

  protected editar(factura: FacturaCompra): void {
    void this.router.navigate(['/workspace/contabilidad/compras', factura.id, 'editar']);
  }

  protected async anular(factura: FacturaCompra): Promise<void> {
    if (!factura.id) {
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        title: 'Anular compra',
        message: 'Esta compra quedara anulada. Si la compra ya genero un asiento contable, el sistema no lo reversa automaticamente; deberas crear el reverso manualmente en Contabilidad > Asientos.',
        confirmText: 'Anular compra',
        cancelText: 'Cancelar'
      }
    });

    const confirmado = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmado) {
      return;
    }

    try {
      await this.facturasService.cambiarEstado(factura.id, 'ANULADA');
      this.toast('Factura anulada.', 'block');
      await this.cargarPagina(this.pageIndex());
    } catch (error) {
      this.toast(error instanceof Error ? error.message : 'No se pudo anular la factura.', 'error');
    }
  }

  private periodoDe(factura: FacturaCompra): string {
    const fecha = factura.fechaEmision ? new Date(factura.fechaEmision) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) {
      return '';
    }
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

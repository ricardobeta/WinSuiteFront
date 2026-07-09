import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { debounceTime, firstValueFrom, startWith } from 'rxjs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { EstadoFacturaCompra, FacturaCompra, TIPOS_COMPROBANTE, TIPO_COMPROBANTE_NOTA_CREDITO } from '../../models/compras.models';
import { FacturasCompraService } from '../../services/facturas-compra.service';

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
    MatTooltipModule
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
          <p class="kpi-label">Total del período</p>
          <p class="kpi-value">{{ totalPeriodo() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Comprobantes</p>
          <p class="kpi-value">{{ facturasFiltradas().length }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">IVA compras</p>
          <p class="kpi-value">{{ totalIva() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Retenciones</p>
          <p class="kpi-value">{{ totalRetencion() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Buscar proveedor o comprobante</mat-label>
          <input matInput [formControl]="busqueda" autocomplete="off" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Período</mat-label>
          <mat-select [formControl]="periodo">
            <mat-option value="">Todos</mat-option>
            @for (opcion of periodosDisponibles(); track opcion.valor) {
              <mat-option [value]="opcion.valor">{{ opcion.etiqueta }}</mat-option>
            }
          </mat-select>
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
      </section>

      <section class="surface-card table-card">
        @if (facturasFiltradas().length === 0) {
          <div class="empty-state">
            <mat-icon>receipt_long</mat-icon>
            <h3>Sin facturas de compra</h3>
            <p>Sube el XML de una factura de proveedor para empezar a registrar tus compras.</p>
            <a mat-stroked-button color="primary" routerLink="/workspace/contabilidad/compras/nueva">
              <mat-icon>upload_file</mat-icon>
              Registrar primera factura
            </a>
          </div>
        } @else {
          <div class="table-wrap">
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
          </div>
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

    .filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: .75rem; align-items: center; }
    .filters-card .search { grid-column: 1; }
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
export class FacturasCompraListComponent {
  private readonly facturasService = inject(FacturasCompraService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['documento', 'proveedor', 'tipo', 'fecha', 'total', 'inventario', 'estado', 'acciones'];
  protected readonly tiposComprobante = TIPOS_COMPROBANTE;

  private readonly facturas = signal<FacturaCompra[]>([]);
  protected readonly busqueda = new FormControl('', { nonNullable: true });
  protected readonly periodo = new FormControl('', { nonNullable: true });
  protected readonly tipo = new FormControl('', { nonNullable: true });
  protected readonly estado = new FormControl('', { nonNullable: true });

  private readonly busquedaSignal = signal('');
  private readonly periodoSignal = signal('');
  private readonly tipoSignal = signal('');
  private readonly estadoSignal = signal('');

  protected readonly periodosDisponibles = computed(() => {
    const set = new Map<string, string>();
    for (const factura of this.facturas()) {
      const valor = this.periodoDe(factura);
      if (valor && !set.has(valor)) {
        set.set(valor, this.etiquetaPeriodo(valor));
      }
    }
    return Array.from(set.entries())
      .map(([valor, etiqueta]) => ({ valor, etiqueta }))
      .sort((a, b) => b.valor.localeCompare(a.valor));
  });

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
    this.facturasService
      .getFacturasCompra()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((facturas) => this.facturas.set(facturas));

    this.busqueda.valueChanges.pipe(startWith(''), debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.busquedaSignal.set(value ?? ''));
    this.periodo.valueChanges.pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.periodoSignal.set(value ?? ''));
    this.tipo.valueChanges.pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.tipoSignal.set(value ?? ''));
    this.estado.valueChanges.pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.estadoSignal.set(value ?? ''));
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

  private etiquetaPeriodo(valor: string): string {
    const [anio, mes] = valor.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[Number(mes) - 1] ?? mes} ${anio}`;
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

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CODIGOS_SUSTENTO, FacturaCompra, MONTO_MINIMO_FORMA_PAGO, TIPOS_COMPROBANTE } from '../../models/compras.models';
import { AtsResult, AtsService } from '../../services/ats.service';
import { FacturasCompraService } from '../../services/facturas-compra.service';

interface ChecklistItem {
  ok: boolean;
  label: string;
  detalle?: string;
  facturaIds?: string[];
}

/** Fila del resumen de compras del talón ATS, agrupada por tipo de comprobante. */
interface ResumenCompraRow {
  codigo: string;
  etiqueta: string;
  registros: number;
  base0: number;        // BI tarifa 0%
  baseGravada: number;  // BI tarifa diferente de 0%
  noObjeto: number;     // BI no objeto + exento de IVA
  iva: number;          // Valor IVA
}

/** Fila del resumen de retención de IVA por porcentaje. */
interface ResumenRetIvaRow {
  etiqueta: string;
  valor: number;
}

/** Fila del resumen por código de sustento tributario. */
interface ResumenSustentoRow {
  codigo: string;
  etiqueta: string;
  registros: number;
  base: number;
  iva: number;
}

@Component({
  selector: 'app-ats-generar',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <section class="ats-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">SRI Ecuador · Anexo</p>
          <h2>Generar ATS (compras)</h2>
          <p class="support">Genera el XML del Anexo Transaccional Simplificado con las facturas de compra del período.</p>
        </div>
        <a mat-stroked-button routerLink="/workspace/contabilidad/compras">
          <mat-icon>receipt_long</mat-icon> Ver facturas
        </a>
      </header>

      <section class="surface-card period-card">
        <div class="period-heading">
          <span class="period-heading__icon" aria-hidden="true"><mat-icon>calendar_month</mat-icon></span>
          <div>
            <h3>Período a consultar</h3>
            <p>Selecciona el mes fiscal y define qué documentos formarán parte de la revisión.</p>
          </div>
        </div>

        <div class="period-controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Año</mat-label>
            <mat-select [formControl]="anio">
              @for (a of anios; track a) { <mat-option [value]="a">{{ a }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Mes</mat-label>
            <mat-select [formControl]="mes">
              @for (m of meses; track m.valor) { <mat-option [value]="m.valor">{{ m.etiqueta }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <div class="borradores-toggle" [class.enabled]="incluirBorradores()">
            <span class="option-label">Alcance de documentos</span>
            <mat-slide-toggle [checked]="incluirBorradores()" (change)="setIncluirBorradores($event.checked)">
              Incluir borradores
            </mat-slide-toggle>
            <span class="toggle-hint">{{ incluirBorradores() ? 'Incluye facturas BORRADOR y REGISTRADA' : 'Recomendado: solo facturas REGISTRADA' }}</span>
          </div>
        </div>

        <div class="period-actions">
          <div class="period-count" [class.ready]="periodoBuscado()">
            <mat-icon>{{ periodoBuscado() ? 'fact_check' : 'info' }}</mat-icon>
            <span>{{ periodoBuscado() ? facturasPeriodo().length + ' factura(s) encontradas en el período' : 'Consulta las facturas para habilitar la generación del ATS' }}</span>
          </div>
          <button mat-raised-button color="primary" type="button" (click)="buscarFacturas()" [disabled]="buscando()">
            <mat-icon>search</mat-icon>
            {{ buscando() ? 'Consultando...' : 'Consultar facturas' }}
          </button>
        </div>
      </section>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Compras</p>
          <p class="kpi-value">{{ facturasPeriodo().length }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Base imponible</p>
          <p class="kpi-value">{{ totalBase() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">IVA</p>
          <p class="kpi-value">{{ totalIva() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Retención</p>
          <p class="kpi-value">{{ totalRet() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
      </section>

      <section class="surface-card checklist-card">
        <h3>Validaciones previas</h3>
        <ul class="checklist">
          @for (item of checklist(); track item.label) {
            <li [class.warn]="!item.ok">
              <mat-icon>{{ item.ok ? 'check_circle' : 'warning' }}</mat-icon>
              <div>
                <span class="check-label">{{ item.label }}</span>
                @if (item.detalle) { <span class="check-detail">{{ item.detalle }}</span> }
              </div>
            </li>
          }
        </ul>

        <div class="actions">
          <button mat-flat-button color="primary" (click)="generar()" [disabled]="generando() || !periodoBuscado() || facturasPeriodo().length === 0">
            <mat-icon>build</mat-icon>
            {{ generando() ? 'Generando…' : 'Generar XML ATS' }}
          </button>
          @if (resultado()) {
            <button mat-stroked-button color="primary" (click)="descargar()">
              <mat-icon>download</mat-icon> Descargar XML
            </button>
          }
        </div>

        @if (resultado(); as res) {
          <p class="result-ok"><mat-icon>task_alt</mat-icon> ATS generado con {{ res.numeroCompras }} compras. Listo para descargar y validar en el SRI.</p>
        }
      </section>

      @if (resultado(); as res) {
        <section class="surface-card resumen-card">
          <header class="resumen-head">
            <div class="resumen-title">
              <span class="resumen-badge" aria-hidden="true"><mat-icon>fact_check</mat-icon></span>
              <div>
                <h3>Talón resumen · Anexo Transaccional</h3>
                <p class="resumen-sub">
                  Período {{ nombreMes() }} {{ anioSignal() }} · {{ res.numeroCompras }} compra(s)
                  @if (generadoEn(); as g) { · generado {{ g | date: 'dd/MM/yyyy HH:mm' }} }
                </p>
              </div>
            </div>
            <button mat-flat-button color="primary" (click)="descargar()">
              <mat-icon>download</mat-icon> Descargar XML
            </button>
          </header>

          <div class="resumen-block">
            <div class="block-title"><mat-icon>receipt_long</mat-icon> Compras por tipo de comprobante</div>
            <div class="table-scroll">
              <table class="resumen-table compras">
                <thead>
                  <tr>
                    <th class="l">Transacción</th>
                    <th class="c">Registros</th>
                    <th class="r">BI tarifa 0%</th>
                    <th class="r">BI tarifa &gt; 0%</th>
                    <th class="r">No objeto / exento</th>
                    <th class="r">Valor IVA</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of resumenCompras(); track row.codigo) {
                    <tr>
                      <td class="l"><span class="cod-chip">{{ row.codigo }}</span> {{ row.etiqueta }}</td>
                      <td class="c">{{ row.registros }}</td>
                      <td class="r">{{ row.base0 | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r">{{ row.baseGravada | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r">{{ row.noObjeto | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r strong">{{ row.iva | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="empty">Sin compras en el período seleccionado.</td></tr>
                  }
                </tbody>
                @if (resumenCompras().length) {
                  <tfoot>
                    <tr>
                      <td class="l">TOTAL</td>
                      <td class="c">{{ totalCompras().registros }}</td>
                      <td class="r">{{ totalCompras().base0 | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r">{{ totalCompras().baseGravada | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r">{{ totalCompras().noObjeto | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="r">{{ totalCompras().iva | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                    </tr>
                  </tfoot>
                }
              </table>
            </div>
          </div>

          <div class="resumen-cols">
            <div class="resumen-block">
              <div class="block-title"><mat-icon>percent</mat-icon> Retención en la fuente de IVA</div>
              <div class="table-scroll">
                <table class="resumen-table">
                  <tbody>
                    @for (r of resumenRetIva(); track r.etiqueta) {
                      <tr>
                        <td class="l">{{ r.etiqueta }}</td>
                        <td class="r" [class.muted]="!r.valor">{{ r.valor | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr><td class="l">TOTAL retenido</td><td class="r strong">{{ totalRetIva() | currency: 'USD':'symbol-narrow':'1.2-2' }}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="resumen-block">
              <div class="block-title"><mat-icon>account_balance</mat-icon> Sustento tributario</div>
              <div class="table-scroll">
                <table class="resumen-table">
                  <thead>
                    <tr><th class="l">Sustento</th><th class="c">Reg.</th><th class="r">Base</th><th class="r">IVA</th></tr>
                  </thead>
                  <tbody>
                    @for (s of resumenSustento(); track s.codigo) {
                      <tr>
                        <td class="l"><span class="cod-chip">{{ s.codigo }}</span> {{ s.etiqueta }}</td>
                        <td class="c">{{ s.registros }}</td>
                        <td class="r">{{ s.base | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                        <td class="r">{{ s.iva | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="empty">Sin registros.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .ats-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }

    .period-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .period-heading { display: flex; align-items: center; gap: .75rem; }
    .period-heading__icon { width: 2.65rem; height: 2.65rem; display: grid; place-items: center; flex: 0 0 auto; border-radius: .8rem; color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }
    .period-heading h3 { margin: 0; font-size: 1rem; }
    .period-heading p { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    .period-controls { display: grid; grid-template-columns: minmax(130px, .65fr) minmax(180px, 1fr) minmax(260px, 1.35fr); gap: .85rem; align-items: stretch; }
    .period-controls mat-form-field { width: 100%; }
    .borradores-toggle { min-height: 3.5rem; display: flex; flex-direction: column; justify-content: center; gap: .16rem; padding: .55rem .8rem; border: 1px solid var(--tc-ghost-border); border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    .borradores-toggle.enabled { border-color: var(--tc-warning); background: var(--tc-warning-container); color: var(--tc-on-warning-container); }
    .borradores-toggle.enabled .option-label, .borradores-toggle.enabled .toggle-hint { color: var(--tc-on-warning-container); }
    .option-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted-foreground); }
    .toggle-hint { font-size: .78rem; color: var(--muted-foreground); }
    .period-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: .9rem; border-top: 1px solid var(--tc-ghost-border); }
    .period-count { min-width: 0; display: flex; align-items: center; gap: .5rem; color: var(--muted-foreground); font-size: .86rem; }
    .period-count mat-icon { color: var(--tc-info); flex: 0 0 auto; }
    .period-count.ready mat-icon { color: var(--tc-success); }
    .period-actions button { flex: 0 0 auto; }

    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .metric-hero { color: #fff; background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 30%, transparent); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }

    .checklist-card { padding: 1.25rem 1.5rem; display: grid; gap: 1rem; }
    .checklist-card h3 { margin: 0; }
    .checklist { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .checklist li { display: flex; gap: .6rem; align-items: flex-start; }
    .checklist li mat-icon { color: var(--success, #1a7f52); }
    .checklist li.warn mat-icon { color: #b7791f; }
    .check-label { display: block; font-weight: 500; }
    .check-detail { display: block; font-size: .82rem; color: var(--muted-foreground); }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    .result-ok { display: flex; align-items: center; gap: .5rem; color: var(--success, #1a7f52); margin: 0; }

    /* --- Talón resumen --- */
    .resumen-card { padding: 1.25rem 1.5rem; display: grid; gap: 1.4rem; }
    .resumen-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .resumen-title { display: flex; align-items: center; gap: .85rem; }
    .resumen-badge { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; display: grid; place-items: center; border-radius: .85rem; color: #fff; background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #0a1f1b)); }
    .resumen-title h3 { margin: 0; font-size: 1.15rem; }
    .resumen-sub { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .85rem; }
    .resumen-cols { display: grid; grid-template-columns: 1fr 1.35fr; gap: 1.4rem; align-items: start; }

    .resumen-block { display: grid; gap: .55rem; }
    .block-title { display: flex; align-items: center; gap: .45rem; font-weight: 700; font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; color: var(--primary); }
    .block-title mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; }

    .table-scroll { overflow-x: auto; border: 1px solid var(--tc-ghost-border); border-radius: var(--tc-radius-md, .75rem); }
    .resumen-table { width: 100%; border-collapse: collapse; font-size: .88rem; min-width: 100%; }
    .resumen-table th, .resumen-table td { padding: .6rem .85rem; white-space: nowrap; }
    .resumen-table thead th { background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--foreground); font-weight: 700; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; text-align: left; }
    .resumen-table tbody tr + tr td { border-top: 1px solid var(--tc-ghost-border); }
    .resumen-table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--primary) 3%, transparent); }
    .resumen-table .l { text-align: left; }
    .resumen-table .c { text-align: center; }
    .resumen-table .r { text-align: right; font-variant-numeric: tabular-nums; }
    .resumen-table .strong { font-weight: 700; }
    .resumen-table .muted { color: var(--muted-foreground); }
    .resumen-table .empty { text-align: center; color: var(--muted-foreground); padding: 1rem; }
    .resumen-table tfoot td { border-top: 2px solid color-mix(in srgb, var(--primary) 45%, transparent); font-weight: 700; background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .cod-chip { display: inline-grid; place-items: center; min-width: 1.6rem; padding: .05rem .35rem; margin-right: .35rem; border-radius: .4rem; background: color-mix(in srgb, var(--primary) 16%, transparent); color: var(--primary); font-weight: 700; font-size: .74rem; }

    @media (max-width: 900px) {
      .period-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .borradores-toggle { grid-column: 1 / -1; }
      .kpi-row { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .resumen-cols { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .period-card { padding: 1rem; }
      .period-controls { grid-template-columns: 1fr; }
      .borradores-toggle { grid-column: auto; }
      .period-actions { align-items: stretch; flex-direction: column; }
      .period-actions button { width: 100%; }
      .kpi-row { grid-template-columns: 1fr; }
    }
  `]
})
export class AtsGenerarComponent {
  private readonly facturasService = inject(FacturasCompraService);
  private readonly atsService = inject(AtsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hoy = new Date();
  protected readonly anios = Array.from({ length: 6 }, (_, i) => this.hoy.getFullYear() - i);
  protected readonly meses = [
    { valor: 1, etiqueta: 'Enero' }, { valor: 2, etiqueta: 'Febrero' }, { valor: 3, etiqueta: 'Marzo' },
    { valor: 4, etiqueta: 'Abril' }, { valor: 5, etiqueta: 'Mayo' }, { valor: 6, etiqueta: 'Junio' },
    { valor: 7, etiqueta: 'Julio' }, { valor: 8, etiqueta: 'Agosto' }, { valor: 9, etiqueta: 'Septiembre' },
    { valor: 10, etiqueta: 'Octubre' }, { valor: 11, etiqueta: 'Noviembre' }, { valor: 12, etiqueta: 'Diciembre' }
  ];

  protected readonly anio = new FormControl(this.hoy.getFullYear(), { nonNullable: true });
  protected readonly mes = new FormControl(this.hoy.getMonth() + 1, { nonNullable: true });

  private readonly facturas = signal<FacturaCompra[]>([]);
  protected readonly anioSignal = signal(this.hoy.getFullYear());
  private readonly mesSignal = signal(this.hoy.getMonth() + 1);

  protected readonly generando = signal(false);
  protected readonly buscando = signal(false);
  protected readonly periodoBuscado = signal<string | null>(null);
  protected readonly resultado = signal<AtsResult | null>(null);
  protected readonly generadoEn = signal<Date | null>(null);
  // Por defecto solo se incluyen las REGISTRADA; el usuario puede activar los borradores.
  protected readonly incluirBorradores = signal(false);

  protected readonly facturasPeriodo = computed(() =>
    this.facturas().filter((f) => {
      if (f.estado === 'ANULADA') {
        return false;
      }
      if (!this.incluirBorradores() && f.estado === 'BORRADOR') {
        return false;
      }
      const fecha = f.fechaEmision ? new Date(f.fechaEmision) : null;
      return !!fecha && fecha.getFullYear() === this.anioSignal() && fecha.getMonth() + 1 === this.mesSignal();
    })
  );

  protected setIncluirBorradores(value: boolean): void {
    this.incluirBorradores.set(value);
    this.invalidarBusqueda();
  }

  protected async buscarFacturas(): Promise<void> {
    this.buscando.set(true);
    this.resultado.set(null);
    try {
      const facturas = await this.facturasService.getFacturasCompraPorPeriodo(this.anio.value, this.mes.value);
      this.facturas.set(facturas);
      this.periodoBuscado.set(this.clavePeriodo());
    } catch (error: unknown) {
      this.facturas.set([]);
      this.periodoBuscado.set(null);
      this.toast(error instanceof Error ? error.message : 'No se pudieron buscar las facturas del periodo.', 'error');
    } finally {
      this.buscando.set(false);
    }
  }

  protected readonly totalBase = computed(() => this.facturasPeriodo().reduce((t, f) => t + Number(f.baseImpGrav ?? 0) + Number(f.baseImponible ?? 0), 0));
  protected readonly totalIva = computed(() => this.facturasPeriodo().reduce((t, f) => t + Number(f.montoIva ?? 0), 0));
  protected readonly totalRet = computed(() => this.facturasPeriodo().reduce((t, f) => t + Number(f.totalRetencion ?? 0), 0));

  protected readonly checklist = computed<ChecklistItem[]>(() => {
    const facturas = this.facturasPeriodo();
    const sinFormaPago = facturas.filter((f) => Number(f.importeTotal ?? 0) >= MONTO_MINIMO_FORMA_PAGO && (f.formasDePago?.length ?? 0) === 0);
    const sinAutorizacion = facturas.filter((f) => !(f.autorizacion || f.claveAcceso));
    const borradores = facturas.filter((f) => f.estado === 'BORRADOR');
    return [
      {
        ok: sinFormaPago.length === 0,
        label: 'Formas de pago en compras ≥ $500',
        detalle: sinFormaPago.length ? `${sinFormaPago.length} factura(s) sin forma de pago` : undefined
      },
      {
        ok: sinAutorizacion.length === 0,
        label: 'Autorización / clave de acceso presente',
        detalle: sinAutorizacion.length ? `${sinAutorizacion.length} factura(s) sin autorización` : undefined
      },
      {
        ok: true,
        label: 'Razón social del informante normalizada (sin tildes)',
        detalle: 'Se normaliza automáticamente al generar'
      },
      {
        ok: borradores.length === 0,
        label: 'Facturas registradas (no en borrador)',
        detalle: borradores.length
          ? `${borradores.length} en borrador — se incluirán (bandera activa)`
          : (this.incluirBorradores() ? undefined : 'Los borradores quedan excluidos')
      }
    ];
  });

  private readonly etiquetaComprobante = new Map(TIPOS_COMPROBANTE.map((t) => [t.codigo, t.descripcion]));
  private readonly etiquetaSustento = new Map(CODIGOS_SUSTENTO.map((s) => [s.codigo, s.descripcion]));

  /** Resumen de compras agrupado por tipo de comprobante (como el talón resumen del SRI). */
  protected readonly resumenCompras = computed<ResumenCompraRow[]>(() => {
    const grupos = new Map<string, ResumenCompraRow>();
    for (const f of this.facturasPeriodo()) {
      const codigo = f.tipoComprobante || '01';
      const row = grupos.get(codigo) ?? {
        codigo,
        etiqueta: this.etiquetaComprobante.get(codigo) ?? `Comprobante ${codigo}`,
        registros: 0, base0: 0, baseGravada: 0, noObjeto: 0, iva: 0
      };
      row.registros += 1;
      row.base0 += Number(f.baseImponible ?? 0);
      row.baseGravada += Number(f.baseImpGrav ?? 0);
      row.noObjeto += Number(f.baseNoGraIva ?? 0) + Number(f.baseImpExe ?? 0);
      row.iva += Number(f.montoIva ?? 0);
      grupos.set(codigo, row);
    }
    return [...grupos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  });

  protected readonly totalCompras = computed<ResumenCompraRow>(() =>
    this.resumenCompras().reduce((t, r) => ({
      codigo: '', etiqueta: 'TOTAL',
      registros: t.registros + r.registros,
      base0: t.base0 + r.base0,
      baseGravada: t.baseGravada + r.baseGravada,
      noObjeto: t.noObjeto + r.noObjeto,
      iva: t.iva + r.iva
    }), { codigo: '', etiqueta: 'TOTAL', registros: 0, base0: 0, baseGravada: 0, noObjeto: 0, iva: 0 })
  );

  /** Retención de IVA en la fuente, repartida por porcentaje (esquema SRI vigente). */
  protected readonly resumenRetIva = computed<ResumenRetIvaRow[]>(() => {
    const buckets = new Map<number, number>([[10, 0], [20, 0], [30, 0], [50, 0], [70, 0], [100, 0]]);
    for (const f of this.facturasPeriodo()) {
      for (const r of (f.retencionesIva ?? [])) {
        let p = Number(r.porcentajeIva ?? 0);
        if (p > 0 && p <= 1) { p *= 100; }
        p = Math.round(p);
        const key = buckets.has(p) ? p : 70;
        buckets.set(key, (buckets.get(key) ?? 0) + Number(r.valRetIva ?? 0));
      }
    }
    return [...buckets.entries()].map(([porcentaje, valor]) => ({ etiqueta: `Retención IVA ${porcentaje}%`, valor }));
  });

  protected readonly totalRetIva = computed(() => this.resumenRetIva().reduce((t, r) => t + r.valor, 0));

  /** Resumen por código de sustento tributario. */
  protected readonly resumenSustento = computed<ResumenSustentoRow[]>(() => {
    const grupos = new Map<string, ResumenSustentoRow>();
    for (const f of this.facturasPeriodo()) {
      const codigo = f.codSustento || '01';
      const row = grupos.get(codigo) ?? {
        codigo,
        etiqueta: this.etiquetaSustento.get(codigo) ?? `Sustento ${codigo}`,
        registros: 0, base: 0, iva: 0
      };
      row.registros += 1;
      row.base += Number(f.baseImpGrav ?? 0) + Number(f.baseImponible ?? 0) + Number(f.baseNoGraIva ?? 0) + Number(f.baseImpExe ?? 0);
      row.iva += Number(f.montoIva ?? 0);
      grupos.set(codigo, row);
    }
    return [...grupos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  });

  protected readonly nombreMes = computed(() => this.meses.find((m) => m.valor === this.mesSignal())?.etiqueta ?? '');

  constructor() {
    this.anio.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => { this.anioSignal.set(v); this.invalidarBusqueda(); });
    this.mes.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => { this.mesSignal.set(v); this.invalidarBusqueda(); });
  }

  protected generar(): void {
    if (this.periodoBuscado() !== this.clavePeriodo()) {
      this.toast('Busca las facturas del periodo antes de generar el ATS.', 'error');
      return;
    }
    this.generando.set(true);
    this.atsService.generar(this.anio.value, this.mes.value, this.incluirBorradores()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.generadoEn.set(new Date());
        this.generando.set(false);
        this.toast(`ATS generado con ${res.numeroCompras} compras.`, 'task_alt');
      },
      error: (error) => {
        this.generando.set(false);
        this.toast(error?.error?.message ?? 'No se pudo generar el ATS.', 'error');
      }
    });
  }

  protected descargar(): void {
    const res = this.resultado();
    if (!res) {
      return;
    }
    const blob = new Blob([res.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ATS_${this.anio.value}_${String(this.mes.value).padStart(2, '0')}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private invalidarBusqueda(): void {
    this.facturas.set([]);
    this.periodoBuscado.set(null);
    this.resultado.set(null);
    this.generadoEn.set(null);
  }

  private clavePeriodo(): string {
    return `${this.anio.value}-${String(this.mes.value).padStart(2, '0')}-${this.incluirBorradores() ? 'con-borradores' : 'registradas'}`;
  }
}

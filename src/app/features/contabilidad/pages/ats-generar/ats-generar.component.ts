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
import { FacturaCompra, MONTO_MINIMO_FORMA_PAGO } from '../../models/compras.models';
import { AtsResult, AtsService } from '../../services/ats.service';
import { FacturasCompraService } from '../../services/facturas-compra.service';

interface ChecklistItem {
  ok: boolean;
  label: string;
  detalle?: string;
  facturaIds?: string[];
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

    @media (max-width: 900px) {
      .period-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .borradores-toggle { grid-column: 1 / -1; }
      .kpi-row { grid-template-columns: repeat(2, minmax(0,1fr)); }
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
  private readonly anioSignal = signal(this.hoy.getFullYear());
  private readonly mesSignal = signal(this.hoy.getMonth() + 1);

  protected readonly generando = signal(false);
  protected readonly buscando = signal(false);
  protected readonly periodoBuscado = signal<string | null>(null);
  protected readonly resultado = signal<AtsResult | null>(null);
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
  }

  private clavePeriodo(): string {
    return `${this.anio.value}-${String(this.mes.value).padStart(2, '0')}-${this.incluirBorradores() ? 'con-borradores' : 'registradas'}`;
  }
}

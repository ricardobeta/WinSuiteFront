import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { CuentaBancaria } from '../../models/bancos.models';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { AgregadoBancario, BancosMovimientosService } from '../../services/bancos-movimientos.service';

interface FilaFlujo {
  periodo: string;
  creditos: number;
  debitos: number;
  neto: number;
  saldoFinal?: number;
}

interface ResumenCuenta {
  cuenta: CuentaBancaria;
  flujo: FilaFlujo[];
  ultimoSaldo?: number;
}

const MESES_DASHBOARD = 6;

/**
 * Dashboard de saldos y flujo de caja simple. Se alimenta exclusivamente de
 * los agregados precalculados por período (una lectura por cuenta): nunca
 * carga los movimientos ni mantiene listeners sobre ellos.
 */
@Component({
  selector: 'app-bancos-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule
  ],
  template: `
    <section class="dash-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Dashboard de bancos</h2>
          <p class="support">Saldos por cuenta y flujo de caja de los últimos {{ mesesDashboard }} meses según los extractos importados.</p>
        </div>
        <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos">
          <mat-icon>arrow_back</mat-icon>
          Cuentas
        </a>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Saldo total en bancos</p>
          <p class="kpi-value">{{ saldoTotal() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Flujo neto del mes actual</p>
          <p class="kpi-value" [class.neg]="flujoMesActual() < 0">{{ flujoMesActual() | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Cuentas activas</p>
          <p class="kpi-value">{{ resumenes().length }}</p>
        </article>
      </section>

      @if (cargando()) {
        <section class="surface-card empty-state">
          <mat-icon>hourglass_empty</mat-icon>
          <h3>Cargando dashboard…</h3>
        </section>
      } @else if (resumenes().length === 0) {
        <section class="surface-card empty-state">
          <mat-icon>account_balance</mat-icon>
          <h3>Sin datos</h3>
          <p>Importa extractos bancarios para alimentar el dashboard.</p>
        </section>
      } @else {
        @for (resumen of resumenes(); track resumen.cuenta.id) {
          <section class="surface-card cuenta-card">
            <div class="cuenta-header">
              <div>
                <h3>{{ resumen.cuenta.nombre }}</h3>
                <p class="hint">{{ resumen.cuenta.bancoNombre }} · {{ resumen.cuenta.numeroCuenta }}</p>
              </div>
              <div class="saldo">
                <span class="kpi-label">Último saldo extracto</span>
                <strong>{{ resumen.ultimoSaldo != null ? (resumen.ultimoSaldo | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}</strong>
              </div>
            </div>

            @if (resumen.flujo.length === 0) {
              <p class="hint">Sin extractos importados en los últimos {{ mesesDashboard }} meses.</p>
            } @else {
              <div class="flujo">
                @for (fila of resumen.flujo; track fila.periodo) {
                  <div class="flujo-fila">
                    <span class="periodo">{{ fila.periodo }}</span>
                    <div class="barras">
                      <div class="barra positiva" [style.width.%]="ancho(fila.creditos, resumen.flujo)"></div>
                      <div class="barra negativa" [style.width.%]="ancho(fila.debitos, resumen.flujo)"></div>
                    </div>
                    <span class="neto" [class.neg]="fila.neto < 0">{{ fila.neto | currency: 'USD':'symbol-narrow':'1.2-2' }}</span>
                  </div>
                }
              </div>
              <p class="leyenda">
                <span class="dot positiva"></span> Ingresos ·
                <span class="dot negativa"></span> Egresos ·
                neto por mes
              </p>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .dash-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .kpi-value.neg { color: var(--destructive); }
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .cuenta-card { padding: 1.1rem 1.4rem; display: grid; gap: .75rem; }
    .cuenta-header { display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; }
    .cuenta-header h3 { margin: 0; }
    .hint { color: var(--muted-foreground); margin: .15rem 0 0; font-size: .85rem; }
    .saldo { display: grid; text-align: right; gap: .15rem; }
    .saldo strong { font-size: 1.2rem; }
    .flujo { display: grid; gap: .4rem; }
    .flujo-fila { display: grid; grid-template-columns: 70px 1fr 130px; align-items: center; gap: .75rem; }
    .periodo { font-variant-numeric: tabular-nums; color: var(--muted-foreground); font-size: .85rem; }
    .barras { display: grid; gap: 2px; }
    .barra { height: 8px; border-radius: 4px; min-width: 2px; }
    .barra.positiva, .dot.positiva { background: #16a34a; }
    .barra.negativa, .dot.negativa { background: #dc2626; }
    .neto { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .neto.neg { color: var(--destructive); }
    .leyenda { margin: 0; font-size: .78rem; color: var(--muted-foreground); display: flex; align-items: center; gap: .35rem; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; }
    @media (max-width: 900px) { .kpi-row { grid-template-columns: 1fr; } .flujo-fila { grid-template-columns: 60px 1fr 110px; } }
  `]
})
export class BancosDashboardComponent {
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly movimientosService = inject(BancosMovimientosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mesesDashboard = MESES_DASHBOARD;
  protected readonly cargando = signal(true);
  protected readonly resumenes = signal<ResumenCuenta[]>([]);

  protected readonly saldoTotal = computed(() =>
    this.resumenes().reduce((total, resumen) => total + (resumen.ultimoSaldo ?? 0), 0));

  protected readonly flujoMesActual = computed(() => {
    const periodoActual = new Date().toISOString().slice(0, 7);
    return this.resumenes().reduce((total, resumen) => {
      const fila = resumen.flujo.find((item) => item.periodo === periodoActual);
      return total + (fila?.neto ?? 0);
    }, 0);
  });

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuentas) => void this.cargarResumenes(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA')),
        error: () => this.cargando.set(false)
      });
  }

  private async cargarResumenes(cuentas: CuentaBancaria[]): Promise<void> {
    try {
      const periodos = this.ultimosPeriodos();
      const resumenes = await Promise.all(cuentas.map(async (cuenta) => {
        const agregados = cuenta.id ? await this.movimientosService.getAgregados(cuenta.id) : {};
        const flujo: FilaFlujo[] = periodos
          .map((periodo) => ({ periodo, agregado: agregados[periodo] as AgregadoBancario | undefined }))
          .filter((item) => !!item.agregado)
          .map((item) => ({
            periodo: item.periodo,
            creditos: item.agregado!.totalCreditos ?? 0,
            debitos: item.agregado!.totalDebitos ?? 0,
            neto: Math.round(((item.agregado!.totalCreditos ?? 0) + (item.agregado!.totalDebitos ?? 0)) * 100) / 100,
            saldoFinal: item.agregado!.saldoFinal
          }));
        return {
          cuenta,
          flujo,
          ultimoSaldo: cuenta.saldoExtracto?.valor ?? flujo.at(-1)?.saldoFinal
        } satisfies ResumenCuenta;
      }));
      this.resumenes.set(resumenes);
    } catch {
      this.snackBar.open('No se pudo cargar el dashboard de bancos.', 'OK', { duration: 4500 });
    } finally {
      this.cargando.set(false);
    }
  }

  private ultimosPeriodos(): string[] {
    const periodos: string[] = [];
    const ahora = new Date();
    for (let index = MESES_DASHBOARD - 1; index >= 0; index--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - index, 1);
      periodos.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
    }
    return periodos;
  }

  protected ancho(valor: number, flujo: FilaFlujo[]): number {
    const maximo = Math.max(...flujo.map((fila) => Math.max(fila.creditos, Math.abs(fila.debitos))), 1);
    return Math.min(100, Math.round((Math.abs(valor) / maximo) * 100));
  }
}

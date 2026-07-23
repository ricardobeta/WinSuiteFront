import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConceptoProvision, DesgloseProvisiones } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

/**
 * Desglose de lo provisionado por empleado y concepto. Responde "cuanto llevo acumulado de decimo
 * tercero de Juan" sin recorrer el mayor, y es la verificacion previa a pagar un rol de decimos:
 * el saldo que se ve aqui es exactamente lo que ese rol va a pagar.
 */
@Component({
  selector: 'app-nomina-provisiones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule
  ],
  template: `
    <section class="provisiones-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina</p>
          <h2>Provisiones acumuladas</h2>
          <p>Lo que se ha provisionado por empleado, cuanto se ha pagado y que saldo queda pendiente.</p>
        </div>
        <mat-form-field appearance="outline" class="anio-field">
          <mat-label>Anio</mat-label>
          <input matInput type="number" min="2000" max="2100" [ngModel]="anio()" (ngModelChange)="cambiarAnio($event)" />
        </mat-form-field>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="kpi-row">
        @for (total of desglose()?.totalesPorConcepto ?? []; track total.concepto) {
          <article class="surface-card kpi-card">
            <span [matTooltip]="baseCalculo(total.concepto)">{{ etiqueta(total.concepto) }}</span>
            <strong>{{ total.saldo | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
            <small>Acumulado {{ total.acumulado | currency:'USD':'symbol-narrow':'1.2-2' }} · Pagado {{ total.pagado | currency:'USD':'symbol-narrow':'1.2-2' }}</small>
          </article>
        }
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_top</mat-icon>
            <h3>Cargando provisiones</h3>
          </div>
        } @else if ((desglose()?.empleados ?? []).length === 0) {
          <div class="empty-state">
            <mat-icon>savings</mat-icon>
            <h3>Sin provisiones en {{ anio() }}</h3>
            <p>Las provisiones se acumulan al aprobar cada rol mensual.</p>
          </div>
        } @else {
          @for (empleado of desglose()!.empleados; track empleado.empleadoId) {
            <mat-expansion-panel class="empleado-panel">
              <mat-expansion-panel-header>
                <mat-panel-title>{{ empleado.empleadoNombre }}</mat-panel-title>
                <mat-panel-description>
                  @for (saldo of empleado.saldos; track saldo.concepto) {
                    <span class="chip">{{ corto(saldo.concepto) }} {{ saldo.saldo | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
                  }
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="saldos-grid">
                @for (saldo of empleado.saldos; track saldo.concepto) {
                  <div class="saldo-card">
                    <span class="saldo-titulo">{{ etiqueta(saldo.concepto) }}</span>
                    <span class="saldo-base">{{ baseCalculo(saldo.concepto) }}</span>
                    <dl>
                      <div><dt>Acumulado</dt><dd>{{ saldo.acumulado | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                      <div><dt>Pagado</dt><dd>{{ saldo.pagado | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                      <div class="saldo"><dt>Saldo</dt><dd>{{ saldo.saldo | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                    </dl>
                  </div>
                }
              </div>

              <h4>Roles que componen el acumulado</h4>
              <div class="table-wrap">
                <table class="aportes">
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Periodo</th>
                      <th class="num">D13</th>
                      <th class="num">D14</th>
                      <th class="num">Fondos</th>
                      <th class="num">Vacaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (aporte of empleado.aportes; track aporte.rolId) {
                      <tr [class.pago]="aporte.tipo !== 'MENSUAL'">
                        <td>
                          <a [routerLink]="['/workspace/contabilidad/nomina/roles', aporte.rolId]">{{ aporte.rolNumero || aporte.rolId }}</a>
                        </td>
                        <td>{{ aporte.periodo }}</td>
                        <td class="num">{{ aporte.decimoTerceroProvision | number:'1.2-2' }}</td>
                        <td class="num">{{ aporte.decimoCuartoProvision | number:'1.2-2' }}</td>
                        <td class="num">{{ aporte.fondosReservaProvision | number:'1.2-2' }}</td>
                        <td class="num">{{ aporte.vacacionesProvision | number:'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </mat-expansion-panel>
          }
        }
      </section>
    </section>
  `,
  styles: [`
    .provisiones-page { display: grid; gap: 1rem; }
    .page-header, .table-card, .kpi-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .anio-field { max-width: 140px; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    h4 { margin: 1rem 0 .5rem; font-size: .95rem; }
    .page-header p, .empty-state p { color: var(--muted-foreground); }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { display: grid; gap: .25rem; border-radius: var(--tc-radius-lg); }
    .kpi-card span { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 1.5rem; }
    .kpi-card small { color: var(--muted-foreground); }
    .empleado-panel { background: var(--tc-surface-container-lowest); margin-bottom: .5rem; }
    .chip { margin-left: .5rem; padding: .15rem .55rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, transparent); font-size: .8rem; }
    .saldos-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .saldo-card { display: grid; gap: .3rem; padding: .75rem .9rem; border-radius: .6rem; background: color-mix(in srgb, var(--foreground) 5%, transparent); }
    .saldo-titulo { font-weight: 700; }
    .saldo-base { font-size: .78rem; color: var(--muted-foreground); }
    .saldo-card dl { margin: .25rem 0 0; display: grid; gap: .2rem; }
    .saldo-card dl div { display: flex; justify-content: space-between; }
    .saldo-card dt, .saldo-card dd { margin: 0; font-size: .88rem; }
    .saldo-card .saldo { border-top: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent); padding-top: .25rem; font-weight: 700; }
    .table-wrap { overflow: auto; }
    table.aportes { width: 100%; border-collapse: collapse; min-width: 620px; }
    table.aportes th, table.aportes td { padding: .45rem .6rem; text-align: left; border-bottom: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); }
    table.aportes th { font-size: .78rem; text-transform: uppercase; color: var(--muted-foreground); }
    table.aportes tr.pago { background: color-mix(in srgb, var(--primary) 7%, transparent); }
    .num { text-align: right; }
    .empty-state { min-height: 190px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 1100px) {
      .kpi-row, .saldos-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class NominaProvisionesComponent implements OnInit {
  private readonly nominaService = inject(NominaService);

  protected readonly anio = signal(String(new Date().getFullYear()));
  protected readonly desglose = signal<DesgloseProvisiones | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.cargar();
  }

  protected cambiarAnio(anio: string): void {
    this.anio.set(String(anio ?? '').slice(0, 4));
    if (this.anio().length === 4) {
      void this.cargar();
    }
  }

  protected etiqueta(concepto: ConceptoProvision): string {
    return this.nominaService.etiquetasConcepto[concepto];
  }

  protected baseCalculo(concepto: ConceptoProvision): string {
    return this.nominaService.basesCalculoProvision[concepto];
  }

  protected corto(concepto: ConceptoProvision): string {
    return { DECIMO_TERCERO: 'D13', DECIMO_CUARTO: 'D14', FONDOS_RESERVA: 'Fondos', VACACIONES: 'Vac.' }[concepto];
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.desglose.set(await this.nominaService.getDesgloseProvisiones(this.anio()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el desglose de provisiones.');
    } finally {
      this.cargando.set(false);
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { dateAIso, isoADate } from '../../../../shared/utils/fecha-input.util';
import {
  CausalTerminacionNomina,
  LiquidacionEmpleado,
  LiquidacionNomina,
  RubroLiquidacion
} from '../../../contabilidad/models/nomina.models';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { CAUSALES_TERMINACION_NOMINA } from '../../../contabilidad/services/nomina-liquidacion.util';
import { NominaService } from '../../../contabilidad/services/nomina.service';
import { RevisionAsientoService } from '../../../contabilidad/services/revision-asiento.service';

@Component({
  selector: 'app-nomina-liquidacion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="liquidacion-page">
      <header class="surface-card page-header">
        <div>
          <p class="kicker">Nomina · Cierre laboral</p>
          <h2>{{ liquidacion()?.empleadoNombre || 'Liquidacion de haberes' }}</h2>
          <p>Concilia el historial, calcula el ultimo mes y revisa el asiento antes de aprobar.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/nomina/empleados"><mat-icon>arrow_back</mat-icon>Volver</a>
      </header>

      @if (error()) {
        <section class="error-box" role="alert">
          <mat-icon>error</mat-icon>
          <div><strong>No se pudo completar el calculo</strong><p>{{ error() }}</p></div>
          @if (saldoInicialFaltante()) {
            <a mat-stroked-button [routerLink]="['/workspace/contabilidad/nomina/empleados', empleadoId, 'editar']" [queryParams]="{ saldoInicial: 1 }">Configurar saldos</a>
          }
        </section>
      }

      @if (expediente()?.estado === 'BORRADOR') {
        <section class="draft-banner" role="status">
          <mat-icon>edit_note</mat-icon>
          <div><strong>Liquidacion reservada</strong><p>El empleado esta en estado “En liquidacion” y ya no entra en el rol mensual.</p></div>
          <button mat-button type="button" (click)="cancelarBorrador()" [disabled]="procesando() || !canUpdate()">Cancelar borrador</button>
        </section>
      }

      <section class="surface-card setup-card">
        <div class="section-title"><div><h3>Salida y pago</h3><p>La fecha de salida limita el ultimo sueldo a los dias realmente trabajados.</p></div></div>
        <div class="setup-grid">
          <mat-form-field appearance="outline">
            <mat-label>Fecha de salida</mat-label>
            <input matInput [matDatepicker]="pickerSalida" [(ngModel)]="fechaSalidaDate" name="fechaSalida" [disabled]="!!expediente()" />
            <mat-datepicker-toggle matSuffix [for]="pickerSalida"></mat-datepicker-toggle>
            <mat-datepicker #pickerSalida></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline" class="causal-field">
            <mat-label>Causal de terminacion</mat-label>
            <mat-select [(ngModel)]="causal" name="causal" [disabled]="!!expediente()">
              @for (item of causales; track item.codigo) { <mat-option [value]="item.codigo">{{ item.nombre }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Fecha de pago</mat-label>
            <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" [disabled]="!!expediente()" />
            <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
            <mat-datepicker #pickerPago></mat-datepicker>
          </mat-form-field>
          <button mat-stroked-button type="button" class="calculate-button" (click)="calcular()" [disabled]="procesando() || !!expediente()">
            <mat-icon>calculate</mat-icon>{{ procesando() ? 'Calculando...' : 'Recalcular' }}
          </button>
        </div>
      </section>

      @if (liquidacion(); as datos) {
        <section class="reconciliation-strip" aria-label="Resumen del calculo">
          <div><span>Ingreso</span><strong>{{ datos.fechaIngreso }}</strong></div>
          <div><span>Salida</span><strong>{{ datos.fechaSalida }}</strong></div>
          <div><span>Ultimo mes</span><strong>{{ datos.diasTrabajadosUltimoMes }} dias · {{ datos.sueldoUltimoMes | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
          <div><span>Remuneracion computable</span><strong>{{ datos.ultimaRemuneracion | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
        </section>

        <section class="surface-card ledger-card">
          <div class="section-title">
            <div><h3>Conciliacion de haberes</h3><p>El origen permite rastrear cada valor hasta el corte inicial, WinSuite o el ultimo mes.</p></div>
            @if (expediente()?.estado !== 'APROBADA') { <button mat-stroked-button type="button" (click)="agregarAjuste()" [disabled]="!canUpdate()"><mat-icon>add</mat-icon>Agregar ajuste</button> }
          </div>
          <div class="rubros-table">
            <div class="rubro-row rubro-head"><span>Concepto</span><span>Origen</span><span>Detalle</span><span>Valor final</span><span>Justificacion</span></div>
            @for (rubro of rubros(); track rubro.codigo; let index = $index) {
              <div class="rubro-row">
                <div class="concept">
                  @if (rubro.codigo.startsWith('AJUSTE_') && expediente()?.estado !== 'APROBADA') {
                    <input class="plain-input" [ngModel]="rubro.nombre" (ngModelChange)="actualizarNombre(index, $event)" aria-label="Nombre del ajuste" [disabled]="!canUpdate()" />
                    <mat-select class="plain-select" [ngModel]="rubro.tipo" (ngModelChange)="actualizarTipo(index, $event)" aria-label="Tipo de ajuste" [disabled]="!canUpdate()">
                      <mat-option value="INGRESO">Ingreso</mat-option><mat-option value="DESCUENTO">Descuento</mat-option>
                    </mat-select>
                  } @else {
                    <strong>{{ rubro.nombre }}</strong><small>{{ rubro.tipo === 'INGRESO' ? 'Ingreso' : 'Descuento' }}</small>
                  }
                </div>
                <span class="origin" [attr.data-origin]="rubro.origen">{{ etiquetaOrigen(rubro.origen) }}</span>
                <span class="detail">{{ rubro.detalle }}</span>
                <mat-form-field appearance="outline" class="amount-field">
                  <mat-label>Monto</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput [ngModel]="rubro.monto" (ngModelChange)="actualizarMonto(index, $event)" [disabled]="expediente()?.estado === 'APROBADA' || !canUpdate()" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="reason-field">
                  <mat-label>Justificacion del ajuste</mat-label>
                  <input matInput [ngModel]="rubro.justificacionAjuste || ''" (ngModelChange)="actualizarJustificacion(index, $event)" [disabled]="expediente()?.estado === 'APROBADA' || !canUpdate()" [required]="rubro.monto !== rubro.valorCalculado" />
                  @if (rubro.monto !== rubro.valorCalculado) { <mat-hint>Calculado: {{ rubro.valorCalculado | number:'1.2-2' }}</mat-hint> }
                </mat-form-field>
              </div>
            }
          </div>
        </section>

        <section class="surface-card totals-card">
          <div class="totals-breakdown">
            <div><span>Ingresos</span><strong>{{ totalIngresos() | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
            <div><span>Descuentos</span><strong>{{ totalDescuentos() | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
            <div><span>Aporte patronal + CCC</span><strong>{{ datos.aportePatronalIess + datos.contribucionCcc | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
          </div>
          <div class="net-total"><span>Neto a pagar</span><strong>{{ netoPagar() | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
          <footer class="actions-row">
            @if (expediente()?.estado === 'BORRADOR') {
              <a mat-button [routerLink]="['/workspace/contabilidad/nomina/roles', expediente()!.rolId]">Ver rol borrador</a>
            }
            <button mat-raised-button color="primary" type="button" (click)="revisarYaprobar()" [disabled]="procesando() || !canUpdate() || netoPagar() <= 0">
              <mat-icon>fact_check</mat-icon>Revisar asiento y aprobar
            </button>
          </footer>
        </section>
      }
    </section>
  `,
  styles: [`
    .liquidacion-page { display: grid; gap: 1rem; }
    .page-header, .setup-card, .ledger-card, .totals-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .kicker { margin: 0 0 .35rem; color: var(--primary); font-size: .78rem; font-weight: 750; }
    h2, h3, p { margin: 0; }
    .page-header p, .section-title p { margin-top: .35rem; color: var(--muted-foreground); max-width: 72ch; }
    .setup-card, .ledger-card, .totals-card { display: grid; gap: 1rem; }
    .section-title { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .setup-grid { display: grid; grid-template-columns: 1fr minmax(260px, 1.6fr) 1fr auto; gap: .75rem; align-items: start; }
    .calculate-button { min-height: 56px; }
    .error-box, .draft-banner { display: flex; align-items: center; gap: .8rem; padding: .9rem 1rem; border-radius: 1rem; }
    .error-box { background: color-mix(in srgb, #b3261e 12%, var(--tc-surface-container-lowest)); color: #8c1d18; }
    .error-box div, .draft-banner div { flex: 1; }
    .error-box p, .draft-banner p { margin-top: .15rem; }
    .draft-banner { background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest)); }
    .draft-banner mat-icon { color: var(--primary); }
    .reconciliation-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; padding: 1rem 1.25rem; border-radius: 1rem; background: var(--tc-surface-container-low); }
    .reconciliation-strip div, .totals-breakdown div { display: grid; gap: .25rem; }
    .reconciliation-strip span, .totals-breakdown span, .net-total span { color: var(--muted-foreground); font-size: .78rem; }
    .rubros-table { display: grid; gap: .65rem; overflow: auto; }
    .rubro-row { display: grid; grid-template-columns: minmax(180px, 1.2fr) 130px minmax(180px, 1fr) 140px minmax(220px, 1.3fr); gap: .7rem; align-items: start; min-width: 920px; padding: .7rem; border-radius: .85rem; background: var(--tc-surface-container-low); }
    .rubro-head { padding-block: .45rem; background: transparent; color: var(--muted-foreground); font-size: .75rem; font-weight: 700; }
    .concept { display: grid; gap: .2rem; }
    .plain-input { min-height: 36px; border: 0; border-radius: .55rem; padding: .45rem .6rem; background: var(--tc-surface-container-lowest); color: var(--foreground); font: inherit; font-weight: 650; }
    .plain-select { min-height: 32px; color: var(--muted-foreground); font-size: .8rem; }
    .concept small, .detail { color: var(--muted-foreground); }
    .origin { justify-self: start; padding: .3rem .6rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 13%, transparent); font-size: .75rem; font-weight: 700; }
    .origin[data-origin='SALDO_INICIAL'] { background: color-mix(in srgb, #f59e0b 18%, transparent); }
    .origin[data-origin='INDEMNIZACION'] { background: color-mix(in srgb, #7c3aed 15%, transparent); }
    .amount-field, .reason-field { width: 100%; }
    .totals-card { grid-template-columns: 1fr auto; align-items: end; }
    .totals-breakdown { display: flex; gap: 2rem; flex-wrap: wrap; }
    .net-total { display: grid; gap: .15rem; min-width: 220px; padding: 1rem 1.2rem; border-radius: 1rem; background: color-mix(in srgb, var(--primary) 13%, var(--tc-surface-container-lowest)); text-align: right; }
    .net-total strong { color: var(--primary); font-size: 1.65rem; }
    .actions-row { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; }
    @media (max-width: 1000px) {
      .setup-grid, .reconciliation-strip, .totals-card { grid-template-columns: 1fr 1fr; }
      .calculate-button { width: 100%; }
      .net-total { text-align: left; }
    }
    @media (max-width: 680px) {
      .setup-grid, .reconciliation-strip, .totals-card { grid-template-columns: 1fr; }
      .totals-breakdown { display: grid; gap: .75rem; }
      .actions-row { justify-content: stretch; }
      .actions-row a, .actions-row button { width: 100%; min-height: 44px; }
    }
  `]
})
export class NominaLiquidacionComponent implements OnInit {
  private readonly nominaService = inject(NominaService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly revisionAsiento = inject(RevisionAsientoService);
  private readonly authorization = inject(AuthorizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly causales = CAUSALES_TERMINACION_NOMINA;
  protected readonly liquidacion = signal<LiquidacionEmpleado | null>(null);
  protected readonly expediente = signal<LiquidacionNomina | null>(null);
  protected readonly rubros = signal<RubroLiquidacion[]>([]);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saldoInicialFaltante = signal(false);
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly totalIngresos = computed(() => this.round2(this.rubros().filter((r) => r.tipo === 'INGRESO').reduce((t, r) => t + Number(r.monto || 0), 0)));
  protected readonly totalDescuentos = computed(() => this.round2(this.rubros().filter((r) => r.tipo === 'DESCUENTO').reduce((t, r) => t + Number(r.monto || 0), 0)));
  protected readonly netoPagar = computed(() => this.round2(this.totalIngresos() - this.totalDescuentos()));

  protected fechaSalidaDate: Date | null = new Date();
  protected fechaPagoDate: Date | null = new Date();
  protected causal: CausalTerminacionNomina = 'DESAHUCIO_TRABAJADOR';
  protected empleadoId = '';

  async ngOnInit(): Promise<void> {
    this.empleadoId = this.route.snapshot.paramMap.get('id') ?? '';
    const borrador = await this.nominaService.getLiquidacionBorradorEmpleado(this.empleadoId);
    if (borrador) {
      this.expediente.set(borrador);
      this.liquidacion.set(borrador);
      this.rubros.set(borrador.rubros.map((rubro) => ({ ...rubro })));
      this.fechaSalidaDate = isoADate(borrador.fechaSalida);
      this.fechaPagoDate = isoADate(borrador.fechaPago);
      this.causal = borrador.causalTerminacion;
      return;
    }
    await this.calcular();
  }

  protected async calcular(): Promise<void> {
    this.error.set(null);
    this.saldoInicialFaltante.set(false);
    this.procesando.set(true);
    try {
      const calculo = await this.nominaService.calcularLiquidacion(this.empleadoId, dateAIso(this.fechaSalidaDate), this.causal);
      this.liquidacion.set(calculo);
      this.rubros.set(calculo.rubros.map((rubro) => ({ ...rubro })));
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo calcular la liquidacion.';
      this.error.set(mensaje);
      this.saldoInicialFaltante.set(mensaje.toLowerCase().includes('saldos laborales iniciales'));
      this.liquidacion.set(null);
    } finally {
      this.procesando.set(false);
    }
  }

  protected actualizarMonto(index: number, value: string | number): void {
    this.rubros.update((rubros) => rubros.map((rubro, i) => i === index ? { ...rubro, monto: this.round2(Number(value) || 0) } : rubro));
  }

  protected actualizarJustificacion(index: number, value: string): void {
    this.rubros.update((rubros) => rubros.map((rubro, i) => i === index ? { ...rubro, justificacionAjuste: value } : rubro));
  }

  protected actualizarNombre(index: number, value: string): void {
    this.rubros.update((rubros) => rubros.map((rubro, i) => i === index ? { ...rubro, nombre: value } : rubro));
  }

  protected actualizarTipo(index: number, value: RubroLiquidacion['tipo']): void {
    this.rubros.update((rubros) => rubros.map((rubro, i) => i === index
      ? { ...rubro, tipo: value, origen: value === 'DESCUENTO' ? 'DESCUENTO' : 'AJUSTE' }
      : rubro));
  }

  protected agregarAjuste(): void {
    const indice = this.rubros().filter((rubro) => rubro.codigo.startsWith('AJUSTE_')).length + 1;
    this.rubros.update((rubros) => [...rubros, {
      codigo: `AJUSTE_${indice}`,
      nombre: `Ajuste adicional ${indice}`,
      tipo: 'INGRESO',
      monto: 0,
      valorCalculado: 0,
      origen: 'AJUSTE',
      cuentaContableId: '',
      detalle: 'Concepto especial o contractual',
      ajustado: true,
      justificacionAjuste: ''
    }]);
  }

  protected async revisarYaprobar(): Promise<void> {
    if (!this.canUpdate()) return;
    this.error.set(null);
    this.procesando.set(true);
    try {
      let rolId = this.expediente()?.rolId;
      if (!rolId) {
        rolId = await this.nominaService.guardarBorradorLiquidacion(
          this.empleadoId,
          dateAIso(this.fechaSalidaDate),
          this.causal,
          dateAIso(this.fechaPagoDate),
          this.rubros()
        );
        const expediente = await this.nominaService.getLiquidacionByRolId(rolId);
        this.expediente.set(expediente);
      } else {
        await this.nominaService.actualizarBorradorLiquidacion(rolId, dateAIso(this.fechaPagoDate), this.rubros());
        const actualizado = await this.nominaService.getLiquidacionByRolId(rolId);
        if (actualizado) {
          this.expediente.set(actualizado);
          this.liquidacion.set(actualizado);
          this.rubros.set(actualizado.rubros.map((rubro) => ({ ...rubro })));
        }
      }
      if (!(await this.integracionContable.contabilidadActiva())) {
        this.procesando.set(false);
        const confirmado = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
          width: '460px',
          data: { title: 'Aprobar liquidacion', message: 'La contabilidad automatica esta desactivada. La liquidacion se aprobara sin asiento y el empleado quedara inactivo.', confirmText: 'Aprobar' }
        }).afterClosed());
        if (!confirmado) return;
        this.procesando.set(true);
        await this.nominaService.aprobarRolPago(rolId);
      } else {
        const propuesta = await this.nominaService.construirLineasRolPago(rolId);
        this.procesando.set(false);
        const lineas = await this.revisionAsiento.revisar({
          titulo: 'Revisar asiento de liquidacion',
          subtitulo: `${this.liquidacion()?.empleadoNombre} · salida ${dateAIso(this.fechaSalidaDate)} · neto ${this.netoPagar().toFixed(2)}`,
          lineas: propuesta
        });
        if (!lineas) return;
        this.procesando.set(true);
        await this.nominaService.aprobarRolPago(rolId, lineas);
      }
      this.toast('Liquidacion aprobada y empleado inactivado.', 'task_alt');
      await this.router.navigate(['/workspace/contabilidad/nomina/roles', rolId]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo aprobar la liquidacion.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected async cancelarBorrador(): Promise<void> {
    const rolId = this.expediente()?.rolId;
    if (!rolId || !this.canUpdate()) return;
    const confirmado = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: { title: 'Cancelar liquidacion', message: 'El empleado volvera a estado activo y se restaurara en el rol mensual si este sigue en borrador.', confirmText: 'Cancelar liquidacion' }
    }).afterClosed());
    if (!confirmado) return;
    this.procesando.set(true);
    try {
      await this.nominaService.cancelarLiquidacionBorrador(rolId);
      this.toast('Liquidacion cancelada.', 'undo');
      await this.router.navigate(['/workspace/contabilidad/nomina/empleados']);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cancelar la liquidacion.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected etiquetaOrigen(origen: RubroLiquidacion['origen']): string {
    return ({ SALDO_INICIAL: 'Saldo inicial', WINSUITE: 'WinSuite', ULTIMO_MES: 'Ultimo mes', INDEMNIZACION: 'Indemnizacion', AJUSTE: 'Ajuste', DESCUENTO: 'Descuento' })[origen];
  }

  private round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, { data: { message, icon }, duration: 2800, horizontalPosition: 'end', verticalPosition: 'top' });
  }
}

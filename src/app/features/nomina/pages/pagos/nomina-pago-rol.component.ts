import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { dateAIso, isoADate } from '../../../../shared/utils/fecha-input.util';
import { CuentaBancaria } from '../../../contabilidad/models/bancos.models';
import { AsientoContableLinea, CuentaContable } from '../../../contabilidad/models/contabilidad.models';
import { RolPago, RolPagoDetalle } from '../../../contabilidad/models/nomina.models';
import { FormaPagoNomina, PagoNominaDetalle, SaldoPagoEmpleado } from '../../../contabilidad/models/pagos-nomina.models';
import { BancosCuentasService } from '../../../contabilidad/services/bancos-cuentas.service';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { PagosNominaService } from '../../../contabilidad/services/pagos-nomina.service';
import { PlanCuentasService } from '../../../contabilidad/services/plan-cuentas.service';
import { RevisionAsientoService } from '../../../contabilidad/services/revision-asiento.service';

type PasoPago = 'empleados' | 'banco' | 'resumen';

/** Fila editable de la tabla de empleados del rol. */
interface FilaPago {
  empleadoId: string;
  nombre: string;
  cargo: string;
  departamento: string;
  neto: number;
  pagadoAntes: number;
  saldo: number;
  monto: number;
  /** Comprobante individual: numero de transferencia o cheque con que cobro este empleado. */
  referenciaPago: string;
}

/**
 * Registro del pago de un rol aprobado. Aprobar el rol devengó el pasivo; aquí sale el dinero y se
 * cancela contra el banco. Es una página y no un diálogo para que el popup de revisión del asiento
 * siga siendo el único modal de la pantalla.
 *
 * Pagar a una persona y pagar a toda la planilla es el mismo camino: un pago individual es un
 * documento con un solo detalle.
 */
@Component({
  selector: 'app-nomina-pago-rol',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="pago-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Nomina · Pago del rol</p>
          <h2>{{ rol()?.numero || rol()?.periodo || 'Rol de pago' }}</h2>
          <p>
            {{ etiquetaTipo() }} · Periodo {{ rol()?.periodo }} ·
            Neto del rol {{ rol()?.totalNetoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}
          </p>
        </div>
        <a mat-stroked-button [routerLink]="rutaRol()">
          <mat-icon>arrow_back</mat-icon>
          Volver al rol
        </a>
      </header>

      <nav class="steps surface-card" aria-label="Pasos del pago">
        <span class="step" [class.active]="paso() === 'empleados'">1 · Empleados</span>
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'banco'">2 · Banco que paga</span>
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'resumen'">3 · Resumen y asiento</span>
      </nav>

      @if (error()) {
        <section class="error-box" role="alert">{{ error() }}</section>
      }

      @if (cargando()) {
        <section class="surface-card empty-state">
          <mat-icon>hourglass_top</mat-icon>
          <h3>Cargando el rol</h3>
        </section>
      } @else if (!puedePagar()) {
        <section class="surface-card empty-state">
          <mat-icon>lock</mat-icon>
          <h3>Este rol no admite pagos</h3>
          <p>{{ motivoNoPagable() }}</p>
          <a mat-raised-button color="primary" [routerLink]="rutaRol()">Volver al rol</a>
        </section>
      } @else {
        @switch (paso()) {
          @case ('empleados') {
            <section class="surface-card card">
              <header class="table-head">
                <div>
                  <h3>A quien se le paga</h3>
                  <p class="hint">
                    Cada empleado trae precargado su saldo pendiente. Puedes bajar el monto para
                    registrar un abono parcial y completarlo en otro pago.
                  </p>
                </div>
                <div class="filtros">
                  <mat-form-field appearance="outline">
                    <mat-label>Buscar empleado</mat-label>
                    <input matInput [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" name="busqueda" />
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>

                  @if (departamentos().length > 0) {
                    <mat-form-field appearance="outline">
                      <mat-label>Departamento</mat-label>
                      <mat-select [ngModel]="departamento()" (ngModelChange)="departamento.set($event)" name="departamento">
                        <mat-option value="">Todos</mat-option>
                        @for (item of departamentos(); track item) {
                          <mat-option [value]="item">{{ item }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                </div>
              </header>

              <div class="masivo">
                <span class="masivo-label">Aplicar a seleccionados</span>
                <button mat-stroked-button type="button" (click)="pagarSaldoCompleto()" [disabled]="seleccion().size === 0">
                  Pagar el saldo completo
                </button>
                <mat-form-field appearance="outline">
                  <mat-label>Monto fijo</mat-label>
                  <input matInput type="text" inputmode="decimal" appTwoDecimalInput [ngModel]="montoMasivo()" (ngModelChange)="montoMasivo.set($event)" name="montoMasivo" />
                </mat-form-field>
                <button mat-stroked-button type="button" (click)="aplicarMonto()" [disabled]="seleccion().size === 0">
                  Aplicar monto
                </button>
                <mat-form-field appearance="outline" class="ref-masiva">
                  <mat-label>Referencia de pago</mat-label>
                  <input matInput [ngModel]="referenciaMasiva()" (ngModelChange)="referenciaMasiva.set($event)" name="referenciaMasiva" maxlength="60" />
                </mat-form-field>
                <button mat-stroked-button type="button" (click)="aplicarReferencia()" [disabled]="seleccion().size === 0">
                  Aplicar referencia
                </button>
                <button mat-button type="button" (click)="limpiar()" [disabled]="seleccion().size === 0">Limpiar</button>
              </div>

              @if (yaPagados() > 0) {
                <p class="nota">
                  <mat-icon>history</mat-icon>
                  {{ yaPagados() }} empleado(s) ya cobraron todo su neto en pagos anteriores y aparecen deshabilitados.
                </p>
              }

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th class="check">
                        <mat-checkbox
                          [checked]="todosSeleccionados()"
                          [indeterminate]="algunoSeleccionado() && !todosSeleccionados()"
                          (change)="alternarTodos($event.checked)"
                          aria-label="Seleccionar todos los empleados con saldo"
                        ></mat-checkbox>
                      </th>
                      <th>Empleado</th>
                      <th>Cargo</th>
                      <th class="num">Neto del rol</th>
                      <th class="num">Ya pagado</th>
                      <th class="num">Saldo</th>
                      <th class="num monto-col">Monto a pagar</th>
                      <th class="ref-col">Referencia de pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of filasVisibles(); track fila.empleadoId) {
                      <tr [class.seleccionada]="seleccion().has(fila.empleadoId)" [class.saldada]="fila.saldo <= 0">
                        <td class="check">
                          <mat-checkbox
                            [checked]="seleccion().has(fila.empleadoId)"
                            [disabled]="fila.saldo <= 0"
                            (change)="alternar(fila, $event.checked)"
                            [attr.aria-label]="'Seleccionar ' + fila.nombre"
                          ></mat-checkbox>
                        </td>
                        <td><strong>{{ fila.nombre }}</strong></td>
                        <td>{{ fila.cargo || '—' }}</td>
                        <td class="num">{{ fila.neto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                        <td class="num">{{ fila.pagadoAntes | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                        <td class="num"><strong>{{ fila.saldo | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></td>
                        <td class="num monto-col">
                          @if (fila.saldo > 0) {
                            <mat-form-field appearance="outline" class="monto-field">
                              <input
                                matInput
                                type="text"
                                inputmode="decimal"
                                appTwoDecimalInput
                                [ngModel]="fila.monto"
                                (ngModelChange)="cambiarMonto(fila, $event)"
                                [name]="'monto-' + fila.empleadoId"
                                [attr.aria-label]="'Monto a pagar a ' + fila.nombre"
                              />
                            </mat-form-field>
                          } @else {
                            <span class="saldada-tag">Pagado</span>
                          }
                        </td>
                        <td class="ref-col">
                          @if (fila.saldo > 0) {
                            <mat-form-field appearance="outline" class="ref-field">
                              <input
                                matInput
                                [ngModel]="fila.referenciaPago"
                                (ngModelChange)="cambiarReferencia(fila, $event)"
                                [name]="'ref-' + fila.empleadoId"
                                maxlength="60"
                                placeholder="Nro. transferencia o cheque"
                                [attr.aria-label]="'Referencia de pago de ' + fila.nombre"
                              />
                            </mat-form-field>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (filasSobreSaldo().length > 0) {
                <p class="aviso-box">
                  <mat-icon>warning</mat-icon>
                  <span>
                    {{ filasSobreSaldo().length }} empleado(s) tienen un monto mayor a su saldo pendiente.
                    Ajustalos para continuar: {{ nombresSobreSaldo() }}.
                  </span>
                </p>
              }
            </section>
          }

          @case ('banco') {
            <section class="surface-card card">
              <h3>Banco que realizo el pago</h3>
              <p class="hint">La cuenta contable de este banco es la que se acredita en el asiento.</p>

              @if (cuentasBancarias().length === 0) {
                <div class="aviso-box">
                  <mat-icon>account_balance</mat-icon>
                  <span>
                    No hay cuentas bancarias activas registradas.
                    <a routerLink="/workspace/contabilidad/bancos">Crea una en Bancos</a> para poder registrar el pago.
                  </span>
                </div>
              }

              <div class="grid-datos">
                <mat-form-field appearance="outline" class="banco-field">
                  <mat-label>Cuenta bancaria</mat-label>
                  <mat-select [ngModel]="cuentaBancariaId()" (ngModelChange)="cuentaBancariaId.set($event)" name="cuentaBancaria">
                    @for (cuenta of cuentasBancarias(); track cuenta.id) {
                      <mat-option [value]="cuenta.id">
                        {{ cuenta.bancoNombre || cuenta.nombre }} · {{ cuenta.tipoCuenta }} · {{ cuenta.numeroCuenta }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha del pago</mat-label>
                  <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" />
                  <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
                  <mat-datepicker #pickerPago></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Forma de pago</mat-label>
                  <mat-select [ngModel]="formaPago()" (ngModelChange)="formaPago.set($event)" name="formaPago">
                    <mat-option value="TRANSFERENCIA">Transferencia</mat-option>
                    <mat-option value="CHEQUE">Cheque</mat-option>
                    <mat-option value="EFECTIVO">Efectivo</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Referencia del documento</mat-label>
                  <input matInput [ngModel]="referencia()" (ngModelChange)="referencia.set($event)" name="referencia" maxlength="60" />
                  <mat-hint>Numero de lote. La usan los empleados sin referencia propia</mat-hint>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="concepto-field">
                <mat-label>Concepto</mat-label>
                <input matInput [ngModel]="concepto()" (ngModelChange)="concepto.set($event)" name="concepto" maxlength="120" />
                <mat-hint>Se copia a cada linea del asiento junto al nombre del empleado</mat-hint>
              </mat-form-field>

              @if (cuentaSeleccionada(); as cuenta) {
                @if (cuentaContableBanco(); as contable) {
                  <p class="cuenta-chip">
                    <mat-icon>account_balance</mat-icon>
                    <span>Se acreditara <strong>{{ contable.codigo }} · {{ contable.nombre }}</strong></span>
                  </p>
                } @else {
                  <div class="aviso-box">
                    <mat-icon>warning</mat-icon>
                    <span>
                      La cuenta <strong>{{ cuenta.nombre }}</strong> no tiene una cuenta contable activa asociada.
                      <a routerLink="/workspace/contabilidad/bancos">Asignala en Bancos</a> antes de registrar el pago.
                    </span>
                  </div>
                }
              }
            </section>
          }

          @case ('resumen') {
            <section class="surface-card card">
              <h3>Resumen del pago</h3>
              <div class="resumen-grid">
                <article><span>Empleados</span><strong>{{ seleccionados().length }}</strong></article>
                <article><span>Banco</span><strong>{{ nombreBanco() }}</strong></article>
                <article><span>Fecha</span><strong>{{ fechaIso() }}</strong></article>
                <article class="highlight"><span>Total a pagar</span><strong>{{ total() | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></article>
              </div>

              <table class="destino">
                <thead>
                  <tr><th>Cuenta que se mueve</th><th class="num">Debe</th><th class="num">Haber</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ etiquetaPasivo() }}</td>
                    <td class="num">{{ totalSueldos() | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td class="num">—</td>
                  </tr>
                  @if (totalBeneficios() > 0) {
                    <tr>
                      <td>Beneficios sociales por pagar</td>
                      <td class="num">{{ totalBeneficios() | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                      <td class="num">—</td>
                    </tr>
                  }
                  <tr>
                    <td>{{ nombreBanco() }}</td>
                    <td class="num">—</td>
                    <td class="num">{{ total() | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>

              <p class="hint">
                El asiento registra una fila por empleado en cada cuenta, con su nombre y su referencia
                de pago, para que el mayor del banco permita rastrear cada transferencia sin abrir el
                auxiliar de nomina.
              </p>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Referencia</th>
                      <th class="num">Sueldos</th>
                      <th class="num">Beneficios</th>
                      <th class="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (detalle of detallesPago(); track detalle.empleadoId) {
                      <tr>
                        <td>{{ detalle.empleadoNombre }}</td>
                        <td>{{ detalle.referenciaPago || '—' }}</td>
                        <td class="num">{{ detalle.montoSueldos | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                        <td class="num">{{ detalle.montoBeneficios | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                        <td class="num"><strong>{{ detalle.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        }

        <footer class="surface-card resumen-bar">
          <div class="resumen-datos">
            <span><strong>{{ seleccionados().length }}</strong> empleado(s)</span>
            <span class="total">Total {{ total() | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="resumen-acciones">
            @if (paso() !== 'empleados') {
              <button mat-button type="button" (click)="atras()" [disabled]="procesando()">Atras</button>
            }
            @if (paso() !== 'resumen') {
              <button
                mat-raised-button
                color="primary"
                type="button"
                (click)="siguiente()"
                [disabled]="!puedeAvanzar() || procesando()"
                [matTooltip]="tooltipAvanzar()"
              >
                <mat-icon>arrow_forward</mat-icon>
                Continuar
              </button>
            } @else {
              <button
                mat-raised-button
                color="primary"
                type="button"
                (click)="registrar()"
                [disabled]="!puedeRegistrar() || procesando()"
              >
                <mat-icon>receipt_long</mat-icon>
                Revisar asiento y registrar
              </button>
            }
          </div>
        </footer>
      }
    </section>
  `,
  styles: [`
    .pago-page { display: grid; gap: 1rem; padding-bottom: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .header-copy > p:not(.eyebrow) { margin: .4rem 0 0; color: var(--muted-foreground); }
    .steps { display: flex; align-items: center; gap: .5rem; padding: .8rem 1.25rem; color: var(--muted-foreground); flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .step.active { color: var(--primary); font-weight: 700; }
    .card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .card h3 { margin: 0; font-size: 1rem; }
    .hint { margin: 0; color: var(--muted-foreground); max-width: 72ch; }
    .table-head { display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; }
    .table-head h3 { margin: 0 0 .3rem; }
    .filtros { display: flex; gap: .75rem; flex-wrap: wrap; }
    .masivo { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; padding: .75rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 7%, transparent); }
    .masivo-label { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .masivo mat-form-field { width: 150px; }
    .masivo .ref-masiva { width: 210px; }
    .grid-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; align-items: start; }
    .banco-field { grid-column: 1 / -1; max-width: 520px; }
    .concepto-field { width: 100%; max-width: 640px; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 940px; }
    table.destino { min-width: 0; }
    th, td { text-align: left; padding: .45rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .check { width: 48px; }
    .monto-col { width: 170px; }
    .monto-field { width: 140px; }
    .monto-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .monto-field ::ng-deep input { text-align: right; }
    .ref-col { width: 210px; }
    .ref-field { width: 200px; }
    .ref-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    tr.seleccionada { background: color-mix(in srgb, var(--primary) 6%, transparent); }
    tr.saldada { color: var(--muted-foreground); }
    .saldada-tag { font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
    .nota { display: flex; gap: .5rem; align-items: center; margin: 0; font-size: .85rem; color: var(--muted-foreground); }
    .nota mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .cuenta-chip { display: flex; gap: .5rem; align-items: center; margin: 0; padding: .6rem .9rem; border-radius: .6rem; background: color-mix(in srgb, var(--primary) 9%, transparent); }
    .resumen-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
    .resumen-grid article { display: grid; gap: .2rem; padding: .75rem .9rem; border-radius: .7rem; background: color-mix(in srgb, var(--muted-foreground) 8%, transparent); }
    .resumen-grid span { font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted-foreground); }
    .resumen-grid strong { font-size: 1.05rem; }
    .resumen-grid .highlight { background: color-mix(in srgb, var(--primary) 14%, transparent); }
    .resumen-bar { position: sticky; bottom: 0; z-index: 2; padding: .85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); box-shadow: 0 -6px 20px color-mix(in srgb, var(--foreground) 8%, transparent); }
    .resumen-datos { display: flex; gap: 1.25rem; align-items: baseline; flex-wrap: wrap; }
    .resumen-datos .total { font-size: 1.2rem; font-weight: 700; }
    .resumen-acciones { display: flex; gap: .6rem; align-items: center; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; background: var(--tc-surface-container-lowest); }
    .empty-state mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: color-mix(in srgb, var(--primary) 55%, transparent); }
    .empty-state h3, .empty-state p { margin: 0; }
    .empty-state p { color: var(--muted-foreground); }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    .aviso-box { display: flex; gap: .6rem; align-items: center; margin: 0; padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #f59e0b 14%, transparent); }
    @media (max-width: 900px) {
      .filtros mat-form-field { width: 100%; }
    }
  `]
})
export class NominaPagoRolComponent implements OnInit {
  private readonly pagosService = inject(PagosNominaService);
  private readonly bancosCuentas = inject(BancosCuentasService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly revisionAsiento = inject(RevisionAsientoService);
  private readonly authorization = inject(AuthorizationService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private rolId = '';
  private detallesRol: RolPagoDetalle[] = [];
  private saldos = new Map<string, SaldoPagoEmpleado>();

  protected readonly paso = signal<PasoPago>('empleados');
  protected readonly rol = signal<RolPago | null>(null);
  protected readonly filas = signal<FilaPago[]>([]);
  protected readonly cuentasBancarias = signal<CuentaBancaria[]>([]);
  protected readonly cuentasContables = signal<CuentaContable[]>([]);
  protected readonly seleccion = signal<Set<string>>(new Set());
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly busqueda = signal('');
  protected readonly departamento = signal('');
  protected readonly montoMasivo = signal<number | string | null>(null);
  /** Referencia que se estampa de golpe a los seleccionados, para el caso del lote unico. */
  protected readonly referenciaMasiva = signal('');
  protected readonly cuentaBancariaId = signal('');
  protected readonly formaPago = signal<FormaPagoNomina>('TRANSFERENCIA');
  protected readonly referencia = signal('');
  protected readonly concepto = signal('');

  /**
   * Referencia Date estable para el datepicker: un getter que derive un Date nuevo por ciclo haria
   * que matDatepicker lo lea como valor distinto en cada deteccion de cambios.
   */
  protected fechaPagoDate: Date | null = new Date();

  protected readonly rutaRol = computed(() => ['/workspace/contabilidad/nomina/roles', this.rolId]);

  protected readonly etiquetasTipo: Record<string, string> = {
    MENSUAL: 'Rol de pago',
    DECIMO_TERCERO: 'Decimo tercero',
    DECIMO_CUARTO: 'Decimo cuarto',
    UTILIDADES: 'Utilidades',
    LIQUIDACION: 'Liquidacion'
  };

  protected readonly etiquetaTipo = computed(() => this.etiquetasTipo[this.rol()?.tipo ?? 'MENSUAL'] ?? 'Rol de pago');

  /** Cuenta del pasivo que se descarga, en lenguaje del contador. */
  protected readonly etiquetaPasivo = computed(() => {
    switch (this.rol()?.tipo) {
      case 'UTILIDADES': return 'Utilidades por pagar';
      case 'LIQUIDACION': return 'Liquidaciones por pagar';
      default: return 'Sueldos por pagar';
    }
  });

  protected readonly puedePagar = computed(() => {
    const rol = this.rol();
    return !!rol && rol.estado === 'APROBADO' && this.hayPendiente() && this.authorization.canAccess('contabilidad', 'update');
  });

  protected readonly motivoNoPagable = computed(() => {
    const rol = this.rol();
    if (!rol) {
      return 'El rol de pago ya no existe.';
    }
    if (!this.authorization.canAccess('contabilidad', 'update')) {
      return 'No tienes permiso para registrar pagos de nomina.';
    }
    if (rol.estado !== 'APROBADO') {
      return `El rol esta en estado ${rol.estado}: aprueba el rol para que devengue el pasivo antes de pagarlo.`;
    }
    return 'Todos los empleados de este rol ya cobraron su neto.';
  });

  protected readonly departamentos = computed(() => Array.from(
    new Set(this.filas().map((fila) => fila.departamento).filter((valor) => !!valor))
  ).sort());

  protected readonly filasVisibles = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const departamento = this.departamento();
    return this.filas().filter((fila) =>
      (!departamento || fila.departamento === departamento)
      && (!termino || fila.nombre.toLowerCase().includes(termino))
    );
  });

  protected readonly yaPagados = computed(() => this.filas().filter((fila) => fila.saldo <= 0).length);

  protected readonly seleccionados = computed(() => this.filas().filter((fila) =>
    this.seleccion().has(fila.empleadoId) && this.redondear(fila.monto) > 0
  ));

  protected readonly filasSobreSaldo = computed(() => this.seleccionados().filter((fila) =>
    this.redondear(fila.monto) > fila.saldo
  ));

  protected readonly nombresSobreSaldo = computed(() => {
    const nombres = this.filasSobreSaldo().map((fila) => fila.nombre);
    return nombres.length <= 3 ? nombres.join(', ') : `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} mas`;
  });

  protected readonly total = computed(() => this.redondear(
    this.seleccionados().reduce((suma, fila) => suma + fila.monto, 0)
  ));

  protected readonly todosSeleccionados = computed(() => {
    const pagables = this.filasVisibles().filter((fila) => fila.saldo > 0);
    return pagables.length > 0 && pagables.every((fila) => this.seleccion().has(fila.empleadoId));
  });

  protected readonly algunoSeleccionado = computed(() =>
    this.filasVisibles().some((fila) => this.seleccion().has(fila.empleadoId))
  );

  protected readonly cuentaSeleccionada = computed(() =>
    this.cuentasBancarias().find((cuenta) => cuenta.id === this.cuentaBancariaId()) ?? null
  );

  /** Cuenta contable del banco elegido: el HABER del asiento. */
  protected readonly cuentaContableBanco = computed(() => {
    const cuentaBancaria = this.cuentaSeleccionada();
    if (!cuentaBancaria?.cuentaContableId) {
      return null;
    }
    return this.cuentasContables().find((cuenta) => cuenta.id === cuentaBancaria.cuentaContableId) ?? null;
  });

  protected readonly nombreBanco = computed(() => {
    const cuenta = this.cuentaSeleccionada();
    return cuenta ? `${cuenta.bancoNombre || cuenta.nombre} · ${cuenta.numeroCuenta}` : '—';
  });

  /** Detalles con el reparto sueldos/beneficios ya aplicado: lo que veran el resumen y el asiento. */
  protected readonly detallesPago = computed<PagoNominaDetalle[]>(() => this.pagosService.construirDetallesPago(
    this.rol()?.tipo ?? 'MENSUAL',
    this.seleccionados().map((fila) => ({
      empleadoId: fila.empleadoId,
      monto: fila.monto,
      // Sin referencia individual se hereda la del documento: en una transferencia por lote el
      // banco entrega un solo comprobante para todos.
      referenciaPago: fila.referenciaPago?.trim() || this.referencia().trim()
    })),
    this.detallesRol,
    this.saldos
  ));

  protected readonly totalSueldos = computed(() => this.redondear(
    this.detallesPago().reduce((suma, detalle) => suma + detalle.montoSueldos, 0)
  ));

  protected readonly totalBeneficios = computed(() => this.redondear(
    this.detallesPago().reduce((suma, detalle) => suma + detalle.montoBeneficios, 0)
  ));

  protected readonly puedeAvanzar = computed(() => {
    if (this.paso() === 'empleados') {
      return this.seleccionados().length > 0 && this.filasSobreSaldo().length === 0;
    }
    return !!this.cuentaContableBanco() && !!this.fechaPagoDate && !!this.concepto().trim();
  });

  protected readonly puedeRegistrar = computed(() =>
    this.seleccionados().length > 0 && this.filasSobreSaldo().length === 0 && !!this.cuentaContableBanco()
  );

  protected readonly tooltipAvanzar = computed(() => {
    if (this.paso() === 'empleados') {
      if (this.filasSobreSaldo().length > 0) {
        return 'Hay montos mayores al saldo pendiente';
      }
      return this.seleccionados().length === 0 ? 'Selecciona al menos un empleado con monto mayor a cero' : '';
    }
    if (!this.cuentaSeleccionada()) {
      return 'Selecciona la cuenta bancaria desde la que salio el dinero';
    }
    if (!this.cuentaContableBanco()) {
      return 'La cuenta bancaria no tiene cuenta contable activa asociada';
    }
    return this.concepto().trim() ? '' : 'Escribe el concepto del pago';
  });

  async ngOnInit(): Promise<void> {
    this.rolId = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      await this.authService.waitForInitialBootstrap();
      await this.cargar();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el rol de pago.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected siguiente(): void {
    if (!this.puedeAvanzar()) {
      return;
    }
    this.paso.set(this.paso() === 'empleados' ? 'banco' : 'resumen');
  }

  protected atras(): void {
    this.paso.set(this.paso() === 'resumen' ? 'banco' : 'empleados');
  }

  protected alternar(fila: FilaPago, seleccionado: boolean): void {
    if (fila.saldo <= 0) {
      return;
    }
    const siguiente = new Set(this.seleccion());
    if (seleccionado) {
      siguiente.add(fila.empleadoId);
      // Marcar a alguien significa pagarle lo que se le debe; el monto se puede bajar despues.
      if (this.redondear(fila.monto) <= 0) {
        this.asignarMonto(fila, fila.saldo);
      }
    } else {
      siguiente.delete(fila.empleadoId);
      this.asignarMonto(fila, 0);
    }
    this.seleccion.set(siguiente);
  }

  protected alternarTodos(seleccionado: boolean): void {
    const siguiente = new Set(this.seleccion());
    for (const fila of this.filasVisibles()) {
      if (fila.saldo <= 0) {
        continue;
      }
      if (seleccionado) {
        siguiente.add(fila.empleadoId);
        if (this.redondear(fila.monto) <= 0) {
          this.asignarMonto(fila, fila.saldo);
        }
      } else {
        siguiente.delete(fila.empleadoId);
        this.asignarMonto(fila, 0);
      }
    }
    this.seleccion.set(siguiente);
  }

  /** Escribir un monto selecciona la fila: es el gesto natural de "a este si le pago". */
  protected cambiarMonto(fila: FilaPago, monto: number | string): void {
    const valor = this.redondear(Number(monto) || 0);
    this.asignarMonto(fila, valor);
    const siguiente = new Set(this.seleccion());
    if (valor > 0) {
      siguiente.add(fila.empleadoId);
    } else {
      siguiente.delete(fila.empleadoId);
    }
    this.seleccion.set(siguiente);
  }

  protected cambiarReferencia(fila: FilaPago, referencia: string): void {
    this.filas.update((filas) => filas.map((item) =>
      item.empleadoId === fila.empleadoId ? { ...item, referenciaPago: referencia ?? '' } : item
    ));
  }

  protected aplicarReferencia(): void {
    const referencia = this.referenciaMasiva().trim();
    for (const fila of this.filasVisibles()) {
      if (this.seleccion().has(fila.empleadoId)) {
        this.cambiarReferencia(fila, referencia);
      }
    }
  }

  protected pagarSaldoCompleto(): void {
    for (const fila of this.filasVisibles()) {
      if (this.seleccion().has(fila.empleadoId)) {
        this.asignarMonto(fila, fila.saldo);
      }
    }
  }

  protected aplicarMonto(): void {
    const monto = this.redondear(Number(this.montoMasivo()) || 0);
    for (const fila of this.filasVisibles()) {
      if (this.seleccion().has(fila.empleadoId)) {
        // Nadie puede cobrar mas de lo que se le debe, asi que el monto fijo se topa al saldo.
        this.asignarMonto(fila, Math.min(monto, fila.saldo));
      }
    }
  }

  protected limpiar(): void {
    this.seleccion.set(new Set());
    this.filas.update((filas) => filas.map((fila) => ({ ...fila, monto: 0, referenciaPago: '' })));
  }

  protected fechaIso(): string {
    return dateAIso(this.fechaPagoDate);
  }

  /**
   * Registro en dos pasos, igual que anticipos y compras: se propone el asiento y el contador lo
   * revisa (y completa las cuentas que falten) antes de confirmar. Si cancela, no se registra nada.
   */
  protected async registrar(): Promise<void> {
    if (!this.puedeRegistrar()) {
      return;
    }
    this.error.set(null);
    this.procesando.set(true);
    try {
      const detalles = this.detallesPago();
      const cuentaBancaria = this.cuentaSeleccionada();

      if (!(await this.integracionContable.contabilidadActiva())) {
        this.procesando.set(false);
        this.confirmarSinAsiento(detalles);
        return;
      }

      const lineas = await this.pagosService.construirLineasPago(
        this.rol()?.tipo ?? 'MENSUAL',
        detalles,
        cuentaBancaria?.cuentaContableId ?? '',
        this.concepto()
      );
      this.procesando.set(false);

      const confirmadas = await this.revisionAsiento.revisar({
        titulo: 'Revisar asiento del pago de nomina',
        subtitulo: `${this.rol()?.numero || this.rol()?.periodo} · ${detalles.length} empleado(s) · Total ${this.total().toFixed(2)}`,
        lineas
      });
      if (!confirmadas) {
        return;
      }

      this.procesando.set(true);
      await this.guardar(detalles, confirmadas);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    } finally {
      this.procesando.set(false);
    }
  }

  private confirmarSinAsiento(detalles: PagoNominaDetalle[]): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Registrar pago del rol',
        message: 'La contabilidad automatica esta desactivada: el pago se registrara sin generar asiento. Continuar?',
        confirmText: 'Registrar'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.procesando.set(true);
      try {
        await this.guardar(detalles);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  private async guardar(detalles: PagoNominaDetalle[], lineas?: AsientoContableLinea[]): Promise<void> {
    await this.pagosService.registrarPago({
      rolId: this.rolId,
      fecha: this.fechaIso(),
      cuentaBancariaId: this.cuentaBancariaId(),
      formaPago: this.formaPago(),
      referencia: this.referencia(),
      concepto: this.concepto()
    }, detalles, lineas);

    this.toast(
      detalles.length === 1 ? 'Pago registrado.' : `Pago registrado para ${detalles.length} empleados.`,
      'payments'
    );
    await this.router.navigate(this.rutaRol());
  }

  private async cargar(): Promise<void> {
    const [rol, detallesRol, saldos, cuentasBancarias, cuentasContables] = await Promise.all([
      this.pagosService.getRol(this.rolId),
      this.pagosService.getDetallesRol(this.rolId),
      this.pagosService.getSaldosPorEmpleado(this.rolId),
      firstValueFrom(this.bancosCuentas.getCuentas()),
      this.planCuentasService.getCuentasOnce()
    ]);

    this.rol.set(rol);
    this.detallesRol = detallesRol;
    this.saldos = saldos;
    this.cuentasContables.set(cuentasContables);

    const activas = cuentasBancarias.filter((cuenta) => cuenta.estado === 'ACTIVA');
    this.cuentasBancarias.set(activas);
    if (activas.length === 1) {
      this.cuentaBancariaId.set(activas[0].id ?? '');
    }

    this.filas.set(detallesRol.map((detalle) => {
      const saldo = saldos.get(detalle.empleadoId);
      return {
        empleadoId: detalle.empleadoId,
        nombre: detalle.empleadoNombre,
        cargo: detalle.cargo ?? '',
        departamento: detalle.departamento ?? '',
        neto: this.redondear(saldo?.neto ?? detalle.netoPagar),
        pagadoAntes: this.redondear(saldo?.pagado ?? 0),
        saldo: this.redondear(saldo?.saldo ?? detalle.netoPagar),
        monto: 0,
        referenciaPago: ''
      };
    }));

    if (rol) {
      this.concepto.set(`Pago ${this.etiquetasTipo[rol.tipo ?? 'MENSUAL'].toLowerCase()} ${rol.numero || rol.periodo}`);
      // La fecha de pago del rol es la sugerencia natural del egreso; el usuario puede moverla.
      this.fechaPagoDate = isoADate(rol.fechaPago) ?? new Date();
    }
  }

  private hayPendiente(): boolean {
    return this.filas().some((fila) => fila.saldo > 0);
  }

  private asignarMonto(fila: FilaPago, monto: number): void {
    this.filas.update((filas) => filas.map((item) =>
      item.empleadoId === fila.empleadoId ? { ...item, monto } : item
    ));
  }

  private redondear(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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

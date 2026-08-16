import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import {
  BalanceComprobacionFila,
  BalanceComprobacionResultado,
  CuentaPadreNivel4Reporte,
  CuentaContable,
  EstadoResultadoIntegralLinea,
  EstadoResultadoIntegralSeccion,
  EstadoResultadoIntegralResultado,
  EstadoSituacionFinancieraLinea,
  EstadoSituacionFinancieraSeccion,
  EstadoSituacionFinancieraResultado,
  FiltrosReporteContable,
  LibroDiarioFila,
  LibroMayorResultado,
  ModoConsultaEstadoFinanciero,
  TipoCuenta
} from '../../models/contabilidad.models';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { ReportesContablesPdfApiService } from '../../services/reportes-contables-pdf-api.service';
import { ReportesContablesService } from '../../services/reportes-contables.service';

type ReporteKey = 'diario' | 'mayor' | 'balance' | 'esf' | 'eri';
type GrupoEsf = {
  nombre: string;
  total: { saldoInicial: number; movimientoPeriodo: number; saldoFinal: number };
  secciones: EstadoSituacionFinancieraSeccion[];
};
type GrupoEri = {
  nombre: string;
  total: number;
  secciones: EstadoResultadoIntegralSeccion[];
};
type SubgrupoNivel4Esf = {
  padre: CuentaPadreNivel4Reporte | null;
  lineas: EstadoSituacionFinancieraLinea[];
  total: { saldoInicial: number; movimientoPeriodo: number; saldoFinal: number };
};
type SubgrupoNivel4Eri = {
  padre: CuentaPadreNivel4Reporte | null;
  lineas: EstadoResultadoIntegralLinea[];
  total: number;
};

@Component({
  selector: 'app-reportes-contables',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="reportes-page">
      <header class="surface-card page-header">
        <div>
          <h2>
            Reportes contables
            <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.submodulo" aria-label="Ayuda reportes contables">
              <mat-icon>help_outline</mat-icon>
            </button>
          </h2>
          <p>Consulta libro diario, mayor y balance de comprobacion desde los asientos aprobados.</p>
        </div>
      </header>

      @if (warning()) {
        <section class="warning-box">
          <mat-icon>info</mat-icon>
          <span>{{ warning() }}</span>
        </section>
      }

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card tabs-card">
        <mat-tab-group>
          <mat-tab label="Libro diario">
            <section class="tab-panel">
              <div class="report-help">
                <mat-icon>info</mat-icon>
                <span>{{ ayudaReportes.diario }}</span>
              </div>
              <div class="filters-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Fecha desde</mat-label>
                  <input matInput [matDatepicker]="diarioDesdePicker" [ngModel]="diarioFechaDesde()" (ngModelChange)="actualizarFecha('diario', 'desde', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="diarioDesdePicker"></mat-datepicker-toggle>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaDesde" aria-label="Ayuda fecha desde diario">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                  <mat-datepicker #diarioDesdePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha hasta</mat-label>
                  <input matInput [matDatepicker]="diarioHastaPicker" [ngModel]="diarioFechaHasta()" (ngModelChange)="actualizarFecha('diario', 'hasta', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="diarioHastaPicker"></mat-datepicker-toggle>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaHasta" aria-label="Ayuda fecha hasta diario">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                  <mat-datepicker #diarioHastaPicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Periodo</mat-label>
                  <input matInput [(ngModel)]="diarioFiltros.periodo" placeholder="2026-01" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.periodo" aria-label="Ayuda periodo diario">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <app-cuenta-contable-autocomplete
                  [cuentas]="cuentasMovimiento()"
                  [cuentaId]="diarioFiltros.cuentaId || null"
                  [mostrarNumero]="false"
                  [compact]="true"
                  label="Cuenta (todas si queda vacio)"
                  (cuentaSeleccionada)="diarioFiltros.cuentaId = $event?.id ?? ''"
                />

                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>Buscar</mat-label>
                  <input matInput type="search" [(ngModel)]="diarioFiltros.texto" placeholder="Detalle, numero o cuenta" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.texto" aria-label="Ayuda busqueda diario">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="actions-row">
                <button mat-raised-button color="primary" type="button" (click)="consultarDiario()" [disabled]="cargandoDiario()">
                  <mat-icon>search</mat-icon>
                  Consultar
                </button>
                <button mat-stroked-button type="button" (click)="exportarDiario()" [disabled]="diario().length === 0">
                  <mat-icon>download</mat-icon>
                  Exportar CSV
                </button>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="diario()">
                  <ng-container matColumnDef="fecha">
                    <th mat-header-cell *matHeaderCellDef>Fecha</th>
                    <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
                  </ng-container>
                  <ng-container matColumnDef="numero">
                    <th mat-header-cell *matHeaderCellDef>Numero</th>
                    <td mat-cell *matCellDef="let row">{{ row.numero }}</td>
                  </ng-container>
                  <ng-container matColumnDef="glosa">
                    <th mat-header-cell *matHeaderCellDef>Detalle</th>
                    <td mat-cell *matCellDef="let row">{{ row.glosa }}</td>
                  </ng-container>
                  <ng-container matColumnDef="cuenta">
                    <th mat-header-cell *matHeaderCellDef>Cuenta</th>
                    <td mat-cell *matCellDef="let row">{{ row.codigoCuenta }} - {{ row.nombreCuenta }}</td>
                  </ng-container>
                  <ng-container matColumnDef="debe">
                    <th mat-header-cell *matHeaderCellDef>Debe</th>
                    <td mat-cell *matCellDef="let row">{{ row.debe | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="haber">
                    <th mat-header-cell *matHeaderCellDef>Haber</th>
                    <td mat-cell *matCellDef="let row">{{ row.haber | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="estado">
                    <th mat-header-cell *matHeaderCellDef>Estado</th>
                    <td mat-cell *matCellDef="let row"><mat-chip>{{ row.estado }}</mat-chip></td>
                  </ng-container>
                  <ng-container matColumnDef="acciones">
                    <th mat-header-cell *matHeaderCellDef>Acciones</th>
                    <td mat-cell *matCellDef="let row">
                      <button mat-button type="button" (click)="abrirAsiento(row.asientoId)">Abrir</button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasDiario"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasDiario"></tr>
                </table>
              </div>
            </section>
          </mat-tab>

          <mat-tab label="Libro mayor">
            <section class="tab-panel">
              <div class="report-help">
                <mat-icon>info</mat-icon>
                <span>{{ ayudaReportes.mayor }}</span>
              </div>
              <div class="filters-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Fecha desde</mat-label>
                  <input matInput [matDatepicker]="mayorDesdePicker" [ngModel]="mayorFechaDesde()" (ngModelChange)="actualizarFecha('mayor', 'desde', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="mayorDesdePicker"></mat-datepicker-toggle>
                  <mat-datepicker #mayorDesdePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha hasta</mat-label>
                  <input matInput [matDatepicker]="mayorHastaPicker" [ngModel]="mayorFechaHasta()" (ngModelChange)="actualizarFecha('mayor', 'hasta', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="mayorHastaPicker"></mat-datepicker-toggle>
                  <mat-datepicker #mayorHastaPicker></mat-datepicker>
                </mat-form-field>

                <app-cuenta-contable-autocomplete
                  [cuentas]="cuentasMovimiento()"
                  [cuentaId]="mayorFiltros.cuentaId || null"
                  [mostrarNumero]="false"
                  [compact]="true"
                  label="Cuenta (por grupo si queda vacio)"
                  (cuentaSeleccionada)="mayorFiltros.cuentaId = $event?.id ?? ''"
                />

                <mat-form-field appearance="outline">
                  <mat-label>Grupo / tipo</mat-label>
                  <mat-select [(ngModel)]="mayorFiltros.tipoCuenta">
                    <mat-option value="TODOS">Todos</mat-option>
                    @for (tipo of tiposCuenta; track tipo) {
                      <mat-option [value]="tipo">{{ etiquetaTipo(tipo) }}</mat-option>
                    }
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.grupoMayor" aria-label="Ayuda grupo mayor">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="actions-row">
                <button mat-raised-button color="primary" type="button" (click)="consultarMayor()" [disabled]="cargandoMayor()">
                  <mat-icon>search</mat-icon>
                  Consultar
                </button>
                <button mat-stroked-button type="button" (click)="exportarMayor()" [disabled]="mayor().movimientos.length === 0">
                  <mat-icon>download</mat-icon>
                  Exportar CSV
                </button>
              </div>

              <div class="summary-row">
                <span>Saldo anterior: <strong>{{ mayor().saldoAnterior | number:'1.2-2' }}</strong></span>
                <span>Debe: <strong>{{ mayor().totalDebe | number:'1.2-2' }}</strong></span>
                <span>Haber: <strong>{{ mayor().totalHaber | number:'1.2-2' }}</strong></span>
                <span>Saldo final: <strong>{{ mayor().saldoFinal | number:'1.2-2' }}</strong></span>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="mayor().movimientos">
                  <ng-container matColumnDef="fecha">
                    <th mat-header-cell *matHeaderCellDef>Fecha</th>
                    <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
                  </ng-container>
                  <ng-container matColumnDef="numero">
                    <th mat-header-cell *matHeaderCellDef>Asiento</th>
                    <td mat-cell *matCellDef="let row">{{ row.numero }}</td>
                  </ng-container>
                  <ng-container matColumnDef="numeroFactura">
                    <th mat-header-cell *matHeaderCellDef># Factura</th>
                    <td mat-cell *matCellDef="let row">{{ row.numeroFactura || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="cuenta">
                    <th mat-header-cell *matHeaderCellDef>Cuenta</th>
                    <td mat-cell *matCellDef="let row">{{ row.codigoCuenta }} - {{ row.nombreCuenta }}</td>
                  </ng-container>
                  <ng-container matColumnDef="concepto">
                    <th mat-header-cell *matHeaderCellDef>Concepto</th>
                    <td mat-cell *matCellDef="let row">{{ row.concepto }}</td>
                  </ng-container>
                  <ng-container matColumnDef="debe">
                    <th mat-header-cell *matHeaderCellDef>Debe</th>
                    <td mat-cell *matCellDef="let row">{{ row.debe | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="haber">
                    <th mat-header-cell *matHeaderCellDef>Haber</th>
                    <td mat-cell *matCellDef="let row">{{ row.haber | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="saldo">
                    <th mat-header-cell *matHeaderCellDef>Saldo</th>
                    <td mat-cell *matCellDef="let row">{{ row.saldo | number:'1.2-2' }}</td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasMayor"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasMayor"></tr>
                </table>
              </div>
            </section>
          </mat-tab>

          <mat-tab label="Balance de comprobacion">
            <section class="tab-panel">
              <div class="report-help">
                <mat-icon>info</mat-icon>
                <span>{{ ayudaReportes.balance }}</span>
              </div>
              <div class="filters-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Fecha desde</mat-label>
                  <input matInput [matDatepicker]="balanceDesdePicker" [ngModel]="balanceFechaDesde()" (ngModelChange)="actualizarFecha('balance', 'desde', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="balanceDesdePicker"></mat-datepicker-toggle>
                  <mat-datepicker #balanceDesdePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha hasta</mat-label>
                  <input matInput [matDatepicker]="balanceHastaPicker" [ngModel]="balanceFechaHasta()" (ngModelChange)="actualizarFecha('balance', 'hasta', $event)" />
                  <mat-datepicker-toggle matIconSuffix [for]="balanceHastaPicker"></mat-datepicker-toggle>
                  <mat-datepicker #balanceHastaPicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Periodo</mat-label>
                  <input matInput [(ngModel)]="balanceFiltros.periodo" placeholder="2026-01" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tipo</mat-label>
                  <mat-select [(ngModel)]="balanceFiltros.tipoCuenta">
                    <mat-option value="TODOS">Todos</mat-option>
                    @for (tipo of tiposCuenta; track tipo) {
                      <mat-option [value]="tipo">{{ etiquetaTipo(tipo) }}</mat-option>
                    }
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.tipoBalance" aria-label="Ayuda tipo balance">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="actions-row">
                <button mat-raised-button color="primary" type="button" (click)="consultarBalance()" [disabled]="cargandoBalance()">
                  <mat-icon>search</mat-icon>
                  Consultar
                </button>
                <button mat-stroked-button type="button" (click)="exportarBalance()" [disabled]="balance().filas.length === 0">
                  <mat-icon>download</mat-icon>
                  Exportar CSV
                </button>
              </div>

              <div class="summary-row" [class.diff-error]="balance().diferencia !== 0">
                <span>Total debe: <strong>{{ balance().totalDebe | number:'1.2-2' }}</strong></span>
                <span>Total haber: <strong>{{ balance().totalHaber | number:'1.2-2' }}</strong></span>
                <span>Diferencia: <strong>{{ balance().diferencia | number:'1.2-2' }}</strong></span>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="balance().filas">
                  <ng-container matColumnDef="codigoCuenta">
                    <th mat-header-cell *matHeaderCellDef>Codigo</th>
                    <td mat-cell *matCellDef="let row">{{ row.codigoCuenta }}</td>
                  </ng-container>
                  <ng-container matColumnDef="nombreCuenta">
                    <th mat-header-cell *matHeaderCellDef>Cuenta</th>
                    <td mat-cell *matCellDef="let row">{{ row.nombreCuenta }}</td>
                  </ng-container>
                  <ng-container matColumnDef="tipo">
                    <th mat-header-cell *matHeaderCellDef>Tipo</th>
                    <td mat-cell *matCellDef="let row">{{ etiquetaTipo(row.tipo) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="totalDebe">
                    <th mat-header-cell *matHeaderCellDef>Debe</th>
                    <td mat-cell *matCellDef="let row">{{ row.totalDebe | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="totalHaber">
                    <th mat-header-cell *matHeaderCellDef>Haber</th>
                    <td mat-cell *matCellDef="let row">{{ row.totalHaber | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="saldoDeudor">
                    <th mat-header-cell *matHeaderCellDef>Saldo deudor</th>
                    <td mat-cell *matCellDef="let row">{{ row.saldoDeudor | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="saldoAcreedor">
                    <th mat-header-cell *matHeaderCellDef>Saldo acreedor</th>
                    <td mat-cell *matCellDef="let row">{{ row.saldoAcreedor | number:'1.2-2' }}</td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasBalance"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasBalance"></tr>
                </table>
              </div>
            </section>
          </mat-tab>

          <mat-tab label="Estados financieros">
            <section class="tab-panel">
              <section class="financial-block">
                <div>
                  <h3>Estado de Situacion Financiera</h3>
                  <p>
                    Presenta la posición financiera a una fecha y distingue el patrimonio registrado del resultado todavía pendiente de cierre.
                    <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.esf" aria-label="Ayuda ESF">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                  </p>
                </div>

                <div class="filters-grid compact">
                  <mat-form-field appearance="outline">
                    <mat-label>Tipo de consulta</mat-label>
                    <mat-select [ngModel]="esfModo()" (ngModelChange)="cambiarModoEsf($event)">
                      <mat-option value="ACUMULADO">Acumulado a la fecha</mat-option>
                      <mat-option value="RANGO">Rango con saldo inicial</mat-option>
                    </mat-select>
                    <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.modoEsf" aria-label="Ayuda tipo de consulta ESF">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                  </mat-form-field>

                  @if (esfModo() === 'RANGO') {
                    <mat-form-field appearance="outline">
                      <mat-label>Fecha desde</mat-label>
                      <input matInput [matDatepicker]="esfDesdePicker" [ngModel]="esfFechaDesde()" (ngModelChange)="actualizarFecha('esf', 'desde', $event)" />
                      <mat-datepicker-toggle matIconSuffix [for]="esfDesdePicker"></mat-datepicker-toggle>
                      <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaDesdePeriodoEsf" aria-label="Ayuda fecha desde ESF">
                        <mat-icon>help_outline</mat-icon>
                      </button>
                      <mat-datepicker #esfDesdePicker></mat-datepicker>
                    </mat-form-field>
                  }

                  <mat-form-field appearance="outline">
                    <mat-label>{{ esfModo() === 'RANGO' ? 'Fecha hasta' : 'Fecha de corte' }}</mat-label>
                    <input matInput [matDatepicker]="esfCortePicker" [ngModel]="esfFechaCorte()" (ngModelChange)="actualizarFecha('esf', 'hasta', $event)" />
                    <mat-datepicker-toggle matIconSuffix [for]="esfCortePicker"></mat-datepicker-toggle>
                    <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="esfModo() === 'RANGO' ? ayudaReportes.fechaHastaPeriodoEsf : ayudaReportes.fechaCorte" aria-label="Ayuda fecha corte ESF">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                    <mat-datepicker #esfCortePicker></mat-datepicker>
                  </mat-form-field>

                  <div class="actions-row inline-actions">
                    <button mat-raised-button color="primary" type="button" (click)="consultarEsf()" [disabled]="cargandoEsf()">
                      <mat-icon>search</mat-icon>
                      Consultar ESF
                    </button>
                    <button mat-stroked-button type="button" (click)="exportarEsf()" [disabled]="esf().secciones.length === 0">
                      <mat-icon>download</mat-icon>
                      Exportar CSV
                    </button>
                    <button mat-stroked-button type="button" (click)="descargarEsfPdf()" [disabled]="descargandoEsfPdf() || esf().secciones.length === 0">
                      <mat-icon>picture_as_pdf</mat-icon>
                      Descargar PDF
                    </button>
                  </div>
                </div>

                <p class="scope-note">
                  <mat-icon>event_note</mat-icon>
                  <span>{{ descripcionConsultaEsf() }}</span>
                </p>

                @if (esf().secciones.length > 0) {
                  <div class="metrics-strip" [class.diff-error]="esf().totales.diferencia.saldoFinal !== 0">
                    <div><span>Activo al cierre</span><strong>{{ esf().totales.activo.saldoFinal | number:'1.2-2' }}</strong></div>
                    <div><span>Pasivo + patrimonio presentado</span><strong>{{ totalPasivoPatrimonioFinal() | number:'1.2-2' }}</strong></div>
                    <div class="balance-status">
                      <span>Comprobacion</span>
                      @if (esf().totales.diferencia.saldoFinal === 0) {
                        <strong>Cuadra</strong>
                      } @else {
                        <strong>Diferencia {{ esf().totales.diferencia.saldoFinal | number:'1.2-2' }}</strong>
                      }
                    </div>
                  </div>

                  <div class="statement-ledger" [class.single-value]="esf().modo === 'ACUMULADO'">
                    <div class="ledger-header">
                      <span>Cuenta</span>
                      @if (esf().modo === 'RANGO') {
                        <span>Saldo inicial</span>
                        <span>Movimiento</span>
                      }
                      <span>Saldo final</span>
                    </div>
                    @for (grupo of gruposEsf(); track grupo.nombre) {
                      <section class="ledger-group">
                        <header class="ledger-row group-row">
                          <strong>{{ grupo.nombre }}</strong>
                          @if (esf().modo === 'RANGO') {
                            <strong>{{ grupo.total.saldoInicial | number:'1.2-2' }}</strong>
                            <strong>{{ grupo.total.movimientoPeriodo | number:'1.2-2' }}</strong>
                          }
                          <strong>{{ grupo.total.saldoFinal | number:'1.2-2' }}</strong>
                        </header>
                        @for (seccion of grupo.secciones; track seccion.seccion) {
                          <div class="ledger-row section-row">
                            <strong>{{ seccion.nombre }}</strong>
                            @if (esf().modo === 'RANGO') {
                              <strong>{{ seccion.total.saldoInicial | number:'1.2-2' }}</strong>
                              <strong>{{ seccion.total.movimientoPeriodo | number:'1.2-2' }}</strong>
                            }
                            <strong>{{ seccion.total.saldoFinal | number:'1.2-2' }}</strong>
                          </div>
                          @for (subgrupo of subgruposNivel4Esf(seccion.lineas); track subgrupo.padre?.cuentaId ?? subgrupo.padre?.codigoCuenta ?? $index) {
                            @if (subgrupo.padre) {
                              <div class="ledger-row parent-level-row">
                                <span><small>{{ subgrupo.padre.codigoCuenta }}</small>{{ subgrupo.padre.nombreCuenta }} <em>Nivel 4</em></span>
                                @if (esf().modo === 'RANGO') {
                                  <strong>{{ subgrupo.total.saldoInicial | number:'1.2-2' }}</strong>
                                  <strong>{{ subgrupo.total.movimientoPeriodo | number:'1.2-2' }}</strong>
                                }
                                <strong>{{ subgrupo.total.saldoFinal | number:'1.2-2' }}</strong>
                              </div>
                            }
                            @for (linea of subgrupo.lineas; track linea.cuentaId ?? linea.codigoCuenta) {
                              <div class="ledger-row account-row" [class.calculated-line]="linea.calculada">
                                <span>
                                  @if (linea.calculada) {
                                    <small class="calculated-badge">Calculado</small>
                                  } @else {
                                    <small>{{ linea.codigoCuenta }}</small>
                                  }
                                  {{ linea.nombreCuenta }}
                                </span>
                                @if (esf().modo === 'RANGO') {
                                  <strong>{{ linea.importes.saldoInicial | number:'1.2-2' }}</strong>
                                  <strong>{{ linea.importes.movimientoPeriodo | number:'1.2-2' }}</strong>
                                }
                                <strong>{{ linea.importes.saldoFinal | number:'1.2-2' }}</strong>
                              </div>
                            }
                          }
                        }
                      </section>
                    }
                  </div>

                  <section class="equity-bridge" [class.single-value]="esf().modo === 'ACUMULADO'" aria-labelledby="equity-bridge-title">
                    <header>
                      <div>
                        <h4 id="equity-bridge-title">Composición del patrimonio</h4>
                        <p>El resultado se obtiene del ERI y se presenta sin crear ni modificar asientos patrimoniales.</p>
                      </div>
                      <span class="calculated-badge">Pendiente de cierre</span>
                    </header>
                    <div class="equity-row equity-heading">
                      <span>Concepto</span>
                      @if (esf().modo === 'RANGO') {
                        <span>Saldo inicial</span>
                        <span>Movimiento</span>
                      }
                      <span>Saldo final</span>
                    </div>
                    <div class="equity-row">
                      <span><strong>Patrimonio contabilizado</strong><small>Solo asientos registrados en cuentas patrimoniales</small></span>
                      @if (esf().modo === 'RANGO') {
                        <strong>{{ esf().totales.patrimonioContabilizado.saldoInicial | number:'1.2-2' }}</strong>
                        <strong>{{ esf().totales.patrimonioContabilizado.movimientoPeriodo | number:'1.2-2' }}</strong>
                      }
                      <strong>{{ esf().totales.patrimonioContabilizado.saldoFinal | number:'1.2-2' }}</strong>
                    </div>
                    <div class="equity-row calculated-equity">
                      <span><strong>Resultado acumulado calculado</strong><small>Ingresos menos costos y gastos; no es un asiento</small></span>
                      @if (esf().modo === 'RANGO') {
                        <strong>{{ esf().totales.resultadoCalculado.saldoInicial | number:'1.2-2' }}</strong>
                        <strong>{{ esf().totales.resultadoCalculado.movimientoPeriodo | number:'1.2-2' }}</strong>
                      }
                      <strong>{{ esf().totales.resultadoCalculado.saldoFinal | number:'1.2-2' }}</strong>
                    </div>
                    <div class="equity-row equity-total">
                      <span><strong>Patrimonio total presentado</strong><small>Valor utilizado para comprobar el ESF</small></span>
                      @if (esf().modo === 'RANGO') {
                        <strong>{{ esf().totales.patrimonioPresentado.saldoInicial | number:'1.2-2' }}</strong>
                        <strong>{{ esf().totales.patrimonioPresentado.movimientoPeriodo | number:'1.2-2' }}</strong>
                      }
                      <strong>{{ esf().totales.patrimonioPresentado.saldoFinal | number:'1.2-2' }}</strong>
                    </div>
                  </section>

                  <div class="reconciliation-grid">
                    @if (esf().modo === 'RANGO') {
                      <div><span>Apertura</span><strong>{{ etiquetaCuadre(esf().totales.diferencia.saldoInicial) }}</strong><small>{{ esf().totales.diferencia.saldoInicial | number:'1.2-2' }}</small></div>
                      <div><span>Movimiento</span><strong>{{ etiquetaCuadre(esf().totales.diferencia.movimientoPeriodo) }}</strong><small>{{ esf().totales.diferencia.movimientoPeriodo | number:'1.2-2' }}</small></div>
                    }
                    <div><span>Cierre</span><strong>{{ etiquetaCuadre(esf().totales.diferencia.saldoFinal) }}</strong><small>{{ esf().totales.diferencia.saldoFinal | number:'1.2-2' }}</small></div>
                  </div>
                } @else if (!cargandoEsf() && esfConsultado()) {
                  <div class="empty-report">
                    <mat-icon>account_balance</mat-icon>
                    <h4>Sin saldos para presentar</h4>
                    <p>No hay cuentas con valores distintos de cero en las fechas seleccionadas.</p>
                  </div>
                }
              </section>

              <section class="financial-block">
                <div>
                  <h3>Estado de Resultado Integral</h3>
                  <p>
                    Presenta ingresos, costos, gastos y resultado neto del periodo.
                    <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.eri" aria-label="Ayuda ERI">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                  </p>
                </div>

                <div class="filters-grid compact">
                  <mat-form-field appearance="outline">
                    <mat-label>Fecha desde</mat-label>
                    <input matInput [matDatepicker]="eriDesdePicker" [ngModel]="eriFechaDesde()" (ngModelChange)="actualizarFecha('eri', 'desde', $event)" />
                    <mat-datepicker-toggle matIconSuffix [for]="eriDesdePicker"></mat-datepicker-toggle>
                    <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaDesdeResultado" aria-label="Ayuda fecha desde ERI">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                    <mat-datepicker #eriDesdePicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Fecha hasta</mat-label>
                    <input matInput [matDatepicker]="eriHastaPicker" [ngModel]="eriFechaHasta()" (ngModelChange)="actualizarFecha('eri', 'hasta', $event)" />
                    <mat-datepicker-toggle matIconSuffix [for]="eriHastaPicker"></mat-datepicker-toggle>
                    <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaHastaResultado" aria-label="Ayuda fecha hasta ERI">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                    <mat-datepicker #eriHastaPicker></mat-datepicker>
                  </mat-form-field>

                  <div class="actions-row inline-actions">
                    <button mat-raised-button color="primary" type="button" (click)="consultarEri()" [disabled]="cargandoEri()">
                      <mat-icon>search</mat-icon>
                      Consultar ERI
                    </button>
                    <button mat-stroked-button type="button" (click)="exportarEri()" [disabled]="eri().secciones.length === 0">
                      <mat-icon>download</mat-icon>
                      Exportar CSV
                    </button>
                    <button mat-stroked-button type="button" (click)="descargarEriPdf()" [disabled]="descargandoEriPdf() || eri().secciones.length === 0">
                      <mat-icon>picture_as_pdf</mat-icon>
                      Descargar PDF
                    </button>
                  </div>
                </div>

                @if (eri().secciones.length > 0) {
                  <div class="metrics-strip eri-metrics">
                    <div><span>Ingresos</span><strong>{{ eri().totales.ingresos | number:'1.2-2' }}</strong></div>
                    <div><span>Costos y gastos</span><strong>{{ totalCostosGastos() | number:'1.2-2' }}</strong></div>
                    <div class="balance-status"><span>Resultado neto</span><strong>{{ eri().totales.resultadoNeto | number:'1.2-2' }}</strong></div>
                  </div>

                  <div class="statement-ledger single-value">
                    <div class="ledger-header"><span>Cuenta</span><span>Monto del periodo</span></div>
                    @for (grupo of gruposEri(); track grupo.nombre) {
                      <section class="ledger-group">
                        <header class="ledger-row group-row"><strong>{{ grupo.nombre }}</strong><strong>{{ grupo.total | number:'1.2-2' }}</strong></header>
                        @for (seccion of grupo.secciones; track seccion.seccion) {
                          <div class="ledger-row section-row"><strong>{{ seccion.nombre }}</strong><strong>{{ seccion.total | number:'1.2-2' }}</strong></div>
                          @for (subgrupo of subgruposNivel4Eri(seccion.lineas); track subgrupo.padre?.cuentaId ?? subgrupo.padre?.codigoCuenta ?? $index) {
                            @if (subgrupo.padre) {
                              <div class="ledger-row parent-level-row">
                                <span><small>{{ subgrupo.padre.codigoCuenta }}</small>{{ subgrupo.padre.nombreCuenta }} <em>Nivel 4</em></span>
                                <strong>{{ subgrupo.total | number:'1.2-2' }}</strong>
                              </div>
                            }
                            @for (linea of subgrupo.lineas; track linea.cuentaId ?? linea.codigoCuenta) {
                              <div class="ledger-row account-row">
                                <span><small>{{ linea.codigoCuenta }}</small>{{ linea.nombreCuenta }}</span>
                                <strong>{{ linea.monto | number:'1.2-2' }}</strong>
                              </div>
                            }
                          }
                        }
                      </section>
                    }
                  </div>

                  <div class="result-waterfall">
                    <div><span>Resultado bruto</span><strong>{{ eri().totales.resultadoBruto | number:'1.2-2' }}</strong></div>
                    <div><span>Resultado operacional</span><strong>{{ eri().totales.resultadoOperacional | number:'1.2-2' }}</strong></div>
                    <div><span>Resultado neto</span><strong>{{ eri().totales.resultadoNeto | number:'1.2-2' }}</strong></div>
                  </div>
                } @else if (!cargandoEri() && eriConsultado()) {
                  <div class="empty-report">
                    <mat-icon>monitoring</mat-icon>
                    <h4>Sin resultados para presentar</h4>
                    <p>No hay ingresos, costos o gastos distintos de cero en el periodo seleccionado.</p>
                  </div>
                }
              </section>
            </section>
          </mat-tab>
        </mat-tab-group>
      </section>
    </section>
  `,
  styles: [`
    .reportes-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header h2 { display: inline-flex; align-items: center; gap: .35rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .tabs-card { padding: 0; overflow: hidden; background: var(--tc-surface-container-lowest); }
    .tab-panel { display: grid; gap: 1rem; padding: 1.25rem; }
    .report-help { display: flex; align-items: center; gap: .55rem; padding: .75rem .9rem; border-radius: .5rem; background: var(--tc-surface-container); color: var(--muted-foreground); }
    .report-help mat-icon { color: var(--primary); }
    .filters-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; align-items: start; }
    .filters-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; }
    .span-2 { grid-column: span 2; }
    .actions-row, .summary-row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; align-items: center; }
    .inline-actions { justify-content: flex-start; }
    /* Los botones siempre ocupan su propia fila: el numero de filtros cambia segun el tipo de consulta. */
    .filters-grid.compact .inline-actions { grid-column: 1 / -1; }
    .scope-note { display: flex; align-items: center; gap: .5rem; margin: 0; color: var(--muted-foreground); font-size: .875rem; }
    .scope-note mat-icon { color: var(--primary); font-size: 1.15rem; width: 1.15rem; height: 1.15rem; }
    .summary-row { justify-content: flex-start; padding: .75rem 1rem; border-radius: .5rem; background: var(--tc-surface-container); }
    .summary-row span { color: var(--muted-foreground); }
    .summary-row strong { color: var(--foreground); }
    .warning-box, .error-box { display: flex; align-items: center; gap: .6rem; padding: .8rem 1rem; border-radius: .5rem; }
    .warning-box { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #7a4b00; }
    .error-box, .diff-error { color: #b3261e; }
    .error-box { background: color-mix(in srgb, #b3261e 12%, transparent); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1080px; }
    .financial-block { display: grid; gap: 1.1rem; padding: 1.25rem; border-radius: 1rem; background: var(--tc-surface-container-low); }
    .financial-block h3, .financial-block p { margin: 0; }
    .financial-block p { color: var(--muted-foreground); }
    .financial-block p { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
    .metrics-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: hidden; border-radius: .875rem; background: var(--tc-surface-container-lowest); }
    .metrics-strip > div { display: grid; gap: .3rem; min-width: 0; padding: 1rem 1.1rem; }
    .metrics-strip > div + div { box-shadow: inset 1px 0 color-mix(in srgb, var(--outline) 18%, transparent); }
    .metrics-strip span, .reconciliation-grid span, .result-waterfall span { color: var(--muted-foreground); font-size: .75rem; letter-spacing: .04em; text-transform: uppercase; }
    .metrics-strip strong { text-align: right; color: var(--foreground); font-size: 1.15rem; font-variant-numeric: tabular-nums; }
    .metrics-strip .balance-status { background: color-mix(in srgb, var(--primary) 11%, var(--tc-surface-container-lowest)); }
    .metrics-strip.diff-error .balance-status { background: color-mix(in srgb, #b3261e 9%, var(--tc-surface-container-lowest)); }
    .statement-ledger { overflow-x: auto; border-radius: .875rem; background: var(--tc-surface-container-lowest); }
    .ledger-header, .ledger-row { display: grid; grid-template-columns: minmax(18rem, 1fr) repeat(3, minmax(8rem, .42fr)); align-items: center; column-gap: 1rem; min-width: 48rem; }
    .statement-ledger.single-value .ledger-header, .statement-ledger.single-value .ledger-row { grid-template-columns: minmax(18rem, 1fr) minmax(9rem, .42fr); min-width: 34rem; }
    .ledger-header { padding: .7rem 1rem; color: var(--muted-foreground); background: var(--tc-surface-container); font-size: .75rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .ledger-header span:not(:first-child), .ledger-row > strong { text-align: right; font-variant-numeric: tabular-nums; }
    .ledger-group + .ledger-group { margin-top: .45rem; }
    .ledger-row { padding: .65rem 1rem; }
    .group-row { color: var(--tc-on-primary, #fff); background: var(--primary); }
    .section-row { color: var(--foreground); background: color-mix(in srgb, var(--primary) 10%, var(--tc-surface-container-lowest)); }
    .parent-level-row { color: var(--foreground); background: color-mix(in srgb, var(--primary) 6%, var(--tc-surface-container-lowest)); box-shadow: inset 0 1px color-mix(in srgb, var(--primary) 14%, transparent); }
    .parent-level-row span { display: grid; grid-template-columns: minmax(5.5rem, auto) 1fr auto; gap: .65rem; align-items: baseline; font-weight: 700; }
    .parent-level-row small { color: var(--primary); font-variant-numeric: tabular-nums; }
    .parent-level-row em { color: var(--muted-foreground); font-size: .68rem; font-style: normal; font-weight: 700; letter-spacing: .035em; text-transform: uppercase; }
    .account-row { color: var(--muted-foreground); }
    .account-row:nth-child(even) { background: color-mix(in srgb, var(--foreground) 3%, transparent); }
    .account-row:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .account-row span { display: grid; grid-template-columns: minmax(5.5rem, auto) 1fr; gap: .65rem; align-items: baseline; }
    .account-row small { color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
    .account-row strong { color: var(--foreground); }
    .calculated-line span, .calculated-line strong { color: var(--primary); font-weight: 700; }
    .calculated-badge { display: inline-flex; width: fit-content; align-items: center; min-height: 1.35rem; padding: .15rem .4rem; border-radius: .25rem; background: color-mix(in srgb, var(--primary) 14%, var(--tc-surface-container-lowest)); color: var(--primary); font-size: .65rem; font-weight: 800; letter-spacing: .035em; line-height: 1; text-transform: uppercase; }
    .equity-bridge { overflow-x: auto; border-radius: .875rem; background: color-mix(in srgb, var(--primary) 8%, var(--tc-surface-container-lowest)); }
    .equity-bridge > header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1rem; }
    .equity-bridge h4 { margin: 0; color: var(--foreground); font-size: 1rem; }
    .equity-bridge header p { display: block; margin: .25rem 0 0; max-width: 65ch; font-size: .82rem; line-height: 1.45; }
    .equity-row { display: grid; grid-template-columns: minmax(18rem, 1fr) repeat(3, minmax(8rem, .42fr)); align-items: center; column-gap: 1rem; min-width: 48rem; padding: .65rem 1rem; }
    .equity-bridge.single-value .equity-row { grid-template-columns: minmax(18rem, 1fr) minmax(9rem, .42fr); min-width: 34rem; }
    .equity-row > span:first-child { display: grid; gap: .15rem; }
    .equity-row > span:first-child small { color: var(--muted-foreground); line-height: 1.35; }
    .equity-row > strong { text-align: right; color: var(--foreground); font-variant-numeric: tabular-nums; }
    .equity-heading { color: var(--muted-foreground); background: color-mix(in srgb, var(--primary) 7%, var(--tc-surface-container)); font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .equity-heading span:not(:first-child) { text-align: right; }
    .calculated-equity { color: var(--primary); }
    .calculated-equity > strong, .calculated-equity > span strong { color: var(--primary); }
    .equity-total { box-shadow: inset 0 1px color-mix(in srgb, var(--primary) 35%, transparent); background: color-mix(in srgb, var(--primary) 10%, var(--tc-surface-container-lowest)); }
    .equity-total > strong, .equity-total > span strong { color: var(--primary); font-size: 1.02rem; }
    .reconciliation-grid, .result-waterfall { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin-left: auto; width: min(100%, 44rem); }
    .reconciliation-grid > div, .result-waterfall > div { display: grid; gap: .25rem; padding: .85rem 1rem; border-radius: .75rem; background: var(--tc-surface-container-lowest); }
    .reconciliation-grid strong, .result-waterfall strong { color: var(--primary); text-align: right; }
    .reconciliation-grid small { color: var(--muted-foreground); text-align: right; font-variant-numeric: tabular-nums; }
    .result-waterfall > div:last-child { background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-lowest)); }
    .result-waterfall strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .empty-report { display: grid; justify-items: center; gap: .45rem; padding: 2.5rem 1rem; border-radius: .875rem; background: var(--tc-surface-container-lowest); text-align: center; }
    .empty-report mat-icon { width: 2rem; height: 2rem; color: var(--primary); font-size: 2rem; }
    .empty-report h4, .empty-report p { margin: 0; }
    .empty-report p { max-width: 34rem; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 1100px) {
      .filters-grid, .filters-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .span-2 { grid-column: auto; }
    }
    @media (max-width: 720px) {
      .filters-grid, .filters-grid.compact { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
      .financial-block { padding: 1rem; }
      .metrics-strip, .reconciliation-grid, .result-waterfall { grid-template-columns: 1fr; width: 100%; }
      .metrics-strip > div + div { box-shadow: inset 0 1px color-mix(in srgb, var(--outline) 18%, transparent); }
      .equity-bridge > header { align-items: flex-start; flex-direction: column; }
    }
  `]
})
export class ReportesContablesComponent implements OnInit {
  private readonly service = inject(ReportesContablesService);
  private readonly pdfApi = inject(ReportesContablesPdfApiService);
  private readonly configuracionService = inject(ConfiguracionContableService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly tiposCuenta: TipoCuenta[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO'];
  protected readonly columnasDiario = ['fecha', 'numero', 'glosa', 'cuenta', 'debe', 'haber', 'estado', 'acciones'];
  protected readonly columnasMayor = ['fecha', 'numero', 'numeroFactura', 'cuenta', 'concepto', 'debe', 'haber', 'saldo'];
  protected readonly columnasBalance = ['codigoCuenta', 'nombreCuenta', 'tipo', 'totalDebe', 'totalHaber', 'saldoDeudor', 'saldoAcreedor'];
  protected readonly ayudaReportes = {
    submodulo: 'Reportes calculados desde asientos aprobados y reversados. Los borradores no afectan saldos ni estados financieros.',
    diario: 'Libro cronologico de asientos y lineas contables. Sirve para auditar que se registro, cuando y contra que cuenta.',
    mayor: 'Movimiento detallado por cuenta o grupo, con saldo anterior, debitos, creditos y saldo final.',
    balance: 'Resumen por cuenta para comprobar que el total debe coincide con el total haber en el rango consultado.',
    esf: 'Foto financiera a una fecha. Separa las cuentas patrimoniales contabilizadas del resultado acumulado calculado, que se presenta sin crear asientos.',
    eri: 'Resultado del periodo: ingresos menos costos y gastos. No usa saldos acumulados, usa movimientos del rango.',
    fechaDesde: 'Inicio del rango de movimientos a consultar. Incluye asientos desde esta fecha.',
    fechaHasta: 'Fin del rango de movimientos a consultar. Incluye asientos hasta esta fecha.',
    periodo: 'Filtro mensual con formato YYYY-MM. Uselo cuando quiera revisar un periodo contable especifico.',
    cuenta: 'Filtra el reporte por una cuenta de movimiento para revisar registros relacionados.',
    texto: 'Busca por detalle, numero de asiento, referencia o cuenta dentro del libro diario.',
    cuentaMayor: 'Seleccione una cuenta para ver su mayor individual. Si queda vacio se usa el grupo/tipo.',
    grupoMayor: 'Permite consultar mayores por tipo de cuenta cuando no se elige una cuenta especifica.',
    tipoBalance: 'Limita el balance de comprobacion a activos, pasivos, patrimonio, ingresos, costos o gastos.',
    modoEsf: 'Acumulado a la fecha muestra el saldo de cierre. Rango con saldo inicial separa apertura, movimiento y cierre dentro del mismo ejercicio.',
    fechaCorte: 'Fecha hasta la que se acumulan saldos del Estado de Situacion Financiera.',
    fechaDesdePeriodoEsf: 'Inicio inclusivo del rango. El saldo inicial se calcula hasta el dia anterior.',
    fechaHastaPeriodoEsf: 'Cierre inclusivo del rango. Debe pertenecer al mismo ejercicio fiscal que la fecha inicial.',
    fechaDesdeResultado: 'Inicio del periodo de ingresos, costos y gastos para el Estado de Resultado Integral.',
    fechaHastaResultado: 'Cierre del periodo de ingresos, costos y gastos para calcular el resultado neto.'
  };

  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly cuentasMovimiento = signal<CuentaContable[]>([]);
  protected readonly warning = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly diario = signal<LibroDiarioFila[]>([]);
  protected readonly mayor = signal<LibroMayorResultado>(this.mayorVacio());
  protected readonly balance = signal<BalanceComprobacionResultado>(this.balanceVacio());
  protected readonly esf = signal<EstadoSituacionFinancieraResultado>(this.esfVacio());
  protected readonly eri = signal<EstadoResultadoIntegralResultado>(this.eriVacio());
  protected readonly cargandoDiario = signal(false);
  protected readonly cargandoMayor = signal(false);
  protected readonly cargandoBalance = signal(false);
  protected readonly cargandoEsf = signal(false);
  protected readonly cargandoEri = signal(false);
  protected readonly descargandoEsfPdf = signal(false);
  protected readonly descargandoEriPdf = signal(false);
  protected readonly esfConsultado = signal(false);
  protected readonly eriConsultado = signal(false);

  protected readonly diarioFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly diarioFechaHasta = signal<Date | null>(new Date());
  protected readonly mayorFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly mayorFechaHasta = signal<Date | null>(new Date());
  protected readonly balanceFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly balanceFechaHasta = signal<Date | null>(new Date());
  protected readonly esfModo = signal<ModoConsultaEstadoFinanciero>('ACUMULADO');
  protected readonly esfFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly esfFechaCorte = signal<Date | null>(new Date());
  protected readonly eriFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly eriFechaHasta = signal<Date | null>(new Date());

  private esfFechaDesdeValue = this.formatFecha(this.inicioMes());
  private esfFechaCorteValue = this.formatFecha(new Date());
  private eriFechaDesdeValue = this.formatFecha(this.inicioMes());
  private eriFechaHastaValue = this.formatFecha(new Date());

  protected readonly diarioFiltros: FiltrosReporteContable = {
    fechaDesde: this.formatFecha(this.inicioMes()),
    fechaHasta: this.formatFecha(new Date()),
    periodo: '',
    cuentaId: '',
    texto: ''
  };

  protected readonly mayorFiltros: FiltrosReporteContable = {
    fechaDesde: this.formatFecha(this.inicioMes()),
    fechaHasta: this.formatFecha(new Date()),
    cuentaId: '',
    tipoCuenta: 'TODOS'
  };

  protected readonly balanceFiltros: FiltrosReporteContable = {
    fechaDesde: this.formatFecha(this.inicioMes()),
    fechaHasta: this.formatFecha(new Date()),
    periodo: '',
    tipoCuenta: 'TODOS'
  };

  async ngOnInit(): Promise<void> {
    this.configuracionService
      .getEmpresa()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((empresa) => {
        this.warning.set(empresa?.configurado ? null : 'La empresa contable aun no esta configurada. Puedes consultar historicos existentes, pero conviene completar la configuracion.');
      });

    const cuentas = await this.service.getCuentas();
    this.cuentas.set(cuentas);
    this.cuentasMovimiento.set(cuentas.filter((cuenta) => cuenta.permiteMovimiento));
    await Promise.all([
      this.consultarDiario(),
      this.consultarMayor(),
      this.consultarBalance(),
      this.consultarEsf(),
      this.consultarEri()
    ]);
  }

  protected async consultarDiario(): Promise<void> {
    this.error.set(null);
    this.cargandoDiario.set(true);
    try {
      this.diario.set(await this.service.generarLibroDiario(this.limpiarFiltros(this.diarioFiltros)));
    } catch {
      this.error.set('No se pudo generar el libro diario.');
    } finally {
      this.cargandoDiario.set(false);
    }
  }

  protected async consultarMayor(): Promise<void> {
    this.error.set(null);
    this.cargandoMayor.set(true);
    try {
      this.mayor.set(await this.service.generarLibroMayor(this.limpiarFiltros(this.mayorFiltros)));
    } catch {
      this.error.set('No se pudo generar el libro mayor.');
    } finally {
      this.cargandoMayor.set(false);
    }
  }

  protected async consultarBalance(): Promise<void> {
    this.error.set(null);
    this.cargandoBalance.set(true);
    try {
      this.balance.set(await this.service.generarBalanceComprobacion(this.limpiarFiltros(this.balanceFiltros)));
    } catch {
      this.error.set('No se pudo generar el balance de comprobacion.');
    } finally {
      this.cargandoBalance.set(false);
    }
  }

  protected async consultarEsf(): Promise<void> {
    this.error.set(null);
    this.esfConsultado.set(false);
    this.cargandoEsf.set(true);
    try {
      this.validarRangoEsf();
      this.esf.set(await this.pdfApi.consultarEstadoSituacionFinanciera(this.esfFechaCorteValue, this.esfPeriodoDesde()));
      this.esfConsultado.set(true);
    } catch (error) {
      this.esf.set(this.esfVacio());
      this.error.set(this.mensajeError(error, 'No se pudo generar el Estado de Situacion Financiera.'));
    } finally {
      this.cargandoEsf.set(false);
    }
  }

  protected async consultarEri(): Promise<void> {
    this.error.set(null);
    this.eriConsultado.set(false);
    this.cargandoEri.set(true);
    try {
      this.validarRango(this.eriFechaDesdeValue, this.eriFechaHastaValue);
      this.eri.set(await this.pdfApi.consultarEstadoResultadoIntegral(this.eriFechaDesdeValue, this.eriFechaHastaValue));
      this.eriConsultado.set(true);
    } catch (error) {
      this.eri.set(this.eriVacio());
      this.error.set(this.mensajeError(error, 'No se pudo generar el Estado de Resultado Integral.'));
    } finally {
      this.cargandoEri.set(false);
    }
  }

  protected actualizarFecha(reporte: ReporteKey, limite: 'desde' | 'hasta', value: Date | string | null): void {
    const fecha = value instanceof Date ? value : value ? this.parseFecha(value) : null;
    const formatted = fecha ? this.formatFecha(fecha) : '';
    const signalTarget = this.getFechaSignal(reporte, limite);

    if (reporte === 'esf') {
      if (limite === 'desde') {
        this.esfFechaDesdeValue = formatted;
      } else {
        this.esfFechaCorteValue = formatted;
      }
      signalTarget.set(fecha);
      this.esf.set(this.esfVacio());
      this.esfConsultado.set(false);
      return;
    }

    if (reporte === 'eri') {
      if (limite === 'desde') {
        this.eriFechaDesdeValue = formatted;
      } else {
        this.eriFechaHastaValue = formatted;
      }
      signalTarget.set(fecha);
      this.eri.set(this.eriVacio());
      this.eriConsultado.set(false);
      return;
    }

    const filtros = reporte === 'diario' ? this.diarioFiltros : reporte === 'mayor' ? this.mayorFiltros : this.balanceFiltros;

    if (limite === 'desde') {
      filtros.fechaDesde = formatted;
    } else {
      filtros.fechaHasta = formatted;
    }
    signalTarget.set(fecha);
  }

  protected abrirAsiento(asientoId?: string): void {
    if (!asientoId) {
      return;
    }
    void this.router.navigate(['/workspace/contabilidad/asientos', asientoId, 'editar']);
  }

  protected exportarDiario(): void {
    this.service.exportarCsv('libro-diario.csv', this.diario().map((fila) => ({
      fecha: fila.fecha,
      periodo: fila.periodo,
      numero: fila.numero,
      glosa: fila.glosa,
      estado: fila.estado,
      codigoCuenta: fila.codigoCuenta,
      cuenta: fila.nombreCuenta,
      debe: fila.debe,
      haber: fila.haber
    })));
    this.mostrarMensaje('Libro diario exportado.', 'download');
  }

  protected exportarMayor(): void {
    this.service.exportarCsv('libro-mayor.csv', this.mayor().movimientos.map((fila) => ({
      fecha: fila.fecha,
      periodo: fila.periodo,
      asiento: fila.numero,
      numeroFactura: fila.numeroFactura ?? '',
      codigoCuenta: fila.codigoCuenta,
      cuenta: fila.nombreCuenta,
      concepto: fila.concepto,
      debe: fila.debe,
      haber: fila.haber,
      saldo: fila.saldo
    })));
    this.mostrarMensaje('Libro mayor exportado.', 'download');
  }

  protected exportarBalance(): void {
    this.service.exportarCsv('balance-comprobacion.csv', this.balance().filas.map((fila: BalanceComprobacionFila) => ({
      codigoCuenta: fila.codigoCuenta,
      cuenta: fila.nombreCuenta,
      tipo: fila.tipo,
      debe: fila.totalDebe,
      haber: fila.totalHaber,
      saldoDeudor: fila.saldoDeudor,
      saldoAcreedor: fila.saldoAcreedor
    })));
    this.mostrarMensaje('Balance de comprobacion exportado.', 'download');
  }

  protected exportarEsf(): void {
    const resultado = this.esf();
    const nombre = resultado.modo === 'RANGO' && resultado.fechaDesde
      ? `estado-situacion-financiera-${resultado.fechaDesde}_${resultado.fechaHasta}.csv`
      : `estado-situacion-financiera-${resultado.fechaHasta}.csv`;
    const detalle = resultado.secciones.flatMap((seccion) => [
      {
        seccion: seccion.nombre,
        jerarquia: 'TOTAL_SECCION',
        codigoCuenta: '',
        cuenta: 'TOTAL',
        saldoInicial: seccion.total.saldoInicial,
        movimientoPeriodo: seccion.total.movimientoPeriodo,
        saldoFinal: seccion.total.saldoFinal
      },
      ...this.subgruposNivel4Esf(seccion.lineas).flatMap((subgrupo) => [
        ...(subgrupo.padre ? [{
          seccion: seccion.nombre,
          jerarquia: 'PADRE_NIVEL_4',
          codigoCuenta: subgrupo.padre.codigoCuenta,
          cuenta: subgrupo.padre.nombreCuenta,
          saldoInicial: subgrupo.total.saldoInicial,
          movimientoPeriodo: subgrupo.total.movimientoPeriodo,
          saldoFinal: subgrupo.total.saldoFinal
        }] : []),
        ...subgrupo.lineas.map((linea) => ({
          seccion: seccion.nombre,
          jerarquia: linea.calculada ? 'CALCULADO' : 'CUENTA',
          codigoCuenta: linea.calculada ? 'CALCULADO' : linea.codigoCuenta,
          cuenta: linea.nombreCuenta,
          saldoInicial: linea.importes.saldoInicial,
          movimientoPeriodo: linea.importes.movimientoPeriodo,
          saldoFinal: linea.importes.saldoFinal
        }))
      ])
    ]);
    const composicionPatrimonio = [
      { seccion: 'COMPOSICION DEL PATRIMONIO', jerarquia: 'RESUMEN', codigoCuenta: '', cuenta: 'Patrimonio contabilizado', ...resultado.totales.patrimonioContabilizado },
      { seccion: 'COMPOSICION DEL PATRIMONIO', jerarquia: 'CALCULADO', codigoCuenta: 'CALCULADO', cuenta: 'Resultado acumulado calculado - pendiente de cierre', ...resultado.totales.resultadoCalculado },
      { seccion: 'COMPOSICION DEL PATRIMONIO', jerarquia: 'RESUMEN', codigoCuenta: '', cuenta: 'Patrimonio total presentado', ...resultado.totales.patrimonioPresentado }
    ];
    this.service.exportarCsv(nombre, [...detalle, ...composicionPatrimonio]);
    this.mostrarMensaje('Estado de Situacion Financiera exportado.', 'download');
  }

  protected exportarEri(): void {
    this.service.exportarCsv('estado-resultado-integral.csv', this.eri().secciones.flatMap((seccion) => [
      { seccion: seccion.nombre, jerarquia: 'TOTAL_SECCION', codigoCuenta: '', cuenta: 'TOTAL', monto: seccion.total },
      ...this.subgruposNivel4Eri(seccion.lineas).flatMap((subgrupo) => [
        ...(subgrupo.padre ? [{
          seccion: seccion.nombre,
          jerarquia: 'PADRE_NIVEL_4',
          codigoCuenta: subgrupo.padre.codigoCuenta,
          cuenta: subgrupo.padre.nombreCuenta,
          monto: subgrupo.total
        }] : []),
        ...subgrupo.lineas.map((linea) => ({
          seccion: seccion.nombre,
          jerarquia: 'CUENTA',
          codigoCuenta: linea.codigoCuenta,
          cuenta: linea.nombreCuenta,
          monto: linea.monto
        }))
      ])
    ]));
    this.mostrarMensaje('Estado de Resultado Integral exportado.', 'download');
  }

  protected gruposEsf(): GrupoEsf[] {
    return this.agruparEsf(this.esf().secciones, [
      { nombre: 'Activo', secciones: ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE'] },
      { nombre: 'Pasivo', secciones: ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'] },
      { nombre: 'Patrimonio total presentado', secciones: ['PATRIMONIO'] }
    ]);
  }

  protected gruposEri(): GrupoEri[] {
    return this.agruparEri(this.eri().secciones, [
      { nombre: 'Ingresos', secciones: ['INGRESOS_OPERACIONALES', 'OTROS_INGRESOS'] },
      { nombre: 'Costos', secciones: ['COSTOS'] },
      { nombre: 'Gastos', secciones: ['GASTOS_ADMINISTRATIVOS', 'GASTOS_VENTAS', 'GASTOS_FINANCIEROS', 'OTROS_GASTOS'] }
    ]);
  }

  protected subgruposNivel4Esf(lineas: EstadoSituacionFinancieraLinea[]): SubgrupoNivel4Esf[] {
    const grupos = new Map<string, SubgrupoNivel4Esf>();
    for (const linea of lineas) {
      const padre = linea.padreNivel4 ?? null;
      const key = padre
        ? `PADRE:${padre.cuentaId ?? padre.codigoCuenta}`
        : `CUENTA:${linea.cuentaId ?? linea.codigoCuenta}`;
      const grupo = grupos.get(key) ?? {
        padre,
        lineas: [],
        total: { saldoInicial: 0, movimientoPeriodo: 0, saldoFinal: 0 }
      };
      grupo.lineas.push(linea);
      grupo.total = {
        saldoInicial: this.service.roundToTwo(grupo.total.saldoInicial + linea.importes.saldoInicial),
        movimientoPeriodo: this.service.roundToTwo(grupo.total.movimientoPeriodo + linea.importes.movimientoPeriodo),
        saldoFinal: this.service.roundToTwo(grupo.total.saldoFinal + linea.importes.saldoFinal)
      };
      grupos.set(key, grupo);
    }
    return [...grupos.values()];
  }

  protected subgruposNivel4Eri(lineas: EstadoResultadoIntegralLinea[]): SubgrupoNivel4Eri[] {
    const grupos = new Map<string, SubgrupoNivel4Eri>();
    for (const linea of lineas) {
      const padre = linea.padreNivel4 ?? null;
      const key = padre
        ? `PADRE:${padre.cuentaId ?? padre.codigoCuenta}`
        : `CUENTA:${linea.cuentaId ?? linea.codigoCuenta}`;
      const grupo = grupos.get(key) ?? { padre, lineas: [], total: 0 };
      grupo.lineas.push(linea);
      grupo.total = this.service.roundToTwo(grupo.total + linea.monto);
      grupos.set(key, grupo);
    }
    return [...grupos.values()];
  }

  protected cambiarModoEsf(modo: ModoConsultaEstadoFinanciero): void {
    this.esfModo.set(modo);
    this.esf.set(this.esfVacio());
    this.esfConsultado.set(false);
  }

  /** Descripcion del alcance del ESF actualmente mostrado (no del formulario, que puede estar sin consultar). */
  protected descripcionConsultaEsf(): string {
    if (!this.esfConsultado()) {
      return this.esfModo() === 'RANGO'
        ? 'La apertura se calculará hasta el día anterior. El patrimonio distinguirá asientos registrados y resultado pendiente de cierre.'
        : 'La consulta mostrará los saldos acumulados y separará el patrimonio contabilizado del resultado pendiente de cierre.';
    }
    const resultado = this.esf();
    if (resultado.modo === 'RANGO' && resultado.fechaDesde) {
      return `Saldo inicial anterior al ${resultado.fechaDesde}, movimientos inclusivos hasta el ${resultado.fechaHasta} y saldo final. El resultado calculado no modifica asientos.`;
    }
    return `Saldos acumulados hasta el ${resultado.fechaHasta}. El resultado pendiente de cierre se presenta por separado de las cuentas patrimoniales.`;
  }

  protected async descargarEsfPdf(): Promise<void> {
    this.error.set(null);
    this.descargandoEsfPdf.set(true);
    try {
      this.validarRangoEsf();
      const desde = this.esfPeriodoDesde();
      const blob = await this.pdfApi.descargarEstadoSituacionFinancieraPdf(this.esfFechaCorteValue, desde);
      const nombre = desde
        ? `estado-situacion-financiera-${desde}_${this.esfFechaCorteValue}.pdf`
        : `estado-situacion-financiera-${this.esfFechaCorteValue}.pdf`;
      this.descargarBlob(blob, nombre);
      this.mostrarMensaje('Estado de Situacion Financiera descargado.', 'picture_as_pdf');
    } catch (error) {
      this.error.set(this.mensajeError(error, 'No se pudo descargar el PDF del Estado de Situacion Financiera.'));
    } finally {
      this.descargandoEsfPdf.set(false);
    }
  }

  protected async descargarEriPdf(): Promise<void> {
    this.error.set(null);
    this.descargandoEriPdf.set(true);
    try {
      this.validarRango(this.eriFechaDesdeValue, this.eriFechaHastaValue);
      const blob = await this.pdfApi.descargarEstadoResultadoIntegralPdf(this.eriFechaDesdeValue, this.eriFechaHastaValue);
      this.descargarBlob(blob, `estado-resultado-integral-${this.eriFechaDesdeValue}_${this.eriFechaHastaValue}.pdf`);
      this.mostrarMensaje('Estado de Resultado Integral descargado.', 'picture_as_pdf');
    } catch (error) {
      this.error.set(this.mensajeError(error, 'No se pudo descargar el PDF del Estado de Resultado Integral.'));
    } finally {
      this.descargandoEriPdf.set(false);
    }
  }

  protected etiquetaTipo(tipo: TipoCuenta): string {
    const etiquetas: Record<TipoCuenta, string> = {
      ACTIVO: 'Activo',
      PASIVO: 'Pasivo',
      PATRIMONIO: 'Patrimonio',
      INGRESO: 'Ingreso',
      GASTO: 'Gasto',
      COSTO: 'Costo'
    };
    return etiquetas[tipo];
  }

  protected totalPasivoPatrimonioFinal(): number {
    return this.service.roundToTwo(this.esf().totales.pasivo.saldoFinal + this.esf().totales.patrimonioPresentado.saldoFinal);
  }

  protected totalCostosGastos(): number {
    return this.service.roundToTwo(this.eri().totales.costos + this.eri().totales.gastos);
  }

  protected etiquetaCuadre(diferencia: number): string {
    return diferencia === 0 ? 'Cuadra' : 'Diferencia';
  }

  private limpiarFiltros(filtros: FiltrosReporteContable): FiltrosReporteContable {
    return {
      ...filtros,
      fechaDesde: filtros.fechaDesde?.trim() || undefined,
      fechaHasta: filtros.fechaHasta?.trim() || undefined,
      periodo: filtros.periodo?.trim() || undefined,
      cuentaId: filtros.cuentaId?.trim() || undefined,
      tipoCuenta: filtros.tipoCuenta ?? 'TODOS',
      texto: filtros.texto?.trim() || undefined
    };
  }

  private agruparEsf(
    secciones: EstadoSituacionFinancieraSeccion[],
    grupos: Array<{ nombre: string; secciones: string[] }>
  ): GrupoEsf[] {
    return grupos
      .map((grupo) => {
        const seccionesGrupo = secciones.filter((seccion) => grupo.secciones.includes(seccion.seccion));
        return {
          nombre: grupo.nombre,
          secciones: seccionesGrupo,
          total: {
            saldoInicial: this.service.roundToTwo(seccionesGrupo.reduce((total, seccion) => total + seccion.total.saldoInicial, 0)),
            movimientoPeriodo: this.service.roundToTwo(seccionesGrupo.reduce((total, seccion) => total + seccion.total.movimientoPeriodo, 0)),
            saldoFinal: this.service.roundToTwo(seccionesGrupo.reduce((total, seccion) => total + seccion.total.saldoFinal, 0))
          }
        };
      })
      .filter((grupo) => grupo.secciones.length > 0);
  }

  private agruparEri(
    secciones: EstadoResultadoIntegralSeccion[],
    grupos: Array<{ nombre: string; secciones: string[] }>
  ): GrupoEri[] {
    return grupos
      .map((grupo) => {
        const seccionesGrupo = secciones.filter((seccion) => grupo.secciones.includes(seccion.seccion));
        return {
          nombre: grupo.nombre,
          secciones: seccionesGrupo,
          total: this.service.roundToTwo(seccionesGrupo.reduce((total, seccion) => total + seccion.total, 0))
        };
      })
      .filter((grupo) => grupo.secciones.length > 0);
  }

  private getFechaSignal(reporte: ReporteKey, limite: 'desde' | 'hasta') {
    if (reporte === 'diario') {
      return limite === 'desde' ? this.diarioFechaDesde : this.diarioFechaHasta;
    }
    if (reporte === 'mayor') {
      return limite === 'desde' ? this.mayorFechaDesde : this.mayorFechaHasta;
    }
    if (reporte === 'esf') {
      return limite === 'desde' ? this.esfFechaDesde : this.esfFechaCorte;
    }
    if (reporte === 'eri') {
      return limite === 'desde' ? this.eriFechaDesde : this.eriFechaHasta;
    }
    return limite === 'desde' ? this.balanceFechaDesde : this.balanceFechaHasta;
  }

  private mayorVacio(): LibroMayorResultado {
    return { saldoAnterior: 0, totalDebe: 0, totalHaber: 0, saldoFinal: 0, movimientos: [] };
  }

  private balanceVacio(): BalanceComprobacionResultado {
    return { filas: [], totalDebe: 0, totalHaber: 0, totalSaldoDeudor: 0, totalSaldoAcreedor: 0, diferencia: 0 };
  }

  /** Fecha de inicio a enviar al servicio: solo aplica en modo RANGO. */
  private esfPeriodoDesde(): string | undefined {
    return this.esfModo() === 'RANGO' ? this.esfFechaDesdeValue : undefined;
  }

  private esfVacio(): EstadoSituacionFinancieraResultado {
    const cero = { saldoInicial: 0, movimientoPeriodo: 0, saldoFinal: 0 };
    return {
      tipo: 'ESF',
      fechaDesde: null,
      fechaHasta: this.formatFecha(new Date()),
      modo: 'ACUMULADO',
      secciones: [],
      totales: {
        activo: { ...cero },
        pasivo: { ...cero },
        patrimonioContabilizado: { ...cero },
        resultadoCalculado: { ...cero },
        patrimonioPresentado: { ...cero },
        diferencia: { ...cero }
      }
    };
  }

  private eriVacio(): EstadoResultadoIntegralResultado {
    return {
      tipo: 'ERI',
      fechaDesde: this.formatFecha(this.inicioMes()),
      fechaHasta: this.formatFecha(new Date()),
      secciones: [],
      totales: { ingresos: 0, costos: 0, gastos: 0, resultadoBruto: 0, resultadoOperacional: 0, resultadoNeto: 0 }
    };
  }

  private validarRangoEsf(): void {
    if (!this.esfFechaCorteValue) {
      throw new Error('Selecciona la fecha de corte del Estado de Situacion Financiera.');
    }
    const desde = this.esfPeriodoDesde();
    if (!desde) return;
    this.validarRango(desde, this.esfFechaCorteValue);
    if (desde.slice(0, 4) !== this.esfFechaCorteValue.slice(0, 4)) {
      throw new Error('El rango del Estado de Situacion Financiera debe pertenecer al mismo ejercicio fiscal.');
    }
  }

  private validarRango(desde: string, hasta: string): void {
    if (!desde || !hasta) {
      throw new Error('Selecciona las fechas de inicio y fin del reporte.');
    }
    if (desde > hasta) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha final.');
    }
  }

  private mensajeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  private inicioMes(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private parseFecha(value: string): Date | null {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private formatFecha(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private descargarBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

import { CommonModule } from '@angular/common';
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
import {
  BalanceComprobacionFila,
  BalanceComprobacionResultado,
  CuentaContable,
  EstadoFinancieroSeccion,
  EstadoResultadoIntegralResultado,
  EstadoSituacionFinancieraResultado,
  FiltrosReporteContable,
  LibroDiarioFila,
  LibroMayorResultado,
  TipoCuenta
} from '../../models/contabilidad.models';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { ReportesContablesPdfApiService } from '../../services/reportes-contables-pdf-api.service';
import { ReportesContablesService } from '../../services/reportes-contables.service';

type ReporteKey = 'diario' | 'mayor' | 'balance' | 'esf' | 'eri';
type GrupoEstadoFinanciero = {
  nombre: string;
  total: number;
  secciones: EstadoFinancieroSeccion[];
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
    MatTooltipModule
  ],
  template: `
    <section class="reportes-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad</p>
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

                <mat-form-field appearance="outline">
                  <mat-label>Cuenta</mat-label>
                  <mat-select [(ngModel)]="diarioFiltros.cuentaId">
                    <mat-option value="">Todas</mat-option>
                    @for (cuenta of cuentasMovimiento(); track cuenta.id) {
                      <mat-option [value]="cuenta.id">{{ cuenta.codigo }} - {{ cuenta.nombre }}</mat-option>
                    }
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.cuenta" aria-label="Ayuda cuenta diario">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

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

                <mat-form-field appearance="outline">
                  <mat-label>Cuenta</mat-label>
                  <mat-select [(ngModel)]="mayorFiltros.cuentaId">
                    <mat-option value="">Por grupo/tipo</mat-option>
                    @for (cuenta of cuentasMovimiento(); track cuenta.id) {
                      <mat-option [value]="cuenta.id">{{ cuenta.codigo }} - {{ cuenta.nombre }}</mat-option>
                    }
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.cuentaMayor" aria-label="Ayuda cuenta mayor">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

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
                    Presenta activos, pasivos y patrimonio a una fecha de corte.
                    <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.esf" aria-label="Ayuda ESF">
                      <mat-icon>help_outline</mat-icon>
                    </button>
                  </p>
                </div>

                <div class="filters-grid compact">
                  <mat-form-field appearance="outline">
                    <mat-label>Fecha de corte</mat-label>
                    <input matInput [matDatepicker]="esfCortePicker" [ngModel]="esfFechaCorte()" (ngModelChange)="actualizarFecha('esf', 'hasta', $event)" />
                    <mat-datepicker-toggle matIconSuffix [for]="esfCortePicker"></mat-datepicker-toggle>
                    <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaReportes.fechaCorte" aria-label="Ayuda fecha corte ESF">
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
                    <button mat-stroked-button type="button" (click)="descargarEsfPdf()" [disabled]="descargandoEsfPdf()">
                      <mat-icon>picture_as_pdf</mat-icon>
                      Descargar PDF
                    </button>
                  </div>
                </div>

                <div class="summary-row" [class.diff-error]="esf().diferencia !== 0">
                  <span>Total activo: <strong>{{ esf().totalActivo | number:'1.2-2' }}</strong></span>
                  <span>Total pasivo: <strong>{{ esf().totalPasivo | number:'1.2-2' }}</strong></span>
                  <span>Total patrimonio: <strong>{{ esf().totalPatrimonio | number:'1.2-2' }}</strong></span>
                  <span>Resultado ejercicio: <strong>{{ esf().resultadoEjercicio | number:'1.2-2' }}</strong></span>
                  <span>Diferencia: <strong>{{ esf().diferencia | number:'1.2-2' }}</strong></span>
                </div>

                <div class="financial-sections">
                  @for (grupo of gruposEsf(); track grupo.nombre) {
                    <section class="financial-group">
                      <header>
                        <h4>{{ grupo.nombre }}</h4>
                        <strong>{{ grupo.total | number:'1.2-2' }}</strong>
                      </header>
                      @for (seccion of grupo.secciones; track seccion.seccion) {
                        <section class="financial-section">
                          <header>
                            <h5>{{ seccion.nombre }}</h5>
                            <strong>{{ seccion.total | number:'1.2-2' }}</strong>
                          </header>
                          @for (linea of seccion.lineas; track linea.cuentaId ?? linea.codigoCuenta) {
                            <div class="financial-line" [class.calculated-line]="linea.esCalculada">
                              <span>{{ linea.codigoCuenta }} - {{ linea.nombreCuenta }}</span>
                              <strong>{{ linea.monto | number:'1.2-2' }}</strong>
                            </div>
                          }
                        </section>
                      }
                    </section>
                  }
                </div>
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
                    <button mat-stroked-button type="button" (click)="descargarEriPdf()" [disabled]="descargandoEriPdf()">
                      <mat-icon>picture_as_pdf</mat-icon>
                      Descargar PDF
                    </button>
                  </div>
                </div>

                <div class="summary-row">
                  <span>Ingresos: <strong>{{ eri().totalIngresos | number:'1.2-2' }}</strong></span>
                  <span>Costos: <strong>{{ eri().totalCostos | number:'1.2-2' }}</strong></span>
                  <span>Gastos: <strong>{{ eri().totalGastos | number:'1.2-2' }}</strong></span>
                  <span>Resultado neto: <strong>{{ eri().resultadoNeto | number:'1.2-2' }}</strong></span>
                </div>

                <div class="financial-sections">
                  @for (grupo of gruposEri(); track grupo.nombre) {
                    <section class="financial-group">
                      <header>
                        <h4>{{ grupo.nombre }}</h4>
                        <strong>{{ grupo.total | number:'1.2-2' }}</strong>
                      </header>
                      @for (seccion of grupo.secciones; track seccion.seccion) {
                        <section class="financial-section">
                          <header>
                            <h5>{{ seccion.nombre }}</h5>
                            <strong>{{ seccion.total | number:'1.2-2' }}</strong>
                          </header>
                          @for (linea of seccion.lineas; track linea.cuentaId ?? linea.codigoCuenta) {
                            <div class="financial-line">
                              <span>{{ linea.codigoCuenta }} - {{ linea.nombreCuenta }}</span>
                              <strong>{{ linea.monto | number:'1.2-2' }}</strong>
                            </div>
                          }
                        </section>
                      }
                    </section>
                  }
                </div>
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
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .tabs-card { padding: 0; overflow: hidden; background: var(--tc-surface-container-lowest); }
    .tab-panel { display: grid; gap: 1rem; padding: 1.25rem; }
    .report-help { display: flex; align-items: center; gap: .55rem; padding: .75rem .9rem; border-radius: .5rem; background: var(--tc-surface-container); color: var(--muted-foreground); }
    .report-help mat-icon { color: var(--primary); }
    .filters-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; align-items: start; }
    .filters-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; }
    .span-2 { grid-column: span 2; }
    .actions-row, .summary-row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; align-items: center; }
    .inline-actions { justify-content: flex-start; }
    .summary-row { justify-content: flex-start; padding: .75rem 1rem; border-radius: .5rem; background: var(--tc-surface-container); }
    .summary-row span { color: var(--muted-foreground); }
    .summary-row strong { color: var(--foreground); }
    .warning-box, .error-box { display: flex; align-items: center; gap: .6rem; padding: .8rem 1rem; border-radius: .5rem; }
    .warning-box { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #7a4b00; }
    .error-box, .diff-error { color: #b3261e; }
    .error-box { background: color-mix(in srgb, #b3261e 12%, transparent); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1080px; }
    .financial-block { display: grid; gap: 1rem; padding: 1rem; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .5rem; }
    .financial-block h3, .financial-block p, .financial-group h4, .financial-section h5 { margin: 0; }
    .financial-block p { color: var(--muted-foreground); }
    .financial-block p { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
    .financial-sections { display: grid; gap: .75rem; }
    .financial-group { display: grid; gap: .65rem; padding: .9rem; border: 1px solid color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .5rem; }
    .financial-group > header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding-bottom: .65rem; border-bottom: 2px solid color-mix(in srgb, var(--foreground) 65%, transparent); }
    .financial-group > header h4, .financial-group > header strong { font-weight: 800; color: var(--foreground); }
    .financial-group > header strong { text-align: right; font-variant-numeric: tabular-nums; }
    .financial-section { display: grid; gap: .45rem; padding: .85rem; border-radius: .5rem; background: var(--tc-surface-container); }
    .financial-section header, .financial-line { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    .financial-section header { padding-bottom: .4rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); }
    .financial-section header h5, .financial-section header strong { font-weight: 700; color: var(--foreground); }
    .financial-section header strong { text-align: right; font-variant-numeric: tabular-nums; }
    .financial-line { color: var(--muted-foreground); }
    .financial-line strong { color: var(--foreground); font-variant-numeric: tabular-nums; }
    .calculated-line { color: var(--primary); }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 1100px) {
      .filters-grid, .filters-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .span-2 { grid-column: auto; }
    }
    @media (max-width: 720px) {
      .filters-grid, .filters-grid.compact { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
      .financial-group > header, .financial-section header, .financial-line { align-items: flex-start; flex-direction: column; }
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
  protected readonly columnasMayor = ['fecha', 'numero', 'cuenta', 'concepto', 'debe', 'haber', 'saldo'];
  protected readonly columnasBalance = ['codigoCuenta', 'nombreCuenta', 'tipo', 'totalDebe', 'totalHaber', 'saldoDeudor', 'saldoAcreedor'];
  protected readonly ayudaReportes = {
    submodulo: 'Reportes calculados desde asientos aprobados y reversados. Los borradores no afectan saldos ni estados financieros.',
    diario: 'Libro cronologico de asientos y lineas contables. Sirve para auditar que se registro, cuando y contra que cuenta.',
    mayor: 'Movimiento detallado por cuenta o grupo, con saldo anterior, debitos, creditos y saldo final.',
    balance: 'Resumen por cuenta para comprobar que el total debe coincide con el total haber en el rango consultado.',
    esf: 'Foto financiera a una fecha: activos, pasivos, patrimonio y resultado del ejercicio calculado dinamicamente.',
    eri: 'Resultado del periodo: ingresos menos costos y gastos. No usa saldos acumulados, usa movimientos del rango.',
    fechaDesde: 'Inicio del rango de movimientos a consultar. Incluye asientos desde esta fecha.',
    fechaHasta: 'Fin del rango de movimientos a consultar. Incluye asientos hasta esta fecha.',
    periodo: 'Filtro mensual con formato YYYY-MM. Uselo cuando quiera revisar un periodo contable especifico.',
    cuenta: 'Filtra el reporte por una cuenta de movimiento para revisar registros relacionados.',
    texto: 'Busca por detalle, numero de asiento, referencia o cuenta dentro del libro diario.',
    cuentaMayor: 'Seleccione una cuenta para ver su mayor individual. Si queda vacio se usa el grupo/tipo.',
    grupoMayor: 'Permite consultar mayores por tipo de cuenta cuando no se elige una cuenta especifica.',
    tipoBalance: 'Limita el balance de comprobacion a activos, pasivos, patrimonio, ingresos, costos o gastos.',
    fechaCorte: 'Fecha hasta la que se acumulan saldos del Estado de Situacion Financiera.',
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

  protected readonly diarioFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly diarioFechaHasta = signal<Date | null>(new Date());
  protected readonly mayorFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly mayorFechaHasta = signal<Date | null>(new Date());
  protected readonly balanceFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly balanceFechaHasta = signal<Date | null>(new Date());
  protected readonly esfFechaCorte = signal<Date | null>(new Date());
  protected readonly eriFechaDesde = signal<Date | null>(this.inicioMes());
  protected readonly eriFechaHasta = signal<Date | null>(new Date());

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
    this.cargandoEsf.set(true);
    try {
      this.esf.set(await this.service.generarEstadoSituacionFinanciera(this.esfFechaCorteValue));
    } catch {
      this.error.set('No se pudo generar el Estado de Situacion Financiera.');
    } finally {
      this.cargandoEsf.set(false);
    }
  }

  protected async consultarEri(): Promise<void> {
    this.error.set(null);
    this.cargandoEri.set(true);
    try {
      this.eri.set(await this.service.generarEstadoResultadoIntegral(this.eriFechaDesdeValue, this.eriFechaHastaValue));
    } catch {
      this.error.set('No se pudo generar el Estado de Resultado Integral.');
    } finally {
      this.cargandoEri.set(false);
    }
  }

  protected actualizarFecha(reporte: ReporteKey, limite: 'desde' | 'hasta', value: Date | string | null): void {
    const fecha = value instanceof Date ? value : value ? this.parseFecha(value) : null;
    const formatted = fecha ? this.formatFecha(fecha) : '';
    const signalTarget = this.getFechaSignal(reporte, limite);

    if (reporte === 'esf') {
      this.esfFechaCorteValue = formatted;
      signalTarget.set(fecha);
      return;
    }

    if (reporte === 'eri') {
      if (limite === 'desde') {
        this.eriFechaDesdeValue = formatted;
      } else {
        this.eriFechaHastaValue = formatted;
      }
      signalTarget.set(fecha);
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
    this.service.exportarCsv('estado-situacion-financiera.csv', this.esf().secciones.flatMap((seccion) => [
      { seccion: seccion.nombre, codigoCuenta: '', cuenta: 'TOTAL', monto: seccion.total },
      ...seccion.lineas.map((linea) => ({
        seccion: seccion.nombre,
        codigoCuenta: linea.codigoCuenta,
        cuenta: linea.nombreCuenta,
        monto: linea.monto
      }))
    ]));
    this.mostrarMensaje('Estado de Situacion Financiera exportado.', 'download');
  }

  protected exportarEri(): void {
    this.service.exportarCsv('estado-resultado-integral.csv', this.eri().secciones.flatMap((seccion) => [
      { seccion: seccion.nombre, codigoCuenta: '', cuenta: 'TOTAL', monto: seccion.total },
      ...seccion.lineas.map((linea) => ({
        seccion: seccion.nombre,
        codigoCuenta: linea.codigoCuenta,
        cuenta: linea.nombreCuenta,
        monto: linea.monto
      }))
    ]));
    this.mostrarMensaje('Estado de Resultado Integral exportado.', 'download');
  }

  protected gruposEsf(): GrupoEstadoFinanciero[] {
    return this.agruparEstadoFinanciero(this.esf().secciones, [
      { nombre: 'Activo', secciones: ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE'] },
      { nombre: 'Pasivo', secciones: ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'] },
      { nombre: 'Patrimonio', secciones: ['PATRIMONIO'] }
    ]);
  }

  protected gruposEri(): GrupoEstadoFinanciero[] {
    return this.agruparEstadoFinanciero(this.eri().secciones, [
      { nombre: 'Ingresos', secciones: ['INGRESOS_OPERACIONALES', 'OTROS_INGRESOS'] },
      { nombre: 'Costos', secciones: ['COSTOS'] },
      { nombre: 'Gastos', secciones: ['GASTOS_ADMINISTRATIVOS', 'GASTOS_VENTAS', 'GASTOS_FINANCIEROS', 'OTROS_GASTOS'] }
    ]);
  }

  protected async descargarEsfPdf(): Promise<void> {
    this.error.set(null);
    this.descargandoEsfPdf.set(true);
    try {
      const blob = await this.pdfApi.descargarEstadoSituacionFinancieraPdf(this.esfFechaCorteValue);
      this.descargarBlob(blob, `estado-situacion-financiera-${this.esfFechaCorteValue}.pdf`);
      this.mostrarMensaje('Estado de Situacion Financiera descargado.', 'picture_as_pdf');
    } catch {
      this.error.set('No se pudo descargar el PDF del Estado de Situacion Financiera.');
    } finally {
      this.descargandoEsfPdf.set(false);
    }
  }

  protected async descargarEriPdf(): Promise<void> {
    this.error.set(null);
    this.descargandoEriPdf.set(true);
    try {
      const blob = await this.pdfApi.descargarEstadoResultadoIntegralPdf(this.eriFechaDesdeValue, this.eriFechaHastaValue);
      this.descargarBlob(blob, `estado-resultado-integral-${this.eriFechaDesdeValue}_${this.eriFechaHastaValue}.pdf`);
      this.mostrarMensaje('Estado de Resultado Integral descargado.', 'picture_as_pdf');
    } catch {
      this.error.set('No se pudo descargar el PDF del Estado de Resultado Integral.');
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

  private agruparEstadoFinanciero(
    secciones: EstadoFinancieroSeccion[],
    grupos: Array<{ nombre: string; secciones: string[] }>
  ): GrupoEstadoFinanciero[] {
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
      return this.esfFechaCorte;
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

  private esfVacio(): EstadoSituacionFinancieraResultado {
    return { fechaCorte: this.formatFecha(new Date()), secciones: [], totalActivo: 0, totalPasivo: 0, totalPatrimonio: 0, resultadoEjercicio: 0, diferencia: 0 };
  }

  private eriVacio(): EstadoResultadoIntegralResultado {
    return { fechaDesde: this.formatFecha(this.inicioMes()), fechaHasta: this.formatFecha(new Date()), secciones: [], totalIngresos: 0, totalCostos: 0, totalGastos: 0, resultadoBruto: 0, resultadoOperacional: 0, resultadoNeto: 0 };
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

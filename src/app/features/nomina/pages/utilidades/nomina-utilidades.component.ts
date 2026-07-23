import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { RepartoUtilidades } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

/**
 * Reparto del 15% de utilidades. Siempre se calcula y se revisa antes de generar el rol: es un
 * pago anual sobre el que el contador necesita ver el criterio de reparto empleado por empleado.
 */
@Component({
  selector: 'app-nomina-utilidades',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule
  ],
  template: `
    <section class="utilidades-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina</p>
          <h2>Utilidades</h2>
          <p>
            El 10% se reparte por tiempo trabajado y el 5% por cargas familiares. Lo que exceda
            24 salarios basicos por trabajador no se paga: se transfiere al IESS.
          </p>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card generator-card">
        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Ejercicio</mat-label>
            <input matInput type="number" min="2000" max="2100" [(ngModel)]="anio" name="anio" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Utilidad del ejercicio</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="utilidadBase" name="utilidad" />
            <mat-hint>Utilidad contable antes de participacion</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de pago</mat-label>
            <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" />
            <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
            <mat-datepicker #pickerPago></mat-datepicker>
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="calcular()" [disabled]="procesando()">
            <mat-icon>calculate</mat-icon>
            Calcular reparto
          </button>
        </div>
      </section>

      @if (reparto(); as datos) {
        <section class="kpi-row">
          <article class="surface-card kpi-card">
            <span>10% por tiempo</span>
            <strong>{{ datos.monto10 | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
            <small>{{ datos.totalDias }} dias trabajados en total</small>
          </article>
          <article class="surface-card kpi-card">
            <span>5% por cargas</span>
            <strong>{{ datos.monto5 | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
          </article>
          <article class="surface-card kpi-card highlight">
            <span>Total a repartir</span>
            <strong>{{ datos.totalRepartido | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
          </article>
          <article class="surface-card kpi-card">
            <span>Excedente al IESS</span>
            <strong>{{ datos.totalExcedente | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
            <small>
              @if (datos.techoPorEmpleado > 0) {
                Techo {{ datos.techoPorEmpleado | currency:'USD':'symbol-narrow':'1.2-2' }} por trabajador
              } @else {
                Sin techo: falta el salario basico en configuracion
              }
            </small>
          </article>
        </section>

        <section class="surface-card table-card">
          <div class="table-wrap">
            <table mat-table [dataSource]="datos.empleados">
              <ng-container matColumnDef="empleado">
                <th mat-header-cell *matHeaderCellDef>Empleado</th>
                <td mat-cell *matCellDef="let row">{{ row.empleadoNombre }}</td>
              </ng-container>

              <ng-container matColumnDef="dias">
                <th mat-header-cell *matHeaderCellDef class="num">Dias</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.diasTrabajados }}</td>
              </ng-container>

              <ng-container matColumnDef="cargas">
                <th mat-header-cell *matHeaderCellDef class="num">Cargas</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.cargasFamiliares }}</td>
              </ng-container>

              <ng-container matColumnDef="porTiempo">
                <th mat-header-cell *matHeaderCellDef class="num">10% tiempo</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.porTiempo | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="porCargas">
                <th mat-header-cell *matHeaderCellDef class="num">5% cargas</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.porCargas | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="excedente">
                <th mat-header-cell *matHeaderCellDef class="num">Excedente</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.excedente | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="num">A pagar</th>
                <td mat-cell *matCellDef="let row" class="num"><strong>{{ row.total | number:'1.2-2' }}</strong></td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>

          <footer class="actions-row">
            <button mat-raised-button color="primary" type="button" (click)="generar()" [disabled]="procesando()">
              <mat-icon>payments</mat-icon>
              Generar rol de utilidades
            </button>
          </footer>
        </section>
      }
    </section>
  `,
  styles: [`
    .utilidades-page { display: grid; gap: 1rem; }
    .page-header, .generator-card, .table-card, .kpi-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, p { margin: 0; }
    .page-header p { margin-top: .35rem; color: var(--muted-foreground); max-width: 80ch; }
    .grid-4 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: .75rem; align-items: start; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { display: grid; gap: .25rem; border-radius: var(--tc-radius-lg); }
    .kpi-card span { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 1.5rem; }
    .kpi-card small { color: var(--muted-foreground); }
    .kpi-card.highlight { outline: 2px solid color-mix(in srgb, var(--primary) 40%, transparent); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 820px; }
    .num { text-align: right; }
    .actions-row { display: flex; justify-content: flex-end; padding-top: 1rem; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 1100px) {
      .grid-4, .kpi-row { grid-template-columns: 1fr; }
    }
  `]
})
export class NominaUtilidadesComponent {
  private readonly nominaService = inject(NominaService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['empleado', 'dias', 'cargas', 'porTiempo', 'porCargas', 'excedente', 'total'];
  protected readonly reparto = signal<RepartoUtilidades | null>(null);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected anio = String(new Date().getFullYear() - 1);
  protected utilidadBase = 0;
  protected fechaPagoDate: Date | null = new Date();

  protected async calcular(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      this.reparto.set(await this.nominaService.calcularRepartoUtilidades(this.anio, Number(this.utilidadBase)));
    } catch (error) {
      this.reparto.set(null);
      this.error.set(error instanceof Error ? error.message : 'No se pudo calcular el reparto.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected async generar(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      const rolId = await this.nominaService.generarRolUtilidades(
        this.anio,
        Number(this.utilidadBase),
        dateAIso(this.fechaPagoDate)
      );
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Rol de utilidades generado en borrador.', icon: 'payments' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      await this.router.navigate(['/workspace/contabilidad/nomina/roles', rolId]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo generar el rol de utilidades.');
    } finally {
      this.procesando.set(false);
    }
  }
}

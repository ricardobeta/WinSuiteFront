import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { LiquidacionEmpleado, MotivoSalidaNomina } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

/**
 * Finiquito de un empleado. Se calcula y se revisa antes de generarlo porque al confirmarlo el
 * empleado queda inactivo y deja de entrar en los roles mensuales.
 */
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
    MatSnackBarModule
  ],
  template: `
    <section class="liquidacion-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina - Liquidacion</p>
          <h2>{{ liquidacion()?.empleadoNombre || 'Liquidacion de haberes' }}</h2>
          <p>Liquida lo devengado y no pagado, mas las indemnizaciones que correspondan al motivo de salida.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/nomina/empleados">
          <mat-icon>arrow_back</mat-icon>
          Volver
        </a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card generator-card">
        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Fecha de salida</mat-label>
            <input matInput [matDatepicker]="pickerSalida" [(ngModel)]="fechaSalidaDate" name="fechaSalida" />
            <mat-datepicker-toggle matSuffix [for]="pickerSalida"></mat-datepicker-toggle>
            <mat-datepicker #pickerSalida></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Motivo de salida</mat-label>
            <mat-select [(ngModel)]="motivo" name="motivo">
              <mat-option value="RENUNCIA">Renuncia voluntaria</mat-option>
              <mat-option value="DESPIDO_INTEMPESTIVO">Despido intempestivo</mat-option>
              <mat-option value="DESAHUCIO">Desahucio</mat-option>
              <mat-option value="MUTUO_ACUERDO">Mutuo acuerdo</mat-option>
              <mat-option value="FIN_CONTRATO">Fin de contrato</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de pago</mat-label>
            <input matInput [matDatepicker]="pickerPago" [(ngModel)]="fechaPagoDate" name="fechaPago" />
            <mat-datepicker-toggle matSuffix [for]="pickerPago"></mat-datepicker-toggle>
            <mat-datepicker #pickerPago></mat-datepicker>
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="calcular()" [disabled]="procesando()">
            <mat-icon>calculate</mat-icon>
            Calcular finiquito
          </button>
        </div>
      </section>

      @if (liquidacion(); as datos) {
        <section class="surface-card resumen-card">
          <div class="datos-row">
            <div><span>Ingreso</span><strong>{{ datos.fechaIngreso }}</strong></div>
            <div><span>Salida</span><strong>{{ datos.fechaSalida }}</strong></div>
            <div><span>Años de servicio</span><strong>{{ datos.aniosServicio }}</strong></div>
            <div><span>Ultima remuneracion</span><strong>{{ datos.ultimaRemuneracion | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
          </div>

          @if (datos.rubros.length === 0) {
            <p class="muted">No hay valores pendientes de liquidar para este empleado.</p>
          } @else {
            <table class="rubros">
              <tbody>
                @for (rubro of datos.rubros; track rubro.codigo) {
                  <tr>
                    <td>{{ rubro.nombre }}</td>
                    <td class="detalle">{{ rubro.detalle }}</td>
                    <td class="num">{{ rubro.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                  </tr>
                }
                <tr class="total">
                  <td colspan="2">Neto a pagar</td>
                  <td class="num">{{ datos.netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>

            <footer class="actions-row">
              <button mat-raised-button color="primary" type="button" (click)="generar()" [disabled]="procesando()">
                <mat-icon>assignment_turned_in</mat-icon>
                Generar rol de liquidacion
              </button>
            </footer>
          }
        </section>
      }
    </section>
  `,
  styles: [`
    .liquidacion-page { display: grid; gap: 1rem; }
    .page-header, .generator-card, .resumen-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, p { margin: 0; }
    .page-header p, .muted, .detalle { color: var(--muted-foreground); }
    .grid-4 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: .75rem; align-items: start; }
    .resumen-card { display: grid; gap: 1rem; }
    .datos-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .datos-row div { display: grid; gap: .2rem; }
    .datos-row span { color: var(--muted-foreground); font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; }
    table.rubros { width: 100%; border-collapse: collapse; }
    table.rubros td { padding: .5rem .4rem; border-bottom: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); }
    table.rubros tr.total td { font-weight: 700; font-size: 1.05rem; border-bottom: none; }
    .detalle { font-size: .85rem; }
    .num { text-align: right; }
    .actions-row { display: flex; justify-content: flex-end; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 1100px) {
      .grid-4, .datos-row { grid-template-columns: 1fr; }
    }
  `]
})
export class NominaLiquidacionComponent implements OnInit {
  private readonly nominaService = inject(NominaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly liquidacion = signal<LiquidacionEmpleado | null>(null);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fechaSalidaDate: Date | null = new Date();
  protected fechaPagoDate: Date | null = new Date();
  protected motivo: MotivoSalidaNomina = 'RENUNCIA';

  private empleadoId = '';

  ngOnInit(): void {
    this.empleadoId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.calcular();
  }

  protected async calcular(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      this.liquidacion.set(await this.nominaService.calcularLiquidacion(
        this.empleadoId,
        dateAIso(this.fechaSalidaDate),
        this.motivo
      ));
    } catch (error) {
      this.liquidacion.set(null);
      this.error.set(error instanceof Error ? error.message : 'No se pudo calcular la liquidacion.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected generar(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: 'Generar liquidacion',
        message: 'Se generara el rol de finiquito y el empleado quedara inactivo, por lo que dejara de entrar en los roles mensuales. Continuar?',
        confirmText: 'Generar'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.error.set(null);
      this.procesando.set(true);
      try {
        const rolId = await this.nominaService.generarRolLiquidacion(
          this.empleadoId,
          dateAIso(this.fechaSalidaDate),
          this.motivo,
          dateAIso(this.fechaPagoDate)
        );
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: 'Liquidacion generada en borrador.', icon: 'assignment_turned_in' },
          duration: 2600,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        await this.router.navigate(['/workspace/contabilidad/nomina/roles', rolId]);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo generar la liquidacion.');
      } finally {
        this.procesando.set(false);
      }
    });
  }
}

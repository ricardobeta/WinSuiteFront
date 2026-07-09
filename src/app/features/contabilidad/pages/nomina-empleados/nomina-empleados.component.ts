import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import { EmpleadoNomina } from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';

@Component({
  selector: 'app-nomina-empleados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule
  ],
  template: `
    <section class="empleados-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad - Nomina</p>
          <h2>Empleados</h2>
          <p>Administra empleados activos para generar roles de pago mensuales.</p>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card form-card">
        <h3>{{ form.id ? 'Editar empleado' : 'Nuevo empleado' }}</h3>
        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Cedula</mat-label>
            <input matInput maxlength="10" inputmode="numeric" [(ngModel)]="form.cedula" name="cedula" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Nombres</mat-label>
            <input matInput [(ngModel)]="form.nombres" name="nombres" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Apellidos</mat-label>
            <input matInput [(ngModel)]="form.apellidos" name="apellidos" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select [(ngModel)]="form.estado" name="estado">
              <mat-option value="ACTIVO">Activo</mat-option>
              <mat-option value="INACTIVO">Inactivo</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Cargo</mat-label>
            <input matInput [(ngModel)]="form.cargo" name="cargo" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Departamento</mat-label>
            <input matInput [(ngModel)]="form.departamento" name="departamento" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Fecha ingreso</mat-label>
            <input matInput [matDatepicker]="pickerIngreso" [ngModel]="fechaIngresoDate" (ngModelChange)="onFechaIngresoChange($event)" name="fechaIngreso" />
            <mat-datepicker-toggle matSuffix [for]="pickerIngreso"></mat-datepicker-toggle>
            <mat-datepicker #pickerIngreso></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sueldo base</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.sueldoBase" name="sueldoBase" />
          </mat-form-field>
        </div>

        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="form.email" name="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Telefono</mat-label>
            <input matInput [(ngModel)]="form.telefono" name="telefono" />
          </mat-form-field>
        </div>

        <footer class="actions-row">
          <button mat-button type="button" (click)="limpiar()">
            <mat-icon>backspace</mat-icon>
            Limpiar
          </button>
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="guardando()">
            <mat-icon>save</mat-icon>
            Guardar empleado
          </button>
        </footer>
      </section>

      <section class="surface-card table-card">
        <div class="section-head">
          <div>
            <h3>Nomina activa</h3>
            <p>{{ empleadosActivos().length }} empleados activos de {{ empleados().length }} registrados.</p>
          </div>
        </div>

        @if (empleados().length === 0) {
          <div class="empty-state">
            <mat-icon>badge</mat-icon>
            <h3>Sin empleados</h3>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="empleados()">
              <ng-container matColumnDef="empleado">
                <th mat-header-cell *matHeaderCellDef>Empleado</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.apellidos }} {{ row.nombres }}</strong>
                  <span class="muted">{{ row.cedula }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="cargo">
                <th mat-header-cell *matHeaderCellDef>Cargo</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.cargo }}</strong>
                  <span class="muted">{{ row.departamento || 'Sin departamento' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="ingreso">
                <th mat-header-cell *matHeaderCellDef>Ingreso</th>
                <td mat-cell *matCellDef="let row">{{ row.fechaIngreso ? (row.fechaIngreso | date: 'dd/MM/yyyy') : '' }}</td>
              </ng-container>

              <ng-container matColumnDef="sueldo">
                <th mat-header-cell *matHeaderCellDef class="num">Sueldo</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.sueldoBase | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class.off]="row.estado === 'INACTIVO'">{{ row.estado }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-button type="button" (click)="editar(row)">Editar</button>
                  <button mat-button type="button" (click)="cambiarEstado(row)">
                    {{ row.estado === 'ACTIVO' ? 'Inactivar' : 'Activar' }}
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .empleados-page { display: grid; gap: 1rem; }
    .page-header, .form-card, .table-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p, .section-head p, .muted { color: var(--muted-foreground); }
    .form-card { display: grid; gap: .9rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .actions-row, .section-head { display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .actions-row { justify-content: flex-end; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 860px; }
    td strong, td .muted { display: block; }
    .num { text-align: right; }
    .pill { display: inline-flex; padding: .25rem .65rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 16%, transparent); font-weight: 700; }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .empty-state { min-height: 160px; display: grid; place-items: center; align-content: center; color: var(--muted-foreground); }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-4, .grid-2 { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class NominaEmpleadosComponent {
  private readonly nominaService = inject(NominaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['empleado', 'cargo', 'ingreso', 'sueldo', 'estado', 'acciones'];
  protected readonly empleados = signal<EmpleadoNomina[]>([]);
  protected readonly empleadosActivos = computed(() => this.empleados().filter((empleado) => empleado.estado === 'ACTIVO'));
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form: EmpleadoNomina = this.nuevoEmpleado();

  /** Adaptador Date↔ISO para el datepicker (el modelo guarda `fechaIngreso` como string ISO). */
  protected fechaIngresoDate: Date | null = new Date();

  constructor() {
    this.nominaService
      .getEmpleados()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((empleados) => this.empleados.set(empleados));
  }

  protected editar(empleado: EmpleadoNomina): void {
    Object.assign(this.form, empleado);
    this.fechaIngresoDate = this.parseFechaLocal(empleado.fechaIngreso);
  }

  protected limpiar(): void {
    Object.assign(this.form, this.nuevoEmpleado());
    this.fechaIngresoDate = this.parseFechaLocal(this.form.fechaIngreso);
  }

  protected async guardar(): Promise<void> {
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.nominaService.guardarEmpleado({ ...this.form });
      this.toast('Empleado guardado.', 'save');
      this.limpiar();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el empleado.');
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cambiarEstado(empleado: EmpleadoNomina): Promise<void> {
    if (!empleado.id) {
      return;
    }
    await this.nominaService.cambiarEstadoEmpleado(empleado.id, empleado.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO');
    this.toast('Estado de empleado actualizado.', 'toggle_on');
  }

  private nuevoEmpleado(): EmpleadoNomina {
    return {
      cedula: '',
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      cargo: '',
      departamento: '',
      fechaIngreso: new Date().toISOString().slice(0, 10),
      sueldoBase: 0,
      estado: 'ACTIVO'
    };
  }

  protected onFechaIngresoChange(value: Date | null): void {
    this.fechaIngresoDate = value;
    this.form.fechaIngreso = dateAIso(value);
  }

  private parseFechaLocal(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
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

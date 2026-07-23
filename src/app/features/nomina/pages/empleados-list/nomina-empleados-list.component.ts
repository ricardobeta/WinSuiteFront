import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { EmpleadoNomina } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

@Component({
  selector: 'app-nomina-empleados-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="empleados-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina</p>
          <h2>Empleados</h2>
          <p>Consulta empleados activos e inactivos usados para generar roles de pago.</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workspace/contabilidad/nomina/empleados/nuevo">
          <mat-icon>person_add</mat-icon>
          Nuevo empleado
        </a>
      </header>

      <section class="kpi-row">
        <article class="surface-card kpi-card">
          <span>Activos</span>
          <strong>{{ empleadosActivos().length }}</strong>
        </article>
        <article class="surface-card kpi-card">
          <span>Total registrados</span>
          <strong>{{ empleados().length }}</strong>
        </article>
      </section>

      <section class="surface-card table-card">
        @if (empleados().length === 0) {
          <div class="empty-state">
            <mat-icon>badge</mat-icon>
            <h3>Sin empleados</h3>
            <p>Crea el primer empleado para generar roles de pago.</p>
          </div>
        } @else {
          <app-data-table-frame
            searchPlaceholder="Buscar empleado, cargo o identificación"
            [total]="empleadosFiltrados().length"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            (searchChange)="actualizarBusqueda($event)"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="empleadosPaginados()">
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
                <td mat-cell *matCellDef="let row">{{ row.fechaIngreso }}</td>
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
                  @if (row.estado === 'ACTIVO') {
                    <button mat-button type="button" (click)="liquidar(row)">Liquidar</button>
                  }
                  <button mat-button type="button" (click)="cambiarEstado(row)">
                    {{ row.estado === 'ACTIVO' ? 'Inactivar' : 'Activar' }}
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </app-data-table-frame>
        }
      </section>
    </section>
  `,
  styles: [`
    .empleados-page { display: grid; gap: 1rem; }
    .page-header, .table-card, .kpi-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p, .muted, .empty-state p { color: var(--muted-foreground); }
    .kpi-row { display: grid; grid-template-columns: repeat(2, minmax(0, 220px)); gap: 1rem; }
    .kpi-card { display: grid; gap: .25rem; }
    .kpi-card span { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 1.6rem; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 860px; }
    td strong, td .muted { display: block; }
    .num { text-align: right; }
    .pill { display: inline-flex; padding: .25rem .65rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 16%, transparent); font-weight: 700; }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .empty-state { min-height: 190px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
  `]
})
export class NominaEmpleadosListComponent {
  private readonly nominaService = inject(NominaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['empleado', 'cargo', 'ingreso', 'sueldo', 'estado', 'acciones'];
  protected readonly empleados = signal<EmpleadoNomina[]>([]);
  protected readonly empleadosActivos = computed(() => this.empleados().filter((empleado) => empleado.estado === 'ACTIVO'));
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly empleadosFiltrados = computed(() => {
    const query = this.normalizar(this.busqueda());
    if (!query) return this.empleados();
    return this.empleados().filter((empleado) => this.normalizar(JSON.stringify(empleado)).includes(query));
  });
  protected readonly empleadosPaginados = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.empleadosFiltrados().slice(start, start + this.pageSize());
  });

  protected actualizarBusqueda(value: string): void {
    this.busqueda.set(value);
    this.pageIndex.set(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  private normalizar(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  constructor() {
    this.nominaService
      .getEmpleados()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((empleados) => this.empleados.set(empleados));
  }

  protected editar(empleado: EmpleadoNomina): void {
    if (empleado.id) {
      void this.router.navigate(['/workspace/contabilidad/nomina/empleados', empleado.id, 'editar']);
    }
  }

  protected liquidar(empleado: EmpleadoNomina): void {
    if (empleado.id) {
      void this.router.navigate(['/workspace/contabilidad/nomina/empleados', empleado.id, 'liquidar']);
    }
  }

  protected async cambiarEstado(empleado: EmpleadoNomina): Promise<void> {
    if (!empleado.id) {
      return;
    }
    await this.nominaService.cambiarEstadoEmpleado(empleado.id, empleado.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO');
    this.toast('Estado de empleado actualizado.', 'toggle_on');
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

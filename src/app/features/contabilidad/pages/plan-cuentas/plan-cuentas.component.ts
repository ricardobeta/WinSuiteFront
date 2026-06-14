import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContable, EstadoCuentaContable, TipoCuenta } from '../../models/contabilidad.models';
import { PLANTILLA_ESF_CONSTRUCTORA, PLANTILLA_PLAN_COMPLETO_ECUADOR } from '../../data/plan-cuentas-templates';
import { CuentaContableDialogComponent } from '../../components/cuenta-contable-dialog/cuenta-contable-dialog.component';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-plan-cuentas',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <section class="plan-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad</p>
          <h2>
            Plan de cuentas
            <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayuda.submodulo" aria-label="Ayuda plan de cuentas">
              <mat-icon>help_outline</mat-icon>
            </button>
          </h2>
          <p>Administra la estructura base de Estado de Situacion Financiera por tenant.</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button type="button" (click)="confirmarPlantilla()" [disabled]="cargando() || aplicandoPlantilla() || !canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.plantillaEsf">
            <mat-icon>account_tree</mat-icon>
            {{ aplicandoPlantilla() ? 'Cargando...' : 'Cargar plantilla ESF' }}
          </button>
          <button mat-stroked-button type="button" (click)="confirmarPlanCompleto()" [disabled]="cargando() || aplicandoPlantilla() || !canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.planCompleto">
            <mat-icon>library_add</mat-icon>
            Plan completo Ecuador
          </button>
          <button mat-raised-button color="primary" type="button" (click)="abrirDialogo()" [disabled]="!canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.nuevaCuenta">
            <mat-icon>add</mat-icon>
            Nueva cuenta
          </button>
        </div>
      </header>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Buscar</mat-label>
          <input matInput type="search" [value]="busqueda()" (input)="actualizarBusqueda($event)" placeholder="Codigo o nombre" />
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.buscar" aria-label="Ayuda buscar cuenta">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select [value]="tipoFiltro()" (valueChange)="tipoFiltro.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="ACTIVO">Activo</mat-option>
            <mat-option value="PASIVO">Pasivo</mat-option>
            <mat-option value="PATRIMONIO">Patrimonio neto</mat-option>
            <mat-option value="INGRESO">Ingreso</mat-option>
            <mat-option value="GASTO">Gasto</mat-option>
            <mat-option value="COSTO">Costo</mat-option>
          </mat-select>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.tipo" aria-label="Ayuda tipo cuenta">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [value]="estadoFiltro()" (valueChange)="estadoFiltro.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="ACTIVA">Activa</mat-option>
            <mat-option value="INACTIVA">Inactiva</mat-option>
          </mat-select>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.estado" aria-label="Ayuda estado cuenta">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <div class="stats">
          <span>{{ cuentasFiltradas().length }} cuentas</span>
          <span>{{ cuentasMovimiento() }} de movimiento</span>
        </div>
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando plan de cuentas</h3>
          </div>
        } @else if (cuentas().length === 0) {
          <div class="empty-state">
            <mat-icon>account_tree</mat-icon>
            <h3>Sin plan de cuentas</h3>
            <p>Carga la plantilla ESF Constructora o crea la primera cuenta manualmente.</p>
            <button mat-raised-button color="primary" type="button" (click)="confirmarPlantilla()" [disabled]="!canCreate()">
              Cargar plantilla ESF
            </button>
          </div>
        } @else if (cuentasFiltradas().length === 0) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <h3>No hay resultados</h3>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="cuentasFiltradas()">
              <ng-container matColumnDef="codigo">
                <th mat-header-cell *matHeaderCellDef [matTooltip]="ayuda.codigo" matTooltipPosition="above">Codigo</th>
                <td mat-cell *matCellDef="let row">
                  <span class="code-cell" [style.padding-left.rem]="(row.nivel - 1) * 1.1">
                    {{ row.codigo }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">
                  <div class="account-name">
                    <span>{{ row.nombre }}</span>
                    @if (esCuentaPadre(row)) {
                      <mat-chip>Grupo</mat-chip>
                    }
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">{{ etiquetaTipo(row.tipo) }}</td>
              </ng-container>

              <ng-container matColumnDef="naturaleza">
                <th mat-header-cell *matHeaderCellDef [matTooltip]="ayuda.naturaleza" matTooltipPosition="above">Naturaleza</th>
                <td mat-cell *matCellDef="let row">{{ row.naturaleza }}</td>
              </ng-container>

              <ng-container matColumnDef="movimiento">
                <th mat-header-cell *matHeaderCellDef [matTooltip]="ayuda.movimiento" matTooltipPosition="above">Movimiento</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.inactivo]="!row.permiteMovimiento">
                    {{ row.permiteMovimiento ? 'Si' : 'No' }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.inactivo]="row.estado === 'INACTIVA'">{{ row.estado }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button type="button" (click)="abrirDialogo(row)" [disabled]="!canUpdate()">Editar</button>
                  <button mat-button type="button" (click)="alternarEstado(row)" [disabled]="!canUpdate()">
                    {{ row.estado === 'ACTIVA' ? 'Inactivar' : 'Activar' }}
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas" [class.inactive-row]="row.estado === 'INACTIVA'"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .plan-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header h2 { display: inline-flex; align-items: center; gap: .35rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .filters-card { padding: 1rem; display: grid; grid-template-columns: minmax(240px, 1fr) 180px 180px auto; gap: .75rem; align-items: center; background: var(--tc-surface-container-lowest); }
    .stats { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; color: var(--muted-foreground); font-size: .9rem; }
    .stats span { padding: .35rem .55rem; border-radius: .45rem; background: var(--tc-surface-container); }
    .table-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 980px; }
    .code-cell { display: inline-flex; font-weight: 600; font-variant-numeric: tabular-nums; }
    .account-name { display: inline-flex; align-items: center; gap: .5rem; }
    .inactivo { opacity: .62; }
    .inactive-row { opacity: .72; }
    .empty-state { min-height: 260px; display: grid; place-items: center; align-content: center; gap: .5rem; text-align: center; color: var(--muted-foreground); }
    .empty-state mat-icon { font-size: 2rem; width: 2rem; height: 2rem; color: var(--primary); }
    .empty-state h3 { margin: 0; color: var(--foreground); }
    .empty-state p { margin: 0; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 980px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .filters-card { grid-template-columns: 1fr; }
      .stats { justify-content: flex-start; }
    }
  `]
})
export class PlanCuentasComponent implements OnInit {
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['codigo', 'nombre', 'tipo', 'naturaleza', 'movimiento', 'estado', 'acciones'];
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly cargando = signal(true);
  protected readonly aplicandoPlantilla = signal(false);
  protected readonly busqueda = signal('');
  protected readonly tipoFiltro = signal<TipoCuenta | 'TODOS'>('TODOS');
  protected readonly estadoFiltro = signal<EstadoCuentaContable | 'TODOS'>('TODOS');
  protected readonly canCreate = computed(() => this.authorization.canAccess('contabilidad', 'create'));
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly ayuda = {
    submodulo: 'Catalogo contable del tenant. Define jerarquia, naturaleza y cuentas que se usaran en asientos, reportes y balances.',
    plantillaEsf: 'Carga una estructura base de Activo, Pasivo y Patrimonio para Estado de Situacion Financiera.',
    planCompleto: 'Agrega cuentas de Activo, Pasivo, Patrimonio, Ingresos, Costos y Gastos para reportes financieros completos.',
    nuevaCuenta: 'Crea una cuenta manual. Use cuentas padre para agrupar y cuentas de movimiento para registrar asientos.',
    buscar: 'Filtra por codigo o nombre para ubicar rapidamente una cuenta dentro del plan.',
    tipo: 'Clasificacion que determina en que reporte aparece la cuenta: balance general o resultado integral.',
    estado: 'Activa permite nuevos registros; inactiva conserva saldos historicos pero evita uso operativo.',
    codigo: 'Codigo jerarquico. Los puntos indican niveles y permiten ordenar y tabular el plan de cuentas.',
    naturaleza: 'Saldo normal de la cuenta: deudora o acreedora. Ayuda a interpretar saldos y reportes.',
    movimiento: 'Si es Si, la cuenta admite lineas de asiento. Si es No, funciona como agrupadora o totalizadora.'
  };

  protected readonly cuentasHijasPorPadre = computed(() => {
    const index = new Set<string>();
    for (const cuenta of this.cuentas()) {
      if (cuenta.cuentaPadreId) {
        index.add(cuenta.cuentaPadreId);
      }
    }
    return index;
  });

  protected readonly cuentasFiltradas = computed(() => {
    const term = this.busqueda().trim().toLowerCase();
    return this.cuentas().filter((cuenta) => {
      const coincideBusqueda = !term
        || cuenta.codigo.toLowerCase().includes(term)
        || cuenta.nombre.toLowerCase().includes(term);
      const coincideTipo = this.tipoFiltro() === 'TODOS' || cuenta.tipo === this.tipoFiltro();
      const coincideEstado = this.estadoFiltro() === 'TODOS' || cuenta.estado === this.estadoFiltro();
      return coincideBusqueda && coincideTipo && coincideEstado;
    });
  });

  protected readonly cuentasMovimiento = computed(() => {
    return this.cuentas().filter((cuenta) => cuenta.permiteMovimiento).length;
  });

  ngOnInit(): void {
    this.planCuentasService
      .getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuentas) => {
          this.cuentas.set(cuentas);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.mostrarMensaje('No se pudo cargar el plan de cuentas.', 'error');
        }
      });
  }

  protected actualizarBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  protected abrirDialogo(cuenta?: CuentaContable): void {
    const dialogRef = this.dialog.open(CuentaContableDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      data: {
        cuenta,
        cuentas: this.cuentas()
      }
    });

    dialogRef.afterClosed().subscribe((result: CuentaContable | undefined) => {
      if (!result) {
        return;
      }

      void this.planCuentasService.guardarCuenta(result).then(() => {
        this.mostrarMensaje(cuenta ? 'Cuenta actualizada.' : 'Cuenta creada.', cuenta ? 'edit' : 'add');
      });
    });
  }

  protected confirmarPlantilla(): void {
    if (this.cuentas().length === 0) {
      void this.cargarPlantilla();
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Cargar plantilla ESF',
        message: 'Se agregaran solo las cuentas de la plantilla que no existan por codigo.',
        confirmText: 'Cargar',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (confirmado) {
        void this.cargarPlantilla();
      }
    });
  }

  protected confirmarPlanCompleto(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: 'Cargar plan completo Ecuador',
        message: 'Se agregaran cuentas faltantes para Estado de Situacion Financiera y Estado de Resultado Integral, sin duplicar codigos existentes.',
        confirmText: 'Cargar',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (confirmado) {
        void this.cargarPlantillaBase(PLANTILLA_PLAN_COMPLETO_ECUADOR);
      }
    });
  }

  protected async alternarEstado(cuenta: CuentaContable): Promise<void> {
    const siguienteEstado: EstadoCuentaContable = cuenta.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
    await this.planCuentasService.cambiarEstado(cuenta, siguienteEstado);
    this.mostrarMensaje(siguienteEstado === 'ACTIVA' ? 'Cuenta activada.' : 'Cuenta inactivada.', 'sync');
  }

  protected etiquetaTipo(tipo: TipoCuenta): string {
    const etiquetas: Record<TipoCuenta, string> = {
      ACTIVO: 'Activo',
      PASIVO: 'Pasivo',
      PATRIMONIO: 'Patrimonio neto',
      INGRESO: 'Ingreso',
      GASTO: 'Gasto',
      COSTO: 'Costo'
    };
    return etiquetas[tipo];
  }

  protected esCuentaPadre(cuenta: CuentaContable): boolean {
    return !!cuenta.id && this.cuentasHijasPorPadre().has(cuenta.id);
  }

  private async cargarPlantilla(): Promise<void> {
    await this.cargarPlantillaBase(PLANTILLA_ESF_CONSTRUCTORA);
  }

  private async cargarPlantillaBase(plantilla = PLANTILLA_ESF_CONSTRUCTORA): Promise<void> {
    this.aplicandoPlantilla.set(true);
    try {
      const resultado = await this.planCuentasService.aplicarPlantilla(plantilla);
      this.mostrarMensaje(
        `Plantilla aplicada: ${resultado.insertadas} cuentas nuevas, ${resultado.omitidas} omitidas.`,
        'account_tree'
      );
    } catch {
      this.mostrarMensaje('No se pudo cargar la plantilla.', 'error');
    } finally {
      this.aplicandoPlantilla.set(false);
    }
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2800,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

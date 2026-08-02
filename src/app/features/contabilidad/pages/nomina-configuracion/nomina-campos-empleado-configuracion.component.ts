import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { CuentaContable } from '../../models/contabilidad.models';
import { CargoNomina, DepartamentoNomina } from '../../models/nomina.models';
import { NominaService } from '../../services/nomina.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { NominaCargoFormDialogComponent } from './nomina-cargo-form-dialog.component';
import { NominaDepartamentoFormDialogComponent } from './nomina-departamento-form-dialog.component';
import { NominaImportarCatalogosDialogComponent } from './nomina-importar-catalogos-dialog.component';

@Component({
  selector: 'app-nomina-campos-empleado-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule
  ],
  template: `
    <section class="nomina-config">
      <header class="page-header">
        <div>
          <p class="eyebrow">Contabilidad · Nómina</p>
          <h2>Configuración de nómina</h2>
          <p>Parametriza la ficha del empleado y la estructura organizacional de esta empresa.</p>
        </div>
        <div class="header-summary" aria-label="Resumen de configuración">
          <span><mat-icon>badge</mat-icon>{{ cargosActivos() }} cargos activos</span>
          <span><mat-icon>account_tree</mat-icon>{{ departamentosActivos() }} departamentos activos</span>
        </div>
      </header>

      @if (error()) {
        <section class="error-box" role="alert">
          <mat-icon>error</mat-icon><span>{{ error() }}</span>
        </section>
      }

      <section class="surface-card config-surface">
        <mat-tab-group class="config-tabs" [preserveContent]="true" animationDuration="180ms">
          <mat-tab>
            <ng-template mat-tab-label><mat-icon>dynamic_form</mat-icon><span>Campos de empleado</span></ng-template>
            <div class="tab-content">
              <div class="section-head">
                <div>
                  <h3>Campos adicionales</h3>
                  <p>Registra información propia de tu operación, como banco, uniforme o centro de costo.</p>
                </div>
                <button mat-flat-button color="primary" type="button" (click)="agregarCampo()" [disabled]="!canUpdate()">
                  <mat-icon>add</mat-icon>Agregar campo
                </button>
              </div>

              @if (camposPersonalizados().length === 0) {
                <div class="empty-state">
                  <mat-icon>dynamic_form</mat-icon>
                  <h3>Sin campos adicionales</h3>
                  <p>Agrega campos para adaptar la ficha del empleado a esta empresa.</p>
                </div>
              } @else {
                <div class="table-wrap">
                  <table mat-table [dataSource]="camposPersonalizados()">
                    <ng-container matColumnDef="nombreMostrar">
                      <th mat-header-cell *matHeaderCellDef>Nombre</th>
                      <td mat-cell *matCellDef="let row">{{ row.nombreMostrar }}</td>
                    </ng-container>
                    <ng-container matColumnDef="tipo">
                      <th mat-header-cell *matHeaderCellDef>Tipo</th>
                      <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
                    </ng-container>
                    <ng-container matColumnDef="opciones">
                      <th mat-header-cell *matHeaderCellDef>Opciones</th>
                      <td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">{{ formatearOpciones(row) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="acciones">
                      <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                      <td mat-cell *matCellDef="let row" class="num">
                        <button mat-icon-button type="button" matTooltip="Eliminar campo" aria-label="Eliminar campo" (click)="eliminarCampo(row)" [disabled]="!canUpdate()"><mat-icon>delete</mat-icon></button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnasCampos"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnasCampos"></tr>
                  </table>
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label><mat-icon>account_tree</mat-icon><span>Cargos y departamentos</span></ng-template>
            <div class="tab-content catalog-tab">
              <div class="migration-bar">
                <div>
                  <strong>¿Ya tienes empleados registrados?</strong>
                  <span>Convierte sus textos actuales en catálogos sin editar cada ficha.</span>
                </div>
                <button mat-stroked-button type="button" (click)="prepararImportacion()" [disabled]="importando() || !canUpdate()">
                  <mat-icon>move_to_inbox</mat-icon>{{ importando() ? 'Importando…' : 'Importar datos existentes' }}
                </button>
              </div>

              <div class="catalog-grid">
                <section class="catalog-panel" aria-labelledby="cargos-title">
                  <div class="section-head compact">
                    <div><h3 id="cargos-title">Cargos</h3><p>La cuenta define la fila salarial del asiento.</p></div>
                    <button mat-flat-button color="primary" type="button" (click)="crearCargo()" [disabled]="!canUpdate()"><mat-icon>add</mat-icon>Nuevo cargo</button>
                  </div>
                  @if (cargos().length === 0) {
                    <div class="empty-state compact-empty"><mat-icon>badge</mat-icon><h3>Sin cargos</h3><p>Crea el primero o importa los datos existentes.</p></div>
                  } @else {
                    <div class="table-wrap">
                      <table mat-table [dataSource]="cargos()">
                        <ng-container matColumnDef="nombre"><th mat-header-cell *matHeaderCellDef>Cargo</th><td mat-cell *matCellDef="let row"><strong>{{ row.nombre }}</strong></td></ng-container>
                        <ng-container matColumnDef="cuenta"><th mat-header-cell *matHeaderCellDef>Cuenta de sueldos</th><td mat-cell *matCellDef="let row"><span [class.pending-account]="!row.cuentaGastoSueldosId">{{ nombreCuenta(row.cuentaGastoSueldosId) }}</span></td></ng-container>
                        <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="status" [class.inactive]="!row.activo">{{ row.activo ? 'Activo' : 'Inactivo' }}</span></td></ng-container>
                        <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef class="num">Acciones</th><td mat-cell *matCellDef="let row" class="num actions-cell">
                          <button mat-icon-button type="button" matTooltip="Editar cargo" aria-label="Editar cargo" (click)="editarCargo(row)" [disabled]="!canUpdate()"><mat-icon>edit</mat-icon></button>
                          <button mat-icon-button type="button" [matTooltip]="row.activo ? 'Inactivar cargo' : 'Activar cargo'" [attr.aria-label]="row.activo ? 'Inactivar cargo' : 'Activar cargo'" (click)="alternarCargo(row)" [disabled]="!canUpdate()"><mat-icon>{{ row.activo ? 'toggle_on' : 'toggle_off' }}</mat-icon></button>
                        </td></ng-container>
                        <tr mat-header-row *matHeaderRowDef="columnasCargos"></tr><tr mat-row *matRowDef="let row; columns: columnasCargos"></tr>
                      </table>
                    </div>
                  }
                </section>

                <section class="catalog-panel" aria-labelledby="departamentos-title">
                  <div class="section-head compact">
                    <div><h3 id="departamentos-title">Departamentos</h3><p>Clasifican al personal sin alterar el asiento.</p></div>
                    <button mat-flat-button color="primary" type="button" (click)="crearDepartamento()" [disabled]="!canUpdate()"><mat-icon>add</mat-icon>Nuevo departamento</button>
                  </div>
                  @if (departamentos().length === 0) {
                    <div class="empty-state compact-empty"><mat-icon>account_tree</mat-icon><h3>Sin departamentos</h3><p>Son opcionales y pueden configurarse cuando los necesites.</p></div>
                  } @else {
                    <div class="table-wrap">
                      <table mat-table [dataSource]="departamentos()">
                        <ng-container matColumnDef="nombre"><th mat-header-cell *matHeaderCellDef>Departamento</th><td mat-cell *matCellDef="let row"><strong>{{ row.nombre }}</strong></td></ng-container>
                        <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="status" [class.inactive]="!row.activo">{{ row.activo ? 'Activo' : 'Inactivo' }}</span></td></ng-container>
                        <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef class="num">Acciones</th><td mat-cell *matCellDef="let row" class="num actions-cell">
                          <button mat-icon-button type="button" matTooltip="Editar departamento" aria-label="Editar departamento" (click)="editarDepartamento(row)" [disabled]="!canUpdate()"><mat-icon>edit</mat-icon></button>
                          <button mat-icon-button type="button" [matTooltip]="row.activo ? 'Inactivar departamento' : 'Activar departamento'" [attr.aria-label]="row.activo ? 'Inactivar departamento' : 'Activar departamento'" (click)="alternarDepartamento(row)" [disabled]="!canUpdate()"><mat-icon>{{ row.activo ? 'toggle_on' : 'toggle_off' }}</mat-icon></button>
                        </td></ng-container>
                        <tr mat-header-row *matHeaderRowDef="columnasDepartamentos"></tr><tr mat-row *matRowDef="let row; columns: columnasDepartamentos"></tr>
                      </table>
                    </div>
                  }
                </section>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </section>
    </section>
  `,
  styles: [`
    .nomina-config { display: grid; gap: 1rem; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding: .25rem; }
    .page-header h2, h3, p { margin: 0; }
    .page-header h2 { font-size: clamp(1.55rem, 2vw, 2rem); letter-spacing: -.025em; }
    .page-header > div:first-child > p:last-child, .section-head p { margin-top: .35rem; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-summary { display: flex; gap: .6rem; flex-wrap: wrap; justify-content: flex-end; }
    .header-summary span { display: inline-flex; align-items: center; gap: .35rem; min-height: 36px; padding: .25rem .72rem; border-radius: 999px; background: var(--tc-surface-container-low); color: var(--muted-foreground); font-size: .79rem; font-weight: 700; }
    .header-summary mat-icon { width: 18px; height: 18px; color: var(--primary); font-size: 18px; }
    .config-surface { overflow: hidden; background: var(--tc-surface-container-lowest); }
    :host ::ng-deep .config-tabs .mat-mdc-tab-header { background: var(--tc-surface-container-low); }
    :host ::ng-deep .config-tabs .mat-mdc-tab { min-width: 210px; height: 58px; }
    :host ::ng-deep .config-tabs .mdc-tab__content { gap: .45rem; }
    :host ::ng-deep .config-tabs .mdc-tab__text-label { color: var(--muted-foreground); font-weight: 700; }
    :host ::ng-deep .config-tabs .mdc-tab--active .mdc-tab__text-label { color: var(--primary); }
    .tab-content { display: grid; gap: 1.25rem; padding: clamp(1rem, 2.5vw, 1.6rem); }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .section-head p { max-width: 66ch; }
    .migration-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1rem; border-radius: 14px; background: color-mix(in srgb, var(--primary) 8%, var(--tc-surface-container-lowest)); }
    .migration-bar > div { display: grid; gap: .2rem; }
    .migration-bar span { color: var(--muted-foreground); font-size: .86rem; }
    .catalog-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, .85fr); gap: 1rem; align-items: start; }
    .catalog-panel { min-width: 0; padding: 1.1rem; border-radius: 16px; background: var(--tc-surface-container-low); }
    .section-head.compact { align-items: center; margin-bottom: 1rem; }
    .section-head.compact p { font-size: .84rem; }
    .table-wrap { overflow: auto; border-radius: 12px; background: var(--tc-surface-container-lowest); }
    table { width: 100%; min-width: 610px; }
    .catalog-panel:last-child table { min-width: 430px; }
    .num { text-align: right; }
    .actions-cell { white-space: nowrap; }
    .options-cell { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: inline-flex; min-height: 26px; align-items: center; padding: .15rem .55rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-size: .76rem; font-weight: 750; }
    .status.inactive { background: var(--tc-surface-container-highest); color: var(--muted-foreground); }
    .pending-account { color: #9a5b00; font-weight: 700; }
    .empty-state { min-height: 210px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .compact-empty { min-height: 180px; border-radius: 12px; background: var(--tc-surface-container-lowest); }
    .empty-state mat-icon { color: var(--primary); font-size: 2rem; width: 2rem; height: 2rem; }
    .error-box { display: flex; align-items: center; gap: .55rem; padding: .8rem 1rem; border-radius: 12px; background: color-mix(in srgb, #b3261e 12%, transparent); color: #9b1c16; }
    @media (max-width: 1080px) { .catalog-grid { grid-template-columns: 1fr; } }
    @media (max-width: 760px) {
      .page-header { align-items: start; flex-direction: column; gap: 1rem; }
      .header-summary { justify-content: flex-start; }
      .migration-bar { align-items: stretch; flex-direction: column; }
      :host ::ng-deep .config-tabs .mat-mdc-tab { min-width: 180px; }
    }
  `]
})
export class NominaCamposEmpleadoConfiguracionComponent {
  private readonly nominaService = inject(NominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly cargos = signal<CargoNomina[]>([]);
  protected readonly departamentos = signal<DepartamentoNomina[]>([]);
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly importando = signal(false);
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly cargosActivos = computed(() => this.cargos().filter((item) => item.activo).length);
  protected readonly departamentosActivos = computed(() => this.departamentos().filter((item) => item.activo).length);
  protected readonly columnasCampos = ['nombreMostrar', 'tipo', 'opciones', 'acciones'];
  protected readonly columnasCargos = ['nombre', 'cuenta', 'estado', 'acciones'];
  protected readonly columnasDepartamentos = ['nombre', 'estado', 'acciones'];

  constructor() {
    this.nominaService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (config) => this.camposPersonalizados.set(config.camposPersonalizados ?? []), error: (error) => this.mostrarError(error) });
    this.nominaService.getCargos().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (items) => this.cargos.set(items), error: (error) => this.mostrarError(error) });
    this.nominaService.getDepartamentos().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (items) => this.departamentos.set(items), error: (error) => this.mostrarError(error) });
    this.planCuentasService.getCuentas().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (items) => this.cuentas.set(items.filter((item) => item.estado === 'ACTIVA' && item.permiteMovimiento)), error: (error) => this.mostrarError(error) });
  }

  protected agregarCampo(): void {
    if (!this.canUpdate()) return;
    this.dialog.open(AgregarCampoDialogComponent, { width: '760px', maxWidth: '95vw' }).afterClosed()
      .subscribe((campo: CampoPersonalizado | undefined) => {
        if (campo) void this.ejecutar(() => this.nominaService.agregarCampo(campo), 'Campo adicional agregado.', 'playlist_add');
      });
  }

  protected eliminarCampo(campo: CampoPersonalizado): void {
    if (!this.canUpdate()) return;
    this.confirmar('Eliminar campo', `¿Deseas eliminar el campo ${campo.nombreMostrar}?`, 'Eliminar', () =>
      this.ejecutar(() => this.nominaService.eliminarCampo(campo.idCampo), 'Campo eliminado.', 'delete'));
  }

  protected crearCargo(): void { this.abrirCargo(); }
  protected editarCargo(cargo: CargoNomina): void { this.abrirCargo(cargo); }

  protected alternarCargo(cargo: CargoNomina): void {
    if (!cargo.id || !this.canUpdate()) return;
    const accion = cargo.activo ? 'Inactivar' : 'Activar';
    this.confirmar(`${accion} cargo`, `${accion} ${cargo.nombre}? Los empleados actuales conservarán su asignación.`, accion, () =>
      this.ejecutar(() => this.nominaService.cambiarEstadoCargo(cargo.id!, !cargo.activo), `Cargo ${cargo.activo ? 'inactivado' : 'activado'}.`, 'badge'));
  }

  protected crearDepartamento(): void { this.abrirDepartamento(); }
  protected editarDepartamento(departamento: DepartamentoNomina): void { this.abrirDepartamento(departamento); }

  protected alternarDepartamento(departamento: DepartamentoNomina): void {
    if (!departamento.id || !this.canUpdate()) return;
    const accion = departamento.activo ? 'Inactivar' : 'Activar';
    this.confirmar(`${accion} departamento`, `${accion} ${departamento.nombre}? Los empleados actuales conservarán su asignación.`, accion, () =>
      this.ejecutar(() => this.nominaService.cambiarEstadoDepartamento(departamento.id!, !departamento.activo), `Departamento ${departamento.activo ? 'inactivado' : 'activado'}.`, 'account_tree'));
  }

  protected async prepararImportacion(): Promise<void> {
    if (!this.canUpdate() || this.importando()) return;
    this.error.set(null);
    try {
      const preview = await this.nominaService.prepararImportacionCatalogos();
      this.dialog.open(NominaImportarCatalogosDialogComponent, { width: '760px', maxWidth: '95vw', data: preview })
        .afterClosed().subscribe((confirmado: boolean | undefined) => { if (confirmado) void this.importar(); });
    } catch (error) {
      this.mostrarError(error);
    }
  }

  protected nombreCuenta(cuentaId: string): string {
    if (!cuentaId) return 'Pendiente de configurar';
    const cuenta = this.cuentas().find((item) => item.id === cuentaId);
    return cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : 'Cuenta no disponible';
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' · ') ?? '—';
  }

  private abrirCargo(cargo?: CargoNomina): void {
    if (!this.canUpdate()) return;
    this.dialog.open(NominaCargoFormDialogComponent, {
      width: '660px', maxWidth: '95vw', data: { cargo, cuentas: this.cuentas() }
    }).afterClosed().subscribe((resultado: CargoNomina | undefined) => {
      if (resultado) void this.ejecutar(() => this.nominaService.guardarCargo(resultado), cargo ? 'Cargo actualizado.' : 'Cargo creado.', cargo ? 'edit' : 'add');
    });
  }

  private abrirDepartamento(departamento?: DepartamentoNomina): void {
    if (!this.canUpdate()) return;
    this.dialog.open(NominaDepartamentoFormDialogComponent, {
      width: '580px', maxWidth: '95vw', data: departamento
    }).afterClosed().subscribe((resultado: DepartamentoNomina | undefined) => {
      if (resultado) void this.ejecutar(() => this.nominaService.guardarDepartamento(resultado), departamento ? 'Departamento actualizado.' : 'Departamento creado.', departamento ? 'edit' : 'add');
    });
  }

  private async importar(): Promise<void> {
    this.importando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.nominaService.importarCatalogosExistentes();
      this.toast(`${resultado.empleadosVinculados} empleados vinculados; ${resultado.cargosCreados} cargos y ${resultado.departamentosCreados} departamentos creados.`, 'move_to_inbox');
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.importando.set(false);
    }
  }

  private confirmar(title: string, message: string, confirmText: string, accion: () => void): void {
    this.dialog.open(ConfirmDialogComponent, { width: '440px', data: { title, message, confirmText } })
      .afterClosed().subscribe((confirmado) => { if (confirmado) accion(); });
  }

  private async ejecutar(accion: () => Promise<unknown>, mensaje: string, icono: string): Promise<void> {
    this.error.set(null);
    try {
      await accion();
      this.toast(mensaje, icono);
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private mostrarError(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'No se pudo completar la operación. Intenta nuevamente.');
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon }, duration: 2800, horizontalPosition: 'end', verticalPosition: 'top'
    });
  }
}

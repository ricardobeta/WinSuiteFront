import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { CuentaBancaria } from '../../models/bancos.models';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { BancosReglasService, ReglaConciliacion } from '../../services/bancos-reglas.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

interface ReglaDialogData {
  regla?: ReglaConciliacion;
  cuentas: CuentaBancaria[];
}

@Component({
  selector: 'app-regla-conciliacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data.regla ? 'Editar regla' : 'Nueva regla de conciliación' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" placeholder="Comisiones Pichincha" />
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Operador</mat-label>
            <mat-select formControlName="operador">
              <mat-option value="CONTIENE">La descripción contiene</mat-option>
              <mat-option value="EMPIEZA">La descripción empieza con</mat-option>
              <mat-option value="REGEX">Expresión regular</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Texto / patrón</mat-label>
            <input matInput formControlName="valor" placeholder="COMISION" />
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Tipo de movimiento</mat-label>
            <mat-select formControlName="tipoMov">
              <mat-option value="">Cualquiera</mat-option>
              <mat-option value="DEBITO">Débitos (egresos)</mat-option>
              <mat-option value="CREDITO">Créditos (ingresos)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Monto máximo (opcional)</mat-label>
            <input matInput type="number" step="0.01" formControlName="montoMax" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Cuenta bancaria (opcional)</mat-label>
          <mat-select formControlName="cuentaBancariaId">
            <mat-option value="">Todas las cuentas</mat-option>
            @for (cuenta of data.cuentas; track cuenta.id) {
              <mat-option [value]="cuenta.id">{{ cuenta.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <app-cuenta-contable-autocomplete
          [cuentas]="cuentasContables()"
          [cuentaId]="form.value.cuentaContableId ?? null"
          label="Clasificar a la cuenta contable"
          (cuentaSeleccionada)="onCuenta($event)"
        />

        <mat-slide-toggle formControlName="autoConciliar">
          Conciliar automáticamente (sin revisión) cuando la regla coincida
        </mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="guardar()">
        <mat-icon>save</mat-icon>
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: .5rem; min-width: min(520px, 84vw); padding-top: .5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
  `]
})
export class ReglaConciliacionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReglaConciliacionDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly planCuentas = inject(PlanCuentasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = inject<ReglaDialogData>(MAT_DIALOG_DATA);
  protected readonly cuentasContables = signal<CuentaContable[]>([]);

  protected readonly form = this.formBuilder.nonNullable.group({
    nombre: [this.data.regla?.nombre ?? '', [Validators.required, Validators.maxLength(80)]],
    operador: [this.data.regla?.condicion.operador ?? 'CONTIENE', Validators.required],
    valor: [this.data.regla?.condicion.valor ?? '', [Validators.required, Validators.maxLength(120)]],
    tipoMov: [this.data.regla?.condicion.tipoMov ?? ''],
    montoMax: [this.data.regla?.condicion.montoMax ?? null as number | null],
    cuentaBancariaId: [this.data.regla?.cuentaBancariaId ?? ''],
    cuentaContableId: [this.data.regla?.accion.cuentaContableId ?? '', Validators.required],
    autoConciliar: [this.data.regla?.accion.autoConciliar ?? false]
  });

  constructor() {
    this.planCuentas.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentasContables.set(cuentas));
  }

  protected onCuenta(cuenta: CuentaContable | null): void {
    this.form.patchValue({ cuentaContableId: cuenta?.id ?? '' });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const regla: ReglaConciliacion = {
      id: this.data.regla?.id,
      nombre: value.nombre,
      cuentaBancariaId: value.cuentaBancariaId || null,
      condicion: {
        campo: 'descripcion',
        operador: value.operador,
        valor: value.valor,
        tipoMov: (value.tipoMov || '') as ReglaConciliacion['condicion']['tipoMov'],
        montoMax: value.montoMax ?? null
      },
      accion: {
        cuentaContableId: value.cuentaContableId,
        autoConciliar: value.autoConciliar
      },
      activa: this.data.regla?.activa ?? true,
      orden: this.data.regla?.orden ?? 10
    };
    this.dialogRef.close(regla);
  }
}

@Component({
  selector: 'app-bancos-reglas',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="reglas-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Reglas de conciliación</h2>
          <p class="support">Automatiza movimientos recurrentes del extracto (comisiones, intereses, impuestos): la regla los clasifica a su cuenta contable en cada conciliación.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos">
            <mat-icon>arrow_back</mat-icon>
            Cuentas
          </a>
          @if (canUpdate()) {
            <button mat-flat-button color="primary" class="cta" (click)="nuevaRegla()">
              <mat-icon>add</mat-icon>
              Nueva regla
            </button>
          }
        </div>
      </header>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><h3>Cargando…</h3></div>
        } @else if (reglas().length === 0) {
          <div class="empty-state">
            <mat-icon>rule</mat-icon>
            <h3>Sin reglas</h3>
            <p>Crea una regla para clasificar automáticamente movimientos recurrentes.</p>
          </div>
        } @else {
          <app-data-table-frame [showSearch]="false" [showPaginator]="false">
            <table mat-table [dataSource]="reglas()" class="reglas-table">
              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Regla</th>
                <td mat-cell *matCellDef="let row">
                  <div class="doc-cell">
                    <span class="doc-num">{{ row.nombre }}</span>
                    <span class="doc-sub">{{ condicionLabel(row) }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="modo">
                <th mat-header-cell *matHeaderCellDef>Modo</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="row.accion.autoConciliar ? 'pill-success' : 'pill-info'">
                    {{ row.accion.autoConciliar ? 'Auto-concilia' : 'Sugiere' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="activa">
                <th mat-header-cell *matHeaderCellDef>Activa</th>
                <td mat-cell *matCellDef="let row">
                  <mat-slide-toggle [checked]="row.activa" [disabled]="!canUpdate()"
                                    (change)="toggleActiva(row)" />
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  @if (canUpdate()) {
                    <button mat-icon-button matTooltip="Editar" (click)="editarRegla(row)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Eliminar" (click)="eliminarRegla(row)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
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
    .reglas-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .header-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
    .table-card { padding: 1rem 1.25rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .doc-cell { display: grid; }
    .doc-num { font-weight: 600; }
    .doc-sub { font-size: .78rem; color: var(--muted-foreground); }
    td.num, th.num { text-align: right; }
    .pill { display: inline-flex; border-radius: 999px; padding: .15rem .6rem; font-size: .75rem; font-weight: 600; }
    .pill-info { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .pill-success { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
  `]
})
export class BancosReglasComponent {
  private readonly reglasService = inject(BancosReglasService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['nombre', 'modo', 'activa', 'acciones'];
  protected readonly reglas = signal<ReglaConciliacion[]>([]);
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly cargando = signal(true);

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas));
    void this.cargar();
  }

  protected canUpdate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'update');
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.reglas.set(await this.reglasService.getReglas());
    } finally {
      this.cargando.set(false);
    }
  }

  protected async nuevaRegla(): Promise<void> {
    const regla = await firstValueFrom(this.dialog.open(ReglaConciliacionDialogComponent, {
      data: { cuentas: this.cuentas() }
    }).afterClosed());
    if (regla) {
      await this.reglasService.guardarRegla(regla);
      this.snackBar.open('Regla creada.', 'OK', { duration: 3000 });
      await this.cargar();
    }
  }

  protected async editarRegla(regla: ReglaConciliacion): Promise<void> {
    const editada = await firstValueFrom(this.dialog.open(ReglaConciliacionDialogComponent, {
      data: { regla, cuentas: this.cuentas() }
    }).afterClosed());
    if (editada) {
      await this.reglasService.guardarRegla(editada);
      this.snackBar.open('Regla actualizada.', 'OK', { duration: 3000 });
      await this.cargar();
    }
  }

  protected async toggleActiva(regla: ReglaConciliacion): Promise<void> {
    await this.reglasService.guardarRegla({ ...regla, activa: !regla.activa });
    await this.cargar();
  }

  protected async eliminarRegla(regla: ReglaConciliacion): Promise<void> {
    const confirmado = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar regla',
        message: `¿Eliminar la regla "${regla.nombre}"?`,
        confirmText: 'Eliminar'
      }
    }).afterClosed());
    if (confirmado) {
      await this.reglasService.eliminarRegla(regla);
      this.snackBar.open('Regla eliminada.', 'OK', { duration: 3000 });
      await this.cargar();
    }
  }

  protected condicionLabel(regla: ReglaConciliacion): string {
    const operador = { CONTIENE: 'contiene', EMPIEZA: 'empieza con', REGEX: 'regex' }[regla.condicion.operador];
    const tipo = regla.condicion.tipoMov === 'DEBITO' ? ' (débitos)' : regla.condicion.tipoMov === 'CREDITO' ? ' (créditos)' : '';
    return `Descripción ${operador} "${regla.condicion.valor}"${tipo}`;
  }
}

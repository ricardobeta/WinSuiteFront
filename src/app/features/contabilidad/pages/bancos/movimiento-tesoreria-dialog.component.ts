import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AsientoContable, CuentaContable } from '../../models/contabilidad.models';
import { CuentaBancaria } from '../../models/bancos.models';
import { AsientosContablesService } from '../../services/asientos-contables.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { MovimientoTesoreria, TesoreriaService, TipoMovimientoTesoreria } from '../../services/tesoreria.service';

export interface MovimientoTesoreriaDialogData {
  cuentas: CuentaBancaria[];
  cuentaBancariaId?: string | null;
}

const TIPOS: { valor: TipoMovimientoTesoreria; label: string; egreso: boolean }[] = [
  { valor: 'DEPOSITO', label: 'Depósito', egreso: false },
  { valor: 'CHEQUE', label: 'Cheque girado', egreso: true },
  { valor: 'TRANSFERENCIA_ENVIADA', label: 'Transferencia enviada', egreso: true },
  { valor: 'TRANSFERENCIA_RECIBIDA', label: 'Transferencia recibida', egreso: false },
  { valor: 'ND', label: 'Nota de débito', egreso: true },
  { valor: 'NC', label: 'Nota de crédito', egreso: false }
];

@Component({
  selector: 'app-movimiento-tesoreria-dialog',
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
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>Registrar movimiento de tesorería</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo">
              @for (tipo of tipos; track tipo.valor) {
                <mat-option [value]="tipo.valor">{{ tipo.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Cuenta bancaria</mat-label>
            <mat-select formControlName="cuentaBancariaId">
              @for (cuenta of data.cuentas; track cuenta.id) {
                <mat-option [value]="cuenta.id">{{ cuenta.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Fecha</mat-label>
            <input matInput type="date" formControlName="fecha" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Monto (USD)</mat-label>
            <input matInput type="number" step="0.01" min="0.01" formControlName="monto" />
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Referencia (cheque / transferencia)</mat-label>
            <input matInput formControlName="referencia" autocomplete="off" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Beneficiario / origen</mat-label>
            <input matInput formControlName="beneficiario" autocomplete="off" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Glosa</mat-label>
          <input matInput formControlName="glosa" autocomplete="off" />
        </mat-form-field>

        <app-cuenta-contable-autocomplete
          [cuentas]="cuentasContables()"
          [cuentaId]="form.value.cuentaContrapartidaId ?? null"
          [label]="esEgreso() ? 'Cuenta de contrapartida (DEBE: gasto/CxP)' : 'Cuenta de contrapartida (HABER: ingreso/CxC)'"
          (cuentaSeleccionada)="onContrapartida($event)"
        />
        <p class="hint">
          Se registrará el asiento contable automáticamente:
          {{ esEgreso() ? 'DEBE contrapartida / HABER banco' : 'DEBE banco / HABER contrapartida' }}.
        </p>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || guardando()" (click)="guardar()">
        <mat-icon>save</mat-icon>
        {{ guardando() ? 'Guardando…' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: .35rem; min-width: min(560px, 84vw); padding-top: .5rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .hint { color: var(--muted-foreground); font-size: .8rem; margin: .2rem 0 0; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
  `]
})
export class MovimientoTesoreriaDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MovimientoTesoreriaDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly planCuentas = inject(PlanCuentasService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly tesoreriaService = inject(TesoreriaService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = inject<MovimientoTesoreriaDialogData>(MAT_DIALOG_DATA);
  protected readonly tipos = TIPOS;
  protected readonly cuentasContables = signal<CuentaContable[]>([]);
  protected readonly guardando = signal(false);

  private contrapartida: CuentaContable | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    tipo: ['CHEQUE' as TipoMovimientoTesoreria, Validators.required],
    cuentaBancariaId: [this.data.cuentaBancariaId ?? '', Validators.required],
    fecha: [new Date().toISOString().slice(0, 10), Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    referencia: [''],
    beneficiario: [''],
    glosa: ['', Validators.required],
    cuentaContrapartidaId: ['', Validators.required]
  });

  constructor() {
    this.planCuentas.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentasContables.set(cuentas));
  }

  protected esEgreso(): boolean {
    return TIPOS.find((tipo) => tipo.valor === this.form.value.tipo)?.egreso ?? true;
  }

  protected onContrapartida(cuenta: CuentaContable | null): void {
    this.contrapartida = cuenta;
    this.form.patchValue({ cuentaContrapartidaId: cuenta?.id ?? '' });
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid || !this.contrapartida) {
      return;
    }
    const value = this.form.getRawValue();
    const cuentaBancaria = this.data.cuentas.find((cuenta) => cuenta.id === value.cuentaBancariaId);
    const cuentaBanco = this.cuentasContables().find((cuenta) => cuenta.id === cuentaBancaria?.cuentaContableId);
    if (!cuentaBancaria || !cuentaBanco) {
      return;
    }
    this.guardando.set(true);
    try {
      const egreso = this.esEgreso();
      const monto = Math.round(Math.abs(value.monto) * 100) / 100;
      const glosa = `Tesorería: ${value.glosa}`;
      const lineaBanco = {
        id: '1',
        cuentaId: cuentaBanco.id ?? '',
        codigoCuenta: cuentaBanco.codigo,
        nombreCuenta: cuentaBanco.nombre,
        descripcion: value.glosa,
        debe: egreso ? 0 : monto,
        haber: egreso ? monto : 0
      };
      const lineaContrapartida = {
        id: '2',
        cuentaId: this.contrapartida.id ?? '',
        codigoCuenta: this.contrapartida.codigo,
        nombreCuenta: this.contrapartida.nombre,
        descripcion: value.glosa,
        debe: egreso ? monto : 0,
        haber: egreso ? 0 : monto
      };
      const asiento: AsientoContable = {
        fecha: value.fecha,
        periodo: value.fecha.slice(0, 7),
        tipo: 'AJUSTE',
        glosa,
        referencia: value.referencia || undefined,
        estado: 'BORRADOR',
        origen: 'MANUAL',
        lineas: [lineaBanco, lineaContrapartida],
        totalDebe: monto,
        totalHaber: monto,
        diferencia: 0
      };
      const asientoId = await this.asientosService.aprobarAsiento(asiento);

      const movimiento: Omit<MovimientoTesoreria, 'id' | 'creadoEn'> = {
        tipo: value.tipo,
        cuentaBancariaId: value.cuentaBancariaId,
        fecha: value.fecha,
        fechaTs: new Date(`${value.fecha}T00:00:00-05:00`).getTime(),
        periodo: value.fecha.slice(0, 7),
        monto: egreso ? -monto : monto,
        referencia: value.referencia || '',
        beneficiario: value.beneficiario || '',
        glosa: value.glosa,
        estado: 'REGISTRADO',
        asientoId
      };
      const movimientoId = await this.tesoreriaService.crearMovimiento(movimiento);
      this.dialogRef.close({ movimientoId, asientoId });
    } finally {
      this.guardando.set(false);
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CuentaContable, EstadoCuentaContable, NaturalezaCuenta, TipoCuenta } from '../../models/contabilidad.models';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

export interface CuentaContableDialogData {
  cuenta?: CuentaContable;
  cuentas: CuentaContable[];
}

@Component({
  selector: 'app-cuenta-contable-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.cuenta ? 'Editar cuenta' : 'Nueva cuenta' }}</h2>

    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }

        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Codigo</mat-label>
            <input matInput formControlName="codigo" placeholder="1.1.1.01" />
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.codigo" aria-label="Ayuda codigo">
              <mat-icon>help_outline</mat-icon>
            </button>
            <mat-hint>Nivel {{ nivelSugerido() || '-' }}</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="estado">
              <mat-option value="ACTIVA">Activa</mat-option>
              <mat-option value="INACTIVA">Inactiva</mat-option>
            </mat-select>
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.estado" aria-label="Ayuda estado">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="160" />
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.nombre" aria-label="Ayuda nombre">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descripcion</mat-label>
          <textarea matInput formControlName="descripcion" rows="2"></textarea>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.descripcion" aria-label="Ayuda descripcion">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cuenta padre</mat-label>
          <mat-select formControlName="cuentaPadreId">
            <mat-option [value]="null">Sin cuenta padre</mat-option>
            @for (cuenta of cuentasPadre(); track cuenta.id) {
              <mat-option [value]="cuenta.id">{{ cuenta.codigo }} - {{ cuenta.nombre }}</mat-option>
            }
          </mat-select>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.cuentaPadre" aria-label="Ayuda cuenta padre">
            <mat-icon>help_outline</mat-icon>
          </button>
          @if (codigoPadreSugerido()) {
            <mat-hint>Padre sugerido: {{ codigoPadreSugerido() }}</mat-hint>
          }
        </mat-form-field>

        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo">
              <mat-option value="ACTIVO">Activo</mat-option>
              <mat-option value="PASIVO">Pasivo</mat-option>
              <mat-option value="PATRIMONIO">Patrimonio neto</mat-option>
              <mat-option value="INGRESO">Ingreso</mat-option>
              <mat-option value="GASTO">Gasto</mat-option>
              <mat-option value="COSTO">Costo</mat-option>
            </mat-select>
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.tipo" aria-label="Ayuda tipo">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Naturaleza</mat-label>
            <mat-select formControlName="naturaleza">
              <mat-option value="DEUDORA">Deudora</mat-option>
              <mat-option value="ACREEDORA">Acreedora</mat-option>
            </mat-select>
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.naturaleza" aria-label="Ayuda naturaleza">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <div class="toggle-help">
          <mat-slide-toggle formControlName="permiteMovimiento">
            Permite movimiento directo
          </mat-slide-toggle>
          <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayuda.movimiento" aria-label="Ayuda movimiento">
            <mat-icon>help_outline</mat-icon>
          </button>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: 1rem; padding-top: .5rem; min-width: min(680px, 78vw); }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .toggle-help { display: inline-flex; align-items: center; gap: .5rem; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    .form-error { margin: 0; padding: .75rem .9rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 760px) {
      .dialog-form { min-width: 0; }
      .grid-2 { grid-template-columns: 1fr; }
    }
  `]
})
export class CuentaContableDialogComponent implements OnInit {
  protected readonly data = inject<CuentaContableDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CuentaContableDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly error = signal<string | null>(null);
  protected readonly codigoPadreSugerido = signal<string | null>(null);
  protected readonly nivelSugerido = signal(0);
  protected readonly ayuda = {
    codigo: 'Codigo jerarquico del plan de cuentas. Use numeros separados por puntos, por ejemplo 1.1.1.01. El primer digito define el tipo contable sugerido.',
    estado: 'Activa permite usar la cuenta en asientos y mapeos; inactiva conserva el historico pero evita nuevos movimientos.',
    nombre: 'Nombre contable claro de la cuenta. Debe permitir identificar su uso en reportes y asientos.',
    descripcion: 'Detalle opcional para explicar politicas de uso, alcance de la cuenta o ejemplos de transacciones.',
    cuentaPadre: 'Cuenta agrupadora superior. Sirve para presentar el plan en forma jerarquica y sumar secciones en reportes.',
    tipo: 'Clasificacion principal: activo, pasivo, patrimonio, ingreso, gasto o costo. Afecta balances y reportes financieros.',
    naturaleza: 'Indica el saldo normal de la cuenta: deudora para activos/costos/gastos y acreedora para pasivos/patrimonio/ingresos.',
    movimiento: 'Active solo en cuentas auxiliares donde se registran valores. Las cuentas padre o de grupo no deberian recibir asientos directos.'
  };

  protected readonly form = this.formBuilder.group({
    id: [''],
    codigo: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)*$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(160)]],
    descripcion: [''],
    cuentaPadreId: [null as string | null],
    tipo: ['ACTIVO' as TipoCuenta, [Validators.required]],
    naturaleza: ['DEUDORA' as NaturalezaCuenta, [Validators.required]],
    permiteMovimiento: [true],
    estado: ['ACTIVA' as EstadoCuentaContable, [Validators.required]]
  });

  ngOnInit(): void {
    if (this.data.cuenta) {
      this.form.patchValue({
        id: this.data.cuenta.id ?? '',
        codigo: this.data.cuenta.codigo,
        nombre: this.data.cuenta.nombre,
        descripcion: this.data.cuenta.descripcion ?? '',
        cuentaPadreId: this.data.cuenta.cuentaPadreId ?? null,
        tipo: this.data.cuenta.tipo,
        naturaleza: this.data.cuenta.naturaleza,
        permiteMovimiento: this.data.cuenta.permiteMovimiento,
        estado: this.data.cuenta.estado
      });
    }

    this.actualizarSugerencias(this.form.controls.codigo.value ?? '');
    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((codigo) => this.actualizarSugerencias(codigo ?? ''));
  }

  protected cuentasPadre(): CuentaContable[] {
    const actualId = this.form.controls.id.value;
    return this.data.cuentas.filter((cuenta) => cuenta.id !== actualId);
  }

  protected guardar(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const id = raw.id || undefined;
    const codigo = this.planCuentasService.normalizarCodigo(raw.codigo ?? '');
    const duplicada = this.data.cuentas.some((cuenta) => {
      return cuenta.id !== id && this.planCuentasService.normalizarCodigo(cuenta.codigo) === codigo;
    });

    if (duplicada) {
      this.error.set('Ya existe una cuenta con ese codigo.');
      return;
    }

    const tieneHijas = id ? this.data.cuentas.some((cuenta) => cuenta.cuentaPadreId === id) : false;
    if (raw.permiteMovimiento && tieneHijas) {
      this.error.set('Una cuenta con subcuentas no puede permitir movimiento directo.');
      return;
    }

    const codigoPadre = this.planCuentasService.obtenerCodigoPadre(codigo);
    const padreSugerido = codigoPadre
      ? this.data.cuentas.find((cuenta) => this.planCuentasService.normalizarCodigo(cuenta.codigo) === codigoPadre)
      : null;

    const cuenta: CuentaContable = {
      id,
      codigo,
      nombre: (raw.nombre ?? '').trim(),
      descripcion: raw.descripcion?.trim() || '',
      cuentaPadreId: raw.cuentaPadreId ?? padreSugerido?.id ?? null,
      nivel: this.planCuentasService.calcularNivel(codigo),
      tipo: raw.tipo ?? this.planCuentasService.sugerirTipo(codigo),
      naturaleza: raw.naturaleza ?? this.planCuentasService.sugerirNaturaleza(codigo),
      permiteMovimiento: raw.permiteMovimiento ?? true,
      estado: raw.estado ?? 'ACTIVA',
      origen: this.data.cuenta?.origen ?? 'MANUAL',
      seccionReporte: this.data.cuenta?.seccionReporte ?? this.planCuentasService.sugerirSeccionReporte(codigo),
      ordenReporte: this.data.cuenta?.ordenReporte ?? this.planCuentasService.sugerirOrdenReporte(codigo),
      incluyeEnEstadoFinanciero: this.data.cuenta?.incluyeEnEstadoFinanciero ?? true,
      creadoEn: this.data.cuenta?.creadoEn
    };

    this.dialogRef.close(cuenta);
  }

  private actualizarSugerencias(codigoInput: string): void {
    const codigo = this.planCuentasService.normalizarCodigo(codigoInput);
    const nivel = this.planCuentasService.calcularNivel(codigo);
    const codigoPadre = this.planCuentasService.obtenerCodigoPadre(codigo);
    const padre = codigoPadre
      ? this.data.cuentas.find((cuenta) => this.planCuentasService.normalizarCodigo(cuenta.codigo) === codigoPadre)
      : null;

    this.nivelSugerido.set(nivel);
    this.codigoPadreSugerido.set(codigoPadre);
    this.form.patchValue(
      {
        tipo: this.planCuentasService.sugerirTipo(codigo),
        naturaleza: this.planCuentasService.sugerirNaturaleza(codigo),
        cuentaPadreId: padre?.id ?? this.form.controls.cuentaPadreId.value ?? null
      },
      { emitEvent: false }
    );
  }
}

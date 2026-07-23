import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CamposCustomFormComponent } from '../../../../shared/components/campos-custom-form/campos-custom-form.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { dateAIso, isoADate } from '../../../../shared/utils/fecha-input.util';
import { EmpleadoNomina, ModoDecimos } from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

@Component({
  selector: 'app-nomina-empleado-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    CamposCustomFormComponent
  ],
  template: `
    <section class="empleado-form-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina - Empleados</p>
          <h2>{{ empleadoId() ? 'Editar empleado' : 'Nuevo empleado' }}</h2>
          <p>Registra la informacion laboral y los campos personalizados definidos para empleados.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/nomina/empleados">
          <mat-icon>arrow_back</mat-icon>
          Volver
        </a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <form class="surface-card form-card" [formGroup]="form" (ngSubmit)="guardar()">
        <section class="form-section">
          <h3>Informacion principal</h3>
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Cedula</mat-label>
              <input matInput maxlength="10" inputmode="numeric" formControlName="cedula" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Nombres</mat-label>
              <input matInput formControlName="nombres" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Apellidos</mat-label>
              <input matInput formControlName="apellidos" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="estado">
                <mat-option value="ACTIVO">Activo</mat-option>
                <mat-option value="INACTIVO">Inactivo</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </section>

        <section class="form-section">
          <h3>Informacion laboral</h3>
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Cargo</mat-label>
              <input matInput formControlName="cargo" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Departamento</mat-label>
              <input matInput formControlName="departamento" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha ingreso</mat-label>
              <input matInput [matDatepicker]="pickerIngreso" formControlName="fechaIngreso" />
              <mat-datepicker-toggle matSuffix [for]="pickerIngreso"></mat-datepicker-toggle>
              <mat-datepicker #pickerIngreso></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Sueldo base</mat-label>
              <input matInput type="number" min="0" step="0.01" formControlName="sueldoBase" />
            </mat-form-field>
          </div>
        </section>

        <section class="form-section">
          <h3>Beneficios de ley</h3>
          <p class="section-hint">
            Cada empleado decide ante el IESS si recibe sus decimos y fondos de reserva mensualizados
            junto al sueldo, o acumulados para cobrarlos en su fecha. No es una politica de la empresa.
          </p>
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Decimo tercero</mat-label>
              <mat-select formControlName="modoDecimoTercero">
                <mat-option value="ACUMULADO">Acumulado (se paga en diciembre)</mat-option>
                <mat-option value="MENSUALIZADO">Mensualizado (con cada rol)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Decimo cuarto</mat-label>
              <mat-select formControlName="modoDecimoCuarto">
                <mat-option value="ACUMULADO">Acumulado (se paga en su fecha)</mat-option>
                <mat-option value="MENSUALIZADO">Mensualizado (con cada rol)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fondos de reserva</mat-label>
              <mat-select formControlName="modoFondosReserva">
                <mat-option value="ACUMULADO">Acumulados en el IESS</mat-option>
                <mat-option value="MENSUALIZADO">Mensualizados (con cada rol)</mat-option>
              </mat-select>
              @if (avisoFondosReserva()) {
                <mat-hint>{{ avisoFondosReserva() }}</mat-hint>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cargas familiares</mat-label>
              <input matInput type="number" min="0" step="1" formControlName="cargasFamiliares" />
              <mat-hint>Conyuge e hijos: dan derecho al 5% de utilidades</mat-hint>
            </mat-form-field>
          </div>
        </section>

        <section class="form-section">
          <h3>Contacto</h3>
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Telefono</mat-label>
              <input matInput formControlName="telefono" />
            </mat-form-field>
          </div>
        </section>

        @if (camposPersonalizados().length > 0) {
          <section class="form-section custom-section">
            <h3>Campos personalizados</h3>
            <app-campos-custom-form
              [campos]="camposPersonalizados()"
              formControlName="camposPersonalizados"
            />
          </section>
        }

        <footer class="actions-row">
          <a mat-button routerLink="/workspace/contabilidad/nomina/empleados">Cancelar</a>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
            <mat-icon>save</mat-icon>
            Guardar empleado
          </button>
        </footer>
      </form>
    </section>
  `,
  styles: [`
    .empleado-form-page { display: grid; gap: 1rem; }
    .page-header, .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p { margin-top: .35rem; color: var(--muted-foreground); }
    .form-card { display: grid; gap: 1rem; }
    .form-section { display: grid; gap: .75rem; }
    .section-hint { color: var(--muted-foreground); font-size: .88rem; max-width: 78ch; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .custom-section { border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); padding-top: 1rem; }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .grid-4, .grid-2 { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class NominaEmpleadoFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly nominaService = inject(NominaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly empleadoId = signal<string | null>(null);
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  private empleadoActual: EmpleadoNomina | null = null;

  protected readonly form = this.formBuilder.group({
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    nombres: ['', [Validators.required]],
    apellidos: ['', [Validators.required]],
    email: [''],
    telefono: [''],
    cargo: ['', [Validators.required]],
    departamento: [''],
    fechaIngreso: [new Date() as Date | null, [Validators.required]],
    sueldoBase: [0, [Validators.required, Validators.min(0.01)]],
    estado: ['ACTIVO' as EmpleadoNomina['estado'], [Validators.required]],
    modoDecimoTercero: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    modoDecimoCuarto: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    modoFondosReserva: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    cargasFamiliares: [0],
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({})
  });

  /** Aviso de antiguedad: los fondos de reserva recien se devengan desde el mes 13 de trabajo. */
  protected avisoFondosReserva(): string {
    const fecha = this.form.controls.fechaIngreso.value;
    if (!fecha) {
      return '';
    }
    const primerMesConDerecho = new Date(fecha.getFullYear() + 1, fecha.getMonth() + 1, 1);
    if (primerMesConDerecho <= new Date()) {
      return '';
    }
    return `Aun no genera fondos de reserva: se devengan desde ${primerMesConDerecho.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}.`;
  }

  ngOnInit(): void {
    this.nominaService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => this.camposPersonalizados.set(config.camposPersonalizados ?? []));

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        this.empleadoId.set(id);
        if (id) {
          void this.cargarEmpleado(id);
        }
      });
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.guardando.set(true);
    try {
      const raw = this.form.getRawValue();
      await this.nominaService.guardarEmpleado({
        ...this.empleadoActual,
        id: this.empleadoId() ?? undefined,
        cedula: raw.cedula ?? '',
        nombres: raw.nombres ?? '',
        apellidos: raw.apellidos ?? '',
        email: raw.email ?? '',
        telefono: raw.telefono ?? '',
        cargo: raw.cargo ?? '',
        departamento: raw.departamento ?? '',
        fechaIngreso: dateAIso(raw.fechaIngreso),
        sueldoBase: Number(raw.sueldoBase ?? 0),
        estado: raw.estado ?? 'ACTIVO',
        modoDecimoTercero: raw.modoDecimoTercero ?? 'ACUMULADO',
        modoDecimoCuarto: raw.modoDecimoCuarto ?? 'ACUMULADO',
        modoFondosReserva: raw.modoFondosReserva ?? 'ACUMULADO',
        cargasFamiliares: Number(raw.cargasFamiliares ?? 0),
        camposPersonalizados: raw.camposPersonalizados ?? {}
      });
      this.toast('Empleado guardado.', 'save');
      await this.router.navigate(['/workspace/contabilidad/nomina/empleados']);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el empleado.');
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarEmpleado(id: string): Promise<void> {
    const empleado = await this.nominaService.getEmpleadoById(id);
    if (!empleado) {
      this.error.set('El empleado no existe.');
      return;
    }

    this.empleadoActual = empleado;
    this.form.patchValue({
      cedula: empleado.cedula,
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      email: empleado.email ?? '',
      telefono: empleado.telefono ?? '',
      cargo: empleado.cargo,
      departamento: empleado.departamento ?? '',
      fechaIngreso: isoADate(empleado.fechaIngreso),
      sueldoBase: empleado.sueldoBase,
      estado: empleado.estado,
      modoDecimoTercero: empleado.modoDecimoTercero ?? 'ACUMULADO',
      modoDecimoCuarto: empleado.modoDecimoCuarto ?? 'ACUMULADO',
      modoFondosReserva: empleado.modoFondosReserva ?? 'ACUMULADO',
      cargasFamiliares: empleado.cargasFamiliares ?? 0,
      camposPersonalizados: empleado.camposPersonalizados ?? {}
    });
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

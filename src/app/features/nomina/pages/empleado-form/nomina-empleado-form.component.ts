import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CamposCustomFormComponent } from '../../../../shared/components/campos-custom-form/campos-custom-form.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { dateAIso, isoADate } from '../../../../shared/utils/fecha-input.util';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import {
  CargoNomina,
  DepartamentoNomina,
  EmpleadoNomina,
  ModoDecimos,
  RegimenFondosReserva,
  SaldoInicialLaboralEmpleado
} from '../../../contabilidad/models/nomina.models';
import { NominaService } from '../../../contabilidad/services/nomina.service';

@Component({
  selector: 'app-nomina-empleado-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    CamposCustomFormComponent,
    TwoDecimalInputDirective
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
                <mat-option value="EN_LIQUIDACION">En liquidacion</mat-option>
                <mat-option value="INACTIVO">Inactivo</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </section>

        <section class="form-section opening-balance-section">
          <div class="section-heading">
            <div>
              <h3>Saldos laborales anteriores</h3>
              <p class="section-hint">Registra el punto de partida cuando la empresa comenzo a usar WinSuite despues del ingreso del empleado.</p>
            </div>
            @if (!saldoInicialActivo()) {
              <button mat-stroked-button type="button" (click)="activarSaldoInicial()" [disabled]="!canUpdate()">
                <mat-icon>history</mat-icon>
                Configurar saldos
              </button>
            }
          </div>

          @if (saldoInicialActivo()) {
            <div class="balance-note" role="status">
              <mat-icon>fact_check</mat-icon>
              <p>Los valores se conciliaran con los roles aprobados posteriores a la fecha de corte. No incluyas montos que ya fueron pagados.</p>
            </div>
            <div class="grid-4">
              <mat-form-field appearance="outline">
                <mat-label>Fecha de corte</mat-label>
                <input matInput [matDatepicker]="pickerCorte" formControlName="saldoFechaCorte" />
                <mat-datepicker-toggle matSuffix [for]="pickerCorte"></mat-datepicker-toggle>
                <mat-datepicker #pickerCorte></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Decimo tercero pendiente</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="saldoDecimoTercero" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Decimo cuarto pendiente</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="saldoDecimoCuarto" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Fondos de reserva pendientes</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="saldoFondosReserva" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Dias de vacaciones pendientes</mat-label>
                <input matInput type="number" min="0" step="0.5" formControlName="saldoDiasVacaciones" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Valor vacaciones pendientes</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="saldoValorVacaciones" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Referencia documental</mat-label>
                <input matInput formControlName="saldoReferencia" placeholder="Acta, archivo o corte contable" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Observacion</mat-label>
                <input matInput formControlName="saldoObservacion" />
              </mat-form-field>
            </div>
            <mat-checkbox formControlName="saldoConfirmadoCero">
              Confirmo que no existen saldos anteriores cuando todos los valores son cero
            </mat-checkbox>
          }
        </section>

        <section class="form-section">
          <h3>Informacion laboral</h3>
          @if (cargosSeleccionables().length === 0) {
            <div class="catalog-warning" role="alert">
              <mat-icon>badge</mat-icon>
              <p><strong>Configura al menos un cargo.</strong> Los cargos definen cómo se agrupan los sueldos en el asiento contable.</p>
              <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/configuracion">Ir a configuración</a>
            </div>
          }
          @if (cargoLegacy() && !form.controls.cargoId.value) {
            <div class="catalog-warning legacy" role="status">
              <mat-icon>sync_problem</mat-icon>
              <p>El cargo anterior, <strong>{{ cargoLegacy() }}</strong>, no está parametrizado. Impórtalo o selecciona uno del catálogo para guardar.</p>
            </div>
          }
          @if (departamentoLegacy() && !form.controls.departamentoId.value) {
            <div class="catalog-warning legacy" role="status">
              <mat-icon>sync_problem</mat-icon>
              <p>El departamento anterior, <strong>{{ departamentoLegacy() }}</strong>, no está parametrizado. Puedes importarlo o seleccionar otro.</p>
            </div>
          }
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Cargo</mat-label>
              <mat-select formControlName="cargoId">
                @for (cargo of cargosSeleccionables(); track cargo.id) {
                  <mat-option [value]="cargo.id">{{ cargo.nombre }}{{ cargo.activo ? '' : ' · Inactivo' }}</mat-option>
                }
              </mat-select>
              @if (form.controls.cargoId.hasError('required')) { <mat-error>Selecciona un cargo parametrizado.</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Departamento</mat-label>
              <mat-select formControlName="departamentoId">
                <mat-option value="">Sin departamento</mat-option>
                @for (departamento of departamentosSeleccionables(); track departamento.id) {
                  <mat-option [value]="departamento.id">{{ departamento.nombre }}{{ departamento.activo ? '' : ' · Inactivo' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha ingreso</mat-label>
              <input matInput [matDatepicker]="pickerIngreso" formControlName="fechaIngreso" />
              <mat-datepicker-toggle matSuffix [for]="pickerIngreso"></mat-datepicker-toggle>
              <mat-datepicker #pickerIngreso></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Sueldo base</mat-label>
              <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="sueldoBase" />
            </mat-form-field>
          </div>
        </section>

        <section class="form-section">
          <h3>Beneficios de ley</h3>
          <p class="section-hint">
            Cada empleado decide ante el IESS si recibe sus décimos y fondos de reserva mensualizados
            junto al sueldo, o acumulados para cobrarlos en su fecha. La fecha desde la que causa
            fondos depende de la labor clasificada en su propia ficha.
          </p>
          <div class="grid-4">
            <mat-form-field appearance="outline">
              <mat-label>Décimo tercero</mat-label>
              <mat-select formControlName="modoDecimoTercero">
                <mat-option value="ACUMULADO">Acumulado (se paga en diciembre)</mat-option>
                <mat-option value="MENSUALIZADO">Mensualizado (con cada rol)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Décimo cuarto</mat-label>
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
              <mat-label>Actividad para fondos</mat-label>
              <mat-select formControlName="regimenFondosReserva">
                <mat-option value="GENERAL">Régimen general</mat-option>
                <mat-option value="CONSTRUCCION">Trabajo directo de construcción</mat-option>
                <mat-option value="SERVICIOS_COMPLEMENTARIOS">Servicios complementarios</mat-option>
              </mat-select>
              <mat-hint>No depende del sector de la empresa, sino de la labor del trabajador</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cargas familiares</mat-label>
              <input matInput type="number" min="0" step="1" formControlName="cargasFamiliares" />
              <mat-hint>Conyuge e hijos: dan derecho al 5% de utilidades</mat-hint>
            </mat-form-field>
          </div>

          @if (form.controls.regimenFondosReserva.value === 'CONSTRUCCION' || form.controls.regimenFondosReserva.value === 'SERVICIOS_COMPLEMENTARIOS') {
            <div class="construction-note" role="status">
              <mat-icon>{{ form.controls.regimenFondosReserva.value === 'CONSTRUCCION' ? 'engineering' : 'shield' }}</mat-icon>
              <p>
                <strong>Fondos desde el primer día.</strong>
                @if (form.controls.regimenFondosReserva.value === 'CONSTRUCCION') {
                  Usa esta clasificación únicamente para albañiles, maestros de obra y personas que
                  ejecutan directamente trabajos de construcción; no para personal administrativo o de apoyo.
                } @else {
                  Usa esta clasificación para vigilancia y seguridad privada, limpieza, jardinería o
                  alimentación cuando la persona trabaje bajo servicios complementarios.
                }
              </p>
            </div>
          }
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
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando() || !canUpdate()">
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
    .section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .section-hint { color: var(--muted-foreground); font-size: .88rem; max-width: 78ch; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .construction-note {
      display: flex;
      gap: .7rem;
      align-items: flex-start;
      padding: .85rem 1rem;
      border-radius: .85rem;
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      color: var(--foreground);
    }
    .construction-note mat-icon { flex: 0 0 auto; color: var(--primary); }
    .construction-note p { max-width: 72ch; line-height: 1.5; }
    .catalog-warning {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .8rem 1rem;
      border-radius: .85rem;
      background: color-mix(in srgb, #f59e0b 12%, var(--tc-surface-container-lowest));
      color: var(--foreground);
    }
    .opening-balance-section { padding: 1rem; border-radius: 1rem; background: var(--tc-surface-container-low); }
    .balance-note { display: flex; gap: .7rem; align-items: flex-start; padding: .8rem 1rem; border-radius: .85rem; background: var(--tc-surface-container-lowest); }
    .balance-note mat-icon { color: var(--primary); flex: 0 0 auto; }
    .balance-note p { max-width: 72ch; color: var(--muted-foreground); line-height: 1.45; }
    .catalog-warning.legacy { align-items: flex-start; }
    .catalog-warning mat-icon { flex: 0 0 auto; color: #9a5b00; }
    .catalog-warning p { flex: 1 1 auto; line-height: 1.45; }
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
  private readonly authorization = inject(AuthorizationService);

  protected readonly empleadoId = signal<string | null>(null);
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly cargos = signal<CargoNomina[]>([]);
  protected readonly departamentos = signal<DepartamentoNomina[]>([]);
  protected readonly cargoLegacy = signal('');
  protected readonly departamentoLegacy = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saldoInicialActivo = signal(false);
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  private saldoInicialActual: SaldoInicialLaboralEmpleado | null = null;
  private empleadoActual: EmpleadoNomina | null = null;

  protected readonly form = this.formBuilder.group({
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    nombres: ['', [Validators.required]],
    apellidos: ['', [Validators.required]],
    email: [''],
    telefono: [''],
    cargoId: ['', [Validators.required]],
    departamentoId: [''],
    fechaIngreso: [new Date() as Date | null, [Validators.required]],
    sueldoBase: [0, [Validators.required, Validators.min(0.01)]],
    estado: ['ACTIVO' as EmpleadoNomina['estado'], [Validators.required]],
    modoDecimoTercero: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    modoDecimoCuarto: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    modoFondosReserva: ['ACUMULADO' as ModoDecimos, [Validators.required]],
    regimenFondosReserva: ['GENERAL' as RegimenFondosReserva, [Validators.required]],
    cargasFamiliares: [0],
    saldoFechaCorte: [null as Date | null],
    saldoDecimoTercero: [0],
    saldoDecimoCuarto: [0],
    saldoFondosReserva: [0],
    saldoDiasVacaciones: [0],
    saldoValorVacaciones: [0],
    saldoConfirmadoCero: [false],
    saldoReferencia: [''],
    saldoObservacion: [''],
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({})
  });

  /** Explica la fecha de inicio según la clasificación individual del trabajador. */
  protected avisoFondosReserva(): string {
    if (this.form.controls.regimenFondosReserva.value === 'CONSTRUCCION') {
      return 'Régimen construcción: causa fondos desde el primer día trabajado.';
    }
    if (this.form.controls.regimenFondosReserva.value === 'SERVICIOS_COMPLEMENTARIOS') {
      return 'Servicios complementarios: causa fondos desde el primer día trabajado.';
    }
    const fecha = this.form.controls.fechaIngreso.value;
    if (!fecha) {
      return '';
    }
    const inicioDerecho = new Date(fecha.getFullYear() + 1, fecha.getMonth(), fecha.getDate());
    return `Régimen general: causa fondos desde el ${inicioDerecho.toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}.`;
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('saldoInicial') === '1') {
      this.saldoInicialActivo.set(true);
    }
    this.nominaService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => this.camposPersonalizados.set(config.camposPersonalizados ?? []));

    this.nominaService.getCargos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cargos) => {
      this.cargos.set(cargos);
      this.resolverCatalogosLegacy();
    });
    this.nominaService.getDepartamentos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((departamentos) => {
      this.departamentos.set(departamentos);
      this.resolverCatalogosLegacy();
    });

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
    if (!this.canUpdate()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.guardando.set(true);
    try {
      const raw = this.form.getRawValue();
      const empleadoId = await this.nominaService.guardarEmpleado({
        ...this.empleadoActual,
        id: this.empleadoId() ?? undefined,
        cedula: raw.cedula ?? '',
        nombres: raw.nombres ?? '',
        apellidos: raw.apellidos ?? '',
        email: raw.email ?? '',
        telefono: raw.telefono ?? '',
        cargoId: raw.cargoId ?? '',
        cargo: this.cargos().find((item) => item.id === raw.cargoId)?.nombre ?? '',
        departamentoId: raw.departamentoId ?? '',
        departamento: this.departamentos().find((item) => item.id === raw.departamentoId)?.nombre ?? '',
        fechaIngreso: dateAIso(raw.fechaIngreso),
        sueldoBase: Number(raw.sueldoBase ?? 0),
        estado: raw.estado ?? 'ACTIVO',
        modoDecimoTercero: raw.modoDecimoTercero ?? 'ACUMULADO',
        modoDecimoCuarto: raw.modoDecimoCuarto ?? 'ACUMULADO',
        modoFondosReserva: raw.modoFondosReserva ?? 'ACUMULADO',
        regimenFondosReserva: raw.regimenFondosReserva ?? 'GENERAL',
        cargasFamiliares: Number(raw.cargasFamiliares ?? 0),
        camposPersonalizados: raw.camposPersonalizados ?? {}
      });
      if (this.saldoInicialActivo()) {
        await this.guardarSaldoInicial(empleadoId, raw);
      } else if (!this.empleadoId()) {
        await this.nominaService.guardarSaldoInicialLaboral({
          empleadoId,
          fechaCorte: dateAIso(raw.fechaIngreso),
          decimoTerceroPendiente: 0,
          decimoCuartoPendiente: 0,
          fondosReservaPendiente: 0,
          diasVacacionesPendientes: 0,
          valorVacacionesPendiente: 0,
          confirmadoSinSaldos: true,
          observacion: 'Empleado administrado en WinSuite desde su ingreso.'
        });
      }
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
      cargoId: empleado.cargoId ?? '',
      departamentoId: empleado.departamentoId ?? '',
      fechaIngreso: isoADate(empleado.fechaIngreso),
      sueldoBase: empleado.sueldoBase,
      estado: empleado.estado,
      modoDecimoTercero: empleado.modoDecimoTercero ?? 'ACUMULADO',
      modoDecimoCuarto: empleado.modoDecimoCuarto ?? 'ACUMULADO',
      modoFondosReserva: empleado.modoFondosReserva ?? 'ACUMULADO',
      regimenFondosReserva: empleado.regimenFondosReserva ?? 'GENERAL',
      cargasFamiliares: empleado.cargasFamiliares ?? 0,
      camposPersonalizados: empleado.camposPersonalizados ?? {}
    });
    this.cargoLegacy.set(empleado.cargoId ? '' : empleado.cargo);
    this.departamentoLegacy.set(empleado.departamentoId ? '' : empleado.departamento ?? '');
    this.resolverCatalogosLegacy();
    const saldo = await this.nominaService.getSaldoInicialLaboral(id);
    if (saldo) {
      this.saldoInicialActual = saldo;
      this.saldoInicialActivo.set(true);
      this.form.patchValue({
        saldoFechaCorte: isoADate(saldo.fechaCorte),
        saldoDecimoTercero: saldo.decimoTerceroPendiente,
        saldoDecimoCuarto: saldo.decimoCuartoPendiente,
        saldoFondosReserva: saldo.fondosReservaPendiente,
        saldoDiasVacaciones: saldo.diasVacacionesPendientes,
        saldoValorVacaciones: saldo.valorVacacionesPendiente,
        saldoConfirmadoCero: saldo.confirmadoSinSaldos,
        saldoReferencia: saldo.referenciaDocumental ?? '',
        saldoObservacion: saldo.observacion ?? ''
      });
    }
  }

  protected activarSaldoInicial(): void {
    this.saldoInicialActivo.set(true);
    if (!this.form.controls.saldoFechaCorte.value) {
      this.form.controls.saldoFechaCorte.setValue(this.form.controls.fechaIngreso.value);
    }
  }

  private async guardarSaldoInicial(empleadoId: string, raw: ReturnType<typeof this.form.getRawValue>): Promise<void> {
    if (!raw.saldoFechaCorte) throw new Error('Selecciona la fecha de corte de los saldos laborales.');
    await this.nominaService.guardarSaldoInicialLaboral({
      ...this.saldoInicialActual,
      empleadoId,
      fechaCorte: dateAIso(raw.saldoFechaCorte),
      decimoTerceroPendiente: Number(raw.saldoDecimoTercero ?? 0),
      decimoCuartoPendiente: Number(raw.saldoDecimoCuarto ?? 0),
      fondosReservaPendiente: Number(raw.saldoFondosReserva ?? 0),
      diasVacacionesPendientes: Number(raw.saldoDiasVacaciones ?? 0),
      valorVacacionesPendiente: Number(raw.saldoValorVacaciones ?? 0),
      confirmadoSinSaldos: !!raw.saldoConfirmadoCero,
      referenciaDocumental: raw.saldoReferencia ?? '',
      observacion: raw.saldoObservacion ?? ''
    });
  }

  protected cargosSeleccionables(): CargoNomina[] {
    const actual = this.form.controls.cargoId.value;
    return this.cargos().filter((item) => item.activo || item.id === actual);
  }

  protected departamentosSeleccionables(): DepartamentoNomina[] {
    const actual = this.form.controls.departamentoId.value;
    return this.departamentos().filter((item) => item.activo || item.id === actual);
  }

  private resolverCatalogosLegacy(): void {
    if (!this.empleadoActual) {
      return;
    }
    if (!this.form.controls.cargoId.value && this.empleadoActual.cargo) {
      const cargo = this.cargos().find((item) => this.normalizarNombre(item.nombre) === this.normalizarNombre(this.empleadoActual!.cargo));
      if (cargo?.id) {
        this.form.controls.cargoId.setValue(cargo.id);
        this.cargoLegacy.set('');
      }
    }
    if (!this.form.controls.departamentoId.value && this.empleadoActual.departamento) {
      const departamento = this.departamentos().find((item) => this.normalizarNombre(item.nombre) === this.normalizarNombre(this.empleadoActual!.departamento ?? ''));
      if (departamento?.id) {
        this.form.controls.departamentoId.setValue(departamento.id);
        this.departamentoLegacy.set('');
      }
    }
  }

  private normalizarNombre(value: string): string {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('es');
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

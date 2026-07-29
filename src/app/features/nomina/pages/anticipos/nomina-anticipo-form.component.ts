import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { dateAIso } from '../../../../shared/utils/fecha-input.util';
import {
  RevisarAsientoData,
  RevisarAsientoDialogComponent
} from '../../../contabilidad/components/revisar-asiento-dialog/revisar-asiento-dialog.component';
import { CuentaContableAutocompleteComponent } from '../../../contabilidad/components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AnticipoNominaDetalle } from '../../../contabilidad/models/anticipos-nomina.models';
import { AsientoContableLinea, CuentaContable } from '../../../contabilidad/models/contabilidad.models';
import { EmpleadoNomina } from '../../../contabilidad/models/nomina.models';
import { AnticiposNominaService } from '../../../contabilidad/services/anticipos-nomina.service';
import {
  calcularDiasTrabajadosPeriodo,
  calcularProporcionalMensual
} from '../../../contabilidad/services/nomina-calculos.util';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { NominaService } from '../../../contabilidad/services/nomina.service';
import { PlanCuentasService } from '../../../contabilidad/services/plan-cuentas.service';

/** Fila editable de la tabla de empleados. */
interface FilaEmpleado {
  empleadoId: string;
  nombre: string;
  cedula: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  sueldoBase: number;
  monto: number;
}

/**
 * Lo que el empleado realmente devenga en el periodo elegido. Un empleado que ingresa a mitad de
 * mes cobra proporcional, asi que su anticipo no puede medirse contra el sueldo mensual completo.
 */
interface BasePeriodo {
  dias: number;
  sueldoPeriodo: number;
  /** Piso conservador del neto: proporcional menos el aporte personal al IESS. */
  netoEstimado: number;
  /** Anticipos ya registrados para este periodo y aun no descontados en un rol. */
  anticipoPrevio: number;
  /** Lo que queda por anticipar sin dejar el rol en negativo. */
  disponible: number;
}

@Component({
  selector: 'app-nomina-anticipo-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="anticipo-form">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Nomina · Anticipos</p>
          <h2>Nuevo anticipo</h2>
          <p>Selecciona uno o varios empleados y define el monto que recibe cada uno.</p>
        </div>
        <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/anticipos">
          <mat-icon>arrow_back</mat-icon>
          Volver
        </a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      @if (avisoRolBorrador()) {
        <section class="aviso-box">
          <mat-icon>info</mat-icon>
          <span>
            El rol mensual de {{ periodo() }} ya esta generado en borrador. Despues de registrar el anticipo,
            abre el rol y usa <strong>Traer anticipos del periodo</strong> para incluirlo.
          </span>
        </section>
      }

      <section class="surface-card form-card">
        <h3>Datos del anticipo</h3>
        <div class="grid-datos">
          <mat-form-field appearance="outline">
            <mat-label>Periodo a descontar</mat-label>
            <input matInput type="month" [ngModel]="periodo()" (ngModelChange)="cambiarPeriodo($event)" name="periodo" />
            <mat-hint>Rol en el que se descontara</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de entrega</mat-label>
            <input matInput [matDatepicker]="pickerEntrega" [(ngModel)]="fechaEntregaDate" name="fechaEntrega" />
            <mat-datepicker-toggle matSuffix [for]="pickerEntrega"></mat-datepicker-toggle>
            <mat-datepicker #pickerEntrega></mat-datepicker>
          </mat-form-field>

          <app-cuenta-contable-autocomplete
            [cuentas]="cuentas()"
            [cuentaId]="cuentaOrigenId()"
            [mostrarNumero]="false"
            label="Cuenta de origen (caja / banco)"
            (cuentaSeleccionada)="cuentaOrigenId.set($event?.id ?? '')"
          />
        </div>

        <mat-form-field appearance="outline" class="concepto-field">
          <mat-label>Concepto</mat-label>
          <input matInput [ngModel]="concepto()" (ngModelChange)="concepto.set($event)" name="concepto" maxlength="120" />
          <mat-hint>Se copia a cada linea del asiento junto al nombre del empleado</mat-hint>
        </mat-form-field>
      </section>

      <section class="surface-card table-card">
        <header class="table-head">
          <h3>Empleados</h3>
          <div class="filtros">
            <mat-form-field appearance="outline">
              <mat-label>Buscar empleado</mat-label>
              <input matInput [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" name="busqueda" />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            @if (departamentos().length > 0) {
              <mat-form-field appearance="outline">
                <mat-label>Departamento</mat-label>
                <mat-select [ngModel]="departamento()" (ngModelChange)="departamento.set($event)" name="departamento">
                  <mat-option value="">Todos</mat-option>
                  @for (item of departamentos(); track item) {
                    <mat-option [value]="item">{{ item }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </div>
        </header>

        <div class="masivo">
          <span class="masivo-label">Aplicar a seleccionados</span>
          <mat-form-field appearance="outline">
            <mat-label>Monto fijo</mat-label>
            <input matInput type="text" inputmode="decimal" appTwoDecimalInput [ngModel]="montoMasivo()" (ngModelChange)="montoMasivo.set($event)" name="montoMasivo" />
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="aplicarMonto()" [disabled]="seleccionados().length === 0">
            Aplicar monto
          </button>
          <mat-form-field appearance="outline">
            <mat-label>% del sueldo</mat-label>
            <input matInput type="number" min="0" max="100" step="1" [ngModel]="porcentajeMasivo()" (ngModelChange)="porcentajeMasivo.set($event)" name="porcentajeMasivo" />
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="aplicarPorcentaje()" [disabled]="seleccionados().length === 0">
            Aplicar %
          </button>
        </div>

        @if (conAnticipoPrevio() > 0) {
          <p class="nota-periodo">
            <mat-icon>history</mat-icon>
            {{ conAnticipoPrevio() }} empleado(s) ya tienen anticipos de {{ periodo() }} sin descontar.
            El rol descontara la suma de todos, asi que su cupo disponible ya viene reducido.
          </p>
        }

        @if (sinDiasEnPeriodo() > 0) {
          <p class="nota-periodo">
            <mat-icon>info</mat-icon>
            {{ sinDiasEnPeriodo() }} empleado(s) no aparecen porque ingresan despues de {{ periodo() }}:
            no entran al rol de ese periodo, asi que su anticipo no se podria descontar.
          </p>
        }

        @if (cargando()) {
          <div class="empty-state"><mat-icon>hourglass_top</mat-icon><h3>Cargando empleados</h3></div>
        } @else if (filas().length === 0) {
          <div class="empty-state">
            <mat-icon>badge</mat-icon>
            <h3>Sin empleados activos</h3>
            <p>Registra empleados activos en nomina para poder darles un anticipo.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="check">
                    <mat-checkbox
                      [checked]="todosSeleccionados()"
                      [indeterminate]="algunoSeleccionado() && !todosSeleccionados()"
                      (change)="alternarTodos($event.checked)"
                      aria-label="Seleccionar todos los empleados visibles"
                    ></mat-checkbox>
                  </th>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th class="num">Sueldo del periodo</th>
                  <th class="num monto-col">Monto anticipo</th>
                  <th class="num">% del periodo</th>
                  <th class="alerta-col"></th>
                </tr>
              </thead>
              <tbody>
                @for (fila of filasVisibles(); track fila.empleadoId) {
                  <tr [class.seleccionada]="seleccion().has(fila.empleadoId)" [class.sobre-neto]="superaNeto(fila)">
                    <td class="check">
                      <mat-checkbox
                        [checked]="seleccion().has(fila.empleadoId)"
                        (change)="alternar(fila, $event.checked)"
                        [attr.aria-label]="'Seleccionar ' + fila.nombre"
                      ></mat-checkbox>
                    </td>
                    <td>
                      <strong>{{ fila.nombre }}</strong>
                      <span class="sub">{{ fila.cedula }}</span>
                    </td>
                    <td>{{ fila.cargo || '—' }}</td>
                    <td class="num">
                      {{ base(fila).sueldoPeriodo | currency:'USD':'symbol-narrow':'1.2-2' }}
                      @if (base(fila).dias < 30) {
                        <span class="sub">{{ base(fila).dias }} de 30 dias · mensual {{ fila.sueldoBase | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
                      }
                      @if (base(fila).anticipoPrevio > 0) {
                        <span class="sub previo">
                          Ya anticipado {{ base(fila).anticipoPrevio | currency:'USD':'symbol-narrow':'1.2-2' }}
                          · disponible {{ base(fila).disponible | currency:'USD':'symbol-narrow':'1.2-2' }}
                        </span>
                      }
                    </td>
                    <td class="num monto-col">
                      <mat-form-field appearance="outline" class="monto-field">
                        <input
                          matInput
                          type="text"
                          inputmode="decimal"
                          appTwoDecimalInput
                          [ngModel]="fila.monto"
                          (ngModelChange)="cambiarMonto(fila, $event)"
                          [name]="'monto-' + fila.empleadoId"
                          [attr.aria-label]="'Monto de anticipo de ' + fila.nombre"
                        />
                      </mat-form-field>
                    </td>
                    <td class="num">{{ porcentaje(fila) }}</td>
                    <td class="alerta-col">
                      @if (superaNeto(fila)) {
                        <mat-icon class="alerta" [matTooltip]="avisoSobreNeto(fila)" aria-hidden="false" [attr.aria-label]="avisoSobreNeto(fila)">warning</mat-icon>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      @if (filasSobreNeto().length > 0) {
        <section class="aviso-box">
          <mat-icon>warning</mat-icon>
          <span>
            <strong>{{ filasSobreNeto().length }} empleado(s)</strong> tienen un anticipo mayor a su neto
            estimado del periodo y dejaran el rol en negativo:
            {{ nombresSobreNeto() }}. Puedes registrarlo igual si es lo que acordaste.
          </span>
        </section>
      }

      <footer class="surface-card resumen-bar">
        <div class="resumen-datos">
          <span><strong>{{ seleccionados().length }}</strong> empleado(s) con anticipo</span>
          <span class="total">Total {{ total() | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
        </div>
        <div class="resumen-acciones">
          <button mat-button type="button" (click)="limpiar()" [disabled]="seleccion().size === 0">Limpiar</button>
          <button
            mat-raised-button
            color="primary"
            type="button"
            (click)="generar()"
            [disabled]="!puedeGenerar() || procesando()"
            [matTooltip]="tooltipGenerar()"
          >
            <mat-icon>account_balance_wallet</mat-icon>
            Generar anticipo
          </button>
        </div>
      </footer>
    </section>
  `,
  styles: [`
    .anticipo-form { display: grid; gap: 1rem; padding-bottom: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .header-copy > p:not(.eyebrow) { margin: .4rem 0 0; color: var(--muted-foreground); }
    .form-card, .table-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .form-card h3, .table-head h3 { margin: 0 0 .85rem; font-size: 1rem; }
    .grid-datos { display: grid; grid-template-columns: minmax(180px, 220px) minmax(180px, 220px) minmax(260px, 1fr); gap: .75rem; align-items: start; }
    .concepto-field { width: 100%; margin-top: .25rem; }
    .table-head { display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; }
    .filtros { display: flex; gap: .75rem; flex-wrap: wrap; }
    .masivo { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; padding: .75rem; margin-bottom: .5rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 7%, transparent); }
    .masivo-label { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .masivo mat-form-field { width: 140px; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 860px; }
    th, td { text-align: left; padding: .45rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .check { width: 48px; }
    .monto-col { width: 160px; }
    .monto-field { width: 130px; }
    .monto-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .monto-field ::ng-deep input { text-align: right; }
    tr.seleccionada { background: color-mix(in srgb, var(--primary) 6%, transparent); }
    tr.sobre-neto { background: color-mix(in srgb, #f59e0b 12%, transparent); }
    .alerta-col { width: 44px; text-align: center; }
    .alerta { color: #b45309; cursor: help; }
    .nota-periodo { display: flex; gap: .5rem; align-items: center; margin: 0 0 .75rem; font-size: .85rem; color: var(--muted-foreground); }
    .nota-periodo mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .sub { display: block; margin-top: .12rem; font-size: .78rem; color: var(--muted-foreground); }
    .sub.previo { color: #b45309; font-weight: 600; }
    .resumen-bar { position: sticky; bottom: 0; z-index: 2; padding: .85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: var(--tc-surface-container-lowest); box-shadow: 0 -6px 20px color-mix(in srgb, var(--foreground) 8%, transparent); }
    .resumen-datos { display: flex; gap: 1.25rem; align-items: baseline; flex-wrap: wrap; }
    .resumen-datos .total { font-size: 1.2rem; font-weight: 700; }
    .resumen-acciones { display: flex; gap: .6rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; }
    .empty-state mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: color-mix(in srgb, var(--primary) 55%, transparent); }
    .empty-state h3, .empty-state p { margin: 0; }
    .empty-state p { color: var(--muted-foreground); }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    .aviso-box { display: flex; gap: .6rem; align-items: center; padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #f59e0b 14%, transparent); }
    @media (max-width: 900px) {
      .grid-datos { grid-template-columns: 1fr; }
      .filtros mat-form-field { width: 100%; }
    }
  `]
})
export class NominaAnticipoFormComponent implements OnInit {
  private readonly anticiposService = inject(AnticiposNominaService);
  private readonly nominaService = inject(NominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly filas = signal<FilaEmpleado[]>([]);
  /** Fichas tal como se cargaron: fuente inmutable para recalcular al cambiar de periodo. */
  private readonly fichas = signal<EmpleadoNomina[]>([]);
  private readonly porcentajeIess = signal(9.45);
  /** Anticipos ya registrados del periodo por empleado: el nuevo anticipo se suma a estos en el rol. */
  private readonly anticiposPrevios = signal<Map<string, number>>(new Map());
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly seleccion = signal<Set<string>>(new Set());
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly avisoRolBorrador = signal(false);

  protected readonly periodo = signal(new Date().toISOString().slice(0, 7));
  protected readonly concepto = signal('');
  protected readonly cuentaOrigenId = signal('');
  private readonly cuentaAnticipoId = signal('');
  protected readonly busqueda = signal('');
  protected readonly departamento = signal('');
  /** Mientras se teclea el input entrega texto ("600."); se convierte al aplicarlo. */
  protected readonly montoMasivo = signal<number | string | null>(null);
  protected readonly porcentajeMasivo = signal<number | null>(50);

  /**
   * Referencia Date estable para el datepicker: un getter que derive un Date nuevo por ciclo
   * haria que matDatepicker lo lea como valor distinto en cada deteccion de cambios.
   */
  protected fechaEntregaDate: Date | null = new Date();

  protected readonly departamentos = computed(() => Array.from(
    new Set(this.filas().map((fila) => fila.departamento).filter((valor) => !!valor))
  ).sort());

  /**
   * Dias devengados y sueldo proporcional de cada empleado en el periodo elegido. Se deriva de las
   * fichas (no de las filas) para no recalcularse en cada tecleo de monto.
   */
  private readonly basesPeriodo = computed(() => {
    const periodo = this.periodo();
    const factorIess = 1 - (this.porcentajeIess() / 100);
    const previos = this.anticiposPrevios();
    const bases = new Map<string, BasePeriodo>();
    for (const ficha of this.fichas()) {
      const empleadoId = ficha.id ?? '';
      const dias = calcularDiasTrabajadosPeriodo(ficha.fechaIngreso, periodo);
      const sueldoPeriodo = calcularProporcionalMensual(Number(ficha.sueldoBase ?? 0), dias);
      const netoEstimado = this.redondear(sueldoPeriodo * factorIess);
      const anticipoPrevio = this.redondear(previos.get(empleadoId) ?? 0);
      bases.set(empleadoId, {
        dias,
        sueldoPeriodo,
        netoEstimado,
        anticipoPrevio,
        disponible: Math.max(0, this.redondear(netoEstimado - anticipoPrevio))
      });
    }
    return bases;
  });

  protected readonly filasVisibles = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const departamento = this.departamento();
    const bases = this.basesPeriodo();
    return this.filas().filter((fila) =>
      // Quien aun no ingresa en el periodo no entra al rol, asi que su anticipo nunca se descontaria.
      (bases.get(fila.empleadoId)?.dias ?? 0) > 0
      && (!departamento || fila.departamento === departamento)
      && (!termino || fila.nombre.toLowerCase().includes(termino) || fila.cedula.includes(termino))
    );
  });

  /** Empleados excluidos por no devengar dias en el periodo, para explicarlo en pantalla. */
  protected readonly sinDiasEnPeriodo = computed(() =>
    this.filas().filter((fila) => (this.basesPeriodo().get(fila.empleadoId)?.dias ?? 0) === 0).length
  );

  /** Empleados que ya recibieron un anticipo de este periodo y aun no se les descuenta. */
  protected readonly conAnticipoPrevio = computed(() =>
    this.filasVisibles().filter((fila) => (this.basesPeriodo().get(fila.empleadoId)?.anticipoPrevio ?? 0) > 0).length
  );

  /** Filas cuyo anticipo deja el rol en negativo: se avisa, no se bloquea. */
  protected readonly filasSobreNeto = computed(() => this.seleccionados().filter((fila) => this.superaNeto(fila)));
  protected readonly nombresSobreNeto = computed(() => {
    const nombres = this.filasSobreNeto().map((fila) => fila.nombre);
    return nombres.length <= 3
      ? nombres.join(', ')
      : `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} mas`;
  });

  protected readonly seleccionados = computed(() => this.filas().filter((fila) =>
    this.seleccion().has(fila.empleadoId) && this.redondear(fila.monto) > 0
  ));
  protected readonly total = computed(() => this.redondear(
    this.seleccionados().reduce((suma, fila) => suma + fila.monto, 0)
  ));
  protected readonly todosSeleccionados = computed(() => {
    const visibles = this.filasVisibles();
    return visibles.length > 0 && visibles.every((fila) => this.seleccion().has(fila.empleadoId));
  });
  protected readonly algunoSeleccionado = computed(() =>
    this.filasVisibles().some((fila) => this.seleccion().has(fila.empleadoId))
  );
  protected readonly puedeGenerar = computed(() =>
    this.seleccionados().length > 0 && !!this.concepto().trim() && !!this.periodo()
  );
  protected readonly tooltipGenerar = computed(() => {
    if (!this.concepto().trim()) {
      return 'Escribe el concepto del anticipo';
    }
    if (this.seleccionados().length === 0) {
      return 'Selecciona al menos un empleado con monto mayor a cero';
    }
    return '';
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.waitForInitialBootstrap();
      this.concepto.set(this.conceptoPorDefecto(this.periodo()));

      const [empleados, cuentas, configNomina, configIntegracion] = await Promise.all([
        firstValueFrom(this.nominaService.getEmpleados()),
        this.planCuentasService.getCuentasOnce(),
        this.nominaService.getConfiguracionOnce(),
        this.integracionContable.getConfiguracionOnce()
      ]);

      const activos = empleados.filter((empleado) => empleado.estado === 'ACTIVO');
      this.fichas.set(activos);
      this.filas.set(activos.map((empleado) => ({
        empleadoId: empleado.id ?? '',
        nombre: `${empleado.apellidos} ${empleado.nombres}`.trim(),
        cedula: empleado.cedula ?? '',
        cargo: empleado.cargo ?? '',
        departamento: empleado.departamento ?? '',
        fechaIngreso: empleado.fechaIngreso ?? '',
        sueldoBase: Number(empleado.sueldoBase ?? 0),
        monto: 0
      })));
      this.cuentas.set(cuentas);
      this.porcentajeIess.set(Number(configNomina.porcentajeAportePersonalIess ?? 9.45));
      this.cuentaAnticipoId.set(configNomina.cuentaAnticiposEmpleadosId ?? '');
      this.cuentaOrigenId.set(configIntegracion.cuentaCajaBancoId ?? '');
      await this.revisarRolDelPeriodo();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar los datos del anticipo.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected cambiarPeriodo(periodo: string): void {
    const anterior = this.periodo();
    this.periodo.set(periodo ?? '');
    // El concepto por defecto sigue al periodo mientras el usuario no lo haya personalizado.
    if (this.concepto().trim() === this.conceptoPorDefecto(anterior)) {
      this.concepto.set(this.conceptoPorDefecto(this.periodo()));
    }
    void this.revisarRolDelPeriodo();
  }

  protected alternar(fila: FilaEmpleado, seleccionado: boolean): void {
    const siguiente = new Set(this.seleccion());
    if (seleccionado) {
      siguiente.add(fila.empleadoId);
      // Precarga el porcentaje sugerido para no obligar a teclear caso por caso.
      if (this.redondear(fila.monto) <= 0) {
        this.asignarMonto(fila, this.montoPorPorcentaje(fila, this.porcentajeMasivo() ?? 0));
      }
    } else {
      siguiente.delete(fila.empleadoId);
      this.asignarMonto(fila, 0);
    }
    this.seleccion.set(siguiente);
  }

  protected alternarTodos(seleccionado: boolean): void {
    const siguiente = new Set(this.seleccion());
    for (const fila of this.filasVisibles()) {
      if (seleccionado) {
        siguiente.add(fila.empleadoId);
        if (this.redondear(fila.monto) <= 0) {
          this.asignarMonto(fila, this.montoPorPorcentaje(fila, this.porcentajeMasivo() ?? 0));
        }
      } else {
        siguiente.delete(fila.empleadoId);
        this.asignarMonto(fila, 0);
      }
    }
    this.seleccion.set(siguiente);
  }

  /** Escribir un monto selecciona la fila: es el gesto natural de "a este si le doy anticipo". */
  protected cambiarMonto(fila: FilaEmpleado, monto: number | string): void {
    const valor = this.redondear(Number(monto) || 0);
    this.asignarMonto(fila, valor);
    const siguiente = new Set(this.seleccion());
    if (valor > 0) {
      siguiente.add(fila.empleadoId);
    } else {
      siguiente.delete(fila.empleadoId);
    }
    this.seleccion.set(siguiente);
  }

  protected aplicarMonto(): void {
    const monto = this.redondear(Number(this.montoMasivo()) || 0);
    for (const fila of this.filasVisibles()) {
      if (this.seleccion().has(fila.empleadoId)) {
        this.asignarMonto(fila, monto);
      }
    }
  }

  protected aplicarPorcentaje(): void {
    const porcentaje = Number(this.porcentajeMasivo()) || 0;
    for (const fila of this.filasVisibles()) {
      if (this.seleccion().has(fila.empleadoId)) {
        this.asignarMonto(fila, this.montoPorPorcentaje(fila, porcentaje));
      }
    }
  }

  protected limpiar(): void {
    this.seleccion.set(new Set());
    this.filas.update((filas) => filas.map((fila) => ({ ...fila, monto: 0 })));
  }

  protected base(fila: FilaEmpleado): BasePeriodo {
    return this.basesPeriodo().get(fila.empleadoId) ?? {
      dias: 30,
      sueldoPeriodo: fila.sueldoBase,
      netoEstimado: fila.sueldoBase,
      anticipoPrevio: 0,
      disponible: fila.sueldoBase
    };
  }

  /** Porcentaje sobre lo devengado en el periodo, no sobre el sueldo mensual completo. */
  protected porcentaje(fila: FilaEmpleado): string {
    const sueldoPeriodo = this.base(fila).sueldoPeriodo;
    if (!sueldoPeriodo || this.redondear(fila.monto) <= 0) {
      return '—';
    }
    return `${Math.round((fila.monto / sueldoPeriodo) * 100)}%`;
  }

  /** Se mide contra el cupo que queda, porque el rol suma este anticipo a los ya registrados. */
  protected superaNeto(fila: FilaEmpleado): boolean {
    const monto = this.redondear(fila.monto);
    return monto > 0 && monto > this.base(fila).disponible;
  }

  protected avisoSobreNeto(fila: FilaEmpleado): string {
    const base = this.base(fila);
    const contexto = base.dias < 30 ? ` (${base.dias} de 30 dias trabajados)` : '';
    if (base.anticipoPrevio > 0) {
      return `Ya tiene ${base.anticipoPrevio.toFixed(2)} anticipado en este periodo${contexto}. `
        + `Solo quedan ${base.disponible.toFixed(2)} antes de que el rol quede en negativo: `
        + `el rol descuenta la suma de todos los anticipos del periodo.`;
    }
    return `El anticipo supera el neto estimado del periodo${contexto}: `
      + `${base.disponible.toFixed(2)}. El rol quedara en negativo.`;
  }

  /**
   * Registro en dos pasos, igual que compras y cuentas por pagar: se propone el asiento y el
   * contador lo revisa antes de confirmar. Si cancela, no se registra nada.
   */
  protected async generar(): Promise<void> {
    if (!this.puedeGenerar()) {
      return;
    }
    this.error.set(null);
    this.procesando.set(true);
    try {
      const detalles = this.construirDetalles();

      if (!(await this.integracionContable.contabilidadActiva())) {
        this.procesando.set(false);
        this.confirmarSinAsiento(detalles);
        return;
      }

      const lineas = await this.anticiposService.construirLineasAnticipo({
        periodo: this.periodo(),
        concepto: this.concepto(),
        cuentaAnticipoId: this.cuentaAnticipoId(),
        cuentaOrigenId: this.cuentaOrigenId()
      }, detalles);

      const data: RevisarAsientoData = {
        titulo: 'Revisar asiento del anticipo',
        subtitulo: `${detalles.length} empleado(s) · Periodo ${this.periodo()} · Total ${this.total().toFixed(2)}`,
        lineas,
        cuentas: this.cuentas()
      };
      this.procesando.set(false);

      const confirmadas = await firstValueFrom(
        this.dialog.open<RevisarAsientoDialogComponent, RevisarAsientoData, AsientoContableLinea[] | undefined>(
          RevisarAsientoDialogComponent,
          { maxWidth: '96vw', data }
        ).afterClosed()
      );
      if (!confirmadas) {
        return;
      }

      this.procesando.set(true);
      await this.registrar(detalles, confirmadas);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo generar el anticipo.');
    } finally {
      this.procesando.set(false);
    }
  }

  private confirmarSinAsiento(detalles: AnticipoNominaDetalle[]): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Registrar anticipo',
        message: 'La contabilidad automatica esta desactivada: el anticipo se registrara sin generar asiento. Continuar?',
        confirmText: 'Registrar'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.procesando.set(true);
      try {
        await this.registrar(detalles);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo generar el anticipo.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  private async registrar(detalles: AnticipoNominaDetalle[], lineas?: AsientoContableLinea[]): Promise<void> {
    await this.anticiposService.registrarAnticipo({
      periodo: this.periodo(),
      fecha: dateAIso(this.fechaEntregaDate),
      concepto: this.concepto(),
      cuentaAnticipoId: this.cuentaAnticipoId(),
      cuentaOrigenId: this.cuentaOrigenId()
    }, detalles, lineas);

    this.toast(
      detalles.length === 1 ? 'Anticipo registrado.' : `Anticipo registrado para ${detalles.length} empleados.`,
      'account_balance_wallet'
    );
    await this.router.navigate(['/workspace/contabilidad/nomina/anticipos']);
  }

  private construirDetalles(): AnticipoNominaDetalle[] {
    return this.seleccionados().map((fila) => {
      const base = this.base(fila);
      return {
        empleadoId: fila.empleadoId,
        empleadoNombre: fila.nombre,
        cedula: fila.cedula,
        cargo: fila.cargo,
        sueldoBase: fila.sueldoBase,
        diasTrabajadosPeriodo: base.dias,
        sueldoPeriodo: base.sueldoPeriodo,
        monto: this.redondear(fila.monto),
        observacion: ''
      };
    });
  }

  /**
   * Estado del periodo elegido: si ya hay un rol y cuanto se anticipó antes. Ambos cambian el
   * cupo disponible de cada empleado, asi que se recargan cada vez que cambia el periodo.
   */
  private async revisarRolDelPeriodo(): Promise<void> {
    this.avisoRolBorrador.set(false);
    this.anticiposPrevios.set(new Map());
    if (!/^\d{4}-\d{2}$/.test(this.periodo())) {
      return;
    }
    try {
      this.anticiposPrevios.set(await this.anticiposService.getPendientesPorEmpleado(this.periodo()));
    } catch {
      // Sin lectura de anticipos previos el cupo se calcula solo con el sueldo del periodo.
    }
    try {
      const rol = await this.anticiposService.buscarRolMensual(this.periodo());
      this.avisoRolBorrador.set(rol?.estado === 'BORRADOR');
      if (rol?.estado === 'APROBADO') {
        this.error.set(`El rol mensual de ${this.periodo()} ya esta aprobado: elige otro periodo para el anticipo.`);
      } else {
        this.error.set(null);
      }
    } catch {
      // Sin rol legible no se bloquea el registro: el servicio revalida al guardar.
    }
  }

  private asignarMonto(fila: FilaEmpleado, monto: number): void {
    this.filas.update((filas) => filas.map((item) =>
      item.empleadoId === fila.empleadoId ? { ...item, monto } : item
    ));
  }

  /**
   * El porcentaje se aplica sobre lo devengado en el periodo y se topa al cupo que queda tras los
   * anticipos ya registrados: sugerir mas seria proponer un rol en negativo. El usuario siempre
   * puede escribir un monto mayor a mano.
   */
  private montoPorPorcentaje(fila: FilaEmpleado, porcentaje: number): number {
    const base = this.base(fila);
    return Math.min(this.redondear(base.sueldoPeriodo * (porcentaje / 100)), base.disponible);
  }

  private conceptoPorDefecto(periodo: string): string {
    return periodo ? `Anticipo de sueldo ${periodo}` : 'Anticipo de sueldo';
  }

  private redondear(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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

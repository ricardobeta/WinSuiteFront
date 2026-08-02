import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import {
  RevisarAsientoData,
  RevisarAsientoDialogComponent
} from '../../../contabilidad/components/revisar-asiento-dialog/revisar-asiento-dialog.component';
import { AsientoContableLinea } from '../../../contabilidad/models/contabilidad.models';
import {
  ConceptoProvision,
  ConfiguracionNominaContable,
  RolPago,
  RolPagoDetalle,
  RolPagoLinea,
  RubroNomina
} from '../../../contabilidad/models/nomina.models';
import { AnticiposNominaService } from '../../../contabilidad/services/anticipos-nomina.service';
import { calcularDiasFondosReservaPeriodo } from '../../../contabilidad/services/nomina-calculos.util';
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { NominaPdfApiService } from '../../../contabilidad/services/nomina-pdf-api.service';
import { NominaService } from '../../../contabilidad/services/nomina.service';
import { PlanCuentasService } from '../../../contabilidad/services/plan-cuentas.service';
import {
  FilaDesglose,
  aportesIessDetalle,
  baseAportesIess,
  desgloseIess,
  desgloseIngresos,
  desgloseOtrosDescuentos
} from './rol-detalle-desglose.util';

type NombreSeccion = 'INGRESOS' | 'DESCUENTOS' | 'PROVISIONES' | 'IESS';

/**
 * Vista de un desglose del resumen. Las tres secciones comparten la misma tabla, asi que se
 * describen con esta forma y se pintan con una sola plantilla.
 */
interface SeccionDesglose {
  titulo: string;
  filas: FilaDesglose[];
  totalEtiqueta: string;
  total: number;
  /** Fila destacada bajo el total (la base de aportes IESS). */
  cierre?: FilaDesglose;
  nota?: string;
  enlace?: { texto: string; icono: string; ruta: string };
}

interface EmpleadoEdit {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  cargo: string;
  sueldoBase: number;
  lineas: RolPagoLinea[];
  /**
   * Reglas del empleado congeladas al generar el rol. Se conservan aparte porque `aDetalle`
   * reconstruye el detalle desde las lineas editables y, sin esto, al guardar el borrador se
   * perderian el modo de decimos y el derecho a fondos de reserva.
   */
  reglas: Pick<
    RolPagoDetalle,
    | 'modoDecimoTercero'
    | 'modoDecimoCuarto'
    | 'modoFondosReserva'
    | 'regimenFondosReserva'
    | 'aplicaFondosReserva'
    | 'sueldoMensual'
    | 'diasTrabajadosPeriodo'
    | 'diasFondosReservaPeriodo'
    | 'cargoId'
    | 'departamentoId'
    | 'departamento'
    | 'cuentaGastoSueldosId'
  >;
  resumen: RolPagoDetalle;
}

@Component({
  selector: 'app-nomina-rol-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="rol-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Nomina - {{ etiquetaTipo() }}</p>
          <h2>{{ rol()?.numero || rol()?.periodo || 'Rol de pago' }}</h2>
          <p>Periodo {{ rol()?.periodo }} · Pago {{ rol()?.fechaPago }}</p>
        </div>
        <div class="header-actions">
          <span class="pill" [class.ok]="rol()?.estado === 'APROBADO'" [class.off]="rol()?.estado === 'ANULADO'">
            {{ rol()?.estado }}
          </span>
          <button mat-stroked-button type="button" (click)="descargarComprobantes()" [disabled]="descargando()">
            <mat-icon>picture_as_pdf</mat-icon>
            Comprobantes
          </button>
          <a mat-button routerLink="/workspace/contabilidad/nomina/roles">
            <mat-icon>arrow_back</mat-icon>
            Volver
          </a>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="kpi-row">
        <article class="surface-card kpi-card">
          <span>Ingresos</span>
          <strong>{{ totales().totalIngresos | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
        </article>
        <article class="surface-card kpi-card">
          <span>IESS personal</span>
          <strong>{{ totales().aportePersonal | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
        </article>
        <article class="surface-card kpi-card" matTooltip="Aporte personal + patronal + CCC: el valor a transferir al IESS">
          <span>Planilla IESS</span>
          <strong>{{ totales().planillaIess | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
        </article>
        <article class="surface-card kpi-card">
          <span>Descuentos</span>
          <strong>{{ totales().totalDescuentos | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
        </article>
        <article class="surface-card kpi-card highlight">
          <span>Neto a pagar</span>
          <strong>{{ totales().netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
        </article>
      </section>

      @if (editable()) {
        <section class="hint">
          <mat-icon>info</mat-icon>
          Ajusta ingresos y descuentos por empleado. El IESS, las provisiones y el neto se recalculan automaticamente. Guarda el borrador y aprueba para generar el asiento contable.
        </section>
      }

      @if (editable() && empleadosConAnticipoPendiente() > 0) {
        <section class="hint aviso">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>
            Hay {{ empleadosConAnticipoPendiente() }} empleado(s) con anticipos del periodo que aun no estan
            descontados en este rol.
          </span>
          <button mat-stroked-button type="button" (click)="traerAnticipos()" [disabled]="procesando()">
            <mat-icon>download</mat-icon>
            Traer anticipos del periodo
          </button>
        </section>
      }

      <section class="empleados">
        @for (item of empleados(); track item.id; let i = $index) {
          <mat-expansion-panel class="surface-card">
            <mat-expansion-panel-header>
              <mat-panel-title>{{ item.empleadoNombre }}</mat-panel-title>
              <mat-panel-description>
                <span class="desc-cargo">{{ item.cargo }}</span>
                <span class="desc-neto" [class.negativo]="item.resumen.netoPagar < 0">
                  @if (item.resumen.netoPagar < 0) { <mat-icon>warning</mat-icon> }
                  Neto {{ item.resumen.netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}
                </span>
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="editor">
              <div class="base-row">
                <div>
                  <span>Remuneración del período</span>
                  @if ((item.resumen.diasTrabajadosPeriodo ?? 30) < 30) {
                    <small>
                      Sueldo mensual
                      {{ item.resumen.sueldoMensual | currency:'USD':'symbol-narrow':'1.2-2' }}
                      · {{ item.resumen.diasTrabajadosPeriodo }} de 30 días
                    </small>
                  }
                </div>
                <strong>{{ item.sueldoBase | currency:'USD':'symbol-narrow':'1.2-2' }}</strong>
              </div>

              <div class="lineas">
                @for (linea of item.lineas; track $index; let j = $index) {
                  <div class="linea-row">
                    <mat-form-field appearance="outline" class="rubro-field">
                      <mat-label>Rubro</mat-label>
                      <mat-select [ngModel]="linea.rubroId" (ngModelChange)="cambiarRubro(item, j, $event)" [disabled]="!editable()">
                        @for (rubro of rubros(); track rubro.id) {
                          <mat-option [value]="rubro.id">{{ rubro.nombre }} ({{ rubro.tipo === 'INGRESO' ? '+' : '-' }})</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="monto-field">
                      <mat-label>{{ linea.tipo === 'INGRESO' ? 'Ingreso' : 'Descuento' }}</mat-label>
                      <input
                        matInput
                        type="text"
                        inputmode="decimal"
                        appTwoDecimalInput
                        [ngModel]="linea.monto"
                        (ngModelChange)="actualizarMonto(item, j, $event)"
                        [disabled]="!editable()"
                      />
                    </mat-form-field>

                    @if (editable()) {
                      <button mat-icon-button color="warn" type="button" (click)="quitarLinea(item, j)" aria-label="Quitar linea">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>
                }

                @if (item.lineas.length === 0) {
                  <p class="muted">Sin ingresos ni descuentos adicionales.</p>
                }
              </div>

              @if (editable()) {
                <button mat-stroked-button type="button" (click)="agregarLinea(item)" [disabled]="rubros().length === 0">
                  <mat-icon>add</mat-icon>
                  Agregar rubro
                </button>
              }

              <dl class="resumen">
                <div class="fila-expandible">
                  <dt>Total ingresos</dt>
                  <dd>
                    {{ item.resumen.totalIngresos | currency:'USD':'symbol-narrow':'1.2-2' }}
                    <button mat-icon-button type="button" (click)="alternarSeccion(item.id, 'INGRESOS')"
                      [attr.aria-expanded]="estaAbierta(item.id, 'INGRESOS')"
                      [attr.aria-label]="'Ver desglose de ingresos de ' + item.empleadoNombre">
                      <mat-icon>{{ estaAbierta(item.id, 'INGRESOS') ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </dd>
                </div>
                @if (estaAbierta(item.id, 'INGRESOS')) {
                  <ng-container *ngTemplateOutlet="desglose; context: { $implicit: seccionIngresos(item) }" />
                }

                <div><dt>Aporte personal IESS</dt><dd>- {{ item.resumen.aportePersonalIess | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>

                <div class="fila-expandible referencia">
                  <dt>Planilla IESS <span class="tag">referencia</span></dt>
                  <dd>
                    {{ planillaIess(item).totalPlanilla | currency:'USD':'symbol-narrow':'1.2-2' }}
                    <button mat-icon-button type="button" (click)="alternarSeccion(item.id, 'IESS')"
                      [attr.aria-expanded]="estaAbierta(item.id, 'IESS')"
                      [attr.aria-label]="'Ver desglose de la planilla IESS de ' + item.empleadoNombre">
                      <mat-icon>{{ estaAbierta(item.id, 'IESS') ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </dd>
                </div>
                @if (estaAbierta(item.id, 'IESS')) {
                  <ng-container *ngTemplateOutlet="desglose; context: { $implicit: seccionIess(item) }" />
                }

                @if (item.resumen.anticipos > 0) {
                  <div><dt>Anticipos</dt><dd>- {{ item.resumen.anticipos | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                }

                <div class="fila-expandible">
                  <dt>Otros descuentos</dt>
                  <dd>
                    - {{ item.resumen.otrosDescuentos | currency:'USD':'symbol-narrow':'1.2-2' }}
                    <button mat-icon-button type="button" (click)="alternarSeccion(item.id, 'DESCUENTOS')"
                      [disabled]="item.resumen.otrosDescuentos === 0"
                      [attr.aria-expanded]="estaAbierta(item.id, 'DESCUENTOS')"
                      [attr.aria-label]="'Ver desglose de otros descuentos de ' + item.empleadoNombre">
                      <mat-icon>{{ estaAbierta(item.id, 'DESCUENTOS') ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </dd>
                </div>
                @if (estaAbierta(item.id, 'DESCUENTOS')) {
                  <ng-container *ngTemplateOutlet="desglose; context: { $implicit: seccionOtrosDescuentos(item) }" />
                }

                <div class="fila-expandible">
                  <dt>Provisiones (patronal)</dt>
                  <dd>
                    {{ item.resumen.totalBeneficios | currency:'USD':'symbol-narrow':'1.2-2' }}
                    <button mat-icon-button type="button" (click)="alternarSeccion(item.id, 'PROVISIONES')"
                      [attr.aria-expanded]="estaAbierta(item.id, 'PROVISIONES')"
                      [attr.aria-label]="'Ver desglose de provisiones de ' + item.empleadoNombre">
                      <mat-icon>{{ estaAbierta(item.id, 'PROVISIONES') ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </dd>
                </div>
                @if (estaAbierta(item.id, 'PROVISIONES')) {
                  <ng-container *ngTemplateOutlet="desglose; context: { $implicit: seccionProvisiones(item) }" />
                }
                <div class="neto" [class.negativo]="item.resumen.netoPagar < 0"><dt>Neto a pagar</dt><dd>{{ item.resumen.netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                @if (item.resumen.netoPagar < 0) {
                  <p class="neto-aviso">
                    Los descuentos superan los ingresos del periodo. Ajusta el monto del anticipo en la
                    linea de arriba o difierelo al siguiente rol.
                  </p>
                }
              </dl>

            </div>
          </mat-expansion-panel>
        }
      </section>

      <!-- Tabla comun de los tres desgloses del resumen: ingresos, otros descuentos y provisiones. -->
      <ng-template #desglose let-seccion>
        <div class="desglose-detalle">
          <header>
            <strong>{{ seccion.titulo }}</strong>
            @if (seccion.enlace) {
              <a mat-button [routerLink]="seccion.enlace.ruta">
                <mat-icon>{{ seccion.enlace.icono }}</mat-icon>
                {{ seccion.enlace.texto }}
              </a>
            }
          </header>

          @if (seccion.filas.length === 0) {
            <p class="nota">Sin movimientos que desglosar en este periodo.</p>
          } @else {
            <table>
              <tbody>
                @for (fila of seccion.filas; track fila.clave) {
                  <tr [class.cero]="fila.atenuada">
                    <td>{{ fila.etiqueta }}</td>
                    <td class="base">{{ fila.nota }}</td>
                    <td class="num">{{ fila.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                  </tr>
                }
                <tr class="total">
                  <td colspan="2">{{ seccion.totalEtiqueta }}</td>
                  <td class="num">{{ seccion.total | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                </tr>
                @if (seccion.cierre) {
                  <tr class="cierre">
                    <td>{{ seccion.cierre.etiqueta }}</td>
                    <td class="base">{{ seccion.cierre.nota }}</td>
                    <td class="num">{{ seccion.cierre.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (seccion.nota) {
            <p class="nota">{{ seccion.nota }}</p>
          }
        </div>
      </ng-template>

      <footer class="surface-card actions-bar">
        @if (editable()) {
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="procesando()">
            <mat-icon>save</mat-icon>
            Guardar borrador
          </button>
          <button
            mat-stroked-button
            type="button"
            (click)="recalcular()"
            [disabled]="procesando()"
            matTooltip="Reaplica la configuracion de nomina y la eleccion de decimos de cada trabajador. No cambia sueldos ni dias trabajados."
          >
            <mat-icon>calculate</mat-icon>
            Recalcular
          </button>
          <button mat-raised-button type="button" class="approve" (click)="aprobar()" [disabled]="procesando()">
            <mat-icon>task_alt</mat-icon>
            Revisar asiento y aprobar
          </button>
          <button mat-button color="warn" type="button" (click)="anular()" [disabled]="procesando()">
            <mat-icon>block</mat-icon>
            Anular
          </button>
        } @else {
          <p class="muted">Este rol esta {{ rol()?.estado }} y no puede editarse.
            @if (rol()?.asientoId) { El asiento contable ya fue generado. }
            @if (rol()?.reversadoEn) { Fue reversado contablemente. }
          </p>
          @if (rol()?.estado === 'APROBADO') {
            <button mat-stroked-button color="warn" type="button" (click)="reversar()" [disabled]="procesando()">
              <mat-icon>undo</mat-icon>
              Reversar rol
            </button>
          }
        }
      </footer>
    </section>
  `,
  styles: [`
    .rol-page { display: grid; gap: 1rem; }
    .page-header, .kpi-card, .actions-bar, .empleados mat-expansion-panel { background: var(--tc-surface-container-lowest); }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, p { margin: 0; }
    .page-header p, .muted { color: var(--muted-foreground); }
    .header-actions { display: flex; gap: .75rem; align-items: center; }
    .pill { display: inline-flex; padding: .3rem .75rem; border-radius: 999px; background: color-mix(in srgb, #f59e0b 18%, transparent); font-weight: 700; }
    .pill.ok { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1rem 1.25rem; display: grid; gap: .25rem; border-radius: var(--tc-radius-lg); }
    .kpi-card span { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 1.5rem; }
    .kpi-card.highlight { outline: 2px solid color-mix(in srgb, var(--primary) 40%, transparent); }
    .hint { display: flex; gap: .5rem; align-items: center; padding: .75rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--foreground); }
    .hint.aviso { flex-wrap: wrap; background: color-mix(in srgb, #f59e0b 14%, transparent); }
    .hint.aviso span { flex: 1 1 320px; }
    .empleados { display: grid; gap: .6rem; }
    .desc-cargo { color: var(--muted-foreground); }
    .desc-neto { margin-left: auto; font-weight: 700; display: inline-flex; align-items: center; gap: .3rem; }
    .desc-neto.negativo, .neto.negativo dt, .neto.negativo dd { color: #b3261e; }
    .desc-neto mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .neto-aviso { margin: .35rem 0 0; font-size: .82rem; color: #b3261e; }
    .editor { display: grid; gap: 1rem; padding-top: .5rem; }
    .base-row { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .7rem .85rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 7%, transparent); }
    .base-row div { display: grid; gap: .15rem; min-width: 0; }
    .base-row small { color: var(--muted-foreground); overflow-wrap: anywhere; }
    .lineas { display: grid; gap: .5rem; }
    .linea-row { display: grid; grid-template-columns: 2fr 1fr auto; gap: .6rem; align-items: center; }
    .resumen { display: grid; gap: .35rem; margin: 0; padding: .85rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--foreground) 5%, transparent); }
    .resumen div { display: flex; justify-content: space-between; }
    .resumen dt, .resumen dd { margin: 0; }
    .resumen .neto { border-top: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent); padding-top: .35rem; font-weight: 700; font-size: 1.05rem; }
    .fila-expandible dd { display: flex; align-items: center; gap: .25rem; }
    .fila-expandible button { width: 44px; height: 44px; line-height: 44px; }
    /* La planilla no es un descuento al trabajador: se atenua para que no compita con las que si lo son. */
    .resumen .referencia dt, .resumen .referencia dd { color: var(--muted-foreground); }
    .referencia .tag { margin-left: .4rem; padding: .05rem .4rem; border-radius: 999px; font-size: .68rem;
                       text-transform: uppercase; letter-spacing: .06em;
                       background: color-mix(in srgb, var(--foreground) 10%, transparent); }
    /* Anidado dentro del dl: hay que ganarle a '.resumen div { display: flex }', que lo aplastaria. */
    .resumen .desglose-detalle { display: grid; gap: .5rem; margin: .1rem 0 .35rem; padding: .85rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--primary) 7%, transparent); }
    .desglose-detalle header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .desglose-detalle table { width: 100%; border-collapse: collapse; }
    .desglose-detalle td { padding: .3rem 0; border-bottom: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent); }
    .desglose-detalle tr.cero { opacity: .5; }
    .desglose-detalle tr.total td { font-weight: 700; border-bottom: none; }
    /* La base de aportes va bajo el total y separada: no suma, explica el descuento de abajo. */
    .desglose-detalle tr.cierre td { border-top: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent); border-bottom: none; padding-top: .45rem; color: var(--primary); font-weight: 600; }
    .desglose-detalle .base { color: var(--muted-foreground); font-size: .82rem; }
    .desglose-detalle .num { text-align: right; }
    .desglose-detalle .nota { margin: 0; font-size: .82rem; color: var(--muted-foreground); }
    .actions-bar { padding: 1rem 1.25rem; display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .approve { background: var(--primary); color: var(--tc-on-primary, #fff); }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .linea-row { grid-template-columns: 1fr 1fr auto; }
    }
  `]
})
export class NominaRolDetalleComponent implements OnInit {
  private readonly nominaService = inject(NominaService);
  private readonly anticiposService = inject(AnticiposNominaService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly pdfApi = inject(NominaPdfApiService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rol = signal<RolPago | null>(null);
  protected readonly empleados = signal<EmpleadoEdit[]>([]);
  protected readonly rubros = signal<RubroNomina[]>([]);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editable = computed(() => this.rol()?.estado === 'BORRADOR');
  protected readonly etiquetaTipo = computed(
    () => this.nominaService.etiquetasTipoRol[this.rol()?.tipo ?? 'MENSUAL']
  );
  /**
   * Desglose abierto, como `${idDetalle}|${seccion}`. Al ser uno solo, abrir el de ingresos cierra
   * el de provisiones y el panel del empleado no crece sin control.
   */
  private readonly seccionAbierta = signal<string | null>(null);
  protected readonly descargando = signal(false);
  /** Anticipos del periodo pendientes por empleado, para ofrecer traerlos al borrador. */
  private readonly anticiposPendientes = signal<Map<string, number>>(new Map());

  private config: ConfiguracionNominaContable = this.nominaService.getDefaultConfiguracion();
  private rolId = '';

  protected readonly totales = computed(() => {
    const acc = {
      totalIngresos: 0,
      aportePersonal: 0,
      // Personal + patronal + CCC: la cifra que se cuadra contra la planilla del IESS antes de pagar.
      planillaIess: 0,
      totalDescuentos: 0,
      totalBeneficios: 0,
      netoPagar: 0
    };
    const tasas = this.nominaService.tasasIess(this.config);
    for (const item of this.empleados()) {
      const r = item.resumen;
      acc.totalIngresos += r.totalIngresos;
      acc.aportePersonal += r.aportePersonalIess;
      acc.planillaIess += aportesIessDetalle(r, tasas).totalPlanilla;
      acc.totalDescuentos += r.totalDescuentos;
      acc.totalBeneficios += r.totalBeneficios;
      acc.netoPagar += r.netoPagar;
    }
    acc.planillaIess = this.redondear(acc.planillaIess);
    return acc;
  });

  /**
   * Empleados cuyo anticipo del periodo todavia no esta cubierto por las lineas del rol. Ocurre
   * cuando el anticipo se registro despues de generar el borrador.
   */
  protected readonly empleadosConAnticipoPendiente = computed(() => {
    const pendientes = this.anticiposPendientes();
    if (pendientes.size === 0) {
      return 0;
    }
    return this.empleados().filter((item) => {
      const pendiente = pendientes.get(item.empleadoId) ?? 0;
      return pendiente > this.anticipoEnLineas(item);
    }).length;
  });

  ngOnInit(): void {
    this.nominaService
      .getRubros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rubros) => this.rubros.set(rubros.filter((rubro) => rubro.activo)));

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (id) {
          this.rolId = id;
          void this.cargar(id);
        }
      });
  }

  /** Descarga el juego de comprobantes del rol: una pagina por empleado, para firmar como recibo. */
  protected async descargarComprobantes(): Promise<void> {
    this.error.set(null);
    this.descargando.set(true);
    try {
      const blob = await this.pdfApi.descargarComprobantes(this.rolId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `comprobantes-${this.rol()?.numero || this.rol()?.periodo || this.rolId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(await this.mensajeErrorDescarga(error));
    } finally {
      this.descargando.set(false);
    }
  }

  /**
   * Con `responseType: 'blob'` el cuerpo de error tambien llega como blob, asi que el mensaje del
   * backend queda escondido detras de un "Http failure response". Aqui se lee para mostrarlo.
   */
  private async mensajeErrorDescarga(error: unknown): Promise<string> {
    const cuerpo = (error as { error?: unknown })?.error;
    if (cuerpo instanceof Blob) {
      try {
        const texto = await cuerpo.text();
        const json = JSON.parse(texto) as { message?: string; error?: string };
        const mensaje = json.message ?? json.error;
        if (mensaje) {
          return mensaje;
        }
      } catch {
        // Cuerpo no JSON: se cae al mensaje generico.
      }
    }
    return error instanceof Error ? error.message : 'No se pudieron descargar los comprobantes.';
  }

  protected alternarSeccion(empleadoDetalleId: string, seccion: NombreSeccion): void {
    const clave = `${empleadoDetalleId}|${seccion}`;
    this.seccionAbierta.update((actual) => actual === clave ? null : clave);
  }

  protected estaAbierta(empleadoDetalleId: string, seccion: NombreSeccion): boolean {
    return this.seccionAbierta() === `${empleadoDetalleId}|${seccion}`;
  }

  /**
   * De donde sale el total de ingresos: sueldo del periodo, rubros y lo mensualizado. Cierra con la
   * base de aportes, que explica por que el IESS no es el porcentaje del total.
   */
  protected seccionIngresos(item: EmpleadoEdit): SeccionDesglose {
    return {
      titulo: 'Desglose de los ingresos del periodo',
      filas: desgloseIngresos(item.resumen),
      totalEtiqueta: 'Total ingresos',
      total: item.resumen.totalIngresos,
      cierre: {
        clave: 'BASE_IESS',
        etiqueta: 'Base de aportes IESS',
        nota: 'Solo los ingresos que afectan IESS',
        monto: baseAportesIess(item.resumen)
      },
      nota: 'Los decimos y fondos mensualizados se pagan con el sueldo pero no forman parte de la '
        + 'base de aportes, por eso el IESS no se calcula sobre el total de ingresos.'
    };
  }

  /** Aportes de la planilla del empleado, con las tasas vigentes para los roles antiguos. */
  protected planillaIess(item: EmpleadoEdit) {
    return aportesIessDetalle(item.resumen, this.nominaService.tasasIess(this.config));
  }

  /**
   * Cuadro de la planilla: base imponible, aporte personal, patronal y CCC. Es lo que se compara
   * contra el IESS antes de pagar, y la unica forma de ver que el patronal y el CCC no salen del
   * bolsillo del trabajador aunque se liquiden en el mismo rol.
   */
  protected seccionIess(item: EmpleadoEdit): SeccionDesglose {
    const tasas = this.nominaService.tasasIess(this.config);
    return {
      titulo: 'Planilla IESS del periodo',
      filas: desgloseIess(item.resumen, tasas),
      totalEtiqueta: 'Total planilla IESS',
      total: aportesIessDetalle(item.resumen, tasas).totalPlanilla,
      nota: 'Solo el aporte personal se descuenta del neto. El aporte patronal y la contribucion CCC '
        + 'son costo del empleador y se pagan al IESS junto con el personal. Los aportes se redondean '
        + 'a dos decimales y el CCC se trunca, igual que la planilla.'
    };
  }

  /** Rubros que el resumen agrupa bajo "Otros descuentos"; el IESS y el anticipo van aparte. */
  protected seccionOtrosDescuentos(item: EmpleadoEdit): SeccionDesglose {
    return {
      titulo: 'Desglose de otros descuentos',
      filas: desgloseOtrosDescuentos(item.resumen),
      totalEtiqueta: 'Total otros descuentos',
      total: item.resumen.otrosDescuentos,
      nota: 'El aporte al IESS y los anticipos no aparecen aqui: cada uno tiene su propia fila en el resumen.'
    };
  }

  /**
   * Provisiones del periodo con su base de calculo y su destino: lo mensualizado se paga en este
   * rol y lo acumulado queda provisionado. Asi la cifra deja de ser opaca y se ve por que un
   * empleado provisiona y otro no.
   */
  protected seccionProvisiones(item: EmpleadoEdit): SeccionDesglose {
    const resumen = item.resumen;
    const provisionado: Record<ConceptoProvision, number> = {
      DECIMO_TERCERO: resumen.decimoTerceroProvision,
      DECIMO_CUARTO: resumen.decimoCuartoProvision,
      FONDOS_RESERVA: resumen.fondosReservaProvision,
      VACACIONES: resumen.vacacionesProvision
    };
    const mensualizado: Record<ConceptoProvision, number> = {
      DECIMO_TERCERO: resumen.decimoTerceroMensualizado ?? 0,
      DECIMO_CUARTO: resumen.decimoCuartoMensualizado ?? 0,
      FONDOS_RESERVA: resumen.fondosReservaMensualizado ?? 0,
      VACACIONES: 0
    };

    return {
      titulo: 'Desglose de lo provisionado este periodo',
      filas: this.nominaService.conceptosProvision.map((concepto) => {
        const nota = this.notaProvision(concepto, resumen, mensualizado[concepto]);
        return {
          clave: concepto,
          etiqueta: this.nominaService.etiquetasConcepto[concepto],
          // La base de calculo y la nota se muestran juntas, igual que antes de unificar la tabla.
          nota: [this.nominaService.basesCalculoProvision[concepto], nota].filter(Boolean).join(' · '),
          monto: provisionado[concepto],
          atenuada: provisionado[concepto] === 0 && !nota
        };
      }),
      totalEtiqueta: 'Total provisionado',
      total: resumen.totalBeneficios,
      enlace: { texto: 'Ver acumulado del anio', icono: 'savings', ruta: '/workspace/contabilidad/nomina/provisiones' },
      nota: 'Las provisiones no se descuentan al empleado: son costo patronal que se acumula '
        + 'hasta pagarse en su rol de decimos o en la liquidacion.'
    };
  }

  private notaProvision(concepto: ConceptoProvision, resumen: RolPagoDetalle, mensualizado: number): string {
    if (mensualizado > 0) {
      return `Mensualizado: se paga ${mensualizado.toFixed(2)} en este rol`;
    }
    const diasTrabajados = resumen.diasTrabajadosPeriodo ?? 30;
    if (concepto === 'DECIMO_CUARTO' && diasTrabajados < 30) {
      return `Proporcional a ${diasTrabajados} de 30 días`;
    }
    if (concepto === 'FONDOS_RESERVA') {
      const diasFondos = resumen.diasFondosReservaPeriodo
        ?? (resumen.aplicaFondosReserva ? diasTrabajados : 0);
      if (diasFondos === 0) {
        return 'Aún no inicia el período con derecho';
      }
      if (diasFondos < diasTrabajados) {
        return `${diasFondos} de ${diasTrabajados} días con derecho`;
      }
      if (resumen.regimenFondosReserva === 'CONSTRUCCION') {
        return 'Trabajo directo de construcción: desde el primer día';
      }
      if (resumen.regimenFondosReserva === 'SERVICIOS_COMPLEMENTARIOS') {
        return 'Servicios complementarios: desde el primer día';
      }
    }
    return '';
  }

  protected cambiarRubro(item: EmpleadoEdit, index: number, rubroId: string): void {
    const rubro = this.rubros().find((r) => r.id === rubroId);
    if (!rubro) {
      return;
    }
    const linea = item.lineas[index];
    linea.rubroId = rubro.id ?? '';
    linea.codigo = rubro.codigo;
    linea.nombre = rubro.nombre;
    linea.tipo = rubro.tipo;
    linea.afectaIess = rubro.tipo === 'INGRESO' ? !!rubro.afectaIess : false;
    linea.cuentaContableId = rubro.cuentaContableId ?? '';
    this.actualizarResumen(item);
  }

  protected actualizarMonto(item: EmpleadoEdit, index: number, monto: number | string): void {
    const linea = item.lineas[index];
    if (!linea) {
      return;
    }
    linea.monto = Number(monto) || 0;
    this.actualizarResumen(item);
  }

  protected agregarLinea(item: EmpleadoEdit): void {
    const rubro = this.rubros()[0];
    if (!rubro) {
      return;
    }
    item.lineas.push({
      rubroId: rubro.id ?? '',
      codigo: rubro.codigo,
      nombre: rubro.nombre,
      tipo: rubro.tipo,
      afectaIess: rubro.tipo === 'INGRESO' ? !!rubro.afectaIess : false,
      cuentaContableId: rubro.cuentaContableId ?? '',
      monto: 0,
      origen: 'RUBRO',
      editable: true
    });
    this.actualizarResumen(item);
  }

  protected quitarLinea(item: EmpleadoEdit, index: number): void {
    item.lineas.splice(index, 1);
    this.actualizarResumen(item);
  }

  protected async guardar(): Promise<void> {
    if (!this.editable()) {
      return;
    }
    this.error.set(null);
    this.procesando.set(true);
    try {
      await this.nominaService.actualizarDetallesRol(this.rolId, this.empleados().map((item) => this.aDetalle(item)));
      this.toast('Borrador guardado.', 'save');
      await this.cargar(this.rolId);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * Vuelve a aplicar al borrador la configuracion de nomina y la eleccion de decimos de cada
   * trabajador. Sirve cuando el rol se genero con algo mal configurado —el salario basico sin
   * definir, o un empleado marcado como acumulado cuando debia mensualizar— y se corrige despues:
   * sin esto habria que anular el rol y generarlo de nuevo.
   *
   * Refresca solo *elecciones* (modo de decimos, regimen de fondos y los dias que estos causan),
   * nunca importes: el sueldo y los dias trabajados siguen congelados para no pisar los ajustes
   * que el contador haya hecho a mano en el borrador.
   */
  protected async recalcular(): Promise<void> {
    if (!this.editable()) {
      return;
    }
    this.error.set(null);
    this.procesando.set(true);
    try {
      const antes = this.totales();
      await this.refrescarReglasEmpleados();
      // actualizarDetallesRol relee la configuracion y recalcula cada detalle antes de escribir.
      await this.nominaService.actualizarDetallesRol(this.rolId, this.empleados().map((item) => this.aDetalle(item)));
      await this.cargar(this.rolId);

      const despues = this.totales();
      const sinCambios = antes.totalIngresos === despues.totalIngresos
        && antes.totalDescuentos === despues.totalDescuentos
        && antes.totalBeneficios === despues.totalBeneficios;
      this.toast(
        sinCambios
          ? 'El rol ya estaba al dia con la configuracion actual.'
          : `Rol recalculado. Provisiones ${antes.totalBeneficios.toFixed(2)} → ${despues.totalBeneficios.toFixed(2)}.`,
        sinCambios ? 'info' : 'calculate'
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo recalcular el rol.');
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * Aprobacion en dos pasos, igual que compras y cuentas por pagar: primero se guarda el borrador,
   * luego se muestra el asiento propuesto en el dialogo de revision para que el contador vea y
   * ajuste como queda contabilizado antes de confirmar. Si la contabilidad esta desactivada no hay
   * asiento que revisar y se cae al dialogo de confirmacion simple.
   */
  protected async aprobar(): Promise<void> {
    this.error.set(null);
    this.procesando.set(true);
    try {
      await this.nominaService.actualizarDetallesRol(this.rolId, this.empleados().map((item) => this.aDetalle(item)));

      if (!(await this.integracionContable.contabilidadActiva())) {
        this.procesando.set(false);
        this.confirmarSinAsiento();
        return;
      }

      const [propuesta, cuentas] = await Promise.all([
        this.nominaService.construirLineasRolPago(this.rolId),
        this.planCuentasService.getCuentasOnce()
      ]);
      const rol = this.rol();
      const data: RevisarAsientoData = {
        titulo: 'Revisar asiento del rol de pago',
        subtitulo: `${rol?.numero || rol?.periodo} · ${this.empleados().length} empleados · Neto ${this.totales().netoPagar.toFixed(2)}`,
        lineas: propuesta,
        cuentas
      };
      this.procesando.set(false);

      const lineas = await firstValueFrom(
        this.dialog.open<RevisarAsientoDialogComponent, RevisarAsientoData, AsientoContableLinea[] | undefined>(
          RevisarAsientoDialogComponent,
          { maxWidth: '96vw', data }
        ).afterClosed()
      );
      if (!lineas) {
        return;
      }

      this.procesando.set(true);
      await this.nominaService.aprobarRolPago(this.rolId, lineas);
      this.toast('Rol aprobado y asiento generado.', 'task_alt');
      await this.cargar(this.rolId);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo aprobar el rol.');
    } finally {
      this.procesando.set(false);
    }
  }

  private confirmarSinAsiento(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Aprobar rol de pago',
        message: 'La contabilidad automatica esta desactivada: el rol se aprobara sin generar asiento. Despues de aprobar no podra editarse. Continuar?',
        confirmText: 'Aprobar'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.procesando.set(true);
      try {
        await this.nominaService.aprobarRolPago(this.rolId);
        this.toast('Rol aprobado.', 'task_alt');
        await this.cargar(this.rolId);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo aprobar el rol.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  protected reversar(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: 'Reversar rol de pago',
        message: 'Se generara el asiento inverso, el asiento original quedara marcado como reversado y el rol pasara a anulado. Los aportes de este rol se retiran del acumulado anual de los empleados. Continuar?',
        confirmText: 'Reversar'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.error.set(null);
      this.procesando.set(true);
      try {
        await this.nominaService.reversarRolPago(this.rolId);
        this.toast('Rol reversado y asiento inverso generado.', 'undo');
        await this.cargar(this.rolId);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo reversar el rol.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  protected anular(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Anular rol de pago',
        message: 'Deseas anular este rol en borrador?',
        confirmText: 'Anular'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.procesando.set(true);
      try {
        await this.nominaService.anularRolPago(this.rolId);
        this.toast('Rol anulado.', 'block');
        await this.router.navigate(['/workspace/contabilidad/nomina/roles']);
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo anular el rol.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  private async cargar(id: string): Promise<void> {
    this.config = await this.nominaService.getConfiguracionOnce();
    const resumen = await this.nominaService.getRolPagoDetalle(id);
    if (!resumen) {
      this.error.set('El rol de pago no existe.');
      return;
    }
    this.rol.set(resumen.rol);
    this.empleados.set(resumen.detalles.map((detalle) => this.aEdit(detalle)));
    await this.cargarAnticiposPendientes();
  }

  private async cargarAnticiposPendientes(): Promise<void> {
    const rol = this.rol();
    if (!rol || (rol.tipo ?? 'MENSUAL') !== 'MENSUAL' || rol.estado !== 'BORRADOR') {
      this.anticiposPendientes.set(new Map());
      return;
    }
    try {
      this.anticiposPendientes.set(await this.anticiposService.getPendientesPorEmpleado(rol.periodo));
    } catch {
      // Sin anticipos legibles simplemente no se ofrece traerlos.
      this.anticiposPendientes.set(new Map());
    }
  }

  /**
   * Agrega al borrador los anticipos del periodo que aun no estan descontados. Se usa cuando el
   * anticipo se registro despues de generar el rol: el rol ya no se regenera solo.
   */
  protected traerAnticipos(): void {
    const pendientes = this.anticiposPendientes();
    const rubroAnticipo = this.rubros().find((rubro) => rubro.codigo === NominaService.CODIGO_RUBRO_ANTICIPO) ?? null;
    let actualizados = 0;

    for (const item of this.empleados()) {
      const pendiente = pendientes.get(item.empleadoId) ?? 0;
      const faltante = this.redondear(pendiente - this.anticipoEnLineas(item));
      if (faltante <= 0) {
        continue;
      }

      const existente = item.lineas.find((linea) => linea.codigo === NominaService.CODIGO_RUBRO_ANTICIPO);
      if (existente) {
        existente.monto = this.redondear(existente.monto + faltante);
      } else {
        const linea = this.nominaService.crearLineaAnticipo(faltante, rubroAnticipo, this.config);
        if (linea) {
          item.lineas.push(linea);
        }
      }
      this.actualizarResumen(item);
      actualizados += 1;
    }

    if (actualizados === 0) {
      this.toast('Los anticipos del periodo ya estan descontados.', 'info');
      return;
    }
    this.toast(`Anticipos agregados a ${actualizados} empleado(s). Guarda el borrador.`, 'account_balance_wallet');
  }

  /**
   * Trae del maestro de empleados la eleccion de decimos y el regimen de fondos, y recalcula los
   * dias con derecho a fondos, que dependen del regimen. Un empleado retirado del maestro conserva
   * lo que tenia congelado: el rol no puede quedarse sin sus reglas.
   */
  private async refrescarReglasEmpleados(): Promise<void> {
    const periodo = this.rol()?.periodo;
    if (!periodo) {
      return;
    }
    const empleados = new Map((await firstValueFrom(this.nominaService.getEmpleados()))
      .map((empleado) => [empleado.id ?? '', empleado]));

    for (const item of this.empleados()) {
      const ficha = empleados.get(item.empleadoId);
      if (!ficha) {
        continue;
      }
      const regimen = ficha.regimenFondosReserva ?? item.reglas.regimenFondosReserva ?? 'GENERAL';
      const diasFondos = calcularDiasFondosReservaPeriodo(ficha.fechaIngreso, periodo, regimen);
      item.reglas = {
        ...item.reglas,
        modoDecimoTercero: ficha.modoDecimoTercero ?? item.reglas.modoDecimoTercero,
        modoDecimoCuarto: ficha.modoDecimoCuarto ?? item.reglas.modoDecimoCuarto,
        modoFondosReserva: ficha.modoFondosReserva ?? item.reglas.modoFondosReserva,
        regimenFondosReserva: regimen,
        diasFondosReservaPeriodo: diasFondos,
        aplicaFondosReserva: diasFondos > 0
      };
    }
  }

  private anticipoEnLineas(item: EmpleadoEdit): number {
    return this.redondear(item.lineas
      .filter((linea) => linea.codigo === NominaService.CODIGO_RUBRO_ANTICIPO)
      .reduce((total, linea) => total + (Number(linea.monto) || 0), 0));
  }

  private redondear(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private aEdit(detalle: RolPagoDetalle): EmpleadoEdit {
    const sueldoLinea = detalle.lineas?.find((linea) => linea.origen === 'SUELDO');
    const item: EmpleadoEdit = {
      id: detalle.id,
      empleadoId: detalle.empleadoId,
      empleadoNombre: detalle.empleadoNombre,
      cargo: detalle.cargo,
      sueldoBase: sueldoLinea?.monto ?? detalle.sueldoBase,
      lineas: (detalle.lineas ?? []).filter((linea) => linea.origen === 'RUBRO').map((linea) => ({ ...linea })),
      reglas: {
        modoDecimoTercero: detalle.modoDecimoTercero,
        modoDecimoCuarto: detalle.modoDecimoCuarto,
        modoFondosReserva: detalle.modoFondosReserva,
        regimenFondosReserva: detalle.regimenFondosReserva,
        aplicaFondosReserva: detalle.aplicaFondosReserva,
        sueldoMensual: detalle.sueldoMensual,
        diasTrabajadosPeriodo: detalle.diasTrabajadosPeriodo,
        diasFondosReservaPeriodo: detalle.diasFondosReservaPeriodo,
        cargoId: detalle.cargoId,
        departamentoId: detalle.departamentoId,
        departamento: detalle.departamento,
        cuentaGastoSueldosId: detalle.cuentaGastoSueldosId
      },
      resumen: detalle
    };
    item.resumen = this.calcularResumen(item);
    return item;
  }

  private actualizarResumen(item: EmpleadoEdit): void {
    item.resumen = this.calcularResumen(item);
    this.empleados.set([...this.empleados()]);
  }

  private calcularResumen(item: EmpleadoEdit): RolPagoDetalle {
    return this.nominaService.recalcularDetalle(this.aDetalle(item), this.config);
  }

  private aDetalle(item: EmpleadoEdit): RolPagoDetalle {
    const sueldoLinea: RolPagoLinea = {
      rubroId: '', codigo: 'SUELDO', nombre: 'Sueldo base', tipo: 'INGRESO',
      afectaIess: true, cuentaContableId: '', monto: Number(item.sueldoBase) || 0, origen: 'SUELDO', editable: false
    };
    const lineas: RolPagoLinea[] = [
      sueldoLinea,
      ...item.lineas.map((linea) => ({ ...linea, monto: Number(linea.monto) || 0, origen: 'RUBRO' as const }))
    ];
    return {
      id: item.id,
      empleadoId: item.empleadoId,
      empleadoNombre: item.empleadoNombre,
      cargo: item.cargo,
      sueldoBase: Number(item.sueldoBase) || 0,
      ...item.reglas,
      lineas,
      ingresosAdicionales: 0,
      aportePersonalIess: 0,
      aportePatronalIess: 0,
      anticipos: 0,
      prestamos: 0,
      otrosDescuentos: 0,
      decimoTerceroProvision: 0,
      decimoCuartoProvision: 0,
      fondosReservaProvision: 0,
      vacacionesProvision: 0,
      totalIngresos: 0,
      totalDescuentos: 0,
      totalBeneficios: 0,
      netoPagar: 0
    };
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

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { dateAIso, isoADate } from '../../../../shared/utils/fecha-input.util';
import { Proveedor } from '../../../inventario/models/inventario.models';
import { ProveedoresService } from '../../../inventario/services/proveedores.service';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AsientoContable, AsientoContableLinea, CuentaContable, CuentaPorPagarManualAsiento, EstadoAsiento, OrigenAsiento, OrigenModuloContable, TipoAsiento } from '../../models/contabilidad.models';
import { ConfiguracionCuentasPorPagar } from '../../models/cuentas-por-pagar.models';
import { AsientosContablesService } from '../../services/asientos-contables.service';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-asiento-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="asiento-form-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Asiento contable</p>
          <h2>{{ asientoId() ? (numero() || 'Borrador') : 'Nuevo asiento' }}</h2>
          <p>{{ estado() }}</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/asientos">Volver</a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      @if (periodoCerrado()) {
        <section class="surface-card notice-box notice-locked">
          <mat-icon>lock</mat-icon>
          <div>
            <strong>Periodo {{ periodo() }} cerrado.</strong>
            <p>Este asiento solo se puede consultar. Reabre el periodo en configuracion contable para corregirlo.</p>
          </div>
        </section>
      }

      @if (modoCorreccion()) {
        <section class="surface-card notice-box notice-fix">
          <mat-icon>edit_note</mat-icon>
          <div>
            <strong>Correccion del asiento aprobado {{ numero() }}</strong>
            <p>
              Al guardar, los saldos contables se ajustan solos: el importe sale de las cuentas anteriores
              y entra en las nuevas.
              @if (totalesBloqueados()) {
                Este asiento lo genero otro modulo, asi que puedes reasignar cuentas y repartir el importe
                en otras lineas, pero los totales deben seguir en
                <strong>{{ totalDebeOriginal() | number:'1.2-2' }} / {{ totalHaberOriginal() | number:'1.2-2' }}</strong>
                y la fecha no se puede cambiar.
              }
            </p>
          </div>
        </section>

        <section class="surface-card form-card">
          <mat-form-field appearance="outline">
            <mat-label>Motivo de la correccion</mat-label>
            <textarea
              matInput
              rows="2"
              [ngModel]="motivoEdicion()"
              (ngModelChange)="motivoEdicion.set($event)"
              placeholder="Ej: la compra se cargo a Suministros en lugar de Mantenimiento."
            ></textarea>
            <mat-hint>{{ hintMotivo() }}</mat-hint>
          </mat-form-field>
        </section>
      }

      <section class="surface-card form-card">
        <div class="grid-4">
          <mat-form-field appearance="outline">
            <mat-label>Fecha</mat-label>
            <input
              matInput
              [matDatepicker]="pickerFecha"
              [ngModel]="fechaComoDate()"
              (ngModelChange)="actualizarFecha($event)"
              (input)="limpiarFechaSiVacia('asiento', $event)"
              [disabled]="!editable() || totalesBloqueados()"
            />
            <mat-datepicker-toggle matIconSuffix [for]="pickerFecha"></mat-datepicker-toggle>
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.fecha" aria-label="Ayuda fecha">
              <mat-icon>help_outline</mat-icon>
            </button>
            <mat-datepicker #pickerFecha></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Periodo</mat-label>
            <input matInput [value]="periodo()" readonly />
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.periodo" aria-label="Ayuda periodo">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select [ngModel]="tipo()" (ngModelChange)="tipo.set($event)" [disabled]="!editable()">
              <mat-option value="MANUAL">Manual</mat-option>
              <mat-option value="APERTURA">Apertura</mat-option>
              <mat-option value="AJUSTE">Ajuste</mat-option>
            </mat-select>
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.tipo" aria-label="Ayuda tipo">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Referencia</mat-label>
            <input matInput [ngModel]="referencia()" (ngModelChange)="referencia.set($event)" [readonly]="!editable()" />
            <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.referencia" aria-label="Ayuda referencia">
              <mat-icon>help_outline</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Detalle</mat-label>
          <textarea matInput rows="2" [ngModel]="glosa()" (ngModelChange)="glosa.set($event)" [readonly]="!editable()"></textarea>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.detalle" aria-label="Ayuda detalle">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>
      </section>

      @if (requiereCxP()) {
        <section class="surface-card cxp-card">
          <div>
            <h3>Cuenta por pagar vinculada</h3>
            @if (modoCorreccion()) {
              <p>Los datos del auxiliar no se modifican desde aqui: para cambiarlos, anula el documento por pagar.</p>
            } @else {
              <p>El asiento acredita la cuenta configurada de CxP. Ingresa el nombre y la identificación del proveedor antes de aprobar.</p>
            }
          </div>
          <div class="cxp-grid">
            <mat-form-field appearance="outline" class="cxp-catalog-field">
              <mat-label>Proveedor registrado (opcional)</mat-label>
              <mat-select [ngModel]="cxpProveedorId()" (ngModelChange)="seleccionarProveedorCxP($event)" [disabled]="!cxpEditable()">
                <mat-option value="">Ingresar proveedor manualmente</mat-option>
                @for (proveedor of proveedores(); track proveedor.id) {
                  <mat-option [value]="proveedor.id">{{ proveedor.nombre }}</mat-option>
                }
              </mat-select>
              <mat-hint>Si lo seleccionas, completaremos los datos para que puedas revisarlos.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Nombre del proveedor</mat-label>
              <input matInput required maxlength="160" autocomplete="organization"
                     [ngModel]="cxpProveedorNombre()" (ngModelChange)="actualizarProveedorNombreCxP($event)"
                     [readonly]="!cxpEditable()" />
              <mat-hint>Obligatorio para crear la cuenta por pagar.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Identificación</mat-label>
              <input matInput required maxlength="32" autocomplete="off"
                     [ngModel]="cxpProveedorIdentificacion()" (ngModelChange)="actualizarProveedorIdentificacionCxP($event)"
                     [readonly]="!cxpEditable()" />
              <mat-hint>RUC, cédula o identificación equivalente.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Fecha de vencimiento</mat-label>
              <input matInput required [matDatepicker]="cxpVencimientoPicker" [ngModel]="cxpFechaVencimientoDate()" (ngModelChange)="actualizarFechaVencimientoCxP($event)" (input)="limpiarFechaSiVacia('cxp', $event)" [disabled]="!cxpEditable()" />
              <mat-datepicker-toggle matIconSuffix [for]="cxpVencimientoPicker"></mat-datepicker-toggle>
              <mat-datepicker #cxpVencimientoPicker></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Referencia de la obligacion</mat-label>
              <input matInput required maxlength="120" [ngModel]="cxpReferencia()" (ngModelChange)="cxpReferencia.set($event)" [readonly]="!cxpEditable()" />
            </mat-form-field>
          </div>
          @if (cxpEditable() && !datosCxPCompletos()) {
            <p class="cxp-required" aria-live="polite">Completa nombre e identificación del proveedor, vencimiento y referencia para aprobar el asiento.</p>
          }
          <p class="cxp-total">Monto de la obligacion: <strong>{{ montoCxP() | number:'1.2-2' }}</strong></p>
        </section>
      }

      <section class="surface-card lines-card">
        <div class="section-toolbar">
          <h3>Lineas contables</h3>
          @if (editable()) {
            <div class="toolbar-actions">
              <button mat-stroked-button type="button" (click)="agregarLineaCuadre()" [disabled]="diferencia() === 0" matTooltipPosition="above" [matTooltip]="ayuda.lineaCuadre">
                <mat-icon>balance</mat-icon>
                Linea de cuadre
              </button>
              <button mat-stroked-button type="button" (click)="agregarLinea()" matTooltipPosition="above" [matTooltip]="ayuda.agregarLinea">
                <mat-icon>add</mat-icon>
                Agregar linea
              </button>
            </div>
          }
        </div>

        @if (editable()) {
          <div class="general-description">
            <mat-form-field appearance="outline">
              <mat-label>Descripcion general de lineas</mat-label>
              <input matInput [ngModel]="descripcionGeneral()" (ngModelChange)="descripcionGeneral.set($event)" />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="aplicarDescripcionGeneral()" [disabled]="!descripcionGeneral().trim()">
              Aplicar a todas
            </button>
          </div>
        }

        <div class="lines-table">
          <div class="line-row line-head">
            <span [matTooltip]="ayuda.cuenta" matTooltipPosition="above">Cuenta</span>
            <span [matTooltip]="ayuda.detalleLinea" matTooltipPosition="above">Detalle</span>
            <span [matTooltip]="ayuda.debe" matTooltipPosition="above">Debe</span>
            <span [matTooltip]="ayuda.haber" matTooltipPosition="above">Haber</span>
            <span></span>
          </div>

          @for (linea of lineas(); track linea.id; let index = $index) {
            <div class="line-row">
              @if (editable()) {
                <app-cuenta-contable-autocomplete
                  [cuentas]="cuentas()"
                  [cuentaId]="linea.cuentaId"
                  [soloActivas]="true"
                  [soloMovimiento]="true"
                  label="Cuenta"
                  (cuentaSeleccionada)="seleccionarCuenta(index, $event)"
                />
              } @else {
                <div class="readonly-account">
                  <strong>{{ linea.codigoCuenta }}</strong>
                  <span>{{ linea.nombreCuenta }}</span>
                </div>
              }

              <mat-form-field appearance="outline">
                <mat-label>Descripcion</mat-label>
                <input matInput [ngModel]="linea.descripcion" (ngModelChange)="actualizarLinea(index, 'descripcion', $event)" [readonly]="!editable()" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Debe</mat-label>
                <input
                  matInput
                  type="text"
                  inputmode="decimal"
                  [ngModel]="importeInputValue(linea, 'debe')"
                  (ngModelChange)="actualizarImporte(index, 'debe', $event)"
                  (blur)="formatearImporte(index, 'debe')"
                  [readonly]="!editable()"
                />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Haber</mat-label>
                <input
                  matInput
                  type="text"
                  inputmode="decimal"
                  [ngModel]="importeInputValue(linea, 'haber')"
                  (ngModelChange)="actualizarImporte(index, 'haber', $event)"
                  (blur)="formatearImporte(index, 'haber')"
                  [readonly]="!editable()"
                />
              </mat-form-field>

              @if (editable()) {
                <button mat-icon-button color="warn" type="button" aria-label="Eliminar linea" (click)="eliminarLinea(index)" [disabled]="lineas().length <= 2">
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>
          }
        </div>

        <footer class="totals">
          <span>Total debe: <strong>{{ totalDebe() | number:'1.2-2' }}</strong></span>
          <span>Total haber: <strong>{{ totalHaber() | number:'1.2-2' }}</strong></span>
          <span [class.diff-error]="diferencia() !== 0">Diferencia: <strong>{{ diferencia() | number:'1.2-2' }}</strong></span>
        </footer>

        @if (totalesDesalineados()) {
          <p class="diff-error totals-locked">
            Los totales deben mantenerse en {{ totalDebeOriginal() | number:'1.2-2' }} / {{ totalHaberOriginal() | number:'1.2-2' }}
            para no descuadrar el documento que origino este asiento.
          </p>
        }
      </section>

      <section class="actions-row">
        <a mat-button routerLink="/workspace/contabilidad/asientos">Cancelar</a>
        @if (modoCorreccion()) {
          @if (avisoCorreccion()) {
            <span class="accion-hint">{{ avisoCorreccion() }}</span>
          }
          <button mat-raised-button color="primary" type="button" (click)="guardarCorreccion()" [disabled]="!puedeGuardarCorreccion()">
            Actualizar asiento
          </button>
        } @else if (editable()) {
          <button mat-stroked-button type="button" (click)="guardarBorrador()" [disabled]="guardando()">Guardar borrador</button>
          <button mat-raised-button color="primary" type="button" (click)="aprobar()"
                  [disabled]="guardando() || diferencia() !== 0 || (requiereCxP() && !datosCxPCompletos())">
            Aprobar
          </button>
        }
      </section>
    </section>
  `,
  styles: [`
    .asiento-form-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .form-card, .lines-card, .cxp-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .cxp-card h3, .cxp-card p { margin: 0; }
    .cxp-card p { color: var(--muted-foreground); }
    .cxp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .cxp-catalog-field { grid-column: 1 / -1; }
    .cxp-required { color: var(--destructive, #b3261e) !important; font-size: .85rem; }
    .cxp-total { text-align: right; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .section-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .section-toolbar h3 { margin: 0; }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .general-description { display: grid; grid-template-columns: minmax(260px, 1fr) auto; gap: .75rem; align-items: start; }
    .lines-table { display: grid; gap: .6rem; }
    .line-row { display: grid; grid-template-columns: minmax(320px, 1.35fr) minmax(180px, 1fr) 130px 130px 48px; gap: .65rem; align-items: start; }
    .line-head { font-size: .78rem; text-transform: uppercase; color: var(--muted-foreground); padding: 0 .25rem; }
    .readonly-account { min-height: 56px; display: grid; align-content: center; gap: .15rem; padding: .55rem .75rem; border: 1px solid color-mix(in srgb, var(--outline) 65%, transparent); border-radius: .5rem; }
    .readonly-account span { color: var(--muted-foreground); }
    .totals { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 1rem; padding-top: .75rem; border-top: 1px solid color-mix(in srgb, var(--outline) 50%, transparent); }
    .diff-error { color: #b3261e; }
    .totals-locked { margin: .5rem 0 0; text-align: right; font-size: .85rem; }
    .notice-box { display: flex; gap: .75rem; align-items: flex-start; padding: .9rem 1.1rem; }
    .notice-box p { margin: .25rem 0 0; color: var(--muted-foreground); }
    .notice-fix { background: color-mix(in srgb, var(--primary) 8%, var(--tc-surface-container-lowest)); }
    .notice-fix mat-icon { color: var(--primary); }
    .notice-locked { background: color-mix(in srgb, var(--muted-foreground) 8%, var(--tc-surface-container-lowest)); }
    .notice-locked mat-icon { color: var(--muted-foreground); }
    .actions-row { display: flex; justify-content: flex-end; align-items: center; gap: .5rem; }
    .accion-hint { color: var(--muted-foreground); font-size: .85rem; text-align: right; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 1100px) {
      .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .line-row { grid-template-columns: 1fr; }
      .line-head { display: none; }
    }
    @media (max-width: 720px) {
      .grid-4, .cxp-grid { grid-template-columns: 1fr; }
      .cxp-catalog-field { grid-column: auto; }
      .section-toolbar, .page-header, .actions-row { align-items: flex-start; flex-direction: column; }
    }
  `]
})
export class AsientoFormComponent implements OnInit {
  private readonly service = inject(AsientosContablesService);
  private readonly configuracionService = inject(ConfiguracionContableService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly cuentasPorPagarService = inject(CuentasPorPagarService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly asientoId = signal<string | null>(null);
  protected readonly numero = signal<string | null>(null);
  protected readonly fecha = signal(this.service.fechaHoy());
  protected readonly tipo = signal<TipoAsiento>('MANUAL');
  protected readonly glosa = signal('');
  protected readonly referencia = signal('');
  protected readonly estado = signal<EstadoAsiento>('BORRADOR');
  protected readonly lineas = signal<AsientoContableLinea[]>([
    this.service.crearLineaVacia(),
    this.service.crearLineaVacia()
  ]);
  protected readonly importeInputs = signal<Record<string, string>>({});
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly configuracionCxP = signal<ConfiguracionCuentasPorPagar | null>(null);
  protected readonly descripcionGeneral = signal('');
  protected readonly cxpProveedorId = signal('');
  protected readonly cxpProveedorNombre = signal('');
  protected readonly cxpProveedorIdentificacion = signal('');
  protected readonly cxpFechaVencimiento = signal(this.service.fechaHoy());
  protected readonly cxpReferencia = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly asientoReversadoId = signal<string | null>(null);
  protected readonly origen = signal<OrigenAsiento>('MANUAL');
  protected readonly origenModulo = signal<OrigenModuloContable | null>(null);
  protected readonly periodoAbierto = signal(false);
  protected readonly periodoVerificado = signal(false);
  protected readonly motivoEdicion = signal('');
  /** Version tal como se cargo: es la referencia contra la que se detecta si el usuario cambio algo. */
  protected readonly asientoOriginal = signal<AsientoContable | null>(null);
  protected readonly totalDebeOriginal = signal(0);
  protected readonly totalHaberOriginal = signal(0);
  protected readonly ayuda = {
    fecha: 'Fecha contable del asiento. Define el periodo y el corte en reportes financieros.',
    periodo: 'Periodo mensual calculado desde la fecha. Si el periodo esta cerrado no se permite guardar ni aprobar.',
    tipo: 'Manual para registros ordinarios, apertura para saldos iniciales y ajuste para reclasificaciones o correcciones.',
    referencia: 'Documento soporte opcional: factura, recibo, comprobante interno, contrato o identificador externo.',
    detalle: 'Descripcion general del asiento. Debe explicar la razon economica del registro.',
    cuenta: 'Seleccione una cuenta activa de movimiento. Las cuentas padre no deben recibir importes directos.',
    detalleLinea: 'Concepto especifico de la linea; ayuda a entender por que se debita o acredita esa cuenta.',
    debe: 'Importe debitado. Normalmente aumenta activos, costos y gastos; disminuye pasivos, patrimonio e ingresos.',
    haber: 'Importe acreditado. Normalmente aumenta pasivos, patrimonio e ingresos; disminuye activos, costos y gastos.',
    lineaCuadre: 'Agrega una linea por la diferencia pendiente. Use solo despues de definir la cuenta correcta de contrapartida.',
    agregarLinea: 'Agrega otra cuenta al asiento. Todo asiento debe quedar cuadrado: total debe igual total haber.'
  };

  protected readonly periodo = computed(() => this.service.periodoDesdeFecha(this.fecha()));
  /** Correccion de un asiento ya aprobado: solo se habilita mientras su periodo siga abierto. */
  protected readonly modoCorreccion = computed(() => this.estado() === 'APROBADO' && this.periodoAbierto());
  protected readonly editable = computed(() => this.estado() === 'BORRADOR' || this.modoCorreccion());
  /**
   * Los asientos generados por otro modulo estan apuntados desde su documento origen: se pueden
   * reasignar cuentas y repartir el importe en otras lineas, pero los totales y la fecha no se tocan.
   */
  protected readonly totalesBloqueados = computed(() =>
    this.modoCorreccion() && (this.origen() !== 'MANUAL' || this.origenModulo() === 'BANCOS')
  );
  /**
   * El auxiliar de CxP solo se define al crear el asiento: la correccion no lo toca porque el
   * documento por pagar ya existe y puede tener abonos.
   */
  protected readonly cxpEditable = computed(() => this.editable() && !this.modoCorreccion());
  protected readonly periodoCerrado = computed(() =>
    this.estado() === 'APROBADO' && this.periodoVerificado() && !this.periodoAbierto()
  );
  protected readonly totalDebe = computed(() => {
    return this.service.roundToTwo(this.lineas().reduce((total, linea) => total + Number(linea.debe || 0), 0));
  });
  protected readonly totalHaber = computed(() => {
    return this.service.roundToTwo(this.lineas().reduce((total, linea) => total + Number(linea.haber || 0), 0));
  });
  protected readonly diferencia = computed(() => this.service.roundToTwo(this.totalDebe() - this.totalHaber()));
  protected readonly totalesDesalineados = computed(() =>
    this.totalesBloqueados()
    && (this.totalDebe() !== this.totalDebeOriginal() || this.totalHaber() !== this.totalHaberOriginal())
  );
  /**
   * Que cambio respecto a la version cargada. Alimenta tanto la habilitacion del boton como el
   * motivo automatico: reasignar una cuenta no mueve totales ni diferencia, asi que sin esta
   * comparacion no habria nada que delatara la correccion.
   */
  protected readonly cambiosCorreccion = computed<string[]>(() => {
    const original = this.asientoOriginal();
    if (!original) {
      return [];
    }

    const antes = this.lineasSignificativas(original.lineas);
    const ahora = this.lineasSignificativas(this.lineas());
    const cambios: string[] = [];
    const reasignadas: string[] = [];
    let importesCambiados = false;
    let detallesCambiados = false;

    for (let i = 0; i < Math.min(antes.length, ahora.length); i += 1) {
      const previa = antes[i];
      const actual = ahora[i];

      if (previa.cuentaId !== actual.cuentaId) {
        reasignadas.push(`${previa.codigoCuenta || 'sin cuenta'} -> ${actual.codigoCuenta || 'sin cuenta'}`);
      }
      if (this.service.roundToTwo(previa.debe) !== this.service.roundToTwo(actual.debe)
        || this.service.roundToTwo(previa.haber) !== this.service.roundToTwo(actual.haber)) {
        importesCambiados = true;
      }
      if ((previa.descripcion ?? '').trim() !== (actual.descripcion ?? '').trim()) {
        detallesCambiados = true;
      }
    }

    if (reasignadas.length > 0) {
      cambios.push(`reasignacion de cuentas (${reasignadas.join(', ')})`);
    }
    if (antes.length !== ahora.length) {
      cambios.push(ahora.length > antes.length ? 'lineas agregadas' : 'lineas eliminadas');
    }
    if (importesCambiados) {
      cambios.push('ajuste de importes');
    }
    if (detallesCambiados) {
      cambios.push('detalle de lineas actualizado');
    }
    if (this.fecha() !== original.fecha) {
      cambios.push(`fecha ${original.fecha} -> ${this.fecha()}`);
    }
    if (this.tipo() !== original.tipo) {
      cambios.push(`tipo ${original.tipo} -> ${this.tipo()}`);
    }
    if (this.glosa().trim() !== (original.glosa ?? '').trim()) {
      cambios.push('detalle del asiento actualizado');
    }
    if (this.referencia().trim() !== (original.referencia ?? '').trim()) {
      cambios.push('referencia actualizada');
    }

    return cambios;
  });
  protected readonly hayCambios = computed(() => this.cambiosCorreccion().length > 0);
  protected readonly motivoSugerido = computed(() =>
    this.hayCambios() ? `Correccion del asiento: ${this.cambiosCorreccion().join('; ')}.` : ''
  );
  /**
   * El motivo escrito manda; si el contador no escribe ninguno se guarda el resumen de lo que
   * cambio, para que el boton no dependa de un texto libre pero la auditoria nunca quede vacia.
   */
  protected readonly motivoCorreccion = computed(() => this.motivoEdicion().trim() || this.motivoSugerido());
  protected readonly puedeGuardarCorreccion = computed(() =>
    !this.guardando() && this.hayCambios() && this.diferencia() === 0 && !this.totalesDesalineados()
  );
  /** Explica por que el boton esta apagado: sin esto un cambio invalido se ve igual que "no cambie nada". */
  protected readonly avisoCorreccion = computed(() => {
    if (this.guardando() || this.puedeGuardarCorreccion()) {
      return '';
    }
    if (!this.hayCambios()) {
      return 'Modifica las cuentas, los importes o el detalle para habilitar la actualizacion.';
    }
    if (this.diferencia() !== 0) {
      return 'El asiento debe quedar cuadrado para actualizarlo.';
    }
    return 'Los totales deben coincidir con el documento que origino el asiento.';
  });
  protected readonly hintMotivo = computed(() => {
    if (this.motivoEdicion().trim()) {
      return 'Queda en la auditoria junto con el detalle anterior y el nuevo.';
    }
    if (this.motivoSugerido()) {
      return `Opcional: si lo dejas vacio se registra "${this.motivoSugerido()}".`;
    }
    return 'Explica que se corrige. Queda en la auditoria junto con el detalle anterior y el nuevo.';
  });
  protected readonly fechaComoDate = computed(() => this.parseFecha(this.fecha()));
  protected readonly cxpFechaVencimientoDate = computed(() => isoADate(this.cxpFechaVencimiento()));
  protected readonly montoCxP = computed(() => {
    const cuentaId = this.configuracionCxP()?.cuentaPorPagarDefaultId;
    if (!cuentaId) {
      return 0;
    }
    const neto = this.lineas()
      .filter((linea) => linea.cuentaId === cuentaId)
      .reduce((total, linea) => total + Number(linea.haber || 0) - Number(linea.debe || 0), 0);
    return this.service.roundToTwo(Math.max(0, neto));
  });
  protected readonly requiereCxP = computed(() => {
    const config = this.configuracionCxP();
    return !!config?.habilitarCuentasPorPagar && !!config.fuenteManual && !!config.cuentaPorPagarDefaultId && this.montoCxP() > 0;
  });

  async ngOnInit(): Promise<void> {
    const [cuentas, proveedores, configCxP] = await Promise.all([
      this.planCuentasService.getCuentasOnce(),
      firstValueFrom(this.proveedoresService.getProveedores()),
      this.cuentasPorPagarService.getConfiguracionOnce()
    ]);
    this.cuentas.set(cuentas);
    this.proveedores.set(proveedores);
    this.configuracionCxP.set(configCxP);

    const asientoInicial = history.state?.['asientoInicial'] as AsientoContable | undefined;
    if (asientoInicial) {
      this.cargarAsiento(asientoInicial);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    const asiento = await this.service.getAsientoById(id);
    if (asiento) {
      this.cargarAsiento(asiento);
      await this.verificarPeriodo(asiento.periodo || this.service.periodoDesdeFecha(asiento.fecha));
    }
  }

  /** Resuelve si el periodo del asiento sigue abierto: es lo que habilita la correccion. */
  private async verificarPeriodo(periodoId: string): Promise<void> {
    if (this.estado() !== 'APROBADO') {
      this.periodoVerificado.set(true);
      return;
    }

    try {
      const periodo = await this.configuracionService.getPeriodo(periodoId);
      this.periodoAbierto.set(periodo?.estado === 'ABIERTO');
    } catch {
      this.periodoAbierto.set(false);
    } finally {
      this.periodoVerificado.set(true);
    }
  }

  protected seleccionarCuenta(index: number, cuenta: CuentaContable | null): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => {
      if (i !== index) {
        return linea;
      }

      return {
        ...linea,
        cuentaId: cuenta?.id ?? '',
        codigoCuenta: cuenta?.codigo ?? '',
        nombreCuenta: cuenta?.nombre ?? ''
      };
    }));
  }

  protected actualizarFecha(value: Date | string | null): void {
    if (!value) {
      return;
    }

    if (value instanceof Date) {
      this.fecha.set(this.formatFecha(value));
      return;
    }

    this.fecha.set(value);
  }

  protected actualizarLinea(index: number, campo: 'descripcion', value: string): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => i === index ? { ...linea, [campo]: value } : linea));
  }

  protected aplicarDescripcionGeneral(): void {
    const descripcion = this.descripcionGeneral().trim();
    if (descripcion) {
      this.lineas.update((lineas) => lineas.map((linea) => ({ ...linea, descripcion })));
    }
  }

  protected seleccionarProveedorCxP(proveedorId: string): void {
    this.cxpProveedorId.set(proveedorId);
    const proveedor = this.proveedores().find((item) => item.id === proveedorId);
    this.cxpProveedorNombre.set(proveedor?.nombre ?? '');
    this.cxpProveedorIdentificacion.set(proveedor?.ruc ?? '');
    if (proveedor) {
      const fecha = isoADate(this.fecha()) ?? new Date();
      fecha.setDate(fecha.getDate() + Number(proveedor.diasCredito ?? 0));
      this.cxpFechaVencimiento.set(dateAIso(fecha));
    }
  }

  protected actualizarProveedorNombreCxP(nombre: string): void {
    const proveedor = this.proveedores().find((item) => item.id === this.cxpProveedorId());
    this.cxpProveedorNombre.set(nombre);
    if (proveedor && proveedor.nombre.trim() !== nombre.trim()) {
      this.cxpProveedorId.set('');
    }
  }

  protected actualizarProveedorIdentificacionCxP(identificacion: string): void {
    const proveedor = this.proveedores().find((item) => item.id === this.cxpProveedorId());
    this.cxpProveedorIdentificacion.set(identificacion);
    if (proveedor && (proveedor.ruc ?? '').trim() !== identificacion.trim()) {
      this.cxpProveedorId.set('');
    }
  }

  protected actualizarFechaVencimientoCxP(fecha: Date | null): void {
    if (fecha) {
      this.cxpFechaVencimiento.set(dateAIso(fecha));
    }
  }

  protected limpiarFechaSiVacia(campo: 'asiento' | 'cxp', event: Event): void {
    if ((event.target as HTMLInputElement).value.trim() !== '') {
      return;
    }
    if (campo === 'asiento') {
      this.fecha.set('');
    } else {
      this.cxpFechaVencimiento.set('');
    }
  }

  protected importeInputValue(linea: AsientoContableLinea, campo: 'debe' | 'haber'): string {
    return this.importeInputs()[this.importeInputKey(linea.id, campo)] ?? this.formatImporte(linea[campo]);
  }

  protected actualizarImporte(index: number, campo: 'debe' | 'haber', value: string | number): void {
    const lineId = this.lineas()[index]?.id;
    if (!lineId) {
      return;
    }

    const inputValue = this.normalizarImporteInput(String(value ?? ''));
    const amount = this.parseImporteInput(inputValue);
    const oppositeField = campo === 'debe' ? 'haber' : 'debe';
    const updates: Record<string, string> = {
      [this.importeInputKey(lineId, campo)]: inputValue
    };

    if (amount > 0) {
      updates[this.importeInputKey(lineId, oppositeField)] = this.formatImporte(0);
    }

    this.importeInputs.update((inputs) => ({
      ...inputs,
      ...updates
    }));

    this.lineas.update((lineas) => lineas.map((linea, i) => {
      if (i !== index) {
        return linea;
      }

      return campo === 'debe'
        ? { ...linea, debe: amount, haber: amount > 0 ? 0 : linea.haber }
        : { ...linea, haber: amount, debe: amount > 0 ? 0 : linea.debe };
    }));
  }

  protected formatearImporte(index: number, campo: 'debe' | 'haber'): void {
    const linea = this.lineas()[index];
    if (!linea) {
      return;
    }

    this.importeInputs.update((inputs) => ({
      ...inputs,
      [this.importeInputKey(linea.id, campo)]: this.formatImporte(linea[campo])
    }));
  }

  protected agregarLinea(): void {
    this.lineas.update((lineas) => [...lineas, this.service.crearLineaVacia(this.glosa())]);
  }

  protected agregarLineaCuadre(): void {
    const diff = this.diferencia();
    if (diff === 0) {
      return;
    }

    this.lineas.update((lineas) => [
      ...lineas,
      {
        ...this.service.crearLineaVacia(this.glosa()),
        debe: diff < 0 ? Math.abs(diff) : 0,
        haber: diff > 0 ? diff : 0
      }
    ]);
  }

  protected eliminarLinea(index: number): void {
    this.lineas.update((lineas) => lineas.filter((_, i) => i !== index));
  }

  protected async guardarBorrador(): Promise<void> {
    await this.persistir('BORRADOR');
  }

  protected async aprobar(): Promise<void> {
    await this.persistir('APROBADO');
  }

  protected async guardarCorreccion(): Promise<void> {
    await this.persistir('CORRECCION');
  }

  private async persistir(accion: 'BORRADOR' | 'APROBADO' | 'CORRECCION'): Promise<void> {
    this.error.set(null);
    this.guardando.set(true);

    try {
      const asiento = this.construirAsiento();

      if (accion === 'CORRECCION') {
        await this.service.actualizarAsientoAprobado({ asiento, motivo: this.motivoCorreccion() });
        this.mostrarMensaje('Asiento corregido. Los saldos se ajustaron.', 'check_circle');
        await this.router.navigate(['/workspace/contabilidad/asientos']);
        return;
      }

      if (accion === 'APROBADO' && this.requiereCxP() && !this.datosCxPCompletos()) {
        throw new Error('Completa nombre e identificación del proveedor, vencimiento y referencia de la cuenta por pagar.');
      }
      const id = accion === 'APROBADO'
        ? await this.service.aprobarAsiento(asiento)
        : await this.service.guardarBorrador(asiento);

      if (accion === 'APROBADO' && this.asientoReversadoId()) {
        await this.service.marcarReversado(this.asientoReversadoId()!);
        await this.cuentasPorPagarService.sincronizarReversoAsiento(this.asientoReversadoId()!);
      }

      if (accion === 'APROBADO' && asiento.cuentaPorPagarManual) {
        const aprobado = await this.service.getAsientoById(id) ?? asiento;
        await this.cuentasPorPagarService.sincronizarDesdeAsientoManual(id, {
          asiento: aprobado,
          datos: asiento.cuentaPorPagarManual
        });
      }

      this.mostrarMensaje(accion === 'APROBADO' ? 'Asiento aprobado.' : 'Borrador guardado.', accion === 'APROBADO' ? 'check_circle' : 'save');

      if (accion === 'APROBADO') {
        await this.router.navigate(['/workspace/contabilidad/asientos']);
      } else {
        await this.router.navigate(['/workspace/contabilidad/asientos', id, 'editar']);
      }
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el asiento.');
    } finally {
      this.guardando.set(false);
    }
  }

  private construirAsiento(): AsientoContable {
    return {
      id: this.asientoId() ?? undefined,
      numero: this.numero(),
      fecha: this.fecha(),
      periodo: this.periodo(),
      tipo: this.tipo(),
      glosa: this.glosa(),
      referencia: this.referencia(),
      estado: this.estado(),
      origen: 'MANUAL',
      lineas: this.lineas(),
      totalDebe: this.totalDebe(),
      totalHaber: this.totalHaber(),
      diferencia: this.diferencia(),
      asientoReversadoId: this.asientoReversadoId(),
      cuentaPorPagarManual: this.construirDatosCxP()
    };
  }

  private cargarAsiento(asiento: AsientoContable): void {
    this.asientoId.set(asiento.id ?? null);
    this.numero.set(asiento.numero ?? null);
    this.fecha.set(asiento.fecha);
    this.tipo.set(asiento.tipo);
    this.glosa.set(asiento.glosa);
    this.referencia.set(asiento.referencia ?? '');
    this.estado.set(asiento.estado);
    this.asientoReversadoId.set(asiento.asientoReversadoId ?? null);
    this.origen.set(asiento.origen ?? 'MANUAL');
    this.origenModulo.set(asiento.origenModulo ?? null);
    this.totalDebeOriginal.set(this.service.roundToTwo(asiento.totalDebe ?? 0));
    this.totalHaberOriginal.set(this.service.roundToTwo(asiento.totalHaber ?? 0));
    this.motivoEdicion.set('');
    this.lineas.set(asiento.lineas.length > 0 ? asiento.lineas : [this.service.crearLineaVacia(), this.service.crearLineaVacia()]);
    // Copia propia de las lineas: la edicion crea objetos nuevos, pero el arreglo cargado no debe
    // compartirse con el formulario o la comparacion se quedaria sin referencia.
    this.asientoOriginal.set({ ...asiento, lineas: asiento.lineas.map((linea) => ({ ...linea })) });
    const cxp = asiento.cuentaPorPagarManual;
    this.cxpProveedorId.set(cxp?.proveedorId ?? '');
    this.cxpProveedorNombre.set(cxp?.proveedorNombre ?? '');
    this.cxpProveedorIdentificacion.set(cxp?.proveedorIdentificacion ?? '');
    this.cxpFechaVencimiento.set(cxp?.fechaVencimiento ?? asiento.fecha);
    this.cxpReferencia.set(cxp?.referencia ?? asiento.referencia ?? '');
    this.importeInputs.set({});
  }

  private construirDatosCxP(): CuentaPorPagarManualAsiento | null {
    if (!this.requiereCxP()) {
      return null;
    }
    return {
      proveedorId: this.cxpProveedorId(),
      proveedorNombre: this.cxpProveedorNombre().trim(),
      proveedorIdentificacion: this.cxpProveedorIdentificacion().trim(),
      fechaVencimiento: this.cxpFechaVencimiento(),
      referencia: this.cxpReferencia().trim(),
      montoOriginal: this.montoCxP()
    };
  }

  protected datosCxPCompletos(): boolean {
    return !!this.cxpProveedorNombre().trim()
      && !!this.cxpProveedorIdentificacion().trim()
      && !!this.cxpFechaVencimiento()
      && !!this.cxpReferencia().trim();
  }

  /** Mismo criterio que normalizarAsiento: una linea en blanco nunca llega a guardarse. */
  private lineasSignificativas(lineas: AsientoContableLinea[]): AsientoContableLinea[] {
    return lineas.filter((linea) =>
      !!linea.cuentaId || !!linea.descripcion?.trim() || Number(linea.debe || 0) > 0 || Number(linea.haber || 0) > 0
    );
  }

  private importeInputKey(lineId: string, campo: 'debe' | 'haber'): string {
    return `${lineId}:${campo}`;
  }

  private normalizarImporteInput(value: string): string {
    const normalizedSeparator = value.replace(/,/g, '.');
    const numeric = normalizedSeparator.replace(/[^\d.]/g, '');
    const [integerRaw = '', ...decimalParts] = numeric.split('.');
    const decimalRaw = decimalParts.join('');
    const integerPart = integerRaw.replace(/^0+(?=\d)/, '') || (numeric.startsWith('.') ? '0' : integerRaw);

    if (!numeric.includes('.')) {
      return integerPart;
    }

    if (normalizedSeparator.endsWith('.') || normalizedSeparator.endsWith(',')) {
      return `${integerPart || '0'}.`;
    }

    return `${integerPart || '0'}.${decimalRaw.slice(0, 2)}`;
  }

  private parseImporteInput(value: string): number {
    const amount = Number.parseFloat(value);
    return Number.isFinite(amount) ? this.service.roundToTwo(amount) : 0;
  }

  private formatImporte(value: number): string {
    return this.service.roundToTwo(value).toFixed(2);
  }

  private parseFecha(value: string): Date | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private formatFecha(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

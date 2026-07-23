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
import { firstValueFrom } from 'rxjs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
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
import { IntegracionContableService } from '../../../contabilidad/services/integracion-contable.service';
import { NominaPdfApiService } from '../../../contabilidad/services/nomina-pdf-api.service';
import { NominaService } from '../../../contabilidad/services/nomina.service';
import { PlanCuentasService } from '../../../contabilidad/services/plan-cuentas.service';

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
    'modoDecimoTercero' | 'modoDecimoCuarto' | 'modoFondosReserva' | 'aplicaFondosReserva'
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
    MatSnackBarModule
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

      <section class="empleados">
        @for (item of empleados(); track item.id; let i = $index) {
          <mat-expansion-panel class="surface-card">
            <mat-expansion-panel-header>
              <mat-panel-title>{{ item.empleadoNombre }}</mat-panel-title>
              <mat-panel-description>
                <span class="desc-cargo">{{ item.cargo }}</span>
                <span class="desc-neto">Neto {{ item.resumen.netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="editor">
              <div class="base-row">
                <span>Sueldo base</span>
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
                        type="number"
                        min="0"
                        step="0.01"
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
                <div><dt>Total ingresos</dt><dd>{{ item.resumen.totalIngresos | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                <div><dt>Aporte personal IESS</dt><dd>- {{ item.resumen.aportePersonalIess | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                <div><dt>Otros descuentos</dt><dd>- {{ item.resumen.otrosDescuentos | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
                <div class="provisiones-row">
                  <dt>Provisiones (patronal)</dt>
                  <dd>
                    {{ item.resumen.totalBeneficios | currency:'USD':'symbol-narrow':'1.2-2' }}
                    <button mat-icon-button type="button" (click)="alternarProvisiones(item.id)"
                      [attr.aria-label]="'Ver desglose de provisiones de ' + item.empleadoNombre">
                      <mat-icon>{{ provisionesAbiertas() === item.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </dd>
                </div>
                <div class="neto"><dt>Neto a pagar</dt><dd>{{ item.resumen.netoPagar | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div>
              </dl>

              @if (provisionesAbiertas() === item.id) {
                <div class="provisiones-detalle">
                  <header>
                    <strong>Desglose de lo provisionado este periodo</strong>
                    <a mat-button routerLink="/workspace/contabilidad/nomina/provisiones">
                      <mat-icon>savings</mat-icon>
                      Ver acumulado del anio
                    </a>
                  </header>
                  <table>
                    <tbody>
                      @for (fila of desgloseProvisiones(item); track fila.concepto) {
                        <tr [class.cero]="fila.monto === 0 && !fila.nota">
                          <td>{{ fila.etiqueta }}</td>
                          <td class="base">
                            {{ fila.base }}
                            @if (fila.nota) { <em>· {{ fila.nota }}</em> }
                          </td>
                          <td class="num">{{ fila.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                        </tr>
                      }
                      <tr class="total">
                        <td colspan="2">Total provisionado</td>
                        <td class="num">{{ item.resumen.totalBeneficios | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p class="nota">
                    Las provisiones no se descuentan al empleado: son costo patronal que se acumula
                    hasta pagarse en su rol de decimos o en la liquidacion.
                  </p>
                </div>
              }
            </div>
          </mat-expansion-panel>
        }
      </section>

      <footer class="surface-card actions-bar">
        @if (editable()) {
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="procesando()">
            <mat-icon>save</mat-icon>
            Guardar borrador
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
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1rem 1.25rem; display: grid; gap: .25rem; border-radius: var(--tc-radius-lg); }
    .kpi-card span { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 1.5rem; }
    .kpi-card.highlight { outline: 2px solid color-mix(in srgb, var(--primary) 40%, transparent); }
    .hint { display: flex; gap: .5rem; align-items: center; padding: .75rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--foreground); }
    .empleados { display: grid; gap: .6rem; }
    .desc-cargo { color: var(--muted-foreground); }
    .desc-neto { margin-left: auto; font-weight: 700; }
    .editor { display: grid; gap: 1rem; padding-top: .5rem; }
    .base-row { display: flex; justify-content: space-between; padding: .5rem .75rem; border-radius: .5rem; background: color-mix(in srgb, var(--foreground) 5%, transparent); }
    .lineas { display: grid; gap: .5rem; }
    .linea-row { display: grid; grid-template-columns: 2fr 1fr auto; gap: .6rem; align-items: center; }
    .resumen { display: grid; gap: .35rem; margin: 0; padding: .85rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--foreground) 5%, transparent); }
    .resumen div { display: flex; justify-content: space-between; }
    .resumen dt, .resumen dd { margin: 0; }
    .resumen .neto { border-top: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent); padding-top: .35rem; font-weight: 700; font-size: 1.05rem; }
    .provisiones-row dd { display: flex; align-items: center; gap: .25rem; }
    .provisiones-row button { width: 32px; height: 32px; line-height: 32px; }
    .provisiones-detalle { margin-top: -.4rem; padding: .85rem 1rem; border-radius: .6rem; background: color-mix(in srgb, var(--primary) 7%, transparent); display: grid; gap: .5rem; }
    .provisiones-detalle header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .provisiones-detalle table { width: 100%; border-collapse: collapse; }
    .provisiones-detalle td { padding: .3rem 0; border-bottom: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent); }
    .provisiones-detalle tr.cero { opacity: .5; }
    .provisiones-detalle tr.total td { font-weight: 700; border-bottom: none; }
    .provisiones-detalle .base { color: var(--muted-foreground); font-size: .82rem; }
    .provisiones-detalle .num { text-align: right; }
    .provisiones-detalle .nota { margin: 0; font-size: .82rem; color: var(--muted-foreground); }
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
  /** Id del empleado cuyo desglose de provisiones esta abierto, o null si no hay ninguno. */
  protected readonly provisionesAbiertas = signal<string | null>(null);
  protected readonly descargando = signal(false);

  private config: ConfiguracionNominaContable = this.nominaService.getDefaultConfiguracion();
  private rolId = '';

  protected readonly totales = computed(() => {
    const acc = { totalIngresos: 0, aportePersonal: 0, totalDescuentos: 0, netoPagar: 0 };
    for (const item of this.empleados()) {
      const r = item.resumen;
      acc.totalIngresos += r.totalIngresos;
      acc.aportePersonal += r.aportePersonalIess;
      acc.totalDescuentos += r.totalDescuentos;
      acc.netoPagar += r.netoPagar;
    }
    return acc;
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
      this.error.set(error instanceof Error ? error.message : 'No se pudieron descargar los comprobantes.');
    } finally {
      this.descargando.set(false);
    }
  }

  protected alternarProvisiones(empleadoDetalleId: string): void {
    this.provisionesAbiertas.update((actual) => actual === empleadoDetalleId ? null : empleadoDetalleId);
  }

  /**
   * Provisiones del periodo con su base de calculo y su destino: lo mensualizado se paga en este
   * rol y lo acumulado queda provisionado. Asi la cifra deja de ser opaca y se ve por que un
   * empleado provisiona y otro no.
   */
  protected desgloseProvisiones(item: EmpleadoEdit): Array<{
    concepto: ConceptoProvision; etiqueta: string; base: string; monto: number; nota: string;
  }> {
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

    return this.nominaService.conceptosProvision.map((concepto) => ({
      concepto,
      etiqueta: this.nominaService.etiquetasConcepto[concepto],
      base: this.nominaService.basesCalculoProvision[concepto],
      monto: provisionado[concepto],
      nota: this.notaProvision(concepto, resumen, mensualizado[concepto])
    }));
  }

  private notaProvision(concepto: ConceptoProvision, resumen: RolPagoDetalle, mensualizado: number): string {
    if (mensualizado > 0) {
      return `Mensualizado: se paga ${mensualizado.toFixed(2)} en este rol`;
    }
    if (concepto === 'FONDOS_RESERVA' && resumen.aplicaFondosReserva === false) {
      return 'Aun no cumple un año de trabajo';
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
        aplicaFondosReserva: detalle.aplicaFondosReserva
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

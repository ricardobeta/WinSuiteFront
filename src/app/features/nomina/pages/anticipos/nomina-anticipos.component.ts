import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { TableColumnDefinition } from '../../../../shared/models/table-preferences.models';
import {
  AnticipoNomina,
  AnticipoNominaDetalle,
  anticipoEsOperativo,
  EstadoAnticipoNomina
} from '../../../contabilidad/models/anticipos-nomina.models';
import { AnticiposNominaService } from '../../../contabilidad/services/anticipos-nomina.service';
import { NominaPdfApiService } from '../../../contabilidad/services/nomina-pdf-api.service';

@Component({
  selector: 'app-nomina-anticipos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="anticipos-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <h2>Anticipos de sueldo</h2>
          <p>Prepara constancias por empleado y confirma la entrega antes de afectar el rol o la contabilidad.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/workspace/contabilidad/nomina/roles">
            <mat-icon>receipt_long</mat-icon>
            Roles de pago
          </a>
          <a mat-raised-button color="primary" routerLink="nuevo" [class.disabled-link]="!canCreate()">
            <mat-icon>add</mat-icon>
            Nuevo anticipo
          </a>
        </div>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Total del periodo</p>
          <p class="kpi-value">{{ totalPeriodo() | currency:'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Empleados con anticipo</p>
          <p class="kpi-value">{{ empleadosPeriodo() }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Por descontar</p>
          <p class="kpi-value">{{ porDescontar() | currency:'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Periodo</mat-label>
          <input matInput type="month" [ngModel]="periodo()" (ngModelChange)="periodo.set($event)" name="periodo" />
          <mat-hint>Vacio muestra todos los periodos</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [ngModel]="filtroEstado()" (ngModelChange)="filtroEstado.set($event)" name="estado">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="BORRADOR">Borrador</mat-option>
            <mat-option value="REGISTRADO">Registrado</mat-option>
            <mat-option value="DESCONTADO">Descontado</mat-option>
            <mat-option value="ANULADO">Anulado</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Buscar</mat-label>
          <input matInput [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" name="busqueda" placeholder="Numero o concepto" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_top</mat-icon>
            <h3>Cargando anticipos</h3>
          </div>
        } @else if (anticiposFiltrados().length === 0) {
          <div class="empty-state">
            <mat-icon>account_balance_wallet</mat-icon>
            <h3>Sin anticipos registrados</h3>
            <p>Registra el primer anticipo y se descontara solo en el rol del periodo que elijas.</p>
          </div>
        } @else {
          <app-data-table-frame tableModule="nomina" tableId="anticipos" [columns]="columnDefinitions" [showSearch]="false" [showPaginator]="false">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th data-column-id="documento">Documento</th>
                  <th data-column-id="periodo">Periodo</th>
                  <th data-column-id="entrega">Entrega</th>
                  <th data-column-id="concepto">Concepto</th>
                  <th data-column-id="empleados" class="num">Empleados</th>
                  <th data-column-id="total" class="num">Total</th>
                  <th data-column-id="estado">Estado</th>
                  <th data-column-id="rol">Rol</th>
                  <th data-column-id="acciones"></th>
                </tr>
              </thead>
              <tbody>
                @for (anticipo of anticiposFiltrados(); track anticipo.id) {
                  <tr>
                    <td data-column-id="documento">
                      <button class="row-link" type="button" (click)="alternar(anticipo)" [attr.aria-expanded]="expandidoId() === anticipo.id">
                        <mat-icon>{{ expandidoId() === anticipo.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                        <strong>{{ anticipo.numero }}</strong>
                      </button>
                    </td>
                    <td data-column-id="periodo">{{ anticipo.periodo }}</td>
                    <td data-column-id="entrega">{{ anticipo.fecha | date:'dd/MM/yyyy' }}</td>
                    <td data-column-id="concepto" class="concepto">{{ anticipo.concepto }}</td>
                    <td data-column-id="empleados" class="num">{{ anticipo.totalEmpleados }}</td>
                    <td data-column-id="total" class="num">{{ anticipo.total | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td data-column-id="estado">
                      <span class="pill" [class.draft]="anticipo.estado === 'BORRADOR'" [class.ok]="anticipo.estado === 'DESCONTADO'" [class.off]="anticipo.estado === 'ANULADO'">
                        {{ etiquetaEstado(anticipo.estado) }}
                      </span>
                    </td>
                    <td data-column-id="rol">{{ anticipo.rolNumero || '—' }}</td>
                    <td data-column-id="acciones" class="acciones">
                      @if (anticipo.estado !== 'ANULADO') {
                        <button
                          mat-icon-button
                          type="button"
                          matTooltip="Descargar constancias de todos"
                          aria-label="Descargar constancias de todos los empleados"
                          [disabled]="descargandoId() === anticipo.id"
                          (click)="descargarConstancias(anticipo)"
                        >
                          <mat-icon>picture_as_pdf</mat-icon>
                        </button>
                      }
                      @if (anticipo.comprobanteEntrega?.downloadUrl) {
                        <button mat-icon-button type="button" (click)="abrirComprobante(anticipo)" matTooltip="Abrir respaldo de entrega" aria-label="Abrir respaldo de entrega">
                          <mat-icon>attach_file</mat-icon>
                        </button>
                      }
                      @if (anticipo.estado === 'BORRADOR' && canUpdate()) {
                        <a
                          mat-icon-button
                          [routerLink]="[anticipo.id, 'editar']"
                          matTooltip="Editar y confirmar entrega"
                          aria-label="Editar y confirmar entrega"
                        >
                          <mat-icon>edit_note</mat-icon>
                        </a>
                      }
                      @if (anticipo.asientoId) {
                        <a
                          mat-icon-button
                          [routerLink]="['/workspace/contabilidad/asientos', anticipo.asientoId, 'editar']"
                          matTooltip="Ver asiento contable"
                          aria-label="Ver asiento contable"
                        >
                          <mat-icon>account_tree</mat-icon>
                        </a>
                      }
                      @if (anticipo.estado === 'BORRADOR' || anticipo.estado === 'REGISTRADO') {
                        <button
                          mat-icon-button
                          color="warn"
                          type="button"
                          [matTooltip]="anticipo.estado === 'BORRADOR' ? 'Descartar borrador' : 'Anular anticipo'"
                          [attr.aria-label]="anticipo.estado === 'BORRADOR' ? 'Descartar borrador' : 'Anular anticipo'"
                          [disabled]="!canUpdate() || procesando()"
                          (click)="anular(anticipo)"
                        >
                          <mat-icon>block</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>

                  @if (expandidoId() === anticipo.id) {
                    <tr class="expanded-row">
                      <td colspan="9">
                        @if (cargandoDetalle()) {
                          <p class="expanded-hint">Cargando empleados del anticipo…</p>
                        } @else {
                          <section class="detalle">
                            <h3>Empleados del anticipo</h3>
                            <div class="table-wrap">
                              <table class="detalle-table">
                                <thead>
                                  <tr>
                                    <th>Empleado</th>
                                    <th>Cargo</th>
                                    <th class="num">Sueldo del periodo</th>
                                    <th class="num">Anticipo</th>
                                    <th class="num">% del periodo</th>
                                    <th>Descontado</th>
                                    <th class="acciones">Constancia</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (detalle of detalles(); track detalle.empleadoId) {
                                    <tr>
                                      <td>
                                        <strong>{{ detalle.empleadoNombre }}</strong>
                                        @if (detalle.observacion) { <span class="sub">{{ detalle.observacion }}</span> }
                                      </td>
                                      <td>{{ detalle.cargo || '—' }}</td>
                                      <td class="num">
                                        {{ (detalle.sueldoPeriodo || detalle.sueldoBase) | currency:'USD':'symbol-narrow':'1.2-2' }}
                                        @if (detalle.diasTrabajadosPeriodo && detalle.diasTrabajadosPeriodo < 30) {
                                          <span class="sub">{{ detalle.diasTrabajadosPeriodo }} de 30 dias</span>
                                        }
                                      </td>
                                      <td class="num">{{ detalle.monto | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                                      <td class="num">{{ porcentaje(detalle) }}</td>
                                      <td>{{ detalle.descontadoEn ? (detalle.descontadoEn | date:'dd/MM/yyyy') : 'Pendiente' }}</td>
                                      <td class="acciones">
                                        @if (anticipo.estado !== 'ANULADO') {
                                          <button
                                            mat-icon-button
                                            type="button"
                                            (click)="descargarConstancias(anticipo, detalle.empleadoId)"
                                            [disabled]="descargandoId() === anticipo.id + ':' + detalle.empleadoId"
                                            matTooltip="Descargar constancia individual"
                                            [attr.aria-label]="'Descargar constancia de ' + detalle.empleadoNombre"
                                          >
                                            <mat-icon>download</mat-icon>
                                          </button>
                                        }
                                      </td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          </section>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          </app-data-table-frame>
        }
      </section>
    </section>
  `,
  styles: [`
    .anticipos-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .header-copy > p { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 70ch; }
    .header-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
    .disabled-link { pointer-events: none; opacity: .5; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 30%, transparent); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }
    .filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: minmax(180px, 220px) minmax(160px, 200px) minmax(220px, 1fr); gap: .75rem; align-items: start; }
    .table-card { padding: .5rem; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .concepto { max-width: 320px; }
    .row-link { display: flex; gap: .3rem; align-items: center; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
    .row-link:hover strong { color: var(--primary); text-decoration: underline; }
    .row-link mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: var(--primary); }
    .sub { display: block; margin-top: .12rem; font-size: .78rem; color: var(--muted-foreground); }
    .pill { display: inline-flex; padding: .2rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 700; background: color-mix(in srgb, #f59e0b 18%, transparent); }
    .pill.draft { background: color-mix(in srgb, #f59e0b 18%, var(--tc-surface-container-lowest)); color: #8a4b08; }
    .pill.ok { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .pill.off { background: color-mix(in srgb, var(--muted-foreground) 18%, transparent); color: var(--muted-foreground); }
    .acciones { text-align: right; white-space: nowrap; }
    .acciones button, .acciones a { min-width: 44px; min-height: 44px; }
    .expanded-row td { padding: 0; background: color-mix(in srgb, var(--primary) 4%, var(--tc-surface-container-lowest)); }
    .detalle { display: grid; gap: .75rem; padding: 1rem 1.25rem; }
    .detalle h3 { margin: 0; font-size: 1rem; }
    .detalle-table { min-width: 720px; }
    .detalle-table th, .detalle-table td { padding: .45rem .55rem; }
    .expanded-hint { margin: 0; padding: 1rem 1.25rem; color: var(--muted-foreground); }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; }
    .empty-state mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: color-mix(in srgb, var(--primary) 55%, transparent); }
    .empty-state h3, .empty-state p { margin: 0; }
    .empty-state p { color: var(--muted-foreground); }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) {
      .filters-card { grid-template-columns: 1fr; }
      .kpi-row { grid-template-columns: 1fr; }
    }
  `]
})
export class NominaAnticiposComponent implements OnInit {
  private readonly anticiposService = inject(AnticiposNominaService);
  private readonly pdfApi = inject(NominaPdfApiService);
  private readonly authService = inject(AuthService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly anticipos = signal<AnticipoNomina[]>([]);
  protected readonly detalles = signal<AnticipoNominaDetalle[]>([]);
  protected readonly expandidoId = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoDetalle = signal(false);
  protected readonly procesando = signal(false);
  protected readonly descargandoId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly periodo = signal(new Date().toISOString().slice(0, 7));
  protected readonly filtroEstado = signal<'TODOS' | EstadoAnticipoNomina>('TODOS');
  protected readonly busqueda = signal('');
  protected readonly columnDefinitions: readonly TableColumnDefinition[] = [
    { id: 'documento', label: 'Documento' },
    { id: 'periodo', label: 'Periodo' },
    { id: 'entrega', label: 'Entrega' },
    { id: 'concepto', label: 'Concepto' },
    { id: 'empleados', label: 'Empleados' },
    { id: 'total', label: 'Total' },
    { id: 'estado', label: 'Estado' },
    { id: 'rol', label: 'Rol' },
    { id: 'acciones', label: 'Acciones', locked: true }
  ];

  protected readonly canCreate = computed(() => this.authorization.canAccess('contabilidad', 'create'));
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));

  protected readonly anticiposFiltrados = computed(() => {
    const periodo = this.periodo();
    const estado = this.filtroEstado();
    const termino = this.busqueda().trim().toLowerCase();
    return this.anticipos().filter((anticipo) =>
      (!periodo || anticipo.periodo === periodo)
      && (estado === 'TODOS' || anticipo.estado === estado)
      && (!termino
        || anticipo.numero.toLowerCase().includes(termino)
        || (anticipo.concepto ?? '').toLowerCase().includes(termino))
    );
  });

  /** Los KPI se calculan sobre lo filtrado: son el resumen de lo que el usuario esta viendo. */
  private readonly vigentes = computed(() => this.anticiposFiltrados().filter((anticipo) =>
    anticipoEsOperativo(anticipo.estado)
  ));
  protected readonly totalPeriodo = computed(() => this.vigentes().reduce((suma, anticipo) => suma + Number(anticipo.total ?? 0), 0));
  protected readonly empleadosPeriodo = computed(() => this.vigentes().reduce((suma, anticipo) => suma + Number(anticipo.totalEmpleados ?? 0), 0));
  protected readonly porDescontar = computed(() => this.vigentes()
    .filter((anticipo) => anticipo.estado === 'REGISTRADO')
    .reduce((suma, anticipo) => suma + Number(anticipo.total ?? 0), 0));

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.waitForInitialBootstrap();

      this.anticiposService
        .getAnticipos()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (anticipos) => {
            this.anticipos.set(anticipos);
            this.cargando.set(false);
          },
          error: (error) => {
            this.cargando.set(false);
            this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar los anticipos.');
          }
        });
    } catch (error) {
      this.cargando.set(false);
      this.error.set(error instanceof Error ? error.message : 'No se pudo preparar la sesion para cargar anticipos.');
    }
  }

  protected async alternar(anticipo: AnticipoNomina): Promise<void> {
    if (this.expandidoId() === anticipo.id) {
      this.expandidoId.set(null);
      this.detalles.set([]);
      return;
    }

    this.expandidoId.set(anticipo.id ?? null);
    this.detalles.set([]);
    this.cargandoDetalle.set(true);
    try {
      const resumen = await this.anticiposService.getAnticipoDetalle(anticipo.id ?? '');
      this.detalles.set(resumen?.detalles ?? []);
    } catch {
      this.snackBar.open('No se pudo cargar el detalle del anticipo.', 'Cerrar', { duration: 4000 });
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  protected anular(anticipo: AnticipoNomina): void {
    const esBorrador = anticipo.estado === 'BORRADOR';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: esBorrador ? 'Descartar borrador' : 'Anular anticipo',
        message: esBorrador
          ? `El borrador ${anticipo.numero} quedara anulado y no afectara la nomina ni la contabilidad. Continuar?`
          : anticipo.asientoId
          ? `Se generara el asiento de reverso del anticipo ${anticipo.numero}. Continuar?`
          : `Deseas anular el anticipo ${anticipo.numero}?`,
        confirmText: esBorrador ? 'Descartar' : 'Anular'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmado) => {
      if (!confirmado) {
        return;
      }
      this.error.set(null);
      this.procesando.set(true);
      try {
        await this.anticiposService.anularAnticipo(anticipo.id ?? '');
        this.toast(esBorrador ? 'Borrador descartado.' : 'Anticipo anulado.', 'block');
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'No se pudo anular el anticipo.');
      } finally {
        this.procesando.set(false);
      }
    });
  }

  /** Base del porcentaje: lo devengado en el periodo. Los anticipos viejos caen al sueldo mensual. */
  protected porcentaje(detalle: AnticipoNominaDetalle): string {
    const base = detalle.sueldoPeriodo || detalle.sueldoBase;
    if (!base) {
      return '—';
    }
    return `${Math.round((detalle.monto / base) * 100)}%`;
  }

  protected etiquetaEstado(estado: EstadoAnticipoNomina): string {
    return { BORRADOR: 'Borrador', REGISTRADO: 'Registrado', DESCONTADO: 'Descontado', ANULADO: 'Anulado' }[estado];
  }

  protected abrirComprobante(anticipo: AnticipoNomina): void {
    const url = anticipo.comprobanteEntrega?.downloadUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  protected async descargarConstancias(anticipo: AnticipoNomina, empleadoId?: string): Promise<void> {
    const anticipoId = anticipo.id ?? '';
    if (!anticipoId) {
      return;
    }
    const descargaId = empleadoId ? `${anticipoId}:${empleadoId}` : anticipoId;
    this.descargandoId.set(descargaId);
    this.error.set(null);
    try {
      const blob = await this.pdfApi.descargarConstanciasAnticipo(anticipoId, empleadoId);
      const sufijo = empleadoId ? `-${empleadoId}` : '';
      this.guardarBlob(blob, `constancias-${anticipo.numero || anticipoId}${sufijo}.pdf`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron generar las constancias.');
    } finally {
      this.descargandoId.set(null);
    }
  }

  private guardarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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

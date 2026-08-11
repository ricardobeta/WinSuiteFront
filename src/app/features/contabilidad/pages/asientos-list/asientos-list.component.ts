import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageEvent } from '@angular/material/paginator';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { BuscarButtonComponent } from '../../../../shared/components/buscar-button/buscar-button.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TableNoticeComponent } from '../../../../shared/components/table-state/table-notice.component';
import { TableStateComponent } from '../../../../shared/components/table-state/table-state.component';
import { BusquedaAbortadaError, buscarPaginado } from '../../../../shared/utils/buscar-paginado.util';
import { haystack, normalizarTexto } from '../../../../shared/utils/texto.util';
import { PendienteContabilizacionDialogComponent } from '../../components/pendiente-contabilizacion-dialog/pendiente-contabilizacion-dialog.component';
import { AsientoContable, EstadoAsiento, OrigenAsiento, PendienteContabilizacion } from '../../models/contabilidad.models';
import { AsientosContablesService, AsientosPageCursor } from '../../services/asientos-contables.service';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { PeriodoContableService } from '../../services/periodo-contable.service';

interface FiltrosAsientos {
  texto: string;
  estado: EstadoAsiento | 'TODOS';
  origen: OrigenAsiento | 'TODOS';
}

function hayFiltro(filtros: FiltrosAsientos | null): boolean {
  return !!filtros && (!!filtros.texto || filtros.estado !== 'TODOS' || filtros.origen !== 'TODOS');
}

function mismosFiltros(a: FiltrosAsientos, b: FiltrosAsientos): boolean {
  return a.texto === b.texto && a.estado === b.estado && a.origen === b.origen;
}

@Component({
  selector: 'app-asientos-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    BuscarButtonComponent,
    DataTableFrameComponent,
    TableNoticeComponent,
    TableStateComponent
  ],
  template: `
    <section class="asientos-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad</p>
          <h2>
            Asientos contables
            <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayuda.submodulo" aria-label="Ayuda asientos contables">
              <mat-icon>help_outline</mat-icon>
            </button>
          </h2>
          <p>Consulta asientos manuales, automaticos, borradores y aprobados de la empresa.</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workspace/contabilidad/asientos/nuevo" [class.disabled-link]="!canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.nuevo">
          <mat-icon>add</mat-icon>
          Nuevo asiento
        </a>
      </header>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Período obligatorio</mat-label>
          <input matInput type="month" [value]="periodo()" (input)="actualizarPeriodo($event)" />
          <mat-hint>Selecciona el mes que deseas consultar</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Buscar en el período</mat-label>
          <input matInput type="search" [value]="busqueda()" (input)="actualizarBusqueda($event)" placeholder="Numero, detalle, referencia o documento origen" />
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.buscar" aria-label="Ayuda buscar asiento">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [value]="estadoFiltro()" (valueChange)="estadoFiltro.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="BORRADOR">Borrador</mat-option>
            <mat-option value="APROBADO">Aprobado</mat-option>
            <mat-option value="REVERSADO">Reversado</mat-option>
          </mat-select>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.estado" aria-label="Ayuda estado asiento">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Origen</mat-label>
          <mat-select [value]="origenFiltro()" (valueChange)="origenFiltro.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="MANUAL">Manual</mat-option>
            <mat-option value="VENTA_POS">Venta POS</mat-option>
            <mat-option value="REVERSO_VENTA">Reverso venta</mat-option>
            <mat-option value="RECEPCION_OC">Recepcion OC</mat-option>
            <mat-option value="REVERSO_RECEPCION_OC">Reverso recepcion</mat-option>
            <mat-option value="FACTURA_COMPRA">Factura de compra</mat-option>
            <mat-option value="ROL_PAGO">Rol de pago</mat-option>
          </mat-select>
        </mat-form-field>

        <app-buscar-button
          class="search-button"
          [disabled]="!periodo()"
          [cargando]="cargando()"
          [pendiente]="buscarPendiente()"
          (buscar)="buscar()"
        />
      </section>

      <section class="surface-card table-card">
        @if (filtrosSucios()) {
          <app-table-notice tipo="filtros-sucios" (accion)="buscar()" />
        }
        <div [class.contenido-obsoleto]="filtrosSucios()">
        @if (!periodo()) {
          <app-table-state estado="sin-criterio" />
        } @else if (!consultaRealizada()) {
          <app-table-state
            estado="pendiente"
            mensaje="Presiona Buscar para consultar los asientos del período seleccionado."
          />
        } @else if (cargando()) {
          <app-table-state
            estado="cargando"
            [escaneados]="escaneados()"
            [encontrados]="coincidencias()"
            [chunks]="chunksEscaneo()"
            [columnasSkeleton]="8"
          />
        } @else if (asientos().length === 0) {
          <app-table-state
            estado="vacio"
            [icono]="hayFiltrosAplicados() ? 'search_off' : 'receipt_long'"
            [titulo]="hayFiltrosAplicados() ? 'Sin coincidencias' : 'Sin asientos'"
            [mensaje]="hayFiltrosAplicados()
              ? 'Ningún asiento del período coincide con los filtros aplicados.'
              : 'No existen asientos en el período seleccionado.'"
          >
            @if (hayFiltrosAplicados()) {
              <button mat-stroked-button type="button" (click)="limpiarFiltros()">Limpiar filtros</button>
            }
          </app-table-state>
        } @else {
          @if (truncado()) {
            <app-table-notice
              tipo="escaneo-parcial"
              [escaneados]="escaneados()"
              [encontrados]="coincidencias()"
              (accion)="continuarEscaneo()"
            />
          }
          <app-data-table-frame
            tableModule="contabilidad"
            tableId="asientos"
            [showSearch]="false"
            [total]="longitudPaginador()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[50, 100]"
            [showFirstLastButtons]="false"
            [rangeLabel]="etiquetaRango"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="asientos()">
              <ng-container matColumnDef="numero">
                <th mat-header-cell *matHeaderCellDef>Numero</th>
                <td mat-cell *matCellDef="let row">{{ row.numero ?? 'Borrador' }}</td>
              </ng-container>

              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
              </ng-container>

              <ng-container matColumnDef="periodo">
                <th mat-header-cell *matHeaderCellDef>Periodo</th>
                <td mat-cell *matCellDef="let row">{{ row.periodo }}</td>
              </ng-container>

              <ng-container matColumnDef="glosa">
                <th mat-header-cell *matHeaderCellDef>Detalle</th>
                <td mat-cell *matCellDef="let row">{{ row.glosa }}</td>
              </ng-container>

              <ng-container matColumnDef="origen">
                <th mat-header-cell *matHeaderCellDef>Origen</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.origen-auto]="row.origen !== 'MANUAL'">{{ etiquetaOrigen(row.origen) }}</mat-chip>
                  @if (row.origenNumero) {
                    <span class="origin-number">{{ row.origenNumero }}</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="totalDebe">
                <th mat-header-cell *matHeaderCellDef>Debe</th>
                <td mat-cell *matCellDef="let row">{{ row.totalDebe | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="totalHaber">
                <th mat-header-cell *matHeaderCellDef>Haber</th>
                <td mat-cell *matCellDef="let row">{{ row.totalHaber | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.estado-borrador]="row.estado === 'BORRADOR'" [class.estado-aprobado]="row.estado === 'APROBADO'">
                    {{ row.estado }}
                  </mat-chip>
                  @if (row.editadoEn) {
                    <mat-icon
                      class="marca-editado"
                      matTooltipPosition="above"
                      [matTooltip]="'Corregido: ' + (row.motivoUltimaEdicion || 'sin motivo registrado')"
                    >edit_note</mat-icon>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button type="button" (click)="editar(row)" matTooltipPosition="above" [matTooltip]="ayuda.editar">{{ etiquetaAccion(row) }}</button>
                  <button mat-button type="button" (click)="duplicar(row)" [disabled]="!canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.duplicar">Duplicar</button>
                  <button mat-button type="button" (click)="reversar(row)" [disabled]="row.estado !== 'APROBADO' || !canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.reversar">Reversar</button>
                  <button mat-button color="warn" type="button" (click)="eliminar(row)" [disabled]="row.estado !== 'BORRADOR' || !canDelete()" matTooltipPosition="above" [matTooltip]="ayuda.eliminar">Eliminar</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </app-data-table-frame>
        }
        </div>
      </section>

      <section class="surface-card table-card">
        <div class="section-head">
          <div>
            <h3>Pendientes automaticos</h3>
            <p>Documentos de POS, inventario o compras que no pudieron generar asiento automatico.</p>
          </div>
          <mat-chip [class.estado-borrador]="pendientesAutomaticos().length > 0">{{ pendientesAutomaticos().length }}</mat-chip>
        </div>

        @if (pendientesAutomaticos().length === 0) {
          <div class="empty-state compact">
            <mat-icon>task_alt</mat-icon>
            <h3>Sin pendientes automaticos</h3>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="pendientesAutomaticos()">
              <ng-container matColumnDef="origen">
                <th mat-header-cell *matHeaderCellDef>Origen</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ etiquetaOrigen(row.origenTipo) }}</strong>
                  <span class="origin-number">{{ row.origenNumero || row.origenId }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="modulo">
                <th mat-header-cell *matHeaderCellDef>Modulo</th>
                <td mat-cell *matCellDef="let row">{{ row.origenModulo }}</td>
              </ng-container>

              <ng-container matColumnDef="motivo">
                <th mat-header-cell *matHeaderCellDef>Motivo</th>
                <td mat-cell *matCellDef="let row">{{ row.motivo }}</td>
              </ng-container>

              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.creadoEn | date:'short' }}</td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button type="button" (click)="verPendiente(row)">Ver detalle</button>
                  <button mat-button type="button" (click)="reintentarPendiente(row)" [disabled]="!canCreate()">Reintentar</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnasPendientes"></tr>
              <tr mat-row *matRowDef="let row; columns: columnasPendientes"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .asientos-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header h2 { display: inline-flex; align-items: center; gap: .35rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .filters-card { padding: 1rem; display: grid; grid-template-columns: 220px minmax(260px, 1fr) 200px 220px auto; gap: .75rem; align-items: start; background: var(--tc-surface-container-lowest); }
    .search-button { min-height: 56px; }
    .table-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .section-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .section-head h3, .section-head p { margin: 0; }
    .section-head p, .origin-number { color: var(--muted-foreground); }
    .origin-number { display: block; font-size: .82rem; margin-top: .15rem; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1080px; }
    .estado-borrador { background: var(--tc-warning-container); color: var(--tc-on-warning-container); }
    .estado-aprobado { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .origen-auto { background: var(--tc-info-container); color: var(--tc-on-info-container); }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: .5rem; text-align: center; color: var(--muted-foreground); }
    .empty-state.compact { min-height: 120px; }
    .empty-state h3 { margin: 0; color: var(--foreground); }
    .empty-state p { margin: 0; }
    /* Los filtros cambiaron: lo que se ve sigue siendo el resultado de la busqueda anterior. */
    .contenido-obsoleto { opacity: .55; transition: opacity .2s ease; }
    .disabled-link { pointer-events: none; opacity: .55; }
    .marca-editado { vertical-align: middle; margin-left: .35rem; font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: var(--muted-foreground); }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 860px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .filters-card { grid-template-columns: 1fr; }
    }
  `]
})
export class AsientosListComponent implements OnInit {
  private readonly service = inject(AsientosContablesService);
  private readonly integracionService = inject(IntegracionContableService);
  private readonly periodoService = inject(PeriodoContableService);
  private readonly configuracionService = inject(ConfiguracionContableService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly columnas = ['numero', 'fecha', 'periodo', 'glosa', 'origen', 'totalDebe', 'totalHaber', 'estado', 'acciones'];
  protected readonly columnasPendientes = ['origen', 'modulo', 'motivo', 'fecha', 'acciones'];
  protected readonly asientos = signal<AsientoContable[]>([]);
  protected readonly pendientesAutomaticos = signal<PendienteContabilizacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly consultaRealizada = signal(false);
  protected readonly periodo = signal(this.periodoService.getPeriodoInicial('asientos'));
  protected readonly busqueda = signal('');
  protected readonly estadoFiltro = signal<EstadoAsiento | 'TODOS'>('TODOS');
  protected readonly origenFiltro = signal<OrigenAsiento | 'TODOS'>('TODOS');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(50);
  protected readonly hasMore = signal(false);
  /** Registros leidos de RTDB en la busqueda actual; alimenta el texto de progreso. */
  protected readonly escaneados = signal(0);
  protected readonly coincidencias = signal(0);
  protected readonly chunksEscaneo = signal(0);
  /** El escaneo se corto por el techo de seguridad y quedan registros sin revisar. */
  protected readonly truncado = signal(false);
  private readonly cursors = new Map<number, AsientosPageCursor | null>([[0, null]]);
  private cursorContinuacion: AsientosPageCursor | null = null;
  private controlador: AbortController | null = null;
  private secuencia = 0;
  /**
   * Filtros congelados en la ultima busqueda ejecutada. El predicado usa siempre estos y
   * nunca los del formulario, para que teclear no altere lo que ya esta en pantalla.
   */
  private readonly filtrosAplicados = signal<FiltrosAsientos | null>(null);
  protected readonly canCreate = computed(() => this.authorization.canAccess('contabilidad', 'create'));
  protected readonly canDelete = computed(() => this.authorization.canAccess('contabilidad', 'delete'));
  /** El listado consulta un solo periodo, asi que su estado se resuelve una vez para todas las filas. */
  protected readonly periodoAbierto = signal(false);
  protected readonly ayuda = {
    submodulo: 'Registro de comprobantes contables manuales y automaticos. Solo los asientos aprobados afectan mayores, balances y estados financieros.',
    nuevo: 'Crea un asiento en borrador para registrar aperturas, ajustes o movimientos que no vienen de POS/compras.',
    buscar: 'Busca por numero, detalle, referencia, origen o documento origen.',
    estado: 'Borrador no afecta reportes; aprobado impacta saldos; reversado conserva trazabilidad del asiento anulado.',
    editar: 'Abre el detalle. Los borradores se editan y los asientos aprobados se pueden corregir mientras su periodo siga abierto: los saldos se ajustan solos.',
    duplicar: 'Copia lineas y datos para acelerar registros similares sin afectar el asiento original.',
    reversar: 'Genera un asiento inverso para anular contablemente un asiento aprobado sin borrar historico.',
    eliminar: 'Solo elimina borradores. Los asientos aprobados deben reversarse para mantener auditoria.'
  };

  protected readonly filtrosActuales = computed<FiltrosAsientos>(() => ({
    texto: normalizarTexto(this.busqueda()),
    estado: this.estadoFiltro(),
    origen: this.origenFiltro()
  }));
  protected readonly hayFiltrosAplicados = computed(() => hayFiltro(this.filtrosAplicados()));
  /**
   * Se comparan los valores y no un simple flag: si el usuario cambia un filtro y lo
   * devuelve a su valor original, el aviso desaparece solo.
   */
  protected readonly filtrosSucios = computed(() => {
    const aplicados = this.filtrosAplicados();
    return this.consultaRealizada()
      && !!aplicados
      && !mismosFiltros(aplicados, this.filtrosActuales());
  });
  protected readonly buscarPendiente = computed(() =>
    this.filtrosSucios() || (!!this.periodo() && !this.consultaRealizada())
  );

  /**
   * Cota inferior conocida, no el total del periodo: la paginacion por cursor no sabe
   * cuantos registros quedan. Solo sirve para que el paginador habilite "siguiente".
   */
  protected readonly longitudPaginador = computed(() =>
    this.pageIndex() * this.pageSize() + this.asientos().length + (this.hasMore() ? 1 : 0)
  );

  protected readonly etiquetaRango = (pageIndex: number, pageSize: number): string => {
    const enPagina = this.asientos().length;
    if (enPagina === 0) {
      return this.hayFiltrosAplicados() ? 'Sin coincidencias' : '0 resultados';
    }
    const desde = pageIndex * pageSize + 1;
    const revisados = this.hayFiltrosAplicados() ? ` de ${this.escaneados()} revisados` : '';
    const fin = this.hasMore() ? '' : ' · fin del período';
    return `${desde}–${desde + enPagina - 1}${revisados}${fin}`;
  };

  ngOnInit(): void {
    void this.cargarPendientes();
    if (this.periodo()) {
      this.buscar();
    }
  }

  private async cargarPendientes(): Promise<void> {
    try {
      this.pendientesAutomaticos.set(await this.integracionService.getPendientesOnce(50));
    } catch {
      this.mostrarMensaje('No se pudieron cargar los pendientes automaticos.', 'error');
    }
  }

  protected actualizarBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  protected actualizarPeriodo(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.periodo.set(valor);
    this.periodoService.setPeriodo('asientos', valor);
    this.reiniciarConsulta();
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.estadoFiltro.set('TODOS');
    this.origenFiltro.set('TODOS');
    this.buscar();
  }

  protected buscar(): void {
    if (!this.periodo()) {
      return;
    }
    this.cursors.clear();
    this.cursors.set(0, null);
    this.cursorContinuacion = null;
    this.truncado.set(false);
    // Los filtros se congelan aqui y solo aqui: lo que se ve siempre corresponde a la
    // ultima busqueda ejecutada, no a lo que el usuario este tecleando.
    this.filtrosAplicados.set(this.filtrosActuales());
    void this.cargarPagina(0);
  }

  /** Retoma el escaneo donde lo corto el techo de seguridad, sin reiniciar la pagina. */
  protected continuarEscaneo(): void {
    void this.cargarPagina(this.pageIndex(), true);
  }

  protected actualizarPagina(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.buscar();
      return;
    }

    // Los cursores pertenecen a la busqueda anterior: paginar ahora mezclaria criterios.
    if (this.filtrosSucios()) {
      return;
    }

    if (this.cursors.has(event.pageIndex)) {
      void this.cargarPagina(event.pageIndex);
    }
  }

  private async cargarPagina(pageIndex: number, continuar = false): Promise<void> {
    const periodo = this.periodo();
    if (!periodo) {
      return;
    }
    if (continuar ? !this.cursorContinuacion : !this.cursors.has(pageIndex)) {
      return;
    }
    const cursorBase = continuar ? this.cursorContinuacion : (this.cursors.get(pageIndex) ?? null);

    // Si habia un escaneo en curso se aborta: sus resultados ya no interesan.
    this.controlador?.abort();
    const controlador = new AbortController();
    this.controlador = controlador;
    const secuencia = ++this.secuencia;

    const previos = continuar ? this.asientos() : [];
    const escaneadosPrevios = continuar ? this.escaneados() : 0;
    const faltan = Math.max(1, this.pageSize() - previos.length);
    const filtros = this.filtrosAplicados() ?? this.filtrosActuales();

    this.cargando.set(true);
    this.consultaRealizada.set(true);
    if (!continuar) {
      this.escaneados.set(0);
      this.coincidencias.set(0);
      this.chunksEscaneo.set(0);
      this.truncado.set(false);
    }
    void this.verificarPeriodo(periodo);

    try {
      const resultado = await buscarPaginado<AsientoContable, AsientosPageCursor>({
        fetchChunk: (cursor, limit) => this.service.getAsientosPage(periodo, limit, cursor),
        cursorDe: (asiento) => (asiento.id ? { value: asiento.fecha, key: asiento.id } : null),
        predicado: this.predicadoDe(filtros),
        pageSize: faltan,
        cursorInicial: cursorBase,
        signal: controlador.signal,
        onProgreso: ({ escaneados, encontrados, chunks }) => {
          if (secuencia !== this.secuencia) return;
          this.escaneados.set(escaneadosPrevios + escaneados);
          this.coincidencias.set(previos.length + encontrados);
          this.chunksEscaneo.set(chunks);
        }
      });

      if (secuencia !== this.secuencia) return;

      this.asientos.set([...previos, ...resultado.items]);
      this.escaneados.set(escaneadosPrevios + resultado.escaneados);
      this.coincidencias.set(previos.length + resultado.items.length);
      this.pageIndex.set(pageIndex);
      this.hasMore.set(resultado.hasMore);
      this.truncado.set(resultado.truncado);
      this.cursorContinuacion = resultado.truncado ? resultado.nextCursor : null;
      if (resultado.nextCursor && !resultado.truncado) {
        this.cursors.set(pageIndex + 1, resultado.nextCursor);
      } else {
        this.cursors.delete(pageIndex + 1);
      }
    } catch (error) {
      // Un escaneo abortado no toca el estado: manda el que lo reemplazo.
      if (error instanceof BusquedaAbortadaError || secuencia !== this.secuencia) return;
      this.asientos.set([]);
      this.hasMore.set(false);
      this.truncado.set(false);
      this.mostrarMensaje(error instanceof Error ? error.message : 'No se pudieron cargar los asientos.', 'error');
    } finally {
      // Sin este guard el escaneo abortado apagaria el indicador de carga del nuevo.
      if (secuencia === this.secuencia) {
        this.cargando.set(false);
      }
    }
  }

  /** null = sin filtros: el helper resuelve la pagina con una sola lectura. */
  private predicadoDe(filtros: FiltrosAsientos): ((asiento: AsientoContable) => boolean) | null {
    if (!hayFiltro(filtros)) {
      return null;
    }
    return (asiento) => {
      if (filtros.estado !== 'TODOS' && asiento.estado !== filtros.estado) return false;
      if (filtros.origen !== 'TODOS' && (asiento.origen ?? 'MANUAL') !== filtros.origen) return false;
      if (!filtros.texto) return true;
      return haystack(
        asiento.numero,
        asiento.glosa,
        asiento.referencia,
        asiento.origenNumero,
        asiento.origen ?? 'MANUAL'
      ).includes(filtros.texto);
    };
  }

  private reiniciarConsulta(): void {
    this.controlador?.abort();
    this.secuencia++;
    this.cargando.set(false);
    this.asientos.set([]);
    this.pageIndex.set(0);
    this.hasMore.set(false);
    this.consultaRealizada.set(false);
    this.escaneados.set(0);
    this.coincidencias.set(0);
    this.chunksEscaneo.set(0);
    this.truncado.set(false);
    this.filtrosAplicados.set(null);
    this.cursorContinuacion = null;
    this.cursors.clear();
    this.cursors.set(0, null);
  }

  private async verificarPeriodo(periodoId: string): Promise<void> {
    try {
      const periodo = await this.configuracionService.getPeriodo(periodoId);
      this.periodoAbierto.set(periodo?.estado === 'ABIERTO');
    } catch {
      this.periodoAbierto.set(false);
    }
  }

  /** Borrador se edita siempre; un aprobado solo se corrige mientras su periodo siga abierto. */
  protected etiquetaAccion(asiento: AsientoContable): string {
    if (asiento.estado === 'BORRADOR') {
      return 'Editar';
    }
    return asiento.estado === 'APROBADO' && this.periodoAbierto() ? 'Corregir' : 'Ver';
  }

  protected editar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos', asiento.id, 'editar']);
  }

  protected duplicar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos/nuevo'], {
      state: { asientoInicial: this.service.duplicarAsiento(asiento) }
    });
  }

  protected reversar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos/nuevo'], {
      state: { asientoInicial: this.service.crearReverso(asiento) }
    });
  }

  protected eliminar(asiento: AsientoContable): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar borrador',
        message: `Deseas eliminar el asiento ${asiento.numero ?? 'en borrador'}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.service.eliminarBorrador(asiento).then(() => {
        this.mostrarMensaje('Borrador eliminado.', 'delete');
        void this.cargarPagina(this.pageIndex());
      });
    });
  }

  protected etiquetaOrigen(origen: OrigenAsiento | null | undefined): string {
    const labels: Record<OrigenAsiento, string> = {
      MANUAL: 'Manual',
      VENTA_POS: 'Venta POS',
      REVERSO_VENTA: 'Reverso venta',
      RECEPCION_OC: 'Recepcion OC',
      REVERSO_RECEPCION_OC: 'Reverso recepcion',
      FACTURA_COMPRA: 'Factura de compra',
      REVERSO_FACTURA_COMPRA: 'Reverso factura de compra',
      ROL_PAGO: 'Rol de pago',
      REVERSO_ROL_PAGO: 'Reverso rol de pago',
      ANTICIPO_NOMINA: 'Anticipo de nomina',
      REVERSO_ANTICIPO_NOMINA: 'Reverso anticipo de nomina',
      PAGO_NOMINA: 'Pago de nomina',
      REVERSO_PAGO_NOMINA: 'Reverso pago de nomina',
      CXP_MANUAL: 'Cuenta por pagar manual',
      REVERSO_CXP_MANUAL: 'Reverso CxP manual',
      PAGO_PROVEEDOR: 'Pago a proveedor',
      REVERSO_PAGO_PROVEEDOR: 'Reverso pago a proveedor'
    };
    return origen ? labels[origen] ?? origen : 'Manual';
  }

  protected verPendiente(pendiente: PendienteContabilizacion): void {
    this.dialog.open(PendienteContabilizacionDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      data: pendiente
    });
  }

  protected async reintentarPendiente(pendiente: PendienteContabilizacion): Promise<void> {
    await this.integracionService.reintentarPendiente(pendiente);
    await this.cargarPendientes();
    this.mostrarMensaje('Pendiente marcado para revision.', 'refresh');
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

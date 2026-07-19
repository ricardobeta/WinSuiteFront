import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ProveedorCxpAutocompleteComponent, ProveedorCxpOpcion } from '../../components/proveedor-cxp-autocomplete/proveedor-cxp-autocomplete.component';
import { DocumentoPorPagar, EstadoDocumentoPorPagar } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService, DocumentosPorPagarPageCursor } from '../../services/cuentas-por-pagar.service';

@Component({
  selector: 'app-cuentas-por-pagar-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    DataTableFrameComponent,
    ProveedorCxpAutocompleteComponent
  ],
  template: `
    <section class="cxp-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Cuentas por pagar</p>
          <h2>Documentos por pagar</h2>
          <p>Consulta obligaciones por período, revisa sus saldos y prepara pagos por proveedor.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="antiguedad"><mat-icon>schedule</mat-icon> Antigüedad</a>
          <a mat-stroked-button routerLink="pagos"><mat-icon>payments</mat-icon> Pagos</a>
          <a mat-raised-button color="primary" routerLink="nueva"><mat-icon>add</mat-icon> Nueva CxP manual</a>
        </div>
      </header>

      <section class="kpi-row">
        <article class="kpi-card metric-hero">
          <p class="kpi-label">Saldo total por pagar</p>
          <p class="kpi-value">{{ totalPendiente() | currency:'USD':'symbol-narrow':'1.2-2' }}</p>
        </article>
        <article class="kpi-card surface-card">
          <p class="kpi-label">Documentos con saldo</p>
          <p class="kpi-value">{{ conSaldo() }}</p>
        </article>
      </section>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Período obligatorio</mat-label>
          <input matInput type="month" [ngModel]="periodo()" (ngModelChange)="cambiarPeriodo($event)" />
          <mat-hint>Selecciona el mes a consultar</mat-hint>
        </mat-form-field>

        <app-proveedor-cxp-autocomplete
          [proveedores]="proveedores()"
          [proveedorClave]="filtroProveedor()"
          label="Proveedor"
          (proveedorSeleccionado)="cambiarProveedor($event)"
        />

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [ngModel]="filtroEstado()" (ngModelChange)="cambiarEstado($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="PENDIENTE">Pendiente</mat-option>
            <mat-option value="PARCIAL">Parcial</mat-option>
            <mat-option value="PAGADA">Pagada</mat-option>
            <mat-option value="ANULADA">Anulada</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" type="button" class="search-button" (click)="buscar()" [disabled]="!periodo() || cargando()">
          <mat-icon>search</mat-icon>
          Buscar
        </button>
      </section>

      <section class="surface-card table-card">
        @if (!periodo()) {
          <div class="empty-state"><mat-icon>date_range</mat-icon><h3>Selecciona un período</h3><p>La consulta se ejecutará cuando elijas un mes y presiones Buscar.</p></div>
        } @else if (!consultaRealizada()) {
          <div class="empty-state"><mat-icon>manage_search</mat-icon><h3>Consulta pendiente</h3><p>Presiona Buscar para cargar hasta 50 documentos del período.</p></div>
        } @else if (cargando()) {
          <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><h3>Cargando documentos</h3></div>
        } @else if (documentosFiltrados().length === 0) {
          <div class="empty-state"><mat-icon>receipt_long</mat-icon><h3>Sin documentos por pagar</h3><p>No existen documentos con los filtros seleccionados.</p></div>
        } @else {
          <app-data-table-frame
            [showSearch]="false"
            [total]="totalPaginador()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[50, 100]"
            (pageChange)="actualizarPagina($event)"
          >
            <table>
              <thead>
                <tr>
                  <th>Número</th><th>Proveedor</th><th>Origen</th><th>Emisión</th><th>Vence</th>
                  <th class="num">Monto</th><th class="num">Saldo</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                @for (documento of documentosFiltrados(); track documento.id) {
                  <tr [class.vencido]="estaVencido(documento)">
                    <td>{{ documento.numero }}</td>
                    <td>
                      <button class="provider-link" type="button" (click)="alternarProveedor(documento)" [attr.aria-expanded]="proveedorExpandido() === claveProveedor(documento)">
                        <mat-icon>{{ proveedorExpandido() === claveProveedor(documento) ? 'expand_less' : 'expand_more' }}</mat-icon>
                        <span><strong>{{ documento.proveedorNombre }}</strong>@if (documento.proveedorIdentificacion) { <small>{{ documento.proveedorIdentificacion }}</small> }</span>
                      </button>
                    </td>
                    <td><span class="chip">{{ etiquetaOrigen(documento.origenTipo) }}</span></td>
                    <td>{{ documento.fechaEmision | date:'dd/MM/yyyy' }}</td>
                    <td>{{ documento.fechaVencimiento | date:'dd/MM/yyyy' }}</td>
                    <td class="num">{{ documento.montoOriginal | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td class="num">{{ documento.saldoPendiente | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td><span class="estado" [attr.data-estado]="documento.estadoPago">{{ documento.estadoPago }}</span></td>
                    <td class="acciones">
                      @if (documento.origenTipo === 'MANUAL' && documento.estadoPago !== 'ANULADA' && documento.saldoPendiente === documento.montoOriginal) {
                        <button mat-icon-button color="warn" type="button" aria-label="Anular" (click)="anular(documento)"><mat-icon>block</mat-icon></button>
                      }
                    </td>
                  </tr>
                  @if (documentoExpandidoId() === documento.id) {
                    <tr class="expanded-row"><td colspan="9">
                      @if (cargandoPendientes()) {
                        <p class="expanded-hint">Cargando cuentas pendientes del proveedor…</p>
                      } @else if (documentosPendientesProveedor().length === 0) {
                        <p class="expanded-hint">Este proveedor no tiene cuentas pendientes.</p>
                      } @else {
                        <section class="pending-detail">
                          <div><h3>Cuentas pendientes de {{ documento.proveedorNombre }}</h3><p>Selecciona los documentos que deseas pagar.</p></div>
                          <div class="pending-table-wrap"><table class="pending-table"><thead><tr><th></th><th>Factura / referencia</th><th>Emisión</th><th>Vence</th><th class="num">Saldo</th></tr></thead><tbody>
                            @for (pendiente of documentosPendientesProveedor(); track pendiente.id) {
                              <tr><td><mat-checkbox [checked]="documentosSeleccionados().has(pendiente.id!)" (change)="seleccionarDocumento(pendiente.id!, $event.checked)" [aria-label]="'Seleccionar ' + pendiente.numero"></mat-checkbox></td><td><strong>{{ referenciaDocumento(pendiente) }}</strong><span class="sub">{{ pendiente.numero }} · {{ pendiente.glosa }}</span></td><td>{{ pendiente.fechaEmision | date:'dd/MM/yyyy' }}</td><td>{{ pendiente.fechaVencimiento | date:'dd/MM/yyyy' }}</td><td class="num">{{ pendiente.saldoPendiente | currency:'USD':'symbol-narrow':'1.2-2' }}</td></tr>
                            }
                          </tbody></table></div>
                          <div class="pending-actions"><span>{{ documentosSeleccionados().size }} seleccionados</span><button mat-raised-button color="primary" type="button" (click)="procesarPago()" [disabled]="documentosSeleccionados().size === 0"><mat-icon>payments</mat-icon> Procesar pago</button></div>
                        </section>
                      }
                    </td></tr>
                  }
                }
              </tbody>
            </table>
          </app-data-table-frame>
        }
      </section>
    </section>
  `,
  styles: [`
    .cxp-page { display: grid; gap: 1rem; }.page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }.eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }.page-header h2 { margin: 0; font-size: 1.6rem; }.header-copy > p:not(.eyebrow) { margin: .4rem 0 0; color: var(--muted-foreground); }.header-actions { display: flex; gap: .6rem; flex-wrap: wrap; }.kpi-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }.kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }.kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }.kpi-value { margin: 0; font-size: 1.5rem; font-weight: 700; }.metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 30%, transparent); }.metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }.filters-card { padding: 1rem 1.25rem; display: grid; grid-template-columns: minmax(180px, 220px) minmax(240px, 1fr) minmax(160px, 200px) auto; gap: .75rem; align-items: start; }.search-button { min-height: 56px; }.table-card { padding: .5rem; overflow: auto; }table { width: 100%; border-collapse: collapse; min-width: 900px; }th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }th { font-size: .75rem; text-transform: uppercase; color: var(--muted-foreground); }.num { text-align: right; font-variant-numeric: tabular-nums; }.provider-link { display: flex; gap: .3rem; align-items: start; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }.provider-link:hover strong { color: var(--primary); text-decoration: underline; }.provider-link mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: var(--primary); }.provider-link span, .provider-link small, .sub { display: block; }.provider-link small, .sub { margin-top: .12rem; font-size: .78rem; color: var(--muted-foreground); }.chip, .estado { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; }.chip { background: color-mix(in srgb, var(--primary) 15%, transparent); }.estado[data-estado='PENDIENTE'] { background: var(--tc-warning-container); color: var(--tc-on-warning-container); }.estado[data-estado='PARCIAL'] { background: var(--tc-info-container); color: var(--tc-on-info-container); }.estado[data-estado='PAGADA'] { background: var(--tc-success-container); color: var(--tc-on-success-container); }.estado[data-estado='ANULADA'] { background: color-mix(in srgb, var(--outline) 35%, transparent); text-decoration: line-through; }tr.vencido td:nth-child(5) { color: var(--tc-error); font-weight: 600; }.acciones { text-align: right; }.expanded-row td { padding: 0; background: color-mix(in srgb, var(--primary) 4%, var(--tc-surface-container-lowest)); }.pending-detail { display: grid; gap: .75rem; padding: 1rem 1.25rem; }.pending-detail h3, .pending-detail p { margin: 0; }.pending-detail p, .expanded-hint { color: var(--muted-foreground); }.pending-table-wrap { overflow: auto; }.pending-table { min-width: 700px; }.pending-table th, .pending-table td { padding: .45rem .55rem; }.pending-actions { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }.expanded-hint { margin: 0; padding: 1rem 1.25rem; }.empty-state { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; }.empty-state mat-icon { font-size: 3rem; width: 3rem; height: 3rem; color: color-mix(in srgb, var(--primary) 55%, transparent); }.empty-state h3, .empty-state p { margin: 0; }.empty-state p { color: var(--muted-foreground); }@media (max-width: 900px) { .filters-card { grid-template-columns: 1fr; }.kpi-row { grid-template-columns: 1fr; } }
  `]
})
export class CuentasPorPagarListComponent {
  private readonly service = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly documentos = signal<DocumentoPorPagar[]>([]);
  protected readonly periodo = signal('');
  protected readonly filtroProveedor = signal<string | null>(null);
  private readonly opcionProveedorSeleccionada = signal<ProveedorCxpOpcion | null>(null);
  protected readonly filtroEstado = signal<'TODOS' | EstadoDocumentoPorPagar>('TODOS');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(50);
  protected readonly cargando = signal(false);
  protected readonly consultaRealizada = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly proveedorExpandido = signal<string | null>(null);
  protected readonly documentoExpandidoId = signal<string | null>(null);
  protected readonly cargandoPendientes = signal(false);
  protected readonly documentosPendientesProveedor = signal<DocumentoPorPagar[]>([]);
  protected readonly documentosSeleccionados = signal<Set<string>>(new Set());
  private readonly cursors = new Map<number, DocumentosPorPagarPageCursor | null>([[0, null]]);

  protected readonly proveedores = computed<ProveedorCxpOpcion[]>(() => {
    const opciones = new Map<string, ProveedorCxpOpcion>();
    for (const documento of this.documentos()) {
      const clave = this.claveProveedor(documento);
      if (!opciones.has(clave)) {
        opciones.set(clave, { clave, nombre: documento.proveedorNombre, identificacion: documento.proveedorIdentificacion });
      }
    }
    const seleccionada = this.opcionProveedorSeleccionada();
    if (seleccionada && !opciones.has(seleccionada.clave)) {
      opciones.set(seleccionada.clave, seleccionada);
    }
    return Array.from(opciones.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
  protected readonly documentosFiltrados = computed(() => this.documentos().filter((documento) =>
    (!this.filtroProveedor() || this.claveProveedor(documento) === this.filtroProveedor())
    && (this.filtroEstado() === 'TODOS' || documento.estadoPago === this.filtroEstado())
  ));
  protected readonly totalPaginador = computed(() => this.pageIndex() * this.pageSize() + this.documentos().length + (this.hasMore() ? 1 : 0));
  protected readonly totalPendiente = computed(() => this.documentosFiltrados().filter((documento) => documento.estadoPago !== 'ANULADA').reduce((suma, documento) => suma + Number(documento.saldoPendiente ?? 0), 0));
  protected readonly conSaldo = computed(() => this.documentosFiltrados().filter((documento) => documento.estadoPago !== 'ANULADA' && Number(documento.saldoPendiente ?? 0) > 0).length);

  protected cambiarPeriodo(periodo: string): void { this.periodo.set(periodo ?? ''); this.reiniciarConsulta(); }
  protected cambiarProveedor(proveedor: ProveedorCxpOpcion | null): void { this.opcionProveedorSeleccionada.set(proveedor); this.filtroProveedor.set(proveedor?.clave ?? null); this.pageIndex.set(0); if (this.consultaRealizada()) this.buscar(); }
  protected cambiarEstado(estado: 'TODOS' | EstadoDocumentoPorPagar): void { this.filtroEstado.set(estado); this.pageIndex.set(0); if (this.consultaRealizada()) this.buscar(); }
  protected buscar(): void { if (this.periodo()) { this.reiniciarConsulta(); void this.cargarPagina(0); } }
  protected actualizarPagina(event: PageEvent): void { if (event.pageSize !== this.pageSize()) { this.pageSize.set(event.pageSize); this.buscar(); return; } if (this.cursors.has(event.pageIndex)) { void this.cargarPagina(event.pageIndex); } }

  protected async alternarProveedor(documento: DocumentoPorPagar): Promise<void> {
    const clave = this.claveProveedor(documento);
    if (this.proveedorExpandido() === clave) { this.proveedorExpandido.set(null); this.documentoExpandidoId.set(null); return; }
    this.proveedorExpandido.set(clave); this.documentoExpandidoId.set(documento.id ?? null); this.documentosSeleccionados.set(new Set()); this.cargandoPendientes.set(true);
    try { this.documentosPendientesProveedor.set(await this.service.getDocumentosPendientesProveedor(clave)); }
    catch { this.documentosPendientesProveedor.set([]); this.snackBar.open('No se pudieron cargar las cuentas pendientes.', 'Cerrar', { duration: 4000 }); }
    finally { this.cargandoPendientes.set(false); }
  }

  protected seleccionarDocumento(id: string, seleccionado: boolean): void { this.documentosSeleccionados.update((actual) => { const siguiente = new Set(actual); seleccionado ? siguiente.add(id) : siguiente.delete(id); return siguiente; }); }
  protected procesarPago(): void { const documentos = Array.from(this.documentosSeleccionados()); const proveedor = this.proveedorExpandido(); if (!proveedor || documentos.length === 0) return; void this.router.navigate(['/workspace/contabilidad/cuentas-por-pagar/pagos/nuevo'], { queryParams: { proveedor, documentos: documentos.join(',') } }); }
  protected estaVencido(documento: DocumentoPorPagar): boolean { return documento.estadoPago !== 'PAGADA' && documento.estadoPago !== 'ANULADA' && Number(documento.saldoPendiente ?? 0) > 0 && documento.fechaVencimiento < Date.now(); }
  protected referenciaDocumento(documento: DocumentoPorPagar): string { return documento.origenNumero || documento.numero || 'Documento sin referencia'; }
  protected claveProveedor(documento: DocumentoPorPagar): string { return documento.proveedorId ?? `sin:${documento.proveedorNombre}`; }
  protected etiquetaOrigen(origen: DocumentoPorPagar['origenTipo']): string { return { FACTURA_COMPRA: 'Factura', MANUAL: 'Manual', RETENCION: 'Retención', NOMINA: 'Nómina' }[origen]; }

  protected async anular(documento: DocumentoPorPagar): Promise<void> { if (!documento.id) return; try { await this.service.anularDocumento(documento.id); this.documentos.update((items) => items.map((item) => item.id === documento.id ? { ...item, estadoPago: 'ANULADA', saldoPendiente: 0 } : item)); this.snackBar.openFromComponent(SuccessSnackbarComponent, { data: { message: 'Documento anulado.', icon: 'block' }, duration: 2600, horizontalPosition: 'end', verticalPosition: 'top' }); } catch (error: unknown) { this.snackBar.open(error instanceof Error ? error.message : 'No se pudo anular.', 'Cerrar', { duration: 4000 }); } }

  private async cargarPagina(pageIndex: number): Promise<void> { const periodo = this.periodo(); if (!periodo || !this.cursors.has(pageIndex)) return; this.cargando.set(true); this.consultaRealizada.set(true); try { const page = await this.service.getDocumentosPorPagarPage(periodo, this.pageSize(), this.cursors.get(pageIndex) ?? null); this.documentos.set(page.items); this.pageIndex.set(pageIndex); this.hasMore.set(page.hasMore); if (page.nextCursor) this.cursors.set(pageIndex + 1, page.nextCursor); else this.cursors.delete(pageIndex + 1); } catch (error) { this.documentos.set([]); this.hasMore.set(false); this.snackBar.open(error instanceof Error ? error.message : 'No se pudieron cargar los documentos.', 'Cerrar', { duration: 4000 }); } finally { this.cargando.set(false); } }
  private reiniciarConsulta(): void { this.documentos.set([]); this.pageIndex.set(0); this.hasMore.set(false); this.consultaRealizada.set(false); this.proveedorExpandido.set(null); this.documentoExpandidoId.set(null); this.documentosPendientesProveedor.set([]); this.cursors.clear(); this.cursors.set(0, null); }
}

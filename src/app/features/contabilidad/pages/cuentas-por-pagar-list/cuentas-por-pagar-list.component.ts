import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { skip } from 'rxjs';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import {
  DocumentoCarteraCxp,
  DocumentoHistorialCxp,
  ProveedorCarteraCxp,
  ResumenCarteraCxp,
  TrazabilidadDocumentoCxp,
  TramoCartera
} from '../../models/cuentas-por-pagar-consulta.models';
import { EstadoDocumentoPorPagar, OrigenDocumentoPorPagar } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarConsultaApiService } from '../../services/cuentas-por-pagar-consulta-api.service';

type VistaConsulta = 'cartera' | 'historial';

const RESUMEN_VACIO: ResumenCarteraCxp = {
  deudaBruta: 0,
  creditos: 0,
  saldoNeto: 0,
  vencido: 0,
  porVencer: 0,
  proveedores: 0,
  documentos: 0
};

@Component({
  selector: 'app-cuentas-por-pagar-list',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    DataTableFrameComponent
  ],
  templateUrl: './cuentas-por-pagar-list.component.html',
  styleUrls: ['./cuentas-por-pagar-list.component.scss', './cuentas-por-pagar-list.trace.scss']
})
export class CuentasPorPagarListComponent implements OnInit {
  private readonly api = inject(CuentasPorPagarConsultaApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private ignorarSiguienteUrl = false;
  private carteraRequest = 0;
  private detalleRequest = 0;
  private historialRequest = 0;
  private trazabilidadRequest = 0;

  protected readonly hoy = this.fechaIsoGuayaquil(new Date());
  protected readonly vista = signal<VistaConsulta>('cartera');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly fechaCorte = signal(this.hoy);
  protected readonly tramo = signal<TramoCartera>('TODOS');
  protected readonly busquedaCartera = signal('');
  protected readonly resumen = signal<ResumenCarteraCxp>(RESUMEN_VACIO);
  protected readonly proveedores = signal<ProveedorCarteraCxp[]>([]);
  protected readonly carteraPage = signal(0);
  protected readonly carteraSize = signal(25);
  protected readonly carteraTotal = signal(0);

  protected readonly proveedorExpandido = signal<string | null>(null);
  protected readonly cargandoDetalle = signal(false);
  protected readonly documentosProveedor = signal<DocumentoCarteraCxp[]>([]);
  protected readonly detallePage = signal(0);
  protected readonly detalleSize = signal(50);
  protected readonly detalleTotal = signal(0);
  protected readonly seleccionados = signal<Set<string>>(new Set());

  protected readonly fechaDesde = signal(this.inicioMes());
  protected readonly fechaHasta = signal(this.hoy);
  protected readonly estadoHistorial = signal<'TODOS' | EstadoDocumentoPorPagar>('TODOS');
  protected readonly origenHistorial = signal<'TODOS' | OrigenDocumentoPorPagar>('TODOS');
  protected readonly busquedaHistorial = signal('');
  protected readonly historial = signal<DocumentoHistorialCxp[]>([]);
  protected readonly historialPage = signal(0);
  protected readonly historialSize = signal(25);
  protected readonly historialTotal = signal(0);

  protected readonly cargandoTrazabilidad = signal(false);
  protected readonly trazabilidad = signal<TrazabilidadDocumentoCxp | null>(null);

  protected readonly corteActual = computed(() => this.fechaCorte() === this.hoy);
  protected readonly puedePrepararPago = computed(() => this.corteActual() && this.seleccionados().size > 0);
  protected readonly proveedorSeleccionado = computed(() =>
    this.proveedores().find((proveedor) => proveedor.proveedorClave === this.proveedorExpandido()) ?? null
  );

  ngOnInit(): void {
    this.hidratarDesdeUrl();
    this.route.queryParamMap.pipe(skip(1), takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (this.ignorarSiguienteUrl) {
        this.ignorarSiguienteUrl = false;
        return;
      }
      this.hidratarDesdeUrl(params);
      this.cerrarDetalle();
      this.cerrarTrazabilidad();
      void this.cargarVista();
    });
    void this.cargarVista();
  }

  protected cambiarVista(vista: VistaConsulta): void {
    if (this.vista() === vista) return;
    this.vista.set(vista);
    this.error.set(null);
    this.cerrarDetalle();
    this.cerrarTrazabilidad();
    void this.actualizarUrl();
    void this.cargarVista();
  }

  protected buscarCartera(): void {
    this.carteraPage.set(0);
    this.cerrarDetalle();
    void this.actualizarUrl();
    void this.cargarCartera();
  }

  protected buscarHistorial(): void {
    this.historialPage.set(0);
    this.cerrarTrazabilidad();
    void this.actualizarUrl();
    void this.cargarHistorial();
  }

  protected actualizarPaginaCartera(event: PageEvent): void {
    this.carteraPage.set(event.pageIndex);
    this.carteraSize.set(event.pageSize);
    this.cerrarDetalle();
    void this.actualizarUrl();
    void this.cargarCartera();
  }

  protected actualizarPaginaHistorial(event: PageEvent): void {
    this.historialPage.set(event.pageIndex);
    this.historialSize.set(event.pageSize);
    void this.actualizarUrl();
    void this.cargarHistorial();
  }

  protected async alternarProveedor(proveedor: ProveedorCarteraCxp): Promise<void> {
    if (this.proveedorExpandido() === proveedor.proveedorClave) {
      this.cerrarDetalle();
      return;
    }
    this.proveedorExpandido.set(proveedor.proveedorClave);
    this.detallePage.set(0);
    this.documentosProveedor.set([]);
    this.seleccionados.set(new Set());
    await this.cargarDetalleProveedor();
  }

  protected cambiarPaginaDetalle(delta: number): void {
    const siguiente = this.detallePage() + delta;
    const paginas = Math.ceil(this.detalleTotal() / this.detalleSize());
    if (siguiente < 0 || siguiente >= paginas) return;
    this.detallePage.set(siguiente);
    void this.cargarDetalleProveedor();
  }

  protected seleccionarDocumento(documento: DocumentoCarteraCxp, checked: boolean): void {
    if (!documento.elegiblePago) return;
    this.seleccionados.update((actual) => {
      const siguiente = new Set(actual);
      checked ? siguiente.add(documento.id) : siguiente.delete(documento.id);
      return siguiente;
    });
  }

  protected prepararPago(): void {
    const proveedor = this.proveedorExpandido();
    const documentos = Array.from(this.seleccionados());
    if (!proveedor || documentos.length === 0 || !this.corteActual()) return;
    void this.router.navigate(['/workspace/contabilidad/cuentas-por-pagar/pagos/nuevo'], {
      queryParams: { proveedor, documentos: documentos.join(',') }
    });
  }

  protected async abrirTrazabilidad(documento: DocumentoHistorialCxp | DocumentoCarteraCxp): Promise<void> {
    const request = ++this.trazabilidadRequest;
    this.trazabilidad.set(null);
    this.cargandoTrazabilidad.set(true);
    try {
      const resultado = await this.api.consultarTrazabilidad(documento.id);
      if (request !== this.trazabilidadRequest) return;
      this.trazabilidad.set(resultado);
    } catch (error: unknown) {
      if (request !== this.trazabilidadRequest) return;
      this.snackBar.open(this.mensajeError(error, 'No se pudo cargar la trazabilidad del documento.'), 'Cerrar', { duration: 4500 });
    } finally {
      if (request === this.trazabilidadRequest) this.cargandoTrazabilidad.set(false);
    }
  }

  protected cerrarTrazabilidad(): void {
    this.trazabilidadRequest++;
    this.trazabilidad.set(null);
    this.cargandoTrazabilidad.set(false);
  }

  protected etiquetaOrigen(origen: OrigenDocumentoPorPagar): string {
    return { FACTURA_COMPRA: 'Factura', MANUAL: 'Manual', RETENCION: 'Retención', NOMINA: 'Nómina' }[origen];
  }

  protected etiquetaEstado(estado: EstadoDocumentoPorPagar): string {
    return { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADA: 'Pagada', ANULADA: 'Anulada' }[estado];
  }

  protected estadoCambio(documento: DocumentoCarteraCxp): string | null {
    if (documento.estadoAlCorte === documento.estadoActual) return null;
    return `${this.etiquetaEstado(documento.estadoAlCorte)} al corte · ${this.etiquetaEstado(documento.estadoActual)} actualmente`;
  }

  protected formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const [anio, mes, dia] = fecha.split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
  }

  protected detalleAnulacion(documento: DocumentoHistorialCxp): string | null {
    if (documento.estadoActual !== 'ANULADA') return null;
    if (documento.motivoAnulacion === 'ASIENTO_REVERSADO') {
      return 'Por reverso del asiento · no suma en cartera';
    }
    if (documento.motivoAnulacion === 'COMPRA_ANULADA_SIN_ASIENTO') {
      return 'Compra anulada sin asiento · no suma en cartera';
    }
    return 'No suma en cartera';
  }

  protected rutaDocumentoOrigen(trace: TrazabilidadDocumentoCxp): string[] | null {
    if (!trace.origen?.id) return null;
    return trace.documento.origenTipo === 'FACTURA_COMPRA'
      ? ['/workspace/contabilidad/compras', trace.origen.id, 'editar']
      : null;
  }

  private async cargarVista(): Promise<void> {
    if (this.vista() === 'cartera') await this.cargarCartera();
    else await this.cargarHistorial();
  }

  private async cargarCartera(): Promise<void> {
    if (!this.fechaCorte()) return;
    const request = ++this.carteraRequest;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.api.consultarCartera({
        fechaCorte: this.fechaCorte(),
        tramo: this.tramo(),
        busqueda: this.busquedaCartera(),
        pagina: this.carteraPage(),
        limite: this.carteraSize()
      });
      if (request !== this.carteraRequest || this.vista() !== 'cartera') return;
      this.resumen.set(resultado.resumen);
      this.proveedores.set(resultado.items);
      this.carteraTotal.set(resultado.total);
    } catch (error: unknown) {
      if (request !== this.carteraRequest || this.vista() !== 'cartera') return;
      this.resumen.set(RESUMEN_VACIO);
      this.proveedores.set([]);
      this.carteraTotal.set(0);
      this.error.set(this.mensajeError(error, 'No se pudo reconstruir la cartera. Revisa los filtros e inténtalo nuevamente.'));
    } finally {
      if (request === this.carteraRequest && this.vista() === 'cartera') this.cargando.set(false);
    }
  }

  private async cargarDetalleProveedor(): Promise<void> {
    const proveedorClave = this.proveedorExpandido();
    if (!proveedorClave) return;
    const request = ++this.detalleRequest;
    this.cargandoDetalle.set(true);
    try {
      const resultado = await this.api.consultarProveedor({
        fechaCorte: this.fechaCorte(), proveedorClave, pagina: this.detallePage(), limite: this.detalleSize()
      });
      if (request !== this.detalleRequest || this.proveedorExpandido() !== proveedorClave) return;
      this.documentosProveedor.set(resultado.items);
      this.detalleTotal.set(resultado.total);
    } catch (error: unknown) {
      if (request !== this.detalleRequest || this.proveedorExpandido() !== proveedorClave) return;
      this.documentosProveedor.set([]);
      this.detalleTotal.set(0);
      this.snackBar.open(this.mensajeError(error, 'No se pudo cargar la composición del saldo.'), 'Cerrar', { duration: 4500 });
    } finally {
      if (request === this.detalleRequest) this.cargandoDetalle.set(false);
    }
  }

  private async cargarHistorial(): Promise<void> {
    if (!this.fechaDesde() || !this.fechaHasta()) return;
    const request = ++this.historialRequest;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.api.consultarHistorial({
        fechaDesde: this.fechaDesde(), fechaHasta: this.fechaHasta(), estado: this.estadoHistorial(),
        origen: this.origenHistorial(), busqueda: this.busquedaHistorial(), pagina: this.historialPage(),
        limite: this.historialSize()
      });
      if (request !== this.historialRequest || this.vista() !== 'historial') return;
      this.historial.set(resultado.items);
      this.historialTotal.set(resultado.total);
    } catch (error: unknown) {
      if (request !== this.historialRequest || this.vista() !== 'historial') return;
      this.historial.set([]);
      this.historialTotal.set(0);
      this.error.set(this.mensajeError(error, 'No se pudo consultar el historial. Revisa el rango de fechas.'));
    } finally {
      if (request === this.historialRequest && this.vista() === 'historial') this.cargando.set(false);
    }
  }

  private cerrarDetalle(): void {
    this.detalleRequest++;
    this.proveedorExpandido.set(null);
    this.documentosProveedor.set([]);
    this.detalleTotal.set(0);
    this.detallePage.set(0);
    this.seleccionados.set(new Set());
  }

  private hidratarDesdeUrl(params: ParamMap = this.route.snapshot.queryParamMap): void {
    this.vista.set(params.get('vista') === 'historial' ? 'historial' : 'cartera');
    this.fechaCorte.set(params.get('corte') || this.hoy);
    this.tramo.set(this.esTramo(params.get('tramo')) ? params.get('tramo') as TramoCartera : 'TODOS');
    this.busquedaCartera.set(params.get('q') || '');
    this.fechaDesde.set(params.get('desde') || this.inicioMes());
    this.fechaHasta.set(params.get('hasta') || this.hoy);
    this.estadoHistorial.set(this.esEstado(params.get('estado')) ? params.get('estado') as 'TODOS' | EstadoDocumentoPorPagar : 'TODOS');
    this.origenHistorial.set(this.esOrigen(params.get('origen')) ? params.get('origen') as 'TODOS' | OrigenDocumentoPorPagar : 'TODOS');
    this.busquedaHistorial.set(params.get('q') || '');
    const pageValue = Number(params.get('page') || 0);
    const page = Number.isSafeInteger(pageValue) && pageValue >= 0 ? Math.min(pageValue, 100_000) : 0;
    const size = [25, 50, 100].includes(Number(params.get('size'))) ? Number(params.get('size')) : 25;
    if (this.vista() === 'cartera') { this.carteraPage.set(page); this.carteraSize.set(size); }
    else { this.historialPage.set(page); this.historialSize.set(size); }
  }

  private actualizarUrl(): Promise<boolean> {
    const cartera = this.vista() === 'cartera';
    this.ignorarSiguienteUrl = true;
    const navegacion = this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: cartera ? {
        vista: 'cartera', corte: this.fechaCorte(), tramo: this.tramo(), q: this.busquedaCartera().trim() || null,
        page: this.carteraPage(), size: this.carteraSize()
      } : {
        vista: 'historial', desde: this.fechaDesde(), hasta: this.fechaHasta(), estado: this.estadoHistorial(),
        origen: this.origenHistorial(), q: this.busquedaHistorial().trim() || null,
        page: this.historialPage(), size: this.historialSize()
      }
    });
    void navegacion.finally(() => queueMicrotask(() => { this.ignorarSiguienteUrl = false; }));
    return navegacion;
  }

  private fechaIsoGuayaquil(fecha: Date): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(fecha);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  private inicioMes(): string {
    return `${this.hoy.slice(0, 7)}-01`;
  }

  private mensajeError(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string } | string }).error;
      if (typeof payload === 'string' && payload.trim()) return payload;
      if (payload && typeof payload === 'object' && payload.message) return payload.message;
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private esTramo(value: string | null): boolean {
    return ['TODOS', 'POR_VENCER', 'VENCIDO', '1_30', '31_60', '61_90', 'MAS_90', 'CREDITOS'].includes(value ?? '');
  }

  private esEstado(value: string | null): boolean {
    return ['TODOS', 'PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA'].includes(value ?? '');
  }

  private esOrigen(value: string | null): boolean {
    return ['TODOS', 'FACTURA_COMPRA', 'MANUAL', 'RETENCION', 'NOMINA'].includes(value ?? '');
  }
}

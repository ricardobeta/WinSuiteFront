import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ArchivosService } from '../../../../core/services/archivos.service';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { FacturaCompraParsed } from '../../models/compras.models';
import { ComprasXmlService } from '../../services/compras-xml.service';
import { FacturasCompraService } from '../../services/facturas-compra.service';

type EstadoResultado = 'creado' | 'duplicado' | 'error';

interface FilaResultado {
  archivo: string;
  proveedor: string;
  documento: string;
  total: number;
  estado: EstadoResultado;
  detalle: string;
}

@Component({
  selector: 'app-carga-masiva-compras',
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
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    ArchivoUploaderComponent
  ],
  template: `
    <section class="masiva-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Compras</p>
          <h2>Carga masiva de compras</h2>
          <p class="support">Selecciona los XML del repositorio o sube nuevos. Cada comprobante genera una factura de compra en estado <strong>Borrador</strong> que luego podrás revisar, aprobar y contabilizar.</p>
        </div>
        <a mat-stroked-button routerLink="/workspace/contabilidad/compras">
          <mat-icon>arrow_back</mat-icon>
          Volver a compras
        </a>
      </header>

      <section class="surface-card repo-card">
        <div class="repo-header">
          <div>
            <h3>XML en el repositorio</h3>
            <p class="support">Documentos con extensión XML disponibles en el módulo Archivos (incluye los descargados del SRI).</p>
          </div>
          @if (consultaRealizada() && xmlsFiltrados().length > 0) {
            <mat-checkbox [checked]="todosSeleccionados()" [indeterminate]="algunoVisibleSeleccionado() && !todosSeleccionados()" (change)="alternarTodos($event.checked)">
              Seleccionar visibles
            </mat-checkbox>
          }
        </div>

        <div class="filters-row">
          <mat-form-field appearance="outline">
            <mat-label>Fecha inicio</mat-label>
            <input matInput [matDatepicker]="inicioPicker" [formControl]="fechaInicio" />
            <mat-datepicker-toggle matIconSuffix [for]="inicioPicker"></mat-datepicker-toggle>
            <mat-datepicker #inicioPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha fin</mat-label>
            <input matInput [matDatepicker]="finPicker" [formControl]="fechaFin" />
            <mat-datepicker-toggle matIconSuffix [for]="finPicker"></mat-datepicker-toggle>
            <mat-datepicker #finPicker></mat-datepicker>
          </mat-form-field>

          <button mat-flat-button color="primary" type="button" [disabled]="cargandoXmls() || !rangoValido()" (click)="cargarXmls()">
            <mat-icon>search</mat-icon>
            Buscar XML
          </button>

          @if (consultaRealizada()) {
            <button mat-stroked-button type="button" (click)="limpiarFechas()">
              <mat-icon>filter_alt_off</mat-icon>
              Limpiar
            </button>
          }
        </div>

        @if (!rangoValido()) {
          <div class="empty-state">
            <mat-icon>date_range</mat-icon>
            <p>Selecciona fecha inicio y fecha fin para cargar los XML del periodo.</p>
          </div>
        } @else if (cargandoXmls()) {
          <div class="empty-state">
            <mat-icon>hourglass_top</mat-icon>
            <p>Cargando XML del rango seleccionado...</p>
          </div>
        } @else if (!consultaRealizada()) {
          <div class="empty-state">
            <mat-icon>manage_search</mat-icon>
            <p>Presiona Buscar XML para consultar solo ese rango en Firebase.</p>
          </div>
        } @else if (xmlsRepo().length === 0) {
          <div class="empty-state">
            <mat-icon>folder_off</mat-icon>
            <p>No hay archivos XML en el rango seleccionado.</p>
          </div>
        } @else if (xmlsFiltrados().length === 0) {
          <div class="empty-state">
            <mat-icon>filter_alt_off</mat-icon>
            <p>No hay XML procesables en el rango seleccionado.</p>
          </div>
        } @else {
          <div class="xml-list">
            @for (item of xmlsFiltrados(); track item.id) {
              <label class="xml-row" [class.checked]="seleccion().has(item.id)">
                <mat-checkbox [checked]="seleccion().has(item.id)" (change)="alternar(item.id, $event.checked)"></mat-checkbox>
                <mat-icon>draft</mat-icon>
                <div class="xml-info">
                  <span class="xml-name">{{ item.name }}</span>
                  <span class="xml-sub">{{ item.proveedor || item.rucProveedor || 'Proveedor no identificado' }} · {{ item.numeroDocumento || '—' }}</span>
                </div>
              </label>
            }
          </div>
        }
      </section>

      <app-archivo-uploader sourceModule="compras" (uploaded)="onXmlSubido($event)"></app-archivo-uploader>

      <div class="actions">
        <button mat-flat-button color="primary" [disabled]="procesando() || seleccionVisible().length === 0" (click)="procesar()">
          <mat-icon>playlist_add_check</mat-icon>
          Procesar {{ seleccionVisible().length }} seleccionado(s)
        </button>
      </div>

      @if (procesando()) {
        <mat-progress-bar mode="determinate" [value]="progreso()"></mat-progress-bar>
      }

      @if (resultados().length > 0) {
        <section class="surface-card table-card">
          <div class="resumen">
            <span class="pill pill-ok">{{ conteo('creado') }} creados</span>
            <span class="pill pill-draft">{{ conteo('duplicado') }} duplicados</span>
            <span class="pill pill-void">{{ conteo('error') }} con error</span>
          </div>
          <div class="table-wrap">
            <table mat-table [dataSource]="resultados()">
              <ng-container matColumnDef="archivo">
                <th mat-header-cell *matHeaderCellDef>Archivo</th>
                <td mat-cell *matCellDef="let row">{{ row.archivo }}</td>
              </ng-container>
              <ng-container matColumnDef="proveedor">
                <th mat-header-cell *matHeaderCellDef>Proveedor</th>
                <td mat-cell *matCellDef="let row">{{ row.proveedor }}</td>
              </ng-container>
              <ng-container matColumnDef="documento">
                <th mat-header-cell *matHeaderCellDef>Documento</th>
                <td mat-cell *matCellDef="let row">{{ row.documento }}</td>
              </ng-container>
              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="num">Total</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.total | currency: 'USD':'symbol-narrow':'1.2-2' }}</td>
              </ng-container>
              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <span class="pill" [class]="claseEstado(row.estado)" [matTooltip]="row.detalle">{{ etiquetaEstado(row.estado) }}</span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .masiva-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 72ch; }

    .repo-card { padding: 1.25rem; display: grid; gap: 1rem; }
    .repo-header { display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; }
    .repo-header h3 { margin: 0; }
    .filters-row { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .filters-row mat-form-field { width: min(100%, 220px); }
    .xml-list { display: grid; gap: .5rem; max-height: 320px; overflow: auto; }
    .xml-row { display: flex; align-items: center; gap: .75rem; padding: .6rem .8rem; border-radius: .75rem; border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--tc-ghost-border)); cursor: pointer; }
    .xml-row.checked { background: color-mix(in srgb, var(--primary) 6%, transparent); border-color: color-mix(in srgb, var(--primary) 24%, transparent); }
    .xml-row mat-icon { color: var(--primary); }
    .xml-info { display: grid; }
    .xml-name { font-weight: 600; }
    .xml-sub { font-size: .78rem; color: var(--muted-foreground); }

    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2rem 1rem; text-align: center; color: var(--muted-foreground); }
    .empty-state mat-icon { font-size: 2.5rem; width: 2.5rem; height: 2.5rem; }

    .actions { display: flex; justify-content: flex-end; }

    .table-card { padding: 1rem; display: grid; gap: 1rem; }
    .resumen { display: flex; gap: .5rem; flex-wrap: wrap; }
    .table-wrap { overflow: auto; }
    table { width: 100%; background: transparent; }
    th.num, td.num { text-align: right; }

    .pill { display: inline-flex; align-items: center; gap: .3rem; padding: .28rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 600; }
    .pill-draft { background: color-mix(in srgb, #b7791f 16%, transparent); color: #9c6412; }
    .pill-ok { background: color-mix(in srgb, var(--success, #1a7f52) 16%, transparent); color: var(--success, #1a7f52); }
    .pill-void { background: color-mix(in srgb, var(--destructive) 14%, transparent); color: var(--destructive); }

    @media (max-width: 640px) {
      .filters-row { display: grid; grid-template-columns: 1fr; }
      .filters-row mat-form-field { width: 100%; }
    }
  `]
})
export class CargaMasivaComprasComponent {
  private readonly archivosService = inject(ArchivosService);
  private readonly comprasXml = inject(ComprasXmlService);
  private readonly facturasService = inject(FacturasCompraService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columnas = ['archivo', 'proveedor', 'documento', 'total', 'estado'];

  private readonly archivos = signal<ArchivoItem[]>([]);
  protected readonly seleccion = signal<Set<string>>(new Set());
  protected readonly resultados = signal<FilaResultado[]>([]);
  protected readonly procesando = signal(false);
  protected readonly progreso = signal(0);
  protected readonly fechaInicio = new FormControl<Date | null>(null);
  protected readonly fechaFin = new FormControl<Date | null>(null);
  protected readonly fechaInicioSignal = signal<Date | null>(null);
  protected readonly fechaFinSignal = signal<Date | null>(null);
  protected readonly cargandoXmls = signal(false);
  protected readonly consultaRealizada = signal(false);

  protected readonly xmlsRepo = computed(() =>
    this.archivos().filter((item) => (item.extension ?? item.name.split('.').pop() ?? '').toString().toLowerCase() === 'xml')
  );
  protected readonly xmlsFiltrados = computed(() => {
    const inicio = this.inicioDelDia(this.fechaInicioSignal());
    const fin = this.finDelDia(this.fechaFinSignal());
    return this.xmlsRepo().filter((item) => {
      const fecha = this.fechaArchivo(item);
      if (!fecha) {
        return true;
      }
      if (inicio && fecha < inicio) {
        return false;
      }
      if (fin && fecha > fin) {
        return false;
      }
      return true;
    });
  });
  protected readonly seleccionVisible = computed(() =>
    this.xmlsFiltrados().filter((item) => this.seleccion().has(item.id))
  );
  protected readonly algunoVisibleSeleccionado = computed(() => this.seleccionVisible().length > 0);
  protected readonly todosSeleccionados = computed(() => {
    const repo = this.xmlsFiltrados();
    return repo.length > 0 && repo.every((item) => this.seleccion().has(item.id));
  });

  constructor() {
    this.fechaInicio.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.fechaInicioSignal.set(value));
    this.fechaFin.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.fechaFinSignal.set(value));
  }

  protected rangoValido(): boolean {
    const inicio = this.inicioDelDia(this.fechaInicio.value);
    const fin = this.finDelDia(this.fechaFin.value);
    return !!inicio && !!fin && inicio <= fin;
  }

  protected async cargarXmls(): Promise<void> {
    const inicio = this.inicioDelDia(this.fechaInicio.value);
    const fin = this.finDelDia(this.fechaFin.value);
    if (!inicio || !fin || inicio > fin) {
      this.toast('Selecciona un rango de fechas valido.', 'date_range');
      return;
    }

    this.fechaInicioSignal.set(this.fechaInicio.value);
    this.fechaFinSignal.set(this.fechaFin.value);
    this.cargandoXmls.set(true);
    this.consultaRealizada.set(false);
    this.seleccion.set(new Set());
    this.resultados.set([]);

    try {
      const archivos = await this.archivosService.getArchivosPorFechaEmision(
        this.fechaAIso(inicio),
        this.fechaAIso(fin)
      );
      this.archivos.set(archivos);
      this.consultaRealizada.set(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los XML del rango.';
      this.toast(message, 'error');
      this.archivos.set([]);
      this.consultaRealizada.set(true);
    } finally {
      this.cargandoXmls.set(false);
    }
  }

  protected alternar(id: string, checked: boolean): void {
    const set = new Set(this.seleccion());
    if (checked) {
      set.add(id);
    } else {
      set.delete(id);
    }
    this.seleccion.set(set);
  }

  protected alternarTodos(checked: boolean): void {
    const visibles = this.xmlsFiltrados();
    const set = new Set(this.seleccion());
    if (!checked) {
      visibles.forEach((item) => set.delete(item.id));
      this.seleccion.set(set);
      return;
    }
    visibles.forEach((item) => set.add(item.id));
    this.seleccion.set(set);
  }

  protected limpiarFechas(): void {
    this.fechaInicio.setValue(null);
    this.fechaFin.setValue(null);
    this.fechaInicioSignal.set(null);
    this.fechaFinSignal.set(null);
    this.archivos.set([]);
    this.seleccion.set(new Set());
    this.resultados.set([]);
    this.consultaRealizada.set(false);
  }

  protected onXmlSubido(item: ArchivoItem): void {
    // El listado es reactivo; solo autoseleccionamos el recién subido.
    this.archivos.update((items) => {
      const exists = items.some((archivo) => archivo.id === item.id);
      return exists ? items : [item, ...items];
    });
    this.consultaRealizada.set(true);
    this.alternar(item.id, true);
  }

  protected async procesar(): Promise<void> {
    const seleccionados = this.seleccionVisible();
    if (seleccionados.length === 0) {
      return;
    }
    this.procesando.set(true);
    this.progreso.set(0);
    const filas: FilaResultado[] = [];

    for (let i = 0; i < seleccionados.length; i++) {
      const item = seleccionados[i];
      filas.push(await this.procesarUno(item));
      this.progreso.set(Math.round(((i + 1) / seleccionados.length) * 100));
      this.resultados.set([...filas]);
    }

    this.procesando.set(false);
    const creados = filas.filter((f) => f.estado === 'creado').length;
    this.toast(`Carga masiva finalizada: ${creados} borrador(es) creado(s).`, 'task_alt');
    // Limpiar la selección de los procesados con éxito.
    this.seleccion.set(new Set());
  }

  private async procesarUno(item: ArchivoItem): Promise<FilaResultado> {
    const base: FilaResultado = {
      archivo: item.name,
      proveedor: item.proveedor || item.rucProveedor || '—',
      documento: item.numeroDocumento || '—',
      total: 0,
      estado: 'error',
      detalle: ''
    };
    if (!item.storagePath) {
      return { ...base, detalle: 'El archivo no tiene ruta de almacenamiento.' };
    }
    try {
      const parsed = await firstValueFrom(this.comprasXml.parseXml(item.storagePath));
      const documento = `${parsed.establecimiento}-${parsed.puntoEmision}-${parsed.secuencial}`;
      const proveedor = parsed.razonSocialProv || base.proveedor;
      const total = Number(parsed.importeTotal ?? 0);

      const duplicado = await this.facturasService.buscarDuplicadoDocumento({
        claveAcceso: parsed.claveAcceso,
        establecimiento: parsed.establecimiento,
        puntoEmision: parsed.puntoEmision,
        secuencial: parsed.secuencial,
        idProv: parsed.idProv,
        tipoComprobante: parsed.tipoComprobante
      });
      if (duplicado) {
        return { archivo: item.name, proveedor, documento, total, estado: 'duplicado', detalle: 'Ya existe una compra con este comprobante.' };
      }

      const pdf = parsed.claveAcceso ? await this.archivosService.buscarPorClaveAcceso(parsed.claveAcceso, 'pdf') : null;
      const input = this.facturasService.construirBorradorDesdeParsed(parsed, {
        archivoId: item.id,
        xmlStoragePath: item.storagePath,
        pdfArchivoId: pdf?.id ?? null,
        pdfDownloadUrl: pdf?.downloadUrl ?? null
      });
      await this.facturasService.crearFacturaCompra(input);
      return { archivo: item.name, proveedor, documento, total, estado: 'creado', detalle: 'Borrador creado correctamente.' };
    } catch (error) {
      const detalle = (error as { error?: { message?: string }; message?: string })?.error?.message
        ?? (error as Error)?.message
        ?? 'No se pudo procesar el XML.';
      return { ...base, detalle };
    }
  }

  protected conteo(estado: EstadoResultado): number {
    return this.resultados().filter((f) => f.estado === estado).length;
  }

  protected etiquetaEstado(estado: EstadoResultado): string {
    return { creado: 'Creado', duplicado: 'Duplicado', error: 'Error' }[estado];
  }

  protected claseEstado(estado: EstadoResultado): string {
    return { creado: 'pill-ok', duplicado: 'pill-draft', error: 'pill-void' }[estado];
  }

  protected fechaArchivo(item: ArchivoItem): Date | null {
    const emision = this.parseFecha(item.fechaEmision);
    if (emision) {
      return emision;
    }
    const emisionPorNombre = this.parseFechaDesdeNombre(item.name);
    if (emisionPorNombre) {
      return emisionPorNombre;
    }
    return typeof item.uploadedAt === 'number' ? new Date(item.uploadedAt) : null;
  }

  private parseFecha(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (local) {
      return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
    }
    const fecha = new Date(value);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private parseFechaDesdeNombre(name: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(name);
    if (!match) {
      return null;
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private inicioDelDia(value: Date | null): Date | null {
    return value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : null;
  }

  private finDelDia(value: Date | null): Date | null {
    return value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999) : null;
  }

  private fechaAIso(value: Date): string {
    const anio = value.getFullYear();
    const mes = String(value.getMonth() + 1).padStart(2, '0');
    const dia = String(value.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

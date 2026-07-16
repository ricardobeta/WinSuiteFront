import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, Injector, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { ArchivosService } from '../../../../core/services/archivos.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ArchivoSelectorDialogComponent } from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ARCHIVO_MAX_TOTAL_BYTES, ArchivoItem, ArchivosUsage } from '../../../../shared/models/archivos.models';
import { SitioMediaService } from '../../../sitio-web/services/sitio-media.service';


@Component({
  selector: 'app-archivos-lista',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    ArchivoUploaderComponent
  ],
  template: `
    <section class="archivos-page">
      <section class="surface-card summary-card">
        <div class="summary-content">
          <div>
            <p class="eyebrow">Almacenamiento</p>
            <h2>Resumen de archivos</h2>
            <p>Controla el espacio privado usado por tu empresa y consulta por separado el contenido publico de Sites.</p>
          </div>

          <div class="summary-metrics">
            <article class="metric-card">
              <p>Total cargado</p>
              <h3>{{ formatBytes(usage().totalBytes) }}</h3>
              <span>{{ usagePercent() }}% de {{ formatBytes(maxTotalBytes) }}</span>
              <mat-progress-bar mode="determinate" [value]="usagePercent()"></mat-progress-bar>
            </article>
            <article class="metric-card">
              <p>Archivos activos</p>
              <h3>{{ usage().totalCount }}</h3>
              <span>Registros en el repositorio</span>
            </article>
          </div>
        </div>
      </section>

      @if (canCreate()) {
        <app-archivo-uploader
          [sourceModule]="'archivos'"
          (uploaded)="onUploadSuccess($event)"
          (failed)="onUploadFailed($event)"
        />
      } @else {
        <section class="surface-card locked-card">
          <mat-icon>lock</mat-icon>
          <div>
            <h3>Sin permisos de carga</h3>
            <p>Solicita acceso de crear archivos para habilitar las cargas.</p>
          </div>
        </section>
      }

      <section class="surface-card filters-card">
        <form class="filters-grid" [formGroup]="filterForm">
          <mat-form-field appearance="outline">
            <mat-label>Buscar</mat-label>
            <input matInput placeholder="Nombre del archivo" formControlName="search" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="type">
              <mat-option value="all">Todos</mat-option>
              <mat-option value="excel">Excel</mat-option>
              <mat-option value="csv">CSV</mat-option>
              <mat-option value="imagen">Imagenes</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Modulo</mat-label>
            <mat-select formControlName="module">
              <mat-option value="all">Todos</mat-option>
              @for (module of moduleOptions(); track module) {
                <mat-option [value]="module">{{ formatModule(module) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="date-range-fields" formGroupName="dateRange">
            <mat-form-field appearance="outline">
              <mat-label>Fecha desde</mat-label>
              <input matInput [matDatepicker]="fromPicker" formControlName="from" />
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
              <mat-datepicker #fromPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha hasta</mat-label>
              <input matInput [matDatepicker]="toPicker" formControlName="to" />
              <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
              <mat-datepicker #toPicker></mat-datepicker>
            </mat-form-field>
          </div>

          <button mat-stroked-button type="button" (click)="clearFilters()">
            Limpiar
          </button>
        </form>
      </section>

      <section class="surface-card table-card">
        <div class="table-header">
          <div>
            <p class="eyebrow">Listado</p>
            <h3>{{ filteredCount() }} archivos encontrados</h3>
          </div>

          <div class="table-actions">
            @if (isSitesModuleSelected() && sitesNextPageToken()) {
              <button mat-stroked-button type="button" [disabled]="sitesLoading()" (click)="loadMoreSites()">
                {{ sitesLoading() ? 'Consultando...' : 'Cargar mas de Sites' }}
              </button>
            }
            <button mat-raised-button color="primary" type="button" (click)="openSelector()">
              <mat-icon>search</mat-icon>
              {{ isSitesModuleSelected() ? 'Imagenes publicas' : 'Buscar o reutilizar' }}
            </button>
          </div>
        </div>

        @if (dataSource.data.length === 0) {
          <div class="empty-state">
            <mat-icon>folder_off</mat-icon>
            <h4>No hay archivos para mostrar</h4>
            <p>Sube un archivo o ajusta los filtros para ver resultados.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="dataSource" matSort>
              <ng-container matColumnDef="archivo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Archivo</th>
                <td mat-cell *matCellDef="let row">
                  <div class="file-cell">
                    <span class="file-name">{{ row.name }}</span>
                    <span class="file-meta">
                      {{ row.uploadedBy || 'Equipo' }}
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tipo</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip>{{ typeLabel(row) }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="modulo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Modulo</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip color="primary">{{ formatModule(row.sourceModule || 'general') }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.uploadedAt | date: 'mediumDate' }}</td>
              </ng-container>

              <ng-container matColumnDef="tamano">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tamano</th>
                <td mat-cell *matCellDef="let row">{{ formatBytes(row.sizeBytes) }}</td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <button
                    mat-icon-button
                    type="button"
                    color="primary"
                    matTooltip="Descargar"
                    (click)="download(row)"
                  >
                    <mat-icon>download</mat-icon>
                  </button>
                  @if (canDelete()) {
                    <button
                      mat-icon-button
                      type="button"
                      color="warn"
                      matTooltip="Eliminar"
                      (click)="confirmDelete(row)"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
            </table>
          </div>

          <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        }
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .archivos-page {
        display: grid;
        gap: 1.25rem;
      }

      .summary-card {
        padding: 1.5rem;
        background:
          radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%),
          var(--tc-surface-container-lowest);
        animation: fade-up 0.45s ease both;
        border-color: color-mix(in srgb, var(--primary) 12%, var(--tc-ghost-border));
      }

      .summary-content {
        display: grid;
        gap: 1.5rem;
      }

      .summary-content h2 {
        margin: 0;
        font-size: 1.5rem;
      }

      .summary-content p {
        margin: 0.35rem 0 0;
        color: var(--muted-foreground);
      }

      .summary-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .metric-card {
        padding: 1rem 1.25rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--primary) 6%, var(--card));
        border: 1px solid color-mix(in srgb, var(--primary) 14%, var(--tc-ghost-border));
        box-shadow: 0 8px 22px rgb(15 23 42 / 5%);
        display: grid;
        gap: 0.5rem;
      }

      .metric-card h3 {
        margin: 0;
        font-size: 1.35rem;
      }

      .metric-card span {
        color: var(--muted-foreground);
        font-size: 0.85rem;
      }

      .locked-card {
        padding: 1.25rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        background: color-mix(in srgb, var(--warning) 12%, var(--card));
        border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--tc-ghost-border));
        box-shadow: 0 8px 22px rgb(15 23 42 / 5%);
      }

      .locked-card h3 {
        margin: 0;
      }

      .filters-card {
        padding: 1.25rem;
      }

      .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        align-items: end;
      }

      .date-range-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(180px, 1fr));
        gap: 1rem;
        grid-column: span 2;
      }

      .table-card {
        padding: 1.25rem;
        display: grid;
        gap: 1rem;
      }

      .table-header {
        display: flex;
        justify-content: space-between;
        align-items: end;
      }

      .table-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .table-wrap {
        overflow: auto;
      }

      table {
        width: 100%;
        min-width: 820px;
      }

      thead tr {
        background: var(--tc-surface-container-low);
      }

      .file-cell {
        display: grid;
        gap: 0.2rem;
      }

      .file-name {
        font-weight: 600;
      }

      .file-meta {
        font-size: 0.8rem;
        color: var(--muted-foreground);
      }

      .empty-state {
        padding: 2.5rem 1.5rem;
        text-align: center;
        display: grid;
        gap: 0.5rem;
        justify-items: center;
        color: var(--muted-foreground);
      }

      .empty-state mat-icon {
        font-size: 2.5rem;
        width: 2.5rem;
        height: 2.5rem;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        color: var(--primary);
      }

      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 900px) {
        .date-range-fields {
          grid-template-columns: 1fr;
          grid-column: span 1;
        }

        .table-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }

        table {
          min-width: 680px;
        }
      }

      :host-context(html.theme-dark) .metric-card {
        background: color-mix(in srgb, var(--primary) 14%, var(--card));
        border-color: color-mix(in srgb, var(--primary) 30%, var(--tc-ghost-border));
        box-shadow: 0 10px 24px rgb(0 0 0 / 24%);
      }

      :host-context(html.theme-dark) .locked-card {
        background: color-mix(in srgb, var(--warning) 16%, var(--card));
        border-color: color-mix(in srgb, var(--warning) 40%, var(--tc-ghost-border));
        box-shadow: 0 10px 24px rgb(0 0 0 / 24%);
      }

      :host-context(html.theme-dark) .summary-card {
        background:
          radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 55%),
          var(--card);
      }
    `
  ]
})
export class ArchivosListaComponent implements OnInit, AfterViewInit {
  private readonly archivosService = inject(ArchivosService);
  private readonly sitioMediaService = inject(SitioMediaService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  @ViewChild(MatPaginator)
  set paginator(value: MatPaginator | undefined) {
    if (value) {
      this.dataSource.paginator = value;
    }
  }

  @ViewChild(MatSort)
  set sort(value: MatSort | undefined) {
    if (value) {
      this.dataSource.sort = value;
    }
  }

  protected readonly dataSource = new MatTableDataSource<ArchivoItem>([]);
  protected readonly usage = signal<ArchivosUsage>({ totalBytes: 0, totalCount: 0 });
  private readonly primaryFiles = signal<ArchivoItem[]>([]);
  private readonly sitesFiles = signal<ArchivoItem[]>([]);
  protected readonly files = computed(() => [
    ...this.primaryFiles().filter((file) => file.sourceModule !== 'sitio_web'),
    ...this.sitesFiles(),
  ]);
  protected readonly sitesLoading = signal(false);
  protected readonly sitesNextPageToken = signal<string | null>(null);
  private readonly sitesInitialized = signal(false);
  protected readonly filteredCount = signal(0);

  protected readonly maxTotalBytes = ARCHIVO_MAX_TOTAL_BYTES;
  protected readonly usagePercent = computed(() => {
    const total = this.usage().totalBytes;
    return Math.min(100, Math.round((total / this.maxTotalBytes) * 100));
  });

  protected readonly canCreate = computed(() => this.authorization.canAccess('archivos', 'create'));
  protected readonly canDelete = computed(() => this.authorization.canAccess('archivos', 'delete'));

  protected readonly moduleOptions = computed(() => {
    const modules = Array.from(new Set([
      ...this.files().map((file) => file.sourceModule || 'general'),
      'sitio_web',
    ]));
    return modules.sort((a, b) => a.localeCompare(b));
  });

  protected readonly displayedColumns = computed(() => {
    const base = ['archivo', 'tipo', 'modulo', 'fecha', 'tamano'];
    return this.canDelete() ? [...base, 'acciones'] : base;
  });

  protected readonly filterForm = this.fb.group({
    search: '',
    type: 'all',
    module: 'all',
    dateRange: this.fb.group({
      from: null,
      to: null
    })
  });

  ngOnInit(): void {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'archivo':
          return item.name?.toLowerCase() ?? '';
        case 'tipo':
          return this.resolveType(item);
        case 'modulo':
          return (item.sourceModule ?? '').toLowerCase();
        case 'fecha':
          return item.uploadedAt ?? 0;
        case 'tamano':
          return item.sizeBytes ?? 0;
        default:
          return '';
      }
    };

    this.archivosService
      .getArchivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((files) => {
        this.primaryFiles.set(files);
        this.applyFilters();
      });

    this.archivosService
      .getUsage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((usage) => this.usage.set(usage));

    this.filterForm.valueChanges
      .pipe(startWith(this.filterForm.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value.module === 'sitio_web' && !this.sitesInitialized()) {
          void this.loadSitesPage(true);
        }
        this.applyFilters();
      });
  }

  ngAfterViewInit(): void {
    // Bound through ViewChild setters to support conditional rendering.
  }

  protected formatModule(moduleKey: string): string {
    if (!moduleKey) {
      return 'General';
    }
    if (moduleKey === 'sitio_web') {
      return 'Sites (publico)';
    }
    return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  }

  protected typeLabel(item: ArchivoItem): string {
    const type = this.resolveType(item);
    switch (type) {
      case 'excel':
        return 'Excel';
      case 'csv':
        return 'CSV';
      case 'imagen':
        return 'Imagen';
      default:
        return 'Otro';
    }
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) {
      return '0 B';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  protected clearFilters(): void {
    this.filterForm.reset({
      search: '',
      type: 'all',
      module: 'all',
      dateRange: {
        from: null,
        to: null
      }
    });
  }

  protected download(item: ArchivoItem): void {
    if (!item.downloadUrl) {
      return;
    }
    window.open(item.downloadUrl, '_blank');
  }

  protected confirmDelete(item: ArchivoItem): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar archivo',
        message: item.sourceModule === 'sitio_web'
          ? `¿Deseas eliminar "${item.name}" del contenido publico? Si esta en uso, dejara de mostrarse en el sitio publicado.`
          : `¿Deseas eliminar "${item.name}"? Esta accion no se puede deshacer.`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      const eliminar = item.sourceModule === 'sitio_web'
        ? this.sitioMediaService.eliminarImagen(item.storagePath).then(() => {
            this.sitesFiles.update((actuales) => actuales.filter((archivo) => archivo.id !== item.id));
            this.applyFilters();
          })
        : this.archivosService.deleteArchivo(item);

      eliminar
        .then(() => this.showSuccess('Archivo eliminado correctamente.'))
        .catch(() => {
          this.snackBar.open('No se pudo eliminar el archivo.', 'Cerrar', { duration: 3200 });
        });
    });
  }

  protected openSelector(): void {
    const sites = this.isSitesModuleSelected();
    const dialogRef = this.dialog.open(ArchivoSelectorDialogComponent, {
      injector: this.injector,
      width: 'min(1100px, 96vw)',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        title: sites ? 'Imagenes publicas de Sites' : 'Buscar o reutilizar archivo',
        subtitle: sites
          ? 'Consulta o sube contenido exclusivo del bucket publico de Sites.'
          : 'Encuentra un archivo privado o sube uno nuevo en el mismo popup.',
        sourceModule: sites ? 'sitio_web' : 'archivos',
        storageTarget: sites ? 'sites' : 'principal',
        extensions: sites ? ['png', 'jpg', 'jpeg', 'webp', 'gif'] : undefined,
        allowUpload: true
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) {
        return;
      }

      if (sites && result.action === 'uploaded') {
        this.sitesFiles.update((actuales) => [
          result.archivo,
          ...actuales.filter((archivo) => archivo.id !== result.archivo.id),
        ]);
        this.applyFilters();
      }

      if (result.action === 'selected') {
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: `Archivo reutilizado: ${result.archivo.name}`, icon: 'replay' },
          duration: 2600,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        return;
      }

      this.showSuccess(`Archivo cargado: ${result.archivo.name}`);
    });
  }

  protected onUploadSuccess(item: ArchivoItem): void {
    this.showSuccess(`Archivo "${item.name}" cargado.`);
  }

  protected onUploadFailed(event: { file: File; error: string }): void {
    this.snackBar.open(event.error, 'Cerrar', { duration: 3200 });
  }

  protected isSitesModuleSelected(): boolean {
    return this.filterForm.controls.module.value === 'sitio_web';
  }

  protected loadMoreSites(): void {
    if (this.sitesNextPageToken()) {
      void this.loadSitesPage(false);
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon: 'check_circle' },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private async loadSitesPage(reset: boolean): Promise<void> {
    if (this.sitesLoading()) return;
    this.sitesLoading.set(true);
    try {
      const page = await this.sitioMediaService.listarImagenes(
        reset ? null : this.sitesNextPageToken(),
      );
      this.sitesFiles.update((actuales) => reset ? page.items : [...actuales, ...page.items]);
      this.sitesNextPageToken.set(page.nextPageToken);
      this.sitesInitialized.set(true);
      this.applyFilters();
    } catch (error) {
      this.snackBar.open(
        error instanceof Error ? error.message : 'No se pudieron consultar las imagenes de Sites.',
        'Cerrar',
        { duration: 4000 },
      );
    } finally {
      this.sitesLoading.set(false);
    }
  }

  private applyFilters(): void {
    const values = this.filterForm.getRawValue();
    const searchValue = values.search?.toLowerCase() ?? '';
    const typeValue = values.type ?? 'all';
    const moduleValue = values.module ?? 'all';
    const fromDate = values.dateRange?.from ? new Date(values.dateRange.from).getTime() : null;
    const toDate = values.dateRange?.to
      ? new Date(values.dateRange.to).setHours(23, 59, 59, 999)
      : null;

    const filtered = this.files().filter((item) => {
      if (searchValue && !item.name.toLowerCase().includes(searchValue)) {
        return false;
      }

      if (typeValue !== 'all' && this.resolveType(item) !== typeValue) {
        return false;
      }

      const itemModule = item.sourceModule || 'general';
      if (moduleValue !== 'all' && itemModule !== moduleValue) {
        return false;
      }

      if (fromDate && item.uploadedAt < fromDate) {
        return false;
      }

      if (toDate && item.uploadedAt > toDate) {
        return false;
      }

      return true;
    });

    this.dataSource.data = filtered;
    this.filteredCount.set(filtered.length);

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  private resolveType(item: ArchivoItem): string {
    const extension = item.extension ?? item.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'xls':
      case 'xlsx':
        return 'excel';
      case 'csv':
        return 'csv';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif':
        return 'imagen';
      default:
        return 'otro';
    }
  }
}

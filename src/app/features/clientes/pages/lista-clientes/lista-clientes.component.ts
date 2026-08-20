import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';

import { Cliente, CampoPersonalizado, ClienteDialogData, EtiquetaClienteConfig } from '../../../../shared/models/clientes.models';
import { ClientesService } from '../../../../core/services/clientes.service';
import { ConfiguracionClientesService } from '../../../../core/services/configuracion-clientes.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ClienteFormDialogComponent } from '../../../../shared/components/cliente-form-dialog/cliente-form-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CustomFieldValueComponent } from '../../../../shared/components/custom-field-value/custom-field-value.component';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { EtiquetaClienteChipComponent } from '../../../../shared/components/etiqueta-cliente-chip/etiqueta-cliente-chip.component';
import { TableColumnDefinition } from '../../../../shared/models/table-preferences.models';

@Component({
  selector: 'app-lista-clientes',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    CustomFieldValueComponent,
    DataTableFrameComponent,
    EtiquetaClienteChipComponent
  ],
  template: `
    <section class="clientes-card surface-card">
      <div class="toolbar">
        <div>
          <p class="eyebrow">Clientes</p>
          <h2>Lista de clientes</h2>
          <p>Consulta, modifica o elimina clientes y sus campos dinámicos.</p>
        </div>

        <button mat-raised-button color="primary" type="button" (click)="abrirFormularioCreacion()">
          <mat-icon>add</mat-icon>
          Nuevo cliente
        </button>
      </div>

      <app-data-table-frame
        tableModule="clientes"
        tableId="lista"
        [columns]="columnDefinitions()"
        [showSearch]="false"
        [showPaginator]="false"
      >
        <table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="nombreCompleto">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre completo</th>
            <td mat-cell *matCellDef="let row">
              <div class="client-name">
                <span>{{ row.nombreCompleto }}</span>
                @if (row.fichaIncompleta) { <span class="incomplete-badge">Ficha incompleta</span> }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Email</th>
            <td mat-cell *matCellDef="let row">{{ row.email }}</td>
          </ng-container>

          <ng-container matColumnDef="telefono">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Teléfono</th>
            <td mat-cell *matCellDef="let row">{{ row.telefono }}</td>
          </ng-container>

          <ng-container matColumnDef="identificacion">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Identificación</th>
            <td mat-cell *matCellDef="let row">
              {{ row.tipoDeIdentificacion }} · {{ row.identificacion }}
            </td>
          </ng-container>

          <ng-container matColumnDef="direccion">
            <th mat-header-cell *matHeaderCellDef>Dirección</th>
            <td mat-cell *matCellDef="let row">{{ row.direccion || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="etiquetas">
            <th mat-header-cell *matHeaderCellDef>Etiquetas</th>
            <td mat-cell *matCellDef="let row">
              @if (row.etiquetas?.length) {
                <div class="client-tags">
                  @for (etiqueta of row.etiquetas; track etiqueta) {
                    <app-etiqueta-cliente-chip [valor]="etiqueta" [catalogo]="catalogoEtiquetas()" />
                  }
                </div>
              } @else { — }
            </td>
          </ng-container>

          <ng-container matColumnDef="creadoEn">
            <th mat-header-cell *matHeaderCellDef>Creado</th>
            <td mat-cell *matCellDef="let row">{{ row.creadoEn ? (row.creadoEn | date:'shortDate') : '—' }}</td>
          </ng-container>

          @for (campo of camposActivos(); track campo.idCampo) {
            <ng-container [matColumnDef]="customColumnId(campo.idCampo)">
              <th mat-header-cell *matHeaderCellDef>{{ campo.nombreMostrar }}</th>
              <td mat-cell *matCellDef="let row">
                <app-custom-field-value [field]="campo" [value]="row.camposPersonalizados?.[campo.idCampo]" />
              </td>
            </ng-container>
          }

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary" type="button" matTooltip="Modificar" (click)="modificarCliente(row)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" type="button" matTooltip="Eliminar" (click)="confirmarEliminar(row)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnasVisibles"></tr>
          <tr mat-row *matRowDef="let row; columns: columnasVisibles"></tr>
        </table>
      </app-data-table-frame>

      <mat-paginator
        [length]="totalEstimado()"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 25, 50]"
        [showFirstLastButtons]="false"
        (page)="cambiarPagina($event)"
      ></mat-paginator>
    </section>
  `,
  styles: [
    ` .clientes-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .toolbar { display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
    .toolbar h2 { margin: 0; font-size: 1.4rem; }
    .toolbar p { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 900px; }
    thead tr { background: var(--tc-surface-container-low); }
    td mat-icon { font-size: 1.1rem; }
    .client-tags { display: flex; min-width: 180px; max-width: 360px; gap: .35rem; flex-wrap: wrap; padding: .3rem 0; }
    .client-name { display: grid; gap: .3rem; justify-items: start; }
    .incomplete-badge { display: inline-flex; padding: .2rem .55rem; border-radius: 999px; background: var(--tc-warning-container); color: var(--tc-on-warning-container); font-size: .72rem; font-weight: 700; }
    @media (max-width: 900px) { .toolbar { align-items: start; flex-direction: column; } }
  `]
})
export class ListaClientesComponent implements OnInit, AfterViewInit {
  private readonly clientesService = inject(ClientesService);
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  @ViewChild(MatSort) protected sort!: MatSort;

  protected readonly dataSource = new MatTableDataSource<Cliente>([]);
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly catalogoEtiquetas = signal<EtiquetaClienteConfig[]>([]);
  protected readonly camposActivos = computed(() =>
    this.camposPersonalizados().filter((campo) => campo.activo !== false)
  );
  protected readonly columnasFijas = ['nombreCompleto', 'email', 'telefono', 'identificacion', 'direccion', 'etiquetas', 'creadoEn'];
  protected readonly columnDefinitions = computed<TableColumnDefinition[]>(() => [
    { id: 'nombreCompleto', label: 'Nombre completo' },
    { id: 'email', label: 'Email' },
    { id: 'telefono', label: 'Teléfono' },
    { id: 'identificacion', label: 'Identificación' },
    { id: 'direccion', label: 'Dirección', defaultVisible: false },
    { id: 'etiquetas', label: 'Etiquetas', defaultVisible: false },
    { id: 'creadoEn', label: 'Fecha de creación', defaultVisible: false },
    ...this.camposActivos().map((campo) => ({
      id: this.customColumnId(campo.idCampo),
      label: campo.nombreMostrar,
      group: 'custom' as const,
      defaultVisible: campo.visibleEnLista === true
    })),
    { id: 'acciones', label: 'Acciones', locked: true }
  ]);
  protected readonly cargando = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly hasMore = signal(false);
  protected readonly totalEstimado = signal(0);
  private readonly cursors = new Map<number, { value: string; key: string } | null>([[0, null]]);
  private ultimoClienteEnlace = '';

  ngOnInit(): void {
    void this.cargarPagina(0, this.pageSize());

    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((configuracion) => {
      this.camposPersonalizados.set(configuracion.camposPersonalizados ?? []);
      this.catalogoEtiquetas.set(configuracion.catalogoEtiquetas ?? []);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const clienteId = params.get('clienteId') ?? '';
      if (clienteId && clienteId !== this.ultimoClienteEnlace) {
        this.ultimoClienteEnlace = clienteId;
        void this.abrirClienteDesdeEnlace(clienteId);
      }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  protected get columnasVisibles(): string[] {
    return [
      ...this.columnasFijas,
      ...this.camposActivos().map((campo) => this.customColumnId(campo.idCampo)),
      'acciones'
    ];
  }

  protected customColumnId(idCampo: string): string {
    return `custom_${idCampo}`;
  }

  protected abrirFormularioCreacion(): void {
    const dialogRef = this.dialog.open(ClienteFormDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      data: {
        camposPersonalizados: this.camposPersonalizados(),
        modo: 'crear'
      } satisfies ClienteDialogData
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado?.cliente) {
        this.mostrarExito('Cliente creado correctamente.', 'person_add');
        void this.cargarPagina(0, this.pageSize());
      }
    });
  }

  protected modificarCliente(cliente: Cliente): void {
    const dialogRef = this.dialog.open(ClienteFormDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      data: {
        cliente,
        camposPersonalizados: this.camposPersonalizados(),
        modo: 'editar'
      } satisfies ClienteDialogData
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado?.cliente) {
        this.mostrarExito('Cliente actualizado correctamente.', 'edit');
        void this.cargarPagina(this.pageIndex(), this.pageSize());
      }
    });
  }

  protected confirmarEliminar(cliente: Cliente): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar cliente',
        message: `¿Deseas eliminar a ${cliente.nombreCompleto}? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado || !cliente.id) {
        return;
      }

      void this.clientesService.eliminarCliente(cliente.id).then(() => {
        this.mostrarExito('Cliente eliminado correctamente.', 'delete');
        void this.cargarPagina(this.pageIndex(), this.pageSize());
      });
    });
  }

  protected cambiarPagina(event: PageEvent): void {
    void this.cargarPagina(event.pageIndex, event.pageSize);
  }

  private async cargarPagina(pageIndex: number, pageSize: number): Promise<void> {
    if (!this.cursors.has(pageIndex)) return;
    this.cargando.set(true);
    try {
      if (pageSize !== this.pageSize()) {
        this.cursors.clear();
        this.cursors.set(0, null);
        pageIndex = 0;
      }
      const page = await this.clientesService.getClientesPage(pageSize, this.cursors.get(pageIndex) ?? null);
      this.dataSource.data = page.items;
      this.pageIndex.set(pageIndex);
      this.pageSize.set(pageSize);
      this.hasMore.set(page.hasMore);
      this.totalEstimado.set((pageIndex + 1) * pageSize + (page.hasMore ? 1 : 0));
      if (page.nextCursor) this.cursors.set(pageIndex + 1, page.nextCursor);
    } finally {
      this.cargando.set(false);
    }
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private async abrirClienteDesdeEnlace(clienteId: string): Promise<void> {
    const cliente = await firstValueFrom(this.clientesService.getClienteById(clienteId).pipe(take(1)));
    if (!cliente) {
      this.snackBar.open('El cliente vinculado ya no existe.', 'Cerrar', { duration: 3500 });
      return;
    }
    this.modificarCliente(cliente);
  }
}

import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Cliente, CampoPersonalizado, ClienteDialogData } from '../../../../shared/models/clientes.models';
import { ClientesService } from '../../../../core/services/clientes.service';
import { ConfiguracionClientesService } from '../../../../core/services/configuracion-clientes.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ClienteFormDialogComponent } from '../../../../shared/components/cliente-form-dialog/cliente-form-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

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
    MatSnackBarModule
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

      <div class="table-wrap">
        <table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="nombreCompleto">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre completo</th>
            <td mat-cell *matCellDef="let row">{{ row.nombreCompleto }}</td>
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
      </div>

      <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
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
    @media (max-width: 900px) { .toolbar { align-items: start; flex-direction: column; } }
  `]
})
export class ListaClientesComponent implements OnInit, AfterViewInit {
  private readonly clientesService = inject(ClientesService);
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) protected paginator!: MatPaginator;
  @ViewChild(MatSort) protected sort!: MatSort;

  protected readonly dataSource = new MatTableDataSource<Cliente>([]);
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly columnasFijas = ['nombreCompleto', 'email', 'telefono', 'identificacion'];

  ngOnInit(): void {
    this.clientesService.getClientes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((clientes) => {
      this.dataSource.data = clientes;
    });

    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((configuracion) => {
      this.camposPersonalizados.set(configuracion.camposPersonalizados ?? []);
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  protected get columnasVisibles(): string[] {
    return [...this.columnasFijas, 'acciones'];
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
      });
    });
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
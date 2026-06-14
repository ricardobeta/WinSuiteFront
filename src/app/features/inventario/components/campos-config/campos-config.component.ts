import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { EntidadCamposInventario } from '../../models/inventario.models';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { CampoFormDialogComponent } from './campo-form-dialog.component';

@Component({
  selector: 'app-campos-config',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <section class="campos-card surface-card">
      <div class="toolbar">
        <div>
          <p class="eyebrow">Inventario</p>
          <h3>Campos personalizados</h3>
          <p>Gestiona definiciones para productos y proveedores.</p>
        </div>
      </div>

      <mat-tab-group (selectedIndexChange)="cambiarEntidad($event)">
        <mat-tab label="Productos" />
        <mat-tab label="Proveedores" />
      </mat-tab-group>

      <div class="actions-row">
        <button mat-raised-button color="primary" type="button" (click)="agregarCampo()">
          <mat-icon>add</mat-icon>
          Nuevo campo
        </button>
      </div>

      <div class="table-wrap">
        <table mat-table [dataSource]="dataSource">
          <ng-container matColumnDef="nombreMostrar">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let row">{{ row.nombreMostrar }}</td>
          </ng-container>

          <ng-container matColumnDef="tipo">
            <th mat-header-cell *matHeaderCellDef>Tipo</th>
            <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
          </ng-container>

          <ng-container matColumnDef="requerido">
            <th mat-header-cell *matHeaderCellDef>Requerido</th>
            <td mat-cell *matCellDef="let row">{{ row.requerido ? 'Si' : 'No' }}</td>
          </ng-container>

          <ng-container matColumnDef="visibleEnLista">
            <th mat-header-cell *matHeaderCellDef>Visible en lista</th>
            <td mat-cell *matCellDef="let row">{{ row.visibleEnLista ? 'Si' : 'No' }}</td>
          </ng-container>

          <ng-container matColumnDef="opciones">
            <th mat-header-cell *matHeaderCellDef>Opciones</th>
            <td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">
              {{ formatearOpciones(row) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button type="button" matTooltip="Editar" (click)="editarCampo(row)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" type="button" matTooltip="Eliminar" (click)="eliminarCampo(row)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnasVisibles"></tr>
          <tr mat-row *matRowDef="let row; columns: columnasVisibles"></tr>
        </table>
      </div>

      <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons />
    </section>
  `,
  styles: [`
    .campos-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .toolbar h3 { margin: 0; font-size: 1.2rem; }
    .toolbar p { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .actions-row { display: flex; justify-content: flex-end; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 760px; }
    .options-cell { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `]
})
export class CamposConfigComponent implements OnInit {
  private readonly camposService = inject(CamposInventarioService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) protected paginator!: MatPaginator;

  protected readonly dataSource = new MatTableDataSource<CampoPersonalizado>([]);
  protected readonly columnasVisibles = ['nombreMostrar', 'tipo', 'requerido', 'visibleEnLista', 'opciones', 'acciones'];
  protected readonly entidadActiva = signal<EntidadCamposInventario>('producto');

  ngOnInit(): void {
    this.cargarCampos();
  }

  protected cambiarEntidad(index: number): void {
    const entidad: EntidadCamposInventario = index === 0 ? 'producto' : 'proveedor';
    if (entidad === this.entidadActiva()) {
      return;
    }

    this.entidadActiva.set(entidad);
    this.cargarCampos();
  }

  protected agregarCampo(): void {
    const dialogRef = this.dialog.open(CampoFormDialogComponent, {
      width: '760px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((campo: CampoPersonalizado | undefined) => {
      if (!campo) {
        return;
      }

      void this.camposService.guardarCampo(this.entidadActiva(), campo).then(() => {
        this.mostrarExito('Campo guardado correctamente.', 'playlist_add');
      });
    });
  }

  protected editarCampo(campo: CampoPersonalizado): void {
    const dialogRef = this.dialog.open(CampoFormDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      data: { campo }
    });

    dialogRef.afterClosed().subscribe((actualizado: CampoPersonalizado | undefined) => {
      if (!actualizado) {
        return;
      }

      // Asegura invariantes: idCampo y tipo no cambian en edicion.
      const campoInmutable: CampoPersonalizado = {
        ...actualizado,
        idCampo: campo.idCampo,
        tipo: campo.tipo
      };

      void this.camposService.guardarCampo(this.entidadActiva(), campoInmutable).then(() => {
        this.mostrarExito('Campo actualizado correctamente.', 'edit');
      });
    });
  }

  protected eliminarCampo(campo: CampoPersonalizado): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar campo',
        message: `¿Deseas eliminar el campo ${campo.nombreMostrar}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.camposService.eliminarCampo(this.entidadActiva(), campo.idCampo).then(() => {
        this.mostrarExito('Campo eliminado correctamente.', 'delete');
      });
    });
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' · ') ?? '-';
  }

  private cargarCampos(): void {
    this.camposService
      .getCampos(this.entidadActiva())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        this.dataSource.data = campos;
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
      });
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2400,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

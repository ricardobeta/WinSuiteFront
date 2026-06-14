import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CampoPersonalizado, ConfiguracionClientes } from '../../../../shared/models/clientes.models';
import { ConfiguracionClientesService } from '../../../../core/services/configuracion-clientes.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

@Component({
  selector: 'app-configuracion-clientes',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule, MatSnackBarModule],
  template: `
    <section class="clientes-card surface-card">
      <div class="toolbar">
        <div>
          <p class="eyebrow">Configuración</p>
          <h2>Campos personalizados</h2>
          <p>Define campos reutilizables para clientes y futuros módulos.</p>
        </div>

        <button mat-raised-button color="primary" type="button" (click)="agregarCampo()">
          <mat-icon>add</mat-icon>
          Agregar campo
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

          <ng-container matColumnDef="opciones">
            <th mat-header-cell *matHeaderCellDef>Opciones</th>
            <td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">
              {{ formatearOpciones(row) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="warn" type="button" matTooltip="Eliminar campo" (click)="eliminarCampo(row)">
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
    `.clientes-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .toolbar { display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
    .toolbar h2 { margin: 0; font-size: 1.4rem; }
    .toolbar p { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 720px; }
    .options-cell { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 900px) { .toolbar { align-items: start; flex-direction: column; } }
  `]
})
export class ConfiguracionClientesComponent implements OnInit, AfterViewInit {
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) protected paginator!: MatPaginator;

  protected readonly dataSource = new MatTableDataSource<CampoPersonalizado>([]);
  protected readonly configuracion = signal<ConfiguracionClientes>({ camposPersonalizados: [] });
  protected readonly columnasVisibles = ['nombreMostrar', 'tipo', 'opciones', 'acciones'];

  ngOnInit(): void {
    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((configuracion) => {
      this.configuracion.set(configuracion);
      this.dataSource.data = configuracion.camposPersonalizados ?? [];
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  protected agregarCampo(): void {
    const dialogRef = this.dialog.open(AgregarCampoDialogComponent, {
      width: '760px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((campo: CampoPersonalizado | undefined) => {
      if (!campo) {
        return;
      }

      void this.configuracionService.agregarCampo(campo).then(() => {
        this.mostrarExito('Campo personalizado agregado.', 'playlist_add');
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

      void this.configuracionService.eliminarCampo(campo.idCampo).then(() => {
        this.mostrarExito('Campo eliminado correctamente.', 'delete');
      });
    });
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' · ') ?? '-';
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
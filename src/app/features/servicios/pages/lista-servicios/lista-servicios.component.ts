import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ServiciosService } from '../../../../core/services/servicios.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { Servicio } from '../../../../shared/models/servicios.models';
import { CrearServicioComponent } from '../crear-servicio/crear-servicio.component';

@Component({
  selector: 'app-lista-servicios',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './lista-servicios.component.html',
  styleUrls: ['./lista-servicios.component.scss']
})
export class ListaServiciosComponent implements OnInit {
  private readonly serviciosService = inject(ServiciosService);
  protected readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dataSource = new MatTableDataSource<Servicio>([]);
  protected readonly serviciosCount = signal(0);
  protected readonly canCreate = computed(() => this.authorization.canAccess('servicios', 'create'));
  protected readonly canUpdate = computed(() => this.authorization.canAccess('servicios', 'update'));
  protected readonly canDelete = computed(() => this.authorization.canAccess('servicios', 'delete'));
  protected readonly hasActionPermission = computed(() => this.canUpdate() || this.canDelete());
  protected readonly displayedColumns = computed(() => {
    const baseColumns = ['nombre', 'descripcion', 'precio', 'impuestoPorcentaje', 'activo'];
    return this.hasActionPermission() ? [...baseColumns, 'acciones'] : baseColumns;
  });

  @ViewChild(MatPaginator, { static: true }) private paginator!: MatPaginator;
  @ViewChild(MatSort, { static: true }) private sort!: MatSort;

  ngOnInit(): void {
    this.serviciosService
      .getServicios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((servicios) => {
        queueMicrotask(() => {
          this.dataSource.data = servicios;
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
          this.serviciosCount.set(servicios.length);
        });
      });
  }

  protected crearNuevo(): void {
    this.dialog.open(CrearServicioComponent, {
      width: '760px',
      maxWidth: '95vw',
      disableClose: true
    });
  }

  protected editar(id: string): void {
    this.dialog.open(CrearServicioComponent, {
      width: '760px',
      maxWidth: '95vw',
      disableClose: true,
      data: { servicioId: id }
    });
  }

  protected async eliminar(id: string): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data: {
        title: 'Eliminar servicio',
        message: '¿Está seguro de que desea eliminar este servicio?',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    });

    const confirmado = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmado) {
      return;
    }

    try {
      await this.serviciosService.eliminarServicio(id);
    } catch (error) {
      console.error('Error eliminando servicio:', error);
    }
  }

}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { Proveedor } from '../../models/inventario.models';
import { ProveedoresService } from '../../services/proveedores.service';

@Component({
  selector: 'app-proveedores-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatTableModule, DataTableFrameComponent],
  template: `
    <section class="surface-card page-card">
      <div class="header">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Proveedores</h2>
          <p>Lista de proveedores con acciones de crear y editar.</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workspace/inventario/proveedores/new">Nuevo proveedor</a>
      </div>

      <app-data-table-frame
        searchPlaceholder="Buscar proveedor"
        [total]="proveedoresFiltrados().length"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        (searchChange)="actualizarBusqueda($event)"
        (pageChange)="actualizarPagina($event)"
      >
        <table mat-table [dataSource]="proveedoresPaginados()">
          <ng-container matColumnDef="codigo">
            <th mat-header-cell *matHeaderCellDef>Codigo</th>
            <td mat-cell *matCellDef="let row">{{ row.codigo }}</td>
          </ng-container>

          <ng-container matColumnDef="nombre">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let row">{{ row.email || '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="telefono">
            <th mat-header-cell *matHeaderCellDef>Telefono</th>
            <td mat-cell *matCellDef="let row">{{ row.telefono || '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">{{ row.activo ? 'Activo' : 'Inactivo' }}</td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <a mat-button [routerLink]="['/workspace/inventario/proveedores', row.id, 'editar']">Editar</a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnas"></tr>
          <tr mat-row *matRowDef="let row; columns: columnas"></tr>
        </table>
      </app-data-table-frame>
    </section>
  `,
  styles: [`
    .page-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); display: grid; gap: 1rem; }
    .header { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
    .header h2 { margin: 0; }
    .header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 840px; }
    @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
  `]
})
export class ProveedoresListComponent implements OnInit {
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly proveedoresFiltrados = computed(() => {
    const query = this.normalizar(this.busqueda());
    if (!query) return this.proveedores();
    return this.proveedores().filter((proveedor) =>
      this.normalizar(`${proveedor.codigo} ${proveedor.nombre} ${proveedor.email ?? ''} ${proveedor.telefono ?? ''}`).includes(query)
    );
  });
  protected readonly proveedoresPaginados = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.proveedoresFiltrados().slice(start, start + this.pageSize());
  });
  protected readonly columnas = ['codigo', 'nombre', 'email', 'telefono', 'estado', 'acciones'];

  ngOnInit(): void {
    this.proveedoresService
      .getProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((proveedores) => {
        this.proveedores.set(proveedores);
      });
  }

  protected actualizarBusqueda(value: string): void {
    this.busqueda.set(value);
    this.pageIndex.set(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  private normalizar(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}

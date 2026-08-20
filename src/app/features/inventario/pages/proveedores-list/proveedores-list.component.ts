import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { CustomFieldValueComponent } from '../../../../shared/components/custom-field-value/custom-field-value.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { TableColumnDefinition } from '../../../../shared/models/table-preferences.models';
import { Proveedor } from '../../models/inventario.models';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { ProveedoresService } from '../../services/proveedores.service';

@Component({
  selector: 'app-proveedores-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatTableModule, DataTableFrameComponent, CustomFieldValueComponent],
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
        tableModule="inventario"
        tableId="proveedores"
        [columns]="columnDefinitions()"
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

          <ng-container matColumnDef="ruc">
            <th mat-header-cell *matHeaderCellDef>RUC</th>
            <td mat-cell *matCellDef="let row">{{ row.ruc || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="contacto">
            <th mat-header-cell *matHeaderCellDef>Contacto</th>
            <td mat-cell *matCellDef="let row">{{ row.nombreContacto || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="direccion">
            <th mat-header-cell *matHeaderCellDef>Dirección</th>
            <td mat-cell *matCellDef="let row">{{ row.direccion || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="credito">
            <th mat-header-cell *matHeaderCellDef>Crédito</th>
            <td mat-cell *matCellDef="let row">{{ row.diasCredito }} días · {{ row.moneda }}</td>
          </ng-container>

          @for (campo of camposDisponibles(); track campo.idCampo) {
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
              <a mat-button [routerLink]="['/workspace/inventario/proveedores', row.id, 'editar']">Editar</a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnas()"></tr>
          <tr mat-row *matRowDef="let row; columns: columnas()"></tr>
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
    @media (max-width: 600px) {
      .page-card { padding: .85rem; }
      .header > a { width: 100%; justify-content: center; }
    }
  `]
})
export class ProveedoresListComponent implements OnInit {
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly camposService = inject(CamposInventarioService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly camposDisponibles = signal<CampoPersonalizado[]>([]);
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
  protected readonly columnas = computed(() => [
    'codigo',
    'nombre',
    'email',
    'telefono',
    'ruc',
    'contacto',
    'direccion',
    'credito',
    'estado',
    ...this.camposDisponibles().map((campo) => this.customColumnId(campo.idCampo)),
    'acciones'
  ]);
  protected readonly columnDefinitions = computed<TableColumnDefinition[]>(() => [
    { id: 'codigo', label: 'Código' },
    { id: 'nombre', label: 'Nombre' },
    { id: 'email', label: 'Email' },
    { id: 'telefono', label: 'Teléfono' },
    { id: 'ruc', label: 'RUC', defaultVisible: false },
    { id: 'contacto', label: 'Persona de contacto', defaultVisible: false },
    { id: 'direccion', label: 'Dirección', defaultVisible: false },
    { id: 'credito', label: 'Crédito y moneda', defaultVisible: false },
    { id: 'estado', label: 'Estado' },
    ...this.camposDisponibles().map((campo) => ({
      id: this.customColumnId(campo.idCampo),
      label: campo.nombreMostrar,
      group: 'custom' as const,
      defaultVisible: campo.visibleEnLista === true
    })),
    { id: 'acciones', label: 'Acciones', locked: true }
  ]);

  ngOnInit(): void {
    this.proveedoresService
      .getProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((proveedores) => {
        this.proveedores.set(proveedores);
      });
    this.camposService
      .getCampos('proveedor')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => this.camposDisponibles.set(campos.filter((campo) => campo.activo !== false)));
  }

  protected customColumnId(idCampo: string): string {
    return `custom_${idCampo}`;
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

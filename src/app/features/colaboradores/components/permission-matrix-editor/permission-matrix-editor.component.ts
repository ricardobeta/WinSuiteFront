import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';

import { RolePermission } from '../../../../core/models/rbac.models';

export interface PermissionMatrixModel {
  [moduleKey: string]: RolePermission;
}

/**
 * Componente reutilizable para editar una matriz de permisos.
 * Muestra módulos en filas y acciones (create, read, update, delete) en columnas,
 * con checkboxes para seleccionar/deseleccionar permisos.
 */
@Component({
  selector: 'app-permission-matrix-editor',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatTableModule],
  template: `
    <div class="matrix-container">
      <table class="permission-matrix">
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Crear</th>
            <th>Leer</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          @for (moduleKey of modules; track moduleKey) {
            <tr>
              <td class="module-name">{{ moduleLabel(moduleKey) }}</td>
              <td class="permission-cell">
                <mat-checkbox
                  [checked]="getPermission(moduleKey)?.canCreate ?? false"
                  (change)="updatePermission(moduleKey, 'canCreate', $event.checked)"
                  aria-label="Crear {{ moduleKey }}"
                />
              </td>
              <td class="permission-cell">
                <mat-checkbox
                  [checked]="getPermission(moduleKey)?.canRead ?? false"
                  (change)="updatePermission(moduleKey, 'canRead', $event.checked)"
                  aria-label="Leer {{ moduleKey }}"
                />
              </td>
              <td class="permission-cell">
                <mat-checkbox
                  [checked]="getPermission(moduleKey)?.canUpdate ?? false"
                  (change)="updatePermission(moduleKey, 'canUpdate', $event.checked)"
                  aria-label="Editar {{ moduleKey }}"
                />
              </td>
              <td class="permission-cell">
                <mat-checkbox
                  [checked]="getPermission(moduleKey)?.canDelete ?? false"
                  (change)="updatePermission(moduleKey, 'canDelete', $event.checked)"
                  aria-label="Eliminar {{ moduleKey }}"
                />
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .matrix-container {
        overflow-x: auto;
      }

      .permission-matrix {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid rgb(148 163 184 / 18%);
        border-radius: 0.5rem;
        overflow: hidden;
      }

      thead {
        background-color: rgb(15 23 42 / 5%);
      }

      th {
        padding: 0.75rem 1rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid rgb(148 163 184 / 18%);
      }

      td {
        padding: 1rem;
        border-bottom: 1px solid rgb(148 163 184 / 12%);
      }

      tr:last-child td {
        border-bottom: none;
      }

      .module-name {
        font-weight: 500;
        min-width: 150px;
      }

      .permission-cell {
        text-align: center;
        width: 80px;
      }

      @media (max-width: 768px) {
        th,
        td {
          padding: 0.5rem;
        }

        th {
          font-size: 0.75rem;
        }

        .module-name {
          min-width: 100px;
        }

        .permission-cell {
          width: 60px;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionMatrixEditorComponent implements OnInit {
  @Input() permissions: PermissionMatrixModel = {};
  @Input() modules: string[] = ['clientes', 'facturacion', 'inventario', 'contabilidad', 'ventas', 'servicios', 'archivos', 'empresa_calendario', 'empresa_colaboradores', 'empresa_roles'];

  @Output() permissionsChanged = new EventEmitter<PermissionMatrixModel>();

  ngOnInit(): void {
    this.initializePermissions();
  }

  /**
   * Inicializa la matriz de permisos asegurando que todos los módulos estén presentes
   */
  private initializePermissions(): void {
    const initialized: PermissionMatrixModel = { ...this.permissions };

    for (const moduleKey of this.modules) {
      if (!initialized[moduleKey]) {
        initialized[moduleKey] = {
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false
        };
      }
    }

    this.permissions = initialized;
  }

  /**
   * Obtiene los permisos para un módulo específico
   */
  getPermission(moduleKey: string): RolePermission | undefined {
    return this.permissions[moduleKey];
  }

  moduleLabel(moduleKey: string): string {
    return ({
      clientes: 'Clientes', facturacion: 'Facturacion', inventario: 'Inventario', contabilidad: 'Contabilidad',
      ventas: 'Ventas', servicios: 'Servicios', archivos: 'Archivos', empresa_calendario: 'Calendario y eventos',
      empresa_colaboradores: 'Colaboradores', empresa_roles: 'Roles y permisos'
    } as Record<string, string>)[moduleKey] ?? moduleKey;
  }

  /**
   * Actualiza un permiso específico y emite el cambio
   */
  updatePermission(moduleKey: string, action: keyof RolePermission, value: boolean): void {
    const updated = {
      ...this.permissions,
      [moduleKey]: {
        ...this.permissions[moduleKey],
        [action]: value
      }
    };

    this.permissions = updated;
    this.permissionsChanged.emit(updated);
  }
}

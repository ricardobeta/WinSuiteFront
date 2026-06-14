import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TenantRoleDefinition } from '../../../../core/models/auth.models';
import { ColaboradoresService } from '../../services/colaboradores.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-roles-colaboradores',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  template: `
    <section class="roles-container">
      <div class="roles-header">
        <h1>Gestión de Roles</h1>
        <button mat-raised-button color="primary" (click)="onCreateRole()">
          <mat-icon>add</mat-icon>
          Crear Nuevo Rol
        </button>
      </div>

      @if (roles().length > 0) {
        <div class="roles-grid">
          @for (role of roles(); track role.id) {
            <article class="surface-card role-card">
              <div class="card-header">
                <div class="role-info">
                  <p class="eyebrow">Rol</p>
                  <h2>{{ role.name }}</h2>
                </div>

                @if (!role.system) {
                  <div class="card-actions">
                    <button
                      mat-icon-button
                      [matMenuTriggerFor]="menu"
                      aria-label="Opciones del rol"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>

                    <mat-menu #menu="matMenu">
                      <button
                        mat-menu-item
                        (click)="onEditRole(role)"
                        [disabled]="isDeleting()"
                      >
                        <mat-icon>edit</mat-icon>
                        <span>Editar</span>
                      </button>
                      <button
                        mat-menu-item
                        (click)="onDeleteRole(role)"
                        [disabled]="isDeleting()"
                        class="delete-action"
                      >
                        <mat-icon>delete</mat-icon>
                        <span>Eliminar</span>
                      </button>
                    </mat-menu>
                  </div>
                } @else {
                  <mat-chip disabled class="system-badge">
                    <mat-icon>lock</mat-icon>
                    Sistema
                  </mat-chip>
                }
              </div>

              <p class="description">
                {{ role.description || 'Sin descripción registrada.' }}
              </p>

              <div class="permissions">
                @for (permission of permissionEntries(role); track permission.moduleKey) {
                  <div class="permission-row">
                    <strong>{{ permission.moduleKey }}</strong>
                    <span class="actions-summary">
                      {{ permission.summary }}
                    </span>
                  </div>
                }
              </div>
            </article>
          }
        </div>
      } @else {
        <article class="surface-card empty-state">
          <p class="eyebrow">Roles</p>
          <h2>No hay roles personalizados</h2>
          <p>Crea tu primer rol personalizado para configurar permisos específicos.</p>
          <button mat-raised-button color="primary" (click)="onCreateRole()">
            <mat-icon>add</mat-icon>
            Crear Primer Rol
          </button>
        </article>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .roles-grid {
        display: grid;
        gap: 1rem;
      }
      .role-card,
      .empty-card {
        padding: 1.25rem;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: var(--primary);
      }
      h2 {
        margin: 0;
        font-size: 1.2rem;
      }
      .description {
        margin: 0.5rem 0 0;
        color: var(--muted-foreground);
      }
      .permissions {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .permission-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid rgb(148 163 184 / 18%);
      }
      .permission-row span {
        color: var(--muted-foreground);
      }

      .permission-row .actions-summary {
        text-align: right;
      }

      .roles-container {
        padding: 1.5rem;
      }

      .roles-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        gap: 1rem;
      }

      .roles-header h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .roles-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      }

      .role-card {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .role-info {
        flex: 1;
        min-width: 0;
      }

      .card-actions {
        flex-shrink: 0;
      }

      .system-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .delete-action {
        color: var(--destructive);
      }

      .empty-state {
        padding: 3rem 2rem;
        text-align: center;
      }

      .empty-state h2 {
        margin: 0.5rem 0 0;
      }

      .empty-state button {
        margin-top: 1rem;
      }

      @media (max-width: 900px) {
        .roles-grid {
          grid-template-columns: 1fr;
        }

        .roles-header {
          flex-direction: column;
          align-items: stretch;
        }

        .roles-header button {
          width: 100%;
        }

        .permission-row {
          flex-direction: column;
        }

        .permission-row .actions-summary {
          text-align: left;
        }
      }
    `
  ]
})
export class RolesColaboradoresComponent implements OnInit {
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles = signal<TenantRoleDefinition[]>([]);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadRoles();
  }

  /**
   * Carga los roles disponibles
   */
  private loadRoles(): void {
    this.colaboradoresService
      .getRoles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.roles.set(roles);
        },
        error: (err) => {
          console.error('Error loading roles:', err);
          this.snackBar.open('Error al cargar los roles', 'Cerrar', { duration: 3000 });
        }
      });
  }

  /**
   * Navega a la página de creación de rol
   */
  onCreateRole(): void {
    this.router.navigate(['nuevo'], { relativeTo: this.route });
  }

  /**
   * Navega a la página de edición de rol
   */
  onEditRole(role: TenantRoleDefinition): void {
    this.router.navigate([role.id, 'editar'], { relativeTo: this.route });
  }

  /**
   * Abre diálogo de confirmación para eliminar rol
   */
  onDeleteRole(role: TenantRoleDefinition): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar Rol',
        message: `¿Estás seguro de que deseas eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        isDangerous: true
      }
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteRole(role);
        }
      });
  }

  /**
   * Elimina el rol seleccionado
   */
  private deleteRole(role: TenantRoleDefinition): void {
    this.isDeleting.set(true);

    this.colaboradoresService
      .deleteRole(role.id!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Rol eliminado exitosamente', 'Cerrar', { duration: 3000 });
          this.isDeleting.set(false);
          this.loadRoles();
        },
        error: (err) => {
          console.error('Error deleting role:', err);
          this.snackBar.open('Error al eliminar el rol', 'Cerrar', { duration: 3000 });
          this.isDeleting.set(false);
        }
      });
  }

  protected permissionEntries(role: TenantRoleDefinition): { moduleKey: string; summary: string }[] {
    return Object.entries(role.permissions ?? {}).map(([moduleKey, permission]) => {
      const actions = [
        permission.canCreate ? 'crear' : null,
        permission.canRead ? 'leer' : null,
        permission.canUpdate ? 'editar' : null,
        permission.canDelete ? 'eliminar' : null
      ].filter(Boolean);

      return {
        moduleKey,
        summary: actions.length ? actions.join(', ') : 'Sin permisos'
      };
    });
  }
}

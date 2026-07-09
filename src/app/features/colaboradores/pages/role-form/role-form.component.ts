import { CommonModule } from '@angular/common';
import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TenantRoleDefinition } from '../../../../core/models/auth.models';
import { PermissionMatrixModel, PermissionMatrixEditorComponent } from '../../components/permission-matrix-editor/permission-matrix-editor.component';
import { ColaboradoresService } from '../../services/colaboradores.service';
import { first } from 'rxjs';

/**
 * Componente para crear y editar roles con configuración de permisos.
 * Se puede acceder en modo crear o editar según la ruta.
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PermissionMatrixEditorComponent
  ],
  template: `
    <section class="surface-card role-form-container">
      <div class="header">
        <div>
          <p class="eyebrow">{{ isEditMode ? 'Editar' : 'Crear' }} Rol</p>
          <h1>{{ isEditMode ? 'Editar rol y permisos' : 'Nuevo rol' }}</h1>
        </div>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Cargando información del rol...</p>
        </div>
      } @else {
        <form [formGroup]="roleForm" (ngSubmit)="onSubmit()" class="form-content">
          <div class="form-section">
            <h2>Información del Rol</h2>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre del Rol</mat-label>
              <input
                matInput
                formControlName="name"
                placeholder="Ej: Gerente de Ventas"
                required
              />
              @if (roleForm.get('name')?.hasError('required') && roleForm.get('name')?.touched) {
                <mat-error>El nombre es requerido</mat-error>
              }
              @if (roleForm.get('name')?.hasError('minlength') && roleForm.get('name')?.touched) {
                <mat-error>El nombre debe tener al menos 3 caracteres</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Descripción</mat-label>
              <textarea
                matInput
                formControlName="description"
                placeholder="Descripción del rol y sus responsabilidades"
                rows="4"
              ></textarea>
              @if (roleForm.get('description')?.hasError('maxlength') && roleForm.get('description')?.touched) {
                <mat-error>La descripción no puede exceder 500 caracteres</mat-error>
              }
            </mat-form-field>
          </div>

          <div class="form-section">
            <h2>Configurar Permisos</h2>
            <p class="section-description">
              Selecciona qué acciones puede realizar este rol en cada módulo
            </p>
            <app-permission-matrix-editor
              [permissions]="currentPermissions()"
              (permissionsChanged)="onPermissionsChanged($event)"
            />
          </div>

          <div class="form-actions">
            <button
              type="button"
              mat-stroked-button
              (click)="onCancel()"
              [disabled]="isSaving()"
            >
              Cancelar
            </button>
            <button
              type="submit"
              mat-raised-button
              color="primary"
              [disabled]="!roleForm.valid || isSaving()"
            >
              @if (isSaving()) {
                <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                Guardando...
              } @else {
                {{ isEditMode ? 'Actualizar Rol' : 'Crear Rol' }}
              }
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .role-form-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
      }

      .header {
        margin-bottom: 2rem;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: var(--primary);
      }

      h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 3rem 1rem;
      }

      .form-content {
        display: grid;
        gap: 2rem;
      }

      .form-section {
        display: grid;
        gap: 1rem;
      }

      .form-section h2 {
        font-size: 1.1rem;
        margin: 0;
        font-weight: 600;
      }

      .section-description {
        margin: 0;
        color: var(--muted-foreground);
        font-size: 0.875rem;
      }

      .full-width {
        width: 100%;
      }

      ::ng-deep .mat-mdc-form-field {
        width: 100%;
      }

      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 1px solid rgb(148 163 184 / 18%);
      }

      button {
        min-width: 120px;
      }

      .spinner-inline {
        display: inline-block;
        margin-right: 0.5rem;
        vertical-align: middle;
      }

      @media (max-width: 768px) {
        .role-form-container {
          padding: 1rem;
        }

        .form-actions {
          flex-direction: column-reverse;
        }

        button {
          width: 100%;
        }
      }
    `
  ]
})
export class RoleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  roleForm!: FormGroup;
  isEditMode = false;
  isLoading = signal(false);
  isSaving = signal(false);
  currentPermissions = signal<PermissionMatrixModel>(this.getDefaultPermissions());

  private roleId: string | null = null;

  private getDefaultPermissions(): PermissionMatrixModel {
    return {
      clientes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      facturacion: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      inventario: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      contabilidad: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      ventas: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      servicios: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      archivos: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      colaboradores: { canCreate: false, canRead: false, canUpdate: false, canDelete: false }
    };
  }

  private normalizePermissions(permissions?: PermissionMatrixModel): PermissionMatrixModel {
    return {
      ...this.getDefaultPermissions(),
      ...(permissions ?? {})
    };
  }

  ngOnInit(): void {
    this.initializeForm();
    this.checkEditMode();
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]]
    });
  }

  /**
   * Verifica si estamos en modo edición y carga los datos del rol
   */
  private checkEditMode(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.roleId = params.get('id');

      if (this.roleId && this.roleId !== 'nuevo') {
        this.isEditMode = true;
        this.loadRoleData();
      }
    });
  }

  /**
   * Carga los datos del rol existente
   */
  private loadRoleData(): void {
    if (!this.roleId) return;

    this.isLoading.set(true);

    this.colaboradoresService
      .getRoles()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        first()
      )
      .subscribe({
        next: (roles) => {
          const role = roles.find((r) => r.id === this.roleId);

          if (role) {
            this.roleForm.patchValue({
              name: role.name,
              description: role.description
            });

            this.currentPermissions.set(this.normalizePermissions(role.permissions));
          } else {
            this.snackBar.open('Rol no encontrado', 'Cerrar', { duration: 3000 });
            this.router.navigate(['../../'], { relativeTo: this.route });
          }

          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading role:', err);
          this.snackBar.open('Error al cargar el rol', 'Cerrar', { duration: 3000 });
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Maneja cambios en la matriz de permisos
   */
  onPermissionsChanged(permissions: PermissionMatrixModel): void {
    this.currentPermissions.set(permissions);
  }

  /**
   * Envía el formulario (crear o actualizar rol)
   */
  onSubmit(): void {
    if (!this.roleForm.valid) {
      return;
    }

    this.isSaving.set(true);

    const roleData: TenantRoleDefinition = {
      id: this.roleId || this.generateRoleId(),
      name: this.roleForm.get('name')?.value,
      description: this.roleForm.get('description')?.value || '',
      permissions: this.currentPermissions(),
      system: false,
      updatedAt: Date.now()
    };

    this.colaboradoresService
      .saveRole(roleData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedRole) => {
          this.snackBar.open(
            `Rol ${this.isEditMode ? 'actualizado' : 'creado'} exitosamente`,
            'Cerrar',
            { duration: 3000 }
          );

          this.isSaving.set(false);
          this.router.navigate(['../../roles'], { relativeTo: this.route });
        },
        error: (err) => {
          console.error('Error saving role:', err);
          this.snackBar.open(
            `Error al ${this.isEditMode ? 'actualizar' : 'crear'} el rol`,
            'Cerrar',
            { duration: 3000 }
          );
          this.isSaving.set(false);
        }
      });
  }

  /**
   * Cancela la edición/creación y vuelve a la lista de roles
   */
  onCancel(): void {
    this.router.navigate(['../../roles'], { relativeTo: this.route });
  }

  /**
   * Genera un ID único para un nuevo rol
   */
  private generateRoleId(): string {
    return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

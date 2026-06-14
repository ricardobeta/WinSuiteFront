import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AppUserProfile } from '../../../../core/models/auth.models';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ColaboradoresService } from '../../services/colaboradores.service';

@Component({
  selector: 'app-colaborador-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <section class="surface-card form-card">
      <div>
        <p class="eyebrow">Colaboradores</p>
        <h2>{{ isEditMode() ? 'Editar colaborador' : 'Crear colaborador' }}</h2>
        <p>Define acceso y datos del usuario tenant.</p>
      </div>

      <form [formGroup]="form" class="form-grid" (ngSubmit)="guardar()">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="fullName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            @for (role of roles(); track role.id) {
              <mat-option [value]="role.id">{{ role.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!isEditMode()) {
          <mat-form-field appearance="outline">
            <mat-label>Contraseña temporal</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>
        }

        @if (isEditMode()) {
          <mat-slide-toggle formControlName="active">Usuario activo</mat-slide-toggle>
        }

        <div class="actions-row">
          <a mat-button routerLink="/workspace/colaboradores/lista">Cancelar</a>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || !authorization.canAccess('colaboradores', isEditMode() ? 'update' : 'create')"
          >
            {{ isEditMode() ? 'Guardar cambios' : 'Crear colaborador' }}
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      .form-card {
        padding: 1.25rem;
        display: grid;
        gap: 1rem;
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
        font-size: 1.35rem;
      }
      p {
        margin: 0.25rem 0 0;
        color: var(--muted-foreground);
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }
      mat-form-field,
      mat-slide-toggle,
      .actions-row {
        grid-column: 1 / -1;
      }
      .actions-row {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      @media (max-width: 900px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
        .actions-row {
          justify-content: flex-start;
        }
      }
    `
  ]
})
export class ColaboradorFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly authorization = inject(AuthorizationService);

  protected readonly roles = signal<{ id: string; name: string }[]>([]);
  private readonly currentUser = signal<AppUserProfile | null>(null);
  protected readonly isEditMode = computed(() => !!this.route.snapshot.paramMap.get('id'));

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['ADMIN', [Validators.required]],
    password: [''],
    active: [true]
  });

  ngOnInit(): void {
    this.colaboradoresService
      .getRoles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((roles) => {
        this.roles.set(roles.map((role) => ({ id: role.id, name: role.name })));
      });

    if (!this.isEditMode()) {
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(6)]);
      this.form.controls.password.updateValueAndValidity();
      return;
    }

    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId) {
      return;
    }

    this.colaboradoresService
      .getColaboradores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        const user = users.find((item) => item.userId === userId);
        if (!user) {
          return;
        }

        this.currentUser.set(user);
        this.form.patchValue({
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          active: !!user.active
        });
      });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();

    if (!this.isEditMode()) {
      this.colaboradoresService
        .createColaborador({
          fullName: value.fullName,
          email: value.email,
          password: value.password,
          role: value.role
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.onSaved('Colaborador creado correctamente.'));
      return;
    }

    const current = this.currentUser();
    if (!current?.userId) {
      return;
    }

    this.colaboradoresService
      .updateColaborador(current.userId, {
        fullName: value.fullName,
        email: value.email,
        role: value.role,
        active: !!value.active
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onSaved('Colaborador actualizado correctamente.'));
  }

  private onSaved(message: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon: 'check_circle' },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
    void this.router.navigate(['/workspace/colaboradores/lista']);
  }
}

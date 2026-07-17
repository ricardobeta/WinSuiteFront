import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AppUserProfile } from '../../../../core/models/auth.models';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ColaboradoresService } from '../../services/colaboradores.service';

type EmailStatus = 'idle' | 'checking' | 'existing' | 'new' | 'member' | 'error';

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
    MatIconModule,
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
        <p>Define los datos del colaborador y su acceso dentro de la empresa.</p>
      </div>

      <form [formGroup]="form" class="form-grid" (ngSubmit)="guardar()">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="fullName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Correo electrónico</mat-label>
          <input matInput type="email" formControlName="email" (blur)="checkEmail()" />
          @if (form.controls.email.hasError('email') && form.controls.email.touched) {
            <mat-error>Ingresa un correo válido.</mat-error>
          }
        </mat-form-field>

        @if (!isEditMode() && emailStatus() !== 'idle') {
          <div
            class="email-status"
            [class.success]="emailStatus() === 'existing' || emailStatus() === 'new'"
            [class.warning]="emailStatus() === 'member'"
            [class.error]="emailStatus() === 'error'"
            role="status"
          >
            <mat-icon>{{ emailStatusIcon() }}</mat-icon>
            <div>
              <strong>{{ emailStatusTitle() }}</strong>
              <span>{{ emailStatusMessage() }}</span>
            </div>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            @for (role of roles(); track role.id) {
              <mat-option [value]="role.id">{{ role.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!isEditMode() && emailStatus() === 'new') {
          <mat-form-field appearance="outline">
            <mat-label>Contraseña temporal</mat-label>
            <input matInput type="password" autocomplete="new-password" formControlName="password" />
            <mat-hint>La persona usará esta contraseña en su primer inicio de sesión.</mat-hint>
            @if (form.controls.password.hasError('minlength') && form.controls.password.touched) {
              <mat-error>Debe tener al menos 6 caracteres.</mat-error>
            }
          </mat-form-field>
        }

        @if (isEditMode()) {
          <mat-slide-toggle formControlName="active">Usuario activo</mat-slide-toggle>
        }

        <div class="actions-row">
          <a mat-button routerLink="/workspace/empresa/colaboradores">Cancelar</a>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || !canSubmit() || !authorization.canAccess('empresa_colaboradores', isEditMode() ? 'update' : 'create')"
          >
            {{ submitLabel() }}
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .form-card { padding: 1.25rem; display: grid; gap: 1rem; }
    .eyebrow { margin: 0 0 0.35rem; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.75rem; color: var(--primary); }
    h2 { margin: 0; font-size: 1.35rem; }
    p { margin: 0.25rem 0 0; color: var(--muted-foreground); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    mat-form-field, mat-slide-toggle, .email-status, .actions-row { grid-column: 1 / -1; }
    .email-status {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--tc-ghost-border);
      border-radius: var(--radius-md);
      background: var(--tc-surface-container-low);
    }
    .email-status mat-icon { flex: 0 0 auto; color: var(--primary); }
    .email-status > div { display: grid; gap: 0.15rem; }
    .email-status span { color: var(--muted-foreground); font-size: 0.86rem; line-height: 1.4; }
    .email-status.warning mat-icon, .email-status.error mat-icon { color: var(--destructive); }
    .actions-row { display: flex; justify-content: flex-end; gap: 0.75rem; }
    @media (max-width: 900px) {
      .form-grid { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
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
  protected readonly emailStatus = signal<EmailStatus>('idle');
  protected readonly isEditMode = computed(() => !!this.route.snapshot.paramMap.get('id'));
  private readonly currentUser = signal<AppUserProfile | null>(null);
  private lastCheckedEmail = '';

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['ADMIN', [Validators.required]],
    password: [''],
    active: [true]
  });

  ngOnInit(): void {
    this.colaboradoresService.getRoles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(roles => this.roles.set(roles.map(role => ({ id: role.id, name: role.name }))));

    this.form.controls.email.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (this.normalizeEmail(value) === this.lastCheckedEmail) return;
        this.emailStatus.set('idle');
        this.configureTemporaryPassword(false);
      });

    if (!this.isEditMode()) return;

    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId) return;
    this.colaboradoresService.getColaboradores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(users => {
        const user = users.find(item => item.userId === userId);
        if (!user) return;
        this.currentUser.set(user);
        this.form.patchValue({
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          active: !!user.active
        });
      });
  }

  protected checkEmail(): void {
    if (this.isEditMode()) return;
    const control = this.form.controls.email;
    control.markAsTouched();
    if (control.invalid) {
      this.emailStatus.set('idle');
      return;
    }

    const email = this.normalizeEmail(control.value);
    if (email === this.lastCheckedEmail && ['existing', 'new', 'member'].includes(this.emailStatus())) return;
    this.lastCheckedEmail = email;
    this.emailStatus.set('checking');
    this.configureTemporaryPassword(false);

    this.colaboradoresService.checkEmail(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: status => {
          if (status.alreadyMember) {
            this.emailStatus.set('member');
            return;
          }
          this.emailStatus.set(status.exists ? 'existing' : 'new');
          this.configureTemporaryPassword(!status.exists);
        },
        error: () => this.emailStatus.set('error')
      });
  }

  protected canSubmit(): boolean {
    return this.isEditMode() || this.emailStatus() === 'existing' || this.emailStatus() === 'new';
  }

  protected submitLabel(): string {
    if (this.isEditMode()) return 'Guardar cambios';
    return this.emailStatus() === 'existing' ? 'Enviar invitación' : 'Crear colaborador';
  }

  protected emailStatusIcon(): string {
    switch (this.emailStatus()) {
      case 'checking': return 'hourglass_top';
      case 'existing': return 'mark_email_unread';
      case 'new': return 'person_add';
      case 'member': return 'group';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  protected emailStatusTitle(): string {
    switch (this.emailStatus()) {
      case 'checking': return 'Verificando correo…';
      case 'existing': return 'Esta persona ya tiene una cuenta WinSuite';
      case 'new': return 'Se creará una cuenta nueva';
      case 'member': return 'Esta persona ya pertenece a la empresa';
      case 'error': return 'No se pudo verificar el correo';
      default: return '';
    }
  }

  protected emailStatusMessage(): string {
    switch (this.emailStatus()) {
      case 'checking': return 'Estamos comprobando cómo debe continuar el registro.';
      case 'existing': return 'Le enviaremos una invitación para que decida si desea unirse a esta empresa.';
      case 'new': return 'Define una contraseña temporal para completar su acceso inmediatamente.';
      case 'member': return 'No es necesario enviar otra invitación.';
      case 'error': return 'Intenta nuevamente antes de guardar.';
      default: return '';
    }
  }

  protected guardar(): void {
    if (this.form.invalid || !this.canSubmit()) return;
    const value = this.form.getRawValue();

    if (!this.isEditMode()) {
      this.colaboradoresService.createColaborador({
        fullName: value.fullName,
        email: value.email,
        password: this.emailStatus() === 'new' ? value.password : undefined,
        role: value.role
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => this.onSaved(result.status === 'INVITED'
          ? 'Invitación enviada. La persona deberá aceptarla desde su cuenta.'
          : 'Colaborador creado correctamente.'),
        error: () => this.showError('No se pudo crear el colaborador. Verifica el correo e intenta nuevamente.')
      });
      return;
    }

    const current = this.currentUser();
    if (!current?.userId) return;
    this.colaboradoresService.updateColaborador(current.userId, {
      fullName: value.fullName,
      email: value.email,
      role: value.role,
      active: !!value.active
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.onSaved('Colaborador actualizado correctamente.'),
      error: () => this.showError('No se pudo actualizar el colaborador.')
    });
  }

  private onSaved(message: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon: 'check_circle' },
      duration: 3200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
    void this.router.navigate(['/workspace/empresa/colaboradores']);
  }

  private configureTemporaryPassword(required: boolean): void {
    const control = this.form.controls.password;
    control.clearValidators();
    if (required) control.addValidators([Validators.required, Validators.minLength(6)]);
    if (!required) control.setValue('', { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

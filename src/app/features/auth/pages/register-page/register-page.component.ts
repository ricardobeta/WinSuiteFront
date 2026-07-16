import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { RegisterUserPayload } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PasswordVisibilityToggleComponent } from '../../../../shared/components/password-visibility-toggle/password-visibility-toggle.component';
import { PublicCopilotDialogComponent } from '../../components/public-copilot-dialog/public-copilot-dialog.component';

@Component({
  selector: 'app-register-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatIconModule,
    PasswordVisibilityToggleComponent
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  // TODO: Remove before production
  private readonly TEST_MODE = false;

  protected readonly auth = inject(AuthService);
  protected readonly userForm = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordsMatchValidator }
  );

  protected async submit(): Promise<void> {
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) {
      return;
    }

    if (!this.TEST_MODE) {
      await this.auth.register(this.userForm.getRawValue() as RegisterUserPayload);
    }
    await this.router.navigateByUrl('/workspace');
  }

  protected async continueWithGoogle(): Promise<void> {
    await this.auth.loginWithGoogle();
    await this.router.navigateByUrl('/workspace');
  }

  protected openHelp(): void {
    this.dialog.open(PublicCopilotDialogComponent, { width: '640px', maxWidth: '96vw', autoFocus: false });
  }

  protected hasUserError(controlName: keyof RegisterUserPayload, errorName: string): boolean {
    const control = this.userForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || control.dirty);
  }

  protected hasPasswordMismatch(): boolean {
    return this.userForm.hasError('passwordMismatch') &&
      (this.userForm.controls.confirmPassword.touched || this.userForm.controls.confirmPassword.dirty);
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}

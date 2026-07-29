import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../../../core/services/auth.service';
import { PasswordVisibilityToggleComponent } from '../../../../shared/components/password-visibility-toggle/password-visibility-toggle.component';

@Component({
  selector: 'app-login-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PasswordVisibilityToggleComponent
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [true]
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const formValue = this.form.getRawValue();
    try {
      await this.auth.login({
        email: formValue.email,
        password: formValue.password,
        remember: formValue.remember
      });
      await this.router.navigateByUrl('/workspace');
    } catch {
      // AuthService exposes the recoverable message in the page.
    }
  }

  protected async continueWithGoogle(): Promise<void> {
    try {
      await this.auth.loginWithGoogle(this.form.controls.remember.value);
      await this.router.navigateByUrl('/workspace');
    } catch {
      // AuthService exposes the recoverable message in the page.
    }
  }

  protected hasControlError(controlName: 'email' | 'password', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(errorName) && (control.touched || control.dirty);
  }
}

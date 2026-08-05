import { Component, inject, signal } from '@angular/core';
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
import { CompanyLoadingOverlayComponent } from '../../../../shared/components/company-loading-overlay/company-loading-overlay.component';
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
    CompanyLoadingOverlayComponent,
    PasswordVisibilityToggleComponent,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly loadingCompany = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [true],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const formValue = this.form.getRawValue();
    this.loadingCompany.set(true);
    try {
      await this.auth.login({
        email: formValue.email,
        password: formValue.password,
        remember: formValue.remember,
      });
      const navigated = await this.router.navigateByUrl(
        this.auth.isPlatformAdmin() ? '/super-admin' : '/workspace',
      );
      if (!navigated) {
        this.loadingCompany.set(false);
      }
    } catch {
      this.loadingCompany.set(false);
      // AuthService exposes the recoverable message in the page.
    }
  }

  protected async continueWithGoogle(): Promise<void> {
    this.loadingCompany.set(true);
    try {
      await this.auth.loginWithGoogle(this.form.controls.remember.value);
      const navigated = await this.router.navigateByUrl(
        this.auth.isPlatformAdmin() ? '/super-admin' : '/workspace',
      );
      if (!navigated) {
        this.loadingCompany.set(false);
      }
    } catch {
      this.loadingCompany.set(false);
      // AuthService exposes the recoverable message in the page.
    }
  }

  protected hasControlError(controlName: 'email' | 'password', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(errorName) && (control.touched || control.dirty);
  }
}

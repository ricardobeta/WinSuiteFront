import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  RegisterBusinessPayload,
  RegisterUserPayload
} from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PasswordVisibilityToggleComponent } from '../../../../shared/components/password-visibility-toggle/password-visibility-toggle.component';
import { ModuleCardComponent } from '../../../../shared/components/module-card/module-card.component';
import { DEFAULT_ACTIVE_MODULES, MANDATORY_MODULES, MODULE_CATALOG } from '../../../../core/config/module-catalog';

interface RegisterStep {
  id: 1 | 2 | 3;
  title: string;
  description: string;
}

@Component({
  selector: 'app-register-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PasswordVisibilityToggleComponent,
    ModuleCardComponent
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  // TODO: Remove before production
  private readonly TEST_MODE = false;

  protected readonly auth = inject(AuthService);
  protected readonly currentStep = signal<1 | 2 | 3>(1);
  protected readonly steps: RegisterStep[] = [
    { id: 1, title: 'Usuario', description: 'Datos de acceso y perfil' },
    { id: 2, title: 'Negocio', description: 'Datos de la empresa y contacto' },
    { id: 3, title: 'Modulos', description: 'Elige lo que necesita tu negocio' }
  ];

  protected readonly moduleCatalog = MODULE_CATALOG;
  protected readonly mandatoryModules = MANDATORY_MODULES;
  protected readonly selectedModules = signal<Set<string>>(new Set(DEFAULT_ACTIVE_MODULES));

  protected readonly countries = [
    'Ecuador',
    'Colombia',
    'Peru',
    'Chile',
    'Mexico',
    'Argentina'
  ];

  protected readonly userForm = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordsMatchValidator }
  );

  protected readonly businessForm = this.formBuilder.nonNullable.group({
    businessName: ['', [Validators.required]],
    country: ['Ecuador', [Validators.required]],
    mobilePhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]]
  });

  protected nextStep(): void {
    if (this.currentStep() === 1) {
      this.userForm.markAllAsTouched();
      if (this.userForm.valid) {
        this.currentStep.set(2);
      }
      return;
    }

    this.businessForm.markAllAsTouched();
    if (this.businessForm.valid) {
      this.currentStep.set(3);
    }
  }

  protected prevStep(): void {
    this.currentStep.set(this.currentStep() === 3 ? 2 : 1);
  }

  protected isModuleSelected(moduleId: string): boolean {
    return this.selectedModules().has(moduleId);
  }

  protected isModuleLocked(moduleId: string): boolean {
    return this.mandatoryModules.includes(moduleId);
  }

  protected toggleModule(moduleId: string): void {
    if (this.isModuleLocked(moduleId)) {
      return;
    }

    this.selectedModules.update((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  protected async submit(): Promise<void> {
    this.userForm.markAllAsTouched();
    this.businessForm.markAllAsTouched();

    if (this.userForm.invalid || this.businessForm.invalid) {
      return;
    }

    if (!this.TEST_MODE) {
      await this.auth.register(
        this.userForm.getRawValue() as RegisterUserPayload,
        this.businessForm.getRawValue() as RegisterBusinessPayload,
        Array.from(this.selectedModules())
      );
    }
    await this.router.navigateByUrl('/workspace');
  }

  protected hasUserError(controlName: keyof RegisterUserPayload, errorName: string): boolean {
    const control = this.userForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || control.dirty);
  }

  protected hasBusinessError(controlName: keyof RegisterBusinessPayload, errorName: string): boolean {
    const control = this.businessForm.controls[controlName];
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

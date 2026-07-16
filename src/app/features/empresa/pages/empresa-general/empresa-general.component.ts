import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../../core/services/auth.service';
import { TenantApiService } from '../../../../core/services/tenant-api.service';

@Component({
  selector: 'app-empresa-general',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule],
  template: `
    <section class="settings-card surface-card">
      <div class="section-heading">
        <div><p class="eyebrow">Informacion general</p><h2>Datos de la empresa</h2><p>Esta informacion identifica el espacio de trabajo actual.</p></div>
        @if (isAdmin) {
          <button mat-flat-button color="primary" type="submit" form="company-profile" [disabled]="form.invalid || saving">
            <mat-icon>save</mat-icon>{{ saving ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        } @else {
          <span class="read-badge"><mat-icon>visibility</mat-icon>Solo lectura</span>
        }
      </div>
      <form id="company-profile" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="name" autocomplete="organization" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Telefono</mat-label><input matInput formControlName="mobilePhone" autocomplete="tel" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Correo</mat-label><input matInput type="email" formControlName="email" autocomplete="email" /></mat-form-field>
      </form>
    </section>
  `,
  styles: [`
    .settings-card { padding: 1.25rem; display: grid; gap: 1.25rem; }
    .section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .eyebrow { margin: 0 0 0.25rem; color: var(--primary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; }
    h2 { margin: 0; } .section-heading p:last-child { margin: 0.35rem 0 0; color: var(--muted-foreground); }
    form { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 1rem; }
    .read-badge { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--muted-foreground); background: var(--tc-surface-container-low); padding: 0.55rem 0.75rem; border-radius: 999px; }
    .read-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @media (width <= 840px) { form { grid-template-columns: 1fr; } .section-heading { flex-direction: column; } }
  `]
})
export class EmpresaGeneralComponent {
  protected readonly auth = inject(AuthService);
  private readonly tenantApi = inject(TenantApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(FormBuilder);
  protected saving = false;
  protected readonly isAdmin = this.auth.currentProfile()?.role?.toUpperCase() === 'ADMIN';
  protected readonly form = this.formBuilder.nonNullable.group({
    name: [this.auth.currentTenant()?.name ?? '', Validators.required],
    mobilePhone: [this.auth.currentTenant()?.mobilePhone ?? ''],
    email: [this.auth.currentTenant()?.email ?? '', Validators.email]
  });

  constructor() { if (!this.isAdmin) this.form.disable(); }

  protected save(): void {
    if (!this.isAdmin || this.form.invalid) return;
    this.saving = true;
    this.tenantApi.updateTenantProfile(this.form.getRawValue()).subscribe({
      next: tenant => { this.auth.currentTenant.set(tenant); this.saving = false; this.snackBar.open('Informacion actualizada.', 'Cerrar', { duration: 2600 }); },
      error: () => { this.saving = false; this.snackBar.open('No se pudo guardar la informacion.', 'Cerrar', { duration: 3200 }); }
    });
  }
}

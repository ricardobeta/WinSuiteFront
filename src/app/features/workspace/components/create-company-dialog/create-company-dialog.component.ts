import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-create-company-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="dialog-heading">
      <span class="icon-wrap"><mat-icon>domain_add</mat-icon></span>
      <div><p class="eyebrow">Nueva empresa</p><h2 mat-dialog-title>Crea otro espacio de trabajo</h2></div>
    </div>
    <mat-dialog-content>
      <p class="description">Tendra sus propios datos, colaboradores, roles y configuracion.</p>
      <form [formGroup]="form" id="create-company-form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Nombre de la empresa</mat-label>
          <input matInput formControlName="name" maxlength="120" autocomplete="organization" />
          @if (form.controls.name.touched && form.controls.name.hasError('required')) {
            <mat-error>Escribe el nombre de la empresa.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" type="submit" form="create-company-form">Crear empresa</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: min(460px, 86vw); }
    .dialog-heading { display: flex; gap: 0.85rem; align-items: center; padding: 1.25rem 1.5rem 0; }
    .icon-wrap { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .eyebrow { margin: 0 0 0.2rem; color: var(--primary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; }
    h2 { margin: 0; padding: 0; }
    .description { color: var(--muted-foreground); margin-top: 0; }
    form, mat-form-field { display: block; width: 100%; }
  `]
})
export class CreateCompanyDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateCompanyDialogComponent, string>);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly form = this.formBuilder.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(120)]] });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.controls.name.value.trim());
  }
}

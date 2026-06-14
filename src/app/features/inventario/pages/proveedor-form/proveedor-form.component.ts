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

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CamposCustomFormComponent } from '../../../../shared/components/campos-custom-form/campos-custom-form.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { Proveedor } from '../../models/inventario.models';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { ProveedoresService } from '../../services/proveedores.service';

@Component({
  selector: 'app-proveedor-form',
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
    MatSnackBarModule,
    CamposCustomFormComponent
  ],
  template: `
    <section class="form-page">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>{{ esEdicion() ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
        <p>Completa los datos del proveedor y sus campos personalizados.</p>
      </header>

      <section class="surface-card form-card">
        <form class="proveedor-form" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Codigo</mat-label>
              <input matInput formControlName="codigo" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="nombre" />
            </mat-form-field>
          </div>

          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Nombre contacto</mat-label>
              <input matInput formControlName="nombreContacto" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" />
            </mat-form-field>
          </div>

          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Telefono</mat-label>
              <input matInput formControlName="telefono" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>RUC/NIT/RIF</mat-label>
              <input matInput formControlName="ruc" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Direccion</mat-label>
            <textarea matInput rows="3" formControlName="direccion"></textarea>
          </mat-form-field>

          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Dias credito</mat-label>
              <input matInput type="number" min="0" formControlName="diasCredito" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Moneda</mat-label>
              <input matInput formControlName="moneda" />
            </mat-form-field>
          </div>

          <mat-slide-toggle formControlName="activo">Activo</mat-slide-toggle>

          @if (camposCustom().length > 0) {
            <section class="custom-section">
              <h3>Informacion adicional</h3>
              <app-campos-custom-form
                formControlName="camposPersonalizados"
                [campos]="camposCustom()"
              />
            </section>
          }

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/proveedores">Cancelar</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando...' : (esEdicion() ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .form-page { display: grid; gap: 1rem; }
    .header-card, .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .proveedor-form { display: grid; gap: 1rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .custom-section { display: grid; gap: .75rem; border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); padding-top: 1rem; }
    .custom-section h3 { margin: 0; }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class ProveedorFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly camposService = inject(CamposInventarioService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly guardando = signal(false);
  protected readonly proveedorId = signal<string | null>(null);
  protected readonly esEdicion = computed(() => !!this.proveedorId());
  protected readonly camposCustom = signal<CampoPersonalizado[]>([]);

  protected readonly form = this.formBuilder.nonNullable.group({
    codigo: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    nombreContacto: [''],
    email: ['', [Validators.email]],
    telefono: [''],
    direccion: [''],
    ruc: ['', [Validators.required]],
    diasCredito: [0, [Validators.required, Validators.min(0)]],
    moneda: ['USD', [Validators.required]],
    activo: [true],
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({})
  });

  async ngOnInit(): Promise<void> {
    this.camposService
      .getCampos('proveedor')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        this.camposCustom.set(campos.filter((campo) => campo.activo !== false));
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.proveedorId.set(id);
    const proveedor = await this.proveedoresService.getProveedorById(id);
    if (!proveedor) {
      return;
    }

    this.form.patchValue({
      codigo: proveedor.codigo,
      nombre: proveedor.nombre,
      nombreContacto: proveedor.nombreContacto ?? '',
      email: proveedor.email ?? '',
      telefono: proveedor.telefono ?? '',
      direccion: proveedor.direccion ?? '',
      ruc: proveedor.ruc,
      diasCredito: proveedor.diasCredito,
      moneda: proveedor.moneda,
      activo: proveedor.activo,
      camposPersonalizados: proveedor.camposPersonalizados ?? {}
    });
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    try {
      const raw = this.form.getRawValue();
      const payload: Omit<Proveedor, 'id'> = {
        codigo: raw.codigo,
        nombre: raw.nombre,
        nombreContacto: raw.nombreContacto || '',
        email: raw.email || '',
        telefono: raw.telefono || '',
        direccion: raw.direccion || '',
        ruc: raw.ruc,
        diasCredito: Number(raw.diasCredito),
        moneda: raw.moneda,
        activo: raw.activo,
        camposPersonalizados: raw.camposPersonalizados ?? {}
      };

      const id = this.proveedorId();
      if (id) {
        await this.proveedoresService.actualizarProveedor(id, payload);
      } else {
        await this.proveedoresService.crearProveedor(payload);
      }

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Proveedor guardado correctamente.', icon: 'storefront' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/inventario/proveedores']);
    } finally {
      this.guardando.set(false);
    }
  }
}

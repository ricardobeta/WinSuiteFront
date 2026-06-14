import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CampoPersonalizado, Cliente, ClienteDialogData, ClienteDialogResult, TipoIdentificacion } from '../../models/clientes.models';
import { CamposCustomFormComponent } from '../campos-custom-form/campos-custom-form.component';
import { ClientesService } from '../../../core/services/clientes.service';
import { ConfiguracionClientesService } from '../../../core/services/configuracion-clientes.service';

@Component({
  selector: 'app-cliente-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    CamposCustomFormComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ modoFormulario() === 'editar' ? 'Modificar cliente' : 'Nuevo cliente' }}</h2>

    <mat-dialog-content>
      <form class="cliente-form" [formGroup]="clienteForm">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="nombreCompleto" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Teléfono</mat-label>
          <input matInput formControlName="telefono" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Dirección</mat-label>
          <input matInput formControlName="direccion" />
        </mat-form-field>

        <div class="grid-two">
          <mat-form-field appearance="outline">
            <mat-label>Tipo de identificación</mat-label>
            <mat-select formControlName="tipoDeIdentificacion">
              @for (tipo of tiposIdentificacion; track tipo) {
                <mat-option [value]="tipo">{{ tipo }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Identificación</mat-label>
            <input matInput formControlName="identificacion" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Etiquetas</mat-label>
          <mat-chip-grid #chipGrid>
            @for (etiqueta of etiquetas(); track etiqueta) {
              <mat-chip-row (removed)="removerEtiqueta(etiqueta)">
                {{ etiqueta }}
                <button matChipRemove type="button"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input
              [matChipInputFor]="chipGrid"
              [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
              [matChipInputAddOnBlur]="true"
              (matChipInputTokenEnd)="agregarEtiqueta($event)"
            />
          </mat-chip-grid>
        </mat-form-field>

        <app-campos-custom-form
          [campos]="camposPersonalizados()"
          formControlName="camposPersonalizados"
        ></app-campos-custom-form>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="clienteForm.invalid || cargando()">
        {{ modoFormulario() === 'editar' ? 'Actualizar' : 'Crear' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cliente-form { display: grid; gap: 1rem; padding-top: .5rem; }
    mat-form-field { width: 100%; }
    .mat-dialog-actions button[mat-button] { color: var(--muted-foreground); }
    .mat-dialog-actions button[mat-raised-button] { min-width: 110px; }
    .grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    @media (max-width: 720px) { .grid-two { grid-template-columns: 1fr; } }
  `]
})
export class ClienteFormDialogComponent implements OnInit {
  protected readonly data = inject<ClienteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<ClienteFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly clientesService = inject(ClientesService);
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly separatorKeysCodes = [ENTER, COMMA] as const;
  protected readonly tiposIdentificacion: TipoIdentificacion[] = ['cedula', 'ruc', 'pasaporte', 'otro'];
  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly modoFormulario = signal<'crear' | 'editar' | 'popup'>(this.data?.modo ?? 'crear');
  protected readonly cargando = signal(false);
  protected readonly etiquetas = signal<string[]>([]);
  protected readonly clienteActual = signal<Cliente | null>(this.data?.cliente ?? null);

  protected readonly clienteForm = this.formBuilder.nonNullable.group({
    nombreCompleto: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    direccion: [''],
    identificacion: ['', [Validators.required]],
    tipoDeIdentificacion: ['cedula' as TipoIdentificacion, [Validators.required]],
    etiquetas: this.formBuilder.nonNullable.control<string[]>([]),
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({})
  });

  async ngOnInit(): Promise<void> {
    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((configuracion) => {
      this.camposPersonalizados.set(configuracion.camposPersonalizados ?? []);
    });

    if (this.data?.identificacion) {
      this.clienteForm.controls.identificacion.setValue(this.data.identificacion);
    }

    if (this.data?.tipoDeIdentificacion) {
      this.clienteForm.controls.tipoDeIdentificacion.setValue(this.data.tipoDeIdentificacion);
    }

    if (this.data?.cliente) {
      this.cargarClienteEnFormulario(this.data.cliente);
      return;
    }

    if (this.data?.identificacion && this.data?.tipoDeIdentificacion) {
      const clienteEncontrado = await this.clientesService.buscarClientePorIdentificacion(
        this.data.identificacion,
        this.data.tipoDeIdentificacion
      );

      if (clienteEncontrado) {
        this.cargarClienteEnFormulario(clienteEncontrado);
        this.modoFormulario.set('editar');
      }
    }
  }

  protected agregarEtiqueta(event: MatChipInputEvent): void {
    const valor = event.value.trim();
    if (!valor) {
      return;
    }

    const etiquetasActuales = this.etiquetas();
    if (!etiquetasActuales.includes(valor)) {
      this.etiquetas.set([...etiquetasActuales, valor]);
      this.clienteForm.controls.etiquetas.setValue(this.etiquetas());
    }

    event.chipInput?.clear();
  }

  protected removerEtiqueta(etiqueta: string): void {
    const nuevasEtiquetas = this.etiquetas().filter((item) => item !== etiqueta);
    this.etiquetas.set(nuevasEtiquetas);
    this.clienteForm.controls.etiquetas.setValue(nuevasEtiquetas);
  }

  protected async guardar(): Promise<void> {
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);

    try {
      const rawValue = this.clienteForm.getRawValue();
      const payload: Omit<Cliente, 'id'> = {
        nombreCompleto: rawValue.nombreCompleto,
        email: rawValue.email,
        telefono: rawValue.telefono,
        direccion: rawValue.direccion,
        identificacion: rawValue.identificacion,
        tipoDeIdentificacion: rawValue.tipoDeIdentificacion,
        etiquetas: this.etiquetas(),
        camposPersonalizados: rawValue.camposPersonalizados ?? {},
        creadoEn: this.clienteActual()?.creadoEn,
        actualizadoEn: Date.now()
      };

      const clienteExistente = this.clienteActual();
      if (clienteExistente?.id) {
        await this.clientesService.actualizarCliente(clienteExistente.id, payload);
        this.dialogRef.close({ cliente: { ...payload, id: clienteExistente.id } } satisfies ClienteDialogResult);
        return;
      }

      const id = await this.clientesService.crearClienteYRetornarId(payload);
      this.dialogRef.close({ cliente: { ...payload, id } } satisfies ClienteDialogResult);
    } finally {
      this.cargando.set(false);
    }
  }

  private cargarClienteEnFormulario(cliente: Cliente): void {
    this.clienteActual.set(cliente);
    this.etiquetas.set(cliente.etiquetas ?? []);

    this.clienteForm.patchValue({
      nombreCompleto: cliente.nombreCompleto,
      email: cliente.email,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      identificacion: cliente.identificacion,
      tipoDeIdentificacion: cliente.tipoDeIdentificacion,
      etiquetas: cliente.etiquetas ?? [],
      camposPersonalizados: cliente.camposPersonalizados ?? {}
    });
  }
}
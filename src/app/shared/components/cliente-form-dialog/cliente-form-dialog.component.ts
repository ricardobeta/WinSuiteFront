import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ClientesService } from '../../../core/services/clientes.service';
import { ConfiguracionClientesService, normalizarConfiguracionClientes } from '../../../core/services/configuracion-clientes.service';
import {
  CampoFormularioClienteKey,
  CampoPersonalizado,
  Cliente,
  ClienteDialogData,
  ClienteDialogResult,
  ConfiguracionClientes,
  TipoIdentificacion
} from '../../models/clientes.models';
import {
  EtiquetaClienteVista,
  normalizarValoresEtiquetasCliente,
  resolverEtiquetaCliente,
  textoComparableEtiqueta
} from '../../utils/etiquetas-clientes.utils';
import { CampoCustomControlComponent } from '../campo-custom-control/campo-custom-control.component';

interface ItemFormularioCliente {
  key: CampoFormularioClienteKey;
  tipo: 'base' | 'custom';
  campo?: CampoPersonalizado;
}

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
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    CampoCustomControlComponent
  ],
  template: `
    <div class="dialog-title-block">
      <span class="dialog-icon" aria-hidden="true"><mat-icon>{{ modoFormulario() === 'editar' ? 'person_edit' : 'person_add' }}</mat-icon></span>
      <div>
        <h2 mat-dialog-title>{{ modoFormulario() === 'editar' ? 'Modificar cliente' : 'Nuevo cliente' }}</h2>
        <p>{{ modoFormulario() === 'editar' ? 'Actualiza la información y conserva una ficha consistente.' : 'Registra los datos en el orden definido por tu equipo.' }}</p>
      </div>
    </div>

    <mat-dialog-content>
      @if (estadoConfiguracion() === 'loading') {
        <div class="form-state" role="status"><mat-spinner diameter="34" /><div><strong>Preparando formulario</strong><p>Cargando etiquetas y campos configurados.</p></div></div>
      } @else if (estadoConfiguracion() === 'error') {
        <div class="form-state error-state" role="alert">
          <mat-icon>cloud_off</mat-icon>
          <div><strong>No pudimos preparar el formulario</strong><p>Reintenta para evitar perder información configurada.</p></div>
          <button mat-stroked-button type="button" (click)="cargarConfiguracion()">Reintentar</button>
        </div>
      } @else {
        <form class="cliente-form" [formGroup]="clienteForm">
          @for (item of itemsFormulario(); track item.key) {
            @if (item.tipo === 'custom' && item.campo) {
              <div class="form-block custom-block">
                <app-campo-custom-control [campo]="item.campo" [control]="controlCampo(item.campo.idCampo)" />
              </div>
            } @else {
              @switch (item.key) {
                @case ('nombreCompleto') {
                  <div class="form-block">
                    <mat-form-field appearance="outline"><mat-label>Nombre completo</mat-label><input matInput formControlName="nombreCompleto" autocomplete="name" />@if (clienteForm.controls.nombreCompleto.touched && clienteForm.controls.nombreCompleto.hasError('required')) { <mat-error>Escribe el nombre del cliente.</mat-error> }</mat-form-field>
                  </div>
                }
                @case ('email') {
                  <div class="form-block">
                    <mat-form-field appearance="outline"><mat-label>Correo electrónico</mat-label><input matInput formControlName="email" type="email" autocomplete="email" />@if (clienteForm.controls.email.touched && clienteForm.controls.email.hasError('required')) { <mat-error>Escribe un correo.</mat-error> } @else if (clienteForm.controls.email.touched && clienteForm.controls.email.hasError('email')) { <mat-error>Escribe un correo válido.</mat-error> }</mat-form-field>
                  </div>
                }
                @case ('telefono') {
                  <div class="form-block"><mat-form-field appearance="outline"><mat-label>Teléfono</mat-label><input matInput formControlName="telefono" type="tel" autocomplete="tel" /></mat-form-field></div>
                }
                @case ('direccion') {
                  <div class="form-block"><mat-form-field appearance="outline"><mat-label>Dirección</mat-label><input matInput formControlName="direccion" autocomplete="street-address" /></mat-form-field></div>
                }
                @case ('identificacion') {
                  <fieldset class="form-block identification-block">
                    <legend>Identificación</legend>
                    <div class="grid-two">
                      <mat-form-field appearance="outline"><mat-label>Tipo</mat-label><mat-select formControlName="tipoDeIdentificacion">@for (tipo of tiposIdentificacion; track tipo) { <mat-option [value]="tipo">{{ nombreIdentificacion(tipo) }}</mat-option> }</mat-select></mat-form-field>
                      <mat-form-field appearance="outline"><mat-label>Número</mat-label><input matInput formControlName="identificacion" />@if (clienteForm.controls.identificacion.touched && clienteForm.controls.identificacion.hasError('required')) { <mat-error>Escribe la identificación.</mat-error> }</mat-form-field>
                    </div>
                  </fieldset>
                }
                @case ('etiquetas') {
                  <div class="form-block tags-block">
                    <mat-form-field appearance="outline" class="tags-field">
                      <mat-label>Etiquetas</mat-label>
                      <mat-chip-grid #chipGrid aria-label="Etiquetas asignadas al cliente">
                        @for (etiqueta of etiquetasSeleccionadas(); track etiqueta.valor) {
                          <mat-chip-row
                            [attr.data-color]="etiqueta.color"
                            [class.is-muted]="!etiqueta.activa"
                            [matTooltip]="etiqueta.historica ? 'Etiqueta histórica' : (!etiqueta.activa ? 'Etiqueta desactivada' : '')"
                            (removed)="removerEtiqueta(etiqueta.valor)"
                          >
                            <span class="chip-dot" aria-hidden="true"></span>{{ etiqueta.nombre }}
                            <button matChipRemove type="button" [attr.aria-label]="'Quitar ' + etiqueta.nombre"><mat-icon>cancel</mat-icon></button>
                          </mat-chip-row>
                        }
                        <input
                          [matChipInputFor]="chipGrid"
                          [matAutocomplete]="autoEtiquetas"
                          [value]="filtroEtiqueta()"
                          [disabled]="etiquetasDisponibles().length === 0 && !filtroEtiqueta()"
                          (input)="actualizarFiltroEtiqueta($event)"
                          placeholder="Buscar en el catálogo…"
                          aria-label="Buscar etiqueta configurada"
                        />
                      </mat-chip-grid>
                      <mat-autocomplete #autoEtiquetas="matAutocomplete" (optionSelected)="seleccionarEtiqueta($event)">
                        @for (etiqueta of etiquetasDisponibles(); track etiqueta.idEtiqueta) {
                          <mat-option [value]="etiqueta.idEtiqueta"><span class="option-tag" [attr.data-color]="etiqueta.color"><i aria-hidden="true"></i>{{ etiqueta.nombre }}</span></mat-option>
                        }
                      </mat-autocomplete>
                      @if (catalogoActivo().length === 0) { <mat-hint>No hay etiquetas activas configuradas.</mat-hint> } @else { <mat-hint>Selecciona una o varias opciones del catálogo.</mat-hint> }
                    </mat-form-field>
                  </div>
                }
              }
            }
          }
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="guardar()" [disabled]="estadoConfiguracion() !== 'ready' || clienteForm.invalid || cargando()">
        @if (cargando()) { <mat-spinner diameter="18" /> }
        {{ modoFormulario() === 'editar' ? 'Actualizar cliente' : 'Crear cliente' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title-block { display: flex; align-items: center; gap: .85rem; padding: 1.3rem 1.5rem .35rem; }
    .dialog-icon { display: grid; width: 46px; height: 46px; flex: 0 0 46px; place-items: center; border-radius: 14px; background: var(--tc-primary-container); color: var(--tc-on-primary-container); }
    h2[mat-dialog-title] { margin: 0; padding: 0; font-family: var(--tc-font-family-heading); font-size: 1.35rem; letter-spacing: -.02em; }
    .dialog-title-block p { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .84rem; }
    mat-dialog-content { width: min(820px, 88vw); max-height: min(70vh, 760px); }
    .cliente-form { display: grid; gap: .72rem; padding: .8rem 0 .25rem; }
    .form-block { min-width: 0; padding: .15rem 0; }
    .custom-block { animation: field-reveal 220ms cubic-bezier(.2,.8,.2,1); }
    mat-form-field, app-campo-custom-control { width: 100%; }
    fieldset { min-width: 0; margin: 0; padding: .8rem .85rem .1rem; border: 0; border-radius: 13px; background: var(--tc-surface-container-low); }
    legend { padding: 0 .25rem; color: var(--muted-foreground); font-size: .76rem; font-weight: 750; }
    .grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
    .tags-field { width: 100%; }
    mat-chip-row { --tag-bg: #d8f3ed; --tag-fg: #075b50; --mdc-chip-elevated-container-color: var(--tag-bg); --mdc-chip-label-text-color: var(--tag-fg); font-weight: 700; }
    mat-chip-row[data-color='blue'], .option-tag[data-color='blue'] { --tag-bg: #dceeff; --tag-fg: #174f78; }
    mat-chip-row[data-color='violet'], .option-tag[data-color='violet'] { --tag-bg: #ece5ff; --tag-fg: #593b87; }
    mat-chip-row[data-color='amber'], .option-tag[data-color='amber'] { --tag-bg: #ffedc7; --tag-fg: #714500; }
    mat-chip-row[data-color='rose'], .option-tag[data-color='rose'] { --tag-bg: #ffe1e7; --tag-fg: #8b2943; }
    mat-chip-row[data-color='slate'], .option-tag[data-color='slate'] { --tag-bg: #e7ecef; --tag-fg: #45545b; }
    mat-chip-row.is-muted { filter: saturate(.45); opacity: .82; }
    .chip-dot, .option-tag i { display: inline-block; width: 7px; height: 7px; margin-right: .35rem; border-radius: 50%; background: currentColor; opacity: .72; }
    .option-tag { display: inline-flex; min-height: 28px; align-items: center; padding: .15rem .62rem; border-radius: 999px; background: var(--tag-bg, #d8f3ed); color: var(--tag-fg, #075b50); font-size: .77rem; font-weight: 700; }
    .form-state { display: flex; min-height: 180px; align-items: center; justify-content: center; gap: 1rem; }.form-state strong { display: block; }.form-state p { margin: .2rem 0 0; color: var(--muted-foreground); }
    .error-state { justify-content: flex-start; }.error-state > mat-icon { width: 34px; height: 34px; color: var(--tc-error); font-size: 34px; }.error-state button { margin-left: auto; }
    mat-dialog-actions button[mat-flat-button] { min-width: 150px; } mat-dialog-actions mat-spinner { display: inline-block; margin-right: .4rem; }
    :host-context(html.theme-dark) mat-chip-row[data-color='teal'], :host-context(html.theme-dark) .option-tag[data-color='teal'] { --tag-bg: #163f38; --tag-fg: #a9eee0; }
    :host-context(html.theme-dark) mat-chip-row[data-color='blue'], :host-context(html.theme-dark) .option-tag[data-color='blue'] { --tag-bg: #17364a; --tag-fg: #b9e0fb; }
    :host-context(html.theme-dark) mat-chip-row[data-color='violet'], :host-context(html.theme-dark) .option-tag[data-color='violet'] { --tag-bg: #35274b; --tag-fg: #ddc9ff; }
    :host-context(html.theme-dark) mat-chip-row[data-color='amber'], :host-context(html.theme-dark) .option-tag[data-color='amber'] { --tag-bg: #493716; --tag-fg: #ffdda0; }
    :host-context(html.theme-dark) mat-chip-row[data-color='rose'], :host-context(html.theme-dark) .option-tag[data-color='rose'] { --tag-bg: #4b2631; --tag-fg: #ffc6d2; }
    :host-context(html.theme-dark) mat-chip-row[data-color='slate'], :host-context(html.theme-dark) .option-tag[data-color='slate'] { --tag-bg: #30383c; --tag-fg: #d7e0e4; }
    @keyframes field-reveal { from { opacity: .4; transform: translateY(5px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .custom-block { animation: none; } }
    @media (max-width: 720px) { mat-dialog-content { width: auto; max-height: 72vh; }.grid-two { grid-template-columns: 1fr; }.dialog-title-block { align-items: flex-start; }.dialog-icon { width: 42px; height: 42px; flex-basis: 42px; } }
  `]
})
export class ClienteFormDialogComponent implements OnInit {
  protected readonly data = inject<ClienteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<ClienteFormDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly clientesService = inject(ClientesService);
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tiposIdentificacion: TipoIdentificacion[] = ['cedula', 'ruc', 'pasaporte', 'otro'];
  protected readonly modoFormulario = signal<'crear' | 'editar' | 'popup'>(this.data?.modo ?? 'crear');
  protected readonly cargando = signal(false);
  protected readonly estadoConfiguracion = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly configuracion = signal<ConfiguracionClientes>(normalizarConfiguracionClientes(null));
  protected readonly etiquetas = signal<string[]>([]);
  protected readonly filtroEtiqueta = signal('');
  protected readonly clienteActual = signal<Cliente | null>(this.data?.cliente ?? null);

  protected readonly camposForm = new FormGroup<Record<string, FormControl<any>>>({});
  protected readonly clienteForm = this.formBuilder.nonNullable.group({
    nombreCompleto: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    direccion: [''],
    identificacion: ['', [Validators.required]],
    tipoDeIdentificacion: ['cedula' as TipoIdentificacion, [Validators.required]],
    etiquetas: this.formBuilder.nonNullable.control<string[]>([]),
    camposPersonalizados: this.camposForm
  });

  protected readonly catalogoActivo = computed(() => this.configuracion().catalogoEtiquetas.filter((item) => item.activa));
  protected readonly etiquetasSeleccionadas = computed<EtiquetaClienteVista[]>(() =>
    this.etiquetas().map((valor) => resolverEtiquetaCliente(valor, this.configuracion().catalogoEtiquetas)));
  protected readonly etiquetasDisponibles = computed(() => {
    const filtro = textoComparableEtiqueta(this.filtroEtiqueta());
    return this.catalogoActivo()
      .filter((item) => !this.etiquetas().includes(item.idEtiqueta))
      .filter((item) => !filtro || textoComparableEtiqueta(item.nombre).includes(filtro))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });
  protected readonly itemsFormulario = computed<ItemFormularioCliente[]>(() => {
    const items: ItemFormularioCliente[] = [];
    for (const key of this.configuracion().ordenFormulario) {
      if (!key.startsWith('custom:')) {
        items.push({ key, tipo: 'base' });
        continue;
      }
      const campo = this.configuracion().camposPersonalizados.find((item) => item.idCampo === key.slice(7));
      if (campo && campo.activo !== false) items.push({ key, tipo: 'custom', campo });
    }
    return items;
  });

  private valoresCustomPendientes: Record<string, any> = {};

  async ngOnInit(): Promise<void> {
    this.cargarConfiguracion();
    if (this.data?.identificacion) this.clienteForm.controls.identificacion.setValue(this.data.identificacion);
    if (this.data?.tipoDeIdentificacion) this.clienteForm.controls.tipoDeIdentificacion.setValue(this.data.tipoDeIdentificacion);
    if (this.data?.cliente) {
      this.cargarClienteEnFormulario(this.data.cliente);
    } else if (this.data?.identificacion && this.data?.tipoDeIdentificacion) {
      const encontrado = await this.clientesService.buscarClientePorIdentificacion(this.data.identificacion, this.data.tipoDeIdentificacion);
      if (encontrado) {
        this.cargarClienteEnFormulario(encontrado);
        this.modoFormulario.set('editar');
      }
    }
  }

  protected cargarConfiguracion(): void {
    this.estadoConfiguracion.set('loading');
    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (configuracion) => {
        this.configuracion.set(configuracion);
        this.reconstruirCamposPersonalizados(configuracion.camposPersonalizados.filter((campo) => campo.activo !== false));
        this.establecerEtiquetas(normalizarValoresEtiquetasCliente(this.etiquetas(), configuracion.catalogoEtiquetas));
        this.estadoConfiguracion.set('ready');
      },
      error: () => this.estadoConfiguracion.set('error')
    });
  }

  protected actualizarFiltroEtiqueta(event: Event): void { this.filtroEtiqueta.set((event.target as HTMLInputElement).value); }

  protected seleccionarEtiqueta(event: MatAutocompleteSelectedEvent): void {
    const idEtiqueta = String(event.option.value);
    if (!this.etiquetas().includes(idEtiqueta)) this.establecerEtiquetas([...this.etiquetas(), idEtiqueta]);
    this.filtroEtiqueta.set('');
  }

  protected removerEtiqueta(valor: string): void {
    this.establecerEtiquetas(this.etiquetas().filter((item) => item !== valor));
  }

  protected controlCampo(idCampo: string): FormControl<any> {
    return this.camposForm.controls[idCampo];
  }

  protected nombreIdentificacion(tipo: TipoIdentificacion): string {
    return ({ cedula: 'Cédula', ruc: 'RUC', pasaporte: 'Pasaporte', otro: 'Otro' })[tipo];
  }

  protected async guardar(): Promise<void> {
    if (this.estadoConfiguracion() !== 'ready' || this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      this.camposForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    try {
      const rawValue = this.clienteForm.getRawValue();
      const payload: Omit<Cliente, 'id'> = {
        nombreCompleto: rawValue.nombreCompleto.trim(),
        email: rawValue.email.trim(),
        telefono: rawValue.telefono.trim(),
        direccion: rawValue.direccion.trim(),
        identificacion: rawValue.identificacion.trim(),
        tipoDeIdentificacion: rawValue.tipoDeIdentificacion,
        etiquetas: this.etiquetas(),
        camposPersonalizados: {
          ...(this.clienteActual()?.camposPersonalizados ?? {}),
          ...(rawValue.camposPersonalizados ?? {})
        },
        actualizadoEn: Date.now()
      };
      if (this.clienteActual()?.creadoEn !== undefined) payload.creadoEn = this.clienteActual()?.creadoEn;

      const existente = this.clienteActual();
      if (existente?.id) {
        await this.clientesService.actualizarCliente(existente.id, payload);
        this.dialogRef.close({ cliente: { ...payload, id: existente.id } } satisfies ClienteDialogResult);
      } else {
        const id = await this.clientesService.crearClienteYRetornarId(payload);
        this.dialogRef.close({ cliente: { ...payload, id } } satisfies ClienteDialogResult);
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar el cliente. Inténtalo nuevamente.';
      this.snackBar.open(mensaje, 'Cerrar', { duration: 5000, horizontalPosition: 'end', verticalPosition: 'top' });
    } finally {
      this.cargando.set(false);
    }
  }

  private cargarClienteEnFormulario(cliente: Cliente): void {
    this.clienteActual.set(cliente);
    this.valoresCustomPendientes = cliente.camposPersonalizados ?? {};
    this.establecerEtiquetas(this.estadoConfiguracion() === 'ready'
      ? normalizarValoresEtiquetasCliente(cliente.etiquetas, this.configuracion().catalogoEtiquetas)
      : (cliente.etiquetas ?? []));
    this.clienteForm.patchValue({
      nombreCompleto: cliente.nombreCompleto,
      email: cliente.email,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      identificacion: cliente.identificacion,
      tipoDeIdentificacion: cliente.tipoDeIdentificacion
    });
    this.camposForm.patchValue(this.valoresCustomPendientes, { emitEvent: false });
  }

  private establecerEtiquetas(valores: string[]): void {
    this.etiquetas.set(valores);
    this.clienteForm.controls.etiquetas.setValue(valores);
  }

  private reconstruirCamposPersonalizados(campos: CampoPersonalizado[]): void {
    const actuales = { ...this.valoresCustomPendientes, ...this.camposForm.getRawValue() };
    Object.keys(this.camposForm.controls).forEach((id) =>
      (this.camposForm as FormGroup).removeControl(id, { emitEvent: false }));
    for (const campo of campos) {
      this.camposForm.addControl(campo.idCampo, new FormControl(
        actuales[campo.idCampo] ?? this.valorInicial(campo),
        { validators: this.validadores(campo) }
      ), { emitEvent: false });
    }
    this.camposForm.updateValueAndValidity({ emitEvent: false });
    this.clienteForm.updateValueAndValidity({ emitEvent: false });
  }

  private valorInicial(campo: CampoPersonalizado): any {
    if (campo.tipo === 'lista_multiple') return [];
    if (campo.tipo === 'booleano') return false;
    return '';
  }

  private validadores(campo: CampoPersonalizado) {
    if (!campo.requerido) return [];
    if (campo.tipo === 'booleano') return [Validators.requiredTrue];
    if (campo.tipo === 'lista_multiple') {
      return [(control: AbstractControl): ValidationErrors | null =>
        Array.isArray(control.value) && control.value.length > 0 ? null : { required: true }];
    }
    return [Validators.required];
  }
}

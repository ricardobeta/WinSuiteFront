import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { AppUserProfile } from '../../../../core/models/auth.models';
import { ColaboradoresService } from '../../../colaboradores/services/colaboradores.service';
import { Almacen, TipoAlmacen } from '../../models/inventario.models';

export interface AlmacenFormDialogData {
  almacen?: Almacen;
}

@Component({
  selector: 'app-almacen-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.almacen ? 'Editar almacen' : 'Nuevo almacen' }}</h2>

    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="nombre" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Codigo</mat-label>
            <input matInput formControlName="codigo" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo">
            @for (tipo of tipos; track tipo) {
              <mat-option [value]="tipo">{{ tipo }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Direccion</mat-label>
          <input matInput formControlName="direccion" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Responsable</mat-label>
          <mat-select formControlName="responsableId" (openedChange)="alCambiarEstadoSelector($event)">
            <div class="select-search" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
              <input
                #responsableSearch
                type="text"
                autocomplete="off"
                placeholder="Buscar por nombre o correo"
                [value]="consultaResponsable()"
                (input)="actualizarConsultaResponsable($event)"
              />
            </div>

            @if (cargandoColaboradores()) {
              <mat-option disabled>Cargando colaboradores...</mat-option>
            } @else {
              <mat-option value="">Sin responsable</mat-option>
              @for (colaborador of colaboradoresFiltrados(); track colaborador.userId) {
                <mat-option [value]="colaborador.userId">
                  {{ colaborador.fullName }} — {{ colaborador.email }}
                  @if (colaborador.active === false) {
                    (inactivo)
                  }
                </mat-option>
              }

              @if (colaboradoresFiltrados().length === 0) {
                <mat-option disabled>No se encontraron colaboradores</mat-option>
              }
            }
          </mat-select>
          @if (errorColaboradores()) {
            <mat-hint class="load-error">No se pudieron cargar los colaboradores.</mat-hint>
          }
        </mat-form-field>

        <div class="toggles">
          <mat-slide-toggle formControlName="esPorDefecto">Almacen por defecto</mat-slide-toggle>
          <mat-slide-toggle formControlName="activo">Activo</mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="guardar()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: grid; gap: 1rem; padding-top: .5rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .toggles { display: flex; gap: 1rem; flex-wrap: wrap; }
    .select-search { padding: .5rem .75rem; position: sticky; top: 0; z-index: 1; background: var(--mat-sys-surface, #fff); }
    .select-search input { width: 100%; box-sizing: border-box; border: 1px solid var(--mat-sys-outline-variant, #c4c7c5); border-radius: .5rem; padding: .65rem .75rem; font: inherit; color: inherit; background: transparent; outline: none; }
    .select-search input:focus { border-color: var(--mat-sys-primary, #3f51b5); }
    .load-error { color: var(--mat-sys-error, #ba1a1a); }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
  `]
})
export class AlmacenFormDialogComponent implements OnInit {
  @ViewChild('responsableSearch') private responsableSearch?: ElementRef<HTMLInputElement>;

  protected readonly data = inject<AlmacenFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AlmacenFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly colaboradoresService = inject(ColaboradoresService);

  protected readonly tipos: TipoAlmacen[] = ['ALMACEN', 'SUCURSAL', 'BODEGA', 'VIRTUAL'];
  protected readonly colaboradores = signal<AppUserProfile[]>([]);
  protected readonly cargandoColaboradores = signal(true);
  protected readonly errorColaboradores = signal(false);
  protected readonly consultaResponsable = signal('');
  protected readonly colaboradoresFiltrados = computed(() => {
    const consulta = this.normalizarTexto(this.consultaResponsable());
    const colaboradores = this.colaboradores();

    if (!consulta) {
      return colaboradores;
    }

    return colaboradores.filter((colaborador) =>
      this.normalizarTexto(`${colaborador.fullName} ${colaborador.email}`).includes(consulta)
    );
  });
  protected readonly form = this.fb.nonNullable.group({
    id: [''],
    codigo: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    tipo: ['ALMACEN' as TipoAlmacen, [Validators.required]],
    direccion: [''],
    responsableId: [''],
    esPorDefecto: [false],
    activo: [true]
  });

  ngOnInit(): void {
    this.cargarColaboradores();

    if (this.data.almacen) {
      this.form.patchValue({
        id: this.data.almacen.id ?? '',
        codigo: this.data.almacen.codigo,
        nombre: this.data.almacen.nombre,
        tipo: this.data.almacen.tipo,
        direccion: this.data.almacen.direccion ?? '',
        responsableId: this.data.almacen.responsableId ?? '',
        esPorDefecto: this.data.almacen.esPorDefecto,
        activo: this.data.almacen.activo
      });
    }
  }

  protected actualizarConsultaResponsable(event: Event): void {
    this.consultaResponsable.set((event.target as HTMLInputElement).value);
  }

  protected alCambiarEstadoSelector(abierto: boolean): void {
    if (!abierto) {
      this.consultaResponsable.set('');
      return;
    }

    setTimeout(() => this.responsableSearch?.nativeElement.focus());
  }

  private cargarColaboradores(): void {
    this.colaboradoresService
      .getColaboradores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (colaboradores) => {
          this.colaboradores.set(
            [...colaboradores].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }))
          );
          this.cargandoColaboradores.set(false);
        },
        error: () => {
          this.errorColaboradores.set(true);
          this.cargandoColaboradores.set(false);
        }
      });
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es');
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.dialogRef.close({
      id: raw.id || undefined,
      codigo: raw.codigo,
      nombre: raw.nombre,
      tipo: raw.tipo,
      direccion: raw.direccion,
      responsableId: raw.responsableId,
      esPorDefecto: raw.esPorDefecto,
      activo: raw.activo
    } as Almacen);
  }
}

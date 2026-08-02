import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MODULE_CATALOG } from '../../../../core/config/module-catalog';
import {
  AplicaAddon,
  ComplementoPlataforma,
  RECURSOS_META,
  RecursoPlataforma,
  TipoAddon,
} from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

/**
 * Complementos que se compran por separado del plan, para que cada cliente arme su propia
 * combinacion: paquetes de capacidad (tokens, facturas, espacio) o modulos sueltos.
 */
@Component({
  selector: 'app-complementos',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="pagina">
      <section class="surface-card bloque">
        <div class="cabecera">
          <div>
            <p class="eyebrow">Catalogo</p>
            <h2>Complementos</h2>
            <p class="sub">Paquetes de capacidad y modulos sueltos que el cliente puede comprar aparte del plan.</p>
          </div>
          <button mat-raised-button color="primary" type="button" (click)="nuevo()">
            <mat-icon>add</mat-icon>
            Nuevo complemento
          </button>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="tabla">
          <table mat-table [dataSource]="complementos()">
            <ng-container matColumnDef="nombre">
              <th mat-header-cell *matHeaderCellDef>Complemento</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.nombre }}</strong>
                <small>{{ row.id }}</small>
              </td>
            </ng-container>

            <ng-container matColumnDef="aplica">
              <th mat-header-cell *matHeaderCellDef>Aplica a</th>
              <td mat-cell *matCellDef="let row">{{ row.aplicaA === 'cuenta' ? 'Cuenta' : 'Empresa' }}</td>
            </ng-container>

            <ng-container matColumnDef="otorga">
              <th mat-header-cell *matHeaderCellDef>Que otorga</th>
              <td mat-cell *matCellDef="let row">{{ descripcionOtorga(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="precio">
              <th mat-header-cell *matHeaderCellDef>Precio</th>
              <td mat-cell *matCellDef="let row">{{ (row.moneda || 'USD') + ' ' + (row.precio ?? 0) }}</td>
            </ng-container>

            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let row">{{ row.activo ? 'Activo' : 'Inactivo' }}</td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                <button mat-icon-button color="primary" type="button" matTooltip="Editar" (click)="editar(row)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" type="button" matTooltip="Eliminar" (click)="eliminar(row)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let row; columns: columnas"></tr>
          </table>
        </div>
      </section>

      @if (editando()) {
        <form class="surface-card bloque" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="cabecera">
            <h3>{{ form.controls.id.value ? 'Editar complemento' : 'Nuevo complemento' }}</h3>
            <button mat-icon-button type="button" (click)="cancelar()" matTooltip="Cerrar">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput type="text" formControlName="nombre" maxlength="60" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Identificador</mat-label>
              <input matInput type="text" formControlName="id" [readonly]="bloqueaId()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="ancho-total">
              <mat-label>Descripcion</mat-label>
              <input matInput type="text" formControlName="descripcion" maxlength="180" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Aplica a</mat-label>
              <mat-select formControlName="aplicaA">
                <mat-option value="empresa">Empresa</mat-option>
                <mat-option value="cuenta">Cuenta</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select formControlName="tipo">
                <mat-option value="limite">Paquete de capacidad</mat-option>
                <mat-option value="modulo">Modulo</mat-option>
              </mat-select>
            </mat-form-field>

            @if (form.controls.tipo.value === 'limite') {
              <mat-form-field appearance="outline">
                <mat-label>Recurso</mat-label>
                <mat-select formControlName="recurso">
                  @for (recurso of recursos; track recurso) {
                    <mat-option [value]="recurso">{{ etiquetaRecurso(recurso) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Unidades que otorga</mat-label>
                <input matInput type="number" formControlName="cantidad" />
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline">
                <mat-label>Modulo</mat-label>
                <mat-select formControlName="moduloId">
                  @for (modulo of catalogo; track modulo.id) {
                    <mat-option [value]="modulo.id">{{ modulo.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <mat-form-field appearance="outline">
              <mat-label>Precio</mat-label>
              <input matInput type="number" formControlName="precio" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Orden</mat-label>
              <input matInput type="number" formControlName="orden" />
            </mat-form-field>
          </div>

          <mat-slide-toggle formControlName="activo">Complemento activo</mat-slide-toggle>

          <div class="acciones">
            <button mat-stroked-button type="button" (click)="cancelar()">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="guardando() || form.invalid">
              <mat-icon>save</mat-icon>
              Guardar complemento
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .pagina { display: grid; gap: 1rem; align-content: start; }
    .bloque { padding: 1.25rem; display: grid; gap: .9rem; background: var(--tc-surface-container-lowest); }
    .cabecera { display: flex; align-items: end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 1.35rem; }
    h3 { margin: 0; font-size: 1.1rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .tabla { overflow-x: auto; }
    table { width: 100%; min-width: 820px; }
    thead tr { background: var(--tc-surface-container-low); }
    td strong { display: block; }
    td small { color: var(--muted-foreground); font-family: monospace; font-size: .75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .75rem; align-items: start; }
    .ancho-total { grid-column: 1 / -1; }
    .acciones { display: flex; justify-content: flex-end; gap: .6rem; }
    .error { margin: 0; color: #b3261e; }
  `],
})
export class ComplementosComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly catalogo = MODULE_CATALOG;
  protected readonly recursos = Object.keys(RECURSOS_META) as RecursoPlataforma[];
  protected readonly columnas = ['nombre', 'aplica', 'otorga', 'precio', 'estado', 'acciones'];

  protected readonly complementos = signal<ComplementoPlataforma[]>([]);
  protected readonly editando = signal(false);
  protected readonly bloqueaId = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: [''],
    nombre: ['', Validators.required],
    descripcion: [''],
    aplicaA: ['empresa' as AplicaAddon, Validators.required],
    tipo: ['limite' as TipoAddon, Validators.required],
    recurso: ['aiTokens' as RecursoPlataforma],
    cantidad: [1000],
    moduloId: [''],
    precio: [0],
    orden: [0],
    activo: [true],
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.api.listarComplementos().subscribe({
      next: (complementos) => this.complementos.set(complementos),
      error: () => this.error.set('No se pudo cargar el catalogo de complementos.'),
    });
  }

  protected etiquetaRecurso(recurso: RecursoPlataforma): string {
    return RECURSOS_META[recurso].label;
  }

  protected descripcionOtorga(addon: ComplementoPlataforma): string {
    if (addon.tipo === 'modulo') {
      const modulo = this.catalogo.find((candidato) => candidato.id === addon.moduloId);
      return `Modulo: ${modulo?.label ?? addon.moduloId ?? '—'}`;
    }
    const recurso = addon.recurso as RecursoPlataforma | undefined;
    const etiqueta = recurso && RECURSOS_META[recurso] ? RECURSOS_META[recurso].label : addon.recurso;
    return `${(addon.cantidad ?? 0).toLocaleString('es-EC')} · ${etiqueta}`;
  }

  protected nuevo(): void {
    this.form.reset({
      id: '', nombre: '', descripcion: '', aplicaA: 'empresa', tipo: 'limite',
      recurso: 'aiTokens', cantidad: 1000, moduloId: '', precio: 0,
      orden: this.complementos().length, activo: true,
    });
    this.bloqueaId.set(false);
    this.editando.set(true);
  }

  protected editar(addon: ComplementoPlataforma): void {
    this.form.patchValue({
      id: addon.id,
      nombre: addon.nombre,
      descripcion: addon.descripcion ?? '',
      aplicaA: addon.aplicaA,
      tipo: addon.tipo,
      recurso: (addon.recurso as RecursoPlataforma) ?? 'aiTokens',
      cantidad: addon.cantidad ?? 0,
      moduloId: addon.moduloId ?? '',
      precio: addon.precio ?? 0,
      orden: addon.orden,
      activo: addon.activo,
    });
    this.bloqueaId.set(true);
    this.editando.set(true);
  }

  protected cancelar(): void {
    this.editando.set(false);
    this.error.set(null);
  }

  protected guardar(): void {
    const valores = this.form.getRawValue();
    const addon: ComplementoPlataforma = {
      id: valores.id,
      nombre: valores.nombre,
      descripcion: valores.descripcion,
      aplicaA: valores.aplicaA,
      tipo: valores.tipo,
      recurso: valores.tipo === 'limite' ? valores.recurso : null,
      cantidad: valores.tipo === 'limite' ? valores.cantidad : null,
      moduloId: valores.tipo === 'modulo' ? valores.moduloId : null,
      precio: valores.precio,
      moneda: 'USD',
      activo: valores.activo,
      orden: valores.orden,
    };

    this.guardando.set(true);
    this.api.guardarComplemento(addon).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        this.cargar();
        this.avisar('Complemento guardado');
      },
      error: (respuesta: { error?: { error?: string } }) => {
        this.guardando.set(false);
        this.error.set(respuesta?.error?.error ?? 'No se pudo guardar el complemento.');
      },
    });
  }

  protected eliminar(addon: ComplementoPlataforma): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar complemento',
        message: `Se eliminara "${addon.nombre}". Esta accion no se puede deshacer.`,
        confirmText: 'Eliminar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;
      this.api.eliminarComplemento(addon.id).subscribe({
        next: () => {
          this.cargar();
          this.avisar('Complemento eliminado');
        },
        error: () => this.error.set('No se pudo eliminar el complemento.'),
      });
    });
  }

  private avisar(mensaje: string): void {
    this.error.set(null);
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message: mensaje, icon: 'check_circle' },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}

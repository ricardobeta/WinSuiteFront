import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PlanCuenta } from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { formatearCantidad } from '../../utils/formato';

/**
 * Planes que se asignan a una cuenta de usuario. Controlan cuantas empresas puede crear y en
 * cuantas empresas ajenas puede estar vinculada, que es el mecanismo para evitar multicuentas.
 */
@Component({
  selector: 'app-planes-cuenta',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
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
            <h2>Planes por cuenta</h2>
            <p class="sub">Cuantas empresas puede crear una cuenta y en cuantas ajenas puede estar vinculada.</p>
          </div>
          <button mat-raised-button color="primary" type="button" (click)="nuevo()">
            <mat-icon>add</mat-icon>
            Nuevo plan
          </button>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="tabla">
          <table mat-table [dataSource]="planes()">
            <ng-container matColumnDef="nombre">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.nombre }}</strong>
                <small>{{ row.id }}</small>
              </td>
            </ng-container>

            <ng-container matColumnDef="precio">
              <th mat-header-cell *matHeaderCellDef>Precio</th>
              <td mat-cell *matCellDef="let row">
                {{ row.precioMensual ? (row.moneda || 'USD') + ' ' + row.precioMensual : 'Gratis' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="propias">
              <th mat-header-cell *matHeaderCellDef>Empresas propias</th>
              <td mat-cell *matCellDef="let row">{{ texto(row.maxEmpresasPropias) }}</td>
            </ng-container>

            <ng-container matColumnDef="vinculadas">
              <th mat-header-cell *matHeaderCellDef>Empresas vinculadas</th>
              <td mat-cell *matCellDef="let row">{{ texto(row.maxEmpresasVinculadas) }}</td>
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
            <h3>{{ form.controls.id.value ? 'Editar plan' : 'Nuevo plan' }}</h3>
            <button mat-icon-button type="button" (click)="cancelar()" matTooltip="Cerrar">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <p class="ayuda">Escribe <strong>-1</strong> para dejar un cupo sin limite.</p>

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
              <mat-label>Precio mensual</mat-label>
              <input matInput type="number" formControlName="precioMensual" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Empresas propias</mat-label>
              <input matInput type="number" formControlName="maxEmpresasPropias" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Empresas vinculadas</mat-label>
              <input matInput type="number" formControlName="maxEmpresasVinculadas" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Orden</mat-label>
              <input matInput type="number" formControlName="orden" />
            </mat-form-field>
          </div>

          <div class="interruptores">
            <mat-slide-toggle formControlName="activo">Plan activo</mat-slide-toggle>
            <mat-slide-toggle formControlName="visiblePublico">Visible para los clientes</mat-slide-toggle>
          </div>

          <div class="acciones">
            <button mat-stroked-button type="button" (click)="cancelar()">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="guardando() || form.invalid">
              <mat-icon>save</mat-icon>
              Guardar plan
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
    .ayuda { margin: 0; color: var(--muted-foreground); font-size: .88rem; }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .tabla { overflow-x: auto; }
    table { width: 100%; min-width: 760px; }
    thead tr { background: var(--tc-surface-container-low); }
    td strong { display: block; }
    td small { color: var(--muted-foreground); font-family: monospace; font-size: .75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .75rem; align-items: start; }
    .ancho-total { grid-column: 1 / -1; }
    .interruptores { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .acciones { display: flex; justify-content: flex-end; gap: .6rem; }
    .error { margin: 0; color: #b3261e; }
  `],
})
export class PlanesCuentaComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['nombre', 'precio', 'propias', 'vinculadas', 'estado', 'acciones'];
  protected readonly planes = signal<PlanCuenta[]>([]);
  protected readonly editando = signal(false);
  protected readonly bloqueaId = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: [''],
    nombre: ['', Validators.required],
    descripcion: [''],
    precioMensual: [0],
    maxEmpresasPropias: [2],
    maxEmpresasVinculadas: [2],
    orden: [0],
    activo: [true],
    visiblePublico: [true],
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.api.listarPlanesCuenta().subscribe({
      next: (planes) => this.planes.set(planes),
      error: () => this.error.set('No se pudo cargar el catalogo de planes de cuenta.'),
    });
  }

  protected texto(valor: number | null | undefined): string {
    return formatearCantidad(valor);
  }

  protected nuevo(): void {
    this.form.reset({
      id: '', nombre: '', descripcion: '', precioMensual: 0,
      maxEmpresasPropias: 2, maxEmpresasVinculadas: 2,
      orden: this.planes().length, activo: true, visiblePublico: true,
    });
    this.bloqueaId.set(false);
    this.editando.set(true);
  }

  protected editar(plan: PlanCuenta): void {
    this.form.patchValue({
      id: plan.id,
      nombre: plan.nombre,
      descripcion: plan.descripcion ?? '',
      precioMensual: plan.precioMensual ?? 0,
      maxEmpresasPropias: plan.maxEmpresasPropias ?? 2,
      maxEmpresasVinculadas: plan.maxEmpresasVinculadas ?? 2,
      orden: plan.orden,
      activo: plan.activo,
      visiblePublico: plan.visiblePublico,
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
    this.guardando.set(true);
    this.api.guardarPlanCuenta({ ...valores, moneda: 'USD' }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        this.cargar();
        this.avisar('Plan guardado');
      },
      error: (respuesta: { error?: { error?: string } }) => {
        this.guardando.set(false);
        this.error.set(respuesta?.error?.error ?? 'No se pudo guardar el plan.');
      },
    });
  }

  protected eliminar(plan: PlanCuenta): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar plan de cuenta',
        message: `Se eliminara el plan "${plan.nombre}". Esta accion no se puede deshacer.`,
        confirmText: 'Eliminar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;
      this.api.eliminarPlanCuenta(plan.id).subscribe({
        next: () => {
          this.cargar();
          this.avisar('Plan eliminado');
        },
        error: (respuesta: { error?: { error?: string } }) => {
          this.error.set(respuesta?.error?.error ?? 'No se pudo eliminar el plan.');
        },
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

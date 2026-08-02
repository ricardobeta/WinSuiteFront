import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { CuentaFila, EstadoSuscripcion, PlanCuenta } from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { formatearCantidad } from '../../utils/formato';

/**
 * Cuentas de usuario con su cupo de empresas. El cupo de empresas vinculadas es lo que impide
 * que una misma persona reparta sus datos entre varias cuentas.
 */
@Component({
  selector: 'app-cuentas-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    DataTableFrameComponent,
  ],
  template: `
    <div class="pagina">
      <section class="surface-card bloque">
        <div class="cabecera">
          <div>
            <p class="eyebrow">Plataforma</p>
            <h2>Cuentas</h2>
            <p class="sub">Cupo de empresas propias y vinculadas de cada cuenta.</p>
          </div>
          <button mat-stroked-button type="button" (click)="cargar()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <app-data-table-frame
          searchPlaceholder="Buscar por correo, nombre o empresa"
          [searchValue]="busqueda()"
          [showPaginator]="false"
          (searchChange)="busqueda.set($event)"
        >
          <table mat-table [dataSource]="filtradas()">
            <ng-container matColumnDef="cuenta">
              <th mat-header-cell *matHeaderCellDef>Cuenta</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.email || row.nombre || 'Sin correo' }}</strong>
                <small>{{ row.nombre || row.userId }}</small>
              </td>
            </ng-container>

            <ng-container matColumnDef="empresas">
              <th mat-header-cell *matHeaderCellDef>Empresas</th>
              <td mat-cell *matCellDef="let row">
                @if (row.empresas.length === 0) {
                  <span class="tenue">Ninguna</span>
                } @else {
                  <div class="empresas">
                    @for (empresa of row.empresas; track empresa.tenantId) {
                      <a class="chip" [class.propia]="empresa.propietario"
                         [routerLink]="['/super-admin/empresas', empresa.tenantId]"
                         [matTooltip]="(empresa.propietario ? 'Propietario' : 'Vinculado') + ' · ' + empresa.rol
                                        + (empresa.activo ? '' : ' · inactiva')">
                        {{ empresa.nombre }}
                      </a>
                    }
                  </div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="plan">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let row">{{ row.planNombre }}</td>
            </ng-container>

            <ng-container matColumnDef="propias">
              <th mat-header-cell *matHeaderCellDef>Empresas propias</th>
              <td mat-cell *matCellDef="let row">
                {{ row.empresasPropias }} / {{ texto(row.maxEmpresasPropias) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="vinculadas">
              <th mat-header-cell *matHeaderCellDef>Empresas vinculadas</th>
              <td mat-cell *matCellDef="let row">
                {{ row.empresasVinculadas }} / {{ texto(row.maxEmpresasVinculadas) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                <button mat-icon-button color="primary" type="button" matTooltip="Editar cupos" (click)="editar(row)">
                  <mat-icon>tune</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let row; columns: columnas"></tr>
          </table>

          @if (filtradas().length === 0) {
            <p class="vacio">No hay cuentas que coincidan con la busqueda.</p>
          }
        </app-data-table-frame>
      </section>

      @if (seleccionada(); as cuenta) {
        <form class="surface-card bloque" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="cabecera">
            <div>
              <h3>{{ cuenta.email || cuenta.userId }}</h3>
              <p class="sub">
                Usa <strong>-1</strong> para dejar un cupo sin limite, o deja el campo vacio para heredar el del plan.
              </p>
            </div>
            <button mat-icon-button type="button" (click)="cerrar()" matTooltip="Cerrar">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Plan de cuenta</mat-label>
              <mat-select formControlName="planId">
                @for (plan of planes(); track plan.id) {
                  <mat-option [value]="plan.id">{{ plan.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="estado">
                <mat-option value="ACTIVE">Activa</mat-option>
                <mat-option value="TRIAL">En prueba</mat-option>
                <mat-option value="SUSPENDED">Suspendida</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Empresas propias (ajuste)</mat-label>
              <input matInput type="number" formControlName="maxEmpresasPropiasOverride" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Empresas vinculadas (ajuste)</mat-label>
              <input matInput type="number" formControlName="maxEmpresasVinculadasOverride" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="ancho-total">
              <mat-label>Notas internas</mat-label>
              <input matInput type="text" formControlName="notas" maxlength="240" />
            </mat-form-field>
          </div>

          <div class="acciones">
            <button mat-stroked-button type="button" (click)="cerrar()">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="guardando() || form.invalid">
              <mat-icon>save</mat-icon>
              Guardar cupos
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
    table { width: 100%; min-width: 980px; }
    thead tr { background: var(--tc-surface-container-low); }
    td strong { display: block; }
    td small { color: var(--muted-foreground); font-family: monospace; font-size: .75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .75rem; align-items: start; }
    .ancho-total { grid-column: 1 / -1; }
    .acciones { display: flex; justify-content: flex-end; gap: .6rem; }
    .empresas { display: flex; flex-wrap: wrap; gap: .3rem; padding: .35rem 0; }
    .chip {
      padding: .15rem .55rem; border-radius: 999px; font-size: .76rem; text-decoration: none;
      background: var(--tc-surface-container-high); color: inherit;
    }
    .chip.propia { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); font-weight: 600; }
    .chip:hover { text-decoration: underline; }
    .tenue { color: var(--muted-foreground); }
    .vacio { margin: 1rem 0 0; color: var(--muted-foreground); text-align: center; }
    .error { margin: 0; color: #b3261e; }
  `],
})
export class CuentasListComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columnas = ['cuenta', 'empresas', 'plan', 'propias', 'vinculadas', 'acciones'];
  protected readonly cuentas = signal<CuentaFila[]>([]);
  protected readonly planes = signal<PlanCuenta[]>([]);
  protected readonly seleccionada = signal<CuentaFila | null>(null);
  protected readonly busqueda = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filtradas = computed(() => {
    const needle = this.busqueda().trim().toLowerCase();
    if (!needle) return this.cuentas();
    return this.cuentas().filter(
      (cuenta) =>
        (cuenta.email ?? '').toLowerCase().includes(needle) ||
        (cuenta.nombre ?? '').toLowerCase().includes(needle) ||
        cuenta.empresas.some((empresa) => empresa.nombre.toLowerCase().includes(needle)),
    );
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    planId: ['', Validators.required],
    estado: ['ACTIVE' as EstadoSuscripcion, Validators.required],
    maxEmpresasPropiasOverride: [null as number | null],
    maxEmpresasVinculadasOverride: [null as number | null],
    notas: [''],
  });

  ngOnInit(): void {
    this.api.listarPlanesCuenta().subscribe({ next: (planes) => this.planes.set(planes) });
    this.cargar();
  }

  protected cargar(): void {
    this.api.listarCuentas().subscribe({
      next: (cuentas) => this.cuentas.set(cuentas),
      error: () => this.error.set('No se pudo cargar el listado de cuentas.'),
    });
  }

  protected texto(valor: number | null | undefined): string {
    return formatearCantidad(valor);
  }

  protected editar(cuenta: CuentaFila): void {
    this.seleccionada.set(cuenta);
    this.form.patchValue({
      planId: cuenta.planId,
      estado: 'ACTIVE',
      maxEmpresasPropiasOverride: null,
      maxEmpresasVinculadasOverride: null,
      notas: '',
    });
  }

  protected cerrar(): void {
    this.seleccionada.set(null);
    this.error.set(null);
  }

  protected guardar(): void {
    const cuenta = this.seleccionada();
    if (!cuenta) return;

    this.guardando.set(true);
    this.api.actualizarSuscripcionCuenta(cuenta.userId, this.form.getRawValue()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrar();
        this.cargar();
        this.avisar('Cupos de la cuenta actualizados');
      },
      error: (respuesta: { error?: { error?: string } }) => {
        this.guardando.set(false);
        this.error.set(respuesta?.error?.error ?? 'No se pudo guardar la cuenta.');
      },
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

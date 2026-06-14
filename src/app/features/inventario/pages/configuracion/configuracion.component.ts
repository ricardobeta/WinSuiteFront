import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';

import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { Categoria, MetodoCosteo, MetodoPrecioVenta, Unidad } from '../../models/inventario.models';
import { CamposConfigComponent } from '../../components/campos-config/campos-config.component';
import { CategoriaFormDialogComponent } from '../../components/catalogos-config/categoria-form-dialog.component';
import { UnidadFormDialogComponent } from '../../components/catalogos-config/unidad-form-dialog.component';
import { CategoriasService } from '../../services/categorias.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { UnidadesService } from '../../services/unidades.service';

@Component({
  selector: 'app-configuracion-inventario',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    CamposConfigComponent
  ],
  template: `
    <section class="config-page">
      <header class="surface-card hero-card">
        <p class="eyebrow">Inventario</p>
        <h2>Configuracion</h2>
        <p>Administra la configuracion global del modulo y los campos dinamicos por entidad.</p>
      </header>

      <mat-tab-group>
        <mat-tab label="Campos personalizados">
          <div class="tab-content">
            <app-campos-config />
          </div>
        </mat-tab>

        <mat-tab label="Categorias">
          <div class="tab-content">
            <section class="surface-card form-card">
              <div class="section-toolbar">
                <h3>Categorias</h3>
                <button mat-raised-button color="primary" type="button" (click)="crearCategoria()">Nueva categoria</button>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="categoriasDataSource">
                  <ng-container matColumnDef="nombre">
                    <th mat-header-cell *matHeaderCellDef>Nombre</th>
                    <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
                  </ng-container>

                  <ng-container matColumnDef="padre">
                    <th mat-header-cell *matHeaderCellDef>Categoria padre</th>
                    <td mat-cell *matCellDef="let row">{{ nombreCategoriaPadre(row.categoriaPadreId) }}</td>
                  </ng-container>

                  <ng-container matColumnDef="orden">
                    <th mat-header-cell *matHeaderCellDef>Orden</th>
                    <td mat-cell *matCellDef="let row">{{ row.orden ?? 0 }}</td>
                  </ng-container>

                  <ng-container matColumnDef="acciones">
                    <th mat-header-cell *matHeaderCellDef>Acciones</th>
                    <td mat-cell *matCellDef="let row">
                      <button mat-button type="button" (click)="editarCategoria(row)">Editar</button>
                      <button mat-button color="warn" type="button" (click)="eliminarCategoria(row)">Eliminar</button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasCategorias"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasCategorias"></tr>
                </table>
              </div>
            </section>
          </div>
        </mat-tab>

        <mat-tab label="Unidades">
          <div class="tab-content">
            <section class="surface-card form-card">
              <div class="section-toolbar">
                <h3>Unidades de medida</h3>
                <button mat-raised-button color="primary" type="button" (click)="crearUnidad()">Nueva unidad</button>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="unidadesDataSource">
                  <ng-container matColumnDef="nombre">
                    <th mat-header-cell *matHeaderCellDef>Nombre</th>
                    <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
                  </ng-container>

                  <ng-container matColumnDef="abreviatura">
                    <th mat-header-cell *matHeaderCellDef>Abreviatura</th>
                    <td mat-cell *matCellDef="let row">{{ row.abreviatura }}</td>
                  </ng-container>

                  <ng-container matColumnDef="tipo">
                    <th mat-header-cell *matHeaderCellDef>Tipo</th>
                    <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
                  </ng-container>

                  <ng-container matColumnDef="acciones">
                    <th mat-header-cell *matHeaderCellDef>Acciones</th>
                    <td mat-cell *matCellDef="let row">
                      <button mat-button type="button" (click)="editarUnidad(row)">Editar</button>
                      <button mat-button color="warn" type="button" (click)="eliminarUnidad(row)">Eliminar</button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasUnidades"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasUnidades"></tr>
                </table>
              </div>
            </section>
          </div>
        </mat-tab>

        <mat-tab label="General">
          <div class="tab-content">
            <section class="surface-card form-card">
              <h3>Moneda y precios</h3>

              <form class="config-form" [formGroup]="form" (ngSubmit)="guardar()">
                <div class="grid-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Moneda base</mat-label>
                    <input matInput formControlName="monedaBase" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Simbolo moneda</mat-label>
                    <input matInput formControlName="simboloMoneda" />
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline">
                  <mat-label>Impuesto por defecto (%)</mat-label>
                  <input matInput type="number" formControlName="impuestoPorDefecto" min="0" />
                </mat-form-field>

                <div class="grid-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Metodo sugerido de precio de venta</mat-label>
                    <mat-select formControlName="metodoPrecioVentaDefecto">
                      @for (metodo of metodosPrecioVenta; track metodo.value) {
                        <mat-option [value]="metodo.value">{{ metodo.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Porcentaje por defecto (%)</mat-label>
                    <input matInput type="number" formControlName="porcentajePrecioVentaDefecto" min="0" max="99.99" />
                  </mat-form-field>
                </div>

                <div class="grid-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Metodo de costeo por defecto</mat-label>
                    <mat-select formControlName="metodoCosteoDefecto">
                      @for (metodo of metodosCosteo; track metodo) {
                        <mat-option [value]="metodo">{{ metodo }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Prefijo SKU</mat-label>
                    <input matInput formControlName="prefijoSKU" />
                  </mat-form-field>
                </div>

                <div class="toggles-row">
                  <mat-slide-toggle formControlName="permitirStockNegativo">Permitir stock negativo</mat-slide-toggle>
                  <mat-slide-toggle formControlName="alertasStockMinimo">Alertas de stock minimo</mat-slide-toggle>
                </div>

                <div class="actions-row">
                  <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
                    Guardar configuracion
                  </button>
                </div>
              </form>
            </section>
          </div>
        </mat-tab>
      </mat-tab-group>
    </section>
  `,
  styles: [`
    .config-page { display: grid; gap: 1rem; }
    .hero-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .hero-card h2 { margin: 0; font-size: 1.4rem; }
    .hero-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .tab-content { padding-top: 1rem; }
    .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .form-card h3 { margin: 0 0 1rem; }
    .config-form { display: grid; gap: 1rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .toggles-row { display: flex; flex-wrap: wrap; gap: 1.2rem; }
    .actions-row { display: flex; justify-content: flex-end; }
    .section-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .section-toolbar h3 { margin: 0; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 680px; }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
      .section-toolbar { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class ConfiguracionComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected guardando = false;
  protected categorias: Categoria[] = [];
  protected unidades: Unidad[] = [];
  protected readonly categoriasDataSource = new MatTableDataSource<Categoria>([]);
  protected readonly unidadesDataSource = new MatTableDataSource<Unidad>([]);
  protected readonly columnasCategorias = ['nombre', 'padre', 'orden', 'acciones'];
  protected readonly columnasUnidades = ['nombre', 'abreviatura', 'tipo', 'acciones'];
  protected readonly metodosCosteo: MetodoCosteo[] = ['FIFO', 'LIFO', 'PROMEDIO'];
  protected readonly metodosPrecioVenta: Array<{ value: MetodoPrecioVenta; label: string }> = [
    { value: 'MARGEN_UTILIDAD', label: 'Margen de utilidad (sobre precio final)' },
    { value: 'MARKUP', label: 'Markup (sobre costo)' }
  ];
  protected readonly form = this.formBuilder.nonNullable.group({
    metodoCosteoDefecto: ['PROMEDIO' as MetodoCosteo, [Validators.required]],
    permitirStockNegativo: [false],
    prefijoSKU: ['PROD-', [Validators.required]],
    monedaBase: ['USD', [Validators.required]],
    simboloMoneda: ['$', [Validators.required]],
    alertasStockMinimo: [true],
    impuestoPorDefecto: [12, [Validators.required, Validators.min(0)]],
    metodoPrecioVentaDefecto: ['MARKUP' as MetodoPrecioVenta, [Validators.required]],
    porcentajePrecioVentaDefecto: [30, [Validators.required, Validators.min(0), Validators.max(99.99)]]
  });

  ngOnInit(): void {
    this.configService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.form.patchValue(config, { emitEvent: false });
      });

    this.categoriasService
      .getCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categorias) => {
        setTimeout(() => {
          this.categorias = [...categorias];
          this.categoriasDataSource.data = [...categorias];
        });
      });

    this.unidadesService
      .getUnidades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unidades) => {
        setTimeout(() => {
          this.unidades = [...unidades];
          this.unidadesDataSource.data = [...unidades];
        });
      });
  }

  protected guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    void this.configService
      .guardarConfiguracion(this.form.getRawValue())
      .then(() => {
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: 'Configuracion guardada.', icon: 'settings' },
          duration: 2400,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      })
      .finally(() => {
        setTimeout(() => {
          this.guardando = false;
        });
      });
  }

  protected crearCategoria(): void {
    const dialogRef = this.dialog.open(CategoriaFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { categoriasDisponibles: this.categorias }
    });

    dialogRef.afterClosed().subscribe((categoria: Categoria | undefined) => {
      if (!categoria) {
        return;
      }

      void this.categoriasService.guardarCategoria(categoria).then(() => {
        this.mostrarExito('Categoria guardada.', 'category');
      });
    });
  }

  protected editarCategoria(categoria: Categoria): void {
    const dialogRef = this.dialog.open(CategoriaFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { categoria, categoriasDisponibles: this.categorias }
    });

    dialogRef.afterClosed().subscribe((categoriaActualizada: Categoria | undefined) => {
      if (!categoriaActualizada) {
        return;
      }

      void this.categoriasService.guardarCategoria(categoriaActualizada).then(() => {
        this.mostrarExito('Categoria actualizada.', 'edit');
      });
    });
  }

  protected eliminarCategoria(categoria: Categoria): void {
    if (!categoria.id) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar categoria',
        message: `¿Deseas eliminar la categoria ${categoria.nombre}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.categoriasService.eliminarCategoria(categoria.id!).then(() => {
        this.mostrarExito('Categoria eliminada.', 'delete');
      });
    });
  }

  protected crearUnidad(): void {
    const dialogRef = this.dialog.open(UnidadFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe((unidad: Unidad | undefined) => {
      if (!unidad) {
        return;
      }

      void this.unidadesService.guardarUnidad(unidad).then(() => {
        this.mostrarExito('Unidad guardada.', 'straighten');
      });
    });
  }

  protected editarUnidad(unidad: Unidad): void {
    const dialogRef = this.dialog.open(UnidadFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { unidad }
    });

    dialogRef.afterClosed().subscribe((unidadActualizada: Unidad | undefined) => {
      if (!unidadActualizada) {
        return;
      }

      void this.unidadesService.guardarUnidad(unidadActualizada).then(() => {
        this.mostrarExito('Unidad actualizada.', 'edit');
      });
    });
  }

  protected eliminarUnidad(unidad: Unidad): void {
    if (!unidad.id) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar unidad',
        message: `¿Deseas eliminar la unidad ${unidad.nombre}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.unidadesService.eliminarUnidad(unidad.id!).then(() => {
        this.mostrarExito('Unidad eliminada.', 'delete');
      });
    });
  }

  protected nombreCategoriaPadre(categoriaId: string | null | undefined): string {
    if (!categoriaId) {
      return '-';
    }

    return this.categorias.find((categoria) => categoria.id === categoriaId)?.nombre ?? '-';
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2400,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

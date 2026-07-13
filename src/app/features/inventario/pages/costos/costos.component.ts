import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CostoAnalisisRow, MetodoCosteo, Producto } from '../../models/inventario.models';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { CostosService } from '../../services/costos.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-costos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatSnackBarModule
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Analisis de costos</h2>
          <p>Comparativa FIFO, LIFO y Promedio a partir del kardex (sin persistencia).</p>
        </div>
      </header>

      <section class="surface-card filters-card">
        <form [formGroup]="form" class="filters-grid" (ngSubmit)="recalcular()">
          <mat-form-field appearance="outline">
            <mat-label>Producto</mat-label>
            <mat-select formControlName="productoId">
              <mat-option value="">Todos</mat-option>
              @for (producto of productos(); track producto.id) {
                <mat-option [value]="producto.id">{{ producto.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Metodo</mat-label>
            <mat-select formControlName="metodo">
              @for (metodo of metodos; track metodo) {
                <mat-option [value]="metodo">{{ metodo }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" [disabled]="cargando()">Recalcular</button>
        </form>
      </section>

      <section class="kpi-grid">
        <article class="surface-card kpi-card">
          <h4>Valor total inventario</h4>
          <p>{{ simboloMoneda() }}{{ valorTotalInventario() | number:'1.2-2' }}</p>
        </article>

        <article class="surface-card kpi-card">
          <h4>COGS estimado</h4>
          <p>{{ simboloMoneda() }}{{ cogsTotal() | number:'1.2-2' }}</p>
        </article>

        <article class="surface-card kpi-card">
          <h4>Margen bruto estimado</h4>
          <p>{{ margenBruto() | number:'1.2-2' }}%</p>
        </article>
      </section>

      @if (cargando()) {
        <section class="surface-card loading-card">
          <p>Calculando costos...</p>
        </section>
      } @else if (rows().length === 0) {
        <section class="surface-card empty-card">
          <h3>Sin datos de costos</h3>
          <p>Registra movimientos en kardex para visualizar analisis.</p>
        </section>
      } @else {
        <section class="surface-card table-card">
          <div class="table-wrap">
            <table mat-table [dataSource]="rows()">
              <ng-container matColumnDef="producto">
                <th mat-header-cell *matHeaderCellDef>Producto</th>
                <td mat-cell *matCellDef="let row">{{ row.producto }}</td>
              </ng-container>

              <ng-container matColumnDef="saldoInicial">
                <th mat-header-cell *matHeaderCellDef>Saldo ini</th>
                <td mat-cell *matCellDef="let row">{{ row.saldoInicial }}</td>
              </ng-container>

              <ng-container matColumnDef="entradas">
                <th mat-header-cell *matHeaderCellDef>Entradas</th>
                <td mat-cell *matCellDef="let row">{{ row.entradas }}</td>
              </ng-container>

              <ng-container matColumnDef="salidas">
                <th mat-header-cell *matHeaderCellDef>Salidas</th>
                <td mat-cell *matCellDef="let row">{{ row.salidas }}</td>
              </ng-container>

              <ng-container matColumnDef="saldoFinal">
                <th mat-header-cell *matHeaderCellDef>Saldo fin</th>
                <td mat-cell *matCellDef="let row">{{ row.saldoFinal }}</td>
              </ng-container>

              <ng-container matColumnDef="costoPromedio">
                <th mat-header-cell *matHeaderCellDef>C. prom.</th>
                <td mat-cell *matCellDef="let row">{{ row.costoPromedio | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="valorTotal">
                <th mat-header-cell *matHeaderCellDef>Valor total</th>
                <td mat-cell *matCellDef="let row">{{ simboloMoneda() }}{{ row.valorTotal | number:'1.2-2' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .page-grid { display: grid; gap: 1rem; }
    .header-card, .filters-card, .table-card, .empty-card, .loading-card { padding: 1rem 1.25rem; background: var(--tc-surface-container-lowest); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .filters-grid { display: grid; grid-template-columns: 1fr 1fr auto; gap: .8rem; align-items: center; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
    .kpi-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .kpi-card h4 { margin: 0; color: var(--muted-foreground); font-weight: 500; }
    .kpi-card p { margin: .45rem 0 0; font-size: 1.25rem; font-weight: 700; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1000px; }
    .empty-card h3 { margin: 0; }
    .empty-card p, .loading-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CostosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly costosService = inject(CostosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly metodos: MetodoCosteo[] = ['FIFO', 'LIFO', 'PROMEDIO'];
  protected readonly columns = ['producto', 'saldoInicial', 'entradas', 'salidas', 'saldoFinal', 'costoPromedio', 'valorTotal'];
  protected readonly productos = signal<Producto[]>([]);
  protected readonly rows = signal<CostoAnalisisRow[]>([]);
  protected readonly cargando = signal(false);
  protected readonly simboloMoneda = signal('$');
  protected readonly valorTotalInventario = signal(0);
  protected readonly cogsTotal = signal(0);
  protected readonly margenBruto = signal(0);

  protected readonly form = this.fb.nonNullable.group({
    productoId: [''],
    metodo: ['PROMEDIO' as MetodoCosteo, [Validators.required]]
  });

  ngOnInit(): void {
    void this.initData();
  }

  private async initData(): Promise<void> {
    this.productosService.getProductos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productos) => {
      this.productos.set(productos);
    });

    const config = await this.configService.getConfiguracionOnce();
    this.simboloMoneda.set(config.simboloMoneda);

    await this.recalcular();
  }

  protected async recalcular(): Promise<void> {
    this.cargando.set(true);

    try {
      const raw = this.form.getRawValue();
      const result = await this.costosService.calcularAnalisisCostos(raw.metodo, raw.productoId || undefined);

      this.rows.set(result.rows);
      this.valorTotalInventario.set(result.valorTotalInventario);
      this.cogsTotal.set(result.cogsTotal);
      this.margenBruto.set(result.margenBrutoEstimado);
    } catch (error) {
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: {
          message: error instanceof Error ? error.message : 'No fue posible recalcular costos.',
          icon: 'error'
        },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    } finally {
      this.cargando.set(false);
    }
  }
}

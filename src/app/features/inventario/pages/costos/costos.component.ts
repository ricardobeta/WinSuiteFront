import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import {
  CostoAnalisisFiltros,
  CostoAnalisisResultado,
  CostoAnalisisRow,
  MetodoCosteo,
  Producto,
} from '../../models/inventario.models';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { CostosService } from '../../services/costos.service';
import { ProductosService } from '../../services/productos.service';
import {
  crearPdfMovimientosCostos,
  crearPdfResumenCostos,
  nombreReporteCostos,
} from '../../utils/costos-reporte.util';

@Component({
  selector: 'app-costos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    DataTableFrameComponent,
  ],
  template: `
    <section class="cost-analysis-page">
      <header class="analysis-header surface-card">
        <div class="header-copy">
          <h2>¿Cuánto vale tu inventario?</h2>
          <p>
            Reconstruye el costo desde el kardex, concilia entradas y salidas, y detecta diferencias
            antes de llevarlas a un reporte.
          </p>
        </div>

        <div class="header-actions">
          <button
            mat-stroked-button
            type="button"
            [matMenuTriggerFor]="reportesMenu"
            [disabled]="cargando() || resultado().rows.length === 0"
          >
            <mat-icon>download</mat-icon>
            Descargar reporte
          </button>
          <mat-menu #reportesMenu="matMenu">
            <button mat-menu-item type="button" (click)="descargarResumen()">
              <mat-icon>summarize</mat-icon>
              <span>Resumen ejecutivo PDF</span>
            </button>
            <button mat-menu-item type="button" (click)="descargarDetalle()">
              <mat-icon>receipt_long</mat-icon>
              <span>Movimientos valorizados PDF</span>
            </button>
          </mat-menu>
        </div>
      </header>

      <section class="analysis-controls surface-card" aria-labelledby="filtros-costos-title">
        <div class="controls-heading">
          <div>
            <h3 id="filtros-costos-title">Corte y método</h3>
            <p>La apertura incluye todos los movimientos anteriores al periodo seleccionado.</p>
          </div>
          <span class="method-chip">{{ etiquetaMetodo(form.controls.metodo.value) }}</span>
        </div>

        <form [formGroup]="form" class="filters-grid" (ngSubmit)="recalcular()">
          <mat-form-field appearance="outline">
            <mat-label>Producto</mat-label>
            <mat-select formControlName="productoId">
              <mat-option value="">Todos los productos</mat-option>
              @for (producto of productos(); track producto.id) {
                <mat-option [value]="producto.id"
                  >{{ producto.nombre }} · {{ producto.sku }}</mat-option
                >
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Método de valoración</mat-label>
            <mat-select formControlName="metodo">
              <mat-option value="PROMEDIO">Promedio móvil</mat-option>
              <mat-option value="FIFO">FIFO · primeras entradas</mat-option>
              <mat-option value="LIFO">LIFO · solo simulación</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Desde</mat-label>
            <input matInput type="date" formControlName="fechaDesde" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Hasta</mat-label>
            <input matInput type="date" formControlName="fechaHasta" />
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" [disabled]="cargando()">
            <mat-icon>calculate</mat-icon>
            {{ cargando() ? 'Calculando…' : 'Analizar costos' }}
          </button>
        </form>

        @if (form.controls.metodo.value === 'LIFO') {
          <div class="method-warning" role="note">
            <mat-icon aria-hidden="true">info</mat-icon>
            <p>
              <strong>LIFO es una simulación.</strong> No se presenta como método válido para
              reportes bajo NIIF.
            </p>
          </div>
        }
      </section>

      @if (cargando()) {
        <section class="loading-surface surface-card" aria-live="polite">
          <div>
            <h3>Reconstruyendo capas de costo</h3>
            <p>Ordenamos el kardex y valorizamos cada movimiento del periodo.</p>
          </div>
          <mat-progress-bar mode="indeterminate" />
        </section>
      }

      @if (error()) {
        <section class="error-surface surface-card" role="alert">
          <mat-icon aria-hidden="true">error</mat-icon>
          <div>
            <h3>No pudimos completar el análisis</h3>
            <p>{{ error() }}</p>
          </div>
          <button mat-button type="button" (click)="recalcular()">Reintentar</button>
        </section>
      }

      @if (!cargando() && consultado() && resultado().rows.length === 0 && !error()) {
        <section class="empty-surface surface-card">
          <mat-icon aria-hidden="true">inventory_2</mat-icon>
          <div>
            <h3>No hay movimientos para este corte</h3>
            <p>
              Amplía el periodo o selecciona otro producto. El reporte solo incluye datos
              respaldados por kardex.
            </p>
          </div>
        </section>
      }

      @if (resultado().rows.length > 0) {
        <section class="value-reconciliation surface-card" aria-labelledby="reconciliation-title">
          <header class="reconciliation-heading">
            <div>
              <h3 id="reconciliation-title">Movimiento del valor</h3>
              <p>{{ descripcionCorte() }}</p>
            </div>
            <span class="reconciliation-status" [class.needs-review]="!conciliacionExacta()">
              <mat-icon>{{ conciliacionExacta() ? 'verified' : 'warning' }}</mat-icon>
              {{ conciliacionExacta() ? 'Valor conciliado' : 'Revisar diferencia' }}
            </span>
          </header>

          <div
            class="balance-flow"
            role="group"
            aria-label="Ecuación de conciliación del inventario"
          >
            <div class="balance-step">
              <span>Inventario inicial</span>
              <strong>{{ moneda(resultado().valorInicialInventario) }}</strong>
            </div>
            <span class="balance-operator" aria-hidden="true">+</span>
            <div class="balance-step positive">
              <span>Entradas valorizadas</span>
              <strong>{{ moneda(resultado().valorEntradasTotal) }}</strong>
            </div>
            <span class="balance-operator" aria-hidden="true">−</span>
            <div class="balance-step negative">
              <span>Costo de salidas</span>
              <strong>{{ moneda(resultado().costoSalidasTotal) }}</strong>
            </div>
            <span class="balance-operator" aria-hidden="true">=</span>
            <div class="balance-step closing">
              <span>Inventario final</span>
              <strong>{{ moneda(resultado().valorTotalInventario) }}</strong>
            </div>
          </div>

          <footer class="reconciliation-foot">
            <span>Diferencia de conciliación</span>
            <strong [class.has-difference]="!conciliacionExacta()">{{
              moneda(resultado().diferenciaConciliacion)
            }}</strong>
          </footer>
        </section>

        <section class="reading-strip surface-card" aria-label="Lectura del análisis">
          <div class="reading-item">
            <mat-icon aria-hidden="true">point_of_sale</mat-icon>
            <div>
              <span>Costo asociado a ventas</span>
              <strong>{{ moneda(resultado().cogsTotal) }}</strong>
              <small>Solo salidas por venta y consumo de recetas.</small>
            </div>
          </div>
          <div class="reading-item">
            <mat-icon aria-hidden="true">fact_check</mat-icon>
            <div>
              <span>Productos conciliados</span>
              <strong>{{ productosConciliados() }} de {{ resultado().rows.length }}</strong>
              <small>{{ resultado().productosRevisar }} requieren revisar kardex o stock.</small>
            </div>
          </div>
          <div class="reading-item">
            <mat-icon aria-hidden="true">functions</mat-icon>
            <div>
              <span>Método aplicado</span>
              <strong>{{ etiquetaMetodo(filtrosAplicados().metodo) }}</strong>
              <small>{{ descripcionMetodo(filtrosAplicados().metodo) }}</small>
            </div>
          </div>
        </section>

        @if (!resultado().esCorteActual) {
          <p class="historical-note">
            <mat-icon aria-hidden="true">history</mat-icon>
            En cortes históricos no se compara contra el stock actual, porque ese saldo pertenece a
            otra fecha.
          </p>
        }

        <section class="products-analysis surface-card">
          <div class="section-heading">
            <div>
              <h3>Detalle por producto</h3>
              <p>Cantidades y valores reconstruidos con el mismo método en todo el periodo.</p>
            </div>
          </div>

          <app-data-table-frame
            tableModule="inventario"
            tableId="costos"
            searchPlaceholder="Buscar por producto o SKU"
            [total]="rowsFiltradas().length"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            (searchChange)="actualizarBusqueda($event)"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="rowsPaginadas()">
              <ng-container matColumnDef="producto">
                <th mat-header-cell *matHeaderCellDef>Producto</th>
                <td mat-cell *matCellDef="let row">
                  <span class="product-name">{{ row.producto }}</span>
                  <span class="product-sku">{{ row.sku }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="apertura">
                <th mat-header-cell *matHeaderCellDef>Apertura</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.saldoInicial | number: '1.0-4' }} u.</strong>
                  <span>{{ moneda(row.valorInicial) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="entradas">
                <th mat-header-cell *matHeaderCellDef>Entradas</th>
                <td mat-cell *matCellDef="let row">
                  <strong>+{{ row.entradas | number: '1.0-4' }} u.</strong>
                  <span>{{ moneda(row.valorEntradas) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="salidas">
                <th mat-header-cell *matHeaderCellDef>Salidas</th>
                <td mat-cell *matCellDef="let row">
                  <strong>−{{ row.salidas | number: '1.0-4' }} u.</strong>
                  <span>{{ moneda(row.costoSalidas) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="cierre">
                <th mat-header-cell *matHeaderCellDef>Cierre valorizado</th>
                <td mat-cell *matCellDef="let row">
                  <strong
                    >{{ row.saldoFinal | number: '1.0-4' }} u. ·
                    {{ moneda(row.valorTotal) }}</strong
                  >
                  <span>{{ moneda(row.costoPromedio, 4) }} por unidad</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="costoVentas">
                <th mat-header-cell *matHeaderCellDef>Costo de ventas</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ moneda(row.costoVentas) }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Verificación</th>
                <td mat-cell *matCellDef="let row">
                  <span
                    class="status-pill"
                    [class.review]="row.estado === 'REVISAR'"
                    [matTooltip]="mensajeRevision(row)"
                    [attr.aria-label]="mensajeRevision(row)"
                  >
                    <mat-icon>{{
                      row.estado === 'CONCILIADO' ? 'check_circle' : 'warning'
                    }}</mat-icon>
                    {{ row.estado === 'CONCILIADO' ? 'Conciliado' : 'Revisar' }}
                  </span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </app-data-table-frame>
        </section>

        <details class="methodology surface-card">
          <summary>
            <span>Cómo se calcula este reporte</span>
            <mat-icon aria-hidden="true">expand_more</mat-icon>
          </summary>
          <div class="methodology-content">
            <p><strong>Apertura:</strong> movimientos anteriores a la fecha inicial.</p>
            <p><strong>Entradas:</strong> compras, producción, devoluciones y ajustes positivos.</p>
            <p><strong>Salidas:</strong> ventas, consumos, devoluciones y ajustes negativos.</p>
            <p>
              <strong>Traslados:</strong> se excluyen del consolidado porque no cambian el valor
              total de la empresa.
            </p>
          </div>
        </details>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .cost-analysis-page {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }
      .analysis-header,
      .analysis-controls,
      .value-reconciliation,
      .products-analysis,
      .loading-surface,
      .error-surface,
      .empty-surface,
      .reading-strip,
      .methodology {
        background: var(--tc-surface-container-lowest);
      }
      .analysis-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 1.4rem 1.5rem;
        background: var(--tc-primary-container);
        color: var(--tc-on-primary-container);
      }
      .header-copy {
        min-width: 0;
      }
      .header-copy h2 {
        margin: 0;
        font-size: clamp(1.55rem, 2.6vw, 2.1rem);
        letter-spacing: -0.025em;
      }
      .header-copy p {
        max-width: 68ch;
        margin: 0.5rem 0 0;
        color: color-mix(in srgb, var(--tc-on-primary-container) 82%, transparent);
      }
      .header-actions {
        flex: 0 0 auto;
      }
      .header-actions button {
        min-height: 44px;
        background: var(--tc-surface-container-lowest);
      }
      .analysis-controls {
        padding: 1.1rem 1.25rem 1.25rem;
      }
      .controls-heading,
      .reconciliation-heading,
      .section-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .controls-heading h3,
      .reconciliation-heading h3,
      .section-heading h3,
      .loading-surface h3,
      .error-surface h3,
      .empty-surface h3 {
        margin: 0;
        font-size: 1.08rem;
      }
      .controls-heading p,
      .reconciliation-heading p,
      .section-heading p,
      .loading-surface p,
      .error-surface p,
      .empty-surface p {
        margin: 0.3rem 0 0;
        color: var(--tc-on-surface-variant);
      }
      .method-chip,
      .reconciliation-status,
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 32px;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        white-space: nowrap;
        font-size: 0.78rem;
        font-weight: 750;
      }
      .method-chip {
        color: var(--tc-on-primary-container);
        background: var(--tc-primary-container);
      }
      .filters-grid {
        display: grid;
        grid-template-columns: minmax(180px, 1.4fr) minmax(180px, 1fr) minmax(145px, 0.75fr) minmax(
            145px,
            0.75fr
          ) auto;
        gap: 0.75rem;
        align-items: center;
      }
      .filters-grid button {
        min-height: 48px;
      }
      .method-warning {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        margin-top: 0.75rem;
        padding: 0.8rem 1rem;
        border-radius: 12px;
        color: var(--tc-on-warning-container);
        background: var(--tc-warning-container);
      }
      .method-warning mat-icon {
        flex: 0 0 auto;
      }
      .method-warning p {
        margin: 0;
      }
      .loading-surface {
        display: grid;
        gap: 0.9rem;
        padding: 1.15rem 1.25rem;
      }
      .error-surface,
      .empty-surface {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 1.1rem 1.25rem;
      }
      .error-surface {
        color: var(--tc-on-error-container);
        background: var(--tc-error-container);
      }
      .error-surface > mat-icon,
      .empty-surface > mat-icon {
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        font-size: 28px;
      }
      .error-surface button {
        margin-inline-start: auto;
      }
      .value-reconciliation {
        padding: 1.25rem;
        overflow: hidden;
      }
      .reconciliation-status {
        color: var(--tc-on-primary-container);
        background: var(--tc-primary-container);
      }
      .reconciliation-status.needs-review {
        color: var(--tc-on-warning-container);
        background: var(--tc-warning-container);
      }
      .reconciliation-status mat-icon,
      .status-pill mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }
      .balance-flow {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto 1fr auto 1.15fr;
        align-items: stretch;
        gap: 0.55rem;
      }
      .balance-step {
        display: grid;
        align-content: center;
        gap: 0.45rem;
        min-width: 0;
        padding: 1rem;
        border-radius: 14px;
        background: var(--tc-surface-container-low);
      }
      .balance-step span {
        color: var(--tc-on-surface-variant);
        font-size: 0.82rem;
        font-weight: 650;
      }
      .balance-step strong {
        overflow-wrap: anywhere;
        font-size: clamp(1.15rem, 2vw, 1.55rem);
        letter-spacing: -0.02em;
      }
      .balance-step.positive {
        background: var(--tc-primary-container);
        color: var(--tc-on-primary-container);
      }
      .balance-step.positive span {
        color: color-mix(in srgb, var(--tc-on-primary-container) 78%, transparent);
      }
      .balance-step.negative {
        background: var(--tc-warning-container);
        color: var(--tc-on-warning-container);
      }
      .balance-step.negative span {
        color: color-mix(in srgb, var(--tc-on-warning-container) 78%, transparent);
      }
      .balance-step.closing {
        color: var(--tc-on-tertiary-container);
        background: var(--tc-tertiary-container);
      }
      .balance-step.closing span {
        color: color-mix(in srgb, var(--tc-on-tertiary-container) 78%, transparent);
      }
      .balance-operator {
        display: grid;
        place-items: center;
        color: var(--tc-on-surface-variant);
        font-size: 1.25rem;
        font-weight: 800;
      }
      .reconciliation-foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.8rem;
        color: var(--tc-on-surface-variant);
        font-size: 0.85rem;
      }
      .reconciliation-foot strong {
        color: var(--tc-on-surface);
      }
      .reconciliation-foot strong.has-difference {
        color: var(--tc-error);
      }
      .reading-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 0.35rem;
      }
      .reading-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.75rem;
        padding: 0.9rem 1rem;
      }
      .reading-item + .reading-item {
        border-inline-start: 1px solid var(--tc-ghost-border);
      }
      .reading-item > mat-icon {
        color: var(--primary);
      }
      .reading-item div {
        display: grid;
        gap: 0.16rem;
        min-width: 0;
      }
      .reading-item span {
        color: var(--tc-on-surface-variant);
        font-size: 0.78rem;
        font-weight: 650;
      }
      .reading-item strong {
        font-size: 1rem;
        overflow-wrap: anywhere;
      }
      .reading-item small {
        color: var(--tc-on-surface-variant);
        line-height: 1.35;
      }
      .historical-note {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.2rem 0.25rem;
        color: var(--tc-on-surface-variant);
        font-size: 0.84rem;
      }
      .historical-note mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
      .products-analysis {
        min-width: 0;
        padding: 1.15rem 1.25rem;
      }
      table {
        width: 100%;
        min-width: 1120px;
      }
      td.mat-column-producto,
      td.mat-column-apertura,
      td.mat-column-entradas,
      td.mat-column-salidas,
      td.mat-column-cierre {
        vertical-align: middle;
      }
      td.mat-column-producto,
      td.mat-column-apertura,
      td.mat-column-entradas,
      td.mat-column-salidas,
      td.mat-column-cierre {
        line-height: 1.25;
      }
      td.mat-column-producto span,
      td.mat-column-apertura span,
      td.mat-column-entradas span,
      td.mat-column-salidas span,
      td.mat-column-cierre span {
        display: block;
        margin-top: 0.2rem;
        color: var(--tc-on-surface-variant);
        font-size: 0.78rem;
      }
      .product-name {
        color: var(--tc-on-surface) !important;
        font-size: 0.88rem !important;
        font-weight: 750;
      }
      .product-sku {
        overflow-wrap: anywhere;
      }
      .status-pill {
        color: var(--tc-on-primary-container);
        background: var(--tc-primary-container);
      }
      .status-pill.review {
        color: var(--tc-on-warning-container);
        background: var(--tc-warning-container);
      }
      .methodology {
        padding: 0.2rem 1.1rem;
      }
      .methodology summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 52px;
        cursor: pointer;
        font-weight: 750;
      }
      .methodology summary::-webkit-details-marker {
        display: none;
      }
      .methodology[open] summary mat-icon {
        transform: rotate(180deg);
      }
      .methodology-content {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem 1.2rem;
        padding: 0 0 1rem;
        color: var(--tc-on-surface-variant);
      }
      .methodology-content p {
        margin: 0;
      }
      @media (max-width: 1100px) {
        .filters-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .filters-grid button {
          width: 100%;
        }
      }
      @media (max-width: 900px) {
        .balance-flow {
          grid-template-columns: 1fr;
          gap: 0.35rem;
        }
        .balance-operator {
          min-height: 22px;
        }
      }
      @media (max-width: 767px) {
        .analysis-header {
          align-items: stretch;
          padding: 1rem;
          flex-direction: column;
        }
        .header-actions,
        .header-actions button {
          width: 100%;
        }
        .analysis-controls,
        .value-reconciliation,
        .products-analysis {
          padding: 0.9rem;
        }
        .controls-heading,
        .reconciliation-heading,
        .section-heading {
          align-items: stretch;
          flex-direction: column;
        }
        .method-chip,
        .reconciliation-status {
          align-self: flex-start;
        }
        .filters-grid {
          grid-template-columns: 1fr;
        }
        .reading-strip {
          grid-template-columns: 1fr;
        }
        .reading-item + .reading-item {
          border-inline-start: 0;
          border-top: 1px solid var(--tc-ghost-border);
        }
        .reconciliation-foot {
          justify-content: space-between;
        }
        .error-surface,
        .empty-surface {
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .error-surface button {
          width: 100%;
          margin-inline-start: 0;
        }
        .methodology-content {
          grid-template-columns: 1fr;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .methodology summary mat-icon {
          transition: none;
        }
      }
    `,
  ],
})
export class CostosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly configService = inject(ConfiguracionInventarioService);
  private readonly costosService = inject(CostosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = [
    'producto',
    'apertura',
    'entradas',
    'salidas',
    'cierre',
    'costoVentas',
    'estado',
  ];
  protected readonly productos = signal<Producto[]>([]);
  protected readonly resultado = signal<CostoAnalisisResultado>(this.resultadoVacio());
  protected readonly filtrosAplicados = signal<CostoAnalisisFiltros>({ metodo: 'PROMEDIO' });
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly cargando = signal(false);
  protected readonly consultado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly simboloMoneda = signal('$');

  protected readonly rowsFiltradas = computed(() => {
    const query = this.normalizar(this.busqueda());
    if (!query) return this.resultado().rows;
    return this.resultado().rows.filter((row) =>
      this.normalizar(`${row.producto} ${row.sku}`).includes(query),
    );
  });
  protected readonly rowsPaginadas = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.rowsFiltradas().slice(start, start + this.pageSize());
  });
  protected readonly productosConciliados = computed(
    () => this.resultado().rows.length - this.resultado().productosRevisar,
  );
  protected readonly conciliacionExacta = computed(
    () => Math.abs(this.resultado().diferenciaConciliacion) <= 0.01,
  );

  protected readonly form = this.fb.nonNullable.group({
    productoId: [''],
    metodo: ['PROMEDIO' as MetodoCosteo, [Validators.required]],
    fechaDesde: [this.primerDiaMes()],
    fechaHasta: [this.fechaInput(new Date())],
  });

  ngOnInit(): void {
    void this.inicializar();
  }

  protected async recalcular(): Promise<void> {
    if (this.cargando()) return;

    const raw = this.form.getRawValue();
    const filtros: CostoAnalisisFiltros = {
      metodo: raw.metodo,
      productoId: raw.productoId || undefined,
      fechaDesde: this.inicioDia(raw.fechaDesde),
      fechaHasta: this.finDia(raw.fechaHasta),
    };

    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      this.error.set(
        'La fecha inicial no puede ser posterior a la fecha final. Corrige el rango y vuelve a analizar.',
      );
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      const resultado = await this.costosService.calcularAnalisisCostos(filtros);
      this.resultado.set(resultado);
      this.filtrosAplicados.set(filtros);
      this.pageIndex.set(0);
      this.consultado.set(true);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible calcular los costos. Intenta nuevamente.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  protected actualizarBusqueda(value: string): void {
    this.busqueda.set(value);
    this.pageIndex.set(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected etiquetaMetodo(metodo: MetodoCosteo): string {
    if (metodo === 'FIFO') return 'FIFO';
    if (metodo === 'LIFO') return 'LIFO · simulación';
    return 'Promedio móvil';
  }

  protected descripcionMetodo(metodo: MetodoCosteo): string {
    if (metodo === 'FIFO') return 'Las primeras unidades recibidas son las primeras en salir.';
    if (metodo === 'LIFO') return 'Escenario comparativo; no se recomienda para reportes NIIF.';
    return 'El costo se recalcula cada vez que ingresa inventario.';
  }

  protected descripcionCorte(): string {
    const filtros = this.filtrosAplicados();
    const desde = filtros.fechaDesde
      ? this.fechaLegible(filtros.fechaDesde)
      : 'el inicio del kardex';
    const hasta = filtros.fechaHasta ? this.fechaLegible(filtros.fechaHasta) : 'hoy';
    return `Del ${desde} al ${hasta}, usando ${this.etiquetaMetodo(filtros.metodo)}.`;
  }

  protected moneda(value: number, decimales = 2): string {
    return `${this.simboloMoneda()}${new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(Number(value || 0))}`;
  }

  protected mensajeRevision(row: CostoAnalisisRow): string {
    if (row.estado === 'CONCILIADO')
      return 'El valor y el saldo coinciden con los datos disponibles.';
    const problemas: string[] = [];
    if (row.cantidadSinCosto > 0)
      problemas.push(`${row.cantidadSinCosto} unidades salieron sin costo disponible`);
    if (row.diferenciaStock !== null && Math.abs(row.diferenciaStock) > 0.000001) {
      problemas.push(`diferencia de stock: ${row.diferenciaStock}`);
    }
    if (Math.abs(row.diferenciaConciliacion) > 0.01) {
      problemas.push(`diferencia de valor: ${this.moneda(row.diferenciaConciliacion)}`);
    }
    return problemas.join(' · ') || 'Revisa los movimientos de este producto.';
  }

  protected async descargarResumen(): Promise<void> {
    const filtros = this.filtrosAplicados();
    await this.generarPdf(
      nombreReporteCostos('costos-resumen', filtros),
      () => crearPdfResumenCostos(this.resultado(), filtros, this.simboloMoneda()),
      'Resumen de costos descargado.',
    );
  }

  protected async descargarDetalle(): Promise<void> {
    const filtros = this.filtrosAplicados();
    await this.generarPdf(
      nombreReporteCostos('costos-movimientos', filtros),
      () =>
        crearPdfMovimientosCostos(
          this.resultado().movimientos,
          filtros,
          this.resultado().generadoEn,
          this.simboloMoneda(),
        ),
      'Detalle valorizado descargado.',
    );
  }

  private async inicializar(): Promise<void> {
    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => this.productos.set(productos));

    try {
      const config = await this.configService.getConfiguracionOnce();
      this.simboloMoneda.set(config.simboloMoneda || '$');
      this.form.controls.metodo.setValue(config.metodoCosteoDefecto || 'PROMEDIO');
      await this.recalcular();
    } catch (error) {
      this.consultado.set(true);
      this.error.set(
        error instanceof Error ? error.message : 'No fue posible preparar el análisis de costos.',
      );
    }
  }

  private async generarPdf(
    nombre: string,
    crear: () => Promise<Blob>,
    mensaje: string,
  ): Promise<void> {
    try {
      const blob = await crear();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      URL.revokeObjectURL(url);
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: mensaje, icon: 'download_done' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top',
      });
    } catch {
      this.error.set('No fue posible generar el PDF. Intenta nuevamente.');
    }
  }

  private inicioDia(value: string): number | undefined {
    if (!value) return undefined;
    const fecha = new Date(`${value}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.getTime();
  }

  private finDia(value: string): number | undefined {
    if (!value) return undefined;
    const fecha = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.getTime();
  }

  private primerDiaMes(): string {
    const fecha = new Date();
    fecha.setDate(1);
    return this.fechaInput(fecha);
  }

  private fechaInput(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fechaLegible(value: number): string {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(value));
  }

  private normalizar(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private resultadoVacio(): CostoAnalisisResultado {
    return {
      rows: [],
      movimientos: [],
      valorInicialInventario: 0,
      valorEntradasTotal: 0,
      costoSalidasTotal: 0,
      valorTotalInventario: 0,
      cogsTotal: 0,
      diferenciaConciliacion: 0,
      productosRevisar: 0,
      esCorteActual: true,
      generadoEn: 0,
    };
  }
}

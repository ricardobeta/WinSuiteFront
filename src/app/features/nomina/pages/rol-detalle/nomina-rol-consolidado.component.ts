import { CommonModule } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RolPagoDetalle } from '../../../contabilidad/models/nomina.models';
import { TasasIess } from '../../../contabilidad/services/nomina-calculos.util';
import {
  GrupoConsolidado,
  GrupoConsolidadoId,
  construirMatrizRolConsolidado,
  sumarFilasConsolidadas
} from './rol-consolidado.util';

/**
 * THESIS: una hoja contable navegable que vuelve comparables a todos los empleados sin ocultar el detalle.
 * OWN-WORLD: superficies Tactile Clarity, bandas tonales por grupo, cifras tabulares y bordes fantasma.
 * STORY: localizar un empleado, contrastar rubros, comprobar subtotales y detectar excepciones antes de exportar.
 * FIRST VIEWPORT: filtros compactos arriba; matriz de dos cabeceras con identidad fija a la izquierda y neto al final.
 * FORM: extensión operativa del detalle existente; tabla semántica densa, plegable y desplazable.
 */
@Component({
  selector: 'app-nomina-rol-consolidado',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule
  ],
  template: `
    <section class="consolidado" aria-labelledby="consolidado-title">
      <header class="consolidado-head">
        <div>
          <h3 id="consolidado-title">Matriz consolidada</h3>
          <p>Compara rubros por empleado. Los aportes patronales y las provisiones no reducen el neto.</p>
        </div>
        <span class="row-count" aria-live="polite">
          {{ filasVisibles().length }} de {{ matriz().filas.length }} empleados
        </span>
      </header>

      @if (matriz().filas.length === 0) {
        <div class="empty-state">
          <mat-icon>table_rows</mat-icon>
          <h4>Este rol no tiene empleados</h4>
          <p>No hay información consolidada para mostrar.</p>
        </div>
      } @else {
        <div class="toolbar" role="search">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
            <mat-label>Buscar empleado o cargo</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
            @if (busqueda()) {
              <button mat-icon-button matSuffix type="button" (click)="busqueda.set('')" aria-label="Limpiar búsqueda">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>

          @if (departamentos().length > 1) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="department-field">
              <mat-label>Departamento</mat-label>
              <mat-select [ngModel]="departamento()" (ngModelChange)="departamento.set($event)">
                <mat-option value="">Todos</mat-option>
                @for (item of departamentos(); track item) {
                  <mat-option [value]="item">{{ item }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <div class="group-guide" aria-label="Grupos de columnas">
            @for (grupo of matriz().grupos; track grupo.id) {
              @if (grupo.plegable) {
                <button
                  mat-button
                  type="button"
                  class="group-chip"
                  [attr.data-grupo]="grupo.id"
                  [attr.aria-expanded]="!estaPlegado(grupo.id)"
                  (click)="alternarGrupo(grupo.id)"
                  [matTooltip]="estaPlegado(grupo.id) ? 'Mostrar rubros' : 'Mostrar solo el subtotal'"
                >
                  <mat-icon>{{ estaPlegado(grupo.id) ? 'unfold_more' : 'unfold_less' }}</mat-icon>
                  {{ grupo.etiqueta }}
                </button>
              }
            }
          </div>
        </div>

        @if (netosNegativosVisibles() > 0) {
          <div class="exceptions-note" role="status">
            <mat-icon aria-hidden="true">warning</mat-icon>
            <span>
              <strong>{{ netosNegativosVisibles() }} empleado(s) con neto negativo.</strong>
              Revisa sus descuentos en la vista Por empleado.
            </span>
          </div>
        }

        @if (filasVisibles().length === 0) {
          <div class="no-results" role="status">
            <mat-icon>person_search</mat-icon>
            <div>
              <strong>No encontramos empleados</strong>
              <span>Cambia la búsqueda o limpia el filtro de departamento.</span>
            </div>
            <button mat-button type="button" (click)="limpiarFiltros()">Limpiar filtros</button>
          </div>
        } @else {
          <div class="table-shell" tabindex="0" aria-label="Tabla consolidada del rol de pago">
            <table>
              <thead>
                <tr class="group-row">
                  <th class="employee-head" scope="col" rowspan="2">
                    <span>Empleado</span>
                    <small>Cargo y departamento</small>
                  </th>
                  @for (grupo of gruposVisibles(); track grupo.id) {
                    <th
                      class="group-head"
                      [attr.data-grupo]="grupo.id"
                      [attr.colspan]="grupo.columnas.length"
                      scope="colgroup"
                    >
                      @if (grupo.plegable) {
                        <button
                          type="button"
                          [attr.aria-expanded]="!estaPlegado(grupo.id)"
                          (click)="alternarGrupo(grupo.id)"
                        >
                          {{ grupo.etiqueta }}
                          <mat-icon>{{ estaPlegado(grupo.id) ? 'unfold_more' : 'unfold_less' }}</mat-icon>
                        </button>
                      } @else {
                        <span>{{ grupo.etiqueta }}</span>
                      }
                    </th>
                  }
                </tr>
                <tr class="column-row">
                  @for (grupo of gruposVisibles(); track grupo.id) {
                    @for (columna of grupo.columnas; track columna.clave) {
                      <th
                        scope="col"
                        class="number-head"
                        [class.summary-column]="columna.resumen"
                        [attr.data-grupo]="grupo.id"
                      >{{ columna.etiqueta }}</th>
                    }
                  }
                </tr>
              </thead>
              <tbody>
                @for (fila of filasVisibles(); track fila.id) {
                  <tr [class.negative-row]="fila.netoNegativo">
                    <th class="employee-cell" scope="row">
                      <strong>{{ fila.empleadoNombre }}</strong>
                      <span>{{ fila.cargo || 'Sin cargo' }}</span>
                      @if (fila.departamento) { <small>{{ fila.departamento }}</small> }
                      @if (fila.netoNegativo) {
                        <span class="negative-flag"><mat-icon aria-hidden="true">warning</mat-icon> Neto negativo</span>
                      }
                    </th>
                    @for (grupo of gruposVisibles(); track grupo.id) {
                      @for (columna of grupo.columnas; track columna.clave) {
                        <td
                          class="number-cell"
                          [class.summary-column]="columna.resumen"
                          [class.negative]="fila.valores[columna.clave] < 0"
                          [attr.data-grupo]="grupo.id"
                        >
                          @if (fila.valores[columna.clave]) {
                            {{ fila.valores[columna.clave] | currency:'USD':'symbol-narrow':'1.2-2' }}
                          } @else {
                            <span class="zero" aria-label="Cero">—</span>
                          }
                        </td>
                      }
                    }
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th class="employee-cell total-label" scope="row">
                    {{ hayFiltros() ? 'Total visible' : 'Total del rol' }}
                    <small>{{ filasVisibles().length }} empleado(s)</small>
                  </th>
                  @for (grupo of gruposVisibles(); track grupo.id) {
                    @for (columna of grupo.columnas; track columna.clave) {
                      <td
                        class="number-cell summary-column"
                        [class.negative]="totalesVisibles()[columna.clave] < 0"
                        [attr.data-grupo]="grupo.id"
                      >
                        {{ totalesVisibles()[columna.clave] | currency:'USD':'symbol-narrow':'1.2-2' }}
                      </td>
                    }
                  }
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="scroll-hint"><mat-icon>swipe</mat-icon> Desplázate horizontalmente para revisar todos los rubros.</p>
        }
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; --consolidado-muted: color-mix(in srgb, var(--tc-on-surface) 72%, transparent); }
    .consolidado { display: grid; gap: 1rem; }
    .consolidado-head { display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; }
    h3, h4, p { margin: 0; }
    h3 { font-family: var(--tc-font-family-heading); font-size: 1.15rem; letter-spacing: -.015em; }
    .consolidado-head p { margin-top: .3rem; color: var(--consolidado-muted); max-width: 72ch; }
    .row-count { padding: .45rem .75rem; border-radius: 999px; background: var(--tc-surface-container-highest); color: var(--tc-on-surface); font-weight: 700; font-size: .78rem; }
    .toolbar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; padding: .75rem; border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    .search-field { flex: 1 1 280px; }
    .department-field { flex: 0 1 220px; }
    .group-guide { display: flex; gap: .3rem; flex-wrap: wrap; margin-left: auto; }
    .group-chip { min-height: 44px; font-size: .78rem; }
    .group-chip mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }
    .table-shell { max-height: min(68vh, 720px); overflow: auto; border-radius: var(--tc-radius-md); background: var(--tc-surface-container-lowest); outline: 1px solid var(--tc-ghost-border); scrollbar-gutter: stable; }
    .table-shell:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
    table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: .79rem; font-variant-numeric: tabular-nums; }
    th, td { box-sizing: border-box; }
    thead th { position: sticky; z-index: 3; color: var(--tc-on-surface); }
    .group-row th { top: 0; height: 44px; }
    .column-row th { top: 44px; height: 52px; }
    .employee-head { left: 0; z-index: 6; width: 260px; min-width: 260px; padding: .7rem 1rem; text-align: left; background: var(--tc-surface-container-highest); box-shadow: 8px 0 18px -18px var(--tc-on-surface); }
    .employee-head span, .employee-head small { display: block; }
    .employee-head small { margin-top: .15rem; color: var(--consolidado-muted); font-weight: 500; }
    .group-head { padding: 0 .55rem; text-align: center; font-size: .75rem; letter-spacing: .025em; background: var(--tc-surface-container-low); }
    .group-head button { width: 100%; min-height: 44px; display: inline-flex; justify-content: center; align-items: center; gap: .35rem; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
    .group-head button:focus-visible { outline: 2px solid var(--primary); outline-offset: -4px; border-radius: var(--tc-radius-sm); }
    .group-head mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }
    .number-head { width: 132px; min-width: 132px; max-width: 160px; padding: .5rem .65rem; text-align: right; line-height: 1.2; background: var(--tc-surface-container-low); box-shadow: inset 0 -1px var(--tc-ghost-border); }
    .employee-cell { position: sticky; left: 0; z-index: 2; width: 260px; min-width: 260px; padding: .72rem 1rem; text-align: left; background: var(--tc-surface-container-lowest); box-shadow: 8px 0 18px -18px var(--tc-on-surface), inset 0 -1px var(--tc-ghost-border); }
    .employee-cell strong, .employee-cell span, .employee-cell small { display: block; }
    .employee-cell strong { font-size: .84rem; }
    .employee-cell span { margin-top: .15rem; color: var(--consolidado-muted); font-weight: 500; }
    .employee-cell small { margin-top: .1rem; color: var(--tc-tertiary); }
    .number-cell { height: 58px; padding: .65rem; text-align: right; white-space: nowrap; background: var(--tc-surface-container-lowest); box-shadow: inset 0 -1px var(--tc-ghost-border); }
    tbody tr:hover .number-cell, tbody tr:hover .employee-cell { background: color-mix(in srgb, var(--primary) 5%, var(--tc-surface-container-lowest)); }
    .summary-column { font-weight: 800; background: color-mix(in srgb, var(--tc-surface-container-low) 72%, var(--tc-surface-container-lowest)); }
    [data-grupo='INGRESOS'] { --group-tint: var(--tc-success-container); }
    [data-grupo='DESCUENTOS'] { --group-tint: var(--tc-warning-container); }
    [data-grupo='PROVISIONES'] { --group-tint: var(--tc-info-container); }
    [data-grupo='IESS'] { --group-tint: var(--tc-primary-container); }
    [data-grupo='RESUMEN'] { --group-tint: var(--tc-surface-container-highest); }
    .group-head[data-grupo], .number-head[data-grupo] { background: color-mix(in srgb, var(--group-tint) 38%, var(--tc-surface-container-lowest)); }
    .group-chip[data-grupo] { background: color-mix(in srgb, var(--group-tint) 48%, transparent); }
    .zero { color: var(--consolidado-muted); }
    .negative { color: var(--tc-error); font-weight: 800; }
    .employee-cell .negative-flag { display: inline-flex; align-items: center; gap: .2rem; margin-top: .3rem; color: var(--tc-error); font-size: .7rem; font-weight: 800; }
    .negative-flag mat-icon { width: .85rem; height: .85rem; font-size: .85rem; }
    tfoot th, tfoot td { position: sticky; bottom: 0; z-index: 4; background: var(--tc-surface-container-highest); box-shadow: inset 0 1px var(--tc-ghost-border); }
    tfoot .employee-cell { z-index: 5; }
    .total-label { font-family: var(--tc-font-family-heading); font-size: .86rem; }
    .total-label small { font-family: var(--tc-font-family-body); font-weight: 500; }
    .empty-state { min-height: 230px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--consolidado-muted); text-align: center; background: var(--tc-surface-container-low); border-radius: var(--tc-radius-lg); }
    .empty-state mat-icon { width: 36px; height: 36px; font-size: 36px; color: var(--primary); }
    .no-results { min-height: 96px; display: flex; align-items: center; gap: .8rem; padding: 1rem; border-radius: var(--tc-radius-md); background: var(--tc-surface-container-low); }
    .no-results > div { display: grid; gap: .15rem; flex: 1; }
    .no-results span { color: var(--consolidado-muted); }
    .exceptions-note { display: flex; align-items: center; gap: .55rem; padding: .7rem .85rem; border-radius: var(--tc-radius-md); background: var(--tc-error-container); color: var(--tc-on-error-container); }
    .exceptions-note mat-icon { flex: 0 0 auto; }
    .scroll-hint { display: flex; align-items: center; gap: .4rem; color: var(--consolidado-muted); font-size: .78rem; }
    .scroll-hint mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    @media (max-width: 900px) {
      .toolbar { align-items: stretch; }
      .search-field, .department-field { flex: 1 1 100%; }
      .group-guide { width: 100%; margin-left: 0; overflow-x: auto; flex-wrap: nowrap; }
      .employee-head, .employee-cell { width: 210px; min-width: 210px; }
      .number-head { width: 118px; min-width: 118px; }
    }
    @media (max-width: 480px) {
      .employee-head, .employee-cell { width: 168px; min-width: 168px; padding-inline: .7rem; }
      .employee-head small, .employee-cell > small { display: none; }
      .number-head { width: 108px; min-width: 108px; }
      .number-cell { padding-inline: .5rem; }
    }
  `]
})
export class NominaRolConsolidadoComponent {
  readonly detalles = input.required<readonly RolPagoDetalle[]>();
  readonly tasasIess = input.required<TasasIess>();

  protected readonly busqueda = signal('');
  protected readonly departamento = signal('');
  private readonly gruposPlegados = signal<ReadonlySet<GrupoConsolidadoId>>(new Set());

  protected readonly matriz = computed(() => construirMatrizRolConsolidado(this.detalles(), this.tasasIess()));
  protected readonly departamentos = computed(() => [...new Set(
    this.matriz().filas.map((fila) => fila.departamento).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b)));
  protected readonly hayFiltros = computed(() => !!this.busqueda().trim() || !!this.departamento());
  protected readonly filasVisibles = computed(() => {
    const termino = normalizar(this.busqueda());
    const departamento = this.departamento();
    return this.matriz().filas.filter((fila) => {
      const coincideDepartamento = !departamento || fila.departamento === departamento;
      const texto = normalizar(`${fila.empleadoNombre} ${fila.cargo}`);
      return coincideDepartamento && (!termino || texto.includes(termino));
    });
  });
  protected readonly gruposVisibles = computed<GrupoConsolidado[]>(() => this.matriz().grupos.map((grupo) => {
    if (!this.estaPlegado(grupo.id)) return grupo;
    return {
      ...grupo,
      columnas: grupo.columnas.filter((columna) => columna.clave === grupo.columnaResumenClave)
    };
  }));
  protected readonly totalesVisibles = computed(() => sumarFilasConsolidadas(
    this.filasVisibles(),
    this.gruposVisibles().flatMap((grupo) => grupo.columnas)
  ));
  protected readonly netosNegativosVisibles = computed(
    () => this.filasVisibles().filter((fila) => fila.netoNegativo).length
  );

  protected estaPlegado(grupo: GrupoConsolidadoId): boolean {
    return this.gruposPlegados().has(grupo);
  }

  protected alternarGrupo(grupo: GrupoConsolidadoId): void {
    this.gruposPlegados.update((actual) => {
      const siguiente = new Set(actual);
      siguiente.has(grupo) ? siguiente.delete(grupo) : siguiente.add(grupo);
      return siguiente;
    });
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.departamento.set('');
  }
}

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import {
  CuentaBancaria,
  MatchConciliacion,
  MovimientoBancario,
  PartidaConciliatoria,
  ResumenConciliacion
} from '../../models/bancos.models';
import { formatImporte, parseImporte } from '../../../../shared/utils/importe-input.util';
import { BancosApiService } from '../../services/bancos-api.service';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';
import { BancosMovimientosService } from '../../services/bancos-movimientos.service';
import { CrearAsientoBancoDialogComponent } from './crear-asiento-banco-dialog.component';

/** Tope por consulta a RTDB; se encadenan páginas con el cursor claveOrden. */
const TAMANO_PAGINA = 100;

@Component({
  selector: 'app-conciliacion-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDialogModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <section class="conc-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Conciliación bancaria</h2>
          <p class="support">
            Concilia el extracto contra tus libros: automático para coincidencias exactas,
            sugerencias de IA para el resto y conciliación manual cuando tú decides.
          </p>
        </div>
        <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos">
          <mat-icon>arrow_back</mat-icon>
          Cuentas
        </a>
      </header>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Cuenta bancaria</mat-label>
          <mat-select [formControl]="cuenta">
            @for (item of cuentas(); track item.id) {
              <mat-option [value]="item.id">{{ item.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Período</mat-label>
          <input matInput type="month" [formControl]="periodo" />
        </mat-form-field>

        <button mat-raised-button color="primary" class="search-button" type="button"
                (click)="cargar()" [disabled]="!cuenta.value || !periodo.value || cargando()">
          <mat-icon>search</mat-icon>
          Cargar período
        </button>

        <span class="spacer"></span>

        @if (canUpdate()) {
          <button mat-stroked-button color="primary" type="button"
                  matTooltip="Concilia matches exactos (monto + referencia / fecha)"
                  (click)="ejecutarAutomatica()" [disabled]="!consultaRealizada() || procesando()">
            <mat-icon>bolt</mat-icon>
            Conciliar automático
          </button>
          <button mat-stroked-button color="primary" type="button" class="ia-btn"
                  matTooltip="La IA sugiere matches y clasificaciones para lo pendiente"
                  (click)="pedirSugerencias()" [disabled]="!consultaRealizada() || procesando()">
            <mat-icon>auto_awesome</mat-icon>
            Sugerencias IA
          </button>
        }
        @if (canUpdate()) {
          <button mat-stroked-button type="button" (click)="recalcular()"
                  [disabled]="!consultaRealizada() || procesando()"
                  matTooltip="Rehace saldos y totales del período desde los movimientos, tras corregir datos">
            <mat-icon>calculate</mat-icon>
            Recalcular
          </button>
        }
        <button mat-stroked-button type="button" (click)="descargarPdf()"
                [disabled]="!consultaRealizada() || procesando()">
          <mat-icon>picture_as_pdf</mat-icon>
          PDF
        </button>
      </section>

      @if (procesando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (resumen(); as datos) {
        <section class="kpi-row">
          <article class="kpi-card metric-hero">
            <p class="kpi-label">Saldo extracto</p>
            <p class="kpi-value">{{ datos.saldoExtracto != null ? (datos.saldoExtracto | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}</p>
            @if (datos.saldoExtractoOrigen === 'CONFIRMADO') {
              <span class="kpi-sub">Confirmado al importar</span>
            } @else if (datos.saldoExtractoOrigen === 'MOVIMIENTOS') {
              <span class="kpi-sub">Deducido de los movimientos</span>
            }
          </article>
          <article class="kpi-card surface-card">
            <p class="kpi-label">Saldo libros</p>
            <p class="kpi-value">{{ datos.saldoLibros | currency: 'USD':'symbol-narrow':'1.2-2' }}</p>
          </article>
          <article class="kpi-card surface-card" [class.alerta]="(datos.diferencia ?? 0) !== 0">
            <p class="kpi-label">Diferencia</p>
            <p class="kpi-value">{{ datos.diferencia != null ? (datos.diferencia | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}</p>
          </article>
          <article class="kpi-card surface-card" [class.ok]="(datos.diferenciaResidual ?? 1) === 0">
            <p class="kpi-label">Diferencia residual</p>
            <p class="kpi-value">{{ datos.diferenciaResidual != null ? (datos.diferenciaResidual | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}</p>
          </article>
        </section>

        @if (datos.descuadreExtracto && (datos.descuadreExtracto > 0.01 || datos.descuadreExtracto < -0.01)) {
          <section class="surface-card aviso-extracto">
            <mat-icon>warning</mat-icon>
            <div>
              <strong>El extracto no cuadra consigo mismo.</strong>
              Saldo inicial {{ datos.saldoInicialExtracto | currency: 'USD':'symbol-narrow':'1.2-2' }}
              más movimientos {{ datos.movimientosExtracto | currency: 'USD':'symbol-narrow':'1.2-2' }}
              no llega al saldo final {{ datos.saldoExtracto | currency: 'USD':'symbol-narrow':'1.2-2' }}
              (faltan {{ datos.descuadreExtracto | currency: 'USD':'symbol-narrow':'1.2-2' }}).
              Es probable que el archivo importado esté incompleto: revísalo antes de conciliar.
            </div>
          </section>
        }

        @if (conflictoSaldo(); as conflicto) {
          <section class="surface-card aviso-extracto">
            <mat-icon>report_problem</mat-icon>
            <div>
              <strong>El saldo confirmado no coincide con los movimientos.</strong>
              El corte guardado del período es {{ datos.saldoExtracto | currency: 'USD':'symbol-narrow':'1.2-2' }}
              y los movimientos importados encadenan hasta
              {{ datos.saldoExtractoMovimientos | currency: 'USD':'symbol-narrow':'1.2-2' }}
              ({{ conflicto | currency: 'USD':'symbol-narrow':'1.2-2' }} de diferencia).
              Manda el confirmado; si el bueno es el otro, corrígelo aquí abajo.
            </div>
          </section>
        }

        @if (canUpdate()) {
          <section class="surface-card saldos-card">
            <div class="saldos-header">
              <h3><mat-icon>account_balance</mat-icon> Saldos del extracto</h3>
              <button mat-button type="button" (click)="editandoSaldos.set(!editandoSaldos())">
                {{ mostrarEditorSaldos() ? 'Ocultar' : 'Corregir saldos' }}
              </button>
            </div>
            @if (mostrarEditorSaldos()) {
              <p class="hint">
                Escríbelos tal como los da el banco: es el corte que usa la conciliación y el que
                sale en el reporte. Al guardar se recalculan los totales del período.
              </p>
              <div class="saldos-grid">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Saldo inicial</mat-label>
                  <input matInput type="text" inputmode="decimal"
                         [value]="saldoInicialTexto()"
                         (input)="saldoInicialTexto.set($any($event.target).value)" />
                </mat-form-field>
                <span class="operador">+</span>
                <div class="movimientos-suma">
                  <span class="etiqueta">Movimientos del período</span>
                  <strong>{{ movimientosDelPeriodo() | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong>
                </div>
                <span class="operador">=</span>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Saldo final</mat-label>
                  <input matInput type="text" inputmode="decimal"
                         [value]="saldoFinalTexto()"
                         (input)="saldoFinalTexto.set($any($event.target).value)" />
                </mat-form-field>
              </div>
              @if (descuadreEditor() !== null) {
                @if (descuadreEditor() === 0) {
                  <p class="cuadre ok"><mat-icon>check_circle</mat-icon> Cuadran con los movimientos del período.</p>
                } @else {
                  <p class="cuadre error">
                    <mat-icon>warning</mat-icon>
                    Diferencia de {{ descuadreEditor() | currency: 'USD':'symbol-narrow':'1.2-2' }}:
                    faltan movimientos del período o el corte no es el de estas fechas.
                  </p>
                }
              }
              <button mat-flat-button color="primary" type="button"
                      [disabled]="procesando() || !saldosEditados()"
                      (click)="guardarSaldos()">
                <mat-icon>save</mat-icon>
                Guardar saldos y recalcular
              </button>
            }
          </section>
        }

        <section class="surface-card explicacion-card">
          <div class="explicacion-header">
            <h3><mat-icon>psychology</mat-icon> Análisis del período</h3>
            <button mat-stroked-button color="primary" type="button"
                    (click)="explicar()" [disabled]="procesando()">
              <mat-icon>auto_awesome</mat-icon>
              {{ datos.explicacionIA ? 'Actualizar explicación' : 'Explicar descuadre con IA' }}
            </button>
          </div>
          @if (datos.explicacionIA) {
            <p class="explicacion">{{ datos.explicacionIA }}</p>
          } @else {
            <p class="hint">La IA puede explicarte en lenguaje claro qué causa la diferencia entre banco y libros.</p>
          }

          <div class="observaciones">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Observaciones del contador</mat-label>
              <textarea matInput rows="3" maxlength="4000"
                        [value]="observaciones()"
                        [disabled]="!canUpdate()"
                        (input)="observaciones.set($any($event.target).value)"
                        placeholder="Ej. La ND de $14.26 corresponde a comisiones de junio; el banco la reversa en julio."></textarea>
              <mat-hint>
                @if (datos.observacionesEn) {
                  Guardado el {{ datos.observacionesEn | date: 'dd/MM/yyyy HH:mm' }} · la IA las tiene en cuenta al explicar
                } @else {
                  Salen en el reporte y la IA las usa como contexto de su análisis
                }
              </mat-hint>
            </mat-form-field>
            @if (canUpdate()) {
              <button mat-stroked-button color="primary" type="button"
                      [disabled]="procesando() || !observacionesCambiadas()"
                      (click)="guardarObservaciones()">
                <mat-icon>save</mat-icon>
                Guardar observaciones
              </button>
            }
          </div>
        </section>
      }

      @if (sugeridos().length > 0) {
        <section class="surface-card sugerencias-card">
          <div class="sugerencias-header">
            <h3><mat-icon>auto_awesome</mat-icon> Sugerencias pendientes de revisión ({{ sugeridos().length }})</h3>
            @if (canUpdate()) {
              <button mat-stroked-button type="button" [disabled]="procesando()"
                      matTooltip="Descarta todas las sugerencias y deja los movimientos libres para conciliarlos a mano"
                      (click)="descartarSugerencias()">
                <mat-icon>back_hand</mat-icon>
                Descartar y conciliar a mano
              </button>
            }
          </div>
          <div class="sugerencias">
            @for (match of sugeridos(); track match.id) {
              <article class="sugerencia">
                <div class="sugerencia-info">
                  <div class="chips">
                    <span class="pill" [class]="origenClase(match.origen)">{{ origenLabel(match.origen) }}</span>
                    <span class="pill pill-muted">Confianza {{ match.confianza | percent:'1.0-0' }}</span>
                  </div>
                  <p class="detalle">{{ descripcionMatch(match) }}</p>
                  <p class="motivo">{{ match.motivo }}</p>
                </div>
                @if (canUpdate()) {
                  <div class="sugerencia-acciones">
                    <button mat-icon-button color="primary" matTooltip="Aceptar"
                            (click)="resolver(match, 'ACEPTAR')" [disabled]="procesando()">
                      <mat-icon>check_circle</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Rechazar"
                            (click)="resolver(match, 'RECHAZAR')" [disabled]="procesando()">
                      <mat-icon>cancel</mat-icon>
                    </button>
                  </div>
                }
              </article>
            }
          </div>
        </section>
      }

      @if (consultaRealizada()) {
        <section class="paneles">
          <section class="surface-card panel">
            <h3><mat-icon>account_balance</mat-icon> Extracto bancario · por conciliar ({{ movimientosPendientes().length }})</h3>

            <div class="panel-herramientas">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro">
                <mat-icon matPrefix>search</mat-icon>
                <mat-label>Filtrar por concepto o referencia</mat-label>
                <input matInput [value]="filtroExtracto()"
                       (input)="filtroExtracto.set($any($event.target).value)" />
              </mat-form-field>
              @if (canUpdate() && movimientosPendientes().length > 0) {
                <button mat-stroked-button type="button" (click)="seleccionarVisibles()"
                        matTooltip="Marca los {{ movimientosPendientes().length }} movimientos a la vista">
                  <mat-icon>done_all</mat-icon>
                  Seleccionar {{ movimientosPendientes().length }}
                </button>
              }
            </div>
            @if (filtroExtracto()) {
              <p class="hint">
                Suman <strong>{{ totalVisible() | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong> en
                {{ movimientosPendientes().length }} movimiento(s).
              </p>
            }

            @if (movimientosPendientes().length === 0) {
              <p class="hint">
                {{ filtroExtracto() ? 'Ningún movimiento coincide con el filtro.' : 'No hay movimientos por conciliar del extracto en este período.' }}
              </p>
            }
            @for (movimiento of movimientosPendientes(); track movimiento.id) {
              <label class="fila" [class.seleccionada]="seleccionMovimientos().has(movimiento.id!)">
                <mat-checkbox
                  [checked]="seleccionMovimientos().has(movimiento.id!)"
                  (change)="toggleMovimiento(movimiento.id!)"
                  [disabled]="!canUpdate()"
                />
                <div class="fila-info">
                  <span class="fila-titulo">
                    {{ movimiento.descripcion }}
                    @if (movimiento.estadoConciliacion === 'SUGERIDO') {
                      <span class="pill pill-ia">con sugerencia</span>
                    }
                  </span>
                  <span class="fila-sub">{{ movimiento.fecha }}@if (movimiento.referencia) { · Ref {{ movimiento.referencia }}}</span>
                </div>
                <span class="fila-monto" [class.neg]="movimiento.monto < 0">
                  {{ movimiento.monto | currency: 'USD':'symbol-narrow':'1.2-2' }}
                </span>
              </label>
            }

            @if (hayMasMovimientos()) {
              <div class="cargar-mas">
                <span class="hint">{{ movimientos().length }} movimientos cargados del período</span>
                <button mat-stroked-button color="primary" type="button"
                        [disabled]="cargandoMas()" (click)="cargarMasMovimientos()">
                  <mat-icon>expand_more</mat-icon>
                  {{ cargandoMas() ? 'Cargando…' : 'Cargar 100 más' }}
                </button>
              </div>
            }
          </section>

          <section class="surface-card panel">
            <h3><mat-icon>menu_book</mat-icon> Libros · sin reflejo en banco ({{ partidasLibros().length }})</h3>
            @if (partidasLibros().length === 0) {
              <p class="hint">No hay asientos ni pagos pendientes de conciliar en este período.</p>
            }
            @for (partida of partidasLibros(); track partidaKey(partida)) {
              <label class="fila" [class.seleccionada]="seleccionPartidas().has(partidaKey(partida))">
                <mat-checkbox
                  [checked]="seleccionPartidas().has(partidaKey(partida))"
                  (change)="togglePartida(partida)"
                  [disabled]="!canUpdate()"
                />
                <div class="fila-info">
                  <span class="fila-titulo">{{ partida.detalle }}</span>
                  <span class="fila-sub">{{ partida.fecha }} · {{ partida.tipo === 'PAGO_CXP' ? 'Pago proveedor' : 'Asiento' }}</span>
                </div>
                <span class="fila-monto" [class.neg]="partida.monto < 0">
                  {{ partida.monto | currency: 'USD':'symbol-narrow':'1.2-2' }}
                </span>
              </label>
            }
          </section>
        </section>

        @if (seleccionMovimientos().size > 0 || seleccionPartidas().size > 0) {
          <section class="surface-card barra-manual" [class.cuadra]="seleccionCuadra()">
            <div class="totales">
              <span>Extracto: <strong>{{ totalSeleccionMovimientos() | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong>
                ({{ seleccionMovimientos().size }})</span>
              <mat-icon>compare_arrows</mat-icon>
              <span>Libros: <strong>{{ totalSeleccionPartidas() | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong>
                ({{ seleccionPartidas().size }})</span>
              @if (!seleccionCuadra()) {
                <span class="pill pill-void">Diferencia {{ diferenciaSeleccion() | currency: 'USD':'symbol-narrow':'1.2-2' }}</span>
              } @else {
                <span class="pill pill-success">Cuadra</span>
              }
            </div>
            <div class="acciones">
              <button mat-button type="button" (click)="limpiarSeleccion()">Limpiar</button>
              <button mat-flat-button color="primary" type="button"
                      [disabled]="!seleccionCuadra() || procesando() || seleccionMovimientos().size === 0 || seleccionPartidas().size === 0"
                      (click)="conciliarSeleccion()">
                <mat-icon>join_inner</mat-icon>
                Conciliar selección
              </button>
            </div>
          </section>
        }
      } @else {
        <section class="surface-card empty-state">
          <mat-icon>fact_check</mat-icon>
          <h3>Selecciona cuenta y período</h3>
          <p>Carga el período para ver los movimientos pendientes y ejecutar la conciliación.</p>
        </section>
      }
    </section>
  `,
  styles: [`
    .conc-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .filters-card { padding: 1rem 1.25rem; display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .search-button { min-height: 56px; }
    .spacer { flex: 1; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .kpi-card { padding: 1.1rem 1.25rem; border-radius: 1rem; display: grid; gap: .35rem; }
    .kpi-label { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-foreground); }
    .kpi-value { margin: 0; font-size: 1.4rem; font-weight: 700; }
    .metric-hero { color: var(--tc-on-primary, #fff); background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); }
    .metric-hero .kpi-label { color: color-mix(in srgb, #fff 82%, transparent); }
    .kpi-card.alerta .kpi-value { color: #b45309; }
    .kpi-card.ok .kpi-value { color: #15803d; }
    .metric-hero .kpi-sub { font-size: .72rem; color: color-mix(in srgb, #fff 78%, transparent); }
    .aviso-extracto { padding: .85rem 1.25rem; display: flex; align-items: start; gap: .6rem; border-left: 4px solid #d97706; color: #92400e; }
    .aviso-extracto mat-icon { color: #d97706; }
    .saldos-card { padding: 1rem 1.25rem; display: grid; gap: .6rem; justify-items: start; }
    .saldos-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; width: 100%; flex-wrap: wrap; }
    .saldos-header h3 { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }
    .saldos-grid { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .saldos-grid mat-form-field { width: 180px; }
    .operador { font-size: 1.2rem; color: var(--muted-foreground); }
    .movimientos-suma { display: grid; }
    .movimientos-suma .etiqueta { font-size: .75rem; color: var(--muted-foreground); }
    .cuadre { display: flex; align-items: center; gap: .35rem; margin: 0; font-size: .85rem; }
    .cuadre.ok { color: #15803d; }
    .cuadre.error { color: #b45309; }
    .cuadre mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .explicacion-card { padding: 1rem 1.25rem; display: grid; gap: .5rem; }
    .explicacion-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .explicacion-header h3 { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }
    .explicacion { margin: 0; white-space: pre-line; }
    .observaciones { display: grid; gap: .5rem; justify-items: start; margin-top: .35rem; }
    .observaciones mat-form-field { width: 100%; }
    .hint { color: var(--muted-foreground); margin: 0; }
    .sugerencias-card { padding: 1rem 1.25rem; display: grid; gap: .75rem; }
    .sugerencias-card h3 { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }
    .sugerencias-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .fila-titulo .pill { margin-left: .4rem; font-size: .68rem; vertical-align: middle; }
    .sugerencias { display: grid; gap: .5rem; }
    .sugerencia { display: flex; justify-content: space-between; gap: 1rem; align-items: center; border: 1px solid color-mix(in srgb, #7c3aed 25%, transparent); border-radius: .75rem; padding: .6rem .9rem; }
    .chips { display: flex; gap: .4rem; flex-wrap: wrap; }
    .detalle { margin: .3rem 0 0; font-weight: 600; }
    .motivo { margin: .1rem 0 0; color: var(--muted-foreground); font-size: .85rem; }
    .paneles { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
    .panel { padding: 1rem 1.25rem; display: grid; gap: .4rem; }
    .panel h3 { display: inline-flex; align-items: center; gap: .4rem; margin: 0 0 .4rem; }
    .panel-herramientas { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; margin-bottom: .4rem; }
    .panel-herramientas .filtro { flex: 1 1 240px; }
    .cargar-mas { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding-top: .6rem; margin-top: .4rem; border-top: 1px solid color-mix(in srgb, var(--muted-foreground) 18%, transparent); flex-wrap: wrap; }
    .fila { display: flex; align-items: center; gap: .6rem; border-radius: .6rem; padding: .35rem .5rem; cursor: pointer; }
    .fila:hover { background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .fila.seleccionada { background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .fila-info { display: grid; flex: 1; min-width: 0; }
    .fila-titulo { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fila-sub { font-size: .78rem; color: var(--muted-foreground); }
    .fila-monto { font-variant-numeric: tabular-nums; font-weight: 600; }
    .fila-monto.neg { color: var(--destructive); }
    .barra-manual { position: sticky; bottom: .5rem; padding: .8rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border: 2px solid color-mix(in srgb, var(--primary) 30%, transparent); }
    .barra-manual.cuadra { border-color: #16a34a; }
    .totales { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .acciones { display: flex; gap: .5rem; }
    .empty-state { display: grid; justify-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { font-size: 2.4rem; width: 2.4rem; height: 2.4rem; }
    .pill { display: inline-flex; border-radius: 999px; padding: .15rem .6rem; font-size: .75rem; font-weight: 600; }
    .pill-ia { background: color-mix(in srgb, #7c3aed 16%, transparent); color: #6d28d9; }
    .pill-info { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .pill-success { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill-void { background: color-mix(in srgb, #dc2626 14%, transparent); color: #b91c1c; }
    .pill-muted { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    @media (max-width: 1000px) { .paneles { grid-template-columns: 1fr; } .kpi-row { grid-template-columns: 1fr 1fr; } }
  `]
})
export class ConciliacionWorkspaceComponent {
  private readonly api = inject(BancosApiService);
  private readonly movimientosService = inject(BancosMovimientosService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly authorization = inject(AuthorizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly cuenta = new FormControl('', { nonNullable: true });
  protected readonly periodo = new FormControl('', { nonNullable: true });

  protected readonly cargando = signal(false);
  protected readonly procesando = signal(false);
  protected readonly consultaRealizada = signal(false);
  protected readonly movimientos = signal<MovimientoBancario[]>([]);
  protected readonly matches = signal<MatchConciliacion[]>([]);
  protected readonly resumen = signal<ResumenConciliacion | null>(null);
  protected readonly seleccionMovimientos = signal<Set<string>>(new Set());
  protected readonly filtroExtracto = signal('');
  protected readonly observaciones = signal('');
  /** Texto tal como está guardado, para no ofrecer guardar sin cambios. */
  private readonly observacionesGuardadas = signal('');
  /** Corte del extracto, editable a mano: en texto para no perder el punto decimal. */
  protected readonly saldoInicialTexto = signal('');
  protected readonly saldoFinalTexto = signal('');
  private readonly saldosGuardados = signal('');
  protected readonly editandoSaldos = signal(false);
  protected readonly cargandoMas = signal(false);
  protected readonly hayMasMovimientos = signal(false);
  private readonly cursorMovimientos = signal<string | null>(null);
  private readonly paginasCargadas = signal(1);
  protected readonly seleccionPartidas = signal<Set<string>>(new Set());

  /**
   * Los movimientos con sugerencia siguen disponibles para conciliar a mano:
   * si desaparecieran del panel, aceptar o rechazar la sugerencia sería la única
   * salida y no habría forma de armar el match uno mismo.
   */
  protected readonly movimientosPorConciliar = computed(() =>
    this.movimientos().filter((movimiento) =>
      movimiento.estadoConciliacion === 'PENDIENTE' || movimiento.estadoConciliacion === 'SUGERIDO'));

  /** Filtrar por concepto es lo que hace viable conciliar decenas de líneas iguales. */
  protected readonly movimientosPendientes = computed(() => {
    const texto = this.filtroExtracto().trim().toLowerCase();
    if (!texto) {
      return this.movimientosPorConciliar();
    }
    return this.movimientosPorConciliar().filter((movimiento) =>
      movimiento.descripcion.toLowerCase().includes(texto)
      || movimiento.referencia.toLowerCase().includes(texto));
  });

  /** Total de lo filtrado, para saber contra qué asiento puede cuadrar. */
  protected readonly totalVisible = computed(() =>
    Math.round(this.movimientosPendientes().reduce((total, movimiento) => total + movimiento.monto, 0) * 100) / 100);

  protected readonly sugeridos = computed(() =>
    this.matches().filter((match) => match.estado === 'SUGERIDO'));

  protected readonly partidasLibros = computed<PartidaConciliatoria[]>(() => {
    const datos = this.resumen();
    if (!datos) {
      return [];
    }
    return [...datos.partidas.depositosTransito, ...datos.partidas.chequesNoCobrados]
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  protected readonly totalSeleccionMovimientos = computed(() =>
    this.movimientos()
      .filter((movimiento) => this.seleccionMovimientos().has(movimiento.id ?? ''))
      .reduce((total, movimiento) => total + movimiento.monto, 0));

  protected readonly totalSeleccionPartidas = computed(() =>
    this.partidasLibros()
      .filter((partida) => this.seleccionPartidas().has(this.partidaKey(partida)))
      .reduce((total, partida) => total + partida.monto, 0));

  protected readonly diferenciaSeleccion = computed(() =>
    Math.round((this.totalSeleccionMovimientos() - this.totalSeleccionPartidas()) * 100) / 100);

  protected readonly seleccionCuadra = computed(() =>
    Math.abs(this.diferenciaSeleccion()) <= 0.01);

  protected readonly observacionesCambiadas = computed(() =>
    this.observaciones().trim() !== this.observacionesGuardadas().trim());

  /**
   * Diferencia entre el corte confirmado y el que encadenan los movimientos. Con
   * dato, es la señal de que el extracto llegó incompleto o de que el saldo
   * confirmado quedó viejo; sin verlo, la conciliación parte de una cifra que
   * nadie sabe de dónde sale.
   */
  protected readonly conflictoSaldo = computed(() => {
    const datos = this.resumen();
    if (!datos || datos.saldoExtractoOrigen !== 'CONFIRMADO'
      || datos.saldoExtracto == null || datos.saldoExtractoMovimientos == null) {
      return null;
    }
    const diferencia = Math.round((datos.saldoExtracto - datos.saldoExtractoMovimientos) * 100) / 100;
    return Math.abs(diferencia) <= 0.01 ? null : diferencia;
  });

  protected readonly mostrarEditorSaldos = computed(() =>
    this.editandoSaldos() || this.conflictoSaldo() !== null);

  /** Del resumen, no de la tabla: la tabla está paginada y sumaría solo lo cargado. */
  protected readonly movimientosDelPeriodo = computed(() =>
    this.resumen()?.movimientosExtracto ?? 0);

  protected readonly saldosEditados = computed(() =>
    `${this.saldoInicialTexto()}|${this.saldoFinalTexto()}` !== this.saldosGuardados());

  /** inicial + movimientos - final; null mientras falte alguno de los dos saldos. */
  protected readonly descuadreEditor = computed(() => {
    const inicial = parseImporte(this.saldoInicialTexto());
    const final = parseImporte(this.saldoFinalTexto());
    if (inicial === null || final === null) {
      return null;
    }
    const descuadre = Math.round((inicial + this.movimientosDelPeriodo() - final) * 100) / 100;
    return Math.abs(descuadre) <= 0.01 ? 0 : descuadre;
  });

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => {
        this.cuentas.set(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA'));
        const preseleccion = this.route.snapshot.queryParamMap.get('cuenta');
        if (preseleccion && cuentas.some((cuenta) => cuenta.id === preseleccion)) {
          this.cuenta.setValue(preseleccion);
        }
        const periodo = this.route.snapshot.queryParamMap.get('periodo');
        if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
          this.periodo.setValue(periodo);
        }
      });
  }

  protected canUpdate(): boolean {
    return this.authorization.canAccess('contabilidad_bancos', 'update');
  }

  protected cargar(): void {
    this.filtroExtracto.set('');
    this.paginasCargadas.set(1);
    void this.refrescar(true);
  }

  private async refrescar(anunciar = false): Promise<void> {
    const cuentaId = this.cuenta.value;
    const periodo = this.periodo.value;
    if (!cuentaId || !periodo) {
      return;
    }
    this.cargando.set(true);
    this.procesando.set(true);
    try {
      // Se recargan tantas páginas como el usuario tenía abiertas, para que
      // conciliar no le devuelva la lista al primer bloque de 100.
      const paginas = anunciar ? 1 : Math.max(1, this.paginasCargadas());
      const [movimientos, matches, resumen] = await Promise.all([
        this.cargarPaginas(cuentaId, periodo, paginas),
        this.movimientosService.getMatchesPorPeriodo(cuentaId, periodo),
        this.api.getResumen(cuentaId, periodo)
      ]);
      this.movimientos.set(movimientos);
      this.matches.set(matches);
      this.resumen.set(resumen);
      // No se pisa lo que el usuario esté escribiendo sin haber guardado aún.
      if (!this.observacionesCambiadas()) {
        this.observaciones.set(resumen.observaciones ?? '');
      }
      this.observacionesGuardadas.set(resumen.observaciones ?? '');
      // Los saldos se recargan siempre: son el dato del período, no un borrador.
      const inicial = formatImporte(resumen.saldoInicialExtracto);
      const final = formatImporte(resumen.saldoExtracto);
      this.saldoInicialTexto.set(inicial);
      this.saldoFinalTexto.set(final);
      this.saldosGuardados.set(`${inicial}|${final}`);
      this.consultaRealizada.set(true);
      this.limpiarSeleccion();
    } catch {
      this.snackBar.open('No se pudo cargar la conciliación del período.', 'OK', { duration: 4500 });
    } finally {
      this.cargando.set(false);
      this.procesando.set(false);
    }
  }

  /** Trae n páginas encadenando el cursor; deja anotado si aún queda más. */
  private async cargarPaginas(cuentaId: string, periodo: string, paginas: number): Promise<MovimientoBancario[]> {
    const acumulados: MovimientoBancario[] = [];
    let cursor: string | null = null;
    let hayMas = false;
    for (let pagina = 0; pagina < paginas; pagina++) {
      const resultado = await this.movimientosService.getMovimientosPage(cuentaId, periodo, TAMANO_PAGINA, cursor);
      acumulados.push(...resultado.items);
      hayMas = resultado.hasMore;
      cursor = resultado.nextCursor;
      if (!cursor) {
        break;
      }
    }
    this.cursorMovimientos.set(cursor);
    this.hayMasMovimientos.set(hayMas && !!cursor);
    this.paginasCargadas.set(paginas);
    return acumulados;
  }

  /** Carga el siguiente bloque sin perder lo ya cargado ni la selección. */
  protected async cargarMasMovimientos(): Promise<void> {
    const cursor = this.cursorMovimientos();
    if (!cursor || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    try {
      const resultado = await this.movimientosService.getMovimientosPage(
        this.cuenta.value, this.periodo.value, TAMANO_PAGINA, cursor);
      this.movimientos.update((actuales) => [...actuales, ...resultado.items]);
      this.cursorMovimientos.set(resultado.nextCursor);
      this.hayMasMovimientos.set(resultado.hasMore && !!resultado.nextCursor);
      this.paginasCargadas.update((paginas) => paginas + 1);
    } catch {
      this.snackBar.open('No se pudieron cargar más movimientos.', 'OK', { duration: 4000 });
    } finally {
      this.cargandoMas.set(false);
    }
  }

  /** Marca de una vez todo lo que quedó a la vista tras filtrar. */
  protected seleccionarVisibles(): void {
    const seleccion = new Set(this.seleccionMovimientos());
    this.movimientosPendientes().forEach((movimiento) => {
      if (movimiento.id) {
        seleccion.add(movimiento.id);
      }
    });
    this.seleccionMovimientos.set(seleccion);
  }

  protected async ejecutarAutomatica(): Promise<void> {
    this.procesando.set(true);
    try {
      const resultado = await this.api.ejecutarConciliacion(this.cuenta.value, this.periodo.value);
      this.snackBar.open(
        `Conciliación automática: ${resultado.autoConciliados} de ${resultado.movimientosEvaluados} movimientos conciliados.`,
        'OK', { duration: 4500 });
      await this.refrescar();
    } catch {
      this.snackBar.open('No se pudo ejecutar la conciliación automática.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  protected async pedirSugerencias(): Promise<void> {
    this.procesando.set(true);
    try {
      const resultado = await this.api.sugerenciasIa(this.cuenta.value, this.periodo.value);
      this.snackBar.open(
        `La IA generó ${resultado.sugeridos + resultado.descartados} sugerencias para revisar.`,
        'OK', { duration: 4500 });
      await this.refrescar();
    } catch {
      this.snackBar.open('No se pudieron obtener sugerencias de IA.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  /** Cancela todas las sugerencias de una vez para seguir en modo manual. */
  protected async descartarSugerencias(): Promise<void> {
    this.procesando.set(true);
    try {
      const { descartadas } = await this.api.descartarSugerencias(this.cuenta.value, this.periodo.value);
      this.snackBar.open(
        `${descartadas} sugerencia(s) descartadas. Los movimientos quedaron libres para conciliar a mano.`,
        'OK', { duration: 4500 });
      await this.refrescar();
    } catch {
      this.snackBar.open('No se pudieron descartar las sugerencias.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  protected async resolver(match: MatchConciliacion, accion: 'ACEPTAR' | 'RECHAZAR'): Promise<void> {
    if (!match.id) {
      return;
    }
    let asientoId: string | null = null;
    // Sugerencia CLASIFICAR (sin contraparte): crear el asiento antes de confirmar.
    if (accion === 'ACEPTAR' && !match.contrapartes?.length && match.cuentaContableSugerida) {
      const cuentaBancaria = this.cuentas().find((cuenta) => cuenta.id === this.cuenta.value);
      const movimientos = this.movimientos()
        .filter((movimiento) => (match.movimientoIds ?? []).includes(movimiento.id ?? ''));
      if (!cuentaBancaria || movimientos.length === 0) {
        this.snackBar.open('No se encontraron los movimientos de la sugerencia.', 'OK', { duration: 4500 });
        return;
      }
      const resultado = await firstValueFrom(this.dialog.open(CrearAsientoBancoDialogComponent, {
        data: {
          cuentaBancaria,
          movimientos,
          cuentaContableSugeridaId: match.cuentaContableSugerida,
          motivo: match.motivo
        }
      }).afterClosed());
      if (!resultado?.asientoId) {
        return;
      }
      asientoId = resultado.asientoId;
    }
    this.procesando.set(true);
    try {
      await this.api.resolverMatch({ cuentaBancariaId: this.cuenta.value, matchId: match.id, accion, asientoId });
      await this.refrescar();
    } catch {
      this.snackBar.open('No se pudo actualizar la sugerencia.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  protected async conciliarSeleccion(): Promise<void> {
    const movimientoIds = [...this.seleccionMovimientos()];
    const partidas = this.partidasLibros()
      .filter((partida) => this.seleccionPartidas().has(this.partidaKey(partida)));
    this.procesando.set(true);
    try {
      await this.api.crearMatchManual({
        cuentaBancariaId: this.cuenta.value,
        periodo: this.periodo.value,
        movimientoIds,
        contrapartes: partidas.map((partida) => ({
          tipo: partida.tipo ?? 'ASIENTO',
          id: partida.id ?? '',
          lineaIndex: partida.lineaIndex ?? null,
          monto: partida.monto,
          detalle: partida.detalle
        })),
        motivo: 'Conciliación manual desde el workspace'
      });
      this.snackBar.open('Selección conciliada.', 'OK', { duration: 3500 });
      await this.refrescar();
    } catch (error) {
      const mensaje = (error as { error?: { message?: string } })?.error?.message
        ?? 'No se pudo conciliar la selección.';
      this.snackBar.open(mensaje, 'OK', { duration: 5000 });
      this.procesando.set(false);
    }
  }

  /** Tras corregir datos a mano, rehace los saldos derivados del período. */
  protected async recalcular(): Promise<void> {
    this.procesando.set(true);
    try {
      await this.api.recalcularPeriodo(this.cuenta.value, this.periodo.value);
      await this.refrescar();
      this.snackBar.open('Período recalculado con los movimientos actuales.', 'OK', { duration: 4000 });
    } catch {
      this.snackBar.open('No se pudo recalcular el período.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  /**
   * Corrige el corte del extracto sin tocar la base de datos: lo que se escribe
   * aquí pasa a ser el saldo del período y se recalculan los totales.
   */
  protected async guardarSaldos(): Promise<void> {
    const saldoInicial = parseImporte(this.saldoInicialTexto());
    const saldoFinal = parseImporte(this.saldoFinalTexto());
    if (saldoFinal === null) {
      this.snackBar.open('Escribe el saldo final del extracto.', 'OK', { duration: 4000 });
      return;
    }
    this.procesando.set(true);
    try {
      await this.api.recalcularPeriodo(this.cuenta.value, this.periodo.value, { saldoInicial, saldoFinal });
      await this.refrescar();
      this.editandoSaldos.set(false);
      this.snackBar.open('Saldos del extracto actualizados y período recalculado.', 'OK', { duration: 4000 });
    } catch {
      this.snackBar.open('No se pudieron guardar los saldos del período.', 'OK', { duration: 4500 });
      this.procesando.set(false);
    }
  }

  protected async guardarObservaciones(): Promise<void> {
    this.procesando.set(true);
    try {
      const texto = this.observaciones().trim();
      await this.api.guardarObservaciones(this.cuenta.value, this.periodo.value, texto);
      this.observacionesGuardadas.set(texto);
      const datos = this.resumen();
      if (datos) {
        this.resumen.set({ ...datos, observaciones: texto, observacionesEn: Date.now() });
      }
      this.snackBar.open('Observaciones guardadas.', 'OK', { duration: 3000 });
    } catch (error) {
      const mensaje = (error as { error?: { message?: string } })?.error?.message
        ?? 'No se pudieron guardar las observaciones.';
      this.snackBar.open(mensaje, 'OK', { duration: 4500 });
    } finally {
      this.procesando.set(false);
    }
  }

  protected async explicar(): Promise<void> {
    this.procesando.set(true);
    try {
      // La IA lee las observaciones desde el período guardado: si quedaron sin
      // guardar, el análisis saldría sin el contexto que el contador acaba de escribir.
      if (this.observacionesCambiadas()) {
        const texto = this.observaciones().trim();
        await this.api.guardarObservaciones(this.cuenta.value, this.periodo.value, texto);
        this.observacionesGuardadas.set(texto);
      }
      const { explicacion } = await this.api.explicarDescuadre(this.cuenta.value, this.periodo.value);
      const datos = this.resumen();
      if (datos) {
        this.resumen.set({ ...datos, explicacionIA: explicacion });
      }
    } catch {
      this.snackBar.open('No se pudo generar la explicación.', 'OK', { duration: 4500 });
    } finally {
      this.procesando.set(false);
    }
  }

  protected async descargarPdf(): Promise<void> {
    this.procesando.set(true);
    try {
      const blob = await this.api.descargarConciliacionPdf(this.cuenta.value, this.periodo.value);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `conciliacion-bancaria-${this.periodo.value}.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      this.snackBar.open('No se pudo generar el PDF.', 'OK', { duration: 4500 });
    } finally {
      this.procesando.set(false);
    }
  }

  protected toggleMovimiento(id: string): void {
    const seleccion = new Set(this.seleccionMovimientos());
    if (!seleccion.delete(id)) {
      seleccion.add(id);
    }
    this.seleccionMovimientos.set(seleccion);
  }

  protected togglePartida(partida: PartidaConciliatoria): void {
    const clave = this.partidaKey(partida);
    const seleccion = new Set(this.seleccionPartidas());
    if (!seleccion.delete(clave)) {
      seleccion.add(clave);
    }
    this.seleccionPartidas.set(seleccion);
  }

  protected limpiarSeleccion(): void {
    this.seleccionMovimientos.set(new Set());
    this.seleccionPartidas.set(new Set());
  }

  protected partidaKey(partida: PartidaConciliatoria): string {
    return `${partida.tipo ?? 'ASIENTO'}|${partida.id ?? ''}|${partida.lineaIndex ?? '-'}`;
  }

  protected descripcionMatch(match: MatchConciliacion): string {
    const movimientos = this.movimientos()
      .filter((movimiento) => (match.movimientoIds ?? []).includes(movimiento.id ?? ''))
      .map((movimiento) => `${movimiento.fecha} ${movimiento.descripcion}`);
    const contraparte = match.contrapartes?.[0]?.detalle
      ?? (match.cuentaContableSugerida ? 'Clasificar a cuenta contable sugerida' : 'Marcar como no conciliable');
    return `${movimientos.join(' + ') || 'Movimiento'} → ${contraparte}`;
  }

  protected origenLabel(origen: MatchConciliacion['origen']): string {
    return ({
      L1_EXACTO: 'Exacto',
      L2_REGLA: 'Regla',
      L3_MEMORIA: 'Memoria',
      L4_IA: 'IA',
      MANUAL: 'Manual'
    } as Record<string, string>)[origen] ?? origen;
  }

  protected origenClase(origen: MatchConciliacion['origen']): string {
    return origen === 'L4_IA' ? 'pill pill-ia' : 'pill pill-info';
  }
}

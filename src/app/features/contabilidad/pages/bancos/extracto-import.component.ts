import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';

import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogResult
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import { formatImporte, parseImporte } from '../../../../shared/utils/importe-input.util';
import {
  AnalisisExtracto,
  CuentaBancaria,
  HojaExtractoResumen,
  MapeoExtracto,
  PlantillaDisponible,
  ResultadoImportacion,
  SIN_ENCABEZADO
} from '../../models/bancos.models';
import { BancosApiService } from '../../services/bancos-api.service';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';

type PasoImportacion = 'archivo' | 'hoja' | 'formato' | 'mapeo' | 'resumen';

/** Valor del paso Formato: el id de una plantilla guardada o 'IA'. */
type FormatoElegido = string;

@Component({
  selector: 'app-extracto-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <section class="import-page">
      <header class="surface-card page-header">
        <div class="header-copy">
          <p class="eyebrow">Contabilidad · Bancos</p>
          <h2>Importar extracto bancario</h2>
          <p class="support">
            Sube el Excel o CSV de tu banco. La IA detecta el formato de columnas la primera vez y
            lo recuerda como plantilla para las siguientes importaciones.
          </p>
        </div>
        <a mat-stroked-button color="primary" class="cta" routerLink="/workspace/contabilidad/bancos">
          <mat-icon>arrow_back</mat-icon>
          Cuentas
        </a>
      </header>

      <nav class="steps surface-card">
        <span class="step" [class.active]="paso() === 'archivo'">1 · Cuenta y archivo</span>
        @if (hojas().length > 1) {
          <mat-icon>chevron_right</mat-icon>
          <span class="step" [class.active]="paso() === 'hoja'">2 · Hoja del Excel</span>
        }
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'formato'">{{ pasoNumero(3) }} · Formato</span>
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'mapeo'">{{ pasoNumero(4) }} · Verificar mapeo</span>
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'resumen'">{{ pasoNumero(5) }} · Resultado</span>
      </nav>

      @if (paso() === 'archivo') {
        <section class="surface-card card">
          <mat-form-field appearance="outline" class="cuenta-select">
            <mat-label>Cuenta bancaria destino</mat-label>
            <mat-select [(ngModel)]="cuentaSeleccionadaId">
              @for (cuenta of cuentas(); track cuenta.id) {
                <mat-option [value]="cuenta.id">{{ cuenta.nombre }} · {{ cuenta.bancoNombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (!cuentaSeleccionadaId) {
            <p class="hint">Selecciona la cuenta bancaria antes de elegir el archivo.</p>
          } @else {
            <div class="archivo-acciones">
              <button mat-flat-button color="primary" type="button" (click)="elegirArchivo()">
                <mat-icon>folder_open</mat-icon>
                Elegir archivo
              </button>
              <p class="hint">Puedes reutilizar un extracto que ya subiste antes o cargar uno nuevo (.xlsx o .csv).</p>
            </div>
          }

          @if (analizando()) {
            <div class="progress">
              <mat-progress-bar mode="indeterminate" />
              <p>Analizando el formato del extracto…</p>
            </div>
          }
        </section>
      }

      @if (paso() === 'hoja') {
        <section class="surface-card card">
          <div>
            <h3>El archivo tiene {{ hojas().length }} hojas</h3>
            <p class="hint">Elige cuál contiene los movimientos del extracto. Se preselecciona la que tiene más filas.</p>
          </div>

          <mat-radio-group class="hojas" [(ngModel)]="hojaSeleccionada">
            @for (hoja of hojas(); track hoja.index) {
              <mat-radio-button [value]="hoja.index" [disabled]="hoja.filasConDatos === 0">
                <span class="hoja-nombre">{{ hoja.nombre }}</span>
                <span class="hoja-sub">{{ hoja.filasConDatos }} filas con datos</span>
              </mat-radio-button>
            }
          </mat-radio-group>

          <div class="acciones">
            <button mat-button (click)="reiniciar()">Atrás</button>
            <span class="spacer"></span>
            <button mat-flat-button color="primary" [disabled]="analizando()" (click)="analizarHoja()">
              <mat-icon>auto_awesome</mat-icon>
              {{ analizando() ? 'Analizando…' : 'Analizar esta hoja' }}
            </button>
          </div>
          @if (analizando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </section>
      }

      @if (paso() === 'formato') {
        <section class="surface-card card">
          <div>
            <h3>¿Cómo interpretamos este archivo?</h3>
            <p class="hint">
              Reutiliza una plantilla guardada si el banco te entrega siempre el mismo formato,
              o deja que la IA lo analice cuando sea un archivo distinto.
            </p>
          </div>

          <mat-radio-group class="formatos" [(ngModel)]="formatoElegido">
            @for (plantilla of plantillas(); track plantilla.id) {
              <mat-radio-button [value]="plantilla.id">
                <span class="formato-titulo">
                  {{ plantilla.nombre }}
                  <span class="pill" [class]="plantilla.compatible ? 'pill-success' : 'pill-muted'">
                    {{ plantilla.compatible ? 'Compatible' : 'No coincide' }}
                  </span>
                </span>
                <span class="formato-sub">{{ plantilla.motivo }} · usada {{ plantilla.vecesUsada }} vez(ces)</span>
              </mat-radio-button>
            }
            <mat-radio-button value="IA">
              <span class="formato-titulo">
                Detectar con IA
                <span class="pill pill-ia">IA</span>
              </span>
              <span class="formato-sub">
                Analiza una muestra del archivo e identifica encabezado, fecha, descripción,
                referencia, débito, crédito y saldo.
              </span>
            </mat-radio-button>
          </mat-radio-group>

          @if (plantillas().length === 0) {
            <p class="hint">Aún no hay plantillas guardadas para este banco: la IA detectará el formato y podrás guardarlo al final.</p>
          }

          <div class="acciones">
            <button mat-button (click)="volverDesdeFormato()">Atrás</button>
            <span class="spacer"></span>
            <button mat-flat-button color="primary" [disabled]="analizando()" (click)="aplicarFormato()">
              <mat-icon>{{ formatoElegido === 'IA' ? 'auto_awesome' : 'bookmark' }}</mat-icon>
              {{ analizando() ? 'Analizando…' : (formatoElegido === 'IA' ? 'Analizar con IA' : 'Usar plantilla') }}
            </button>
          </div>
          @if (analizando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </section>
      }

      @if (paso() === 'mapeo' && analisis()) {
        <section class="surface-card card">
          <div class="mapeo-header">
            <div>
              <h3>Mapeo de columnas
                <span class="pill" [class]="origenClase()">{{ origenLabel() }}</span>
              </h3>
              <p class="hint">Ajusta la hoja, la fila de encabezado o las columnas si algo no coincide.</p>
            </div>
            <button mat-stroked-button color="primary" type="button"
                    [disabled]="analizando() || previsualizando()"
                    matTooltip="Ignora la plantilla guardada y vuelve a detectar el formato con IA"
                    (click)="redetectarConIa()">
              <mat-icon>auto_awesome</mat-icon>
              {{ analizando() ? 'Detectando…' : 'Detectar con IA' }}
            </button>
          </div>

          <div class="mapeo-grid">
            @if (hojas().length > 1) {
              <mat-form-field appearance="outline">
                <mat-label>Hoja</mat-label>
                <mat-select [(ngModel)]="mapeoEditable.hojaIndex" (ngModelChange)="onCambioHoja($event)">
                  @for (hoja of hojas(); track hoja.index) {
                    <mat-option [value]="hoja.index">{{ hoja.nombre }} ({{ hoja.filasConDatos }} filas)</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <mat-form-field appearance="outline" class="encabezado-select">
              <mat-label>Fila de encabezado</mat-label>
              <mat-select [(ngModel)]="mapeoEditable.filaEncabezado" (ngModelChange)="refrescarPreview()">
                <mat-option [value]="sinEncabezado">Sin encabezado — los datos empiezan en la primera fila</mat-option>
                @for (fila of analisis()!.primerasFilas; track fila.index) {
                  <mat-option [value]="fila.index">Fila {{ fila.index + 1 }}: {{ fila.resumen }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de fecha</mat-label>
              <mat-select [(ngModel)]="mapeoEditable.mapeo.fecha.col" (ngModelChange)="refrescarPreview()">
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de descripción</mat-label>
              <mat-select [(ngModel)]="mapeoEditable.mapeo.descripcion.col" (ngModelChange)="refrescarPreview()">
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de referencia</mat-label>
              <mat-select [(ngModel)]="referenciaCol" (ngModelChange)="refrescarPreview()">
                <mat-option [value]="null">— Sin referencia —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna débitos</mat-label>
              <mat-select [(ngModel)]="debitoCol" (ngModelChange)="refrescarPreview()">
                <mat-option [value]="null">— No aplica —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna créditos</mat-label>
              <mat-select [(ngModel)]="creditoCol" (ngModelChange)="refrescarPreview()">
                <mat-option [value]="null">— No aplica —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de saldo</mat-label>
              <mat-select [(ngModel)]="saldoCol" (ngModelChange)="refrescarPreview()">
                <mat-option [value]="null">— Sin saldo —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <div class="saldos">
            <h4>Saldos del extracto</h4>
            @if (analisis()!.saldosConfiables) {
              <p class="hint">
                Deducidos encadenando los saldos línea a línea, sin depender del orden del archivo.
                Confírmalos contra el extracto del banco: se usarán como el saldo real del período.
              </p>
            } @else {
              <p class="cuadre error">
                <mat-icon>error_outline</mat-icon>
                No se pudo deducir con certeza el corte del período (el archivo no encadena los saldos
                de forma única). <strong>Escríbelos tal como los da el banco.</strong>
              </p>
            }
            <div class="saldos-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Saldo inicial</mat-label>
                <input matInput type="text" inputmode="decimal" [(ngModel)]="saldoInicialTexto" />
              </mat-form-field>
              <span class="operador">+</span>
              <div class="movimientos-suma">
                <span class="etiqueta">Movimientos del archivo</span>
                <strong [class.neg]="analisis()!.sumaMovimientos < 0">
                  {{ analisis()!.sumaMovimientos | currency: 'USD':'symbol-narrow':'1.2-2' }}
                </strong>
              </div>
              <span class="operador">=</span>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Saldo final</mat-label>
                <input matInput type="text" inputmode="decimal" [(ngModel)]="saldoFinalTexto" />
              </mat-form-field>
            </div>
            @if (saldoInicial() !== null && saldoFinal() !== null) {
              @if (saldosCuadran()) {
                <p class="cuadre ok"><mat-icon>check_circle</mat-icon> Los saldos cuadran con los movimientos del archivo.</p>
              } @else {
                <p class="cuadre error">
                  <mat-icon>warning</mat-icon>
                  Diferencia de {{ descuadreSaldos() | currency: 'USD':'symbol-narrow':'1.2-2' }}:
                  puede que falten movimientos en el archivo o que el mapeo de columnas no sea el correcto.
                </p>
              }
            }
          </div>

          <div class="preview-header">
            <h4>Vista previa</h4>
            <p class="contadores" [class.con-descartes]="analisis()!.filasDescartadas > 0">
              Mostrando {{ analisis()!.preview.length }} de {{ analisis()!.filasDetectadas }} filas ·
              <strong>se importarán {{ analisis()!.filasValidas }}</strong>
              @if (analisis()!.filasDescartadas > 0) {
                · se descartarán {{ analisis()!.filasDescartadas }}
              }
            </p>
          </div>

          @if (analisis()!.erroresMuestra.length > 0) {
            <ul class="errores">
              @for (error of analisis()!.erroresMuestra; track error) {
                <li>{{ error }}</li>
              }
            </ul>
          }

          <div class="preview-wrap" [class.recalculando]="previsualizando()">
            <table mat-table [dataSource]="analisis()!.preview" class="preview-table">
              <ng-container matColumnDef="fila">
                <th mat-header-cell *matHeaderCellDef>#</th>
                <td mat-cell *matCellDef="let row">{{ row.fila }}</td>
              </ng-container>
              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.fecha ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="descripcion">
                <th mat-header-cell *matHeaderCellDef>Descripción</th>
                <td mat-cell *matCellDef="let row">{{ row.error ?? row.descripcion }}</td>
              </ng-container>
              <ng-container matColumnDef="referencia">
                <th mat-header-cell *matHeaderCellDef>Referencia</th>
                <td mat-cell *matCellDef="let row">{{ row.referencia || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="monto">
                <th mat-header-cell *matHeaderCellDef class="num">Monto</th>
                <td mat-cell *matCellDef="let row" class="num" [class.neg]="(row.monto ?? 0) < 0">
                  {{ row.monto !== undefined ? (row.monto | currency: 'USD':'symbol-narrow':'1.2-2') : '—' }}
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="previewColumnas"></tr>
              <tr mat-row *matRowDef="let row; columns: previewColumnas" [class.error-row]="row.error"></tr>
            </table>
          </div>

          <div class="guardar-plantilla">
            <mat-checkbox [(ngModel)]="guardarPlantilla">
              {{ plantillaAplicada() ? 'Actualizar la plantilla usada' : 'Guardar este formato como plantilla' }}
            </mat-checkbox>
            @if (guardarPlantilla) {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="nombre-plantilla">
                <mat-label>Nombre de la plantilla</mat-label>
                <input matInput [(ngModel)]="nombrePlantilla" maxlength="80" />
                <mat-hint>Ej. Pichincha corriente 2204</mat-hint>
              </mat-form-field>
            }
          </div>

          <div class="acciones">
            <span class="spacer"></span>
            <button mat-button (click)="reiniciar()">Atrás</button>
            <button mat-flat-button color="primary"
                    [disabled]="importando() || previsualizando() || analisis()!.filasValidas === 0"
                    (click)="importar()">
              <mat-icon>publish</mat-icon>
              {{ importando() ? 'Importando…' : 'Importar ' + analisis()!.filasValidas + ' movimientos' }}
            </button>
          </div>
          @if (importando() || previsualizando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </section>
      }

      @if (paso() === 'resumen' && resultado()) {
        <section class="surface-card card resumen">
          <div class="pills">
            <span class="pill pill-info">{{ resultado()!.filasLeidas }} filas leídas</span>
            <span class="pill pill-success">{{ resultado()!.importadas }} importadas</span>
            <span class="pill pill-muted">{{ resultado()!.duplicadas }} duplicadas (omitidas)</span>
            <span class="pill" [class]="resultado()!.errores.length ? 'pill-void' : 'pill-muted'">
              {{ descartadas() }} descartadas
            </span>
          </div>
          @if (resultado()!.errores.length) {
            <ul class="errores">
              @for (error of resultado()!.errores; track error) {
                <li>{{ error }}</li>
              }
            </ul>
          }
          <div class="acciones">
            <button mat-stroked-button (click)="reiniciar()">
              <mat-icon>upload_file</mat-icon>
              Importar otro archivo
            </button>
            <a mat-flat-button color="primary"
               [routerLink]="['/workspace/contabilidad/bancos/conciliacion']"
               [queryParams]="{ cuenta: cuentaSeleccionadaId }">
              <mat-icon>fact_check</mat-icon>
              Ir a conciliar
            </a>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .import-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.6rem; }
    .support { margin: .4rem 0 0; color: var(--muted-foreground); max-width: 62ch; }
    .cta { border-radius: 999px; }
    .steps { display: flex; align-items: center; gap: .5rem; padding: .8rem 1.25rem; color: var(--muted-foreground); flex-wrap: wrap; }
    .step.active { color: var(--primary); font-weight: 700; }
    .card { padding: 1.25rem 1.5rem; display: grid; gap: 1rem; }
    .cuenta-select { max-width: 480px; }
    .hint { color: var(--muted-foreground); margin: 0; }
    .progress { display: grid; gap: .5rem; }
    .hojas { display: grid; gap: .5rem; }
    .hojas mat-radio-button { border: 1px solid color-mix(in srgb, var(--muted-foreground) 20%, transparent); border-radius: .6rem; padding: .5rem .75rem; }
    .hoja-nombre { font-weight: 600; }
    .hoja-sub { color: var(--muted-foreground); font-size: .82rem; margin-left: .5rem; }
    .archivo-acciones { display: grid; gap: .5rem; justify-items: start; }
    .formatos { display: grid; gap: .5rem; }
    .formatos mat-radio-button { border: 1px solid color-mix(in srgb, var(--muted-foreground) 20%, transparent); border-radius: .6rem; padding: .55rem .8rem; }
    .formato-titulo { font-weight: 600; display: inline-flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .formato-sub { display: block; color: var(--muted-foreground); font-size: .82rem; }
    .guardar-plantilla { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .nombre-plantilla { min-width: min(320px, 100%); }
    .mapeo-header { display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; }
    .mapeo-header h3 { margin: 0; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .mapeo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
    .encabezado-select { grid-column: span 2; }
    .saldos { display: grid; gap: .5rem; padding: .85rem 1rem; border-radius: .75rem; background: color-mix(in srgb, var(--primary) 5%, transparent); }
    .saldos h4 { margin: 0; }
    .saldos-grid { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .saldos-grid mat-form-field { width: 180px; }
    .operador { font-size: 1.2rem; color: var(--muted-foreground); }
    .movimientos-suma { display: grid; }
    .movimientos-suma .etiqueta { font-size: .75rem; color: var(--muted-foreground); }
    .movimientos-suma strong.neg { color: var(--destructive); }
    .cuadre { display: flex; align-items: center; gap: .35rem; margin: 0; font-size: .85rem; }
    .cuadre.ok { color: #15803d; }
    .cuadre.error { color: #b45309; }
    .cuadre mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .preview-header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .preview-header h4 { margin: 0; }
    .contadores { margin: 0; color: var(--muted-foreground); }
    .contadores.con-descartes { color: #b45309; }
    .preview-wrap { overflow-x: auto; }
    .preview-wrap.recalculando { opacity: .55; }
    .preview-table td.num, .preview-table th.num { text-align: right; }
    .preview-table td.neg { color: var(--destructive); }
    .error-row { background: color-mix(in srgb, var(--destructive) 8%, transparent); }
    .acciones { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .spacer { flex: 1; }
    .pills { display: flex; gap: .5rem; flex-wrap: wrap; }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: .2rem .7rem; font-size: .78rem; font-weight: 600; }
    .pill-info { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
    .pill-ia { background: color-mix(in srgb, #7c3aed 16%, transparent); color: #6d28d9; }
    .pill-success { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill-void { background: color-mix(in srgb, #dc2626 14%, transparent); color: #b91c1c; }
    .pill-muted { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    .errores { margin: 0; padding-left: 1.2rem; color: var(--destructive); display: grid; gap: .2rem; font-size: .85rem; }
    @media (max-width: 900px) { .mapeo-grid { grid-template-columns: 1fr; } .encabezado-select { grid-column: auto; } }
  `]
})
export class ExtractoImportComponent {
  private readonly api = inject(BancosApiService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly previewColumnas = ['fila', 'fecha', 'descripcion', 'referencia', 'monto'];
  protected readonly sinEncabezado = SIN_ENCABEZADO;
  protected readonly paso = signal<PasoImportacion>('archivo');
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly hojas = signal<HojaExtractoResumen[]>([]);
  protected readonly plantillas = signal<PlantillaDisponible[]>([]);
  protected readonly analizando = signal(false);
  protected readonly previsualizando = signal(false);
  protected readonly importando = signal(false);
  protected readonly analisis = signal<AnalisisExtracto | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);

  protected cuentaSeleccionadaId: string | null = null;
  protected hojaSeleccionada = 0;
  protected formatoElegido: FormatoElegido = 'IA';
  protected guardarPlantilla = true;
  protected nombrePlantilla = '';
  protected mapeoEditable!: MapeoExtracto;
  /** Texto, no número: los importes van en input de texto para no perder el punto decimal. */
  protected saldoInicialTexto = '';
  protected saldoFinalTexto = '';
  protected referenciaCol: number | null = null;
  protected debitoCol: number | null = null;
  protected creditoCol: number | null = null;
  protected saldoCol: number | null = null;
  private archivoActual: ArchivoItem | null = null;

  /** Los ajustes de mapeo se agrupan antes de pedir el recálculo al backend. */
  private readonly cambioMapeo = new Subject<void>();

  protected readonly encabezadosOpciones = computed(() => {
    const encabezados = this.analisis()?.encabezados ?? [];
    return encabezados.map((nombre, col) => ({
      col,
      label: `${col + 1}. ${nombre || '(sin título)'}`
    }));
  });

  protected saldoInicial(): number | null {
    return parseImporte(this.saldoInicialTexto);
  }

  protected saldoFinal(): number | null {
    return parseImporte(this.saldoFinalTexto);
  }

  /** inicial + movimientos - final: si no da cero, el archivo no está completo. */
  protected descuadreSaldos(): number {
    const inicial = this.saldoInicial();
    const final = this.saldoFinal();
    if (inicial === null || final === null) {
      return 0;
    }
    const suma = this.analisis()?.sumaMovimientos ?? 0;
    return Math.round((inicial + suma - final) * 100) / 100;
  }

  protected saldosCuadran(): boolean {
    return Math.abs(this.descuadreSaldos()) <= 0.01;
  }

  protected readonly descartadas = computed(() => {
    const datos = this.resultado();
    if (!datos) {
      return 0;
    }
    return Math.max(0, datos.filasLeidas - datos.importadas - datos.duplicadas);
  });

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA')));

    this.cambioMapeo
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.previsualizar());
  }

  /** Reutiliza el selector del módulo Archivos: elegir uno ya subido o cargar uno nuevo. */
  protected async elegirArchivo(): Promise<void> {
    const seleccion = await firstValueFrom(this.dialog.open(ArchivoSelectorDialogComponent, {
      width: 'min(920px, 96vw)',
      data: {
        title: 'Extracto bancario',
        subtitle: 'Elige un extracto ya subido o carga uno nuevo (.xlsx o .csv)',
        sourceModule: 'bancos',
        allowUpload: true,
        extensions: ['xlsx', 'csv']
      }
    }).afterClosed()) as ArchivoSelectorDialogResult | undefined;
    if (seleccion?.archivo) {
      await this.onArchivoSubido(seleccion.archivo);
    }
  }

  protected async onArchivoSubido(archivo: ArchivoItem): Promise<void> {
    if (!this.cuentaSeleccionadaId) {
      return;
    }
    this.archivoActual = archivo;
    this.analizando.set(true);
    try {
      const hojas = await this.api.listarHojas(archivo.storagePath, archivo.name);
      this.hojas.set(hojas);
      const conDatos = hojas.filter((hoja) => hoja.filasConDatos > 0);
      // Con una sola hoja útil no se agrega fricción: se salta al paso de formato.
      if (conDatos.length > 1) {
        this.hojaSeleccionada = conDatos.reduce((mayor, hoja) =>
          hoja.filasConDatos > mayor.filasConDatos ? hoja : mayor, conDatos[0]).index;
        this.paso.set('hoja');
        return;
      }
      this.hojaSeleccionada = conDatos[0]?.index ?? 0;
      await this.cargarFormatos();
    } catch (error) {
      this.mostrarError(error, 'No se pudo leer el archivo.');
    } finally {
      this.analizando.set(false);
    }
  }

  protected async analizarHoja(): Promise<void> {
    this.analizando.set(true);
    try {
      await this.cargarFormatos();
    } catch (error) {
      this.mostrarError(error, 'No se pudo leer la hoja seleccionada.');
    } finally {
      this.analizando.set(false);
    }
  }

  /** Paso Formato: plantillas del banco evaluadas contra la hoja, sin gastar IA. */
  private async cargarFormatos(): Promise<void> {
    if (!this.cuentaSeleccionadaId || !this.archivoActual) {
      return;
    }
    const plantillas = await this.api.listarPlantillas(
      this.cuentaSeleccionadaId, this.archivoActual.storagePath, this.archivoActual.name, this.hojaSeleccionada);
    this.plantillas.set(plantillas);
    // Se preselecciona la plantilla compatible; si ninguna sirve, la IA.
    this.formatoElegido = plantillas.find((plantilla) => plantilla.compatible)?.id ?? 'IA';
    this.paso.set('formato');
  }

  protected async aplicarFormato(): Promise<void> {
    this.analizando.set(true);
    try {
      const usaIa = this.formatoElegido === 'IA';
      await this.analizar(this.hojaSeleccionada, {
        plantillaId: usaIa ? null : this.formatoElegido,
        forzarIa: usaIa
      });
    } catch (error) {
      this.mostrarError(error, 'No se pudo interpretar el formato de esta hoja.');
    } finally {
      this.analizando.set(false);
    }
  }

  protected volverDesdeFormato(): void {
    this.paso.set(this.hojas().length > 1 ? 'hoja' : 'archivo');
  }

  private async analizar(
    hojaIndex: number | null,
    opciones: { plantillaId?: string | null; forzarIa?: boolean } = {}
  ): Promise<void> {
    if (!this.cuentaSeleccionadaId || !this.archivoActual) {
      return;
    }
    const analisis = await this.api.analizarExtracto(
      this.cuentaSeleccionadaId, this.archivoActual.storagePath, this.archivoActual.name, hojaIndex, opciones);
    this.aplicarAnalisis(analisis);
    this.paso.set('mapeo');
  }

  /** Ignora la plantilla guardada y pide a la IA que vuelva a leer esta hoja. */
  protected async redetectarConIa(): Promise<void> {
    this.analizando.set(true);
    try {
      await this.analizar(this.mapeoEditable?.hojaIndex ?? this.analisis()?.hojaIndex ?? null, { forzarIa: true });
      this.snackBar.open('Formato detectado con IA.', 'OK', { duration: 3000 });
    } catch (error) {
      this.mostrarError(error, 'La IA no pudo interpretar el formato de esta hoja.');
    } finally {
      this.analizando.set(false);
    }
  }

  /** Plantilla que se aplicó al análisis actual, si la hubo. */
  protected plantillaAplicada(): PlantillaDisponible | null {
    const id = this.analisis()?.plantillaId;
    return id ? this.plantillas().find((plantilla) => plantilla.id === id) ?? null : null;
  }

  protected pasoNumero(base: number): number {
    return this.hojas().length > 1 ? base : base - 1;
  }

  private aplicarAnalisis(analisis: AnalisisExtracto): void {
    this.analisis.set(analisis);
    if (analisis.hojas?.length) {
      this.hojas.set(analisis.hojas);
    }
    // Se propone el nombre de la plantilla aplicada para actualizarla, o uno nuevo.
    const aplicada = this.plantillas().find((plantilla) => plantilla.id === analisis.plantillaId);
    this.nombrePlantilla = aplicada?.nombre ?? this.nombrePlantillaPorDefecto();
    this.mapeoEditable = structuredClone(analisis.mapeo);
    this.mapeoEditable.hojaIndex = analisis.hojaIndex;
    this.saldoInicialTexto = formatImporte(analisis.saldoInicialDetectado);
    this.saldoFinalTexto = formatImporte(analisis.saldoFinalDetectado);
    this.referenciaCol = analisis.mapeo.mapeo.referencia?.col ?? null;
    this.debitoCol = analisis.mapeo.mapeo.debito?.col ?? analisis.mapeo.mapeo.montoUnico?.col ?? null;
    this.creditoCol = analisis.mapeo.mapeo.credito?.col ?? null;
    this.saldoCol = analisis.mapeo.mapeo.saldo?.col ?? null;
  }

  /** Cambiar de hoja invalida el mapeo actual: se vuelve a analizar esa hoja. */
  protected async onCambioHoja(hojaIndex: number): Promise<void> {
    this.analizando.set(true);
    try {
      await this.analizar(hojaIndex);
    } catch (error) {
      this.mostrarError(error, 'No se pudo analizar la hoja seleccionada.');
    } finally {
      this.analizando.set(false);
    }
  }

  protected refrescarPreview(): void {
    this.cambioMapeo.next();
  }

  /** Recalcula contadores y preview en el backend; no consume IA. */
  private async previsualizar(): Promise<void> {
    if (!this.archivoActual || !this.mapeoEditable) {
      return;
    }
    this.previsualizando.set(true);
    try {
      const analisis = await this.api.previsualizar(
        this.archivoActual.storagePath, this.archivoActual.name, this.construirMapeo());
      // Conserva las selecciones del usuario: solo se refrescan preview y contadores.
      this.analisis.set({ ...analisis, mapeo: this.analisis()?.mapeo ?? analisis.mapeo });
    } catch (error) {
      this.mostrarError(error, 'El mapeo actual no es válido para este archivo.');
    } finally {
      this.previsualizando.set(false);
    }
  }

  protected async importar(): Promise<void> {
    if (!this.cuentaSeleccionadaId || !this.archivoActual || !this.analisis()) {
      return;
    }
    this.importando.set(true);
    try {
      const resultado = await this.api.importarExtracto({
        cuentaBancariaId: this.cuentaSeleccionadaId,
        storagePath: this.archivoActual.storagePath,
        nombreArchivo: this.archivoActual.name,
        mapeo: this.construirMapeo(),
        guardarPlantilla: this.guardarPlantilla,
        plantillaId: this.analisis()?.plantillaId ?? null,
        nombrePlantilla: this.guardarPlantilla ? this.nombrePlantilla : null,
        saldoInicial: this.saldoInicial(),
        saldoFinal: this.saldoFinal()
      });
      this.resultado.set(resultado);
      this.paso.set('resumen');
    } catch (error) {
      this.mostrarError(error, 'No se pudo importar el extracto.');
    } finally {
      this.importando.set(false);
    }
  }

  private construirMapeo(): MapeoExtracto {
    const base = this.mapeoEditable;
    const usaMontoUnico = this.creditoCol === null && this.debitoCol !== null;
    return {
      hojaIndex: base.hojaIndex,
      filaEncabezado: base.filaEncabezado,
      separadorDecimal: base.separadorDecimal,
      mapeo: {
        fecha: base.mapeo.fecha,
        descripcion: base.mapeo.descripcion,
        ...(this.referenciaCol !== null ? { referencia: { col: this.referenciaCol } } : {}),
        ...(usaMontoUnico
          ? {
              montoUnico: {
                col: this.debitoCol,
                convencionSigno: base.mapeo.montoUnico?.convencionSigno ?? 'NEGATIVO_DEBITO'
              }
            }
          : { debito: { col: this.debitoCol }, credito: { col: this.creditoCol } }),
        ...(this.saldoCol !== null ? { saldo: { col: this.saldoCol } } : {})
      }
    };
  }

  protected origenLabel(): string {
    return ({
      IA: 'Detectado con IA',
      PLANTILLA: 'Plantilla del banco',
      MANUAL: 'Ajustado por ti'
    } as Record<string, string>)[this.analisis()?.origenMapeo ?? ''] ?? '';
  }

  protected origenClase(): string {
    return this.analisis()?.origenMapeo === 'IA' ? 'pill-ia' : 'pill-info';
  }

  private nombrePlantillaPorDefecto(): string {
    const cuenta = this.cuentas().find((item) => item.id === this.cuentaSeleccionadaId);
    const formato = this.archivoActual?.name?.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX';
    return cuenta ? `${cuenta.bancoNombre} ${formato}` : formato;
  }

  protected reiniciar(): void {
    this.analisis.set(null);
    this.resultado.set(null);
    this.hojas.set([]);
    this.plantillas.set([]);
    this.archivoActual = null;
    this.paso.set('archivo');
  }

  private mostrarError(error: unknown, porDefecto: string): void {
    const mensaje = (error as { error?: { message?: string } })?.error?.message ?? porDefecto;
    this.snackBar.open(mensaje, 'OK', { duration: 5000 });
  }
}

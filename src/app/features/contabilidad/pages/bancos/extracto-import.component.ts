import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import {
  AnalisisExtracto,
  CuentaBancaria,
  MapeoExtracto,
  ResultadoImportacion
} from '../../models/bancos.models';
import { BancosApiService } from '../../services/bancos-api.service';
import { BancosCuentasService } from '../../services/bancos-cuentas.service';

type PasoImportacion = 'archivo' | 'mapeo' | 'resumen';

@Component({
  selector: 'app-extracto-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    ArchivoUploaderComponent
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
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'mapeo'">2 · Verificar mapeo</span>
        <mat-icon>chevron_right</mat-icon>
        <span class="step" [class.active]="paso() === 'resumen'">3 · Resultado</span>
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
            <p class="hint">Selecciona la cuenta bancaria antes de subir el archivo.</p>
          } @else {
            <app-archivo-uploader
              sourceModule="bancos"
              [extensions]="['xlsx', 'csv']"
              (uploaded)="onArchivoSubido($event)"
            />
          }

          @if (analizando()) {
            <div class="progress">
              <mat-progress-bar mode="indeterminate" />
              <p>Analizando el formato del extracto…</p>
            </div>
          }
        </section>
      }

      @if (paso() === 'mapeo' && analisis()) {
        <section class="surface-card card">
          <div class="mapeo-header">
            <div>
              <h3>Mapeo de columnas
                <span class="pill" [class]="analisis()!.origenMapeo === 'IA' ? 'pill-ia' : 'pill-info'">
                  {{ analisis()!.origenMapeo === 'IA' ? 'Detectado con IA' : 'Plantilla del banco' }}
                </span>
              </h3>
              <p class="hint">
                {{ analisis()!.filasValidas }} de {{ analisis()!.filasDetectadas }} filas interpretadas.
                Ajusta las columnas si algo no coincide.
              </p>
            </div>
          </div>

          <div class="mapeo-grid">
            <mat-form-field appearance="outline">
              <mat-label>Columna de fecha</mat-label>
              <mat-select [(ngModel)]="mapeoEditable.mapeo.fecha.col">
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de descripción</mat-label>
              <mat-select [(ngModel)]="mapeoEditable.mapeo.descripcion.col">
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de referencia</mat-label>
              <mat-select [(ngModel)]="referenciaCol">
                <mat-option [value]="null">— Sin referencia —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna débitos</mat-label>
              <mat-select [(ngModel)]="debitoCol">
                <mat-option [value]="null">— No aplica —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna créditos</mat-label>
              <mat-select [(ngModel)]="creditoCol">
                <mat-option [value]="null">— No aplica —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Columna de saldo</mat-label>
              <mat-select [(ngModel)]="saldoCol">
                <mat-option [value]="null">— Sin saldo —</mat-option>
                @for (encabezado of encabezadosOpciones(); track encabezado.col) {
                  <mat-option [value]="encabezado.col">{{ encabezado.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <h4>Vista previa normalizada</h4>
          <div class="preview-wrap">
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

          <div class="acciones">
            <mat-checkbox [(ngModel)]="guardarPlantilla">Guardar como plantilla de este banco</mat-checkbox>
            <span class="spacer"></span>
            <button mat-button (click)="paso.set('archivo')">Atrás</button>
            <button mat-flat-button color="primary" [disabled]="importando()" (click)="importar()">
              <mat-icon>publish</mat-icon>
              {{ importando() ? 'Importando…' : 'Importar movimientos' }}
            </button>
          </div>
          @if (importando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </section>
      }

      @if (paso() === 'resumen' && resultado()) {
        <section class="surface-card card resumen">
          <div class="pills">
            <span class="pill pill-success">{{ resultado()!.importadas }} importadas</span>
            <span class="pill pill-muted">{{ resultado()!.duplicadas }} duplicadas (omitidas)</span>
            <span class="pill" [class]="resultado()!.errores.length ? 'pill-void' : 'pill-muted'">
              {{ resultado()!.errores.length }} errores
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
    .mapeo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
    .preview-wrap { overflow-x: auto; }
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
    .errores { margin: 0; padding-left: 1.2rem; color: var(--destructive); display: grid; gap: .2rem; }
    @media (max-width: 900px) { .mapeo-grid { grid-template-columns: 1fr; } }
  `]
})
export class ExtractoImportComponent {
  private readonly api = inject(BancosApiService);
  private readonly cuentasService = inject(BancosCuentasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly previewColumnas = ['fila', 'fecha', 'descripcion', 'referencia', 'monto'];
  protected readonly paso = signal<PasoImportacion>('archivo');
  protected readonly cuentas = signal<CuentaBancaria[]>([]);
  protected readonly analizando = signal(false);
  protected readonly importando = signal(false);
  protected readonly analisis = signal<AnalisisExtracto | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);

  protected cuentaSeleccionadaId: string | null = null;
  protected guardarPlantilla = true;
  protected mapeoEditable!: MapeoExtracto;
  protected referenciaCol: number | null = null;
  protected debitoCol: number | null = null;
  protected creditoCol: number | null = null;
  protected saldoCol: number | null = null;
  private archivoActual: ArchivoItem | null = null;

  protected readonly encabezadosOpciones = computed(() => {
    const encabezados = this.analisis()?.encabezados ?? [];
    return encabezados.map((nombre, col) => ({
      col,
      label: `${col + 1}. ${nombre || '(sin título)'}`
    }));
  });

  constructor() {
    this.cuentasService.getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentas.set(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA')));
  }

  protected async onArchivoSubido(archivo: ArchivoItem): Promise<void> {
    if (!this.cuentaSeleccionadaId) {
      return;
    }
    this.archivoActual = archivo;
    this.analizando.set(true);
    try {
      const analisis = await this.api.analizarExtracto(this.cuentaSeleccionadaId, archivo.storagePath, archivo.name);
      this.analisis.set(analisis);
      this.mapeoEditable = structuredClone(analisis.mapeo);
      this.referenciaCol = analisis.mapeo.mapeo.referencia?.col ?? null;
      this.debitoCol = analisis.mapeo.mapeo.debito?.col ?? analisis.mapeo.mapeo.montoUnico?.col ?? null;
      this.creditoCol = analisis.mapeo.mapeo.credito?.col ?? null;
      this.saldoCol = analisis.mapeo.mapeo.saldo?.col ?? null;
      this.paso.set('mapeo');
    } catch (error) {
      const mensaje = (error as { error?: { message?: string } })?.error?.message
        ?? 'No se pudo analizar el extracto. Verifica el archivo.';
      this.snackBar.open(mensaje, 'OK', { duration: 5000 });
    } finally {
      this.analizando.set(false);
    }
  }

  protected async importar(): Promise<void> {
    if (!this.cuentaSeleccionadaId || !this.archivoActual || !this.analisis()) {
      return;
    }
    this.importando.set(true);
    try {
      const mapeo = this.construirMapeo();
      const resultado = await this.api.importarExtracto({
        cuentaBancariaId: this.cuentaSeleccionadaId,
        storagePath: this.archivoActual.storagePath,
        nombreArchivo: this.archivoActual.name,
        mapeo,
        guardarPlantilla: this.guardarPlantilla,
        plantillaId: this.analisis()?.plantillaId ?? null
      });
      this.resultado.set(resultado);
      this.paso.set('resumen');
    } catch (error) {
      const mensaje = (error as { error?: { message?: string } })?.error?.message
        ?? 'No se pudo importar el extracto.';
      this.snackBar.open(mensaje, 'OK', { duration: 5000 });
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

  protected reiniciar(): void {
    this.analisis.set(null);
    this.resultado.set(null);
    this.archivoActual = null;
    this.paso.set('archivo');
  }
}

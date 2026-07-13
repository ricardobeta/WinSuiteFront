import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';
import { Database, objectVal, ref } from '@angular/fire/database';
import { finalize } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SriDescargasService } from '../../../../core/services/sri-descargas.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { SRI_TIPOS_COMPROBANTE, SRI_TIPO_COMPROBANTE_DEFAULT, SriDownloadJob } from '../../../../shared/models/sri.models';

@Component({
  selector: 'app-sri-descargas-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="sri-page">
      <div class="toolbar surface-card">
        <div>
          <p class="eyebrow">SRI Ecuador</p>
          <h2>Facturas recibidas</h2>
          <p>Descarga XML y PDF/RIDE de compras autorizadas, con control de cuota del modulo Archivos.</p>
        </div>
        <div class="toolbar-actions">
          <a mat-stroked-button [href]="agentDownloadUrl" target="_blank" rel="noopener">
            <mat-icon>download</mat-icon>
            Descargar agente
          </a>
          <button mat-stroked-button type="button" (click)="loadJobs()" [disabled]="loadingJobs()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>
      </div>

      <div class="grid">
        <mat-card appearance="outlined" class="surface-card">
          <mat-card-header>
            <mat-card-title>Credenciales SRI</mat-card-title>
            <mat-card-subtitle>Se guardan cifradas SOLO en tu equipo (agente local); nunca en la nube</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form class="form" [formGroup]="configForm" (ngSubmit)="saveConfig()">
              <mat-form-field appearance="outline">
                <mat-label>RUC o cedula</mat-label>
                <input matInput formControlName="ruc" maxlength="13" autocomplete="off" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Usuario SRI</mat-label>
                <input matInput formControlName="usuario" autocomplete="off" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Clave SRI</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
              </mat-form-field>

              <div class="actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="configForm.invalid || savingConfig()">
                  <mat-icon>vpn_key</mat-icon>
                  {{ savingConfig() ? 'Guardando...' : 'Guardar en el agente local' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="surface-card">
          <mat-card-header>
            <mat-card-title>Descarga manual</mat-card-title>
            <mat-card-subtitle>Elige un dia especifico o un mes completo (maximo hasta ayer)</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="conn-row">
              <button mat-stroked-button type="button" (click)="checkConnection()" [disabled]="connStatus() === 'checking'">
                <mat-icon>lan</mat-icon>
                {{ connStatus() === 'checking' ? 'Comprobando...' : 'Comprobar conexion' }}
              </button>
              @if (connStatus() === 'ok') {
                <span class="conn-badge conn-ok"><mat-icon>check_circle</mat-icon>{{ connMessage() }}</span>
              }
              @if (connStatus() === 'fail') {
                <span class="conn-badge conn-fail"><mat-icon>error</mat-icon>{{ connMessage() }}</span>
                <a mat-stroked-button [href]="agentDownloadUrl" target="_blank" rel="noopener">
                  <mat-icon>download</mat-icon>
                  Descargar agente
                </a>
              }
            </div>

            @if (connStatus() === 'ok' || connStatus() === 'fail') {
              <div class="version-row" [class.version-outdated]="versionDesactualizada()">
                <mat-icon>{{ versionDesactualizada() ? 'system_update' : 'verified' }}</mat-icon>
                <span>Agente v{{ workerVersion() || 'desconocida' }}</span>
                <span class="version-sep">·</span>
                <span>requiere v{{ requiredVersion }}</span>
              </div>
            }

            <form class="form" [formGroup]="downloadForm" (ngSubmit)="startDownload()">
              <mat-button-toggle-group
                class="mode-toggle"
                [value]="modo()"
                (change)="setModo($event.value)"
                aria-label="Modo de descarga">
                <mat-button-toggle value="dia">
                  <mat-icon>event</mat-icon>
                  Dia especifico
                </mat-button-toggle>
                <mat-button-toggle value="mes">
                  <mat-icon>calendar_month</mat-icon>
                  Mes completo
                </mat-button-toggle>
              </mat-button-toggle-group>

              <mat-form-field appearance="outline">
                <mat-label>Tipo de comprobante</mat-label>
                <mat-select formControlName="tipoComprobante">
                  @for (tipo of tiposComprobante; track tipo.value) {
                    <mat-option [value]="tipo.value">{{ tipo.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (modo() === 'dia') {
                <mat-form-field appearance="outline">
                  <mat-label>Fecha</mat-label>
                  <input matInput [matDatepicker]="fechaPicker" formControlName="fecha" [max]="maxDownloadDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="fechaPicker"></mat-datepicker-toggle>
                  <mat-datepicker #fechaPicker></mat-datepicker>
                </mat-form-field>
              } @else {
                <div class="date-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Mes</mat-label>
                    <mat-select formControlName="mes">
                      @for (m of meses; track m.value) {
                        <mat-option [value]="m.value">{{ m.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Año</mat-label>
                    <mat-select formControlName="anio">
                      @for (y of anios; track y) {
                        <mat-option [value]="y">{{ y }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <p class="mode-hint">Se descargaran todos los comprobantes del mes seleccionado.</p>
              }

              @if (downloadError()) {
                <p class="form-error">{{ downloadError() }}</p>
              }

              <div class="actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="downloadForm.invalid || startingDownload() || !!downloadError() || connStatus() !== 'ok' || !credsConfigured()">
                  <mat-icon>cloud_download</mat-icon>
                  {{ startingDownload() ? 'Iniciando...' : 'Descargar XML y PDF' }}
                </button>
                @if (connStatus() !== 'ok') {
                  <span class="conn-hint">Comprueba la conexion para habilitar la descarga.</span>
                } @else if (!credsConfigured()) {
                  <span class="conn-hint">Guarda las credenciales SRI en el agente para habilitar la descarga.</span>
                }
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>

      @if (activeJob(); as job) {
        <mat-card appearance="outlined" class="surface-card status-card">
          <mat-card-header>
            <mat-card-title>Descarga en curso</mat-card-title>
            <mat-card-subtitle>{{ progresoLabel(job) || statusLabel(job.status) }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <div class="metrics">
              <span>Encontradas: {{ job.totalEncontradas }}</span>
              <span>XML: {{ job.xmlGuardados }}</span>
              <span>PDF: {{ job.pdfGuardados }}</span>
              <span>Duplicados: {{ job.duplicados }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <mat-card appearance="outlined" class="surface-card history-card">
        <mat-card-header>
          <mat-card-title>Historial</mat-card-title>
          <mat-card-subtitle>{{ jobs().length }} ejecuciones</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-data-table-frame
            searchPlaceholder="Buscar ejecución o diagnóstico"
            [total]="jobsFiltrados().length"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            (searchChange)="actualizarBusqueda($event)"
            (pageChange)="actualizarPagina($event)"
          >
          <table mat-table [dataSource]="jobsPaginados()" class="history-table">
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'short' }}</td>
            </ng-container>
            <ng-container matColumnDef="rango">
              <th mat-header-cell *matHeaderCellDef>Rango</th>
              <td mat-cell *matCellDef="let row">{{ row.fechaInicio || '-' }} a {{ row.fechaFin || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="modo">
              <th mat-header-cell *matHeaderCellDef>Modo</th>
              <td mat-cell *matCellDef="let row">{{ row.modo === 'scheduled' ? 'Batch' : 'Manual' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let row">{{ statusLabel(row.status) }}</td>
            </ng-container>
            <ng-container matColumnDef="archivos">
              <th mat-header-cell *matHeaderCellDef>Archivos</th>
              <td mat-cell *matCellDef="let row">XML {{ row.xmlGuardados }} / PDF {{ row.pdfGuardados }}</td>
            </ng-container>
            <ng-container matColumnDef="diagnostico">
              <th mat-header-cell *matHeaderCellDef>Diagnostico</th>
              <td mat-cell *matCellDef="let row">
                <div class="diagnostic-counts">
                  <span>{{ row.duplicados }} dup.</span>
                  <span>{{ row.omitidosCuota }} cuota</span>
                  <span>{{ row.errores?.length || 0 }} err.</span>
                </div>
                @if (firstDiagnostic(row); as diagnostic) {
                  <p class="diagnostic-message" [class.error]="diagnostic.type === 'error'">
                    {{ diagnostic.message }}
                  </p>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
          </app-data-table-frame>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .sri-page { display: grid; gap: 1rem; }
    .toolbar { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; background: var(--tc-surface-container-lowest); }
    .toolbar h2 { margin: 0; font-size: 1.5rem; }
    .toolbar p { margin: .35rem 0 0; color: var(--muted-foreground); max-width: 72ch; }
    .toolbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    .form { display: grid; gap: .9rem; padding-top: .75rem; }
    .date-row, .schedule-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; align-items: center; }
    .mode-toggle { align-self: start; }
    .mode-hint { margin: 0; color: var(--muted-foreground); font-size: .82rem; }
    .conn-row { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .5rem; }
    .conn-badge { display: inline-flex; align-items: center; gap: .3rem; font-size: .85rem; font-weight: 600; }
    .conn-badge mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .conn-ok { color: var(--tc-success); }
    .conn-fail { color: var(--tc-error); }
    .conn-hint { align-self: center; color: var(--muted-foreground); font-size: .8rem; }
    .version-row { display: inline-flex; align-items: center; gap: .35rem; margin: -.25rem 0 .5rem; font-size: .8rem; font-weight: 600; color: var(--tc-success); }
    .version-row mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }
    .version-row .version-sep { color: var(--muted-foreground); font-weight: 400; }
    .version-row.version-outdated { color: var(--tc-error); }
    .actions { display: flex; justify-content: flex-end; gap: .75rem; align-items: center; }
    .form-error { margin: 0; color: var(--tc-error); font-weight: 600; }
    .status-card mat-progress-bar { margin: .5rem 0 1rem; }
    .metrics { display: flex; flex-wrap: wrap; gap: .75rem; color: var(--muted-foreground); }
    .history-table { width: 100%; }
    .diagnostic-counts span { display: inline-flex; margin-right: .5rem; }
    .diagnostic-message { margin: .25rem 0 0; max-width: 42rem; white-space: normal; color: var(--muted-foreground); font-size: .82rem; line-height: 1.35; }
    .diagnostic-message.error { color: #b42318; font-weight: 600; }
    @media (max-width: 900px) {
      .toolbar { flex-direction: column; align-items: start; }
      .grid, .date-row, .schedule-row { grid-template-columns: 1fr; }
    }
  `]
})
export class SriDescargasPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly service = inject(SriDescargasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly db = inject(Database);

  protected readonly agentDownloadUrl = 'https://drive.google.com/uc?export=download&id=1GgcP0nnFRZOS988380FUNq_OibiwmyeF';
  protected readonly maxDownloadDate = this.addDays(new Date(), -1);
  protected readonly jobs = signal<SriDownloadJob[]>([]);
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly jobsFiltrados = computed(() => {
    const query = this.normalizar(this.busqueda());
    if (!query) return this.jobs();
    return this.jobs().filter((job) => this.normalizar(JSON.stringify(job)).includes(query));
  });
  protected readonly jobsPaginados = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.jobsFiltrados().slice(start, start + this.pageSize());
  });
  protected readonly loadingJobs = signal(false);
  protected readonly savingConfig = signal(false);
  protected readonly startingDownload = signal(false);
  protected readonly activeJob = signal<SriDownloadJob | null>(null);
  protected readonly columns = ['createdAt', 'rango', 'modo', 'status', 'archivos', 'diagnostico'];

  protected actualizarBusqueda(value: string): void {
    this.busqueda.set(value);
    this.pageIndex.set(0);
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  private normalizar(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  protected readonly configForm = this.formBuilder.nonNullable.group({
    ruc: ['', [Validators.required, Validators.pattern(/^[0-9]{10,13}$/)]],
    usuario: [''],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  protected readonly connStatus = signal<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  protected readonly connMessage = signal<string>('');
  protected readonly credsConfigured = signal<boolean>(false);
  protected readonly workerVersion = signal<string>('');
  protected readonly requiredVersion = environment.sriWorkerMinVersion;
  // true si el agente reportado esta desactualizado o no reporto version.
  protected readonly versionDesactualizada = computed(() => this.isWorkerOutdated(this.workerVersion()));

  protected readonly modo = signal<'dia' | 'mes'>('dia');

  protected checkConnection(): void {
    this.connStatus.set('checking');
    this.connMessage.set('');
    this.service.checkConnection().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.credsConfigured.set(!!res.credencialesConfiguradas);
        this.workerVersion.set(res.version ?? '');
        // Control de version: si el agente reporta una version inferior a la
        // requerida (o no reporta version), se bloquea la descarga.
        if (this.isWorkerOutdated(res.version)) {
          this.connStatus.set('fail');
          this.connMessage.set(
            `Agente SRI desactualizado (versión ${res.version || 'desconocida'}). ` +
            `Actualiza a la ${this.requiredVersion} o superior para continuar.`
          );
          return;
        }
        if (res.ready) {
          this.connStatus.set('ok');
          this.connMessage.set(`Agente local (v${res.version}) y servidor conectados.`);
        } else {
          this.connStatus.set('fail');
          this.connMessage.set(
            res.worker === 'ok'
              ? `El agente responde, pero el servidor falló (${res.springDetail || res.spring}).`
              : 'No se pudo verificar la conexión.'
          );
        }
      },
      error: () => {
        this.connStatus.set('fail');
        this.connMessage.set('No se detecta el agente local. ¿Está instalado y en ejecución?');
      }
    });
  }
  protected readonly meses = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];
  protected readonly anios = this.buildYearOptions();
  protected readonly tiposComprobante = SRI_TIPOS_COMPROBANTE;

  protected readonly downloadForm = this.formBuilder.nonNullable.group({
    fecha: [this.addDays(new Date(), -1), [Validators.required]],
    mes: [this.maxDownloadDate.getMonth() + 1, [Validators.required]],
    anio: [this.maxDownloadDate.getFullYear(), [Validators.required]],
    tipoComprobante: [SRI_TIPO_COMPROBANTE_DEFAULT, [Validators.required]]
  });

  protected setModo(modo: 'dia' | 'mes'): void {
    this.modo.set(modo);
  }

  /** true si el worker no reporta version o es inferior a la requerida. */
  private isWorkerOutdated(workerVersion?: string): boolean {
    if (!this.requiredVersion) {
      return false;
    }
    return this.compareVersions(workerVersion ?? '', this.requiredVersion) < 0;
  }

  /** Compara versiones "1.0.14" numericamente por segmento: -1, 0 o 1. */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
    const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
      if (diff !== 0) {
        return diff > 0 ? 1 : -1;
      }
    }
    return 0;
  }

  protected downloadError(): string | null {
    if (this.modo() === 'dia') {
      const fecha = this.downloadForm.controls.fecha.value;
      if (!fecha) {
        return null;
      }
      if (fecha > this.maxDownloadDate) {
        return 'El SRI no permite descargar comprobantes del dia actual o futuro.';
      }
      return null;
    }
    const primerDia = this.firstDayOfSelectedMonth();
    if (primerDia > this.maxDownloadDate) {
      return 'El mes seleccionado es futuro; el SRI no permite descargar comprobantes del dia actual o futuro.';
    }
    return null;
  }

  constructor() {
    this.loadJobs();
  }

  protected saveConfig(): void {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }
    const raw = this.configForm.getRawValue();
    this.savingConfig.set(true);
    // Las credenciales se guardan SOLO en el worker local (nunca en el cloud).
    this.service.saveWorkerConfig({
      ruc: raw.ruc,
      usuario: raw.usuario || raw.ruc,
      password: raw.password
    }).pipe(finalize(() => this.savingConfig.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.credsConfigured.set(true);
        this.showMessage('Credenciales SRI guardadas en el agente local.', 'save');
      },
      error: () => this.showMessage('No se pudo guardar en el agente local. Verifica que este en ejecucion.', 'error')
    });
  }

  protected startDownload(): void {
    if (this.downloadForm.invalid || this.downloadError()) {
      this.downloadForm.markAllAsTouched();
      return;
    }
    if (this.connStatus() !== 'ok') {
      this.showMessage('Comprueba la conexion antes de descargar.', 'error');
      return;
    }
    if (!this.credsConfigured()) {
      this.showMessage('Configura y guarda las credenciales SRI en el agente local.', 'error');
      return;
    }
    const { inicio, fin } = this.resolveRange();
    const { anio, mes, tipoComprobante } = this.downloadForm.getRawValue();
    // Modo dia => se envia el dia concreto; modo mes => dia=null para que el worker
    // seleccione "Todos" y descargue el mes completo con un solo captcha.
    const periodo = this.modo() === 'dia'
      ? { anio: inicio.getFullYear(), mes: inicio.getMonth() + 1, dia: inicio.getDate() }
      : { anio, mes, dia: null };
    this.startingDownload.set(true);
    // Paso 1: crear el job en Spring (ID + estado inicial en Realtime DB).
    this.service.startDownload({
      fechaInicio: this.toApiDate(inicio),
      fechaFin: this.toApiDate(fin),
      tipoComprobante,
      ...periodo
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (job) => {
        this.activeJob.set(job);
        this.jobs.update((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        this.watchJob(job);
        // Paso 2: disparar la descarga en el worker local (usa credenciales locales).
        this.service.runOnWorker({
          jobId: job.id,
          tenantId: job.tenantId,
          ...periodo,
          tipoComprobante,
          descargarXml: true,
          descargarPdf: true
        }).pipe(finalize(() => this.startingDownload.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => this.showMessage('Descarga SRI iniciada en el agente local.', 'cloud_download'),
          error: () => this.showMessage('No se pudo iniciar la descarga en el agente local.', 'error')
        });
      },
      error: () => {
        this.startingDownload.set(false);
        this.showMessage('No se pudo crear la descarga SRI.', 'error');
      }
    });
  }

  protected loadJobs(): void {
    this.loadingJobs.set(true);
    this.service.listJobs().pipe(finalize(() => this.loadingJobs.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (jobs) => this.jobs.set(jobs),
      error: () => this.showMessage('No se pudo cargar el historial SRI.', 'error')
    });
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      queued: 'En cola',
      running: 'En ejecucion',
      completed: 'Completada',
      completed_with_warnings: 'Completada con alertas',
      failed: 'Fallida',
      cancelled: 'Cancelada',
      config_saved: 'Configuracion guardada'
    };
    return labels[status] ?? status;
  }

  protected progresoLabel(job: SriDownloadJob): string | null {
    const progreso = job.metadata?.['progreso'] as string | undefined;
    if (!progreso) {
      return null;
    }
    const labels: Record<string, string> = {
      INICIA_PROCESO: 'Iniciando proceso',
      LOGIN: 'Iniciando sesion en el SRI',
      PANTALLA_DESCARGA: 'Abriendo pantalla de descarga',
      DESCARGANDO: 'Descargando comprobantes',
      FINALIZADO: 'Finalizado',
      ERROR: 'Error'
    };
    return labels[progreso] ?? progreso;
  }

  protected firstDiagnostic(job: SriDownloadJob): { type: 'error' | 'warning'; message: string } | null {
    const firstError = job.errores?.find((message) => !!message?.trim());
    if (firstError) {
      return { type: 'error', message: firstError };
    }
    const firstWarning = job.advertencias?.find((message) => !!message?.trim());
    if (firstWarning) {
      return { type: 'warning', message: firstWarning };
    }
    return null;
  }

  private watchJob(job: SriDownloadJob): void {
    // Escucha el nodo del job en Realtime Database; el worker (via Spring) va
    // actualizando estado y contadores en tiempo real.
    const path = `sri_descargas/${job.tenantId}/${job.id}`;
    objectVal<SriDownloadJob>(ref(this.db, path)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        if (!updated) {
          return;
        }
        const merged: SriDownloadJob = { ...updated, id: job.id, tenantId: job.tenantId };
        this.activeJob.set(this.isActive(merged) ? merged : null);
        this.jobs.update((current) => [merged, ...current.filter((item) => item.id !== merged.id)]);
      }
    });
  }

  private isActive(job: SriDownloadJob): boolean {
    return job.status === 'queued' || job.status === 'running';
  }

  private firstDayOfSelectedMonth(): Date {
    const { mes, anio } = this.downloadForm.getRawValue();
    const first = new Date(anio, mes - 1, 1);
    first.setHours(0, 0, 0, 0);
    return first;
  }

  private resolveRange(): { inicio: Date; fin: Date } {
    if (this.modo() === 'dia') {
      const fecha = this.downloadForm.controls.fecha.value;
      return { inicio: fecha, fin: fecha };
    }
    const { mes, anio } = this.downloadForm.getRawValue();
    const inicio = this.firstDayOfSelectedMonth();
    const ultimoDia = new Date(anio, mes, 0);
    ultimoDia.setHours(0, 0, 0, 0);
    // El SRI no permite el dia actual ni futuros: tope el fin en maxDownloadDate.
    const fin = ultimoDia > this.maxDownloadDate ? this.maxDownloadDate : ultimoDia;
    return { inicio, fin };
  }

  private buildYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2];
  }

  private toApiDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(value: Date, days: number): Date {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private showMessage(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

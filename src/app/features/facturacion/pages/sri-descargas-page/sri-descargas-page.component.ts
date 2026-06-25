import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { finalize, interval, startWith, switchMap, takeWhile } from 'rxjs';

import { SriDescargasService } from '../../../../core/services/sri-descargas.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { SriDownloadJob, SriFrecuencia } from '../../../../shared/models/sri.models';

@Component({
  selector: 'app-sri-descargas-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule
  ],
  template: `
    <section class="sri-page">
      <div class="toolbar surface-card">
        <div>
          <p class="eyebrow">SRI Ecuador</p>
          <h2>Facturas recibidas</h2>
          <p>Descarga XML y PDF/RIDE de compras autorizadas, con control de cuota del modulo Archivos.</p>
        </div>
        <button mat-stroked-button type="button" (click)="loadJobs()" [disabled]="loadingJobs()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </div>

      <div class="grid">
        <mat-card appearance="outlined" class="surface-card">
          <mat-card-header>
            <mat-card-title>Credenciales y batch</mat-card-title>
            <mat-card-subtitle>La clave se guarda protegida para tus procesos autorizados</mat-card-subtitle>
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

              <div class="schedule-row">
                <mat-slide-toggle color="primary" formControlName="activa">Batch activo</mat-slide-toggle>
                <mat-form-field appearance="outline">
                  <mat-label>Frecuencia</mat-label>
                  <mat-select formControlName="frecuencia">
                    <mat-option value="diaria">Diaria</mat-option>
                    <mat-option value="semanal">Semanal</mat-option>
                    <mat-option value="mensual">Mensual</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="configForm.invalid || savingConfig()">
                  <mat-icon>vpn_key</mat-icon>
                  {{ savingConfig() ? 'Guardando...' : 'Guardar configuracion' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="surface-card">
          <mat-card-header>
            <mat-card-title>Descarga manual</mat-card-title>
            <mat-card-subtitle>El rango debe terminar maximo ayer</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form class="form" [formGroup]="downloadForm" (ngSubmit)="startDownload()">
              <div class="date-row">
                <mat-form-field appearance="outline">
                  <mat-label>Fecha inicio</mat-label>
                  <input matInput [matDatepicker]="inicioPicker" formControlName="fechaInicio" [max]="maxDownloadDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="inicioPicker"></mat-datepicker-toggle>
                  <mat-datepicker #inicioPicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha fin</mat-label>
                  <input matInput [matDatepicker]="finPicker" formControlName="fechaFin" [max]="maxDownloadDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="finPicker"></mat-datepicker-toggle>
                  <mat-datepicker #finPicker></mat-datepicker>
                </mat-form-field>
              </div>

              @if (downloadError()) {
                <p class="form-error">{{ downloadError() }}</p>
              }

              <div class="actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="downloadForm.invalid || startingDownload() || !!downloadError()">
                  <mat-icon>cloud_download</mat-icon>
                  {{ startingDownload() ? 'Iniciando...' : 'Descargar XML y PDF' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>

      @if (activeJob(); as job) {
        <mat-card appearance="outlined" class="surface-card status-card">
          <mat-card-header>
            <mat-card-title>Descarga en curso</mat-card-title>
            <mat-card-subtitle>{{ statusLabel(job.status) }}</mat-card-subtitle>
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
          <table mat-table [dataSource]="jobs()" class="history-table">
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
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .sri-page { display: grid; gap: 1rem; }
    .toolbar { padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; gap: 1rem; align-items: end; background: var(--tc-surface-container-lowest); }
    .toolbar h2 { margin: 0; font-size: 1.5rem; }
    .toolbar p { margin: .35rem 0 0; color: var(--muted-foreground); max-width: 72ch; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    .form { display: grid; gap: .9rem; padding-top: .75rem; }
    .date-row, .schedule-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; align-items: center; }
    .actions { display: flex; justify-content: flex-end; }
    .form-error { margin: 0; color: #b42318; font-weight: 600; }
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

  protected readonly maxDownloadDate = this.addDays(new Date(), -1);
  protected readonly jobs = signal<SriDownloadJob[]>([]);
  protected readonly loadingJobs = signal(false);
  protected readonly savingConfig = signal(false);
  protected readonly startingDownload = signal(false);
  protected readonly activeJob = signal<SriDownloadJob | null>(null);
  protected readonly columns = ['createdAt', 'rango', 'modo', 'status', 'archivos', 'diagnostico'];

  protected readonly configForm = this.formBuilder.nonNullable.group({
    ruc: ['', [Validators.required, Validators.pattern(/^[0-9]{10,13}$/)]],
    usuario: [''],
    password: ['', [Validators.required, Validators.minLength(4)]],
    activa: [false],
    frecuencia: ['diaria' as SriFrecuencia]
  });

  protected readonly downloadForm = this.formBuilder.nonNullable.group({
    fechaInicio: [this.addDays(new Date(), -1), [Validators.required]],
    fechaFin: [this.addDays(new Date(), -1), [Validators.required]]
  });

  protected downloadError(): string | null {
    const { fechaInicio, fechaFin } = this.downloadForm.getRawValue();
    if (!fechaInicio || !fechaFin) {
      return null;
    }
    if (fechaFin < fechaInicio) {
      return 'La fecha fin no puede ser anterior a la fecha inicio.';
    }
    if (fechaFin > this.maxDownloadDate) {
      return 'El SRI no permite descargar comprobantes del dia actual o futuro.';
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
    this.service.saveConfig({
      ruc: raw.ruc,
      usuario: raw.usuario || raw.ruc,
      password: raw.password,
      programacion: {
        activa: raw.activa,
        frecuencia: raw.frecuencia,
        diaSemana: null,
        diaMes: null
      }
    }).pipe(finalize(() => this.savingConfig.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.showMessage('Configuracion SRI guardada.', 'save'),
      error: () => this.showMessage('No se pudo guardar la configuracion SRI.', 'error')
    });
  }

  protected startDownload(): void {
    if (this.downloadForm.invalid || this.downloadError()) {
      this.downloadForm.markAllAsTouched();
      return;
    }
    const raw = this.downloadForm.getRawValue();
    this.startingDownload.set(true);
    this.service.startDownload({
      fechaInicio: this.toApiDate(raw.fechaInicio),
      fechaFin: this.toApiDate(raw.fechaFin)
    }).pipe(finalize(() => this.startingDownload.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (job) => {
        this.activeJob.set(job);
        this.jobs.update((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        this.watchJob(job.id);
        this.showMessage('Descarga SRI iniciada.', 'cloud_download');
      },
      error: () => this.showMessage('No se pudo iniciar la descarga SRI.', 'error')
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

  private watchJob(jobId: string): void {
    interval(3000).pipe(
      startWith(0),
      switchMap(() => this.service.getJob(jobId)),
      takeWhile((job) => this.isActive(job), true),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (job) => {
        this.activeJob.set(this.isActive(job) ? job : null);
        this.jobs.update((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      }
    });
  }

  private isActive(job: SriDownloadJob): boolean {
    return job.status === 'queued' || job.status === 'running';
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

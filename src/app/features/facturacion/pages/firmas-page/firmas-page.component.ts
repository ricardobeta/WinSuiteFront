import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { FirmaDigitalConfig } from '../../../../shared/models/facturacion.models';

@Component({
	selector: 'app-firmas-page',
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		MatButtonModule,
		MatCardModule,
		MatDialogModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatSnackBarModule,
		MatTableModule,
		MatTooltipModule
	],
	template: `
		<section class="page-grid">
			<div class="hero surface-card">
				<div>
					<p class="eyebrow">Firmas digitales</p>
					<h2>Carga y administración de archivos .p12</h2>
					<p>
						Sube firmas de la empresa, revisa el listado precargado y deja lista la informacion operativa para el flujo de facturacion.
					</p>
				</div>
			</div>

			<div class="content-grid">
				<mat-card class="surface-card stat-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Cargar archivo .p12</mat-card-title>
					</mat-card-header>
					<mat-card-content>
						<form class="upload-form" [formGroup]="uploadForm" (ngSubmit)="subirFirma()">
							<mat-form-field appearance="outline">
								<mat-label>Contraseña del .p12</mat-label>
								<input matInput formControlName="password" type="password" />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>RUC</mat-label>
								<input matInput formControlName="ruc" maxlength="13" />
							</mat-form-field>

										<mat-form-field appearance="outline">
											<mat-label>Razón social</mat-label>
											<input matInput formControlName="razonSocial" />
										</mat-form-field>

										<mat-form-field appearance="outline">
											<mat-label>Nombre comercial</mat-label>
											<input matInput formControlName="nombreComercial" />
										</mat-form-field>

							<label class="file-picker surface-card" for="fileP12">
								<input id="fileP12" type="file" accept=".p12" (change)="onFileSelected($event)" />
								<mat-icon>attach_file</mat-icon>
								<span>{{ selectedFileName() || 'Seleccionar archivo .p12' }}</span>
							</label>

							<button mat-raised-button color="primary" type="submit" [disabled]="subiendo() || uploadForm.invalid || !selectedFile()">
								<mat-icon>upload_file</mat-icon>
								{{ subiendo() ? 'Subiendo...' : 'Subir firma' }}
							</button>
						</form>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card stat-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Listado de firmas</mat-card-title>
					</mat-card-header>
					<mat-card-content>
						<table mat-table [dataSource]="firmas()" class="mini-table">
							<ng-container matColumnDef="nombreArchivo">
								<th mat-header-cell *matHeaderCellDef>Archivo</th>
								<td mat-cell *matCellDef="let row">{{ row.nombreArchivo }}</td>
							</ng-container>
							<ng-container matColumnDef="nombreComercial">
								<th mat-header-cell *matHeaderCellDef>Nombre comercial</th>
								<td mat-cell *matCellDef="let row">{{ row.nombreComercial || '-' }}</td>
							</ng-container>
							<ng-container matColumnDef="ruc">
								<th mat-header-cell *matHeaderCellDef>RUC</th>
								<td mat-cell *matCellDef="let row">{{ row.ruc || '-' }}</td>
							</ng-container>
							<ng-container matColumnDef="razonSocial">
								<th mat-header-cell *matHeaderCellDef>Razón social</th>
								<td mat-cell *matCellDef="let row">{{ row.razonSocial || '-' }}</td>
							</ng-container>
							<ng-container matColumnDef="acciones">
								<th mat-header-cell *matHeaderCellDef>Acciones</th>
								<td mat-cell *matCellDef="let row">
									<button
										mat-icon-button
										color="warn"
										type="button"
										matTooltip="Eliminar firma"
										[disabled]="eliminandoId() === row.id"
										(click)="confirmarEliminarFirma(row)"
									>
										<mat-icon>{{ eliminandoId() === row.id ? 'hourglass_empty' : 'delete' }}</mat-icon>
									</button>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasFirmas"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasFirmas"></tr>
						</table>
					</mat-card-content>
				</mat-card>
			</div>
		</section>
	`,
	styles: [ `
		.page-grid { display: grid; gap: 1rem; }
		.hero { padding: 1.25rem 1.5rem; display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
		.hero h2 { margin: 0; font-size: 1.5rem; }
		.hero p { margin: .35rem 0 0; max-width: 72ch; color: var(--muted-foreground); }
		.eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
		.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
		.stat-card { padding: 0; }
		.upload-form { display: grid; gap: .75rem; }
		.file-picker {
			display: flex;
			gap: .5rem;
			align-items: center;
			padding: .75rem;
			cursor: pointer;
		}
		.file-picker input { display: none; }
		.mini-table { width: 100%; }
		@media (max-width: 900px) {
			.hero { flex-direction: column; align-items: start; }
			.content-grid { grid-template-columns: 1fr; }
		}
	` ]
})
export class FirmasPageComponent {
	private readonly formBuilder = inject(FormBuilder);
	private readonly destroyRef = inject(DestroyRef);
	private readonly dialog = inject(MatDialog);
	private readonly snackBar = inject(MatSnackBar);
	private readonly facturacionService = inject(FacturacionConfigService);

	protected readonly columnasFirmas = ['nombreArchivo', 'nombreComercial', 'ruc', 'razonSocial', 'acciones'];
	protected readonly firmas = signal<FirmaDigitalConfig[]>([]);
	protected readonly subiendo = signal(false);
	protected readonly eliminandoId = signal<string | null>(null);
	protected readonly selectedFile = signal<File | null>(null);
	protected readonly selectedFileName = signal('');

	protected readonly uploadForm = this.formBuilder.nonNullable.group({
		password: ['', [Validators.required]],
		ruc: ['', [Validators.required, Validators.pattern(/^[0-9]{13}$/)]],
		razonSocial: ['', [Validators.required]],
		nombreComercial: ['', [Validators.required]]
	});

	constructor() {
		this.facturacionService.getFirmasDisponibles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (firmas) => this.firmas.set(firmas),
			error: () => this.mostrarMensaje('No se pudieron cargar las firmas.', 'error')
		});
	}

	protected onFileSelected(event: Event): void {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0] ?? null;

		if (file && !file.name.toLowerCase().endsWith('.p12')) {
			this.selectedFile.set(null);
			this.selectedFileName.set('');
			this.mostrarMensaje('Solo se permiten archivos .p12', 'error');
			return;
		}

		this.selectedFile.set(file);
		this.selectedFileName.set(file?.name ?? '');
	}

	protected subirFirma(): void {
		if (this.uploadForm.invalid || !this.selectedFile()) {
			this.uploadForm.markAllAsTouched();
			return;
		}

		const file = this.selectedFile();
		if (!file) {
			return;
		}

		const { password, ruc, razonSocial, nombreComercial } = this.uploadForm.getRawValue();
		this.subiendo.set(true);

		this.facturacionService.uploadFirma(file, password, ruc, razonSocial, nombreComercial).subscribe({
			next: () => {
				this.subiendo.set(false);
				this.uploadForm.reset({ password: '', ruc: '', razonSocial: '', nombreComercial: '' });
				this.selectedFile.set(null);
				this.selectedFileName.set('');
				this.mostrarMensaje('Firma cargada correctamente.', 'upload_file');
			},
			error: () => {
				this.subiendo.set(false);
				this.mostrarMensaje('No se pudo cargar la firma.', 'error');
			}
		});
	}

	protected confirmarEliminarFirma(firma: FirmaDigitalConfig): void {
		if (!firma.id) {
			this.mostrarMensaje('No se pudo identificar la firma.', 'error');
			return;
		}

		const nombre = firma.nombreComercial || firma.nombreArchivo;
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			width: '420px',
			data: {
				title: 'Eliminar firma',
				message: `Deseas eliminar ${nombre}? Se borrara el archivo de firma y su registro operativo.`,
				confirmText: 'Eliminar'
			}
		});

		dialogRef.afterClosed().subscribe((confirmado) => {
			if (!confirmado) {
				return;
			}

			this.eliminandoId.set(firma.id);
			this.facturacionService.eliminarFirma(firma.id).subscribe({
				next: () => {
					this.eliminandoId.set(null);
					this.mostrarMensaje('Firma eliminada correctamente.', 'delete');
				},
				error: () => {
					this.eliminandoId.set(null);
					this.mostrarMensaje('No se pudo eliminar la firma.', 'error');
				}
			});
		});
	}

	private mostrarMensaje(message: string, icon: string): void {
		this.snackBar.openFromComponent(SuccessSnackbarComponent, {
			data: { message, icon },
			duration: 2600,
			horizontalPosition: 'end',
			verticalPosition: 'top'
		});
	}
}

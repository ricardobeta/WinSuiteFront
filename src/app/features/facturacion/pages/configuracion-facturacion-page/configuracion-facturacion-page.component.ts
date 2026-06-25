import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import {
	CatalogosFacturacion,
	ConfiguracionCorreoFactura,
	ConfiguracionFacturacion,
	EstablecimientoConfig,
	FirmaDigitalConfig,
	PuntoEmisionConfig
} from '../../../../shared/models/facturacion.models';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { Almacen } from '../../../inventario/models/inventario.models';

@Component({
	selector: 'app-configuracion-facturacion-page',
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		MatButtonModule,
		MatCardModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatSnackBarModule,
		MatTableModule
	],
	template: `
		<section class="page-grid">
			<div class="hero surface-card">
				<div>
					<p class="eyebrow">Configuración</p>
					<h2>Catálogos, ambientes, establecimientos y puntos de emisión</h2>
					<p>
						Activa catálogos permitidos para facturación, define ambiente, gestiona establecimientos (sucursales) y asigna puntos de emisión (terminales POS) con sus firmas digitales.
					</p>
				</div>
				<button mat-raised-button color="primary" type="button" (click)="guardarConfiguracion()" [disabled]="guardando() || cargandoCatalogos()">
					<mat-icon>save</mat-icon>
					{{ guardando() ? 'Guardando...' : 'Guardar configuración' }}
				</button>
			</div>

			<div class="content-grid">
				<mat-card class="surface-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Forma de pago</mat-card-title>
						<mat-card-subtitle>Selección múltiple</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<table mat-table [dataSource]="catalogos().formaPago" class="mini-table">
							<ng-container matColumnDef="value">
								<th mat-header-cell *matHeaderCellDef>Opción</th>
								<td mat-cell *matCellDef="let row">{{ row.value }}</td>
							</ng-container>
							<ng-container matColumnDef="toggle">
								<th mat-header-cell *matHeaderCellDef>Activo</th>
								<td mat-cell *matCellDef="let row">
									<mat-slide-toggle
										color="primary"
										[checked]="isActivoMultiple('formaPagoActivos', row.code)"
										(change)="toggleMultiple('formaPagoActivos', row.code, $event.checked)"
									></mat-slide-toggle>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasCatalogo"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasCatalogo"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Tipo de identificación</mat-card-title>
						<mat-card-subtitle>Selección múltiple</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<table mat-table [dataSource]="catalogos().tipoIdentificacion" class="mini-table">
							<ng-container matColumnDef="value">
								<th mat-header-cell *matHeaderCellDef>Opción</th>
								<td mat-cell *matCellDef="let row">{{ row.value }}</td>
							</ng-container>
							<ng-container matColumnDef="toggle">
								<th mat-header-cell *matHeaderCellDef>Activo</th>
								<td mat-cell *matCellDef="let row">
									<mat-slide-toggle
										color="primary"
										[checked]="isActivoMultiple('tipoIdentificacionActivos', row.code)"
										(change)="toggleMultiple('tipoIdentificacionActivos', row.code, $event.checked)"
									></mat-slide-toggle>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasCatalogo"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasCatalogo"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Ambiente</mat-card-title>
						<mat-card-subtitle>Selección única</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<table mat-table [dataSource]="catalogos().ambiente" class="mini-table">
							<ng-container matColumnDef="value">
								<th mat-header-cell *matHeaderCellDef>Opción</th>
								<td mat-cell *matCellDef="let row">{{ row.value }}</td>
							</ng-container>
							<ng-container matColumnDef="toggle">
								<th mat-header-cell *matHeaderCellDef>Activo</th>
								<td mat-cell *matCellDef="let row">
									<mat-slide-toggle
										color="primary"
										[checked]="isActivoUnico('ambienteActivo', row.code)"
										(change)="toggleUnico('ambienteActivo', row.code, $event.checked)"
									></mat-slide-toggle>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasCatalogo"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasCatalogo"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Código porcentaje IVA</mat-card-title>
						<mat-card-subtitle>Selección múltiple</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<table mat-table [dataSource]="catalogos().codigoPorcentajeIva" class="mini-table">
							<ng-container matColumnDef="value">
								<th mat-header-cell *matHeaderCellDef>Opción</th>
								<td mat-cell *matCellDef="let row">{{ row.value }}</td>
							</ng-container>
							<ng-container matColumnDef="toggle">
								<th mat-header-cell *matHeaderCellDef>Activo</th>
								<td mat-cell *matCellDef="let row">
									<mat-slide-toggle
										color="primary"
										[checked]="isActivoMultiple('codigoPorcentajeIvaActivos', row.code)"
										(change)="toggleMultiple('codigoPorcentajeIvaActivos', row.code, $event.checked)"
									></mat-slide-toggle>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasCatalogo"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasCatalogo"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card establecimientos-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Establecimientos (Sucursales)</mat-card-title>
						<mat-card-subtitle>Crea los establecimientos donde se emitirán facturas</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<form class="punto-form" [formGroup]="establecimientoForm" (ngSubmit)="agregarEstablecimiento()">
							<mat-form-field appearance="outline">
								<mat-label>Código establecimiento</mat-label>
								<input matInput formControlName="codigo" maxlength="3" placeholder="001" />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Nombre</mat-label>
								<input matInput formControlName="nombre" placeholder="Matriz, Sucursal Norte..." />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Dirección</mat-label>
								<input matInput formControlName="direccion" placeholder="Calle Principal 123..." />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Almacenes asociados</mat-label>
								<mat-select formControlName="almacenes" multiple>
									@for (almacen of almacenes(); track almacen.id) {
										<mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
									}
								</mat-select>
							</mat-form-field>

							<button mat-raised-button color="primary" type="submit" [disabled]="establecimientoForm.invalid">
								<mat-icon>add</mat-icon>
								Agregar establecimiento
							</button>
						</form>

						<table mat-table [dataSource]="configuracion().establecimientos" class="mini-table">
							<ng-container matColumnDef="codigo">
								<th mat-header-cell *matHeaderCellDef>Código</th>
								<td mat-cell *matCellDef="let row">{{ row.codigo }}</td>
							</ng-container>
							<ng-container matColumnDef="nombre">
								<th mat-header-cell *matHeaderCellDef>Nombre</th>
								<td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
							</ng-container>
							<ng-container matColumnDef="almacenes">
								<th mat-header-cell *matHeaderCellDef>Almacenes</th>
								<td mat-cell *matCellDef="let row">{{ nombreAlmacenesPorIds(row.almacenIds) }}</td>
							</ng-container>
							<ng-container matColumnDef="acciones">
								<th mat-header-cell *matHeaderCellDef>Acciones</th>
								<td mat-cell *matCellDef="let row">
									<button mat-icon-button color="warn" type="button" (click)="eliminarEstablecimiento(row.id)">
										<mat-icon>delete</mat-icon>
									</button>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasEstablecimientos"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasEstablecimientos"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card puntos-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Puntos de emisión (Terminales POS)</mat-card-title>
						<mat-card-subtitle>Crea puntos de venta para cada establecimiento y asigna firma digital</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<form class="punto-form" [formGroup]="puntoForm" (ngSubmit)="agregarPuntoEmision()">
							<mat-form-field appearance="outline">
								<mat-label>Establecimiento</mat-label>
								<mat-select formControlName="establecimientoId">
									@for (estab of configuracion().establecimientos; track estab.id) {
										<mat-option [value]="estab.id">{{ estab.codigo }} - {{ estab.nombre }}</mat-option>
									}
								</mat-select>
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Código punto</mat-label>
								<input matInput formControlName="codigo" maxlength="3" placeholder="001" />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Descripción</mat-label>
								<input matInput formControlName="descripcion" placeholder="Terminal 1, Caja Principal..." />
							</mat-form-field>

							<mat-form-field appearance="outline">
								<mat-label>Firma digital asignada</mat-label>
								<mat-select formControlName="firmaId">
									@for (firma of firmas(); track firma.id) {
										<mat-option [value]="firma.id">{{ etiquetaFirma(firma) }}</mat-option>
									}
								</mat-select>
							</mat-form-field>

							<button mat-raised-button color="primary" type="submit" [disabled]="puntoForm.invalid">
								<mat-icon>add</mat-icon>
								Agregar punto
							</button>
						</form>

						<table mat-table [dataSource]="configuracion().puntosEmision" class="mini-table">
							<ng-container matColumnDef="codigo">
								<th mat-header-cell *matHeaderCellDef>Código</th>
								<td mat-cell *matCellDef="let row">{{ row.codigo }}</td>
							</ng-container>
							<ng-container matColumnDef="establecimiento">
								<th mat-header-cell *matHeaderCellDef>Establecimiento</th>
								<td mat-cell *matCellDef="let row">{{ nombreEstablecimientoPorId(row.establecimientoId) }}</td>
							</ng-container>
							<ng-container matColumnDef="descripcion">
								<th mat-header-cell *matHeaderCellDef>Descripción</th>
								<td mat-cell *matCellDef="let row">{{ row.descripcion }}</td>
							</ng-container>
							<ng-container matColumnDef="firma">
								<th mat-header-cell *matHeaderCellDef>Firma</th>
								<td mat-cell *matCellDef="let row">{{ nombreFirmaPorId(row.firmaId) }}</td>
							</ng-container>
							<ng-container matColumnDef="acciones">
								<th mat-header-cell *matHeaderCellDef>Acciones</th>
								<td mat-cell *matCellDef="let row">
									<button mat-icon-button color="warn" type="button" (click)="eliminarPunto(row.id)">
										<mat-icon>delete</mat-icon>
									</button>
								</td>
							</ng-container>
							<tr mat-header-row *matHeaderRowDef="columnasPuntos"></tr>
							<tr mat-row *matRowDef="let row; columns: columnasPuntos"></tr>
						</table>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card fiscal-card" appearance="outlined">
					<mat-card-header>
						<mat-card-title>Datos tributarios del emisor</mat-card-title>
						<mat-card-subtitle>El RUC y la razón social se toman de la firma asignada</mat-card-subtitle>
					</mat-card-header>
					<mat-card-content>
						<form class="settings-form" [formGroup]="fiscalForm">
							<mat-form-field appearance="outline"><mat-label>Dirección matriz</mat-label><input matInput formControlName="direccionMatriz" /></mat-form-field>
							<mat-form-field appearance="outline"><mat-label>Contribuyente especial</mat-label><input matInput formControlName="contribuyenteEspecial" /></mat-form-field>
							<mat-form-field appearance="outline"><mat-label>Agente de retención</mat-label><input matInput formControlName="agenteRetencion" maxlength="8" /></mat-form-field>
							<mat-form-field appearance="outline"><mat-label>Logo para RIDE (URL)</mat-label><input matInput formControlName="logoUrl" /></mat-form-field>
							<mat-slide-toggle formControlName="obligadoContabilidad">Obligado a llevar contabilidad</mat-slide-toggle>
							<mat-slide-toggle formControlName="contribuyenteRimpe">Contribuyente Régimen RIMPE</mat-slide-toggle>
						</form>
					</mat-card-content>
				</mat-card>

				<mat-card class="surface-card email-card" appearance="outlined">
					<mat-card-header><mat-card-title>Envío de facturas por correo</mat-card-title><mat-card-subtitle>Envía RIDE y XML autorizado; si falla el SMTP propio se usa WinSuite</mat-card-subtitle></mat-card-header>
					<mat-card-content>
						<form class="settings-form" [formGroup]="correoForm" (ngSubmit)="guardarCorreo()">
							<mat-form-field appearance="outline"><mat-label>Remitente</mat-label><mat-select formControlName="mode"><mat-option value="SAAS_DEFAULT">Correo de WinSuite</mat-option><mat-option value="TENANT_SMTP">SMTP de la empresa</mat-option></mat-select></mat-form-field>
							@if (correoForm.controls.mode.value === 'TENANT_SMTP') {
								<mat-form-field appearance="outline"><mat-label>Servidor SMTP</mat-label><input matInput formControlName="host" placeholder="smtp.empresa.com" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Puerto</mat-label><input matInput type="number" formControlName="port" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Usuario</mat-label><input matInput formControlName="username" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Clave / clave de aplicación</mat-label><input matInput type="password" formControlName="password" [placeholder]="passwordConfigured() ? 'Dejar vacío para conservar' : 'Obligatoria'" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Correo remitente</mat-label><input matInput type="email" formControlName="fromAddress" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Nombre remitente</mat-label><input matInput formControlName="fromName" /></mat-form-field>
								<mat-form-field appearance="outline"><mat-label>Responder a</mat-label><input matInput type="email" formControlName="replyTo" /></mat-form-field>
								<mat-slide-toggle formControlName="startTls">STARTTLS</mat-slide-toggle><mat-slide-toggle formControlName="ssl">SSL</mat-slide-toggle>
							}
							<div class="email-actions"><button mat-raised-button color="primary" type="submit" [disabled]="guardandoCorreo()">Guardar correo</button><mat-form-field appearance="outline"><mat-label>Destinatario de prueba</mat-label><input matInput type="email" formControlName="testRecipient" /></mat-form-field><button mat-stroked-button type="button" (click)="probarCorreo()" [disabled]="probandoCorreo()">Probar configuración</button></div>
						</form>
					</mat-card-content>
				</mat-card>
			</div>
		</section>
	`,
		styles: [ `
			.page-grid { display: grid; gap: 1rem; }
			.hero { padding: 1.25rem 1.5rem; display: flex; align-items: end; justify-content: space-between; gap: 1rem; background: var(--tc-surface-container-lowest); }
		.hero h2 { margin: 0; font-size: 1.5rem; }
		.hero p { margin: .35rem 0 0; max-width: 72ch; color: var(--muted-foreground); }
		.eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
		.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
		.mini-table { width: 100%; }
		.establecimientos-card, .puntos-card, .fiscal-card, .email-card { grid-column: 1 / -1; }
		.settings-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; align-items: center; }
		.email-actions { grid-column: 1 / -1; display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
		.punto-form {
			display: grid;
			grid-template-columns: minmax(90px, 140px) minmax(180px, 1fr) minmax(200px, 1fr) auto;
			gap: .75rem;
			align-items: center;
			margin-bottom: 1rem;
		}
		.mat-column-toggle, .mat-column-acciones {
			width: 120px;
		}
		@media (max-width: 900px) {
			.hero { flex-direction: column; align-items: start; }
			.content-grid { grid-template-columns: 1fr; }
			.punto-form { grid-template-columns: 1fr; }
			.settings-form { grid-template-columns: 1fr; }
		}
	` ]
})
export class ConfiguracionFacturacionPageComponent {
	private readonly formBuilder = inject(FormBuilder);
	private readonly destroyRef = inject(DestroyRef);
	private readonly snackBar = inject(MatSnackBar);
	private readonly facturacionService = inject(FacturacionConfigService);

	protected readonly columnasCatalogo = ['value', 'toggle'];
	protected readonly columnasEstablecimientos = ['codigo', 'nombre', 'almacenes', 'acciones'];
	protected readonly columnasPuntos = ['codigo', 'establecimiento', 'descripcion', 'firma', 'acciones'];
	protected readonly almacenes = signal<Almacen[]>([]);
	protected readonly cargandoCatalogos = signal(true);
	protected readonly guardando = signal(false);
	protected readonly guardandoCorreo = signal(false);
	protected readonly probandoCorreo = signal(false);
	protected readonly passwordConfigured = signal(false);

	protected readonly catalogos = signal<CatalogosFacturacion>({
		formaPago: [],
		tipoIdentificacion: [],
		ambiente: [],
		codigoPorcentajeIva: []
	});

	protected readonly firmas = signal<FirmaDigitalConfig[]>([]);
	protected readonly configuracion = signal<ConfiguracionFacturacion>({
		formaPagoActivos: [],
		tipoIdentificacionActivos: [],
		ambienteActivo: null,
		codigoPorcentajeIvaActivos: [],
		establecimientos: [],
		puntosEmision: [],
		direccionMatriz: '',
		obligadoContabilidad: false,
		contribuyenteEspecial: '',
		agenteRetencion: '',
		contribuyenteRimpe: false,
		logoUrl: ''
	});

	protected readonly fiscalForm = this.formBuilder.nonNullable.group({
		direccionMatriz: ['', [Validators.required, Validators.maxLength(300)]],
		obligadoContabilidad: [false], contribuyenteEspecial: [''], agenteRetencion: ['', [Validators.pattern(/^\d{0,8}$/)]],
		contribuyenteRimpe: [false], logoUrl: ['']
	});

	protected readonly correoForm = this.formBuilder.nonNullable.group({
		mode: ['SAAS_DEFAULT' as ConfiguracionCorreoFactura['mode']], host: [''], port: [587], username: [''], password: [''],
		fromAddress: ['', [Validators.email]], fromName: [''], replyTo: ['', [Validators.email]], startTls: [true], ssl: [false],
		testRecipient: ['', [Validators.email]]
	});

	protected readonly establecimientoForm = this.formBuilder.nonNullable.group({
		codigo: ['', [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
		nombre: ['', [Validators.required, Validators.maxLength(120)]],
		direccion: ['', [Validators.maxLength(200)]],
		almacenes: [[] as string[]]
	});

	protected readonly puntoForm = this.formBuilder.nonNullable.group({
		establecimientoId: ['', [Validators.required]],
		codigo: ['', [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
		descripcion: ['', [Validators.required, Validators.maxLength(120)]],
		firmaId: ['', [Validators.required]]
	});

	constructor() {
		const almacenesService = inject(AlmacenesService);

		almacenesService.getAlmacenesActivos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (alm) => this.almacenes.set(alm),
			error: () => this.mostrarMensaje('No se pudieron cargar los almacenes.', 'error')
		});
		this.facturacionService.getCatalogosFacturacion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (catalogos) => {
				this.catalogos.set(catalogos);
				this.cargandoCatalogos.set(false);
			},
			error: () => {
				this.cargandoCatalogos.set(false);
				this.mostrarMensaje('No se pudieron cargar los catálogos.', 'error');
			}
		});

		this.facturacionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (configuracion) => {
				this.configuracion.set(configuracion);
				this.fiscalForm.patchValue({ direccionMatriz: configuracion.direccionMatriz, obligadoContabilidad: configuracion.obligadoContabilidad,
					contribuyenteEspecial: configuracion.contribuyenteEspecial ?? '', agenteRetencion: configuracion.agenteRetencion ?? '',
					contribuyenteRimpe: configuracion.contribuyenteRimpe, logoUrl: configuracion.logoUrl ?? '' }, { emitEvent: false });
			},
			error: () => this.mostrarMensaje('No se pudo cargar la configuración guardada.', 'error')
		});

		this.facturacionService.getFirmasDisponibles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (firmas) => this.firmas.set(firmas),
			error: () => this.mostrarMensaje('No se pudo cargar la lista de firmas.', 'error')
		});
		this.facturacionService.getConfiguracionCorreo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (correo) => { this.passwordConfigured.set(!!correo.passwordConfigured); this.correoForm.patchValue({ ...correo, password: '' }); },
			error: () => this.mostrarMensaje('No se pudo cargar la configuración de correo.', 'error')
		});
	}

	protected isActivoMultiple(campo: 'formaPagoActivos' | 'tipoIdentificacionActivos' | 'codigoPorcentajeIvaActivos', codigo: string): boolean {
		return this.configuracion()[campo].includes(codigo);
	}

	protected toggleMultiple(
		campo: 'formaPagoActivos' | 'tipoIdentificacionActivos' | 'codigoPorcentajeIvaActivos',
		codigo: string,
		checked: boolean
	): void {
		const current = this.configuracion();
		const set = new Set(current[campo]);

		if (checked) {
			set.add(codigo);
		} else {
			set.delete(codigo);
		}

		this.configuracion.set({
			...current,
			[campo]: Array.from(set)
		});
	}

	protected isActivoUnico(campo: 'ambienteActivo', codigo: string): boolean {
		return this.configuracion()[campo] === codigo;
	}

	protected toggleUnico(campo: 'ambienteActivo', codigo: string, checked: boolean): void {
		const current = this.configuracion();
		this.configuracion.set({
			...current,
			[campo]: checked ? codigo : null
		});

		// Si el usuario selecciona Producción, mostrar alerta preventiva.
		if (checked) {
			const ambienteEntry = this.catalogos().ambiente.find((e) => e.code === codigo);
			const isProduccionByValue = ambienteEntry ? /prod/i.test(ambienteEntry.value) : false;
			const isProduccionByCode = codigo === '2' || codigo === 'PRODUCCION' || codigo === 'Produccion';

			if (isProduccionByValue || isProduccionByCode) {
				this.mostrarMensaje('Ha seleccionado el ambiente de Producción. Asegúrese de que las firmas y puntos de emisión estén correctamente configurados antes de emitir facturas.', 'warning');
			}
		}
	}

	protected agregarEstablecimiento(): void {
		if (this.establecimientoForm.invalid) {
			this.establecimientoForm.markAllAsTouched();
			return;
		}

		const raw = this.establecimientoForm.getRawValue();
		const current = this.configuracion();
		const codigo = raw.codigo.trim();

		if (current.establecimientos.some((item) => item.codigo === codigo)) {
			this.mostrarMensaje('Ya existe un establecimiento con ese código.', 'warning');
			return;
		}

		const nuevo: EstablecimientoConfig = {
			id: this.generarIdEstablecimiento(),
			codigo,
			nombre: raw.nombre.trim(),
			direccion: raw.direccion?.trim(),
			almacenIds: Array.isArray(raw.almacenes) ? raw.almacenes.slice() : [],
			activo: true
		};

		this.configuracion.set({
			...current,
			establecimientos: [...current.establecimientos, nuevo].sort((a, b) => a.codigo.localeCompare(b.codigo))
		});

		this.establecimientoForm.reset({ codigo: '', nombre: '', direccion: '', almacenes: [] });
	}

	protected eliminarEstablecimiento(id: string): void {
		const current = this.configuracion();
		// Eliminar el establecimiento y también los puntos asociados
		this.configuracion.set({
			...current,
			establecimientos: current.establecimientos.filter((item) => item.id !== id),
			puntosEmision: current.puntosEmision.filter((punto) => punto.establecimientoId !== id)
		});
		this.mostrarMensaje('Establecimiento y puntos asociados eliminados.', 'info');
	}

	protected agregarPuntoEmision(): void {
		if (this.puntoForm.invalid) {
			this.puntoForm.markAllAsTouched();
			return;
		}

		const raw = this.puntoForm.getRawValue();
		const current = this.configuracion();
		const codigo = raw.codigo.trim();

		// Validar unicidad de código por establecimiento
		const puntosEnEstab = current.puntosEmision.filter((p) => p.establecimientoId === raw.establecimientoId);
		if (puntosEnEstab.some((item) => item.codigo === codigo)) {
			this.mostrarMensaje('Ya existe un punto de emisión con ese código en este establecimiento.', 'warning');
			return;
		}

		const nuevo: PuntoEmisionConfig = {
			id: this.generarIdPunto(),
			codigo,
			descripcion: raw.descripcion.trim(),
			firmaId: raw.firmaId,
			establecimientoId: raw.establecimientoId,
			activo: true
		};

		this.configuracion.set({
			...current,
			puntosEmision: [...current.puntosEmision, nuevo].sort((a, b) => a.codigo.localeCompare(b.codigo))
		});

		this.puntoForm.reset({ establecimientoId: '', codigo: '', descripcion: '', firmaId: '' });
	}

	protected eliminarPunto(id: string): void {
		const current = this.configuracion();
		this.configuracion.set({
			...current,
			puntosEmision: current.puntosEmision.filter((item) => item.id !== id)
		});
	}

	protected nombreAlmacenesPorIds(ids?: string[] | null): string {
		if (!Array.isArray(ids) || ids.length === 0) {
			return 'Todos los almacenes';
		}

		const names = ids
			.map((id) => this.almacenes().find((a) => a.id === id)?.nombre ?? id)
			.filter(Boolean);

		return names.length > 0 ? names.join(', ') : 'Todos los almacenes';
	}

	protected nombreEstablecimientoPorId(id: string): string {
		const estab = this.configuracion().establecimientos.find((e) => e.id === id);
		return estab ? `${estab.codigo} - ${estab.nombre}` : 'Desconocido';
	}

	protected nombreFirmaPorId(firmaId: string): string {
		const firma = this.firmas().find((item) => item.id === firmaId);
		return firma ? this.etiquetaFirma(firma) : 'Sin firma';
	}

	protected etiquetaFirma(firma: FirmaDigitalConfig): string {
		const ruc = firma.ruc ? ` · ${firma.ruc}` : '';
		const razon = firma.razonSocial ? ` · ${firma.razonSocial}` : '';
		return `${firma.nombreArchivo}${ruc}${razon}`;
	}

	protected async guardarConfiguracion(): Promise<void> {
		this.guardando.set(true);
		try {
			if (this.fiscalForm.invalid) { this.fiscalForm.markAllAsTouched(); throw new Error('Configuración fiscal inválida'); }
			const fiscal = this.fiscalForm.getRawValue();
			const actualizada = { ...this.configuracion(), ...fiscal };
			this.configuracion.set(actualizada);
			await this.facturacionService.guardarConfiguracion(actualizada);
			this.mostrarMensaje('Configuración de facturación guardada.', 'save');
		} catch {
			this.mostrarMensaje('No se pudo guardar la configuración.', 'error');
		} finally {
			this.guardando.set(false);
		}
	}

	protected guardarCorreo(): void {
		this.guardandoCorreo.set(true);
		const raw = this.correoForm.getRawValue();
		const { testRecipient: _testRecipient, ...payload } = raw;
		this.facturacionService.guardarConfiguracionCorreo(payload).subscribe({
			next: (saved) => { this.passwordConfigured.set(!!saved.passwordConfigured); this.correoForm.controls.password.setValue(''); this.guardandoCorreo.set(false); this.mostrarMensaje('Configuración de correo guardada.', 'mail'); },
			error: (error) => { this.guardandoCorreo.set(false); this.mostrarMensaje(error?.error?.message ?? 'No se pudo guardar el correo.', 'error'); }
		});
	}

	protected probarCorreo(): void {
		const recipient = this.correoForm.controls.testRecipient.value.trim();
		if (!recipient || this.correoForm.controls.testRecipient.invalid) { this.mostrarMensaje('Ingresa un destinatario de prueba válido.', 'warning'); return; }
		this.probandoCorreo.set(true);
		this.facturacionService.probarConfiguracionCorreo(recipient).subscribe({
			next: (result) => { this.probandoCorreo.set(false); this.mostrarMensaje(result.status === 'SENT' ? `Correo enviado mediante ${result.channelUsed}.` : (result.error ?? 'Falló el correo.'), result.status === 'SENT' ? 'mark_email_read' : 'error'); },
			error: () => { this.probandoCorreo.set(false); this.mostrarMensaje('No se pudo probar el correo.', 'error'); }
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

	private generarIdEstablecimiento(): string {
		return `estab_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
	}

	private generarIdPunto(): string {
		return `pto_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
	}
}

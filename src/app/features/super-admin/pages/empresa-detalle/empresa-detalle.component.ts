import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MODULE_CATALOG } from '../../../../core/config/module-catalog';
import {
  ActualizarSuscripcionEmpresa,
  EmpresaDetalle,
  EstadoSuscripcion,
  LimitesPlan,
  PlanEmpresa,
  RECURSOS_MENSUALES,
  RECURSOS_META,
  RecursoPlataforma,
} from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { bytesAMegabytes, formatearRecurso, limiteDe, megabytesABytes, porcentajeConsumo } from '../../utils/formato';

interface FilaConsumo {
  recurso: RecursoPlataforma;
  label: string;
  mensual: boolean;
  consumido: string;
  limite: string;
  bolsa: string;
  porcentaje: number | null;
}

/**
 * Ficha de una empresa: plan asignado, ajuste manual de cada limite, modulos extra,
 * consumo del ciclo y saldo de las bolsas compradas.
 */
@Component({
  selector: 'app-empresa-detalle',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="detalle">
      <a mat-stroked-button routerLink="/super-admin/empresas">
        <mat-icon>arrow_back</mat-icon>
        Volver al listado
      </a>

      @if (error()) {
        <p class="error surface-card">{{ error() }}</p>
      }

      @if (detalle(); as info) {
        <section class="surface-card bloque">
          <div class="cabecera">
            <div>
              <p class="eyebrow">Empresa</p>
              <h2>{{ info.empresa.name }}</h2>
              <p class="sub">
                Propietario: {{ info.ownerEmail || info.empresa.ownerId }} ·
                {{ info.colaboradoresActivos }} colaborador(es) activo(s)
              </p>
              <p class="sub identificador">{{ info.empresa.id }}</p>
            </div>
          </div>
        </section>

        <section class="surface-card bloque">
          <h3>Cuentas vinculadas</h3>
          <p class="ayuda">Usuarios con acceso a esta empresa, segun sus membresias.</p>

          @if (info.miembros.length === 0) {
            <p class="vacio">Esta empresa no tiene ninguna cuenta vinculada.</p>
          } @else {
            <div class="tabla">
              <table mat-table [dataSource]="info.miembros">
                <ng-container matColumnDef="cuenta">
                  <th mat-header-cell *matHeaderCellDef>Cuenta</th>
                  <td mat-cell *matCellDef="let row">
                    <strong>{{ row.email || row.nombre || 'Sin correo' }}</strong>
                    <small>{{ row.userId }}</small>
                  </td>
                </ng-container>

                <ng-container matColumnDef="nombre">
                  <th mat-header-cell *matHeaderCellDef>Nombre</th>
                  <td mat-cell *matCellDef="let row">{{ row.nombre || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="rol">
                  <th mat-header-cell *matHeaderCellDef>Rol</th>
                  <td mat-cell *matCellDef="let row">
                    {{ row.rol }}
                    @if (row.propietario) {
                      <span class="pastilla">Propietario</span>
                    }
                  </td>
                </ng-container>

                <ng-container matColumnDef="estado">
                  <th mat-header-cell *matHeaderCellDef>Estado</th>
                  <td mat-cell *matCellDef="let row">{{ row.activo ? 'Activa' : 'Inactiva' }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columnasMiembros"></tr>
                <tr mat-row *matRowDef="let row; columns: columnasMiembros"></tr>
              </table>
            </div>
          }
        </section>

        <form class="surface-card bloque" [formGroup]="form" (ngSubmit)="guardar()">
          <h3>Plan y estado</h3>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Plan asignado</mat-label>
              <mat-select formControlName="planId">
                @for (plan of planes(); track plan.id) {
                  <mat-option [value]="plan.id">{{ plan.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="estado">
                <mat-option value="ACTIVE">Activa</mat-option>
                <mat-option value="TRIAL">En prueba</mat-option>
                <mat-option value="SUSPENDED">Suspendida</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="ancho-total">
              <mat-label>Notas internas</mat-label>
              <input matInput type="text" formControlName="notas" maxlength="240" />
            </mat-form-field>
          </div>

          <h3>Limites de esta empresa</h3>
          <p class="ayuda">
            Deja un campo vacio para heredar el valor del plan. Escribe <strong>-1</strong> para dejarlo sin limite.
          </p>
          <div class="grid" formGroupName="limites">
            <mat-form-field appearance="outline">
              <mat-label>Espacio de archivos (MB)</mat-label>
              <input matInput type="number" formControlName="storageMb" />
              <mat-hint>Plan: {{ textoLimitePlan('storageBytes') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Sitios ecommerce</mat-label>
              <input matInput type="number" formControlName="sitiosEcommerce" />
              <mat-hint>Plan: {{ textoLimitePlan('sitiosEcommerce') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Landing pages</mat-label>
              <input matInput type="number" formControlName="sitiosLanding" />
              <mat-hint>Plan: {{ textoLimitePlan('sitiosLanding') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tokens de IA por mes</mat-label>
              <input matInput type="number" formControlName="aiTokensMes" />
              <mat-hint>Plan: {{ textoLimitePlan('aiTokens') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Facturas al SRI por mes</mat-label>
              <input matInput type="number" formControlName="facturasSriMes" />
              <mat-hint>Plan: {{ textoLimitePlan('facturasSri') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Descargas del SRI por mes</mat-label>
              <input matInput type="number" formControlName="descargasSriMes" />
              <mat-hint>Plan: {{ textoLimitePlan('descargasSri') }}</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Colaboradores</mat-label>
              <input matInput type="number" formControlName="colaboradores" />
              <mat-hint>Plan: {{ textoLimitePlan('colaboradores') }}</mat-hint>
            </mat-form-field>

            <div class="toggle">
              <mat-slide-toggle formControlName="sriWorkerHabilitado">
                Puede usar el agente sri-worker
              </mat-slide-toggle>
              <small>Permite la descarga automatica de los documentos recibidos del SRI.</small>
            </div>

            <div class="toggle">
              <mat-slide-toggle formControlName="whatsappManualHabilitado">
                Puede conectar un numero de WhatsApp a mano
              </mat-slide-toggle>
              <small>Para probar el asistente de ventas con el numero de prueba de Meta mientras la app esta en revision.</small>
            </div>
          </div>

          <h3>Modulos adicionales</h3>
          <p class="ayuda">Modulos concedidos fuera del plan. Los que ya incluye el plan aparecen marcados como incluidos.</p>
          <div class="modulos">
            @for (modulo of catalogo; track modulo.id) {
              <label class="modulo" [class.incluido]="planIncluye(modulo.id)">
                <mat-checkbox
                  [checked]="modulosExtra().includes(modulo.id)"
                  [disabled]="planIncluye(modulo.id)"
                  (change)="alternarModulo(modulo.id, $event.checked)"
                >
                  {{ modulo.label }}
                </mat-checkbox>
                @if (planIncluye(modulo.id)) {
                  <small>Incluido en el plan</small>
                }
              </label>
            }
          </div>

          <div class="acciones">
            <button mat-raised-button color="primary" type="submit" [disabled]="guardando() || form.invalid">
              <mat-icon>save</mat-icon>
              Guardar cambios
            </button>
          </div>
        </form>

        <section class="surface-card bloque">
          <div class="cabecera">
            <div>
              <h3>Consumo del periodo {{ info.uso.periodo }}</h3>
              <p class="sub">El cupo mensual se reinicia cada mes; la bolsa comprada no caduca.</p>
            </div>
            <button mat-stroked-button type="button" (click)="reiniciarConsumo()" [disabled]="guardando()">
              <mat-icon>restart_alt</mat-icon>
              Reiniciar el periodo
            </button>
          </div>

          <div class="consumo">
            @for (fila of consumo(); track fila.recurso) {
              <article>
                <header>
                  <span>{{ fila.label }}</span>
                  <strong>{{ fila.consumido }} / {{ fila.limite }}</strong>
                </header>
                @if (fila.porcentaje !== null) {
                  <mat-progress-bar mode="determinate" [value]="fila.porcentaje" />
                }
                <footer>
                  <small>{{ fila.mensual ? 'Cupo mensual' : 'Tope acumulado' }}</small>
                  <small>Bolsa: {{ fila.bolsa }}</small>
                </footer>
              </article>
            }
          </div>
        </section>

        <section class="surface-card bloque">
          <h3>Acreditar o descontar saldo</h3>
          <p class="ayuda">Suma unidades a la bolsa que no caduca. Usa un numero negativo para descontar.</p>
          <form class="grid bolsa" [formGroup]="formBolsa" (ngSubmit)="ajustarBolsa()">
            <mat-form-field appearance="outline">
              <mat-label>Recurso</mat-label>
              <mat-select formControlName="recurso">
                @for (recurso of recursos; track recurso) {
                  <mat-option [value]="recurso">{{ etiquetaRecurso(recurso) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Unidades</mat-label>
              <input matInput type="number" formControlName="delta" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Motivo</mat-label>
              <input matInput type="text" formControlName="motivo" maxlength="160" />
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" [disabled]="guardando() || formBolsa.invalid">
              <mat-icon>add_card</mat-icon>
              Aplicar
            </button>
          </form>
        </section>
      } @else if (!error()) {
        <p class="surface-card bloque">Cargando la empresa…</p>
      }
    </div>
  `,
  styles: [`
    .detalle { display: grid; gap: 1rem; align-content: start; }
    .bloque { padding: 1.25rem; display: grid; gap: .9rem; background: var(--tc-surface-container-lowest); }
    .cabecera { display: flex; align-items: start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 1.35rem; }
    h3 { margin: .35rem 0 0; font-size: 1.05rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); }
    .identificador { font-family: monospace; font-size: .8rem; }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .ayuda { margin: 0; color: var(--muted-foreground); font-size: .88rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .75rem; align-items: start; }
    .ancho-total { grid-column: 1 / -1; }
    .toggle { display: grid; gap: .25rem; align-content: center; }
    .toggle small { color: var(--muted-foreground); }
    .modulos { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .4rem; }
    .modulo { display: grid; gap: .1rem; padding: .3rem .4rem; border-radius: var(--tc-radius-md, 10px); }
    .modulo.incluido { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .modulo small { color: var(--muted-foreground); font-size: .75rem; padding-left: 2rem; }
    .acciones { display: flex; justify-content: flex-end; }
    .consumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: .8rem; }
    .consumo article {
      display: grid; gap: .4rem; padding: .8rem; border-radius: var(--tc-radius-md, 10px);
      background: var(--tc-surface-container-low);
    }
    .consumo header { display: flex; justify-content: space-between; gap: .5rem; align-items: baseline; }
    .consumo header span { color: var(--muted-foreground); font-size: .85rem; }
    .consumo footer { display: flex; justify-content: space-between; color: var(--muted-foreground); }
    .bolsa { align-items: center; }
    .bolsa button { height: 48px; }
    .tabla { overflow-x: auto; }
    table { width: 100%; min-width: 640px; }
    thead tr { background: var(--tc-surface-container-low); }
    td strong { display: block; }
    td small { color: var(--muted-foreground); font-family: monospace; font-size: .75rem; }
    .pastilla {
      display: inline-block; margin-left: .4rem; padding: .1rem .5rem; border-radius: 999px;
      font-size: .72rem; background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary);
    }
    .vacio { margin: 0; color: var(--muted-foreground); }
    .error { padding: 1rem 1.25rem; color: #b3261e; }
  `],
})
export class EmpresaDetalleComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly catalogo = MODULE_CATALOG;
  protected readonly recursos = Object.keys(RECURSOS_META) as RecursoPlataforma[];
  protected readonly columnasMiembros = ['cuenta', 'nombre', 'rol', 'estado'];

  protected readonly detalle = signal<EmpresaDetalle | null>(null);
  protected readonly planes = signal<PlanEmpresa[]>([]);
  protected readonly modulosExtra = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  private tenantId = '';

  protected readonly form = this.formBuilder.nonNullable.group({
    planId: ['', Validators.required],
    estado: ['ACTIVE' as EstadoSuscripcion, Validators.required],
    notas: [''],
    limites: this.formBuilder.group({
      storageMb: [null as number | null],
      sitiosEcommerce: [null as number | null],
      sitiosLanding: [null as number | null],
      aiTokensMes: [null as number | null],
      facturasSriMes: [null as number | null],
      descargasSriMes: [null as number | null],
      colaboradores: [null as number | null],
      sriWorkerHabilitado: [true],
      whatsappManualHabilitado: [false],
    }),
  });

  protected readonly formBolsa = this.formBuilder.nonNullable.group({
    recurso: ['aiTokens' as RecursoPlataforma, Validators.required],
    delta: [0, [Validators.required]],
    motivo: [''],
  });

  /** Filas de consumo listas para pintar: consumido, tope efectivo y saldo de la bolsa. */
  protected readonly consumo = computed<FilaConsumo[]>(() => {
    const info = this.detalle();
    if (!info) return [];
    return this.recursos.map((recurso) => {
      const mensual = RECURSOS_MENSUALES.includes(recurso);
      const consumido = (mensual ? info.uso.mensual[recurso] : info.uso.acumulado[recurso]) ?? 0;
      const limite = limiteDe(info.planEfectivo.limites, recurso);
      return {
        recurso,
        label: RECURSOS_META[recurso].label,
        mensual,
        consumido: formatearRecurso(recurso, consumido),
        limite: formatearRecurso(recurso, limite),
        bolsa: formatearRecurso(recurso, info.uso.bolsa[recurso] ?? 0),
        porcentaje: porcentajeConsumo(consumido, limite),
      };
    });
  });

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') ?? '';
    this.api.listarPlanesEmpresa().subscribe({ next: (planes) => this.planes.set(planes) });
    this.cargar();
  }

  private cargar(): void {
    this.api.obtenerEmpresa(this.tenantId).subscribe({
      next: (detalle) => this.aplicar(detalle),
      error: () => this.error.set('No se pudo cargar la empresa.'),
    });
  }

  private aplicar(detalle: EmpresaDetalle): void {
    this.detalle.set(detalle);
    const override = detalle.suscripcion?.limitesOverride ?? {};
    this.form.patchValue({
      planId: detalle.planEfectivo.planId,
      estado: detalle.planEfectivo.estado ?? 'ACTIVE',
      notas: detalle.suscripcion?.notas ?? '',
      limites: {
        storageMb: bytesAMegabytes(override.storageBytes),
        sitiosEcommerce: override.sitiosEcommerce ?? null,
        sitiosLanding: override.sitiosLanding ?? null,
        aiTokensMes: override.aiTokensMes ?? null,
        facturasSriMes: override.facturasSriMes ?? null,
        descargasSriMes: override.descargasSriMes ?? null,
        colaboradores: override.colaboradores ?? null,
        sriWorkerHabilitado: detalle.planEfectivo.limites.sriWorkerHabilitado ?? true,
        whatsappManualHabilitado: detalle.planEfectivo.limites.whatsappManualHabilitado ?? false,
      },
    });
    this.modulosExtra.set(detalle.suscripcion?.modulosExtra ?? []);
  }

  protected planIncluye(moduloId: string): boolean {
    const plan = this.planes().find((candidato) => candidato.id === this.form.controls.planId.value);
    return (plan?.modulos ?? []).includes(moduloId);
  }

  protected alternarModulo(moduloId: string, marcado: boolean): void {
    this.modulosExtra.update((actuales) =>
      marcado ? [...new Set([...actuales, moduloId])] : actuales.filter((id) => id !== moduloId),
    );
  }

  protected textoLimitePlan(recurso: RecursoPlataforma): string {
    const plan = this.planes().find((candidato) => candidato.id === this.form.controls.planId.value);
    return formatearRecurso(recurso, limiteDe(plan?.limites, recurso));
  }

  protected etiquetaRecurso(recurso: RecursoPlataforma): string {
    return RECURSOS_META[recurso].label;
  }

  protected guardar(): void {
    const valores = this.form.getRawValue();
    const limites = valores.limites;

    // Solo se envian los campos escritos: los vacios heredan el valor del plan.
    const override: LimitesPlan = {
      storageBytes: megabytesABytes(limites.storageMb),
      sitiosEcommerce: limites.sitiosEcommerce,
      sitiosLanding: limites.sitiosLanding,
      aiTokensMes: limites.aiTokensMes,
      facturasSriMes: limites.facturasSriMes,
      descargasSriMes: limites.descargasSriMes,
      colaboradores: limites.colaboradores,
      sriWorkerHabilitado: limites.sriWorkerHabilitado,
      whatsappManualHabilitado: limites.whatsappManualHabilitado,
    };

    const payload: ActualizarSuscripcionEmpresa = {
      planId: valores.planId,
      estado: valores.estado,
      limitesOverride: override,
      modulosExtra: this.modulosExtra(),
      notas: valores.notas || null,
    };

    this.guardando.set(true);
    this.api.actualizarSuscripcion(this.tenantId, payload).subscribe({
      next: (detalle) => {
        this.aplicar(detalle);
        this.guardando.set(false);
        this.avisar('Plan de la empresa actualizado');
      },
      error: (respuesta: { error?: { error?: string } }) => {
        this.guardando.set(false);
        this.error.set(respuesta?.error?.error ?? 'No se pudo guardar el plan de la empresa.');
      },
    });
  }

  protected ajustarBolsa(): void {
    const valores = this.formBolsa.getRawValue();
    if (!valores.delta) {
      this.error.set('Indica cuantas unidades quieres acreditar o descontar.');
      return;
    }
    this.guardando.set(true);
    this.api.ajustarBolsa(this.tenantId, valores).subscribe({
      next: (uso) => {
        const actual = this.detalle();
        if (actual) this.detalle.set({ ...actual, uso });
        this.formBolsa.patchValue({ delta: 0, motivo: '' });
        this.guardando.set(false);
        this.avisar('Saldo actualizado');
      },
      error: (respuesta: { error?: { error?: string } }) => {
        this.guardando.set(false);
        this.error.set(respuesta?.error?.error ?? 'No se pudo ajustar el saldo.');
      },
    });
  }

  protected reiniciarConsumo(): void {
    this.guardando.set(true);
    this.api.reiniciarConsumo(this.tenantId).subscribe({
      next: (uso) => {
        const actual = this.detalle();
        if (actual) this.detalle.set({ ...actual, uso });
        this.guardando.set(false);
        this.avisar('Consumo del periodo reiniciado');
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No se pudo reiniciar el consumo.');
      },
    });
  }

  private avisar(mensaje: string): void {
    this.error.set(null);
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message: mensaje, icon: 'check_circle' },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}

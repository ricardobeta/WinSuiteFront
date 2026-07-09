import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { Proveedor } from '../../../inventario/models/inventario.models';
import { ProveedoresService } from '../../../inventario/services/proveedores.service';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { RevisarAsientoData, RevisarAsientoDialogComponent } from '../../components/revisar-asiento-dialog/revisar-asiento-dialog.component';
import { AsientoContableLinea, CuentaContable } from '../../models/contabilidad.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

const DIA_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-cuenta-por-pagar-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="cxp-form-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Cuentas por Pagar</p>
          <h2>Nueva cuenta por pagar manual</h2>
          <p>Registra una obligacion sin factura de compra (prestamo, servicio basico, provision).</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/cuentas-por-pagar">Volver</a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card form-card">
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Proveedor</mat-label>
            <mat-select [ngModel]="proveedorId()" (ngModelChange)="seleccionarProveedor($event)">
              <mat-option [value]="null">— Sin proveedor del maestro —</mat-option>
              @for (proveedor of proveedores(); track proveedor.id) {
                <mat-option [value]="proveedor.id">{{ proveedor.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombre del proveedor / beneficiario</mat-label>
            <input matInput [ngModel]="proveedorNombre()" (ngModelChange)="proveedorNombre.set($event)" maxlength="140" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de emision</mat-label>
            <input matInput type="date" [ngModel]="fechaEmision()" (ngModelChange)="fechaEmision.set($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de vencimiento</mat-label>
            <input matInput type="date" [ngModel]="fechaVencimiento()" (ngModelChange)="fechaVencimiento.set($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Monto</mat-label>
            <input matInput type="number" min="0" step="0.01" [ngModel]="monto()" (ngModelChange)="monto.set($event)" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Glosa / concepto</mat-label>
          <input matInput [ngModel]="glosa()" (ngModelChange)="glosa.set($event)" maxlength="180" placeholder="Ej. Prestamo socio, arriendo enero" />
        </mat-form-field>

        <div class="contrapartida">
          <label class="field-label">Cuenta contrapartida (DEBE — gasto o activo)</label>
          <app-cuenta-contable-autocomplete
            [cuentas]="cuentas()"
            [cuentaId]="cuentaContrapartidaId() || null"
            [soloActivas]="true"
            [soloMovimiento]="true"
            [mostrarNumero]="false"
            label="Cuenta contrapartida"
            (cuentaSeleccionada)="cuentaContrapartidaId.set($event?.id ?? '')"
          />
          <p class="hint">La cuenta por pagar (HABER) se toma de la configuracion del modulo. Podras revisar y ajustar el asiento antes de registrar.</p>
        </div>

        <div class="actions-row">
          <span class="spacer"></span>
          <button mat-button type="button" routerLink="/workspace/contabilidad/cuentas-por-pagar" [disabled]="guardando()">Cancelar</button>
          <button mat-raised-button color="primary" type="button" (click)="registrar()" [disabled]="guardando() || !puedeGuardar()">
            Registrar
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .cxp-form-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .form-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .full { width: 100%; }
    .contrapartida { display: grid; gap: .5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .field-label { font-size: .82rem; color: var(--muted-foreground); }
    .hint { margin: 0; color: var(--muted-foreground); font-size: .82rem; }
    .actions-row { display: flex; align-items: center; gap: .5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .spacer { flex: 1; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
  `]
})
export class CuentaPorPagarFormComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);

  protected readonly proveedorId = signal<string | null>(null);
  protected readonly proveedorNombre = signal('');
  protected readonly proveedorIdentificacion = signal('');
  protected readonly fechaEmision = signal(this.hoyIso());
  protected readonly fechaVencimiento = signal(this.hoyIso());
  protected readonly monto = signal<number | null>(null);
  protected readonly glosa = signal('');
  protected readonly cuentaContrapartidaId = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly puedeGuardar = computed(() =>
    this.proveedorNombre().trim().length > 0
    && Number(this.monto() ?? 0) > 0
    && this.glosa().trim().length > 0
    && !!this.cuentaContrapartidaId());

  async ngOnInit(): Promise<void> {
    this.cuentas.set(await this.planCuentasService.getCuentasOnce());
    this.proveedores.set(await firstValueFrom(this.proveedoresService.getProveedores()));
  }

  protected seleccionarProveedor(proveedorId: string | null): void {
    this.proveedorId.set(proveedorId);
    const proveedor = this.proveedores().find((item) => item.id === proveedorId);
    if (proveedor) {
      this.proveedorNombre.set(proveedor.nombre);
      this.proveedorIdentificacion.set(proveedor.ruc ?? '');
      const emision = new Date(this.fechaEmision()).getTime();
      this.fechaVencimiento.set(this.isoDesde(emision + Number(proveedor.diasCredito ?? 0) * DIA_MS));
    }
  }

  protected async registrar(): Promise<void> {
    if (!this.puedeGuardar()) {
      this.error.set('Completa proveedor, monto, glosa y cuenta contrapartida.');
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    try {
      const monto = Number(this.monto());
      const glosa = this.glosa().trim();
      const config = await this.service.getConfiguracionOnce();

      let lineas: AsientoContableLinea[] | undefined;
      if (await this.integracionContable.contabilidadActiva()) {
        const propuesta = await this.integracionContable.construirLineasCxPManual({
          cuentaContrapartidaId: this.cuentaContrapartidaId(),
          cuentaPorPagarId: config.cuentaPorPagarDefaultId,
          proveedorId: this.proveedorId(),
          monto,
          glosa
        }, { lenient: true });

        const data: RevisarAsientoData = {
          titulo: 'Revisar asiento de cuenta por pagar',
          subtitulo: `${this.proveedorNombre()} · ${glosa}`,
          lineas: propuesta,
          cuentas: this.cuentas()
        };
        const resultado = await firstValueFrom(
          this.dialog.open<RevisarAsientoDialogComponent, RevisarAsientoData, AsientoContableLinea[] | undefined>(
            RevisarAsientoDialogComponent, { maxWidth: '96vw', data }
          ).afterClosed()
        );
        if (!resultado) {
          this.guardando.set(false);
          return; // cancelado
        }
        lineas = resultado;
      }

      await this.service.crearDocumentoManual({
        proveedorId: this.proveedorId(),
        proveedorNombre: this.proveedorNombre().trim(),
        proveedorIdentificacion: this.proveedorIdentificacion(),
        fechaEmision: new Date(this.fechaEmision()).getTime(),
        fechaVencimiento: new Date(this.fechaVencimiento()).getTime(),
        moneda: 'USD',
        glosa,
        montoOriginal: monto
      }, lineas);

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Cuenta por pagar registrada.', icon: 'check_circle' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      await this.router.navigate(['/workspace/contabilidad/cuentas-por-pagar']);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo registrar la cuenta por pagar.');
    } finally {
      this.guardando.set(false);
    }
  }

  private hoyIso(): string {
    return this.isoDesde(Date.now());
  }

  private isoDesde(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

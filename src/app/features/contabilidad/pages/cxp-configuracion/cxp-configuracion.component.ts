import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable } from '../../models/contabilidad.models';
import { ConfiguracionCuentasPorPagar } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

@Component({
  selector: 'app-cxp-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="cxp-config-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Configuracion</p>
          <h2>Cuentas por Pagar</h2>
          <p>Define las cuentas que usa el modulo y que fuentes generan obligaciones por pagar.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/configuracion">Volver a configuracion</a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card form-card">
        <mat-slide-toggle [ngModel]="config().habilitarCuentasPorPagar" (ngModelChange)="set('habilitarCuentasPorPagar', $event)">
          Habilitar el modulo de Cuentas por Pagar
        </mat-slide-toggle>
        <p class="hint">Si esta desactivado, las facturas de compra no crean documentos en el subledger.</p>

        <div class="block">
          <h3>Cuentas del modulo</h3>
          <label class="field-label">Cuenta por pagar (control)</label>
          <app-cuenta-contable-autocomplete
            [cuentas]="cuentas()"
            [cuentaId]="config().cuentaPorPagarDefaultId || null"
            [soloActivas]="true"
            [soloMovimiento]="true"
            [mostrarNumero]="false"
            label="Cuenta por pagar proveedores"
            (cuentaSeleccionada)="set('cuentaPorPagarDefaultId', $event?.id ?? '')"
          />

          <label class="field-label">Cuenta caja/banco para egresos (pagos)</label>
          <app-cuenta-contable-autocomplete
            [cuentas]="cuentas()"
            [cuentaId]="config().cuentaCajaBancoEgresoDefaultId || null"
            [soloActivas]="true"
            [soloMovimiento]="true"
            [mostrarNumero]="false"
            label="Cuenta caja/banco (egreso)"
            (cuentaSeleccionada)="set('cuentaCajaBancoEgresoDefaultId', $event?.id ?? '')"
          />
        </div>

        <div class="block">
          <h3>Fuentes de obligaciones activas</h3>
          <p class="hint">Elige que documentos alimentan el subledger de Cuentas por Pagar.</p>
          <mat-slide-toggle [ngModel]="config().fuenteFacturasCompra" (ngModelChange)="set('fuenteFacturasCompra', $event)">
            Facturas de compra
          </mat-slide-toggle>
          <mat-slide-toggle [ngModel]="config().fuenteManual" (ngModelChange)="set('fuenteManual', $event)">
            Cuentas por pagar manuales (prestamos, servicios sin factura, provisiones)
          </mat-slide-toggle>
          <mat-slide-toggle [ngModel]="config().fuenteRetenciones" (ngModelChange)="set('fuenteRetenciones', $event)">
            Retenciones por pagar
          </mat-slide-toggle>
          <mat-slide-toggle [ngModel]="config().fuenteNomina" (ngModelChange)="set('fuenteNomina', $event)">
            Nomina por pagar
          </mat-slide-toggle>
        </div>

        <div class="actions-row">
          <span class="spacer"></span>
          <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="guardando()">
            Guardar configuracion
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .cxp-config-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .form-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .block { display: grid; gap: .75rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .block h3 { margin: 0; }
    .field-label { font-size: .82rem; color: var(--muted-foreground); }
    .hint { margin: 0; color: var(--muted-foreground); font-size: .85rem; }
    .actions-row { display: flex; align-items: center; gap: .5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .spacer { flex: 1; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
  `]
})
export class CxpConfiguracionComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly config = signal<ConfiguracionCuentasPorPagar>({
    habilitarCuentasPorPagar: false,
    cuentaPorPagarDefaultId: '',
    cuentaCajaBancoEgresoDefaultId: '',
    fuenteFacturasCompra: true,
    fuenteManual: true,
    fuenteRetenciones: false,
    fuenteNomina: false
  });
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.cuentas.set(await this.planCuentasService.getCuentasOnce());
    this.config.set(await this.service.getConfiguracionOnce());
  }

  protected set<K extends keyof ConfiguracionCuentasPorPagar>(campo: K, valor: ConfiguracionCuentasPorPagar[K]): void {
    this.config.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected async guardar(): Promise<void> {
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.service.guardarConfiguracion(this.config());
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Configuracion de Cuentas por Pagar guardada.', icon: 'save' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    } finally {
      this.guardando.set(false);
    }
  }
}

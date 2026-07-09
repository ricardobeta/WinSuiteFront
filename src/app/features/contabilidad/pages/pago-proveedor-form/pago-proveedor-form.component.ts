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
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { RevisarAsientoData, RevisarAsientoDialogComponent } from '../../components/revisar-asiento-dialog/revisar-asiento-dialog.component';
import { AsientoContableLinea, CuentaContable } from '../../models/contabilidad.models';
import { DocumentoPorPagar, MetodoPagoProveedor } from '../../models/cuentas-por-pagar.models';
import { CuentasPorPagarService } from '../../services/cuentas-por-pagar.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';

interface ProveedorConSaldo {
  clave: string;
  proveedorId: string | null;
  nombre: string;
}

@Component({
  selector: 'app-pago-proveedor-form',
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
    <section class="pago-form-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Cuentas por Pagar</p>
          <h2>Nuevo pago a proveedor</h2>
          <p>Aplica el pago a uno o varios documentos pendientes. Genera el asiento DEBE CxP / HABER banco.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/cuentas-por-pagar/pagos">Volver</a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card form-card">
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Proveedor</mat-label>
            <mat-select [ngModel]="proveedorClave()" (ngModelChange)="seleccionarProveedor($event)">
              @for (proveedor of proveedoresConSaldo(); track proveedor.clave) {
                <mat-option [value]="proveedor.clave">{{ proveedor.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha del pago</mat-label>
            <input matInput type="date" [ngModel]="fecha()" (ngModelChange)="fecha.set($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Metodo de pago</mat-label>
            <mat-select [ngModel]="metodoPago()" (ngModelChange)="metodoPago.set($event)">
              <mat-option value="TRANSFERENCIA">Transferencia</mat-option>
              <mat-option value="EFECTIVO">Efectivo</mat-option>
              <mat-option value="CHEQUE">Cheque</mat-option>
              <mat-option value="TARJETA">Tarjeta</mat-option>
              <mat-option value="OTRO">Otro</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Referencia (cheque / transferencia)</mat-label>
            <input matInput [ngModel]="referencia()" (ngModelChange)="referencia.set($event)" maxlength="60" />
          </mat-form-field>
        </div>

        <div class="contrapartida">
          <label class="field-label">Cuenta de origen (HABER — caja/banco)</label>
          <app-cuenta-contable-autocomplete
            [cuentas]="cuentas()"
            [cuentaId]="cuentaOrigenId() || null"
            [soloActivas]="true"
            [soloMovimiento]="true"
            [mostrarNumero]="false"
            label="Cuenta caja/banco"
            (cuentaSeleccionada)="cuentaOrigenId.set($event?.id ?? '')"
          />
        </div>

        <div class="docs-block">
          <h3>Documentos pendientes</h3>
          @if (documentosProveedor().length === 0) {
            <p class="hint">Selecciona un proveedor con saldo pendiente.</p>
          } @else {
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Vence</th>
                    <th class="num">Saldo</th>
                    <th class="num">Abono</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (documento of documentosProveedor(); track documento.id) {
                    <tr>
                      <td>{{ documento.numero }} <span class="sub">{{ documento.glosa }}</span></td>
                      <td>{{ documento.fechaVencimiento | date:'dd/MM/yyyy' }}</td>
                      <td class="num">{{ documento.saldoPendiente | number:'1.2-2' }}</td>
                      <td class="num">
                        <input class="abono-input" type="number" min="0" step="0.01"
                          [ngModel]="abonos()[documento.id!]"
                          (ngModelChange)="setAbono(documento.id!, $event)" />
                      </td>
                      <td>
                        <button mat-button type="button" (click)="pagarTotal(documento)">Total</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Glosa</mat-label>
          <input matInput [ngModel]="glosa()" (ngModelChange)="glosa.set($event)" maxlength="180" placeholder="Ej. Pago facturas noviembre" />
        </mat-form-field>

        <footer class="total-row">
          <span>Total a pagar</span>
          <strong>{{ montoTotal() | currency:'USD':'symbol':'1.2-2' }}</strong>
        </footer>

        <div class="actions-row">
          <span class="spacer"></span>
          <button mat-button type="button" routerLink="/workspace/contabilidad/cuentas-por-pagar/pagos" [disabled]="guardando()">Cancelar</button>
          <button mat-raised-button color="primary" type="button" (click)="registrar()" [disabled]="guardando() || !puedeGuardar()">
            Registrar pago
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .pago-form-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .form-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .full { width: 100%; }
    .contrapartida { display: grid; gap: .5rem; }
    .field-label { font-size: .82rem; color: var(--muted-foreground); }
    .docs-block { display: grid; gap: .5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .docs-block h3 { margin: 0; }
    .hint { margin: 0; color: var(--muted-foreground); font-size: .85rem; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 620px; }
    th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); font-size: .9rem; }
    th { font-size: .74rem; text-transform: uppercase; color: var(--muted-foreground); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sub { display: block; font-size: .76rem; color: var(--muted-foreground); }
    .abono-input { width: 110px; text-align: right; padding: .35rem .5rem; border-radius: .4rem; border: 1px solid color-mix(in srgb, var(--outline) 60%, transparent); background: transparent; color: inherit; }
    .total-row { display: flex; justify-content: flex-end; gap: 1rem; align-items: baseline; padding-top: .5rem; }
    .total-row strong { font-size: 1.3rem; }
    .actions-row { display: flex; align-items: center; gap: .5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .spacer { flex: 1; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
  `]
})
export class PagoProveedorFormComponent implements OnInit {
  private readonly service = inject(CuentasPorPagarService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly cuentas = signal<CuentaContable[]>([]);
  private readonly documentos = signal<DocumentoPorPagar[]>([]);

  protected readonly proveedorClave = signal<string | null>(null);
  protected readonly fecha = signal(this.hoyIso());
  protected readonly metodoPago = signal<MetodoPagoProveedor>('TRANSFERENCIA');
  protected readonly referencia = signal('');
  protected readonly cuentaOrigenId = signal('');
  protected readonly glosa = signal('');
  protected readonly abonos = signal<Record<string, number>>({});
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly proveedoresConSaldo = computed<ProveedorConSaldo[]>(() => {
    const mapa = new Map<string, ProveedorConSaldo>();
    for (const documento of this.pendientes()) {
      const clave = documento.proveedorId ?? `sin:${documento.proveedorNombre}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, { clave, proveedorId: documento.proveedorId ?? null, nombre: documento.proveedorNombre });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly documentosProveedor = computed(() => {
    const clave = this.proveedorClave();
    if (!clave) {
      return [];
    }
    return this.pendientes().filter((documento) => (documento.proveedorId ?? `sin:${documento.proveedorNombre}`) === clave);
  });

  protected readonly montoTotal = computed(() => this.round2(Object.values(this.abonos()).reduce((suma, monto) => suma + Number(monto || 0), 0)));

  protected readonly puedeGuardar = computed(() => this.montoTotal() > 0 && !!this.cuentaOrigenId() && !!this.proveedorClave());

  async ngOnInit(): Promise<void> {
    this.cuentas.set(await this.planCuentasService.getCuentasOnce());
    this.documentos.set(await this.service.getDocumentosOnce());
    const config = await this.service.getConfiguracionOnce();
    this.cuentaOrigenId.set(config.cuentaCajaBancoEgresoDefaultId);
  }

  private pendientes(): DocumentoPorPagar[] {
    return this.documentos().filter((documento) =>
      documento.estadoPago !== 'ANULADA' && documento.estadoPago !== 'PAGADA' && Number(documento.saldoPendiente ?? 0) > 0);
  }

  protected seleccionarProveedor(clave: string | null): void {
    this.proveedorClave.set(clave);
    this.abonos.set({});
  }

  protected setAbono(documentoId: string, valor: number | null): void {
    const documento = this.documentosProveedor().find((item) => item.id === documentoId);
    const maximo = this.round2(documento?.saldoPendiente ?? 0);
    const monto = Math.min(this.round2(Number(valor ?? 0)), maximo);
    this.abonos.update((actual) => ({ ...actual, [documentoId]: monto > 0 ? monto : 0 }));
  }

  protected pagarTotal(documento: DocumentoPorPagar): void {
    if (documento.id) {
      this.setAbono(documento.id, this.round2(documento.saldoPendiente));
    }
  }

  protected async registrar(): Promise<void> {
    if (!this.puedeGuardar()) {
      this.error.set('Selecciona proveedor, cuenta de origen y al menos un abono.');
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    try {
      const proveedor = this.proveedoresConSaldo().find((item) => item.clave === this.proveedorClave());
      const aplicaciones = this.documentosProveedor()
        .map((documento) => ({
          documentoId: documento.id!,
          documentoNumero: documento.numero ?? '',
          monto: this.round2(this.abonos()[documento.id!] ?? 0)
        }))
        .filter((aplicacion) => aplicacion.monto > 0);

      const glosa = this.glosa().trim() || `Pago a ${proveedor?.nombre ?? 'proveedor'}`;
      const config = await this.service.getConfiguracionOnce();

      let lineas: AsientoContableLinea[] | undefined;
      if (await this.integracionContable.contabilidadActiva()) {
        const propuesta = await this.integracionContable.construirLineasPagoProveedor({
          cuentaPorPagarId: config.cuentaPorPagarDefaultId,
          cuentaOrigenId: this.cuentaOrigenId(),
          proveedorId: proveedor?.proveedorId ?? null,
          glosa,
          aplicaciones: aplicaciones.map((aplicacion) => ({ documentoNumero: aplicacion.documentoNumero, monto: aplicacion.monto }))
        }, { lenient: true });

        const data: RevisarAsientoData = {
          titulo: 'Revisar asiento del pago',
          subtitulo: `${proveedor?.nombre ?? ''} · ${glosa}`,
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
          return;
        }
        lineas = resultado;
      }

      await this.service.registrarPago({
        proveedorId: proveedor?.proveedorId ?? null,
        proveedorNombre: proveedor?.nombre ?? '',
        fecha: new Date(this.fecha()).getTime(),
        cuentaOrigenId: this.cuentaOrigenId(),
        metodoPago: this.metodoPago(),
        referencia: this.referencia(),
        glosa,
        aplicaciones
      }, lineas);

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Pago registrado.', icon: 'check_circle' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      await this.router.navigate(['/workspace/contabilidad/cuentas-por-pagar/pagos']);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    } finally {
      this.guardando.set(false);
    }
  }

  private hoyIso(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private round2(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}

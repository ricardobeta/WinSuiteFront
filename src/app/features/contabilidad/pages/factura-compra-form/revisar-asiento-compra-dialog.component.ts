import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AsientoContableLinea, CuentaContable, TipoGastoCompra } from '../../models/contabilidad.models';
import { FacturaCompra, FacturaCompraItem } from '../../models/compras.models';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { TiposGastoCompraService } from '../../services/tipos-gasto-compra.service';

export interface RevisarAsientoCompraData {
  factura: FacturaCompra;
  items: FacturaCompraItem[];
  lineas: AsientoContableLinea[];
  cuentas: CuentaContable[];
  tiposGasto: TipoGastoCompra[];
  tipoGastoId: string | null;
  documento: string;
  proveedor: string;
}

export interface RevisarAsientoCompraResult {
  lineas: AsientoContableLinea[];
  tipoGastoId: string | null;
}

/**
 * Formulario de revisión del asiento generado al registrar una factura de compra. Permite elegir
 * el Tipo de Gasto (plantilla de cuentas): al cambiarlo se reconstruyen las líneas propuestas. El
 * usuario ajusta cuentas y montos antes de confirmar. Solo permite confirmar si el asiento cuadra.
 */
@Component({
  selector: 'app-revisar-asiento-compra-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>Revisar asiento de compra</h2>

    <mat-dialog-content>
      <p class="doc">{{ data.proveedor }} · {{ data.documento }}</p>

      @if (!data.factura.alimentaInventario) {
        <mat-form-field appearance="outline" class="tipo-gasto-field">
          <mat-label>Tipo de gasto</mat-label>
          <mat-select [ngModel]="tipoGastoId()" (ngModelChange)="cambiarTipoGasto($event)" [disabled]="cargando()">
            <mat-option [value]="null">— Sin plantilla (cuenta global) —</mat-option>
            @for (tipo of data.tiposGasto; track tipo.id) {
              <mat-option [value]="tipo.id">{{ tipo.nombre }}</mat-option>
            }
          </mat-select>
          <mat-hint>Al cambiarlo se recargan las cuentas de gasto del asiento.</mat-hint>
        </mat-form-field>
      }

      <div class="lines-table">
        <div class="line-row line-head">
          <span>Cuenta</span>
          <span>Detalle</span>
          <span>Debe</span>
          <span>Haber</span>
          <span></span>
        </div>

        @for (linea of lineas(); track linea.id; let index = $index) {
          <div class="line-row" [class.sin-cuenta]="!linea.cuentaId">
            <app-cuenta-contable-autocomplete
              [cuentas]="data.cuentas"
              [cuentaId]="linea.cuentaId"
              [soloActivas]="true"
              [soloMovimiento]="true"
              [mostrarNumero]="false"
              label="Cuenta"
              (cuentaSeleccionada)="seleccionarCuenta(index, $event)"
            />

            <mat-form-field appearance="outline">
              <mat-label>Detalle</mat-label>
              <input matInput [ngModel]="linea.descripcion" (ngModelChange)="actualizarDescripcion(index, $event)" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Debe</mat-label>
              <input matInput type="text" inputmode="decimal"
                [ngModel]="importeInput(linea, 'debe')"
                (ngModelChange)="actualizarImporte(index, 'debe', $event)"
                (blur)="formatear(index, 'debe')" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Haber</mat-label>
              <input matInput type="text" inputmode="decimal"
                [ngModel]="importeInput(linea, 'haber')"
                (ngModelChange)="actualizarImporte(index, 'haber', $event)"
                (blur)="formatear(index, 'haber')" />
            </mat-form-field>

            <button mat-icon-button color="warn" type="button" aria-label="Eliminar linea" (click)="eliminar(index)" [disabled]="lineas().length <= 2">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </div>

      <div class="toolbar">
        <button mat-stroked-button type="button" (click)="agregar()">
          <mat-icon>add</mat-icon>
          Agregar linea
        </button>
        @if (cargando()) {
          <span class="cargando"><mat-spinner diameter="18"></mat-spinner> Recargando plantilla…</span>
        }
      </div>

      <footer class="totals">
        <span>Total debe: <strong>{{ totalDebe() | number:'1.2-2' }}</strong></span>
        <span>Total haber: <strong>{{ totalHaber() | number:'1.2-2' }}</strong></span>
        <span [class.diff-error]="diferencia() !== 0">Diferencia: <strong>{{ diferencia() | number:'1.2-2' }}</strong></span>
      </footer>

      @if (!todasConCuenta()) {
        <p class="aviso">Hay líneas sin cuenta. Selecciónalas antes de confirmar.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-raised-button color="primary" type="button" (click)="confirmar()" [disabled]="cargando() || diferencia() !== 0 || !todasConCuenta()">
        Confirmar y registrar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .doc { margin: 0 0 1rem; color: var(--muted-foreground); }
    .tipo-gasto-field { width: 100%; margin-bottom: .5rem; }
    .lines-table { display: grid; gap: .6rem; min-width: min(860px, 82vw); }
    .line-row { display: grid; grid-template-columns: minmax(240px, 1.3fr) minmax(160px, 1fr) 120px 120px 48px; gap: .6rem; align-items: start; }
    .line-row.sin-cuenta { outline: 1px dashed color-mix(in srgb, #b3261e 55%, transparent); outline-offset: 4px; border-radius: .5rem; }
    .line-head { font-size: .78rem; text-transform: uppercase; color: var(--muted-foreground); padding: 0 .25rem; }
    .toolbar { padding-top: .75rem; display: flex; align-items: center; gap: 1rem; }
    .cargando { display: inline-flex; align-items: center; gap: .5rem; color: var(--muted-foreground); font-size: .85rem; }
    .totals { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 1rem; padding-top: .75rem; margin-top: .5rem; border-top: 1px solid color-mix(in srgb, var(--outline) 50%, transparent); }
    .diff-error { color: #b3261e; }
    .aviso { margin: .5rem 0 0; color: #b3261e; font-size: .85rem; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 900px) {
      .lines-table { min-width: 0; }
      .line-row { grid-template-columns: 1fr; }
      .line-head { display: none; }
    }
  `]
})
export class RevisarAsientoCompraDialogComponent implements OnInit {
  protected readonly data = inject<RevisarAsientoCompraData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RevisarAsientoCompraDialogComponent>);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly tiposGastoService = inject(TiposGastoCompraService);

  protected readonly lineas = signal<AsientoContableLinea[]>([]);
  protected readonly tipoGastoId = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly importeInputs = signal<Record<string, string>>({});

  protected readonly totalDebe = computed(() => this.round2(this.lineas().reduce((t, l) => t + Number(l.debe || 0), 0)));
  protected readonly totalHaber = computed(() => this.round2(this.lineas().reduce((t, l) => t + Number(l.haber || 0), 0)));
  protected readonly diferencia = computed(() => this.round2(this.totalDebe() - this.totalHaber()));
  protected readonly todasConCuenta = computed(() => this.lineas().every((l) => !!l.cuentaId));

  ngOnInit(): void {
    this.tipoGastoId.set(this.data.tipoGastoId);
    this.lineas.set(this.data.lineas.map((linea) => this.conFactura(linea)));
  }

  protected async cambiarTipoGasto(tipoGastoId: string | null): Promise<void> {
    this.tipoGastoId.set(tipoGastoId);
    this.cargando.set(true);
    try {
      const tipoGasto = tipoGastoId ? await this.tiposGastoService.getTipoGastoById(tipoGastoId) : null;
      const lineas = await this.integracionContable.construirLineasAsientoCompra(
        this.data.factura,
        this.data.items,
        tipoGasto,
        { lenient: true }
      );
      this.lineas.set(lineas.map((linea) => this.conFactura(linea)));
      this.importeInputs.set({});
    } finally {
      this.cargando.set(false);
    }
  }

  protected seleccionarCuenta(index: number, cuenta: CuentaContable | null): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => i === index
      ? { ...linea, cuentaId: cuenta?.id ?? '', codigoCuenta: cuenta?.codigo ?? '', nombreCuenta: cuenta?.nombre ?? '' }
      : linea));
  }

  protected actualizarDescripcion(index: number, value: string): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => i === index ? { ...linea, descripcion: value } : linea));
  }

  protected importeInput(linea: AsientoContableLinea, campo: 'debe' | 'haber'): string {
    return this.importeInputs()[`${linea.id}:${campo}`] ?? this.formatImporte(linea[campo]);
  }

  protected actualizarImporte(index: number, campo: 'debe' | 'haber', value: string): void {
    const linea = this.lineas()[index];
    if (!linea) {
      return;
    }
    const normalizado = this.normalizar(String(value ?? ''));
    const amount = this.parse(normalizado);
    const opuesto = campo === 'debe' ? 'haber' : 'debe';
    const updates: Record<string, string> = { [`${linea.id}:${campo}`]: normalizado };
    if (amount > 0) {
      updates[`${linea.id}:${opuesto}`] = this.formatImporte(0);
    }
    this.importeInputs.update((inputs) => ({ ...inputs, ...updates }));
    this.lineas.update((lineas) => lineas.map((item, i) => {
      if (i !== index) {
        return item;
      }
      return campo === 'debe'
        ? { ...item, debe: amount, haber: amount > 0 ? 0 : item.haber }
        : { ...item, haber: amount, debe: amount > 0 ? 0 : item.debe };
    }));
  }

  protected formatear(index: number, campo: 'debe' | 'haber'): void {
    const linea = this.lineas()[index];
    if (!linea) {
      return;
    }
    this.importeInputs.update((inputs) => ({ ...inputs, [`${linea.id}:${campo}`]: this.formatImporte(linea[campo]) }));
  }

  protected agregar(): void {
    this.lineas.update((lineas) => [...lineas, {
      id: `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      cuentaId: '',
      codigoCuenta: '',
      nombreCuenta: '',
      descripcion: this.descripcionConFactura(''),
      debe: 0,
      haber: 0
    }]);
  }

  protected eliminar(index: number): void {
    this.lineas.update((lineas) => lineas.filter((_, i) => i !== index));
  }

  protected confirmar(): void {
    if (this.cargando() || this.diferencia() !== 0 || !this.todasConCuenta()) {
      return;
    }
    const result: RevisarAsientoCompraResult = {
      lineas: this.lineas().map((linea) => ({
        ...linea,
        descripcion: this.descripcionConFactura(linea.descripcion),
        debe: this.round2(linea.debe),
        haber: this.round2(linea.haber)
      })),
      tipoGastoId: this.tipoGastoId()
    };
    this.dialogRef.close(result);
  }

  private normalizar(value: string): string {
    const sep = value.replace(/,/g, '.');
    const numeric = sep.replace(/[^\d.]/g, '');
    const [intRaw = '', ...decParts] = numeric.split('.');
    const decRaw = decParts.join('');
    const intPart = intRaw.replace(/^0+(?=\d)/, '') || (numeric.startsWith('.') ? '0' : intRaw);
    if (!numeric.includes('.')) {
      return intPart;
    }
    if (sep.endsWith('.') || sep.endsWith(',')) {
      return `${intPart || '0'}.`;
    }
    return `${intPart || '0'}.${decRaw.slice(0, 2)}`;
  }

  private parse(value: string): number {
    const amount = Number.parseFloat(value);
    return Number.isFinite(amount) ? this.round2(amount) : 0;
  }

  private formatImporte(value: number): string {
    return this.round2(value).toFixed(2);
  }

  private conFactura(linea: AsientoContableLinea): AsientoContableLinea {
    return {
      ...linea,
      descripcion: this.descripcionConFactura(linea.descripcion)
    };
  }

  private descripcionConFactura(descripcion: string): string {
    const documento = this.data.documento.trim();
    const base = descripcion.trim() || 'Compra';
    if (!documento || base.includes(documento)) {
      return base;
    }
    return `${base} - Factura #${documento}`;
  }

  private round2(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}

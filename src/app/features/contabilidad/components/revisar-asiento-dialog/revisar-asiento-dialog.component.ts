import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { CuentaContableAutocompleteComponent } from '../cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { AsientoContableLinea, CuentaContable } from '../../models/contabilidad.models';

export interface RevisarAsientoData {
  titulo: string;
  subtitulo: string;
  lineas: AsientoContableLinea[];
  cuentas: CuentaContable[];
}

/**
 * Diálogo genérico de revisión del asiento propuesto para un documento del subledger (CxP manual o
 * pago a proveedor). Muestra las líneas en modo lenient: las cuentas que falten en la configuración
 * quedan vacías para que el usuario las seleccione o cree. Solo permite confirmar si el asiento
 * cuadra y todas las líneas tienen cuenta.
 */
@Component({
  selector: 'app-revisar-asiento-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>

    <mat-dialog-content>
      <p class="doc">{{ data.subtitulo }}</p>

      <div class="general-description">
        <mat-form-field appearance="outline">
          <mat-label>Descripcion general de lineas</mat-label>
          <input matInput [ngModel]="descripcionGeneral()" (ngModelChange)="descripcionGeneral.set($event)" />
        </mat-form-field>
        <button mat-stroked-button type="button" (click)="aplicarDescripcionGeneral()" [disabled]="!descripcionGeneral().trim()">Aplicar a todas</button>
      </div>

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
      </div>

      <footer class="totals">
        <span>Total debe: <strong>{{ totalDebe() | number:'1.2-2' }}</strong></span>
        <span>Total haber: <strong>{{ totalHaber() | number:'1.2-2' }}</strong></span>
        <span [class.diff-error]="diferencia() !== 0">Diferencia: <strong>{{ diferencia() | number:'1.2-2' }}</strong></span>
      </footer>

      @if (!todasConCuenta()) {
        <p class="aviso">Hay líneas sin cuenta. Selecciónalas o créalas en el plan de cuentas antes de confirmar.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" type="button">Cancelar</button>
      <button mat-raised-button color="primary" type="button" (click)="confirmar()" [disabled]="diferencia() !== 0 || !todasConCuenta()">
        Confirmar y registrar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .doc { margin: 0 0 1rem; color: var(--muted-foreground); }
    .general-description { display: grid; grid-template-columns: minmax(260px, 1fr) auto; gap: .75rem; align-items: start; margin-bottom: .75rem; }
    .lines-table { display: grid; gap: .6rem; min-width: min(860px, 82vw); }
    .line-row { display: grid; grid-template-columns: minmax(240px, 1.3fr) minmax(160px, 1fr) 120px 120px 48px; gap: .6rem; align-items: start; }
    .line-row.sin-cuenta { outline: 1px dashed color-mix(in srgb, #b3261e 55%, transparent); outline-offset: 4px; border-radius: .5rem; }
    .line-head { font-size: .78rem; text-transform: uppercase; color: var(--muted-foreground); padding: 0 .25rem; }
    .toolbar { padding-top: .75rem; display: flex; align-items: center; gap: 1rem; }
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
export class RevisarAsientoDialogComponent implements OnInit {
  protected readonly data = inject<RevisarAsientoData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RevisarAsientoDialogComponent>);

  protected readonly lineas = signal<AsientoContableLinea[]>([]);
  protected readonly importeInputs = signal<Record<string, string>>({});
  protected readonly descripcionGeneral = signal('');

  protected readonly totalDebe = computed(() => this.round2(this.lineas().reduce((t, l) => t + Number(l.debe || 0), 0)));
  protected readonly totalHaber = computed(() => this.round2(this.lineas().reduce((t, l) => t + Number(l.haber || 0), 0)));
  protected readonly diferencia = computed(() => this.round2(this.totalDebe() - this.totalHaber()));
  protected readonly todasConCuenta = computed(() => this.lineas().every((l) => !!l.cuentaId));

  ngOnInit(): void {
    this.lineas.set(this.data.lineas.map((linea) => ({ ...linea })));
  }

  protected seleccionarCuenta(index: number, cuenta: CuentaContable | null): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => i === index
      ? { ...linea, cuentaId: cuenta?.id ?? '', codigoCuenta: cuenta?.codigo ?? '', nombreCuenta: cuenta?.nombre ?? '' }
      : linea));
  }

  protected actualizarDescripcion(index: number, value: string): void {
    this.lineas.update((lineas) => lineas.map((linea, i) => i === index ? { ...linea, descripcion: value } : linea));
  }

  protected aplicarDescripcionGeneral(): void {
    const descripcion = this.descripcionGeneral().trim();
    if (descripcion) {
      this.lineas.update((lineas) => lineas.map((linea) => ({ ...linea, descripcion })));
    }
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
      descripcion: '',
      debe: 0,
      haber: 0
    }]);
  }

  protected eliminar(index: number): void {
    this.lineas.update((lineas) => lineas.filter((_, i) => i !== index));
  }

  protected confirmar(): void {
    if (this.diferencia() !== 0 || !this.todasConCuenta()) {
      return;
    }
    this.dialogRef.close(this.lineas().map((linea) => ({
      ...linea,
      debe: this.round2(linea.debe),
      haber: this.round2(linea.haber)
    })));
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

  private round2(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}

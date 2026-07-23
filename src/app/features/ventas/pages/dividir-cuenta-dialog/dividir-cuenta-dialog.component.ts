import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { CarritoItem, MetodoPagoVenta } from '../../models/ventas.models';
import { ClienteFormDialogComponent } from '../../../../shared/components/cliente-form-dialog/cliente-form-dialog.component';
import { ClienteDialogData } from '../../../../shared/models/clientes.models';

export interface DialogClienteOption {
  id: string | null;
  nombre: string;
  identificacion?: string;
}

export interface DividirCuentaData {
  items: CarritoItem[];
  metodosPago: string[];
  etiquetaCuenta: string;
  clientes: DialogClienteOption[];
  clienteActualId: string | null;
  clienteActualNombre: string | null;
  camposPersonalizados: ClienteDialogData['camposPersonalizados'];
}

export interface SubCuentaResult {
  items: CarritoItem[];
  metodoPago: MetodoPagoVenta;
  clienteId: string | null;
  clienteNombre: string;
  total: number;
}

export interface DividirCuentaResult {
  subcuentas: SubCuentaResult[];
}

function itemKey(item: CarritoItem): string {
  return `${item.itemTipo}:${item.productoId}`;
}

const ETIQUETAS_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'T. Crédito',
  TARJETA_DEBITO: 'T. Débito',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CREDITO_CLIENTE: 'Crédito cliente'
};

@Component({
  selector: 'app-dividir-cuenta-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    <div class="divide">
      <header class="divide-head">
        <div>
          <h2>Dividir {{ data.etiquetaCuenta.toLowerCase() }}</h2>
          <p>Asigna cada producto a una cuenta. Cada una se cobra y factura por separado.</p>
        </div>
        <div class="total-general">
          <span>Total</span>
          <strong>{{ totalGeneral() | number:'1.2-2' }}</strong>
        </div>
      </header>

      <div class="count-control">
        <span class="count-label">Número de cuentas</span>
        <div class="stepper">
          <button mat-icon-button type="button" aria-label="Menos cuentas" [disabled]="numSubcuentas() <= 2" (click)="cambiarNumero(-1)">
            <mat-icon>remove</mat-icon>
          </button>
          <strong>{{ numSubcuentas() }}</strong>
          <button mat-icon-button type="button" aria-label="Más cuentas" [disabled]="numSubcuentas() >= 8" (click)="cambiarNumero(1)">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      </div>

      <div class="divide-body">
        <section class="col">
          <h3 class="col-title">Productos</h3>
          <div class="items">
            @for (item of data.items; track claveItem(item)) {
              <div class="item-row" [style.--acc]="colorCuenta(asignacion()[claveItem(item)])">
                <span class="acc-dot"></span>
                <div class="item-info">
                  <p class="item-name">{{ item.nombre }} <span class="qty">×{{ item.cantidad }}</span></p>
                  <p class="item-total">{{ totalItem(item) | number:'1.2-2' }}</p>
                </div>
                <div class="assign">
                  @for (idx of indices(); track idx) {
                    <button
                      type="button"
                      class="assign-btn"
                      [class.active]="asignacion()[claveItem(item)] === idx"
                      [style.--acc]="colorCuenta(idx)"
                      (click)="asignar(claveItem(item), idx)"
                    >
                      {{ idx + 1 }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <section class="col">
          <h3 class="col-title">Cuentas</h3>
          <div class="subcuentas">
            @for (idx of indices(); track idx) {
              <div class="subcuenta" [class.vacia]="subtotales()[idx] === 0" [style.--acc]="colorCuenta(idx)">
                <header>
                  <span class="sub-badge">{{ idx + 1 }}</span>
                  <span class="sub-name">{{ data.etiquetaCuenta }} {{ idx + 1 }}</span>
                  <span class="sub-total">{{ subtotales()[idx] | number:'1.2-2' }}</span>
                </header>
                @if (subtotales()[idx] === 0) {
                  <p class="sub-empty">Sin productos asignados</p>
                } @else {
                  <div class="cliente-row">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cliente-field">
                      <mat-label>Facturar a</mat-label>
                      <mat-select [value]="clientesSel()[idx]" (selectionChange)="setCliente(idx, $event.value)">
                        <mat-option [value]="null">Consumidor final</mat-option>
                        @for (cliente of clientesLista(); track cliente.id) {
                          <mat-option [value]="cliente.id">
                            {{ cliente.nombre }}@if (cliente.identificacion) { · {{ cliente.identificacion }} }
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-stroked-button type="button" class="cliente-nuevo" (click)="crearCliente(idx)">
                      <mat-icon>person_add</mat-icon>
                      Nuevo
                    </button>
                  </div>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Método de pago</mat-label>
                    <mat-select [value]="metodos()[idx]" (selectionChange)="setMetodo(idx, $event.value)">
                      @for (metodo of data.metodosPago; track metodo) {
                        <mat-option [value]="metodo">{{ etiquetaMetodo(metodo) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }
              </div>
            }
          </div>
        </section>
      </div>

      <footer class="divide-foot">
        @if (!valido()) {
          <p class="hint-error">
            <mat-icon>info</mat-icon>
            Cada cuenta debe tener al menos un producto.
          </p>
        } @else {
          <p class="hint-ok">
            <mat-icon>check_circle</mat-icon>
            {{ numSubcuentasConItems() }} cuentas listas para cobrar.
          </p>
        }
        <div class="foot-actions">
          <button mat-stroked-button type="button" (click)="cancelar()">Cancelar</button>
          <button mat-flat-button color="primary" type="button" [disabled]="!valido()" (click)="confirmar()">
            <mat-icon>call_split</mat-icon>
            Cobrar {{ numSubcuentasConItems() }} cuenta(s)
          </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    /* Superficie y texto del mismo par de tokens: nunca queda texto invisible en claro/oscuro. */
    .divide {
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
      width: min(720px, 92vw);
      max-height: 86vh;
      overflow: auto;
      background: var(--mat-sys-surface, #fff);
      color: var(--mat-sys-on-surface, #1a1a1a);
      border-radius: 12px;
    }
    .divide h2, .divide h3, .divide strong, .divide p, .divide span { color: inherit; }

    .divide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .divide-head h2 { margin: 0; font-size: 1.3rem; letter-spacing: -.01em; }
    .divide-head p { margin: .25rem 0 0; font-size: .88rem; opacity: .72; }
    .total-general {
      display: grid; justify-items: end; padding: .45rem .8rem; border-radius: 10px;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
    }
    .total-general span { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; opacity: .72; }
    .total-general strong { font-size: 1.25rem; color: var(--mat-sys-primary); }

    .count-control {
      display: flex; align-items: center; justify-content: space-between;
      padding: .5rem .75rem; border-radius: 10px;
      background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
    }
    .count-label { font-weight: 600; font-size: .92rem; }
    .stepper { display: inline-flex; align-items: center; gap: .5rem; }
    .stepper strong { min-width: 1.5ch; text-align: center; font-size: 1.1rem; }

    .divide-body { display: grid; grid-template-columns: 1.15fr .85fr; gap: 1rem; align-items: start; }
    .col { display: grid; gap: .5rem; min-width: 0; }
    .col-title { margin: 0; font-size: .74rem; text-transform: uppercase; letter-spacing: .07em; opacity: .6; font-weight: 700; }

    .items { display: grid; gap: .45rem; }
    .item-row {
      display: grid; grid-template-columns: auto 1fr auto; gap: .6rem; align-items: center;
      padding: .5rem .6rem; border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--mat-sys-on-surface) 14%, transparent);
      background: color-mix(in srgb, var(--mat-sys-on-surface) 3%, transparent);
    }
    .acc-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--acc) 22%, transparent); }
    .item-info { min-width: 0; }
    .item-name { margin: 0; font-weight: 600; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-name .qty { opacity: .6; font-weight: 500; }
    .item-total { margin: .1rem 0 0; font-size: .82rem; opacity: .68; }
    .assign { display: inline-flex; gap: .25rem; flex-wrap: wrap; justify-content: flex-end; max-width: 190px; }
    .assign-btn {
      width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: .85rem;
      border: 1px solid color-mix(in srgb, var(--mat-sys-on-surface) 22%, transparent);
      background: transparent; color: inherit; transition: all .12s ease;
    }
    .assign-btn:hover { border-color: var(--acc); }
    .assign-btn.active { background: var(--acc); border-color: var(--acc); color: #fff; }

    .subcuentas { display: grid; gap: .6rem; }
    .subcuenta {
      display: grid; gap: .55rem; padding: .65rem .7rem; border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--acc) 42%, transparent);
      background: color-mix(in srgb, var(--acc) 8%, transparent);
    }
    .subcuenta.vacia { border-color: color-mix(in srgb, var(--mat-sys-on-surface) 16%, transparent); background: transparent; opacity: .68; }
    .subcuenta header { display: flex; align-items: center; gap: .5rem; }
    .sub-badge { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: .78rem; font-weight: 800; color: #fff; background: var(--acc); }
    .subcuenta.vacia .sub-badge { background: color-mix(in srgb, var(--mat-sys-on-surface) 35%, transparent); }
    .sub-name { font-weight: 600; }
    .sub-total { margin-left: auto; font-weight: 800; }
    .sub-empty { margin: 0; font-size: .82rem; opacity: .6; }
    .subcuenta mat-form-field { width: 100%; }
    .cliente-row { display: flex; align-items: flex-start; gap: .4rem; }
    .cliente-field { flex: 1; min-width: 0; }
    .cliente-nuevo { flex: 0 0 auto; white-space: nowrap; }

    .divide-foot {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
      padding-top: .75rem; border-top: 1px solid color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
    }
    .hint-error, .hint-ok { display: inline-flex; align-items: center; gap: .4rem; margin: 0; font-size: .85rem; }
    .hint-error { color: var(--mat-sys-error, #d9534f); }
    .hint-ok { color: var(--mat-sys-primary); }
    .hint-error mat-icon, .hint-ok mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .foot-actions { display: inline-flex; gap: .6rem; margin-left: auto; }

    @media (max-width: 640px) {
      .divide-body { grid-template-columns: 1fr; }
      .divide-head { flex-direction: column; }
      .total-general { justify-items: start; }
    }
  `]
})
export class DividirCuentaDialogComponent {
  protected readonly data = inject<DividirCuentaData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DividirCuentaDialogComponent, DividirCuentaResult | null>);
  private readonly dialog = inject(MatDialog);

  private readonly paleta = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#ec4899'];

  protected readonly numSubcuentas = signal(2);
  protected readonly asignacion = signal<Record<string, number>>({});
  protected readonly metodos = signal<MetodoPagoVenta[]>([]);
  protected readonly clientesSel = signal<(string | null)[]>([]);
  /** Lista de clientes mutable: crece cuando se crea un cliente al vuelo. */
  protected readonly clientesLista = signal<DialogClienteOption[]>([]);

  protected readonly indices = computed(() => Array.from({ length: this.numSubcuentas() }, (_, i) => i));

  protected readonly subtotales = computed(() => {
    const totales = new Array<number>(this.numSubcuentas()).fill(0);
    const asignacion = this.asignacion();
    for (const item of this.data.items) {
      const idx = asignacion[itemKey(item)] ?? 0;
      if (idx < totales.length) {
        totales[idx] = this.round(totales[idx] + this.totalItem(item));
      }
    }
    return totales;
  });

  protected readonly totalGeneral = computed(() =>
    this.round(this.data.items.reduce((acum, item) => acum + this.totalItem(item), 0))
  );

  protected readonly numSubcuentasConItems = computed(() => this.subtotales().filter((t) => t > 0).length);

  protected readonly valido = computed(() => this.subtotales().every((t) => t > 0));

  constructor() {
    const defaultMetodo = (this.data.metodosPago[0] as MetodoPagoVenta) ?? 'EFECTIVO';
    this.metodos.set(Array.from({ length: 8 }, () => defaultMetodo));
    this.clientesLista.set([...this.data.clientes]);
    // Por defecto, cada cuenta hereda el cliente actual del carrito (se puede cambiar por cuenta).
    this.clientesSel.set(Array.from({ length: 8 }, () => this.data.clienteActualId));
    const inicial: Record<string, number> = {};
    for (const item of this.data.items) {
      inicial[itemKey(item)] = 0;
    }
    this.asignacion.set(inicial);
  }

  protected setCliente(idx: number, clienteId: string | null): void {
    this.clientesSel.update((current) => {
      const updated = [...current];
      updated[idx] = clienteId;
      return updated;
    });
  }

  /** Nombre a mostrar/facturar para un clienteId (null = consumidor final). */
  protected nombreCliente(clienteId: string | null): string {
    if (!clienteId) {
      return 'Consumidor final';
    }
    return this.clientesLista().find((cliente) => cliente.id === clienteId)?.nombre ?? 'Consumidor final';
  }

  /** Crea un cliente al vuelo y lo asigna a la sub-cuenta indicada. */
  protected async crearCliente(idx: number): Promise<void> {
    const dialogRef = this.dialog.open(ClienteFormDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      data: {
        camposPersonalizados: this.data.camposPersonalizados ?? [],
        modo: 'popup'
      } satisfies ClienteDialogData
    });

    const resultado = await firstValueFrom(dialogRef.afterClosed());
    const cliente = resultado?.cliente;
    if (!cliente?.id) {
      return;
    }

    const opcion: DialogClienteOption = {
      id: cliente.id,
      nombre: cliente.nombreCompleto,
      identificacion: cliente.identificacion
    };
    this.clientesLista.update((lista) =>
      lista.some((item) => item.id === opcion.id) ? lista : [...lista, opcion]
    );
    this.setCliente(idx, opcion.id);
  }

  protected claveItem(item: CarritoItem): string {
    return itemKey(item);
  }

  protected colorCuenta(idx: number): string {
    return this.paleta[idx % this.paleta.length];
  }

  protected etiquetaMetodo(metodo: string): string {
    return ETIQUETAS_METODO[metodo] ?? metodo;
  }

  protected totalItem(item: CarritoItem): number {
    const base = item.precioUnitario * item.cantidad;
    const desc = Math.min(base, base * (item.descuentoItem / 100));
    const neta = Math.max(0, base - desc);
    const iva = Number.isFinite(item.ivaPorcentaje) ? Math.max(0, item.ivaPorcentaje) : 0;
    return this.round(neta + this.round(neta * (iva / 100)));
  }

  protected cambiarNumero(delta: number): void {
    const next = Math.max(2, Math.min(8, this.numSubcuentas() + delta));
    this.numSubcuentas.set(next);
    this.asignacion.update((current) => {
      const updated = { ...current };
      for (const key of Object.keys(updated)) {
        if (updated[key] >= next) {
          updated[key] = 0;
        }
      }
      return updated;
    });
  }

  protected asignar(key: string, idx: number): void {
    this.asignacion.update((current) => ({ ...current, [key]: idx }));
  }

  protected setMetodo(idx: number, metodo: MetodoPagoVenta): void {
    this.metodos.update((current) => {
      const updated = [...current];
      updated[idx] = metodo;
      return updated;
    });
  }

  protected cancelar(): void {
    this.dialogRef.close(null);
  }

  protected confirmar(): void {
    const asignacion = this.asignacion();
    const metodos = this.metodos();
    const grupos = new Map<number, CarritoItem[]>();

    for (const item of this.data.items) {
      const idx = asignacion[itemKey(item)] ?? 0;
      const lista = grupos.get(idx) ?? [];
      lista.push(item);
      grupos.set(idx, lista);
    }

    const clientesSel = this.clientesSel();
    const subcuentas: SubCuentaResult[] = [];
    for (const idx of this.indices()) {
      const items = grupos.get(idx);
      if (!items || items.length === 0) {
        continue;
      }
      const clienteId = clientesSel[idx] ?? null;
      subcuentas.push({
        items,
        metodoPago: metodos[idx] ?? 'EFECTIVO',
        clienteId,
        clienteNombre: clienteId ? this.nombreCliente(clienteId) : 'CLIENTE FINAL',
        total: this.round(items.reduce((acum, item) => acum + this.totalItem(item), 0))
      });
    }

    this.dialogRef.close({ subcuentas });
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

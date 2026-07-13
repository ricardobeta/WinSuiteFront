import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { CuentaTransferencia, PagosConfig } from '@winsuite/bloques';
import { PagosConfigService } from '../../services/pagos-config.service';
import { SelectorImagenComponent } from '../../components/selector-imagen/selector-imagen.component';

/**
 * Metodos de pago de la empresa (compartidos entre sitios). La pagina /pago de cada
 * sitio publicado muestra los metodos habilitados aqui.
 */
@Component({
  selector: 'app-pagos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatIconModule, SelectorImagenComponent],
  template: `
    @if (borrador(); as c) {
      <div class="pagina">
        <header>
          <h2>Metodos de pago</h2>
          <p class="nota">
            Se comparten entre todos tus sitios. Tus clientes los veran en la pagina
            <b>/pago</b> del sitio publicado (bloques "Boton de pago" y checkout del carrito).
          </p>
        </header>

        <section [class.apagada]="!c.payphone?.habilitado">
          <label class="check titulo-metodo">
            <input
              type="checkbox"
              [ngModel]="c.payphone?.habilitado ?? false"
              (ngModelChange)="patch('payphone', { habilitado: $event })"
            />
            <span>📱 Payphone (tarjeta y saldo)</span>
          </label>
          @if (c.payphone?.habilitado) {
            <p class="ayuda">
              Crea un usuario con rol <b>Developer</b> en tu cuenta Payphone Business y copia sus
              credenciales de la Cajita de Pagos (docs.payphone.app/cajita-de-pagos).
            </p>
            <div class="fila">
              <label>
                Store ID
                <input
                  [ngModel]="c.payphone?.storeId"
                  maxlength="64"
                  (ngModelChange)="patch('payphone', { storeId: $event })"
                />
              </label>
              <label>
                Token
                <input
                  type="password"
                  [ngModel]="c.payphone?.token"
                  maxlength="2000"
                  (ngModelChange)="patch('payphone', { token: $event })"
                />
              </label>
            </div>
          }
        </section>

        <section [class.apagada]="!c.transferencia?.habilitado">
          <label class="check titulo-metodo">
            <input
              type="checkbox"
              [ngModel]="c.transferencia?.habilitado ?? false"
              (ngModelChange)="patch('transferencia', { habilitado: $event })"
            />
            <span>🏦 Transferencia bancaria</span>
          </label>
          @if (c.transferencia?.habilitado) {
            @for (cuenta of c.transferencia?.cuentas ?? []; track $index; let i = $index) {
              <div class="cuenta">
                <div class="fila">
                  <label
                    >Banco<input
                      [ngModel]="cuenta.banco"
                      maxlength="80"
                      (ngModelChange)="patchCuenta(i, { banco: $event })"
                  /></label>
                  <label>
                    Tipo
                    <select
                      [ngModel]="cuenta.tipoCuenta"
                      (ngModelChange)="patchCuenta(i, { tipoCuenta: $event })"
                    >
                      <option value="ahorros">Ahorros</option>
                      <option value="corriente">Corriente</option>
                    </select>
                  </label>
                </div>
                <div class="fila">
                  <label
                    >Numero de cuenta<input
                      [ngModel]="cuenta.numero"
                      maxlength="30"
                      (ngModelChange)="patchCuenta(i, { numero: $event })"
                  /></label>
                  <label
                    >Titular<input
                      [ngModel]="cuenta.titular"
                      maxlength="120"
                      (ngModelChange)="patchCuenta(i, { titular: $event })"
                  /></label>
                </div>
                <label
                  >Cedula / RUC del titular<input
                    [ngModel]="cuenta.cedula"
                    maxlength="20"
                    (ngModelChange)="patchCuenta(i, { cedula: $event })"
                /></label>
                <button type="button" class="quitar" (click)="quitarCuenta(i)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
            <button mat-stroked-button (click)="agregarCuenta()">
              <mat-icon>add</mat-icon> Agregar cuenta
            </button>
            <label>
              Instrucciones para el cliente
              <textarea
                rows="2"
                placeholder="Ej.: Envia el comprobante por WhatsApp al terminar."
                [ngModel]="c.transferencia?.instrucciones"
                maxlength="1000"
                (ngModelChange)="patch('transferencia', { instrucciones: $event })"
              ></textarea>
            </label>
          }
        </section>

        <section [class.apagada]="!c.qr?.habilitado">
          <label class="check titulo-metodo">
            <input
              type="checkbox"
              [ngModel]="c.qr?.habilitado ?? false"
              (ngModelChange)="patch('qr', { habilitado: $event })"
            />
            <span>📲 Pago con QR (De Una, banco, etc.)</span>
          </label>
          @if (c.qr?.habilitado) {
            <div class="campo">
              <span>Imagen de tu codigo QR</span>
              <app-selector-imagen
                [url]="c.qr?.imagenUrl || undefined"
                (urlChange)="patch('qr', { imagenUrl: $event })"
              />
            </div>
            <label>
              Instrucciones para el cliente
              <textarea
                rows="2"
                placeholder="Ej.: Escanea con tu app De Una y envia el comprobante."
                [ngModel]="c.qr?.instrucciones"
                maxlength="1000"
                (ngModelChange)="patch('qr', { instrucciones: $event })"
              ></textarea>
            </label>
          }
        </section>

        <section [class.apagada]="!c.efectivo?.habilitado">
          <label class="check titulo-metodo">
            <input
              type="checkbox"
              [ngModel]="c.efectivo?.habilitado ?? false"
              (ngModelChange)="patch('efectivo', { habilitado: $event })"
            />
            <span>💵 Efectivo (contra entrega / en local)</span>
          </label>
          @if (c.efectivo?.habilitado) {
            <label>
              Nota para el cliente
              <textarea
                rows="2"
                placeholder="Ej.: Pagas al recibir tu pedido."
                [ngModel]="c.efectivo?.nota"
                maxlength="1000"
                (ngModelChange)="patch('efectivo', { nota: $event })"
              ></textarea>
            </label>
          }
        </section>

        <div class="acciones">
          <button mat-flat-button color="primary" [disabled]="guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando...' : 'Guardar metodos de pago' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 680px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h2 {
      margin: 0;
    }
    .nota {
      margin: 4px 0 0;
      opacity: 0.65;
      font-size: 0.88rem;
    }
    section {
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      border: 1px solid var(--tc-ghost-border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: opacity 0.15s ease;
    }
    section.apagada {
      opacity: 0.75;
    }
    .titulo-metodo {
      font-size: 1rem;
      font-weight: 700;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    input:not([type='checkbox']),
    select,
    textarea {
      font: inherit;
      font-weight: 400;
      padding: 9px 10px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
    .fila {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    .cuenta {
      position: relative;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 10px;
      padding: 12px;
      padding-right: 34px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .quitar {
      position: absolute;
      top: 6px;
      right: 6px;
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.55;
      padding: 2px;
    }
    .quitar:hover {
      color: var(--tc-error);
      opacity: 1;
    }
    .ayuda {
      margin: 0;
      opacity: 0.65;
      font-size: 0.82rem;
    }
    .acciones {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class PagosPageComponent {
  private readonly pagosService = inject(PagosConfigService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly remota = toSignal(this.pagosService.getConfig(), { initialValue: null });
  /** Copia local editable; se persiste con el boton Guardar. */
  readonly borrador = signal<PagosConfig | null>(null);
  readonly guardando = signal(false);

  constructor() {
    // Carga inicial (y recarga si otro dispositivo la cambia y aun no editaste).
    effect(() => {
      const remota = this.remota();
      if (remota && this.borrador() === null) this.borrador.set(structuredClone(remota));
    });
  }

  patch(metodo: 'efectivo' | 'transferencia' | 'qr' | 'payphone', cambios: object): void {
    const actual = this.borrador();
    if (!actual) return;
    const base: object =
      actual[metodo] ??
      (metodo === 'transferencia' ? { habilitado: false, cuentas: [] } : { habilitado: false });
    this.borrador.set({ ...actual, [metodo]: { ...base, ...cambios } });
  }

  patchCuenta(indice: number, cambios: Partial<CuentaTransferencia>): void {
    const actual = this.borrador();
    if (!actual?.transferencia) return;
    const cuentas = actual.transferencia.cuentas.map((cuenta, i) =>
      i === indice ? { ...cuenta, ...cambios } : cuenta,
    );
    this.patch('transferencia', { cuentas });
  }

  agregarCuenta(): void {
    const cuentas = this.borrador()?.transferencia?.cuentas ?? [];
    this.patch('transferencia', {
      cuentas: [
        ...cuentas,
        { banco: '', tipoCuenta: 'ahorros' as const, numero: '', titular: '', cedula: '' },
      ],
    });
  }

  quitarCuenta(indice: number): void {
    const cuentas = this.borrador()?.transferencia?.cuentas ?? [];
    this.patch('transferencia', { cuentas: cuentas.filter((_, i) => i !== indice) });
  }

  async guardar(): Promise<void> {
    const config = this.borrador();
    if (!config) return;
    this.guardando.set(true);
    try {
      await this.pagosService.guardar(config);
      this.snackBar.open('Metodos de pago guardados', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('No se pudo guardar (revisa los datos de las cuentas)', 'OK', {
        duration: 5000,
      });
    } finally {
      this.guardando.set(false);
    }
  }
}

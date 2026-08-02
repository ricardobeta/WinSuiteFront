import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AjustesPago } from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

/**
 * Como cobra WinSuit: que metodos se ofrecen, a que cuentas se deposita y con que QR.
 *
 * <p>Las credenciales de comercio de Payphone no se editan aqui: son secretos de la plataforma
 * y viven en variables de entorno. Este interruptor solo decide si el metodo se muestra.
 */
@Component({
  selector: 'app-ajustes-pago',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  template: `
    <form class="pagina" [formGroup]="form" (ngSubmit)="guardar()">
      <section class="surface-card bloque">
        <div>
          <p class="eyebrow">Cobros</p>
          <h2>Metodos de pago</h2>
          <p class="sub">Lo que ven los clientes al comprar un plan o un complemento.</p>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <mat-slide-toggle formControlName="payphoneHabilitado">
          Tarjeta de credito o debito (Payphone)
        </mat-slide-toggle>
        <p class="nota">
          Requiere que PAYPHONE_TOKEN y PAYPHONE_STORE_ID esten configurados en el servidor. Sin
          ellos, el metodo no se ofrece aunque este activado aqui.
        </p>
      </section>

      <section class="surface-card bloque">
        <div>
          <h3>Transferencia bancaria</h3>
        </div>

        <mat-slide-toggle formControlName="transferenciaHabilitada">
          Aceptar transferencias
        </mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label>Instrucciones para el cliente</mat-label>
          <textarea matInput rows="2" formControlName="transferenciaInstrucciones"></textarea>
        </mat-form-field>

        <div class="cuentas" formArrayName="cuentas">
          @for (cuenta of cuentas.controls; track $index) {
            <div class="cuenta" [formGroupName]="$index">
              <mat-form-field appearance="outline">
                <mat-label>Banco</mat-label>
                <input matInput formControlName="banco" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <input matInput formControlName="tipo" placeholder="Ahorros o corriente" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Numero</mat-label>
                <input matInput formControlName="numero" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Titular</mat-label>
                <input matInput formControlName="titular" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>RUC o cedula</mat-label>
                <input matInput formControlName="identificacion" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Correo</mat-label>
                <input matInput formControlName="correo" />
              </mat-form-field>
              <button mat-icon-button type="button" (click)="quitarCuenta($index)" aria-label="Quitar cuenta">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>

        <button mat-stroked-button type="button" (click)="agregarCuenta()">
          <mat-icon>add</mat-icon>
          Anadir cuenta
        </button>
      </section>

      <section class="surface-card bloque">
        <div>
          <h3>Pago con QR</h3>
        </div>

        <mat-slide-toggle formControlName="qrHabilitado">Aceptar pagos con QR</mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label>URL de la imagen del QR</mat-label>
          <input matInput formControlName="qrImagenUrl" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Instrucciones para el cliente</mat-label>
          <textarea matInput rows="2" formControlName="qrInstrucciones"></textarea>
        </mat-form-field>

        @if (form.value.qrImagenUrl) {
          <img class="qr" [src]="form.value.qrImagenUrl" alt="Vista previa del QR" />
        }
      </section>

      <div class="acciones">
        <button mat-raised-button color="primary" type="submit" [disabled]="guardando()">
          <mat-icon>save</mat-icon>
          Guardar
        </button>
      </div>
    </form>
  `,
  styles: [`
    .pagina { display: grid; gap: 1rem; align-content: start; }
    .bloque { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    h2 { margin: 0; font-size: 1.5rem; }
    h3 { margin: 0; font-size: 1.1rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .nota { margin: 0; color: var(--muted-foreground); font-size: .85rem; }
    .error { margin: 0; color: #b3261e; }
    .cuentas { display: grid; gap: .8rem; }
    .cuenta {
      display: grid; gap: .5rem; align-items: center;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) auto;
      padding: .8rem; border-radius: var(--tc-radius-md, 10px);
      background: var(--tc-surface-container-low);
    }
    .qr { max-width: 200px; border-radius: var(--tc-radius-md, 10px); }
    .acciones { display: flex; justify-content: flex-end; }
  `],
})
export class AjustesPagoComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    payphoneHabilitado: [true],
    transferenciaHabilitada: [false],
    transferenciaInstrucciones: [''],
    qrHabilitado: [false],
    qrImagenUrl: [''],
    qrInstrucciones: [''],
    cuentas: this.fb.array<ReturnType<AjustesPagoComponent['grupoCuenta']>>([]),
  });

  protected get cuentas(): FormArray {
    return this.form.get('cuentas') as FormArray;
  }

  ngOnInit(): void {
    this.api.obtenerAjustesPago().subscribe({
      next: (ajustes) => this.rellenar(ajustes),
      error: () => this.error.set('No pudimos cargar los ajustes de cobro.'),
    });
  }

  protected agregarCuenta(): void {
    this.cuentas.push(this.grupoCuenta());
  }

  protected quitarCuenta(indice: number): void {
    this.cuentas.removeAt(indice);
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.error.set('');
    this.api.guardarAjustesPago(this.form.getRawValue() as AjustesPago).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: { message: 'Ajustes de cobro guardados.' },
          duration: 3000,
        });
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No pudimos guardar los ajustes.');
      },
    });
  }

  private rellenar(ajustes: AjustesPago): void {
    this.form.patchValue({
      payphoneHabilitado: ajustes.payphoneHabilitado,
      transferenciaHabilitada: ajustes.transferenciaHabilitada,
      transferenciaInstrucciones: ajustes.transferenciaInstrucciones ?? '',
      qrHabilitado: ajustes.qrHabilitado,
      qrImagenUrl: ajustes.qrImagenUrl ?? '',
      qrInstrucciones: ajustes.qrInstrucciones ?? '',
    });
    this.cuentas.clear();
    for (const cuenta of ajustes.cuentas ?? []) {
      this.cuentas.push(
        this.grupoCuenta(
          cuenta.banco,
          cuenta.tipo,
          cuenta.numero,
          cuenta.titular,
          cuenta.identificacion,
          cuenta.correo,
        ),
      );
    }
  }

  private grupoCuenta(
    banco = '',
    tipo = '',
    numero = '',
    titular = '',
    identificacion = '',
    correo = '',
  ) {
    return this.fb.group({ banco, tipo, numero, titular, identificacion, correo });
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { AiConnectorService, ConectorIaView, PruebaConexionIa } from '../../../../core/services/ai-connector.service';
import { PlanService } from '../../../../core/services/plan.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

/**
 * Conector de IA de la empresa. Permite usar una clave propia (Google AI Studio o Anthropic)
 * en lugar de la cuenta general de WinSuit: es la salida cuando se agota el cupo de tokens,
 * porque ese consumo lo factura el proveedor directamente al cliente.
 */
@Component({
  selector: 'app-empresa-ia',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <section class="surface-card bloque">
      <div>
        <p class="eyebrow">Empresa</p>
        <h2>Conector de inteligencia artificial</h2>
        <p class="sub">
          De forma predeterminada, las funciones de IA usan la cuenta general de WinSuit y
          consumen el cupo de tokens de tu plan. Si prefieres, puedes usar tu propia clave: en
          ese caso el consumo lo facturas directamente a tu proveedor y deja de gastar tu cupo.
        </p>
      </div>

      @if (tokens(); as consumo) {
        <div class="consumo">
          <div class="consumo-texto">
            <span>Tokens de IA de tu plan</span>
            <strong>
              {{ consumo.consumido.toLocaleString('es-EC') }}
              @if (consumo.limite !== null && consumo.limite >= 0) {
                / {{ consumo.limite.toLocaleString('es-EC') }}
              }
            </strong>
          </div>
          @if (consumo.porcentaje !== null) {
            <mat-progress-bar mode="determinate" [value]="consumo.porcentaje" />
          }
          @if (consumo.agotado) {
            <p class="agotado">
              <mat-icon>info</mat-icon>
              Tu cupo de este mes esta agotado. Configura tu clave o
              <a routerLink="/workspace/planes">amplia tu plan</a>.
            </p>
          }
        </div>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="guardar()">
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Proveedor</mat-label>
            <mat-select formControlName="provider">
              <mat-option value="gemini">Google AI Studio (Gemini)</mat-option>
              <mat-option value="anthropic">Anthropic (Claude)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Modelo</mat-label>
            <input matInput type="text" formControlName="model" placeholder="Dejalo vacio para el modelo por defecto" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="ancho-total">
            <mat-label>{{ conector()?.tieneClavePropia ? 'Reemplazar clave de API' : 'Clave de API' }}</mat-label>
            <input matInput type="password" formControlName="apiKey" autocomplete="off"
                   [placeholder]="conector()?.tieneClavePropia ? 'Dejalo vacio para conservar la actual' : ''" />
            <mat-hint>
              La clave se guarda cifrada y no vuelve a mostrarse.
              @if (conector()?.tieneClavePropia) {
                Ya tienes una clave guardada.
              }
            </mat-hint>
          </mat-form-field>
        </div>

        <div class="alcance">
          <p class="etiqueta">Para que funciones se usa tu clave</p>
          <mat-radio-group formControlName="alcance">
            <mat-radio-button value="todas">
              Todas las funciones de IA (copilotos, sitios web, conciliacion bancaria y WhatsApp)
            </mat-radio-button>
            <mat-radio-button value="whatsapp">
              Solo el asistente de ventas por WhatsApp
            </mat-radio-button>
          </mat-radio-group>
        </div>

        <mat-slide-toggle formControlName="habilitado">
          Usar mi propia clave
        </mat-slide-toggle>

        <div class="acciones">
          @if (conector()?.tieneClavePropia) {
            <button mat-stroked-button color="warn" type="button" (click)="borrarClave()" [disabled]="ocupado()">
              Quitar mi clave
            </button>
          }
          <button mat-stroked-button type="button" (click)="probar()" [disabled]="ocupado()">
            <mat-icon>network_check</mat-icon>
            Probar conexion
          </button>
          <button mat-raised-button color="primary" type="submit" [disabled]="ocupado() || form.invalid">
            <mat-icon>save</mat-icon>
            Guardar
          </button>
        </div>
      </form>

      @if (prueba(); as resultado) {
        <p class="prueba" [class.ok]="resultado.ok">
          <mat-icon>{{ resultado.ok ? 'check_circle' : 'error' }}</mat-icon>
          {{ resultado.mensaje }}
          <small>
            Proveedor: {{ resultado.provider }} ·
            {{ resultado.usoClavePropia ? 'con tu clave' : 'con la cuenta de WinSuit' }}
          </small>
        </p>
      }
    </section>
  `,
  styles: [`
    .bloque { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    h2 { margin: 0; font-size: 1.35rem; }
    .sub { margin: .35rem 0 0; color: var(--muted-foreground); max-width: 70ch; }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .consumo { display: grid; gap: .4rem; padding: .85rem; border-radius: var(--tc-radius-md, 10px); background: var(--tc-surface-container-low); }
    .consumo-texto { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
    .consumo-texto span { color: var(--muted-foreground); font-size: .88rem; }
    .agotado { display: flex; align-items: center; gap: .4rem; margin: .2rem 0 0; color: #b3261e; font-size: .9rem; }
    form { display: grid; gap: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: .75rem; align-items: start; }
    .ancho-total { grid-column: 1 / -1; }
    .alcance { display: grid; gap: .5rem; }
    .etiqueta { margin: 0; font-weight: 600; }
    mat-radio-group { display: grid; gap: .35rem; }
    .acciones { display: flex; justify-content: flex-end; gap: .6rem; flex-wrap: wrap; }
    .prueba { display: grid; grid-template-columns: auto 1fr; gap: .1rem .5rem; align-items: center; margin: 0; color: #b3261e; }
    .prueba.ok { color: var(--primary); }
    .prueba small { grid-column: 2; color: var(--muted-foreground); }
    .error { margin: 0; color: #b3261e; }
  `],
})
export class EmpresaIaComponent implements OnInit {
  private readonly api = inject(AiConnectorService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly planService = inject(PlanService);

  protected readonly conector = signal<ConectorIaView | null>(null);
  protected readonly prueba = signal<PruebaConexionIa | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly tokens = computed(() => this.planService.estado('aiTokens'));

  protected readonly form = this.formBuilder.nonNullable.group({
    provider: ['gemini' as 'gemini' | 'anthropic', Validators.required],
    model: [''],
    apiKey: [''],
    alcance: ['todas' as 'todas' | 'whatsapp', Validators.required],
    habilitado: [false],
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.api.obtener().subscribe({
      next: (conector) => this.aplicar(conector),
      error: () => this.error.set('No se pudo cargar el conector de IA.'),
    });
  }

  private aplicar(conector: ConectorIaView): void {
    this.conector.set(conector);
    this.form.patchValue({
      provider: conector.provider,
      model: conector.model ?? '',
      apiKey: '',
      alcance: conector.alcance,
      habilitado: conector.habilitado,
    });
  }

  protected guardar(): void {
    const valores = this.form.getRawValue();
    this.ocupado.set(true);
    this.error.set(null);
    this.api
      .guardar({
        provider: valores.provider,
        model: valores.model || null,
        apiKey: valores.apiKey,
        alcance: valores.alcance,
        habilitado: valores.habilitado,
      })
      .subscribe({
        next: (conector) => {
          this.aplicar(conector);
          this.ocupado.set(false);
          this.avisar('Conector de IA actualizado');
        },
        error: (respuesta: { error?: { error?: string } }) => {
          this.ocupado.set(false);
          this.error.set(respuesta?.error?.error ?? 'No se pudo guardar el conector.');
        },
      });
  }

  protected borrarClave(): void {
    this.ocupado.set(true);
    this.api.borrarClave().subscribe({
      next: (conector) => {
        this.aplicar(conector);
        this.ocupado.set(false);
        this.avisar('Se volvio a la cuenta de WinSuit');
      },
      error: () => {
        this.ocupado.set(false);
        this.error.set('No se pudo quitar la clave.');
      },
    });
  }

  protected probar(): void {
    this.ocupado.set(true);
    this.prueba.set(null);
    this.api.probar().subscribe({
      next: (resultado) => {
        this.prueba.set(resultado);
        this.ocupado.set(false);
      },
      error: () => {
        this.ocupado.set(false);
        this.error.set('No se pudo ejecutar la prueba de conexion.');
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

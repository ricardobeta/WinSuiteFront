import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import { CuentaContable, CuentaGastoPlantilla, TipoGastoCompra } from '../../models/contabilidad.models';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { TiposGastoCompraService } from '../../services/tipos-gasto-compra.service';

@Component({
  selector: 'app-tipos-gasto-compra',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent
  ],
  template: `
    <section class="tipos-gasto-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Configuracion</p>
          <h2>Tipos de gasto</h2>
          <p>Plantillas de cuentas de gasto/costo que se precargan al contabilizar una factura de compra.</p>
        </div>
        <a mat-button routerLink="/workspace/contabilidad/configuracion">Volver a configuracion</a>
      </header>

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <div class="layout">
        <section class="surface-card list-card">
          <div class="section-toolbar">
            <h3>Tipos registrados</h3>
            <button mat-stroked-button type="button" (click)="nuevo()">
              <mat-icon>add</mat-icon>
              Nuevo
            </button>
          </div>

          @if (tipos().length === 0) {
            <p class="empty">Aun no hay tipos de gasto. Crea el primero (ej. "Gasto Internet").</p>
          } @else {
            <ul class="tipo-list">
              @for (tipo of tipos(); track tipo.id) {
                <li [class.selected]="tipo.id === editandoId()" [class.inactivo]="!tipo.activo">
                  <button type="button" class="tipo-item" (click)="editar(tipo)">
                    <strong>{{ tipo.nombre }}</strong>
                    <span>{{ tipo.cuentasGasto.length }} cuenta(s){{ tipo.activo ? '' : ' · inactivo' }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </section>

        <section class="surface-card form-card">
          <h3>{{ editandoId() ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto' }}</h3>

          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" maxlength="120" placeholder="Gasto Internet" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Descripcion</mat-label>
            <textarea matInput rows="2" [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)"></textarea>
          </mat-form-field>

          <mat-slide-toggle [ngModel]="activo()" (ngModelChange)="activo.set($event)">Activo</mat-slide-toggle>

          <div class="cuentas-block">
            <div class="section-toolbar">
              <h4>Cuentas de gasto/costo (DEBE)</h4>
              <span class="hint" matTooltip="Al contabilizar, la primera cuenta recibe la base y el resto quedan en cero para que repartas los montos.">
                <mat-icon>help_outline</mat-icon>
              </span>
            </div>

            @if (cuentasGasto().length > 0) {
              <ul class="cuentas-list">
                @for (cuenta of cuentasGasto(); track cuenta.cuentaId; let i = $index) {
                  <li>
                    <span><strong>{{ cuenta.codigoCuenta }}</strong> {{ cuenta.nombreCuenta }}</span>
                    <button mat-icon-button color="warn" type="button" aria-label="Quitar cuenta" (click)="quitarCuenta(i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </li>
                }
              </ul>
            }

            <app-cuenta-contable-autocomplete
              [cuentas]="cuentas()"
              [soloActivas]="true"
              [soloMovimiento]="true"
              [mostrarNumero]="false"
              label="Agregar cuenta de gasto"
              (cuentaSeleccionada)="agregarCuenta($event)"
            />
          </div>

          <div class="actions-row">
            @if (editandoId()) {
              <button mat-button color="warn" type="button" (click)="desactivar()" [disabled]="guardando()">Desactivar</button>
            }
            <span class="spacer"></span>
            <button mat-button type="button" (click)="nuevo()" [disabled]="guardando()">Limpiar</button>
            <button mat-raised-button color="primary" type="button" (click)="guardar()" [disabled]="guardando() || !puedeGuardar()">
              {{ editandoId() ? 'Guardar cambios' : 'Crear' }}
            </button>
          </div>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .tipos-gasto-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .layout { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 1rem; align-items: start; }
    .list-card, .form-card { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .section-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .section-toolbar h3, .section-toolbar h4 { margin: 0; }
    .tipo-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
    .tipo-list li { border: 1px solid color-mix(in srgb, var(--outline) 55%, transparent); border-radius: .5rem; }
    .tipo-list li.selected { border-color: var(--primary); }
    .tipo-list li.inactivo { opacity: .6; }
    .tipo-item { width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: .65rem .8rem; display: grid; gap: .2rem; color: inherit; }
    .tipo-item span { color: var(--muted-foreground); font-size: .82rem; }
    .cuentas-block { display: grid; gap: .75rem; padding-top: .5rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .cuentas-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; }
    .cuentas-list li { display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: .35rem .6rem; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .5rem; }
    .hint { color: var(--muted-foreground); display: inline-flex; }
    .empty { color: var(--muted-foreground); margin: 0; }
    .actions-row { display: flex; align-items: center; gap: .5rem; padding-top: .5rem; border-top: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); }
    .spacer { flex: 1; }
    .error-box { padding: .8rem 1rem; border-radius: .5rem; background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `]
})
export class TiposGastoCompraComponent implements OnInit {
  private readonly service = inject(TiposGastoCompraService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly tipos = signal<TipoGastoCompra[]>([]);
  protected readonly cuentas = signal<CuentaContable[]>([]);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly activo = signal(true);
  protected readonly cuentasGasto = signal<CuentaGastoPlantilla[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly puedeGuardar = computed(() => this.nombre().trim().length > 0 && this.cuentasGasto().length > 0);

  async ngOnInit(): Promise<void> {
    this.cuentas.set(await this.planCuentasService.getCuentasOnce());
    this.service.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipos) => this.tipos.set(tipos));
  }

  protected nuevo(): void {
    this.editandoId.set(null);
    this.nombre.set('');
    this.descripcion.set('');
    this.activo.set(true);
    this.cuentasGasto.set([]);
    this.error.set(null);
  }

  protected editar(tipo: TipoGastoCompra): void {
    this.editandoId.set(tipo.id ?? null);
    this.nombre.set(tipo.nombre);
    this.descripcion.set(tipo.descripcion ?? '');
    this.activo.set(tipo.activo);
    this.cuentasGasto.set([...tipo.cuentasGasto]);
    this.error.set(null);
  }

  protected agregarCuenta(cuenta: CuentaContable | null): void {
    if (!cuenta?.id) {
      return;
    }
    if (this.cuentasGasto().some((item) => item.cuentaId === cuenta.id)) {
      return;
    }
    this.cuentasGasto.update((lista) => [
      ...lista,
      { cuentaId: cuenta.id!, codigoCuenta: cuenta.codigo, nombreCuenta: cuenta.nombre }
    ]);
  }

  protected quitarCuenta(index: number): void {
    this.cuentasGasto.update((lista) => lista.filter((_, i) => i !== index));
  }

  protected async guardar(): Promise<void> {
    if (!this.puedeGuardar()) {
      this.error.set('Indica un nombre y al menos una cuenta de gasto.');
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    try {
      const tipo: TipoGastoCompra = {
        nombre: this.nombre(),
        descripcion: this.descripcion(),
        activo: this.activo(),
        cuentasGasto: this.cuentasGasto()
      };
      const id = this.editandoId();
      if (id) {
        await this.service.actualizar(id, tipo);
        this.mostrar('Tipo de gasto actualizado.', 'save');
      } else {
        await this.service.crear(tipo);
        this.mostrar('Tipo de gasto creado.', 'check_circle');
        this.nuevo();
      }
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el tipo de gasto.');
    } finally {
      this.guardando.set(false);
    }
  }

  protected async desactivar(): Promise<void> {
    const id = this.editandoId();
    if (!id) {
      return;
    }
    this.guardando.set(true);
    try {
      await this.service.desactivar(id);
      this.mostrar('Tipo de gasto desactivado.', 'block');
      this.nuevo();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo desactivar.');
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrar(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

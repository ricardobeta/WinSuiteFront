import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { Categoria, Proveedor } from '../../../inventario/models/inventario.models';
import { CategoriasService } from '../../../inventario/services/categorias.service';
import { ProveedoresService } from '../../../inventario/services/proveedores.service';
import { CuentaContableAutocompleteComponent } from '../../components/cuenta-contable-autocomplete/cuenta-contable-autocomplete.component';
import {
  ConfiguracionEmpresaContable,
  ConfiguracionIntegracionContable,
  CuentaContable,
  MapeoCategoriaContable,
  MapeoProveedorContable,
  PendienteContabilizacion,
  PeriodoContable,
  TipoContribuyente
} from '../../models/contabilidad.models';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';
import { PlanCuentasService } from '../../services/plan-cuentas.service';
import { NominaConfiguracionContableComponent } from '../nomina-configuracion/nomina-configuracion-contable.component';
import { TiposGastoCompraComponent } from '../tipos-gasto/tipos-gasto-compra.component';
import { CxpConfiguracionComponent } from '../cxp-configuracion/cxp-configuracion.component';

type CuentaIntegracionKey =
  | 'cuentaCajaBancoId'
  | 'cuentaCuentasPorCobrarId'
  | 'cuentaCuentasPorPagarId'
  | 'cuentaVentasProductosId'
  | 'cuentaVentasServiciosId'
  | 'cuentaIvaVentasId'
  | 'cuentaIvaComprasId'
  | 'cuentaInventarioId'
  | 'cuentaCostoVentasId'
  | 'cuentaDescuentosVentasId'
  | 'cuentaGastoComprasId'
  | 'cuentaRetencionFuenteXPagarId'
  | 'cuentaRetencionIvaXPagarId';

type CuentaIntegracionCampo = {
  key: CuentaIntegracionKey;
  label: string;
  tooltip: string;
};

@Component({
  selector: 'app-configuracion-contable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    CuentaContableAutocompleteComponent,
    NominaConfiguracionContableComponent,
    TiposGastoCompraComponent,
    CxpConfiguracionComponent
  ],
  template: `
    <section class="config-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad</p>
          <h2>
            Configuracion contable
            <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.submodulo" aria-label="Ayuda configuracion contable">
              <mat-icon>help_outline</mat-icon>
            </button>
          </h2>
          <p>Define la empresa que llevara contabilidad y controla sus periodos mensuales.</p>
        </div>
      </header>

      @if (!empresaConfigurada()) {
        <section class="warning-box">
          <mat-icon>info</mat-icon>
          <span>Completa la configuracion de empresa y genera los periodos antes de registrar asientos.</span>
        </section>
      }

      @if (error()) {
        <section class="error-box">{{ error() }}</section>
      }

      <section class="surface-card tabs-card">
        <mat-tab-group [selectedIndex]="tabInicial()">
          <mat-tab label="Empresa">
            <form class="empresa-form" (ngSubmit)="guardarEmpresa()">
              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>RUC</mat-label>
                  <input
                    matInput
                    maxlength="20"
                    inputmode="numeric"
                    [ngModel]="empresaForm.ruc"
                    (ngModelChange)="actualizarRucEmpresa($event)"
                    name="ruc"
                    [readonly]="!canUpdate()"
                  />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.ruc" aria-label="Ayuda RUC">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Razon social</mat-label>
                  <input matInput [(ngModel)]="empresaForm.razonSocial" name="razonSocial" [readonly]="!canUpdate()" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.razonSocial" aria-label="Ayuda razon social">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Nombre comercial</mat-label>
                  <input matInput [(ngModel)]="empresaForm.nombreComercial" name="nombreComercial" [readonly]="!canUpdate()" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.nombreComercial" aria-label="Ayuda nombre comercial">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>Tipo contribuyente</mat-label>
                  <mat-select [(ngModel)]="empresaForm.tipoContribuyente" name="tipoContribuyente" [disabled]="!canUpdate()">
                    <mat-option value="RIMPE">RIMPE</mat-option>
                    <mat-option value="NORMAL">Normal</mat-option>
                    <mat-option value="ESPECIAL">Especial</mat-option>
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.tipoContribuyente" aria-label="Ayuda tipo contribuyente">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Moneda funcional</mat-label>
                  <input matInput [(ngModel)]="empresaForm.monedaFuncional" name="monedaFuncional" readonly />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.moneda" aria-label="Ayuda moneda funcional">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha inicio contable</mat-label>
                  <input
                    matInput
                    [matDatepicker]="pickerInicio"
                    [ngModel]="fechaInicioDate()"
                    (ngModelChange)="actualizarFechaInicio($event)"
                    name="fechaInicioContable"
                    [disabled]="!canUpdate()"
                  />
                  <mat-datepicker-toggle matIconSuffix [for]="pickerInicio"></mat-datepicker-toggle>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.fechaInicio" aria-label="Ayuda fecha inicio contable">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                  <mat-datepicker #pickerInicio></mat-datepicker>
                </mat-form-field>
              </div>

              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>Codigo CIIU</mat-label>
                  <input matInput [(ngModel)]="empresaForm.actividadEconomicaCodigo" name="actividadEconomicaCodigo" [readonly]="!canUpdate()" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.ciiu" aria-label="Ayuda CIIU">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>Actividad economica principal</mat-label>
                  <input matInput [(ngModel)]="empresaForm.actividadEconomicaDescripcion" name="actividadEconomicaDescripcion" [readonly]="!canUpdate()" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.actividad" aria-label="Ayuda actividad economica">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="grid-3">
                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>Correo notificaciones SRI</mat-label>
                  <input matInput type="email" [(ngModel)]="empresaForm.correoNotificacionesSri" name="correoNotificacionesSri" [readonly]="!canUpdate()" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.correoSri" aria-label="Ayuda correo SRI">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <div class="check-help">
                  <mat-checkbox [(ngModel)]="empresaForm.obligadoContabilidad" name="obligadoContabilidad" [disabled]="!canUpdate()">
                    Obligado a llevar contabilidad
                  </mat-checkbox>
                  <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.obligado" aria-label="Ayuda obligado contabilidad">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </div>
              </div>

              <footer class="actions-row">
                <button mat-raised-button color="primary" type="submit" [disabled]="guardandoEmpresa() || !canUpdate()">
                  <mat-icon>save</mat-icon>
                  Guardar configuracion
                </button>
              </footer>
            </form>
          </mat-tab>

          <mat-tab label="Periodos">
            <section class="periodos-panel">
              <div class="periodos-toolbar">
                <mat-form-field appearance="outline">
                  <mat-label>Anio</mat-label>
                  <input matInput type="number" min="2000" max="2100" [ngModel]="anio()" (ngModelChange)="cambiarAnio($event)" />
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.anio" aria-label="Ayuda anio fiscal">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>

                <button mat-raised-button color="primary" type="button" (click)="generarPeriodos()" [disabled]="generandoPeriodos() || !canUpdate()" matTooltipPosition="above" [matTooltip]="ayudaConfig.generarPeriodos">
                  <mat-icon>calendar_month</mat-icon>
                  Generar periodos
                </button>
              </div>

              <div class="table-wrap">
                <table mat-table [dataSource]="periodos()">
                  <ng-container matColumnDef="nombre">
                    <th mat-header-cell *matHeaderCellDef>Periodo</th>
                    <td mat-cell *matCellDef="let row">
                      <strong>{{ row.nombre }}</strong>
                      <span class="muted">{{ row.id }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="fechaInicio">
                    <th mat-header-cell *matHeaderCellDef>Inicio</th>
                    <td mat-cell *matCellDef="let row">{{ row.fechaInicio }}</td>
                  </ng-container>

                  <ng-container matColumnDef="fechaFin">
                    <th mat-header-cell *matHeaderCellDef>Fin</th>
                    <td mat-cell *matCellDef="let row">{{ row.fechaFin }}</td>
                  </ng-container>

                  <ng-container matColumnDef="estado">
                    <th mat-header-cell *matHeaderCellDef>Estado</th>
                    <td mat-cell *matCellDef="let row">
                      <mat-chip [class.closed]="row.estado === 'CERRADO'">{{ row.estado }}</mat-chip>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="cierre">
                    <th mat-header-cell *matHeaderCellDef>Cierre</th>
                    <td mat-cell *matCellDef="let row">
                      @if (row.cerradoEn) {
                        {{ row.cerradoEn | date:'short' }}
                      } @else {
                        <span class="muted">Sin cierre</span>
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="acciones">
                    <th mat-header-cell *matHeaderCellDef>Acciones</th>
                    <td mat-cell *matCellDef="let row">
                      @if (row.estado === 'ABIERTO') {
                        <button mat-button type="button" (click)="cerrarPeriodo(row)" [disabled]="!canUpdate()">Cerrar</button>
                      } @else {
                        <button mat-button type="button" (click)="reabrirPeriodo(row)" [disabled]="!canUpdate()">Reabrir</button>
                      }
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columnasPeriodos"></tr>
                  <tr mat-row *matRowDef="let row; columns: columnasPeriodos"></tr>
                </table>
              </div>

              @if (!cargandoPeriodos() && periodos().length === 0) {
                <div class="empty-state">
                  <mat-icon>event_busy</mat-icon>
                  <h3>Sin periodos para {{ anio() }}</h3>
                  <p>Genera los 12 periodos mensuales para habilitar los asientos.</p>
                </div>
              }
            </section>
          </mat-tab>

          <mat-tab label="Integraciones">
            <section class="integraciones-panel">
              <div class="integration-header">
                <div>
                  <h3>Automatizacion contable</h3>
                  <p>Ventas POS, recetas, inventario y compras pueden generar asientos sin bloquear la operacion principal.</p>
                </div>
                <mat-slide-toggle
                  [(ngModel)]="integracionForm.habilitarAsientosAutomaticos"
                  name="habilitarAsientosAutomaticos"
                  [disabled]="!canUpdate()"
                >
                  Generar asientos automaticos
                </mat-slide-toggle>
              </div>

              <div class="grid-3">
                <mat-form-field appearance="outline">
                  <mat-label>Crear asientos como</mat-label>
                  <mat-select [(ngModel)]="integracionForm.modoAsientoAutomatico" name="modoAsientoAutomatico" [disabled]="!canUpdate()">
                    <mat-option value="BORRADOR">Borrador</mat-option>
                    <mat-option value="APROBADO">Aprobado</mat-option>
                  </mat-select>
                  <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayudaConfig.modoAutomatico" aria-label="Ayuda modo asiento automatico">
                    <mat-icon>help_outline</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <h3>Cuentas contables por módulo</h3>
              <p class="muted">Organiza las cuentas por módulo. Las cuentas específicas (por proveedor o categoría) tienen prioridad sobre las generales.</p>

              <mat-accordion multi class="cuentas-accordion">
                <!-- General: IVA, retenciones, caja/banco -->
                <mat-expansion-panel expanded>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>tune</mat-icon> General</mat-panel-title>
                    <mat-panel-description>IVA, retenciones y caja/banco</mat-panel-description>
                  </mat-expansion-panel-header>
                  <div class="account-grid">
                    @for (campo of camposGeneral; track campo.key) {
                      <div class="account-field">
                        <div class="field-label">
                          <span>{{ campo.label }}</span>
                          <button mat-icon-button type="button" [matTooltip]="campo.tooltip" matTooltipPosition="above" [attr.aria-label]="'Ayuda ' + campo.label">
                            <mat-icon>help_outline</mat-icon>
                          </button>
                        </div>
                        <app-cuenta-contable-autocomplete
                          [cuentas]="cuentasMovimiento()"
                          [cuentaId]="integracionForm[campo.key]"
                          [soloActivas]="true"
                          [soloMovimiento]="true"
                          [label]="campo.label"
                          [mostrarNumero]="false"
                          [compact]="true"
                          [disabled]="!canUpdate()"
                          (cuentaSeleccionada)="seleccionarCuentaIntegracion(campo.key, $event)"
                        />
                      </div>
                    }
                  </div>
                </mat-expansion-panel>

                <!-- Inventario: general + por proveedor -->
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>inventory_2</mat-icon> Inventario</mat-panel-title>
                    <mat-panel-description>General y por proveedor</mat-panel-description>
                  </mat-expansion-panel-header>

                  <h4>General</h4>
                  <div class="account-grid">
                    @for (campo of camposInventario; track campo.key) {
                      <div class="account-field">
                        <div class="field-label">
                          <span>{{ campo.label }}</span>
                          <button mat-icon-button type="button" [matTooltip]="campo.tooltip" matTooltipPosition="above" [attr.aria-label]="'Ayuda ' + campo.label">
                            <mat-icon>help_outline</mat-icon>
                          </button>
                        </div>
                        <app-cuenta-contable-autocomplete
                          [cuentas]="cuentasMovimiento()"
                          [cuentaId]="integracionForm[campo.key]"
                          [soloActivas]="true"
                          [soloMovimiento]="true"
                          [label]="campo.label"
                          [mostrarNumero]="false"
                          [compact]="true"
                          [disabled]="!canUpdate()"
                          (cuentaSeleccionada)="seleccionarCuentaIntegracion(campo.key, $event)"
                        />
                      </div>
                    }
                  </div>

                  <h4>Por proveedor</h4>
                  <p class="muted">Sobrescribe la cuenta de inventario/por pagar para proveedores específicos. Si se deja vacío, se usa la cuenta general.</p>
                  @if (proveedoresActivos().length === 0) {
                    <div class="empty-state compact"><mat-icon>store</mat-icon><p>No hay proveedores registrados.</p></div>
                  } @else {
                    <div class="table-wrap">
                      <table mat-table [dataSource]="proveedoresActivos()">
                        <ng-container matColumnDef="proveedor">
                          <th mat-header-cell *matHeaderCellDef>Proveedor</th>
                          <td mat-cell *matCellDef="let row"><strong>{{ row.nombre }}</strong><span class="muted"> {{ row.ruc }}</span></td>
                        </ng-container>
                        <ng-container matColumnDef="inventario">
                          <th mat-header-cell *matHeaderCellDef>Inventario</th>
                          <td mat-cell *matCellDef="let row">
                            <app-cuenta-contable-autocomplete
                              class="table-account"
                              [cuentas]="cuentasMovimiento()"
                              [cuentaId]="mapeoProveedor(row.id).cuentaInventarioId ?? ''"
                              label="General"
                              [mostrarNumero]="false"
                              [compact]="true"
                              [disabled]="!canUpdate()"
                              (cuentaSeleccionada)="actualizarMapeoProveedor(row.id, 'cuentaInventarioId', $event?.id ?? '')"
                            />
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="cuentasPorPagar">
                          <th mat-header-cell *matHeaderCellDef>Cuentas por pagar</th>
                          <td mat-cell *matCellDef="let row">
                            <app-cuenta-contable-autocomplete
                              class="table-account"
                              [cuentas]="cuentasMovimiento()"
                              [cuentaId]="mapeoProveedor(row.id).cuentaCuentasPorPagarId ?? ''"
                              label="General"
                              [mostrarNumero]="false"
                              [compact]="true"
                              [disabled]="!canUpdate()"
                              (cuentaSeleccionada)="actualizarMapeoProveedor(row.id, 'cuentaCuentasPorPagarId', $event?.id ?? '')"
                            />
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="acciones">
                          <th mat-header-cell *matHeaderCellDef></th>
                          <td mat-cell *matCellDef="let row">
                            <button mat-button type="button" (click)="guardarMapeoProveedor(row)" [disabled]="!canUpdate()">Guardar</button>
                          </td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="columnasMapeoProveedor"></tr>
                        <tr mat-row *matRowDef="let row; columns: columnasMapeoProveedor"></tr>
                      </table>
                    </div>
                  }
                </mat-expansion-panel>

                <!-- Ventas: general + por categoría -->
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>point_of_sale</mat-icon> Ventas</mat-panel-title>
                    <mat-panel-description>General y por categoría de producto</mat-panel-description>
                  </mat-expansion-panel-header>

                  <h4>General</h4>
                  <div class="account-grid">
                    @for (campo of camposVentas; track campo.key) {
                      <div class="account-field">
                        <div class="field-label">
                          <span>{{ campo.label }}</span>
                          <button mat-icon-button type="button" [matTooltip]="campo.tooltip" matTooltipPosition="above" [attr.aria-label]="'Ayuda ' + campo.label">
                            <mat-icon>help_outline</mat-icon>
                          </button>
                        </div>
                        <app-cuenta-contable-autocomplete
                          [cuentas]="cuentasMovimiento()"
                          [cuentaId]="integracionForm[campo.key]"
                          [soloActivas]="true"
                          [soloMovimiento]="true"
                          [label]="campo.label"
                          [mostrarNumero]="false"
                          [compact]="true"
                          [disabled]="!canUpdate()"
                          (cuentaSeleccionada)="seleccionarCuentaIntegracion(campo.key, $event)"
                        />
                      </div>
                    }
                  </div>

                  <h4>Por categoría de producto</h4>
                  <p class="muted">La categoría del producto tiene prioridad sobre las cuentas generales.</p>
                  <div class="table-wrap">
                    <table mat-table [dataSource]="categoriasActivas()">
                      <ng-container matColumnDef="categoria">
                        <th mat-header-cell *matHeaderCellDef>Categoria</th>
                        <td mat-cell *matCellDef="let row"><strong>{{ row.nombre }}</strong></td>
                      </ng-container>

                      <ng-container matColumnDef="ingresoProductos">
                        <th mat-header-cell *matHeaderCellDef>Ingreso productos</th>
                        <td mat-cell *matCellDef="let row">
                          <app-cuenta-contable-autocomplete
                            class="table-account"
                            [cuentas]="cuentasMovimiento()"
                            [cuentaId]="mapeoCategoria(row.id).cuentaIngresoProductosId ?? ''"
                            label="Global"
                            [mostrarNumero]="false"
                            [compact]="true"
                            [disabled]="!canUpdate()"
                            (cuentaSeleccionada)="actualizarMapeoCategoria(row.id, 'cuentaIngresoProductosId', $event?.id ?? '')"
                          />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="ingresoServicios">
                        <th mat-header-cell *matHeaderCellDef>Ingreso servicios</th>
                        <td mat-cell *matCellDef="let row">
                          <app-cuenta-contable-autocomplete
                            class="table-account"
                            [cuentas]="cuentasMovimiento()"
                            [cuentaId]="mapeoCategoria(row.id).cuentaIngresoServiciosId ?? ''"
                            label="Global"
                            [mostrarNumero]="false"
                            [compact]="true"
                            [disabled]="!canUpdate()"
                            (cuentaSeleccionada)="actualizarMapeoCategoria(row.id, 'cuentaIngresoServiciosId', $event?.id ?? '')"
                          />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="inventario">
                        <th mat-header-cell *matHeaderCellDef>Inventario</th>
                        <td mat-cell *matCellDef="let row">
                          <app-cuenta-contable-autocomplete
                            class="table-account"
                            [cuentas]="cuentasMovimiento()"
                            [cuentaId]="mapeoCategoria(row.id).cuentaInventarioId ?? ''"
                            label="Global"
                            [mostrarNumero]="false"
                            [compact]="true"
                            [disabled]="!canUpdate()"
                            (cuentaSeleccionada)="actualizarMapeoCategoria(row.id, 'cuentaInventarioId', $event?.id ?? '')"
                          />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="costoVenta">
                        <th mat-header-cell *matHeaderCellDef>Costo venta</th>
                        <td mat-cell *matCellDef="let row">
                          <app-cuenta-contable-autocomplete
                            class="table-account"
                            [cuentas]="cuentasMovimiento()"
                            [cuentaId]="mapeoCategoria(row.id).cuentaCostoVentaId ?? ''"
                            label="Global"
                            [mostrarNumero]="false"
                            [compact]="true"
                            [disabled]="!canUpdate()"
                            (cuentaSeleccionada)="actualizarMapeoCategoria(row.id, 'cuentaCostoVentaId', $event?.id ?? '')"
                          />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="compraGasto">
                        <th mat-header-cell *matHeaderCellDef>Compra/gasto</th>
                        <td mat-cell *matCellDef="let row">
                          <app-cuenta-contable-autocomplete
                            class="table-account"
                            [cuentas]="cuentasMovimiento()"
                            [cuentaId]="mapeoCategoria(row.id).cuentaCompraGastoId ?? ''"
                            label="Global"
                            [mostrarNumero]="false"
                            [compact]="true"
                            [disabled]="!canUpdate()"
                            (cuentaSeleccionada)="actualizarMapeoCategoria(row.id, 'cuentaCompraGastoId', $event?.id ?? '')"
                          />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="acciones">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                          <button mat-button type="button" (click)="guardarMapeoCategoria(row)" [disabled]="!canUpdate()">Guardar</button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="columnasMapeos"></tr>
                      <tr mat-row *matRowDef="let row; columns: columnasMapeos"></tr>
                    </table>
                  </div>
                </mat-expansion-panel>

                <!-- Nómina (migrado): edición desde aquí, datos en su propia ruta -->
                <mat-expansion-panel [expanded]="panelNominaAbierto()">
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>badge</mat-icon> Nómina</mat-panel-title>
                    <mat-panel-description>Cuentas contables de roles de pago</mat-panel-description>
                  </mat-expansion-panel-header>
                  <app-nomina-configuracion-contable></app-nomina-configuracion-contable>
                </mat-expansion-panel>

                <!-- Tipos de gasto / Cuentas por cobrar (migrado) -->
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>receipt_long</mat-icon> Tipos de gasto / Cuentas por cobrar</mat-panel-title>
                    <mat-panel-description>Plantillas de cuentas de gasto para compras</mat-panel-description>
                  </mat-expansion-panel-header>
                  <app-tipos-gasto-compra></app-tipos-gasto-compra>
                </mat-expansion-panel>

                <!-- Cuentas por Pagar: cuentas del modulo y fuentes activas -->
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>request_quote</mat-icon> Cuentas por Pagar</mat-panel-title>
                    <mat-panel-description>Cuentas del modulo y fuentes de obligaciones</mat-panel-description>
                  </mat-expansion-panel-header>
                  <app-cxp-configuracion></app-cxp-configuracion>
                </mat-expansion-panel>
              </mat-accordion>

              <footer class="actions-row">
                <button mat-raised-button color="primary" type="button" (click)="guardarIntegracion()" [disabled]="guardandoIntegracion() || !canUpdate()">
                  <mat-icon>save</mat-icon>
                  Guardar cuentas generales
                </button>
              </footer>

              <section class="mapping-section">
                <h3>Pendientes de contabilizacion</h3>
                <div class="table-wrap">
                  <table mat-table [dataSource]="pendientes()">
                    <ng-container matColumnDef="origen">
                      <th mat-header-cell *matHeaderCellDef>Origen</th>
                      <td mat-cell *matCellDef="let row">
                        <strong>{{ row.origenTipo }}</strong>
                        <span class="muted">{{ row.origenNumero || row.origenId }}</span>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="motivo">
                      <th mat-header-cell *matHeaderCellDef>Motivo</th>
                      <td mat-cell *matCellDef="let row">{{ row.motivo }}</td>
                    </ng-container>

                    <ng-container matColumnDef="fecha">
                      <th mat-header-cell *matHeaderCellDef>Fecha</th>
                      <td mat-cell *matCellDef="let row">{{ row.creadoEn | date:'short' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="acciones">
                      <th mat-header-cell *matHeaderCellDef>Acciones</th>
                      <td mat-cell *matCellDef="let row">
                        <button mat-button type="button" (click)="reintentarPendiente(row)" [disabled]="!canUpdate()">Reintentar</button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="columnasPendientes"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnasPendientes"></tr>
                  </table>
                </div>

                @if (pendientes().length === 0) {
                  <div class="empty-state compact">
                    <mat-icon>task_alt</mat-icon>
                    <p>No hay pendientes contables.</p>
                  </div>
                }
              </section>
            </section>
          </mat-tab>
        </mat-tab-group>
      </section>
    </section>
  `,
  styles: [`
    .config-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header h2 { display: inline-flex; align-items: center; gap: .35rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .tabs-card { padding: 0; overflow: hidden; background: var(--tc-surface-container-lowest); }
    .empresa-form, .periodos-panel, .integraciones-panel { padding: 1.25rem; display: grid; gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; align-items: center; }
    .span-2 { grid-column: span 2; }
    .integration-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .85rem; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .5rem; background: var(--tc-surface-container-low); }
    .integration-header h3, .integration-header p, .mapping-section h3, .mapping-section p { margin: 0; }
    .mapping-section { display: grid; gap: .75rem; }
    .account-groups { display: grid; gap: .85rem; }
    .cuentas-accordion { display: block; margin: .5rem 0 1rem; }
    .cuentas-accordion h4 { margin: 1rem 0 .5rem; font-size: .95rem; }
    .cuentas-accordion mat-panel-title { display: flex; align-items: center; gap: .5rem; }
    .cuentas-accordion mat-panel-title mat-icon { color: var(--primary); }
    .account-group { display: grid; gap: .75rem; padding: .85rem; border: 1px solid color-mix(in srgb, var(--outline) 40%, transparent); border-radius: .5rem; background: var(--tc-surface-container-low); }
    .account-group header h4, .account-group header p { margin: 0; }
    .account-group header p { color: var(--muted-foreground); font-size: .9rem; }
    .account-grid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: .75rem; align-items: start; }
    .account-field { display: grid; gap: .25rem; min-width: 0; }
    .field-label { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 32px; font-weight: 700; color: var(--foreground); }
    .field-label button { width: 32px; height: 32px; flex: 0 0 auto; }
    .field-label mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .check-help { display: inline-flex; align-items: center; gap: .5rem; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    .table-account { display: block; width: 260px; margin: .35rem 0 -.95rem; }
    .actions-row, .periodos-toolbar { display: flex; justify-content: flex-end; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .periodos-toolbar { justify-content: space-between; }
    .warning-box, .error-box { display: flex; align-items: center; gap: .6rem; padding: .8rem 1rem; border-radius: .5rem; }
    .warning-box { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #7a4b00; }
    .error-box { background: color-mix(in srgb, #b3261e 12%, transparent); color: #b3261e; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 820px; }
    td strong, td .muted { display: block; }
    .muted { color: var(--muted-foreground); font-size: .86rem; }
    .closed { opacity: .7; }
    .empty-state { min-height: 220px; display: grid; place-items: center; align-content: center; gap: .5rem; text-align: center; color: var(--muted-foreground); }
    .empty-state.compact { min-height: 90px; }
    .empty-state h3, .empty-state p { margin: 0; }
    .empty-state mat-icon { font-size: 2rem; width: 2rem; height: 2rem; color: var(--primary); }
    @media (max-width: 900px) {
      .grid-3 { grid-template-columns: 1fr; }
      .account-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: auto; }
      .actions-row, .periodos-toolbar { justify-content: flex-start; }
    }
  `]
})
export class ConfiguracionContableComponent implements OnInit, OnDestroy {
  private readonly service = inject(ConfiguracionContableService);
  private readonly integracionService = inject(IntegracionContableService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly authorization = inject(AuthorizationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  protected readonly columnasPeriodos = ['nombre', 'fechaInicio', 'fechaFin', 'estado', 'cierre', 'acciones'];
  protected readonly columnasMapeos = ['categoria', 'ingresoProductos', 'ingresoServicios', 'inventario', 'costoVenta', 'compraGasto', 'acciones'];
  protected readonly columnasMapeoProveedor = ['proveedor', 'inventario', 'cuentasPorPagar', 'acciones'];
  protected readonly columnasPendientes = ['origen', 'motivo', 'fecha', 'acciones'];
  protected readonly anio = signal(new Date().getFullYear());
  protected readonly periodos = signal<PeriodoContable[]>([]);
  protected readonly cuentasMovimiento = signal<CuentaContable[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly mapeosCategorias = signal<MapeoCategoriaContable[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly mapeosProveedores = signal<MapeoProveedorContable[]>([]);
  protected readonly pendientes = signal<PendienteContabilizacion[]>([]);
  protected readonly categoriasActivas = computed(() => this.categorias().filter((categoria) => categoria.activo !== false && !!categoria.id));
  protected readonly proveedoresActivos = computed(() => this.proveedores().filter((proveedor) => proveedor.activo !== false && !!proveedor.id));
  protected readonly cargandoPeriodos = signal(true);
  protected readonly guardandoEmpresa = signal(false);
  protected readonly guardandoIntegracion = signal(false);
  protected readonly generandoPeriodos = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly empresaConfigurada = signal(false);
  protected readonly fechaInicioDate = signal<Date | null>(new Date(new Date().getFullYear(), 0, 1));
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));

  /**
   * Deep-link desde otros submodulos: ?tab=empresa|periodos|integraciones y ?panel=nomina abren
   * directamente la seccion pedida, para que un submodulo pueda enviar al contador a la casilla
   * exacta que le falta configurar en lugar de dejarlo buscando dentro del acordeon.
   */
  private readonly tabsPorClave: Record<string, number> = { empresa: 0, periodos: 1, integraciones: 2 };
  protected readonly tabInicial = signal(0);
  protected readonly panelNominaAbierto = signal(false);
  private periodosSubscription?: Subscription;
  protected readonly ayudaConfig = {
    submodulo: 'Configura la identidad fiscal de la empresa, periodos contables e integraciones que generan asientos automaticos.',
    ruc: 'Identificacion tributaria ecuatoriana de 13 digitos. Se usa en reportes, PDF y datos fiscales.',
    razonSocial: 'Nombre legal registrado ante el SRI. Debe aparecer en estados financieros y documentos contables.',
    nombreComercial: 'Nombre de uso comercial. Sirve como referencia operativa cuando difiere de la razon social.',
    tipoContribuyente: 'Regimen tributario de la empresa: RIMPE, normal o especial. Ayuda a orientar obligaciones fiscales.',
    moneda: 'Moneda funcional de la contabilidad. Para Ecuador se usa USD como base de medicion y reportes.',
    fechaInicio: 'Fecha desde la que se llevara contabilidad en el sistema. Sirve como referencia para saldos iniciales y periodos.',
    ciiu: 'Codigo de actividad economica. Permite clasificar la operacion principal de la empresa.',
    actividad: 'Descripcion de la actividad economica principal que respalda la clasificacion CIIU.',
    correoSri: 'Correo usado para avisos o referencias de notificaciones tributarias del SRI.',
    obligado: 'Marque si la empresa esta obligada a llevar contabilidad formal segun su situacion tributaria.',
    anio: 'Anio fiscal para generar periodos mensuales. En Ecuador normalmente va de enero a diciembre.',
    generarPeriodos: 'Crea los 12 periodos del anio. Los periodos cerrados bloquean nuevos asientos en sus fechas.',
    modoAutomatico: 'Borrador permite revision contable antes de impactar reportes; aprobado registra directamente en saldos y mayores.'
  };

  protected readonly empresaForm: ConfiguracionEmpresaContable = {
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    obligadoContabilidad: true,
    tipoContribuyente: 'NORMAL',
    actividadEconomicaCodigo: '',
    actividadEconomicaDescripcion: '',
    fechaInicioContable: `${new Date().getFullYear()}-01-01`,
    monedaFuncional: 'USD',
    correoNotificacionesSri: '',
    configurado: false
  };

  protected readonly integracionForm: ConfiguracionIntegracionContable = this.getDefaultIntegracion();

  // Cuentas generales y transversales (IVA, retenciones, caja/banco, gasto genérico).
  protected readonly camposGeneral: CuentaIntegracionCampo[] = [
    {
      key: 'cuentaIvaVentasId',
      label: 'IVA ventas',
      tooltip: 'Cuenta de pasivo tributario que registra el IVA cobrado al cliente en ventas.'
    },
    {
      key: 'cuentaIvaComprasId',
      label: 'IVA compras',
      tooltip: 'Cuenta de activo/credito tributario que registra el IVA pagado en compras cuando aplica.'
    },
    {
      key: 'cuentaRetencionFuenteXPagarId',
      label: 'Retención fuente por pagar',
      tooltip: 'Cuenta de pasivo que se acredita por la retención en la fuente de renta practicada al proveedor.'
    },
    {
      key: 'cuentaRetencionIvaXPagarId',
      label: 'Retención IVA por pagar',
      tooltip: 'Cuenta de pasivo que se acredita por la retención de IVA practicada al proveedor.'
    },
    {
      key: 'cuentaCajaBancoId',
      label: 'Caja/banco',
      tooltip: 'Cuenta de activo que recibe el debito por pagos al contado, efectivo, tarjeta, transferencia o banco.'
    },
    {
      key: 'cuentaGastoComprasId',
      label: 'Gasto / compras (genérico)',
      tooltip: 'Cuenta de gasto que se debita en facturas de compra cuando la factura NO alimenta inventario y no hay tipo de gasto.'
    }
  ];

  // Cuentas del módulo de Inventario/Compras (nivel general).
  protected readonly camposInventario: CuentaIntegracionCampo[] = [
    {
      key: 'cuentaInventarioId',
      label: 'Inventario',
      tooltip: 'Cuenta de activo que se debita al ingresar mercaderia y se acredita cuando el producto se vende o consume.'
    },
    {
      key: 'cuentaCostoVentasId',
      label: 'Costo de ventas',
      tooltip: 'Cuenta de costo que se debita por el costo de productos vendidos o recetas consumidas.'
    },
    {
      key: 'cuentaCuentasPorPagarId',
      label: 'Cuentas por pagar',
      tooltip: 'Cuenta de pasivo que se acredita por facturas de proveedor pendientes de pago.'
    }
  ];

  // Cuentas del módulo de Ventas (nivel general).
  protected readonly camposVentas: CuentaIntegracionCampo[] = [
    {
      key: 'cuentaVentasProductosId',
      label: 'Ventas productos',
      tooltip: 'Cuenta de ingresos para ventas de bienes o productos inventariables.'
    },
    {
      key: 'cuentaVentasServiciosId',
      label: 'Ventas servicios',
      tooltip: 'Cuenta de ingresos para ventas de servicios; no genera salida de inventario ni costo automatico.'
    },
    {
      key: 'cuentaDescuentosVentasId',
      label: 'Descuentos ventas',
      tooltip: 'Cuenta de resultado que registra descuentos concedidos al cliente, normalmente como menor ingreso o gasto comercial.'
    },
    {
      key: 'cuentaCuentasPorCobrarId',
      label: 'Cuentas por cobrar',
      tooltip: 'Cuenta de activo usada cuando la venta queda a credito y el cliente todavia no paga.'
    }
  ];

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tab = (params.get('tab') ?? '').toLowerCase();
        if (this.tabsPorClave[tab] !== undefined) {
          this.tabInicial.set(this.tabsPorClave[tab]);
        }
        this.panelNominaAbierto.set((params.get('panel') ?? '').toLowerCase() === 'nomina');
      });

    this.service
      .getEmpresa()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (empresa) => {
          if (empresa) {
            Object.assign(this.empresaForm, empresa);
            this.fechaInicioDate.set(this.parseFecha(empresa.fechaInicioContable));
          }
          this.empresaConfigurada.set(!!empresa?.configurado);
        },
        error: () => this.error.set('No se pudo cargar la configuracion contable.')
      });

    this.cargarPeriodos();
    this.cargarIntegraciones();
  }

  ngOnDestroy(): void {
    this.periodosSubscription?.unsubscribe();
  }

  protected async guardarEmpresa(): Promise<void> {
    this.error.set(null);
    this.guardandoEmpresa.set(true);

    try {
      await this.service.guardarEmpresa({
        ...this.empresaForm,
        tipoContribuyente: this.empresaForm.tipoContribuyente as TipoContribuyente
      });
      this.mostrarMensaje('Configuracion contable guardada.', 'save');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    } finally {
      this.guardandoEmpresa.set(false);
    }
  }

  protected actualizarRucEmpresa(value: string): void {
    this.empresaForm.ruc = value.replace(/\D/g, '').slice(0, 13);
  }

  protected cambiarAnio(value: string | number): void {
    const year = Number(value);
    if (!year || year < 2000 || year > 2100) {
      return;
    }

    this.anio.set(year);
    this.cargarPeriodos();
  }

  protected async generarPeriodos(): Promise<void> {
    this.error.set(null);
    this.generandoPeriodos.set(true);

    try {
      const resultado = await this.service.generarPeriodos(this.anio());
      this.mostrarMensaje(`Periodos generados: ${resultado.creados} nuevos, ${resultado.existentes} existentes.`, 'calendar_month');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron generar los periodos.');
    } finally {
      this.generandoPeriodos.set(false);
    }
  }

  protected async cerrarPeriodo(periodo: PeriodoContable): Promise<void> {
    this.error.set(null);

    try {
      await this.service.cerrarPeriodo(periodo);
      this.mostrarMensaje(`Periodo ${periodo.id} cerrado.`, 'lock');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cerrar el periodo.');
    }
  }

  protected async reabrirPeriodo(periodo: PeriodoContable): Promise<void> {
    const motivo = window.prompt(`Motivo para reabrir ${periodo.id}`);
    if (motivo === null) {
      return;
    }

    this.error.set(null);
    try {
      await this.service.reabrirPeriodo(periodo, motivo);
      this.mostrarMensaje(`Periodo ${periodo.id} reabierto.`, 'lock_open');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo reabrir el periodo.');
    }
  }

  protected actualizarFechaInicio(value: Date | string | null): void {
    if (!value) {
      return;
    }

    this.empresaForm.fechaInicioContable = value instanceof Date ? this.formatFecha(value) : value;
    this.fechaInicioDate.set(value instanceof Date ? value : this.parseFecha(value));
  }

  protected async guardarIntegracion(): Promise<void> {
    this.error.set(null);
    this.guardandoIntegracion.set(true);

    try {
      await this.integracionService.guardarConfiguracion({ ...this.integracionForm });
      this.mostrarMensaje('Integracion contable guardada.', 'sync_alt');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la integracion contable.');
    } finally {
      this.guardandoIntegracion.set(false);
    }
  }

  protected seleccionarCuentaIntegracion(campo: CuentaIntegracionKey, cuenta: CuentaContable | null): void {
    this.integracionForm[campo] = cuenta?.id ?? '';
  }

  protected mapeoCategoria(categoriaId: string | undefined): MapeoCategoriaContable {
    const id = categoriaId ?? '';
    return this.mapeosCategorias().find((mapeo) => mapeo.categoriaId === id) ?? this.getDefaultMapeoCategoria(id);
  }

  protected actualizarMapeoCategoria(
    categoriaId: string | undefined,
    campo: keyof Omit<MapeoCategoriaContable, 'categoriaId' | 'actualizadoEn'>,
    cuentaId: string
  ): void {
    const id = categoriaId ?? '';
    if (!id) {
      return;
    }

    const actual = this.mapeoCategoria(id);
    const actualizado = {
      ...actual,
      [campo]: cuentaId ?? ''
    };
    const otros = this.mapeosCategorias().filter((mapeo) => mapeo.categoriaId !== id);
    this.mapeosCategorias.set([...otros, actualizado]);
  }

  protected async guardarMapeoCategoria(categoria: Categoria): Promise<void> {
    if (!categoria.id) {
      return;
    }

    try {
      await this.integracionService.guardarMapeoCategoria(this.mapeoCategoria(categoria.id));
      this.mostrarMensaje(`Mapeo de ${categoria.nombre} guardado.`, 'category');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el mapeo de categoria.');
    }
  }

  protected mapeoProveedor(proveedorId: string | undefined): MapeoProveedorContable {
    const id = proveedorId ?? '';
    return this.mapeosProveedores().find((mapeo) => mapeo.proveedorId === id) ?? { proveedorId: id };
  }

  protected actualizarMapeoProveedor(
    proveedorId: string | undefined,
    campo: 'cuentaInventarioId' | 'cuentaCuentasPorPagarId',
    cuentaId: string
  ): void {
    const id = proveedorId ?? '';
    if (!id) {
      return;
    }
    const actual = this.mapeoProveedor(id);
    const actualizado = { ...actual, [campo]: cuentaId ?? '' };
    const otros = this.mapeosProveedores().filter((mapeo) => mapeo.proveedorId !== id);
    this.mapeosProveedores.set([...otros, actualizado]);
  }

  protected async guardarMapeoProveedor(proveedor: Proveedor): Promise<void> {
    if (!proveedor.id) {
      return;
    }
    try {
      await this.integracionService.guardarMapeoProveedor(this.mapeoProveedor(proveedor.id));
      this.mostrarMensaje(`Cuentas de ${proveedor.nombre} guardadas.`, 'store');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el mapeo del proveedor.');
    }
  }

  protected async reintentarPendiente(pendiente: PendienteContabilizacion): Promise<void> {
    try {
      await this.integracionService.reintentarPendiente(pendiente);
      this.mostrarMensaje('Pendiente marcado para revision.', 'refresh');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar el pendiente.');
    }
  }

  private cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.periodosSubscription?.unsubscribe();
    this.periodosSubscription = this.service
      .getPeriodos(this.anio())
      .subscribe({
        next: (periodos) => {
          this.periodos.set(periodos);
          this.cargandoPeriodos.set(false);
        },
        error: () => {
          this.cargandoPeriodos.set(false);
          this.error.set('No se pudieron cargar los periodos.');
        }
      });
  }

  private cargarIntegraciones(): void {
    this.integracionService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => Object.assign(this.integracionForm, this.getDefaultIntegracion(), config));

    this.planCuentasService
      .getCuentas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => {
        this.cuentasMovimiento.set(cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento));
      });

    this.categoriasService
      .getCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categorias) => this.categorias.set(categorias));

    this.integracionService
      .getMapeosCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mapeos) => this.mapeosCategorias.set(mapeos));

    this.proveedoresService
      .getProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((proveedores) => this.proveedores.set(proveedores));

    this.integracionService
      .getMapeosProveedores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mapeos) => this.mapeosProveedores.set(mapeos));

    this.integracionService
      .getPendientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pendientes) => this.pendientes.set(pendientes));
  }

  private getDefaultIntegracion(): ConfiguracionIntegracionContable {
    return {
      habilitarAsientosAutomaticos: false,
      modoAsientoAutomatico: 'BORRADOR',
      cuentaCajaBancoId: '',
      cuentaCuentasPorCobrarId: '',
      cuentaCuentasPorPagarId: '',
      cuentaVentasProductosId: '',
      cuentaVentasServiciosId: '',
      cuentaIvaVentasId: '',
      cuentaIvaComprasId: '',
      cuentaInventarioId: '',
      cuentaCostoVentasId: '',
      cuentaDescuentosVentasId: '',
      cuentaGastoComprasId: '',
      cuentaRetencionFuenteXPagarId: '',
      cuentaRetencionIvaXPagarId: ''
    };
  }

  private getDefaultMapeoCategoria(categoriaId: string): MapeoCategoriaContable {
    return {
      categoriaId,
      cuentaIngresoProductosId: '',
      cuentaIngresoServiciosId: '',
      cuentaInventarioId: '',
      cuentaCostoVentaId: '',
      cuentaCompraGastoId: ''
    };
  }

  private parseFecha(value: string): Date | null {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private formatFecha(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2800,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

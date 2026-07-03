import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../../core/services/auth.service';
import { ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult } from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ArchivoUploaderComponent } from '../../../../shared/components/archivo-uploader/archivo-uploader.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { ArchivoItem } from '../../../../shared/models/archivos.models';
import { Almacen, Producto } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { ProductosService } from '../../../inventario/services/productos.service';
import {
  CODIGOS_SUSTENTO,
  DocumentoModificado,
  FORMAS_PAGO,
  FacturaCompra,
  FacturaCompraItem,
  FacturaCompraParsed,
  MONTO_MINIMO_FORMA_PAGO,
  OrigenDocumentoCompra,
  PORCENTAJES_RET_IVA,
  TIPOS_COMPROBANTE,
  TIPO_COMPROBANTE_NOTA_CREDITO,
  TipoIdProveedor
} from '../../models/compras.models';
import { ComprasXmlService } from '../../services/compras-xml.service';
import { FacturasCompraService } from '../../services/facturas-compra.service';
import { IntegracionContableService } from '../../services/integracion-contable.service';

@Component({
  selector: 'app-factura-compra-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    ArchivoUploaderComponent,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="fc-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad · Compras</p>
          <h2>{{ titulo() }}</h2>
        </div>
        <span class="pill" [class]="estadoClase()">{{ estadoLabel() }}</span>
      </header>

      <!-- PASO 1 · Carga / origen del documento -->
      <section class="surface-card step-card">
        <div class="step-head">
          <span class="step-badge">1</span>
          <div>
            <h3>Origen del documento</h3>
            <p>Sube el XML autorizado (factura o nota de crédito) o registra un documento manual con su soporte adjunto.</p>
          </div>
        </div>

        <mat-button-toggle-group [value]="modo()" (change)="cambiarModo($event.value)" aria-label="Modo de ingreso" [disabled]="soloLectura()">
          <mat-button-toggle value="XML"><mat-icon>description</mat-icon> Cargar XML</mat-button-toggle>
          <mat-button-toggle value="MANUAL"><mat-icon>edit_note</mat-icon> Registro manual</mat-button-toggle>
        </mat-button-toggle-group>

        @if (modo() === 'XML') {
          @if (!parseado()) {
            <div class="upload-options">
              <button mat-stroked-button type="button" (click)="seleccionarExistente()">
                <mat-icon>folder_open</mat-icon> Seleccionar un XML ya cargado
              </button>
              <span class="or-sep">o sube uno nuevo</span>
            </div>
            <app-archivo-uploader sourceModule="compras" (uploaded)="onXmlSubido($event)"></app-archivo-uploader>
            @if (parseando()) {
              <div class="parsing-hint"><mat-icon>hourglass_top</mat-icon> Analizando el XML…</div>
            }
            @if (parseError()) {
              <div class="parse-error"><mat-icon>error</mat-icon> {{ parseError() }} — cambia a "Registro manual" para llenar los campos.</div>
            }
          } @else {
            <div class="parsed-chip">
              <mat-icon>description</mat-icon>
              <div class="chip-copy">
                <strong>{{ form.value.razonSocialProv }}</strong>
                <span>{{ tipoComprobanteLabel() }} {{ documento() }} · {{ form.value.fechaEmision | date: 'dd/MM/yyyy' }} · {{ form.value.importeTotal | currency: 'USD':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <button mat-stroked-button type="button" (click)="reemplazarXml()" [disabled]="soloLectura()">
                <mat-icon>autorenew</mat-icon> Reemplazar XML
              </button>
            </div>
          }
        } @else {
          <!-- Modo manual: adjunto obligatorio del documento -->
          @if (!soporteAdjunto()) {
            <div class="upload-options">
              <button mat-stroked-button type="button" (click)="seleccionarExistente()">
                <mat-icon>folder_open</mat-icon> Seleccionar un documento ya cargado
              </button>
              <span class="or-sep">o sube el escaneado (PDF/imagen)</span>
            </div>
            <app-archivo-uploader sourceModule="compras" (uploaded)="onSoporteSubido($event)"></app-archivo-uploader>
            <p class="warn-inline"><mat-icon>info</mat-icon> El documento adjunto es obligatorio para el registro manual.</p>
          } @else {
            <div class="parsed-chip">
              <mat-icon>attachment</mat-icon>
              <div class="chip-copy">
                <strong>Documento adjunto</strong>
                <span>Soporte cargado. Completa los campos del comprobante abajo.</span>
              </div>
              <button mat-stroked-button type="button" (click)="quitarSoporte()" [disabled]="soloLectura()">
                <mat-icon>autorenew</mat-icon> Reemplazar
              </button>
            </div>
          }
        }
      </section>

      <form [formGroup]="form" (ngSubmit)="guardar()">
        <!-- PASO 2 · Revisión -->
        @if (mostrarDetalle()) {
          <section class="surface-card step-card">
            <div class="step-head">
              <span class="step-badge">2</span>
              <div>
                <h3>Proveedor y documento</h3>
                <p>Verifica los datos tributarios del comprobante.</p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full">
              <mat-label>Tipo de comprobante</mat-label>
              <mat-select formControlName="tipoComprobante">
                @for (tipo of tiposComprobante; track tipo.codigo) {
                  <mat-option [value]="tipo.codigo">{{ tipo.codigo }} · {{ tipo.descripcion }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="grid-3">
              <mat-form-field appearance="outline">
                <mat-label>Tipo identificación</mat-label>
                <mat-select formControlName="tpIdProv">
                  <mat-option value="01">RUC</mat-option>
                  <mat-option value="02">Cédula</mat-option>
                  <mat-option value="03">Pasaporte</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Identificación proveedor</mat-label>
                <input matInput formControlName="idProv" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Parte relacionada</mat-label>
                <mat-select formControlName="parteRel">
                  <mat-option value="NO">No</mat-option>
                  <mat-option value="SI">Sí</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full">
              <mat-label>Razón social del proveedor</mat-label>
              <input matInput formControlName="razonSocialProv" />
            </mat-form-field>

            <div class="grid-3">
              <mat-form-field appearance="outline">
                <mat-label>Sustento tributario</mat-label>
                <mat-select formControlName="codSustento">
                  @for (sustento of sustentos; track sustento.codigo) {
                    <mat-option [value]="sustento.codigo">{{ sustento.codigo }} · {{ sustento.descripcion }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Fecha emisión</mat-label>
                <input matInput [matDatepicker]="pEmision" formControlName="fechaEmision" />
                <mat-datepicker-toggle matIconSuffix [for]="pEmision"></mat-datepicker-toggle>
                <mat-datepicker #pEmision></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Fecha registro</mat-label>
                <input matInput [matDatepicker]="pRegistro" formControlName="fechaRegistro" />
                <mat-datepicker-toggle matIconSuffix [for]="pRegistro"></mat-datepicker-toggle>
                <mat-datepicker #pRegistro></mat-datepicker>
              </mat-form-field>
            </div>

            <div class="grid-4">
              <mat-form-field appearance="outline">
                <mat-label>Estab.</mat-label>
                <input matInput formControlName="establecimiento" maxlength="3" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Pto. emisión</mat-label>
                <input matInput formControlName="puntoEmision" maxlength="3" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Secuencial</mat-label>
                <input matInput formControlName="secuencial" maxlength="9" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Autorización / clave acceso</mat-label>
                <input matInput formControlName="autorizacion" />
              </mat-form-field>
            </div>

            @if (esNotaCredito()) {
              <div class="docmod-block">
                <h4>Documento modificado</h4>
                <p class="muted-hint">Comprobante que modifica esta nota de crédito.</p>
                <div class="grid-3">
                  <mat-form-field appearance="outline">
                    <mat-label>Tipo doc.</mat-label>
                    <mat-select formControlName="docModTipo">
                      @for (tipo of tiposComprobante; track tipo.codigo) {
                        <mat-option [value]="tipo.codigo">{{ tipo.codigo }} · {{ tipo.descripcion }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Fecha doc. modificado</mat-label>
                    <input matInput [matDatepicker]="pDocMod" formControlName="docModFecha" />
                    <mat-datepicker-toggle matIconSuffix [for]="pDocMod"></mat-datepicker-toggle>
                    <mat-datepicker #pDocMod></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Autorización doc. modificado</mat-label>
                    <input matInput formControlName="docModAutorizacion" />
                  </mat-form-field>
                </div>
                <div class="grid-3">
                  <mat-form-field appearance="outline">
                    <mat-label>Estab.</mat-label>
                    <input matInput formControlName="docModEstablecimiento" maxlength="3" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Pto. emisión</mat-label>
                    <input matInput formControlName="docModPuntoEmision" maxlength="3" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Secuencial</mat-label>
                    <input matInput formControlName="docModSecuencial" maxlength="9" />
                  </mat-form-field>
                </div>
              </div>
            }
          </section>

          <!-- Destino: alimentar inventario -->
          <section class="surface-card decision-card" [class.on]="form.value.alimentaInventario">
            <div class="decision-copy">
              <h3>Destino de la compra</h3>
              @if (form.value.alimentaInventario) {
                <p>Los ítems se vincularán a productos y esta factura <strong>subirá stock</strong> al almacén seleccionado, además de registrar el asiento de inventario.</p>
              } @else {
                <p>La factura se registrará <strong>solo contablemente</strong> (a cuenta de gasto/compras), sin afectar el inventario.</p>
              }
            </div>
            <div class="decision-controls">
              <mat-slide-toggle color="primary" formControlName="alimentaInventario">Alimentar inventario</mat-slide-toggle>
              @if (form.value.alimentaInventario) {
                <mat-form-field appearance="outline">
                  <mat-label>Almacén destino</mat-label>
                  <mat-select formControlName="almacenId">
                    @for (almacen of almacenes(); track almacen.id) {
                      <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
            </div>
          </section>

          <!-- Ítems -->
          <section class="surface-card step-card">
            <div class="items-head">
              <h3>Ítems</h3>
              <button mat-stroked-button type="button" (click)="agregarItem()">
                <mat-icon>add</mat-icon> Agregar ítem
              </button>
            </div>

            <div formArrayName="items" class="items-grid" [class.with-product]="form.value.alimentaInventario">
              <div class="items-grid-header">
                @if (form.value.alimentaInventario) { <span>Producto</span> }
                <span>Descripción</span><span class="num">Cant.</span><span class="num">C. Unit</span>
                <span class="num">IVA %</span><span class="num">Total</span><span></span>
              </div>
              @for (item of items.controls; track $index) {
                <div class="item-row" [formGroupName]="$index">
                  @if (form.value.alimentaInventario) {
                    <mat-form-field appearance="outline">
                      <mat-label>Producto</mat-label>
                      <mat-select formControlName="productoId" (selectionChange)="vincularProducto($index)">
                        <mat-option [value]="null">— Sin vincular —</mat-option>
                        @for (producto of productos(); track producto.id) {
                          <mat-option [value]="producto.id">{{ producto.nombre }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline">
                    <mat-label>Descripción</mat-label>
                    <input matInput formControlName="descripcion" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Cant.</mat-label>
                    <input matInput type="number" min="0" formControlName="cantidad" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>C. Unit</mat-label>
                    <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="costoUnitario" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>IVA %</mat-label>
                    <input matInput type="number" min="0" max="100" formControlName="ivaPorcentaje" />
                  </mat-form-field>
                  <div class="item-total">{{ totalItem($index) | currency: 'USD':'symbol-narrow':'1.2-2' }}</div>
                  <button mat-icon-button type="button" color="warn" (click)="eliminarItem($index)" [disabled]="items.length <= 1">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          </section>

          <!-- Impuestos y retenciones -->
          <section class="surface-card step-card">
            <h3>Impuestos y retenciones</h3>
            <div class="grid-4">
              <mat-form-field appearance="outline">
                <mat-label>Base gravada IVA</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseImpGrav" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Base 0%</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseImponible" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Base no objeto</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseNoGraIva" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Base exenta</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseImpExe" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Monto IVA</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="montoIva" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Monto ICE</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="montoIce" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Total sin impuestos</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="totalSinImpuestos" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Importe total</mat-label>
                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="importeTotal" />
              </mat-form-field>
            </div>

            <div class="ret-block">
              <div class="ret-head">
                <h4>Retención en la fuente (renta)</h4>
                <button mat-button type="button" (click)="agregarRetencionRenta()"><mat-icon>add</mat-icon> Agregar</button>
              </div>
              <div formArrayName="retencionesRenta" class="ret-grid">
                @for (ret of retencionesRenta.controls; track $index) {
                  <div class="ret-row" [formGroupName]="$index">
                    <mat-form-field appearance="outline"><mat-label>Cód. renta</mat-label><input matInput formControlName="codRetAir" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Base</mat-label><input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseImpAir" (input)="recalcularRetRenta($index)" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" min="0" formControlName="porcentajeAir" (input)="recalcularRetRenta($index)" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Valor</mat-label><input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="valRetAir" /></mat-form-field>
                    <button mat-icon-button type="button" color="warn" (click)="retencionesRenta.removeAt($index)"><mat-icon>delete</mat-icon></button>
                  </div>
                }
              </div>

              <div class="ret-head">
                <h4>Retención de IVA</h4>
                <button mat-button type="button" (click)="agregarRetencionIva()"><mat-icon>add</mat-icon> Agregar</button>
              </div>
              <div formArrayName="retencionesIva" class="ret-grid">
                @for (ret of retencionesIva.controls; track $index) {
                  <div class="ret-row" [formGroupName]="$index">
                    <mat-form-field appearance="outline"><mat-label>Cód. IVA</mat-label><input matInput formControlName="codRetIva" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Base</mat-label><input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="baseImpIva" (input)="recalcularRetIva($index)" /></mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>%</mat-label>
                      <mat-select formControlName="porcentajeIva" (selectionChange)="recalcularRetIva($index)">
                        @for (p of porcentajesRetIva; track p) { <mat-option [value]="p">{{ p }}%</mat-option> }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Valor</mat-label><input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="valRetIva" /></mat-form-field>
                    <button mat-icon-button type="button" color="warn" (click)="retencionesIva.removeAt($index)"><mat-icon>delete</mat-icon></button>
                  </div>
                }
              </div>
            </div>
          </section>

          <!-- Forma de pago -->
          <section class="surface-card step-card">
            <h3>Forma de pago</h3>
            @if (requiereFormaPago() && (form.value.formasDePago?.length ?? 0) === 0) {
              <p class="warn-inline"><mat-icon>warning</mat-icon> El SRI exige forma de pago en compras ≥ {{ montoMinimoFormaPago | currency: 'USD':'symbol-narrow':'1.0-0' }}.</p>
            }
            <mat-form-field appearance="outline" class="full">
              <mat-label>Formas de pago utilizadas</mat-label>
              <mat-select formControlName="formasDePago" multiple>
                @for (fp of formasPago; track fp.codigo) {
                  <mat-option [value]="fp.codigo">{{ fp.codigo }} · {{ fp.descripcion }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </section>
        }

        <!-- Totales pegajosos + acciones -->
        @if (mostrarDetalle()) {
          <section class="surface-card totals-bar metric-hero">
            <div class="totals-grid">
              <div><span>Subtotal</span><strong>{{ form.value.totalSinImpuestos | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong></div>
              <div><span>IVA</span><strong>{{ form.value.montoIva | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong></div>
              <div><span>Retención</span><strong>{{ totalRetencion() | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong></div>
              <div class="grand"><span>Total</span><strong>{{ form.value.importeTotal | currency: 'USD':'symbol-narrow':'1.2-2' }}</strong></div>
            </div>
            <div class="totals-actions">
              <a mat-button routerLink="/workspace/contabilidad/compras">Cancelar</a>
              <button mat-stroked-button type="submit" [disabled]="guardando()">Guardar borrador</button>
              <button mat-flat-button color="primary" type="button" (click)="guardarYRegistrar()" [disabled]="guardando()">
                <mat-icon>task_alt</mat-icon> Guardar y registrar
              </button>
            </div>
          </section>
        }
      </form>
    </section>
  `,
  styles: [`
    .fc-page { display: grid; gap: 1rem; padding-bottom: 5rem; }
    .page-header { padding: 1.1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    .page-header h2 { margin: 0; font-size: 1.5rem; }

    .step-card { padding: 1.25rem 1.5rem; display: grid; gap: 1rem; }
    .step-head { display: flex; gap: .85rem; align-items: flex-start; }
    .step-badge { flex: none; width: 2rem; height: 2rem; border-radius: 999px; display: grid; place-items: center; font-weight: 700; color: #fff; background: var(--primary); }
    .step-head h3 { margin: 0; }
    .step-head p { margin: .2rem 0 0; color: var(--muted-foreground); }

    .upload-options { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .or-sep { color: var(--muted-foreground); font-size: .85rem; }
    mat-button-toggle-group { border-radius: 999px; overflow: hidden; align-self: flex-start; }
    .docmod-block { border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent); border-radius: .75rem; padding: .9rem 1rem; display: grid; gap: .6rem; background: color-mix(in srgb, var(--primary) 4%, var(--card)); }
    .docmod-block h4 { margin: 0; }
    .muted-hint { margin: 0; color: var(--muted-foreground); font-size: .85rem; }
    .parsing-hint, .parse-error { display: flex; align-items: center; gap: .5rem; font-weight: 500; }
    .parse-error { color: var(--destructive); }
    .parsed-chip { display: flex; align-items: center; gap: .85rem; padding: .85rem 1rem; border-radius: 1rem; background: color-mix(in srgb, var(--primary) 8%, var(--card)); }
    .parsed-chip > mat-icon { color: var(--primary); }
    .chip-copy { display: grid; flex: 1; }
    .chip-copy span { color: var(--muted-foreground); font-size: .85rem; }

    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: .75rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: .75rem; }
    .full { width: 100%; }

    .decision-card { padding: 1.1rem 1.5rem; display: flex; justify-content: space-between; gap: 1.25rem; align-items: center; flex-wrap: wrap; border: 1px solid transparent; transition: background .2s, border-color .2s; }
    .decision-card.on { background: color-mix(in srgb, var(--primary) 7%, var(--card)); border-color: color-mix(in srgb, var(--primary) 25%, transparent); }
    .decision-copy h3 { margin: 0 0 .25rem; }
    .decision-copy p { margin: 0; color: var(--muted-foreground); max-width: 60ch; }
    .decision-controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

    .items-head { display: flex; justify-content: space-between; align-items: center; }
    .items-head h3 { margin: 0; }
    .items-grid { display: grid; gap: .5rem; }
    .items-grid-header, .item-row { display: grid; grid-template-columns: 1.6fr .7fr .8fr .7fr .9fr auto; gap: .5rem; align-items: center; }
    .items-grid.with-product .items-grid-header, .items-grid.with-product .item-row { grid-template-columns: 1.2fr 1.4fr .7fr .8fr .7fr .9fr auto; }
    .items-grid-header { color: var(--muted-foreground); font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; padding: 0 .25rem; }
    .items-grid-header .num, .item-total { text-align: right; }
    .item-total { font-weight: 600; }
    .item-row mat-form-field { margin-bottom: -1.1em; }

    .ret-block { display: grid; gap: .5rem; }
    .ret-head { display: flex; justify-content: space-between; align-items: center; margin-top: .5rem; }
    .ret-head h4 { margin: 0; }
    .ret-grid { display: grid; gap: .5rem; }
    .ret-row { display: grid; grid-template-columns: 1fr 1fr .7fr 1fr auto; gap: .5rem; align-items: center; }
    .ret-row mat-form-field { margin-bottom: -1.1em; }

    .warn-inline { display: flex; align-items: center; gap: .4rem; color: #9c6412; margin: 0; }
    .warn-inline mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }

    .totals-bar { position: sticky; bottom: 1rem; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 5; }
    .metric-hero { color: #fff; background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #0a1f1b)); box-shadow: 0 14px 34px color-mix(in srgb, var(--primary) 32%, transparent); }
    .totals-grid { display: flex; gap: 1.75rem; flex-wrap: wrap; }
    .totals-grid span { display: block; font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; opacity: .85; }
    .totals-grid strong { font-size: 1.15rem; }
    .totals-grid .grand strong { font-size: 1.5rem; }
    .totals-actions { display: flex; gap: .5rem; align-items: center; }
    .totals-actions a[mat-button] { color: #fff; }

    .pill { padding: .28rem .8rem; border-radius: 999px; font-weight: 600; font-size: .8rem; }
    .pill-draft { background: color-mix(in srgb, #b7791f 22%, transparent); color: #fff; }
    .pill-ok { background: color-mix(in srgb, #1a7f52 30%, transparent); color: #fff; }
    .pill-void { background: color-mix(in srgb, var(--destructive) 24%, transparent); color: #fff; }

    @media (max-width: 1050px) {
      .grid-3, .grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .items-grid-header { display: none; }
      .item-row, .items-grid.with-product .item-row { grid-template-columns: 1fr 1fr; }
      .ret-row { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class FacturaCompraFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly facturasService = inject(FacturasCompraService);
  private readonly comprasXml = inject(ComprasXmlService);
  private readonly productosService = inject(ProductosService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly integracionContable = inject(IntegracionContableService);

  protected readonly sustentos = CODIGOS_SUSTENTO;
  protected readonly formasPago = FORMAS_PAGO;
  protected readonly tiposComprobante = TIPOS_COMPROBANTE;
  protected readonly porcentajesRetIva = PORCENTAJES_RET_IVA;
  protected readonly montoMinimoFormaPago = MONTO_MINIMO_FORMA_PAGO;

  protected readonly modo = signal<OrigenDocumentoCompra>('XML');
  protected readonly soporteAdjunto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly parseando = signal(false);
  protected readonly parseado = signal(false);
  protected readonly parseError = signal<string | null>(null);
  protected readonly facturaId = signal<string | null>(null);
  protected readonly estado = signal<'BORRADOR' | 'REGISTRADA' | 'ANULADA'>('BORRADOR');
  protected readonly soloLectura = computed(() => this.estado() !== 'BORRADOR');
  protected readonly productos = signal<Producto[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);

  private archivoId: string | null = null;
  private xmlStoragePath: string | null = null;
  private ordenCompraId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    tpIdProv: ['01' as TipoIdProveedor],
    idProv: ['', [Validators.required]],
    razonSocialProv: ['', [Validators.required]],
    parteRel: ['NO'],
    codSustento: ['01', [Validators.required]],
    tipoComprobante: ['01'],
    establecimiento: ['', [Validators.required]],
    puntoEmision: ['', [Validators.required]],
    secuencial: ['', [Validators.required]],
    autorizacion: [''],
    fechaEmision: [new Date(), [Validators.required]],
    fechaRegistro: [new Date(), [Validators.required]],
    baseNoGraIva: [0],
    baseImponible: [0],
    baseImpGrav: [0],
    baseImpExe: [0],
    montoIce: [0],
    montoIva: [0],
    totalSinImpuestos: [0],
    importeTotal: [0],
    formasDePago: [[] as string[]],
    alimentaInventario: [false],
    almacenId: [''],
    // Documento modificado (solo NC)
    docModTipo: ['01'],
    docModEstablecimiento: [''],
    docModPuntoEmision: [''],
    docModSecuencial: [''],
    docModFecha: [null as Date | null],
    docModAutorizacion: [''],
    items: this.fb.array([]),
    retencionesRenta: this.fb.array([]),
    retencionesIva: this.fb.array([])
  });

  protected get items(): FormArray { return this.form.get('items') as FormArray; }
  protected get retencionesRenta(): FormArray { return this.form.get('retencionesRenta') as FormArray; }
  protected get retencionesIva(): FormArray { return this.form.get('retencionesIva') as FormArray; }

  protected readonly titulo = computed(() => this.facturaId() ? (this.soloLectura() ? 'Factura de compra' : 'Editar factura de compra') : 'Nueva factura de compra');
  protected readonly mostrarDetalle = computed(() => this.parseado() || this.modo() === 'MANUAL' || !!this.facturaId());

  protected esNotaCredito(): boolean {
    return this.form.getRawValue().tipoComprobante === TIPO_COMPROBANTE_NOTA_CREDITO;
  }

  protected tipoComprobanteLabel(): string {
    const tipo = this.form.getRawValue().tipoComprobante;
    return this.tiposComprobante.find((item) => item.codigo === tipo)?.descripcion ?? 'Comprobante';
  }

  protected cambiarModo(modo: OrigenDocumentoCompra): void {
    this.modo.set(modo);
    this.parseError.set(null);
    if (modo === 'MANUAL') {
      this.parseado.set(false);
    }
  }

  protected onSoporteSubido(item: ArchivoItem): void {
    this.archivoId = item.id;
    this.xmlStoragePath = item.storagePath ?? null;
    this.soporteAdjunto.set(true);
  }

  protected quitarSoporte(): void {
    this.soporteAdjunto.set(false);
    this.archivoId = null;
    this.xmlStoragePath = null;
  }

  async ngOnInit(): Promise<void> {
    this.productosService.getProductos().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => this.productos.set(productos.filter((p) => p.activo !== false)));
    this.almacenesService.getAlmacenesActivos().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => this.almacenes.set(almacenes));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.cargarFactura(id);
    }
  }

  protected documento(): string {
    const v = this.form.value;
    return `${v.establecimiento ?? ''}-${v.puntoEmision ?? ''}-${v.secuencial ?? ''}`;
  }

  protected estadoLabel(): string {
    return { BORRADOR: 'Borrador', REGISTRADA: 'Registrada', ANULADA: 'Anulada' }[this.estado()];
  }
  protected estadoClase(): string {
    return { BORRADOR: 'pill-draft', REGISTRADA: 'pill-ok', ANULADA: 'pill-void' }[this.estado()];
  }

  protected requiereFormaPago(): boolean {
    return Number(this.form.value.importeTotal ?? 0) >= MONTO_MINIMO_FORMA_PAGO;
  }

  protected totalItem(index: number): number {
    const g = this.items.at(index);
    const cantidad = Number(g.get('cantidad')?.value ?? 0);
    const costo = Number(g.get('costoUnitario')?.value ?? 0);
    const iva = Number(g.get('ivaPorcentaje')?.value ?? 0);
    const subtotal = cantidad * costo;
    return this.round2(subtotal + subtotal * (iva / 100));
  }

  protected totalRetencion(): number {
    const renta = this.retencionesRenta.controls.reduce((t, g) => t + Number(g.get('valRetAir')?.value ?? 0), 0);
    const iva = this.retencionesIva.controls.reduce((t, g) => t + Number(g.get('valRetIva')?.value ?? 0), 0);
    return this.round2(renta + iva);
  }

  protected seleccionarExistente(): void {
    const dialogRef = this.dialog.open<ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult | null>(
      ArchivoSelectorDialogComponent,
      {
        maxWidth: '96vw',
        data: {
          title: 'Selecciona el XML de la factura',
          subtitle: 'Reutiliza un comprobante ya cargado (por ejemplo, los descargados del SRI) o sube uno nuevo.',
          sourceModule: 'compras',
          allowUpload: true,
          extensions: ['xml']
        }
      }
    );
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.archivo) {
        this.onXmlSubido(result.archivo);
      }
    });
  }

  protected onXmlSubido(item: ArchivoItem): void {
    this.archivoId = item.id;
    this.xmlStoragePath = item.storagePath;
    if (!item.storagePath) {
      return;
    }
    this.parseando.set(true);
    this.parseError.set(null);
    this.comprasXml.parseXml(item.storagePath).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (parsed) => {
        this.aplicarParseado(parsed);
        this.parseando.set(false);
        this.parseado.set(true);
      },
      error: (error) => {
        this.parseando.set(false);
        this.parseado.set(true); // permite llenado manual
        this.parseError.set(error?.error?.message ?? error?.message ?? 'No se pudo analizar el XML.');
      }
    });
  }

  private aplicarParseado(parsed: FacturaCompraParsed): void {
    const fecha = parsed.fechaEmision ? new Date(parsed.fechaEmision) : new Date();
    this.form.patchValue({
      tpIdProv: (parsed.tpIdProv as TipoIdProveedor) ?? '01',
      idProv: parsed.idProv ?? '',
      razonSocialProv: parsed.razonSocialProv ?? '',
      tipoComprobante: parsed.tipoComprobante ?? '01',
      establecimiento: parsed.establecimiento ?? '',
      puntoEmision: parsed.puntoEmision ?? '',
      secuencial: parsed.secuencial ?? '',
      autorizacion: parsed.claveAcceso ?? '',
      fechaEmision: fecha,
      fechaRegistro: fecha,
      baseNoGraIva: parsed.baseNoGraIva ?? 0,
      baseImponible: parsed.baseImponible ?? 0,
      baseImpGrav: parsed.baseImpGrav ?? 0,
      baseImpExe: parsed.baseImpExe ?? 0,
      montoIce: parsed.montoIce ?? 0,
      montoIva: parsed.montoIva ?? 0,
      totalSinImpuestos: parsed.totalSinImpuestos ?? 0,
      importeTotal: parsed.importeTotal ?? 0
    });

    // Documento modificado (notas de crédito).
    if (parsed.tipoComprobante === TIPO_COMPROBANTE_NOTA_CREDITO) {
      const partes = (parsed.numDocModificado ?? '').split('-');
      this.form.patchValue({
        docModTipo: parsed.codDocModificado || '01',
        docModEstablecimiento: partes[0] ?? '',
        docModPuntoEmision: partes[1] ?? '',
        docModSecuencial: partes[2] ?? '',
        docModFecha: parsed.fechaEmisionDocSustento ? new Date(parsed.fechaEmisionDocSustento) : null
      });
    }

    this.items.clear();
    (parsed.items ?? []).forEach((item) => {
      this.items.push(this.crearItemGroup({
        productoId: null,
        codigoPrincipal: item.codigoPrincipal,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        costoUnitario: item.precioUnitario,
        descuento: item.descuento,
        ivaPorcentaje: item.ivaPorcentaje,
        subtotal: 0,
        iva: 0,
        total: 0
      }));
    });
    if (this.items.length === 0) {
      this.agregarItem();
    }
  }

  protected agregarItem(): void {
    this.items.push(this.crearItemGroup());
  }

  protected eliminarItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  protected vincularProducto(index: number): void {
    const g = this.items.at(index);
    const productoId = g.get('productoId')?.value;
    const producto = this.productos().find((p) => p.id === productoId);
    if (producto) {
      g.patchValue({
        descripcion: g.get('descripcion')?.value || producto.nombre,
        ivaPorcentaje: g.get('ivaPorcentaje')?.value || producto.ivaPorcentaje
      }, { emitEvent: false });
    }
  }

  protected agregarRetencionRenta(): void {
    this.retencionesRenta.push(this.fb.nonNullable.group({
      codRetAir: [''],
      baseImpAir: [0],
      porcentajeAir: [0],
      valRetAir: [0]
    }));
  }

  protected agregarRetencionIva(): void {
    this.retencionesIva.push(this.fb.nonNullable.group({
      codRetIva: ['9'],
      baseImpIva: [0],
      porcentajeIva: [30],
      valRetIva: [0]
    }));
  }

  protected recalcularRetRenta(index: number): void {
    const g = this.retencionesRenta.at(index);
    const base = Number(g.get('baseImpAir')?.value ?? 0);
    const pct = Number(g.get('porcentajeAir')?.value ?? 0);
    g.patchValue({ valRetAir: this.round2(base * pct / 100) }, { emitEvent: false });
  }

  protected recalcularRetIva(index: number): void {
    const g = this.retencionesIva.at(index);
    const base = Number(g.get('baseImpIva')?.value ?? 0);
    const pct = Number(g.get('porcentajeIva')?.value ?? 0);
    g.patchValue({ valRetIva: this.round2(base * pct / 100) }, { emitEvent: false });
  }

  protected async guardar(): Promise<string | null> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      this.toast('Revisa los campos obligatorios.', 'error');
      return null;
    }
    if (this.requiereFormaPago() && (this.form.value.formasDePago?.length ?? 0) === 0) {
      this.toast('Selecciona al menos una forma de pago (compra ≥ $500).', 'warning');
      return null;
    }
    if (this.modo() === 'MANUAL' && !this.archivoId) {
      this.toast('Adjunta el documento escaneado (obligatorio en registro manual).', 'warning');
      return null;
    }
    if (this.esNotaCredito()) {
      const v = this.form.getRawValue();
      if (!v.docModEstablecimiento || !v.docModPuntoEmision || !v.docModSecuencial) {
        this.toast('Completa el documento modificado por la nota de crédito.', 'warning');
        return null;
      }
    }

    this.guardando.set(true);
    try {
      const factura = this.construirFactura();
      const items = this.construirItems();
      const existingId = this.facturaId();

      if (existingId) {
        await this.facturasService.actualizarFacturaCompra(existingId, factura);
        await this.facturasService.reemplazarItems(existingId, items);
        this.toast('Factura de compra actualizada.', 'save');
        return existingId;
      }

      const nuevoId = await this.facturasService.crearFacturaCompra({ factura, items });
      this.facturaId.set(nuevoId);
      this.toast('Borrador guardado.', 'save');
      return nuevoId;
    } catch (error) {
      this.toast(error instanceof Error ? error.message : 'No se pudo guardar la factura.', 'error');
      return null;
    } finally {
      this.guardando.set(false);
    }
  }

  protected async guardarYRegistrar(): Promise<void> {
    const id = await this.guardar();
    if (!id) {
      return;
    }
    if (this.form.value.alimentaInventario && !this.form.value.almacenId) {
      this.toast('Selecciona un almacén destino para alimentar inventario.', 'warning');
      return;
    }
    this.guardando.set(true);
    try {
      await this.facturasService.registrarFacturaCompra(id);
      this.estado.set('REGISTRADA');
      this.toast('Factura registrada y contabilizada.', 'task_alt');
      await this.router.navigate(['/workspace/contabilidad/compras']);
    } catch (error) {
      this.toast(error instanceof Error ? error.message : 'No se pudo registrar la factura.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  protected reemplazarXml(): void {
    this.parseado.set(false);
    this.parseError.set(null);
  }

  private construirFactura(): Omit<FacturaCompra, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'> {
    const v = this.form.getRawValue();
    const esNc = v.tipoComprobante === TIPO_COMPROBANTE_NOTA_CREDITO;
    const docModificado: DocumentoModificado | null = esNc
      ? {
          tipoComprobante: v.docModTipo || '01',
          establecimiento: (v.docModEstablecimiento ?? '').trim(),
          puntoEmision: (v.docModPuntoEmision ?? '').trim(),
          secuencial: (v.docModSecuencial ?? '').trim(),
          fechaEmision: v.docModFecha ? this.toTs(v.docModFecha) : null,
          autorizacion: (v.docModAutorizacion ?? '').trim()
        }
      : null;
    return {
      estado: this.estado(),
      origen: this.modo(),
      docModificado,
      tpIdProv: v.tpIdProv,
      idProv: v.idProv.trim(),
      razonSocialProv: v.razonSocialProv.trim(),
      parteRel: v.parteRel === 'SI' ? 'SI' : 'NO',
      codSustento: v.codSustento,
      tipoComprobante: v.tipoComprobante || '01',
      establecimiento: v.establecimiento.trim(),
      puntoEmision: v.puntoEmision.trim(),
      secuencial: v.secuencial.trim(),
      autorizacion: v.autorizacion?.trim() || '',
      claveAcceso: v.autorizacion?.trim() || '',
      fechaEmision: this.toTs(v.fechaEmision),
      fechaRegistro: this.toTs(v.fechaRegistro),
      baseNoGraIva: this.num(v.baseNoGraIva),
      baseImponible: this.num(v.baseImponible),
      baseImpGrav: this.num(v.baseImpGrav),
      baseImpExe: this.num(v.baseImpExe),
      montoIce: this.num(v.montoIce),
      montoIva: this.num(v.montoIva),
      totalSinImpuestos: this.num(v.totalSinImpuestos),
      importeTotal: this.num(v.importeTotal),
      formasDePago: v.formasDePago ?? [],
      pagoExterior: { pagoLocExt: '01' },
      retencionesRenta: this.retencionesRenta.controls.map((g) => ({
        codRetAir: String(g.get('codRetAir')?.value ?? ''),
        baseImpAir: this.num(g.get('baseImpAir')?.value),
        porcentajeAir: this.num(g.get('porcentajeAir')?.value),
        valRetAir: this.num(g.get('valRetAir')?.value)
      })),
      retencionesIva: this.retencionesIva.controls.map((g) => ({
        codRetIva: String(g.get('codRetIva')?.value ?? ''),
        baseImpIva: this.num(g.get('baseImpIva')?.value),
        porcentajeIva: this.num(g.get('porcentajeIva')?.value),
        valRetIva: this.num(g.get('valRetIva')?.value)
      })),
      totalRetencion: this.totalRetencion(),
      alimentaInventario: !!v.alimentaInventario,
      almacenId: v.alimentaInventario ? (v.almacenId || null) : null,
      ordenCompraId: this.ordenCompraId,
      archivoId: this.archivoId,
      xmlStoragePath: this.xmlStoragePath,
      creadoPor: this.authService.currentUser()?.uid ?? 'sistema'
    };
  }

  private construirItems(): Omit<FacturaCompraItem, 'id'>[] {
    return this.items.controls.map((g) => {
      const cantidad = this.num(g.get('cantidad')?.value);
      const costo = this.num(g.get('costoUnitario')?.value);
      const iva = this.num(g.get('ivaPorcentaje')?.value);
      const subtotal = this.round2(cantidad * costo);
      const ivaValor = this.round2(subtotal * iva / 100);
      return {
        productoId: g.get('productoId')?.value ?? null,
        codigoPrincipal: g.get('codigoPrincipal')?.value ?? '',
        descripcion: String(g.get('descripcion')?.value ?? ''),
        cantidad,
        costoUnitario: costo,
        descuento: this.num(g.get('descuento')?.value),
        ivaPorcentaje: iva,
        subtotal,
        iva: ivaValor,
        total: this.round2(subtotal + ivaValor)
      };
    });
  }

  private crearItemGroup(item?: Partial<FacturaCompraItem>): FormGroup {
    return this.fb.nonNullable.group({
      productoId: [item?.productoId ?? null],
      codigoPrincipal: [item?.codigoPrincipal ?? ''],
      descripcion: [item?.descripcion ?? '', [Validators.required]],
      cantidad: [item?.cantidad ?? 1, [Validators.required, Validators.min(0)]],
      costoUnitario: [item?.costoUnitario ?? 0, [Validators.required, Validators.min(0)]],
      descuento: [item?.descuento ?? 0],
      ivaPorcentaje: [item?.ivaPorcentaje ?? 15]
    });
  }

  private async cargarFactura(id: string): Promise<void> {
    const factura = await this.facturasService.getFacturaCompraById(id);
    if (!factura) {
      this.toast('Factura no encontrada.', 'error');
      return;
    }
    this.facturaId.set(id);
    this.estado.set(factura.estado);
    this.archivoId = factura.archivoId ?? null;
    this.xmlStoragePath = factura.xmlStoragePath ?? null;
    this.ordenCompraId = factura.ordenCompraId ?? null;
    this.modo.set(factura.origen ?? 'XML');
    this.soporteAdjunto.set(!!factura.archivoId);
    this.parseado.set(factura.origen !== 'MANUAL');

    const dm = factura.docModificado;
    this.form.patchValue({
      docModTipo: dm?.tipoComprobante ?? '01',
      docModEstablecimiento: dm?.establecimiento ?? '',
      docModPuntoEmision: dm?.puntoEmision ?? '',
      docModSecuencial: dm?.secuencial ?? '',
      docModFecha: dm?.fechaEmision ? new Date(dm.fechaEmision) : null,
      docModAutorizacion: dm?.autorizacion ?? ''
    });

    this.form.patchValue({
      tpIdProv: factura.tpIdProv,
      idProv: factura.idProv,
      razonSocialProv: factura.razonSocialProv,
      parteRel: factura.parteRel,
      codSustento: factura.codSustento,
      tipoComprobante: factura.tipoComprobante,
      establecimiento: factura.establecimiento,
      puntoEmision: factura.puntoEmision,
      secuencial: factura.secuencial,
      autorizacion: factura.autorizacion ?? factura.claveAcceso ?? '',
      fechaEmision: new Date(factura.fechaEmision),
      fechaRegistro: new Date(factura.fechaRegistro),
      baseNoGraIva: factura.baseNoGraIva,
      baseImponible: factura.baseImponible,
      baseImpGrav: factura.baseImpGrav,
      baseImpExe: factura.baseImpExe,
      montoIce: factura.montoIce,
      montoIva: factura.montoIva,
      totalSinImpuestos: factura.totalSinImpuestos,
      importeTotal: factura.importeTotal,
      formasDePago: factura.formasDePago ?? [],
      alimentaInventario: factura.alimentaInventario,
      almacenId: factura.almacenId ?? ''
    });

    (factura.retencionesRenta ?? []).forEach((ret) => {
      this.agregarRetencionRenta();
      this.retencionesRenta.at(this.retencionesRenta.length - 1).patchValue(ret);
    });
    (factura.retencionesIva ?? []).forEach((ret) => {
      this.agregarRetencionIva();
      this.retencionesIva.at(this.retencionesIva.length - 1).patchValue(ret);
    });

    const items = await this.facturasService.getItems(id);
    this.items.clear();
    items.forEach((item) => this.items.push(this.crearItemGroup(item)));
    if (this.items.length === 0) {
      this.agregarItem();
    }

    if (this.soloLectura()) {
      this.form.disable({ emitEvent: false });
    }
  }

  private toTs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
  }

  private num(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}

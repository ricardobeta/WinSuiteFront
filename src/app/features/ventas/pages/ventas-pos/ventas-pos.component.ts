import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, firstValueFrom, startWith } from 'rxjs';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';

import { ClienteFormDialogComponent } from '../../../../shared/components/cliente-form-dialog/cliente-form-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { Cliente, ClienteDialogData } from '../../../../shared/models/clientes.models';
import { Servicio } from '../../../../shared/models/servicios.models';
import { ClientesService } from '../../../../core/services/clientes.service';
import { ConfiguracionClientesService } from '../../../../core/services/configuracion-clientes.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ServiciosService } from '../../../../core/services/servicios.service';
import { Almacen, Producto } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { KardexService } from '../../../inventario/services/kardex.service';
import { ProductosService } from '../../../inventario/services/productos.service';
import { RecetasService } from '../../../inventario/services/recetas.service';
import { CarritoItem, CuentaAbierta, MetodoPagoVenta, ModoPos, PerfilPos, SesionCaja, VentaItemTipo } from '../../models/ventas.models';
import { VentasConfigService } from '../../services/ventas-config.service';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { VentasPosStateService } from '../../services/ventas-pos-state.service';
import { VentasPosConfigService } from '../../services/ventas-pos-config.service';
import { CuentasAbiertasService } from '../../services/cuentas-abiertas.service';
import { PosImmersiveService } from '../../services/pos-immersive.service';
import {
  DividirCuentaDialogComponent,
  DividirCuentaResult
} from '../dividir-cuenta-dialog/dividir-cuenta-dialog.component';
import { VentasService } from '../../services/ventas.service';
import { VentasAlmacenSesionService } from '../../services/ventas-almacen-sesion.service';
import { FacturaService, FacturaSriError } from '../../services/factura.service';
import { FacturaSriErrorDialogComponent } from '../factura-sri-error-dialog/factura-sri-error-dialog.component';

interface CatalogoPosItem {
  id: string;
  tipo: 'PRODUCTO' | 'SERVICIO' | 'RECETA';
  sku: string;
  codigoBarras?: string;
  nombre: string;
  precio: number;
  impuestoPorcentaje: number;
  costoUnitario: number;
  stock: number | null;
  permitirInventarioNegativo?: boolean;
}

@Component({
  selector: 'app-ventas-pos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    TwoDecimalInputDirective
  ],
  template: `
    @if (sineAlmacenesPermitidos()) {
      <section class="pos-bloqueado">
        <div class="bloqueado-contenido">
          <mat-icon class="bloqueado-icono">lock</mat-icon>
          <h2>Acceso Restringido</h2>
          <p>No tienes almacenes asignados para operar en el POS.</p>
          <p class="subtitulo">Contacta a tu administrador para que te asigne almacenes o ve a configuración.</p>
          <button mat-raised-button color="primary" (click)="irAConfiguracion()">
            <mat-icon>settings</mat-icon>
            Ir a Configuración
          </button>
        </div>
      </section>
    } @else {
      @if (facturandoPaso()) {
        <div class="facturando-overlay">
          <div class="facturando-card">
            <mat-spinner diameter="46"></mat-spinner>
            <p class="facturando-titulo">Facturando</p>
            <p class="facturando-paso">{{ facturandoPaso() }}</p>
          </div>
        </div>
      }

      <section class="pos-grid">
        <section class="pos-tabs" style="grid-column: 1 / -1;">
          <header class="pos-tabs-header">
            <h3>{{ tituloCuentas() }}</h3>
            <div class="pos-tabs-actions">
              <button mat-stroked-button type="button" (click)="agregarPestanaPos()">
                <mat-icon>add</mat-icon>
                {{ esRestaurante() ? 'Nueva ' + etiquetaCuenta().toLowerCase() : 'Nueva pestana' }}
              </button>
              @if (permiteCuentasAbiertas()) {
                <button mat-stroked-button type="button" (click)="retenerCuenta()">
                  <mat-icon>pause_circle</mat-icon>
                  Retener
                </button>
              }
              <button
                mat-stroked-button
                type="button"
                class="fullscreen-btn"
                [attr.aria-label]="immersive() ? 'Salir de pantalla completa' : 'Pantalla completa'"
                (click)="togglePantallaCompleta()"
              >
                <mat-icon>{{ immersive() ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
                {{ immersive() ? 'Salir' : 'Pantalla completa' }}
              </button>
            </div>
          </header>

        <div class="pos-tabs-list">
          @for (tab of state.tabs(); track tab.id) {
            <div
              class="pos-tab"
              [class.active]="state.activeTabId() === tab.id"
              tabindex="0"
              (click)="seleccionarPestana(tab.id)"
              (keydown.enter)="seleccionarPestana(tab.id)"
              (keydown.space)="$event.preventDefault(); seleccionarPestana(tab.id)"
            >
              @if (tabEditandoId() === tab.id) {
                <input
                  class="pos-tab-input"
                  [formControl]="tabNombreControl"
                  maxlength="30"
                  (click)="$event.stopPropagation()"
                  (blur)="confirmarEdicionPestana()"
                  (keydown.enter)="confirmarEdicionPestana()"
                  (keydown.escape)="cancelarEdicionPestana()"
                />
              } @else {
                <span class="pos-tab-title">{{ tab.nombre }}</span>
              }

              <span class="pos-tab-count">{{ tab.carrito.items.length }}</span>

              @if (tabEditandoId() !== tab.id) {
                <button mat-icon-button type="button" (click)="iniciarEdicionPestana(tab.id, tab.nombre, $event)">
                  <mat-icon>edit</mat-icon>
                </button>
              }

              <button
                mat-icon-button
                type="button"
                [disabled]="state.tabs().length === 1"
                (click)="cerrarPestana(tab.id, $event)"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
        </div>

        @if (permiteCuentasAbiertas() && cuentasAbiertas().length > 0) {
          <div class="cuentas-abiertas">
            <span class="cuentas-abiertas-label">{{ etiquetaCuenta() }}s retenidas:</span>
            @for (cuenta of cuentasAbiertas(); track cuenta.id) {
              <div class="cuenta-chip" tabindex="0" (click)="resumirCuenta(cuenta)" (keydown.enter)="resumirCuenta(cuenta)">
                <mat-icon>receipt</mat-icon>
                <span class="cuenta-nombre">{{ cuenta.etiqueta }}</span>
                <span class="cuenta-count">{{ cuenta.carrito.items.length }}</span>
                <button mat-icon-button type="button" (click)="eliminarCuentaAbierta(cuenta, $event)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
          </div>
        }
      </section>

      <article class="surface-card panel panel-left">
        <header class="panel-title">
          <h2>Catalogo de venta</h2>
          <p>Elige productos o servicios desde una sola vista y agregalos al carrito.</p>
        </header>

        @if (perfil()?.escaneoHabilitado) {
          <div class="scan-bar">
            <mat-form-field appearance="outline" class="scan-field">
              <mat-icon matPrefix>barcode_scanner</mat-icon>
              <mat-label>Escanear codigo de barras</mat-label>
              <input
                matInput
                [formControl]="scanControl"
                (keydown.enter)="escanear()"
                placeholder="Escanea o teclea el codigo y Enter · usa 3*codigo para cantidad"
                autocomplete="off"
              />
            </mat-form-field>
          </div>
        }

        <div class="catalog-type-switch">
          <button
            mat-stroked-button
            type="button"
            [class.active]="filtroCatalogo() === 'TODOS'"
            (click)="seleccionarFiltroCatalogo('TODOS')"
          >
            Todos
          </button>
          <button
            mat-stroked-button
            type="button"
            [class.active]="filtroCatalogo() === 'PRODUCTOS'"
            (click)="seleccionarFiltroCatalogo('PRODUCTOS')"
          >
            Productos
          </button>
          <button
            mat-stroked-button
            type="button"
            [class.active]="filtroCatalogo() === 'SERVICIOS'"
            (click)="seleccionarFiltroCatalogo('SERVICIOS')"
          >
            Servicios
          </button>
        </div>

        <div class="products-view-switch">
          <button
            mat-stroked-button
            type="button"
            [class.active]="vistaProductos() === 'cards'"
            (click)="cambiarVistaProductos('cards')"
          >
            <mat-icon>grid_view</mat-icon>
            Tarjetas
          </button>
          <button
            mat-stroked-button
            type="button"
            [class.active]="vistaProductos() === 'table'"
            (click)="cambiarVistaProductos('table')"
          >
            <mat-icon>table_rows</mat-icon>
            Lista
          </button>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Buscar en catalogo</mat-label>
          <input matInput [formControl]="busquedaProductoControl" placeholder="SKU, nombre de producto o servicio" />
        </mat-form-field>

        <p class="products-result-label">Mostrando {{ catalogoFiltrado().length }} resultados</p>

        @if (vistaProductos() === 'cards') {
          @if (catalogoFiltrado().length === 0) {
            <div class="productos-empty">
              <mat-icon>search_off</mat-icon>
              <p>No encontramos resultados con ese criterio.</p>
            </div>
          } @else {
            <section class="productos-grid">
              @for (item of catalogoFiltrado(); track item.tipo + '-' + item.id) {
                <button type="button" class="producto-card" (click)="agregarDesdeCatalogo(item)" [disabled]="itemSinStock(item)">
                  <div class="producto-header-row">
                    <div>
                      <p class="producto-nombre">{{ item.nombre }}</p>
                      <p class="producto-meta">{{ item.sku }}</p>
                    </div>

                    <span
                      class="stock-badge"
                      [class.service]="esServicio(item)"
                      [class.danger]="itemSinStock(item)"
                      [class.warn]="stockBajoCatalogo(item)"
                    >
                      {{ etiquetaStockCatalogo(item) }}
                    </span>
                  </div>

                  <div class="producto-footer-row">
                    <div>
                      <p class="producto-price-label">Precio</p>
                      <p class="producto-precio">{{ item.precio | number:'1.2-2' }}</p>
                    </div>

                    <span class="producto-cta" [class.disabled]="itemSinStock(item)">
                      <mat-icon>add_shopping_cart</mat-icon>
                      Agregar
                    </span>
                  </div>

                  <p class="producto-stock" [class.sin-stock]="itemSinStock(item)">
                    {{ stockLabelCatalogo(item) }}
                  </p>
                </button>
              }
            </section>
          }
        } @else {
          <section class="productos-table-wrap">
            <div class="productos-table-head">
              <span>Tipo</span>
              <span>SKU</span>
              <span>Nombre</span>
              <span>Precio</span>
              <span>Stock</span>
              <span>Accion</span>
            </div>

            @for (item of catalogoFiltrado(); track item.tipo + '-' + item.id) {
              <div class="productos-table-row">
                <span>
                  <mat-chip [class.chip-producto]="item.tipo === 'PRODUCTO'" [class.chip-servicio]="item.tipo === 'SERVICIO'" [class.chip-receta]="item.tipo === 'RECETA'">
                    {{ item.tipo === 'PRODUCTO' ? 'Producto' : (item.tipo === 'RECETA' ? 'Receta' : 'Servicio') }}
                  </mat-chip>
                </span>
                <span class="cell-sku">{{ item.sku }}</span>
                <span class="cell-name">{{ item.nombre }}</span>
                <span>{{ item.precio | number:'1.2-2' }}</span>
                <span [class.sin-stock]="itemSinStock(item)">{{ stockLabelCatalogo(item) }}</span>
                <button mat-stroked-button type="button" (click)="agregarDesdeCatalogo(item)" [disabled]="itemSinStock(item)">
                  Agregar
                </button>
              </div>
            }
          </section>
        }
      </article>

      <article class="surface-card panel panel-right">
        <header class="panel-title">
          <h2>Cobro</h2>
          <p>Vendedor {{ vendedorNombre() }} · Sesion {{ sesionEstado() }}</p>
          <p>Almacen: {{ almacenActualNombre() }}</p>
        </header>

        <!-- Pestañas POS: el listado dentro del panel Cobro fue removido; se mantiene arriba. -->

        <section class="client-row">
          <mat-form-field appearance="outline" class="client-search">
            <mat-label>Buscar cliente</mat-label>
            <input matInput [formControl]="busquedaClienteControl" [matAutocomplete]="clientesAuto" placeholder="Nombre o identificacion" />
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="abrirClientePopup()">
            <mat-icon>person_add</mat-icon>
            Nuevo
          </button>

          <mat-autocomplete #clientesAuto="matAutocomplete" (optionSelected)="seleccionarCliente($event.option.value)">
            @for (cliente of clientesFiltrados(); track cliente.id) {
              <mat-option [value]="cliente">{{ cliente.nombreCompleto }} · {{ cliente.identificacion }}</mat-option>
            }
          </mat-autocomplete>
        </section>

        @if (state.carrito().clienteNombre) {
          <mat-chip-set>
            <mat-chip>
              {{ state.carrito().clienteNombre }}
              <button matChipRemove type="button" (click)="state.clearCliente()">
                <mat-icon>close</mat-icon>
              </button>
            </mat-chip>
          </mat-chip-set>
        }

        <section class="cart-list">
          @if (state.carrito().items.length === 0) {
            <p class="empty-label">No hay productos o servicios en el carrito.</p>
          } @else {
            @for (item of state.carrito().items; track item.itemTipo + '-' + item.productoId) {
              <div class="cart-row">
                <div>
                  <p class="cart-name">{{ item.nombre }}</p>
                  <p class="cart-meta">
                    {{ item.sku }} · {{ item.itemTipo === 'SERVICIO' ? 'Servicio' : (item.itemTipo === 'RECETA' ? 'Receta' : 'Producto') }}
                  </p>
                </div>

                <div class="cart-actions">
                  <button mat-icon-button type="button" (click)="decrementar(item.productoId, item.itemTipo)">
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span>{{ item.cantidad }}</span>
                  <button mat-icon-button type="button" (click)="incrementar(item.productoId, item.itemTipo)">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>

                @if (config().permitirDescuentos) {
                  <mat-form-field appearance="outline" class="desc-field">
                    <mat-label>Desc %</mat-label>
                    <input matInput type="number" [value]="item.descuentoItem" (input)="actualizarDescuentoItem(item.productoId, item.itemTipo, $event)" />
                  </mat-form-field>
                }

                <p class="row-total">{{ totalItem(item) | number:'1.2-2' }}</p>

                <button mat-icon-button type="button" color="warn" (click)="state.removerItem(item.productoId, item.itemTipo)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          }
        </section>

        <section class="totals">
          <mat-form-field appearance="outline">
            <mat-label>Descuento global %</mat-label>
            <input matInput type="number" [value]="state.carrito().descuentoGlobal" (input)="actualizarDescuentoGlobal($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <textarea matInput rows="3" [value]="state.carrito().notas" (input)="actualizarNotas($event)"></textarea>
          </mat-form-field>

          <div class="totals-grid">
            <p>Subtotal <strong>{{ subtotalConIva() | number:'1.2-2' }}</strong></p>
            <p>Descuento <strong>{{ descuentoTotalConIva() | number:'1.2-2' }}</strong></p>

            @for (iva of desgloseIva(); track iva.tasa) {
              <p>IVA {{ iva.tasa | number:'1.0-2' }}% <strong>{{ iva.monto | number:'1.2-2' }}</strong></p>
            }

            <p class="total-line">Total <strong>{{ total() | number:'1.2-2' }}</strong></p>
          </div>
        </section>

        <section class="payments">
          <header>
            <h3>Pagos</h3>
            <button mat-button type="button" (click)="state.agregarPago()">Agregar pago</button>
          </header>

          @for (pago of state.carrito().pagos; track $index) {
            <div class="payment-row">
              <mat-form-field appearance="outline">
                <mat-label>Metodo</mat-label>
                <mat-select [value]="pago.metodo" (selectionChange)="actualizarPagoMetodo($index, $event.value)">
                  @for (metodo of metodosPago(); track metodo) {
                    <mat-option [value]="metodo">{{ metodo }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Monto</mat-label>
                <input
                  matInput
                  type="number"
                  step="0.01"
                  min="0"
                  appTwoDecimalInput
                  [value]="pago.monto"
                  (change)="actualizarPagoMonto($index, $event)"
                  (blur)="actualizarPagoMonto($index, $event)"
                />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Referencia</mat-label>
                <input matInput [value]="pago.referencia" (input)="actualizarPagoReferencia($index, $event)" />
              </mat-form-field>

              <button mat-icon-button type="button" color="warn" (click)="state.removerPago($index)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }

          <p class="payments-balance" [class.error]="pagosDescuadrados()">
            Diferencia pagos: {{ balancePagos() | number:'1.2-2' }}
          </p>
        </section>

        <section class="cobro-rapido">
          <mat-form-field appearance="outline" class="recibido-field">
            <mat-label>Efectivo recibido</mat-label>
            <input matInput type="number" step="0.01" min="0" [value]="efectivoRecibido() ?? ''" (input)="setEfectivoRecibido($event)" />
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="efectivoExacto()">Exacto</button>
          @if (cambio() !== null) {
            <p class="cambio-line">Cambio <strong>{{ cambio() | number:'1.2-2' }}</strong></p>
          }
        </section>

        <section class="actions">
          <button mat-stroked-button type="button" (click)="limpiarCarrito()">Limpiar</button>
          @if (permiteDividir()) {
            <button mat-stroked-button type="button" [disabled]="cobrando()" (click)="dividirYCobrar()">
              <mat-icon>call_split</mat-icon>
              Dividir cuenta
            </button>
          }
          <button mat-raised-button color="primary" type="button" [disabled]="cobrando()" (click)="cobrar()">
            {{ cobrando() ? 'Cobrando...' : 'Cobrar' }}
          </button>
        </section>
      </article>
    </section>
    }
  `,
  styles: [`
    .pos-bloqueado {
      display: grid;
      place-items: center;
      min-height: 600px;
      padding: 2rem;
    }

    .bloqueado-contenido {
      display: grid;
      gap: 1.5rem;
      text-align: center;
      align-items: center;
      max-width: 500px;
    }

    .bloqueado-icono {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: var(--muted-foreground);
      opacity: .6;
    }

    .bloqueado-contenido h2 {
      margin: 0;
      font-size: 1.5rem;
    }

    .bloqueado-contenido p {
      margin: 0;
      color: var(--muted-foreground);
    }

    .bloqueado-contenido .subtitulo {
      font-size: .9rem;
      margin-top: .5rem;
    }

    .facturando-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: grid; place-items: center;
      background: color-mix(in srgb, #000 55%, transparent);
      backdrop-filter: blur(2px);
    }
    .facturando-card {
      display: grid; justify-items: center; gap: .6rem;
      padding: 1.75rem 2.25rem; border-radius: 14px;
      background: var(--mat-sys-surface, #fff); color: var(--mat-sys-on-surface, #1a1a1a);
      box-shadow: 0 12px 40px rgba(0,0,0,.35); text-align: center;
    }
    .facturando-titulo { margin: .25rem 0 0; font-weight: 700; font-size: 1.05rem; }
    .facturando-paso { margin: 0; color: var(--muted-foreground); font-size: .9rem; }
    .pos-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 1rem; }
    .panel { padding: 1rem; display: grid; gap: 1rem; align-content: start; }
    .panel-title h2 { margin: 0; }
    .panel-title p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .scan-bar { display: block; }
    .scan-field { width: 100%; }
    .scan-field mat-icon[matPrefix] { margin-right: .5rem; color: var(--primary); }
    .catalog-type-switch { display: inline-flex; flex-wrap: wrap; gap: .45rem; }
    .catalog-type-switch button.active { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .products-view-switch { display: inline-flex; gap: .5rem; }
    .products-view-switch button.active { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .products-result-label { margin: -.35rem 0 0; color: var(--muted-foreground); font-size: .88rem; }
    .productos-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .producto-card {
      border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent);
      border-radius: .9rem;
      background: linear-gradient(180deg, color-mix(in srgb, var(--tc-surface-container-low) 95%, white), var(--tc-surface-container-lowest));
      text-align: left;
      padding: .9rem;
      cursor: pointer;
      display: grid;
      gap: .6rem;
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
    }
    .producto-card:hover:not(:disabled) {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--primary) 45%, transparent);
      box-shadow: 0 8px 18px color-mix(in srgb, var(--primary) 12%, transparent);
    }
    .producto-card:disabled { opacity: .58; cursor: not-allowed; }
    .producto-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
    .producto-nombre { margin: 0; font-weight: 700; line-height: 1.2; }
    .stock-badge {
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .02em;
      padding: .2rem .5rem;
      color: #0f5132;
      background: #d1e7dd;
      white-space: nowrap;
    }
    .stock-badge.warn { color: #664d03; background: #fff3cd; }
    .stock-badge.danger { color: #842029; background: #f8d7da; }
    .stock-badge.service { color: #0b5394; background: #d8ebff; }
    .producto-meta { margin: 0; color: var(--muted-foreground); font-size: .83rem; }
    .producto-footer-row { display: flex; justify-content: space-between; align-items: flex-end; gap: .6rem; }
    .producto-price-label { margin: 0; color: var(--muted-foreground); font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; }
    .producto-precio { margin: .18rem 0 0; font-size: 1.18rem; font-weight: 700; }
    .producto-cta { display: inline-flex; align-items: center; gap: .3rem; font-weight: 600; color: var(--primary); }
    .producto-cta.disabled { color: var(--muted-foreground); }
    .producto-cta mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .producto-stock { margin: 0; color: #1f7a1f; font-size: .82rem; }
    .productos-empty {
      border: 1px dashed color-mix(in srgb, var(--outline) 45%, transparent);
      border-radius: .85rem;
      padding: 1.2rem;
      display: grid;
      place-items: center;
      gap: .4rem;
      color: var(--muted-foreground);
      text-align: center;
    }
    .productos-empty mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .productos-table-wrap { border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .75rem; overflow: hidden; }
    .productos-table-head, .productos-table-row { display: grid; grid-template-columns: .8fr .9fr 1.5fr .8fr .9fr auto; gap: .5rem; align-items: center; padding: .65rem .75rem; }
    .productos-table-head { background: color-mix(in srgb, var(--tc-surface-container-low) 92%, transparent); font-weight: 700; font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; }
    .productos-table-row { border-top: 1px solid color-mix(in srgb, var(--outline) 30%, transparent); }
    .cell-sku { color: var(--muted-foreground); font-size: .9rem; }
    .cell-name { font-weight: 600; }
    mat-chip.chip-producto { background: rgb(16 185 129 / 18%); }
    mat-chip.chip-servicio { background: rgb(59 130 246 / 20%); }
    mat-chip.chip-receta { background: rgb(249 115 22 / 20%); }
    .sin-stock { color: #b3261e; }
    .pos-tabs { border: 1px solid color-mix(in srgb, var(--outline) 35%, transparent); border-radius: .8rem; padding: .7rem; display: grid; gap: .55rem; grid-column: 1 / -1; }
    .pos-tabs-header { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; }
    .pos-tabs-header h3 { margin: 0; font-size: .95rem; }
    .pos-tabs-actions { display: inline-flex; gap: .5rem; flex-wrap: wrap; }
    .fullscreen-btn { color: var(--primary); }
    .pos-tabs-list { display: flex; gap: .5rem; overflow-x: auto; padding-bottom: .2rem; }
    .cuentas-abiertas { display: flex; align-items: center; flex-wrap: wrap; gap: .4rem; padding-top: .3rem; border-top: 1px dashed color-mix(in srgb, var(--outline) 40%, transparent); }
    .cuentas-abiertas-label { font-size: .82rem; color: var(--muted-foreground); font-weight: 600; }
    .cuenta-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .3rem .2rem .55rem; border-radius: 999px; cursor: pointer; background: color-mix(in srgb, var(--primary) 10%, transparent); border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); }
    .cuenta-chip:hover { background: color-mix(in srgb, var(--primary) 16%, transparent); }
    .cuenta-chip mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--primary); }
    .cuenta-nombre { font-weight: 600; font-size: .85rem; }
    .cuenta-count { min-width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; background: color-mix(in srgb, var(--primary) 22%, transparent); color: var(--primary); padding: 0 .3rem; }
    .pos-tab {
      min-width: 210px;
      border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent);
      border-radius: .7rem;
      background: color-mix(in srgb, var(--tc-surface-container-low) 92%, transparent);
      padding: .35rem .4rem;
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      align-items: center;
      gap: .2rem;
      cursor: pointer;
    }
    .pos-tab.active {
      border-color: color-mix(in srgb, var(--primary) 55%, transparent);
      background: color-mix(in srgb, var(--primary) 10%, var(--tc-surface-container-low));
    }
    .pos-tab-title { text-align: left; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pos-tab-input {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--outline) 50%, transparent);
      border-radius: .45rem;
      padding: .3rem .45rem;
      font: inherit;
      background: var(--tc-surface-container-lowest);
      color: inherit;
    }
    .pos-tab-count {
      min-width: 24px;
      height: 24px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: .75rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--primary) 18%, transparent);
      color: var(--primary);
      padding: 0 .35rem;
    }
    .client-row { display: grid; grid-template-columns: 1fr auto; gap: .6rem; align-items: center; }
    .client-search { grid-column: 1 / 2; }
    .cart-list { display: grid; gap: .5rem; }
    .cart-row { display: grid; grid-template-columns: 1fr auto auto auto auto; gap: .5rem; align-items: center; border: 1px solid color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .7rem; padding: .55rem; }
    .cart-name { margin: 0; font-weight: 600; }
    .cart-meta { margin: .2rem 0 0; color: var(--muted-foreground); font-size: .85rem; }
    .cart-actions { display: inline-flex; gap: .2rem; align-items: center; }
    .desc-field { width: 120px; }
    .row-total { margin: 0; font-weight: 700; }
    .totals { display: grid; gap: .5rem; }
    .totals-grid { border: 1px dashed color-mix(in srgb, var(--outline) 45%, transparent); border-radius: .65rem; padding: .6rem .75rem; display: grid; gap: .25rem; }
    .totals-grid p { margin: 0; display: flex; justify-content: space-between; }
    .total-line { font-size: 1.08rem; border-top: 1px dashed color-mix(in srgb, var(--outline) 45%, transparent); padding-top: .25rem; margin-top: .15rem; }
    .payments { display: grid; gap: .5rem; }
    .payments header { display: flex; justify-content: space-between; align-items: center; }
    .payments h3 { margin: 0; }
    .payment-row { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: .5rem; align-items: center; }
    .payments-balance { margin: 0; font-size: .9rem; color: var(--muted-foreground); }
    .payments-balance.error { color: #b3261e; font-weight: 600; }
    .cobro-rapido { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .recibido-field { width: 160px; }
    .cambio-line { margin: 0; font-size: 1.05rem; }
    .cambio-line strong { color: #1f7a1f; }
    .actions { display: flex; justify-content: flex-end; gap: .6rem; }
    .empty-label { color: var(--muted-foreground); margin: 0; }
    @media (max-width: 1180px) {
      .pos-grid { grid-template-columns: 1fr; }
      .payment-row { grid-template-columns: 1fr; }
      .cart-row { grid-template-columns: 1fr auto; }
      .desc-field { width: 100%; }
      .productos-table-head, .productos-table-row { grid-template-columns: 1fr; }
      .products-view-switch { width: 100%; }
      .products-view-switch button { flex: 1; }
      .pos-tabs-header { flex-direction: column; align-items: stretch; }
      .pos-tab { min-width: 100%; }
    }
  `]
})
export class VentasPosComponent {
  protected readonly state = inject(VentasPosStateService);
  private readonly productosService = inject(ProductosService);
  private readonly serviciosService = inject(ServiciosService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly kardexService = inject(KardexService);
  private readonly ventasService = inject(VentasService);
  private readonly recetasService = inject(RecetasService);
  private readonly ventasConfig = inject(VentasConfigService);
  private readonly posConfig = inject(VentasPosConfigService);
  private readonly cuentasAbiertasService = inject(CuentasAbiertasService);
  private readonly facturaService = inject(FacturaService);
  protected readonly immersiveService = inject(PosImmersiveService);
  private readonly facturacionService = inject(FacturacionConfigService);
  private readonly clientesService = inject(ClientesService);
  private readonly configClientes = inject(ConfiguracionClientesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly almacenSesionService = inject(VentasAlmacenSesionService);

  protected readonly busquedaProductoControl = new FormControl('', { nonNullable: true });
  protected readonly busquedaClienteControl = new FormControl('', { nonNullable: true });
  private readonly busquedaProducto = toSignal(
    this.busquedaProductoControl.valueChanges.pipe(startWith(this.busquedaProductoControl.value)),
    { initialValue: this.busquedaProductoControl.value }
  );
  private readonly busquedaCliente = toSignal(
    this.busquedaClienteControl.valueChanges.pipe(startWith(this.busquedaClienteControl.value)),
    { initialValue: this.busquedaClienteControl.value }
  );
  protected readonly tabNombreControl = new FormControl('', { nonNullable: true });
  protected readonly scanControl = new FormControl('', { nonNullable: true });
  protected readonly productos = signal<Producto[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly stockPorAlmacen = signal<Record<string, number>>({});
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly almacenSeleccionadoId = signal<string | null>(null);
  protected readonly config = signal({
    permitirVentaSinStock: false,
    permitirDescuentos: true,
    descuentoMaximo: 50,
    diasParaReverso: 30,
    impuestoPorDefecto: 12,
    prefijoPOS: 'VEN-',
    mostrarCosto: false,
    monedaBase: 'USD'
  });
  protected readonly camposPersonalizadosClientes = signal([] as ClienteDialogData['camposPersonalizados']);
  protected readonly sesionActiva = signal<SesionCaja | null>(null);
  protected readonly cobrando = signal(false);
  // Progreso de facturación automática (overlay bloqueante mientras emite al SRI).
  protected readonly facturandoPaso = signal<string>('');
  // Cobro rápido en efectivo: cálculo de cambio (solo visual, no altera los pagos).
  protected readonly efectivoRecibido = signal<number | null>(null);
  protected readonly cambio = computed(() => {
    const recibido = this.efectivoRecibido();
    if (recibido === null) {
      return null;
    }
    return this.roundToTwo(Math.max(0, recibido - this.total()));
  });
  protected readonly cargandoAlmacenes = signal(true);
  protected readonly vistaProductos = signal<'cards' | 'table'>('cards');
  protected readonly filtroCatalogo = signal<'TODOS' | 'PRODUCTOS' | 'SERVICIOS'>('TODOS');
  protected readonly tabEditandoId = signal<string | null>(null);

  // Perfil de POS del almacén activo (modo RETAIL/RESTAURANTE + opciones de flujo)
  protected readonly perfil = signal<PerfilPos | null>(null);
  private perfilVistaAplicada = false;
  private perfilSub?: Subscription;
  protected readonly immersive = this.immersiveService.immersive;
  protected readonly modoPos = computed<ModoPos>(() => this.perfil()?.modo ?? 'RETAIL');
  protected readonly esRestaurante = computed(() => this.modoPos() === 'RESTAURANTE');
  protected readonly etiquetaCuenta = computed(() => this.perfil()?.etiquetaCuenta?.trim() || 'Cuenta');
  protected readonly tituloCuentas = computed(() =>
    this.esRestaurante() ? `${this.etiquetaCuenta()}s abiertas` : 'Pestañas POS'
  );
  protected readonly permiteCuentasAbiertas = computed(
    () => this.esRestaurante() && this.perfil()?.permitirCuentasAbiertas === true
  );
  protected readonly permiteDividir = computed(
    () => this.esRestaurante() && this.perfil()?.permitirDividirCuenta === true
  );
  protected readonly cuentasAbiertas = signal<CuentaAbierta[]>([]);
  private cuentasSub?: Subscription;
  private readonly avisoSinAlmacenesMostrado = signal(false);
  protected readonly sineAlmacenesPermitidos = computed(
    () => this.cargandoAlmacenes() === false && !this.almacenSesionService.tieneAlmacenesPermitidos()
  );

  protected readonly vendedorNombre = computed(() => this.auth.currentUser()?.displayName ?? 'Sin nombre');
  protected readonly sesionEstado = computed(() => (this.sesionActiva() ? 'ACTIVA' : 'PENDIENTE'));
  protected readonly almacenActualNombre = computed(() => {
    const almacenId = this.sesionActiva()?.almacenId ?? this.almacenSeleccionadoId();
    if (!almacenId) {
      return 'Sin asignar';
    }

    const almacen = this.almacenes().find((item) => item.id === almacenId);
    return almacen?.nombre ?? almacenId;
  });
  protected readonly subtotalConIva = computed(() =>
    this.state.carrito().items.reduce((acum, item) => {
      const base = item.precioUnitario * item.cantidad;
      const descuentoItem = Math.min(base, base * (item.descuentoItem / 100));
      return this.roundToTwo(acum + (base - descuentoItem));
    }, 0)
  );

  protected readonly descuentoGlobalMonto = computed(() =>
    this.roundToTwo(Math.max(0, this.subtotalConIva() * (this.state.carrito().descuentoGlobal / 100)))
  );

  protected readonly descuentoTotalConIva = computed(() => {
    const descuentoItems = this.state.carrito().items.reduce((acum, item) => {
      const base = item.precioUnitario * item.cantidad;
      return acum + Math.min(base, base * (item.descuentoItem / 100));
    }, 0);

    return this.roundToTwo(descuentoItems + this.descuentoGlobalMonto());
  });

  protected readonly desgloseIva = computed(() => {
    const subtotal = this.subtotalConIva();
    const grouped = new Map<number, number>();

    this.state.carrito().items.forEach((item) => {
      const baseBruta = item.precioUnitario * item.cantidad;
      const descuentoItem = Math.min(baseBruta, baseBruta * (item.descuentoItem / 100));
      const baseNeta = this.roundToTwo(Math.max(0, baseBruta - descuentoItem));
      const proporcion = subtotal > 0 ? baseNeta / subtotal : 0;
      const descuentoGlobalItem = this.roundToTwo(this.descuentoGlobalMonto() * proporcion);
      const baseImponible = this.roundToTwo(Math.max(0, baseNeta - descuentoGlobalItem));
      const tasa = Number.isFinite(item.ivaPorcentaje) ? Math.max(0, item.ivaPorcentaje) : 0;
      const impuestoItem = this.roundToTwo(baseImponible * (tasa / 100));

      grouped.set(tasa, this.roundToTwo((grouped.get(tasa) ?? 0) + impuestoItem));
    });

    return Array.from(grouped.entries())
      .map(([tasa, monto]) => ({ tasa, monto: this.roundToTwo(monto) }))
      .sort((a, b) => b.tasa - a.tasa);
  });

  protected readonly impuesto = computed(() =>
    this.roundToTwo(this.desgloseIva().reduce((acum, row) => acum + row.monto, 0))
  );

  protected readonly total = computed(() =>
    this.roundToTwo(Math.max(0, this.subtotalConIva() - this.descuentoGlobalMonto()) + this.impuesto())
  );
  protected readonly pagosDescuadrados = computed(() => Math.abs(this.balancePagos()) > 0.01);
  protected readonly catalogoBase = computed<CatalogoPosItem[]>(() => {
    const productos = this.productos().map((producto) => this.mapProductoItem(producto)).filter((item) => !!item.id);
    const servicios = this.servicios().map((servicio) => this.mapServicioItem(servicio)).filter((item) => !!item.id);
    return [...productos, ...servicios];
  });

  protected readonly catalogoFiltrado = computed(() => {
    const query = this.busquedaProducto().trim().toLowerCase();
    const byTipo = this.catalogoBase().filter((item) => {
      if (this.filtroCatalogo() === 'PRODUCTOS') {
        return item.tipo === 'PRODUCTO' || item.tipo === 'RECETA';
      }

      if (this.filtroCatalogo() === 'SERVICIOS') {
        return item.tipo === 'SERVICIO';
      }

      return true;
    });

    if (!query) {
      return byTipo.slice(0, 40);
    }

    return byTipo.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.codigoBarras?.toLowerCase().includes(query) ?? false)
      );
    });
  });
  protected readonly clientesFiltrados = computed(() => {
    const query = this.busquedaCliente().trim().toLowerCase();

    if (!query) {
      return this.clientes().slice(0, 20);
    }

    return this.clientes().filter((cliente) =>
      cliente.nombreCompleto.toLowerCase().includes(query) ||
      cliente.identificacion.toLowerCase().includes(query)
    );
  });
  protected readonly metodosPago = signal<string[]>([]);

  private readonly syncMontoPagoUnicoConTotal = effect(
    () => {
      const pagos = this.state.carrito().pagos;
      const total = this.total();

      if (pagos.length !== 1) {
        return;
      }

      const montoActual = Number(pagos[0]?.monto ?? 0);
      if (Math.abs(montoActual - total) <= 0.01) {
        return;
      }

      this.state.setPagos([
        {
          ...pagos[0],
          monto: this.roundToTwo(total)
        }
      ]);
    },
    { allowSignalWrites: true }
  );

  private readonly syncBusquedaClienteConPestana = effect(() => {
    const nombreCliente = this.state.carrito().clienteNombre ?? '';
    if (this.busquedaClienteControl.value !== nombreCliente) {
      this.busquedaClienteControl.setValue(nombreCliente);
    }
  });

  private readonly syncAlmacenSesionConPos = effect(() => {
    const almacenesPermitidos = this.almacenSesionService.almacenesPermitidosSignal();
    const almacenSeleccionado = this.almacenSesionService.almacenSeleccionado();

    if (this.cargandoAlmacenes()) {
      return;
    }

    if (almacenSeleccionado?.id) {
      if (this.almacenSeleccionadoId() !== almacenSeleccionado.id) {
        this.almacenSeleccionadoId.set(almacenSeleccionado.id);
        this.iniciarSesionYStock();
      }
      return;
    }

    if (almacenesPermitidos.length === 0 && !this.avisoSinAlmacenesMostrado()) {
      this.avisoSinAlmacenesMostrado.set(true);
      this.snackBar.open('No tienes almacenes asignados. Contacta a tu administrador.', 'Ir a Configuración', {
        duration: 0,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      }).onAction().subscribe(() => {
        this.router.navigate(['/workspace/ventas/configuracion']);
      });
    }
  }, { allowSignalWrites: true });

  constructor() {
    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => this.productos.set(productos.filter((item) => item.activo)));

    this.serviciosService
      .getServicios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((servicios) => this.servicios.set(servicios.filter((item) => item.activo)));

    // Cargar almacenes y usar la selección persistida del usuario
    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);
        this.cargandoAlmacenes.set(false);
      });

    this.ventasConfig
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((configuracion) => this.config.set(configuracion));

    this.facturacionService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        const formas = (config.formaPagoActivos ?? []).filter((f) => typeof f === 'string' && f.trim().length > 0);
        this.metodosPago.set(formas.length ? formas : ['EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'QR', 'CREDITO_CLIENTE']);
      });

    this.clientesService
      .getClientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((clientes) => this.clientes.set(clientes));

    this.configClientes
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((configuracion) => this.camposPersonalizadosClientes.set(configuracion.camposPersonalizados));

    // Al salir del POS, restaurar el chrome de la app si quedó en pantalla completa.
    this.destroyRef.onDestroy(() => {
      if (this.immersive()) {
        void this.immersiveService.desactivar();
      }
    });
  }

  protected stockProducto(productoId?: string): number {
    if (!productoId) {
      return 0;
    }

    return this.stockPorAlmacen()[productoId] ?? 0;
  }

  private mapProductoItem(producto: Producto): CatalogoPosItem {
    const esReceta = producto.tipo === 'RECETA';
    return {
      id: producto.id ?? '',
      tipo: esReceta ? 'RECETA' : 'PRODUCTO',
      sku: producto.sku,
      codigoBarras: producto.codigoBarras?.trim() || undefined,
      nombre: producto.nombre,
      precio: Number(producto.precioVenta ?? 0),
      costoUnitario: Number(producto.precioCosto ?? 0),
      impuestoPorcentaje: Number.isFinite(producto.ivaPorcentaje)
        ? Math.max(0, Number(producto.ivaPorcentaje))
        : this.config().impuestoPorDefecto,
      stock: esReceta ? this.stockRecetaAproximado(producto) : this.stockProducto(producto.id),
      permitirInventarioNegativo: esReceta && producto.permitirInventarioNegativo === true
    };
  }

  private mapServicioItem(servicio: Servicio): CatalogoPosItem {
    return {
      id: servicio.id ?? '',
      tipo: 'SERVICIO',
      sku: `SRV-${(servicio.id ?? '').slice(0, 8).toUpperCase()}`,
      nombre: servicio.nombre,
      precio: Number(servicio.precio ?? 0),
      costoUnitario: 0,
      impuestoPorcentaje: Number.isFinite(servicio.impuestoPorcentaje)
        ? Math.max(0, Number(servicio.impuestoPorcentaje))
        : this.config().impuestoPorDefecto,
      stock: null
    };
  }

  protected seleccionarFiltroCatalogo(filtro: 'TODOS' | 'PRODUCTOS' | 'SERVICIOS'): void {
    this.filtroCatalogo.set(filtro);
  }

  protected esServicio(item: CatalogoPosItem): boolean {
    return item.tipo === 'SERVICIO';
  }

  protected esReceta(item: CatalogoPosItem): boolean {
    return item.tipo === 'RECETA';
  }

  protected stockLabelCatalogo(item: CatalogoPosItem): string {
    if (item.tipo === 'SERVICIO') {
      return 'Sin control de stock';
    }

    if (item.tipo === 'RECETA') {
      const disponible = Math.max(0, Number(item.stock ?? 0));
      return `Aprox. disponibles: ${disponible}`;
    }

    return `Stock: ${item.stock ?? 0}`;
  }

  protected itemSinStock(item: CatalogoPosItem): boolean {
    if (item.tipo === 'SERVICIO') {
      return false;
    }

    if (this.config().permitirVentaSinStock) {
      return false;
    }

    if (item.tipo === 'RECETA' && item.permitirInventarioNegativo === true) {
      return false;
    }

    return (item.stock ?? 0) <= 0;
  }

  protected stockBajoCatalogo(item: CatalogoPosItem): boolean {
    if (item.tipo === 'SERVICIO') {
      return false;
    }

    const stock = item.stock ?? 0;
    const limite = item.tipo === 'RECETA' ? 2 : 5;
    return stock > 0 && stock <= limite;
  }

  protected etiquetaStockCatalogo(item: CatalogoPosItem): string {
    if (item.tipo === 'SERVICIO') {
      return 'Servicio';
    }

    if (this.itemSinStock(item)) {
      return item.tipo === 'RECETA' ? 'Agotado' : 'Sin stock';
    }

    if (this.stockBajoCatalogo(item)) {
      return item.tipo === 'RECETA' ? 'Stock receta bajo' : 'Stock bajo';
    }

    if (item.tipo === 'RECETA' && item.permitirInventarioNegativo === true && (item.stock ?? 0) <= 0) {
      return 'Agotado (override)';
    }

    return 'Disponible';
  }

  /**
   * Procesa una lectura del lector físico. Acepta un multiplicador de cantidad
   * (p.ej. "3*7501234567890" o "3x7501...") y busca por código de barras o SKU.
   */
  protected escanear(): void {
    const raw = this.scanControl.value.trim();
    this.scanControl.setValue('');
    if (!raw) {
      return;
    }

    let cantidad = 1;
    let code = raw;
    const multiplicador = raw.match(/^(\d+)\s*[*x]\s*(.+)$/i);
    if (multiplicador) {
      cantidad = Math.max(1, Math.min(999, Number.parseInt(multiplicador[1], 10)));
      code = multiplicador[2].trim();
    }

    const item = this.buscarPorCodigo(code);
    if (!item) {
      this.snackBar.open(`Sin coincidencias para "${code}".`, 'Cerrar', { duration: 2200 });
      return;
    }

    // Si el perfil no auto-agrega, solo filtra el catálogo para selección manual.
    if (this.perfil()?.autoAgregarAlEscanear === false) {
      this.busquedaProductoControl.setValue(item.nombre);
      return;
    }

    for (let i = 0; i < cantidad; i += 1) {
      this.agregarDesdeCatalogo(item);
    }
  }

  /** Busca un ítem del catálogo por código de barras exacto o, en su defecto, por SKU. */
  private buscarPorCodigo(code: string): CatalogoPosItem | null {
    const lower = code.toLowerCase();
    const porBarras = this.catalogoBase().find(
      (item) => item.codigoBarras && item.codigoBarras.toLowerCase() === lower
    );
    if (porBarras) {
      return porBarras;
    }

    return this.catalogoBase().find((item) => item.sku.toLowerCase() === lower) ?? null;
  }

  protected agregarDesdeCatalogo(item: CatalogoPosItem): void {
    if (item.tipo === 'SERVICIO') {
      this.agregarServicio(item);
      return;
    }

    if (item.tipo === 'RECETA') {
      this.agregarReceta(item);
      return;
    }

    this.agregarProducto(item);
  }

  protected productoSinStock(producto: Producto): boolean {
    return !this.config().permitirVentaSinStock && this.stockProducto(producto.id) <= 0;
  }

  protected stockBajo(producto: Producto): boolean {
    const stock = this.stockProducto(producto.id);
    return stock > 0 && stock <= 5;
  }

  protected etiquetaStock(producto: Producto): string {
    if (this.productoSinStock(producto)) {
      return 'Sin stock';
    }

    if (this.stockBajo(producto)) {
      return 'Stock bajo';
    }

    return 'Disponible';
  }

  protected agregarProducto(producto: CatalogoPosItem): void {
    if (!producto.id) {
      return;
    }

    const stock = this.stockProducto(producto.id);
    const itemActual = this.state.carrito().items.find((item) => item.productoId === producto.id && item.itemTipo === 'PRODUCTO');
    const cantidadObjetivo = (itemActual?.cantidad ?? 0) + 1;

    if (!this.config().permitirVentaSinStock && cantidadObjetivo > stock) {
      this.snackBar.open('Stock insuficiente para este producto.', 'Cerrar', { duration: 2000 });
      return;
    }

    this.state.agregarItem({
      itemTipo: 'PRODUCTO',
      productoId: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      cantidad: 1,
      precioUnitario: Number(producto.precio ?? 0),
      costoUnitario: Number(producto.costoUnitario ?? 0),
      descuentoItem: 0,
      ivaPorcentaje: Number.isFinite(producto.impuestoPorcentaje)
        ? Math.max(0, producto.impuestoPorcentaje)
        : this.config().impuestoPorDefecto,
      stockDisponible: stock
    });
  }

  protected agregarServicio(servicio: CatalogoPosItem): void {
    if (!servicio.id) {
      return;
    }

    this.state.agregarItem({
      itemTipo: 'SERVICIO',
      productoId: servicio.id,
      sku: servicio.sku,
      nombre: servicio.nombre,
      cantidad: 1,
      precioUnitario: Number(servicio.precio ?? 0),
      costoUnitario: 0,
      descuentoItem: 0,
      ivaPorcentaje: Number.isFinite(servicio.impuestoPorcentaje)
        ? Math.max(0, servicio.impuestoPorcentaje)
        : this.config().impuestoPorDefecto,
      stockDisponible: Number.MAX_SAFE_INTEGER
    });
  }

  protected agregarReceta(receta: CatalogoPosItem): void {
    if (!receta.id) {
      return;
    }

    const stock = Math.max(0, Number(receta.stock ?? 0));
    const itemActual = this.state.carrito().items.find((item) => item.productoId === receta.id && item.itemTipo === 'RECETA');
    const cantidadObjetivo = (itemActual?.cantidad ?? 0) + 1;
    const puedeOverride = receta.permitirInventarioNegativo === true || this.config().permitirVentaSinStock;

    if (!puedeOverride && cantidadObjetivo > stock) {
      this.snackBar.open('Receta agotada por falta de insumos.', 'Cerrar', { duration: 2200 });
      return;
    }

    this.state.agregarItem({
      itemTipo: 'RECETA',
      productoId: receta.id,
      sku: receta.sku,
      nombre: receta.nombre,
      cantidad: 1,
      precioUnitario: Number(receta.precio ?? 0),
      costoUnitario: Number(receta.costoUnitario ?? 0),
      descuentoItem: 0,
      ivaPorcentaje: Number.isFinite(receta.impuestoPorcentaje)
        ? Math.max(0, receta.impuestoPorcentaje)
        : this.config().impuestoPorDefecto,
      stockDisponible: stock,
      permitirInventarioNegativo: receta.permitirInventarioNegativo === true
    });
  }

  protected incrementar(productoId: string, itemTipo: VentaItemTipo): void {
    const item = this.state.carrito().items.find((current) => current.productoId === productoId && current.itemTipo === itemTipo);
    if (!item) {
      return;
    }

    if (
      item.itemTipo !== 'SERVICIO' &&
      !this.config().permitirVentaSinStock &&
      item.permitirInventarioNegativo !== true &&
      item.cantidad + 1 > item.stockDisponible
    ) {
      this.snackBar.open('No puedes exceder el stock disponible.', 'Cerrar', { duration: 2000 });
      return;
    }

    this.state.actualizarCantidad(productoId, item.cantidad + 1, itemTipo);
  }

  protected decrementar(productoId: string, itemTipo: VentaItemTipo): void {
    const item = this.state.carrito().items.find((current) => current.productoId === productoId && current.itemTipo === itemTipo);
    if (!item) {
      return;
    }

    if (item.cantidad <= 1) {
      this.state.removerItem(productoId, itemTipo);
      return;
    }

    this.state.actualizarCantidad(productoId, item.cantidad - 1, itemTipo);
  }

  protected actualizarDescuentoItem(productoId: string, itemTipo: VentaItemTipo, event: Event): void {
    const rawValue = Number((event.target as HTMLInputElement).value);
    const descuento = Math.max(0, Math.min(this.config().descuentoMaximo, rawValue));
    this.state.actualizarDescuentoItem(productoId, descuento, itemTipo);
  }

  protected actualizarDescuentoGlobal(event: Event): void {
    const rawValue = Number((event.target as HTMLInputElement).value);
    this.state.setDescuentoGlobal(rawValue);
  }

  protected actualizarNotas(event: Event): void {
    this.state.setNotas((event.target as HTMLInputElement).value);
  }

  protected abrirClientePopup(): void {
    const dialogRef = this.dialog.open(ClienteFormDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      data: {
        camposPersonalizados: this.camposPersonalizadosClientes() ?? [],
        modo: 'popup'
      } satisfies ClienteDialogData
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado?.cliente) {
        return;
      }

      this.state.setCliente(resultado.cliente);
      this.busquedaClienteControl.setValue(resultado.cliente.nombreCompleto);

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Cliente vinculado a la venta.', icon: 'person' },
        duration: 2500,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    });
  }

  protected seleccionarCliente(cliente: Cliente): void {
    this.state.setCliente(cliente);
    this.busquedaClienteControl.setValue(cliente.nombreCompleto);
  }

  protected actualizarPagoMetodo(index: number, metodo: string): void {
    const pagos = [...this.state.carrito().pagos];
    pagos[index] = { ...pagos[index], metodo: metodo as MetodoPagoVenta };
    this.state.setPagos(pagos);
  }

  protected actualizarPagoMonto(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const pagos = [...this.state.carrito().pagos];
    pagos[index] = {
      ...pagos[index],
      monto: this.roundToTwo(Math.max(0, parsed))
    };
    this.state.setPagos(pagos);
  }

  protected actualizarPagoReferencia(index: number, event: Event): void {
    const pagos = [...this.state.carrito().pagos];
    pagos[index] = {
      ...pagos[index],
      referencia: (event.target as HTMLInputElement).value
    };
    this.state.setPagos(pagos);
  }

  protected cambiarVistaProductos(vista: 'cards' | 'table'): void {
    this.vistaProductos.set(vista);
  }

  protected agregarPestanaPos(): void {
    const tabId = this.state.agregarTab();
    this.tabEditandoId.set(null);
    this.state.seleccionarTab(tabId);
  }

  protected seleccionarPestana(tabId: string): void {
    this.tabEditandoId.set(null);
    this.state.seleccionarTab(tabId);
  }

  protected iniciarEdicionPestana(tabId: string, nombre: string, event: Event): void {
    event.stopPropagation();
    this.tabNombreControl.setValue(nombre);
    this.tabEditandoId.set(tabId);
  }

  protected confirmarEdicionPestana(): void {
    const tabId = this.tabEditandoId();
    if (!tabId) {
      return;
    }

    this.state.renombrarTab(tabId, this.tabNombreControl.value);
    this.tabEditandoId.set(null);
  }

  protected cancelarEdicionPestana(): void {
    this.tabEditandoId.set(null);
  }

  protected cerrarPestana(tabId: string, event: Event): void {
    event.stopPropagation();
    this.tabEditandoId.set(null);
    this.state.cerrarTab(tabId);
  }

  protected balancePagos(): number {
    const totalPagos = this.roundToTwo(this.state.carrito().pagos.reduce((acum, pago) => acum + Number(pago.monto || 0), 0));
    return this.roundToTwo(totalPagos - this.total());
  }

  protected totalItem(item: { precioUnitario: number; cantidad: number; descuentoItem: number }): number {
    const base = item.precioUnitario * item.cantidad;
    const descuento = Math.min(base, base * (item.descuentoItem / 100));
    return base - descuento;
  }

  protected limpiarCarrito(): void {
    this.state.limpiar();
    this.busquedaClienteControl.setValue('');
    this.efectivoRecibido.set(null);
  }

  protected setEfectivoRecibido(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.efectivoRecibido.set(Number.isFinite(raw) && raw > 0 ? this.roundToTwo(raw) : null);
  }

  /** Botón de efectivo exacto: iguala lo recibido al total (cambio 0). */
  protected efectivoExacto(): void {
    this.efectivoRecibido.set(this.total());
  }

  protected async cobrar(): Promise<void> {
    if (this.state.carrito().items.length === 0) {
      this.snackBar.open('Agrega productos o servicios al carrito.', 'Cerrar', { duration: 2200 });
      return;
    }

    if (Math.abs(this.balancePagos()) > 0.01) {
      this.snackBar.open('La suma de pagos debe coincidir con el total.', 'Cerrar', { duration: 2300 });
      return;
    }

    const sesion = this.sesionActiva();
    if (!sesion?.almacenId) {
      this.snackBar.open('No hay almacen activo para validar disponibilidad.', 'Cerrar', { duration: 2300 });
      return;
    }

    const recetasConFaltantes: Array<{
      nombre: string;
      faltante: number;
      permite: boolean;
      detalle: string;
    }> = [];

    for (const item of this.state.carrito().items) {
      if (item.itemTipo !== 'RECETA') {
        continue;
      }

      const permite = item.permitirInventarioNegativo === true || this.config().permitirVentaSinStock;
      const validacion = await this.recetasService.validarRecetaParaVenta(
        item.productoId,
        sesion.almacenId,
        item.cantidad,
        permite
      );

      if (validacion.faltantes.length === 0) {
        continue;
      }

      const faltanteRecetas = Math.max(0, item.cantidad - validacion.disponible);
      const detalle = validacion.faltantes
        .map((faltante) => `${faltante.nombre}: falta ${this.roundToTwo(faltante.faltante)} unidad(es)`)
        .join(' | ');

      recetasConFaltantes.push({
        nombre: item.nombre,
        faltante: faltanteRecetas,
        permite,
        detalle
      });
    }

    const recetaNoAutorizada = recetasConFaltantes.find((item) => !item.permite);
    if (recetaNoAutorizada) {
      this.snackBar.open(`Receta agotada: ${recetaNoAutorizada.nombre}. ${recetaNoAutorizada.detalle}`, 'Cerrar', { duration: 6000 });
      return;
    }

    if (recetasConFaltantes.length > 0) {
      const detalle = recetasConFaltantes
        .map((item) => `${item.nombre} (faltante recetas: ${this.roundToTwo(item.faltante)}) -> ${item.detalle}`)
        .join(', ');
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Confirmar venta con faltantes',
          message: `Estas recetas no tienen stock completo de insumos: ${detalle}. ¿Confirmas vender con inventario negativo?`,
          confirmText: 'Confirmar venta',
          cancelText: 'Cancelar'
        }
      });
      const confirmado = await firstValueFrom(dialogRef.afterClosed());

      if (!confirmado) {
        return;
      }
    }

    const user = this.auth.currentUser();
    if (!user || !sesion?.id) {
      this.snackBar.open('No hay una sesion de caja activa.', 'Cerrar', { duration: 2300 });
      return;
    }

    this.cobrando.set(true);

    try {
      const ventaId = await this.ventasService.confirmarVenta({
        sesionId: sesion.id,
        almacenId: sesion.almacenId,
        vendedorId: user.uid,
        vendedorNombre: user.displayName ?? 'Sin nombre',
        clienteId: this.state.carrito().clienteId,
        clienteNombre: this.state.carrito().clienteNombre ?? 'CLIENTE FINAL',
        items: this.state.carrito().items,
        pagos: this.state.carrito().pagos,
        descuentoGlobal: this.state.carrito().descuentoGlobal,
        impuestoPorcentaje: this.config().impuestoPorDefecto,
        notas: this.state.carrito().notas
      });

      this.state.limpiar();
      this.busquedaClienteControl.setValue('');
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Venta confirmada correctamente.', icon: 'point_of_sale' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      // Facturación automática al SRI (si el perfil del almacén lo tiene activado).
      if (this.perfil()?.facturacionAutomatica) {
        const resultado = await this.emitirFacturaAuto(ventaId, sesion.almacenId);
        if (resultado === 'SIN_CONFIG') {
          this.snackBar.open('Venta creada. Sin firma configurada: factúrala luego desde el detalle.', 'Cerrar', { duration: 3500 });
        }
      }

      await this.router.navigate(['/workspace/ventas/resumen', ventaId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la venta.';
      this.snackBar.open(message, 'Cerrar', { duration: 2800 });
    } finally {
      this.cobrando.set(false);
    }
  }

  /** Retiene el carrito activo como cuenta abierta compartida y libera la caja. */
  protected async retenerCuenta(): Promise<void> {
    const carrito = this.state.carrito();
    if (carrito.items.length === 0) {
      this.snackBar.open(`No hay productos en la ${this.etiquetaCuenta().toLowerCase()}.`, 'Cerrar', { duration: 2200 });
      return;
    }

    const almacenId = this.sesionActiva()?.almacenId ?? this.almacenSeleccionadoId();
    const user = this.auth.currentUser();
    if (!almacenId || !user) {
      return;
    }

    const activeTab = this.state.activeTab();
    const cuenta: CuentaAbierta = {
      id: activeTab?.id ?? `cuenta-${Date.now()}`,
      almacenId,
      etiqueta: activeTab?.nombre?.trim() || `${this.etiquetaCuenta()} ${this.cuentasAbiertas().length + 1}`,
      carrito,
      abiertaPor: user.uid,
      abiertaPorNombre: user.displayName ?? 'Sin nombre',
      abiertaEn: Date.now(),
      actualizadoEn: Date.now()
    };

    try {
      await this.cuentasAbiertasService.guardarCuenta(cuenta);
      this.state.limpiar();
      this.busquedaClienteControl.setValue('');
      this.snackBar.open(`${this.etiquetaCuenta()} retenida.`, 'Cerrar', { duration: 2200 });
    } catch {
      this.snackBar.open('No se pudo retener la cuenta.', 'Cerrar', { duration: 2600 });
    }
  }

  /** Retoma una cuenta abierta en la pestaña activa y la reclama (la elimina del compartido). */
  protected async resumirCuenta(cuenta: CuentaAbierta): Promise<void> {
    if (this.state.carrito().items.length > 0) {
      this.snackBar.open('Limpia o retén la cuenta actual antes de retomar otra.', 'Cerrar', { duration: 2600 });
      return;
    }

    this.state.cargarCarrito(cuenta.carrito);
    this.busquedaClienteControl.setValue(cuenta.carrito.clienteNombre ?? '');
    try {
      await this.cuentasAbiertasService.eliminarCuenta(cuenta.almacenId, cuenta.id);
    } catch {
      // La cuenta ya está cargada localmente; ignorar error de limpieza.
    }
  }

  protected async eliminarCuentaAbierta(cuenta: CuentaAbierta, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.cuentasAbiertasService.eliminarCuenta(cuenta.almacenId, cuenta.id);
    } catch {
      this.snackBar.open('No se pudo eliminar la cuenta.', 'Cerrar', { duration: 2400 });
    }
  }

  /** Abre el diálogo para dividir la cuenta y cobra cada sub-cuenta como venta/factura independiente. */
  protected async dividirYCobrar(): Promise<void> {
    const items = this.state.carrito().items;
    if (items.length === 0) {
      this.snackBar.open('Agrega productos antes de dividir.', 'Cerrar', { duration: 2200 });
      return;
    }

    const sesion = this.sesionActiva();
    const user = this.auth.currentUser();
    if (!sesion?.id || !sesion.almacenId || !user) {
      this.snackBar.open('No hay una sesion de caja activa.', 'Cerrar', { duration: 2300 });
      return;
    }

    const clientesOpciones = this.clientes()
      .filter((cliente) => !!cliente.id)
      .map((cliente) => ({
        id: cliente.id ?? null,
        nombre: cliente.nombreCompleto,
        identificacion: cliente.identificacion
      }));

    const dialogRef = this.dialog.open(DividirCuentaDialogComponent, {
      maxWidth: '95vw',
      panelClass: 'dividir-cuenta-panel',
      data: {
        items,
        metodosPago: this.metodosPago(),
        etiquetaCuenta: this.etiquetaCuenta(),
        clientes: clientesOpciones,
        clienteActualId: this.state.carrito().clienteId,
        clienteActualNombre: this.state.carrito().clienteNombre,
        camposPersonalizados: this.camposPersonalizadosClientes() ?? []
      }
    });

    const result = (await firstValueFrom(dialogRef.afterClosed())) as DividirCuentaResult | null | undefined;
    if (!result || result.subcuentas.length === 0) {
      return;
    }

    this.cobrando.set(true);
    const ventaIds: string[] = [];
    try {
      for (const sub of result.subcuentas) {
        const total = this.calcularTotalVenta(sub.items, this.config().impuestoPorDefecto);
        const ventaId = await this.ventasService.confirmarVenta({
          sesionId: sesion.id,
          almacenId: sesion.almacenId,
          vendedorId: user.uid,
          vendedorNombre: user.displayName ?? 'Sin nombre',
          clienteId: sub.clienteId,
          clienteNombre: sub.clienteNombre,
          items: sub.items,
          pagos: [{ metodo: sub.metodoPago, monto: total, referencia: '' }],
          descuentoGlobal: 0,
          impuestoPorcentaje: this.config().impuestoPorDefecto,
          notas: this.state.carrito().notas
        });
        ventaIds.push(ventaId);
      }

      // Facturación automática por sub-cuenta (si el perfil del almacén lo activa).
      if (this.perfil()?.facturacionAutomatica && ventaIds.length > 0) {
        let sinConfig = false;
        for (let i = 0; i < ventaIds.length; i += 1) {
          const resultado = await this.emitirFacturaAuto(
            ventaIds[i],
            sesion.almacenId,
            `Cuenta ${i + 1} de ${ventaIds.length} · `
          );
          if (resultado === 'SIN_CONFIG') {
            sinConfig = true;
            break;
          }
        }
        if (sinConfig) {
          this.snackBar.open('Cuentas creadas. Sin firma configurada: factúralas luego desde el detalle.', 'Cerrar', { duration: 3500 });
        }
      }

      this.state.limpiar();
      this.busquedaClienteControl.setValue('');
      this.efectivoRecibido.set(null);
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: `${ventaIds.length} cuenta(s) cobradas correctamente.`, icon: 'point_of_sale' },
        duration: 2800,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/ventas/resumen', ventaIds[0]]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la division.';
      const parcial = ventaIds.length > 0 ? ` Se cobraron ${ventaIds.length} cuenta(s) antes del error.` : '';
      this.snackBar.open(message + parcial, 'Cerrar', { duration: 4000 });
    } finally {
      this.cobrando.set(false);
    }
  }

  /** Réplica exacta del cálculo de total de VentasService.confirmarVenta para fijar el pago de cada sub-cuenta. */
  private calcularTotalVenta(items: CarritoItem[], impuestoDefault: number): number {
    const subtotalNetoItems = items.reduce((acum, item) => {
      const base = this.roundToTwo(item.precioUnitario * item.cantidad);
      const descuentoItem = this.roundToTwo(Math.min(base, base * (item.descuentoItem / 100)));
      return this.roundToTwo(acum + Math.max(0, base - descuentoItem));
    }, 0);

    const impuesto = items.reduce((acum, item) => {
      const base = this.roundToTwo(item.precioUnitario * item.cantidad);
      const descuentoItem = this.roundToTwo(Math.min(base, base * (item.descuentoItem / 100)));
      const baseNeta = this.roundToTwo(Math.max(0, base - descuentoItem));
      const ivaPorcentaje = Number.isFinite(item.ivaPorcentaje) ? Math.max(0, item.ivaPorcentaje) : impuestoDefault;
      return this.roundToTwo(acum + this.roundToTwo(baseNeta * (ivaPorcentaje / 100)));
    }, 0);

    return this.roundToTwo(subtotalNetoItems + impuesto);
  }

  /**
   * Emite y autoriza la factura al SRI para una venta ya COMPLETADA (mismos pasos que el
   * botón "Facturar" del detalle, sin diálogo de confirmación). No afecta la contabilidad.
   * Devuelve 'SIN_CONFIG' si el almacén no tiene firma configurada.
   */
  private async emitirFacturaAuto(
    ventaId: string,
    almacenId: string,
    prefijo = ''
  ): Promise<'AUTORIZADA' | 'ERROR' | 'SIN_CONFIG'> {
    const firma = await firstValueFrom(this.facturacionService.getFirmaParaAlmacen(almacenId));
    if (!firma) {
      return 'SIN_CONFIG';
    }

    const textoPaso: Record<string, string> = {
      armando: 'Preparando factura...',
      generando: 'Generando factura...',
      firmando: 'Firmando y enviando...',
      autorizando: 'Consultando autorización SRI...',
      autorizada: 'Autorizada'
    };

    this.facturandoPaso.set(`${prefijo}Preparando factura...`);
    try {
      await this.facturaService.emitirYAutorizarFactura(ventaId, {
        onStep: (step) => this.facturandoPaso.set(`${prefijo}${textoPaso[step] ?? ''}`)
      });
      return 'AUTORIZADA';
    } catch (error) {
      if (error instanceof FacturaSriError) {
        this.dialog.open(FacturaSriErrorDialogComponent, {
          width: '620px',
          maxWidth: '95vw',
          data: {
            estadoSri: error.estadoSri,
            claveAcceso: error.claveAcceso,
            mensaje: error.mensajes || error.message
          }
        });
      } else {
        const message = error instanceof Error ? error.message : 'No se pudo completar la facturación.';
        this.snackBar.open(message, 'Cerrar', { duration: 3500 });
      }
      return 'ERROR';
    } finally {
      this.facturandoPaso.set('');
    }
  }

  protected irAConfiguracion(): void {
    this.router.navigate(['/workspace/ventas/configuracion']);
  }

  protected async togglePantallaCompleta(): Promise<void> {
    await this.immersiveService.toggle();
  }

  /** Carga el perfil de POS del almacén activo y aplica la vista de catálogo por defecto. */
  private cargarPerfil(almacenId: string): void {
    this.perfilVistaAplicada = false;
    this.perfilSub?.unsubscribe();
    this.perfilSub = this.posConfig
      .getPerfil(almacenId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((perfil) => {
        this.perfil.set(perfil);
        if (!this.perfilVistaAplicada) {
          this.vistaProductos.set(perfil.vistaCatalogoPorDefecto === 'LISTA' ? 'table' : 'cards');
          this.perfilVistaAplicada = true;
        }
      });

    // Cuentas abiertas compartidas de la sucursal (modo restaurante).
    this.cuentasSub?.unsubscribe();
    this.cuentasSub = this.cuentasAbiertasService
      .getCuentas(almacenId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuentas) => this.cuentasAbiertas.set(cuentas));
  }

  private iniciarSesionYStock(): void {
    const user = this.auth.currentUser();
    const almacenId = this.almacenSeleccionadoId();

    if (!user || !almacenId) {
      return;
    }

    this.cargarPerfil(almacenId);

    void this.ventasService.ensureSesionActiva(
      user.uid,
      user.displayName ?? 'Sin nombre',
      almacenId
    ).then((sesion) => {
      this.sesionActiva.set(sesion);
      this.almacenSeleccionadoId.set(sesion.almacenId);

      this.almacenesService
        .getStockDetallePorAlmacen(sesion.almacenId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((rows) => {
          const stockMap = rows.reduce<Record<string, number>>((acc, row) => {
            acc[row.productoId] = row.disponible;
            return acc;
          }, {});

          this.stockPorAlmacen.set(stockMap);

          for (const item of this.state.carrito().items) {
            if (item.itemTipo === 'PRODUCTO') {
              this.state.actualizarStockDisponible(item.productoId, this.stockProducto(item.productoId), item.itemTipo);
              continue;
            }

            if (item.itemTipo === 'RECETA') {
              const receta = this.productos().find((producto) => producto.id === item.productoId);
              const disponible = receta ? this.stockRecetaAproximado(receta) : 0;
              this.state.actualizarStockDisponible(item.productoId, disponible, item.itemTipo);
            }
          }
        });
    });
  }

  private stockRecetaAproximado(receta: Producto): number {
    if (receta.tipo !== 'RECETA') {
      return this.stockProducto(receta.id);
    }

    return this.calcularCapacidadReceta(receta, new Set<string>());
  }

  private calcularCapacidadReceta(receta: Producto, trail: Set<string>): number {
    const recetaId = receta.id;
    if (!recetaId) {
      return 0;
    }

    if (trail.has(recetaId)) {
      return 0;
    }

    const ingredientes = (receta.recetaItems ?? []).filter((item) => item.cantidad > 0 && !!item.productoId);
    if (ingredientes.length === 0) {
      return 0;
    }

    trail.add(recetaId);
    let maximo = Number.MAX_SAFE_INTEGER;
    try {
      for (const ingrediente of ingredientes) {
        const productoIngrediente = this.productos().find((producto) => producto.id === ingrediente.productoId);

        let capacidad = 0;
        if (!productoIngrediente || (productoIngrediente.tipo ?? 'SIMPLE') === 'SIMPLE') {
          const stockIngrediente = this.stockProducto(ingrediente.productoId);
          capacidad = Math.floor(stockIngrediente / ingrediente.cantidad);
        } else {
          const capacidadSubreceta = this.calcularCapacidadReceta(productoIngrediente, trail);
          capacidad = Math.floor(capacidadSubreceta / ingrediente.cantidad);
        }

        maximo = Math.min(maximo, capacidad);
      }
    } finally {
      trail.delete(recetaId);
    }

    return Number.isFinite(maximo) ? Math.max(0, maximo) : 0;
  }

  private roundToTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

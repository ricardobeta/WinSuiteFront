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
import { Almacen, AtributoVariante, Producto, Unidad } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';
import { ConfiguracionInventarioService } from '../../../inventario/services/configuracion-inventario.service';
import { KardexService } from '../../../inventario/services/kardex.service';
import { ProductosService } from '../../../inventario/services/productos.service';
import { RecetasService } from '../../../inventario/services/recetas.service';
import { UnidadesService } from '../../../inventario/services/unidades.service';
import {
  esGranel,
  esInsumo,
  esPlantillaVariantes,
  esVendibleEnPos,
  pasoDe,
  redondearCantidad
} from '../../../inventario/utils/producto.util';
import { CarritoItem, CuentaAbierta, MetodoPagoVenta, ModoPos, PerfilPos, SesionCaja, VentaItemTipo } from '../../models/ventas.models';
import { VentasConfigService } from '../../services/ventas-config.service';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { VentasPosStateService } from '../../services/ventas-pos-state.service';
import { VentasPosConfigService } from '../../services/ventas-pos-config.service';
import { CuentasAbiertasService } from '../../services/cuentas-abiertas.service';
import { PosImmersiveService } from '../../services/pos-immersive.service';
import {
  CobroPorPartesComponent,
  CobroPorPartesRequest
} from '../cobro-por-partes/cobro-por-partes.component';
import { VentasService } from '../../services/ventas.service';
import { VentasAlmacenSesionService } from '../../services/ventas-almacen-sesion.service';
import { FacturaService, FacturaSriError } from '../../services/factura.service';
import { FacturaSriErrorDialogComponent } from '../factura-sri-error-dialog/factura-sri-error-dialog.component';
import { calcularResumenVenta } from '../../services/ventas-calculos.util';
import {
  CantidadGranelDialogComponent,
  CantidadGranelDialogData
} from '../../components/cantidad-granel-dialog/cantidad-granel-dialog.component';
import {
  VarianteSeleccionable,
  VarianteSelectorDialogComponent,
  VarianteSelectorDialogData
} from '../../components/variante-selector-dialog/variante-selector-dialog.component';

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
  imagenUrl?: string;
  /** Presente solo en la tarjeta agrupadora: sus hijos se eligen en un dialogo. */
  grupoVariantes?: { atributos: AtributoVariante[]; hijos: Producto[] };
  /** Texto extra para que la busqueda encuentre "camiseta roja". */
  textoBusqueda?: string;
  /** Se cobra por peso o medida: la cantidad se digita con decimales. */
  granel?: boolean;
  /** Abreviatura de la unidad, para rotular la cantidad a granel. */
  unidadAbreviatura?: string;
  /** Incremento que aplican los botones +/- del carrito. */
  paso?: number;
}

type VistaPosCompacta = 'productos' | 'cobro';

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
    TwoDecimalInputDirective,
    CobroPorPartesComponent
  ],
  template: `
    @if (resolviendoAlmacenesPermitidos()) {
      <section class="pos-bloqueado">
        <div class="bloqueado-contenido">
          <mat-spinner diameter="46"></mat-spinner>
          <p class="subtitulo">Verificando tus almacenes…</p>
        </div>
      </section>
    } @else if (errorAlmacenesPermitidos()) {
      <section class="pos-bloqueado">
        <div class="bloqueado-contenido">
          <mat-icon class="bloqueado-icono">cloud_off</mat-icon>
          <h2>No se pudo verificar tu acceso</h2>
          <p class="subtitulo">Falló la lectura de almacenes y asignaciones. Revisa tu conexión e inténtalo otra vez.</p>
          <button mat-raised-button color="primary" (click)="reintentarAlmacenes()">
            <mat-icon>refresh</mat-icon>
            Reintentar
          </button>
        </div>
      </section>
    } @else if (sineAlmacenesPermitidos()) {
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

      @if (cobroPorPartesActivo()) {
        <app-cobro-por-partes
          [items]="state.carrito().items"
          [clientes]="clientesCobroPorPartes()"
          [metodosPago]="metodosPago()"
          [etiquetaCuenta]="etiquetaCuenta()"
          [impuestoPorDefecto]="config().impuestoPorDefecto"
          [camposPersonalizados]="camposPersonalizadosClientes()"
          [procesando]="cobrando()"
          [comprasCompletadas]="comprasParcialesCompletadas()"
          [resetToken]="resetCobroParcialToken()"
          [mensajeResultado]="mensajeCobroParcial()"
          (cobrar)="cobrarParte($event)"
          (salir)="salirCobroPorPartes()"
        />
      } @else {
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
            <span class="cuentas-abiertas-label">{{ etiquetaCuentas() }} retenidas:</span>
            @for (cuenta of cuentasAbiertas(); track cuenta.id) {
              <div
                class="cuenta-chip"
                [class.tomada-otro]="cuentaTomadaPorOtro(cuenta)"
                [class.tomada-aqui]="cuentaTomadaAqui(cuenta)"
                tabindex="0"
                (click)="resumirCuenta(cuenta)"
                (keydown.enter)="resumirCuenta(cuenta)"
              >
                <mat-icon>{{ cuentaTomadaPorOtro(cuenta) ? 'lock' : (cuentaTomadaAqui(cuenta) ? 'devices' : 'receipt') }}</mat-icon>
                <span class="cuenta-nombre">{{ cuenta.etiqueta }}</span>
                <span class="cuenta-count">{{ cuenta.carrito.items.length }}</span>
                @if (cuentaTomadaPorOtro(cuenta)) {
                  <span class="cuenta-estado">Tomada por {{ cuenta.tomadaPorNombre || 'otro dispositivo' }}</span>
                } @else if (cuentaTomadaAqui(cuenta)) {
                  <span class="cuenta-estado">En uso aquí</span>
                }
                <button
                  mat-icon-button
                  type="button"
                  [disabled]="cuentaTomadaPorOtro(cuenta)"
                  (click)="eliminarCuentaAbierta(cuenta, $event)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
          </div>
        }
      </section>

      <nav class="compact-nav" aria-label="Cambiar entre productos y cobro">
        <button
          type="button"
          class="compact-nav-button"
          [class.active]="vistaCompacta() === 'productos'"
          [attr.aria-pressed]="vistaCompacta() === 'productos'"
          aria-controls="pos-productos-panel"
          (click)="mostrarVistaCompacta('productos')"
        >
          <mat-icon>grid_view</mat-icon>
          <span>Productos</span>
        </button>

        <button
          type="button"
          class="compact-nav-button compact-nav-checkout"
          [class.active]="vistaCompacta() === 'cobro'"
          [attr.aria-pressed]="vistaCompacta() === 'cobro'"
          aria-controls="pos-cobro-panel"
          (click)="mostrarVistaCompacta('cobro')"
        >
          <mat-icon>shopping_cart</mat-icon>
          <span class="compact-nav-copy">
            <span>Cobro</span>
            <small>{{ state.carrito().items.length }} {{ state.carrito().items.length === 1 ? 'articulo' : 'articulos' }}</small>
          </span>
          <strong>{{ total() | number:'1.2-2' }}</strong>
        </button>
      </nav>

      <article
        id="pos-productos-panel"
        class="surface-card panel panel-left compact-pane"
        [class.compact-pane-active]="vistaCompacta() === 'productos'"
      >
        <header class="panel-title">
          <h2>Catalogo de venta</h2>
          <p>Elige productos o servicios desde una sola vista y agregalos al carrito.</p>
        </header>

        <div class="catalog-controls">
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
        </div>

        <div class="catalog-results">
        @if (vistaProductos() === 'cards') {
          @if (catalogoFiltrado().length === 0) {
            <div class="productos-empty">
              <mat-icon>search_off</mat-icon>
              <p>No encontramos resultados con ese criterio.</p>
            </div>
          } @else {
            <section class="productos-grid">
              @for (item of catalogoFiltrado(); track item.tipo + '-' + item.id) {
                <button
                  type="button"
                  class="producto-card"
                  [class.con-imagen]="mostrarImagenes()"
                  (click)="agregarDesdeCatalogo(item)"
                  [disabled]="itemSinStock(item)"
                >
                  @if (mostrarImagenes()) {
                    <div class="producto-foto">
                      <span class="producto-foto-vacia" aria-hidden="true">{{ item.nombre.charAt(0).toUpperCase() }}</span>
                      @if (item.imagenUrl) {
                        <img
                          [src]="item.imagenUrl"
                          [alt]="item.nombre"
                          loading="lazy"
                          (error)="ocultarImagenRota($event)"
                        />
                      }
                    </div>
                  }

                  <div class="producto-header-row">
                    <div>
                      <p class="producto-nombre">{{ item.nombre }}</p>
                      <p class="producto-meta">
                        {{ item.sku }}
                        @if (item.granel) {
                          · por {{ item.unidadAbreviatura }}
                        }
                        @if (item.grupoVariantes) {
                          · {{ item.grupoVariantes.hijos.length }} variantes
                        }
                      </p>
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
                      @if (item.grupoVariantes) {
                        <mat-icon>tune</mat-icon>
                        Elegir
                      } @else {
                        <mat-icon>add_shopping_cart</mat-icon>
                        Agregar
                      }
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
                  {{ item.grupoVariantes ? 'Elegir' : 'Agregar' }}
                </button>
              </div>
            }
          </section>
        }
        </div>
      </article>

      <article
        id="pos-cobro-panel"
        class="surface-card panel panel-right compact-pane"
        [class.compact-pane-active]="vistaCompacta() === 'cobro'"
      >
        <header class="panel-title">
          <div>
            <h2>Venta y cobro</h2>
            <p>Vendedor {{ vendedorNombre() }} · Sesión {{ sesionEstado() }}</p>
          </div>
          <p class="store-label">
            <mat-icon>storefront</mat-icon>
            {{ almacenActualNombre() }}
          </p>
        </header>

        <!-- Pestañas POS: el listado dentro del panel Cobro fue removido; se mantiene arriba. -->

        <div class="checkout-scroll">
        <div class="checkout-primary">
        <section class="client-row">
          <mat-form-field appearance="outline" class="client-search">
            <mat-label>Buscar cliente</mat-label>
            <input matInput [formControl]="busquedaClienteControl" [matAutocomplete]="clientesAuto" placeholder="Nombre o identificación" />
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

        <section class="cart-section">
          <header class="cart-list-header">
            <h3>Productos agregados</h3>
            <span>{{ state.carrito().items.length }} {{ state.carrito().items.length === 1 ? 'articulo' : 'articulos' }}</span>
          </header>
          <div class="cart-column-head" [class.sin-descuentos]="!config().permitirDescuentos" aria-hidden="true">
            <span>Producto</span>
            <span>Cantidad</span>
            @if (config().permitirDescuentos) {
              <span>Desc.</span>
            }
            <span>Total</span>
            <span></span>
          </div>
          <div class="cart-list" [class.sin-descuentos]="!config().permitirDescuentos">
          @if (state.carrito().items.length === 0) {
            <div class="empty-cart">
              <mat-icon>shopping_cart</mat-icon>
              <p class="empty-label">Agrega un producto para iniciar la venta.</p>
            </div>
          } @else {
            @for (item of state.carrito().items; track item.itemTipo + '-' + item.productoId) {
              <div class="cart-row">
                <div>
                  <p class="cart-name">{{ item.nombre }}</p>
                  <p class="cart-meta">
                    {{ item.sku }} · {{ item.itemTipo === 'SERVICIO' ? 'Servicio' : (item.itemTipo === 'RECETA' ? 'Receta' : 'Producto') }} · {{ item.precioUnitario | number:'1.2-2' }} c/u
                  </p>
                </div>

                <div class="cart-actions">
                  <button mat-icon-button type="button" (click)="decrementar(item.productoId, item.itemTipo)">
                    <mat-icon>remove</mat-icon>
                  </button>
                  @if (esLineaGranel(item)) {
                    <button
                      type="button"
                      class="cart-qty cart-qty-editable"
                      title="Tocar para digitar la cantidad"
                      (click)="editarCantidadLinea(item)"
                    >
                      {{ item.cantidad | number: '1.0-3' }} {{ unidadLinea(item) }}
                    </button>
                  } @else {
                    <span class="cart-qty">{{ item.cantidad | number: '1.0-3' }}</span>
                  }
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
          </div>
        </section>

        </div>
        <div class="checkout-secondary">

        <section class="totals">
          <header class="checkout-block-title">
            <mat-icon>receipt_long</mat-icon>
            <div>
              <h3>Resumen de la venta</h3>
              <p>Revisa descuentos e impuestos antes de cobrar.</p>
            </div>
          </header>

          <div class="order-options">
            @if (config().permitirDescuentos) {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Descuento global %</mat-label>
                <input matInput type="number" [value]="state.carrito().descuentoGlobal" (input)="actualizarDescuentoGlobal($event)" />
              </mat-form-field>
            }

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Notas de la venta</mat-label>
              <textarea matInput rows="2" [value]="state.carrito().notas" (input)="actualizarNotas($event)"></textarea>
            </mat-form-field>
          </div>

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
            <div class="payment-title">
              <mat-icon>account_balance_wallet</mat-icon>
              <div>
                <h3>Forma de pago</h3>
                <p>Registra uno o varios medios.</p>
              </div>
            </div>
            <button mat-button type="button" (click)="state.agregarPago()">Agregar pago</button>
          </header>

          @for (pago of state.carrito().pagos; track $index) {
            <div class="payment-row" [class.cash-payment]="pago.metodo === 'EFECTIVO'">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Método</mat-label>
                <mat-select [value]="pago.metodo" (selectionChange)="actualizarPagoMetodo($index, $event.value)">
                  @for (metodo of metodosPago(); track metodo) {
                    <mat-option [value]="metodo">{{ etiquetaMetodoPago(metodo) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
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

              @if (pago.metodo !== 'EFECTIVO') {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Referencia</mat-label>
                  <input matInput [value]="pago.referencia" (input)="actualizarPagoReferencia($index, $event)" />
                </mat-form-field>
              }

              <button mat-icon-button type="button" color="warn" aria-label="Eliminar forma de pago" (click)="state.removerPago($index)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }

          <p class="payments-balance" [class.error]="pagosDescuadrados()">
            Diferencia pagos: {{ balancePagos() | number:'1.2-2' }}
          </p>

          @if (tienePagoEfectivo()) {
            <div class="cobro-rapido">
              <div class="cash-title">
                <mat-icon>payments</mat-icon>
                <span>Cambio en efectivo</span>
              </div>
            <mat-form-field appearance="outline" class="recibido-field">
              <mat-label>Efectivo recibido</mat-label>
              <input matInput type="number" step="0.01" min="0" [value]="efectivoRecibido() ?? ''" (input)="setEfectivoRecibido($event)" />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="efectivoExacto()">Exacto</button>
            @if (cambio() !== null) {
              <p class="cambio-line">Cambio <strong>{{ cambio() | number:'1.2-2' }}</strong></p>
            }
            </div>
          }
        </section>
        </div>
        </div>

        <section class="actions">
          <div class="checkout-summary" aria-live="polite">
            <span>Total a cobrar</span>
            <strong>{{ total() | number:'1.2-2' }}</strong>
          </div>
          <div class="secondary-actions">
            <button mat-stroked-button type="button" (click)="limpiarCarrito()">Limpiar</button>
            @if (permiteDividir()) {
              <button mat-stroked-button type="button" [disabled]="cobrando()" (click)="abrirCobroPorPartes()">
                <mat-icon>call_split</mat-icon>
                Cobrar por partes
              </button>
            }
          </div>
          <button mat-raised-button color="primary" type="button" [disabled]="cobrando()" (click)="cobrar()">
            <mat-icon>{{ cobrando() ? 'hourglass_top' : 'payments' }}</mat-icon>
            {{ cobrando() ? 'Cobrando...' : 'Cobrar' }}
          </button>
        </section>
      </article>
    </section>
      }
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
    :host { display: block; min-width: 0; }
    .pos-grid {
      display: grid;
      grid-template-columns: minmax(560px, 1fr) clamp(560px, 44%, 720px);
      grid-template-rows: auto minmax(0, 1fr);
      gap: .875rem;
      height: calc(100dvh - var(--topbar-height) - 3rem);
      min-height: 0;
    }
    :host-context(.workspace-shell.immersive) .pos-grid {
      height: 100dvh;
      min-height: 0;
      padding: .75rem;
    }
    .panel {
      min-width: 0;
      min-height: 0;
      padding: clamp(.75rem, 1.2vw, 1rem);
      display: grid;
      gap: .75rem;
      overflow: hidden;
    }
    .panel-left { grid-template-rows: auto auto minmax(0, 1fr); }
    .panel-right { grid-template-rows: auto minmax(0, 1fr) auto; }
    .compact-nav { display: none; }
    .catalog-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: .55rem;
      min-width: 0;
    }
    .catalog-controls > mat-form-field,
    .scan-bar,
    .products-result-label { grid-column: 1 / -1; }
    .catalog-controls mat-form-field { width: 100%; }
    .catalog-results {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      padding: .1rem .3rem .4rem .1rem;
    }
    .checkout-scroll {
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      display: grid;
      align-content: start;
      gap: .75rem;
      padding-right: .3rem;
    }
    .scan-field { width: 100%; }
    .scan-field mat-icon[matPrefix] { margin-right: .5rem; color: var(--primary); }
    .catalog-type-switch,
    .products-view-switch {
      display: inline-flex;
      gap: .35rem;
      padding: .2rem;
      border-radius: .75rem;
      background: var(--tc-surface-container-low);
    }
    .catalog-type-switch button,
    .products-view-switch button {
      min-width: 0;
      border: 0;
      border-radius: .6rem;
    }
    .catalog-type-switch button.active,
    .products-view-switch button.active {
      color: var(--primary);
      background: var(--tc-surface-container-lowest);
      box-shadow: 0 3px 10px color-mix(in srgb, var(--tc-on-surface) 8%, transparent);
    }
    .products-result-label { margin: -.25rem 0 0; color: var(--muted-foreground); font-size: .82rem; }
    .productos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
      align-items: start;
      gap: .65rem;
    }
    .producto-card {
      align-self: start;
      width: 100%;
      min-width: 0;
      min-height: 132px;
      border: 0;
      border-radius: var(--tc-radius-lg);
      background: var(--tc-surface-container-low);
      color: var(--tc-on-surface);
      text-align: left;
      padding: .8rem;
      cursor: pointer;
      display: grid;
      align-content: space-between;
      gap: .55rem;
      transition:
        transform .18s cubic-bezier(.2, .8, .2, 1),
        background-color .18s ease,
        box-shadow .18s ease;
    }
    @media (hover: hover) {
      .producto-card:hover:not(:disabled) {
        background: color-mix(in srgb, var(--tc-primary-container) 24%, var(--tc-surface-container-lowest));
        transform: translateY(-2px);
        box-shadow: 0 9px 22px color-mix(in srgb, var(--tc-on-surface) 10%, transparent);
      }
    }
    .producto-card:active:not(:disabled) {
      background: color-mix(in srgb, var(--tc-primary-container) 34%, var(--tc-surface-container-lowest));
      transform: scale(.985);
    }
    .producto-card:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
      outline-offset: 2px;
    }
    .producto-card:disabled { opacity: .58; cursor: not-allowed; }
    .cart-qty { min-width: 3.2rem; text-align: center; font-variant-numeric: tabular-nums; }
    .cart-qty-editable {
      border: 1px dashed var(--tc-ghost-border);
      border-radius: 8px;
      padding: .2rem .45rem;
      background: none;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
    .producto-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
    .producto-nombre { margin: 0; font-weight: 700; line-height: 1.2; }
    .stock-badge {
      border-radius: .6rem;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .02em;
      padding: .2rem .5rem;
      color: var(--tc-on-success-container);
      background: var(--tc-success-container);
      white-space: nowrap;
    }
    .stock-badge.warn { color: var(--tc-on-warning-container); background: var(--tc-warning-container); }
    .stock-badge.danger { color: var(--tc-on-error-container); background: var(--tc-error-container); }
    .stock-badge.service { color: var(--tc-on-info-container); background: var(--tc-info-container); }
    .producto-meta { margin: 0; color: var(--muted-foreground); font-size: .83rem; }
    .producto-footer-row { display: flex; justify-content: space-between; align-items: flex-end; gap: .6rem; }
    .producto-price-label { margin: 0; color: var(--muted-foreground); font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; }
    .producto-precio { margin: .12rem 0 0; font-family: var(--tc-font-family-heading); font-size: 1.18rem; font-weight: 750; }
    .producto-cta { display: inline-flex; align-items: center; gap: .3rem; font-weight: 600; color: var(--primary); }
    .producto-cta.disabled { color: var(--muted-foreground); }
    .producto-cta mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .producto-stock { margin: 0; color: var(--tc-success); font-size: .8rem; }
    .productos-empty {
      border: 0;
      border-radius: .85rem;
      padding: 1.2rem;
      display: grid;
      place-items: center;
      gap: .4rem;
      color: var(--muted-foreground);
      text-align: center;
      background: var(--tc-surface-container-low);
    }
    .productos-empty mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .productos-table-wrap { min-width: 720px; border-radius: .75rem; overflow: hidden; background: var(--tc-surface-container-low); }
    .productos-table-head, .productos-table-row { display: grid; grid-template-columns: .8fr .9fr 1.5fr .8fr .9fr auto; gap: .5rem; align-items: center; padding: .65rem .75rem; }
    .productos-table-head { position: sticky; top: 0; z-index: 1; background: var(--tc-surface-container-highest); font-weight: 700; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
    .productos-table-row { margin-top: .25rem; background: var(--tc-surface-container-lowest); }
    .cell-sku { color: var(--muted-foreground); font-size: .9rem; }
    .cell-name { font-weight: 600; }
    mat-chip.chip-producto { background: rgb(16 185 129 / 18%); }
    mat-chip.chip-servicio { background: rgb(59 130 246 / 20%); }
    mat-chip.chip-receta { background: rgb(249 115 22 / 20%); }
    .sin-stock { color: var(--tc-error); }
    .pos-tabs {
      min-width: 0;
      max-height: 152px;
      border: 0;
      border-radius: var(--tc-radius-lg);
      padding: .65rem .75rem;
      display: grid;
      gap: .45rem;
      grid-column: 1 / -1;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--tc-surface-container-low);
    }
    .pos-tabs-header { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; }
    .pos-tabs-header h3 { margin: 0; font-family: var(--tc-font-family-heading); font-size: .95rem; }
    .pos-tabs-actions { display: inline-flex; gap: .5rem; flex-wrap: wrap; }
    .fullscreen-btn { color: var(--primary); }
    .pos-tabs-list {
      display: flex;
      gap: .45rem;
      min-width: 0;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      padding-bottom: .15rem;
    }
    .cuentas-abiertas {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: .4rem;
      min-width: 0;
      overflow-x: auto;
      padding-top: .2rem;
    }
    .cuentas-abiertas-label { font-size: .82rem; color: var(--muted-foreground); font-weight: 600; }
    .cuenta-chip { display: inline-flex; align-items: center; gap: .35rem; flex: 0 0 auto; padding: .2rem .3rem .2rem .55rem; border-radius: .75rem; cursor: pointer; background: color-mix(in srgb, var(--primary) 10%, transparent); border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); }
    .cuenta-chip:hover { background: color-mix(in srgb, var(--primary) 16%, transparent); }
    .cuenta-chip.tomada-otro {
      cursor: not-allowed;
      border-color: color-mix(in srgb, #b45309 45%, transparent);
      background: color-mix(in srgb, #f59e0b 12%, transparent);
    }
    .cuenta-chip.tomada-aqui {
      border-color: color-mix(in srgb, #15803d 45%, transparent);
      background: color-mix(in srgb, #22c55e 10%, transparent);
    }
    .cuenta-chip mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--primary); }
    .cuenta-nombre { font-weight: 600; font-size: .85rem; }
    .cuenta-count { min-width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; background: color-mix(in srgb, var(--primary) 22%, transparent); color: var(--primary); padding: 0 .3rem; }
    .cuenta-estado { font-size: .75rem; font-weight: 700; color: var(--muted-foreground); white-space: nowrap; }
    .pos-tab {
      min-width: 210px;
      border: 0;
      border-radius: .7rem;
      background: var(--tc-surface-container-lowest);
      padding: .35rem .4rem;
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      align-items: center;
      gap: .2rem;
      cursor: pointer;
    }
    .pos-tab.active {
      background: color-mix(in srgb, var(--primary) 10%, var(--tc-surface-container-low));
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--primary) 32%, transparent);
    }
    .pos-tab-title { text-align: left; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pos-tab-input {
      width: 100%;
      border: 1px solid var(--tc-ghost-border);
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
    .payments { display: grid; gap: .5rem; }
    .payments header { display: flex; justify-content: space-between; align-items: center; }
    .payments h3 { margin: 0; font-family: var(--tc-font-family-heading); font-size: 1rem; }
    .payment-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, .8fr) auto;
      gap: .5rem;
      align-items: center;
    }
    .payment-row > mat-form-field:nth-child(1) { grid-column: 1; grid-row: 1; }
    .payment-row > mat-form-field:nth-child(2) { grid-column: 2; grid-row: 1; }
    .payment-row > mat-form-field:nth-child(3) { grid-column: 1 / -1; grid-row: 2; }
    .payment-row > button { grid-column: 3; grid-row: 1; }
    .payments-balance { margin: 0; font-size: .9rem; color: var(--muted-foreground); }
    .payments-balance.error { color: var(--tc-error); font-weight: 600; }
    .cobro-rapido { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .recibido-field { width: 160px; }
    .cambio-line { margin: 0; font-size: 1.05rem; }
    .cambio-line strong { color: var(--tc-success); }
    .empty-label { color: var(--muted-foreground); margin: 0; }

  `]
})
export class VentasPosComponent {
  protected readonly state = inject(VentasPosStateService);
  private readonly productosService = inject(ProductosService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly configuracionInventario = inject(ConfiguracionInventarioService);
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
  protected readonly unidades = signal<Unidad[]>([]);
  /** Productos padre: no se venden solos, agrupan a sus variantes en el catalogo. */
  protected readonly plantillasVariantes = signal<Producto[]>([]);
  /** Incremento por defecto para productos vendidos por peso, desde Configuracion de inventario. */
  protected readonly pasoGranelDefecto = signal(0.1);
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
  protected readonly montoPagoEfectivo = computed(() =>
    this.roundToTwo(
      this.state.carrito().pagos
        .filter((pago) => pago.metodo === 'EFECTIVO')
        .reduce((total, pago) => total + Number(pago.monto || 0), 0)
    )
  );
  protected readonly tienePagoEfectivo = computed(() =>
    this.state.carrito().pagos.some((pago) => pago.metodo === 'EFECTIVO')
  );
  protected readonly cambio = computed(() => {
    const recibido = this.efectivoRecibido();
    if (recibido === null) {
      return null;
    }
    return this.roundToTwo(Math.max(0, recibido - this.montoPagoEfectivo()));
  });
  protected readonly cargandoAlmacenes = signal(true);
  protected readonly vistaProductos = signal<'cards' | 'table'>('cards');
  protected readonly vistaCompacta = signal<VistaPosCompacta>('productos');
  protected readonly filtroCatalogo = signal<'TODOS' | 'PRODUCTOS' | 'SERVICIOS'>('TODOS');
  protected readonly tabEditandoId = signal<string | null>(null);
  protected readonly cobroPorPartesActivo = signal(false);
  protected readonly comprasParcialesCompletadas = signal(0);
  protected readonly resetCobroParcialToken = signal(0);
  protected readonly mensajeCobroParcial = signal('');

  // Perfil de POS del almacén activo (modo RETAIL/RESTAURANTE + opciones de flujo)
  protected readonly perfil = signal<PerfilPos | null>(null);
  private perfilVistaAplicada = false;
  private perfilSub?: Subscription;
  protected readonly immersive = this.immersiveService.immersive;
  protected readonly modoPos = computed<ModoPos>(() => this.perfil()?.modo ?? 'RETAIL');
  protected readonly esRestaurante = computed(() => this.modoPos() === 'RESTAURANTE');
  protected readonly etiquetaCuenta = computed(() =>
    this.singularizarEtiquetaCuenta(this.perfil()?.etiquetaCuenta?.trim() || 'Cuenta')
  );
  protected readonly etiquetaCuentas = computed(() => this.pluralizarEtiquetaCuenta(this.etiquetaCuenta()));
  protected readonly tituloCuentas = computed(() =>
    this.esRestaurante() ? `${this.etiquetaCuentas()} abiertas` : 'Pestañas POS'
  );
  protected readonly permiteCuentasAbiertas = computed(
    () => this.esRestaurante() && this.perfil()?.permitirCuentasAbiertas === true
  );
  protected readonly permiteDividir = computed(
    () => this.esRestaurante() && this.perfil()?.permitirDividirCuenta === true
  );
  protected readonly cuentasAbiertas = signal<CuentaAbierta[]>([]);
  private readonly cuentaRetenidaActiva = signal<CuentaAbierta | null>(null);
  private cuentasSub?: Subscription;
  private syncCuentaTimeout: ReturnType<typeof setTimeout> | null = null;
  private cuentaHeartbeatId: ReturnType<typeof setInterval> | null = null;
  private readonly avisoSinAlmacenesMostrado = signal(false);
  // El bloqueo depende del estado del servicio de sesión, no de la carga de
  // almacenes del POS: son streams distintos y el segundo termina antes.
  protected readonly sineAlmacenesPermitidos = this.almacenSesionService.sinAlmacenesPermitidos;
  protected readonly errorAlmacenesPermitidos = this.almacenSesionService.errorAlmacenesPermitidos;
  protected readonly resolviendoAlmacenesPermitidos = this.almacenSesionService.cargandoAlmacenesPermitidos;

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
    const vendibles = this.productos();

    // Las variantes no se listan sueltas: se pliegan bajo la tarjeta de su padre.
    const hijosPorPadre = new Map<string, Producto[]>();
    for (const producto of vendibles) {
      if (producto.productoPadreId) {
        const lista = hijosPorPadre.get(producto.productoPadreId) ?? [];
        lista.push(producto);
        hijosPorPadre.set(producto.productoPadreId, lista);
      }
    }

    const sueltos = vendibles
      .filter((producto) => !producto.productoPadreId)
      .map((producto) => this.mapProductoItem(producto));

    const grupos: CatalogoPosItem[] = [];
    const agrupados = new Set<string>();

    for (const padre of this.plantillasVariantes()) {
      const hijos = hijosPorPadre.get(padre.id ?? '') ?? [];
      if (hijos.length === 0) {
        continue;
      }

      grupos.push(this.mapGrupoVariantes(padre, hijos));
      hijos.forEach((hijo) => agrupados.add(hijo.id ?? ''));
    }

    // Si el padre fue borrado o desactivado, sus variantes siguen siendo vendibles
    // por si solas en vez de desaparecer del catalogo.
    const huerfanos = vendibles
      .filter((producto) => !!producto.productoPadreId && !agrupados.has(producto.id ?? ''))
      .map((producto) => this.mapProductoItem(producto));

    const servicios = this.servicios().map((servicio) => this.mapServicioItem(servicio)).filter((item) => !!item.id);

    return [...sueltos, ...grupos, ...huerfanos, ...servicios].filter((item) => !!item.id);
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

    // El texto de variantes permite encontrar el grupo tecleando "camiseta roja".
    return byTipo.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.codigoBarras?.toLowerCase().includes(query) ?? false) ||
        (item.textoBusqueda?.toLowerCase().includes(query) ?? false)
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
  protected readonly clientesCobroPorPartes = computed(() =>
    this.clientes()
      .filter((cliente): cliente is Cliente & { id: string } => !!cliente.id)
      .map((cliente) => ({
        id: cliente.id,
        nombre: cliente.nombreCompleto,
        identificacion: cliente.identificacion
      }))
  );
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
    const almacenSeleccionado = this.almacenSesionService.almacenSeleccionado();
    const sinAlmacenes = this.sineAlmacenesPermitidos();

    // Mientras el servicio no haya resuelto el acceso no hay nada que sincronizar
    // ni motivo para avisar que el usuario no tiene almacenes.
    if (this.cargandoAlmacenes() || this.resolviendoAlmacenesPermitidos()) {
      return;
    }

    if (almacenSeleccionado?.id) {
      if (this.almacenSeleccionadoId() !== almacenSeleccionado.id) {
        this.almacenSeleccionadoId.set(almacenSeleccionado.id);
        this.iniciarSesionYStock();
      }
      return;
    }

    if (sinAlmacenes && !this.avisoSinAlmacenesMostrado()) {
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

  private readonly syncCarritoCuentaRetenida = effect(() => {
    const cuenta = this.cuentaRetenidaActiva();
    const carrito = this.state.carrito();
    if (!cuenta) {
      return;
    }
    this.programarSincronizacionCuentaRetenida({ ...cuenta, carrito });
  });

  constructor() {
    this.cuentaHeartbeatId = setInterval(() => {
      void this.sincronizarCuentaRetenidaAhora();
    }, 30_000);
    this.destroyRef.onDestroy(() => {
      if (this.syncCuentaTimeout) {
        clearTimeout(this.syncCuentaTimeout);
      }
      if (this.cuentaHeartbeatId) {
        clearInterval(this.cuentaHeartbeatId);
      }
    });

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        // Las materias primas nunca llegan a la caja. Las plantillas tampoco se venden
        // por si mismas, pero se guardan aparte para agrupar a sus variantes.
        this.productos.set(productos.filter((item) => esVendibleEnPos(item)));
        this.plantillasVariantes.set(
          productos.filter(
            (item) => item.activo !== false && !esInsumo(item) && esPlantillaVariantes(item)
          )
        );
      });

    this.serviciosService
      .getServicios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((servicios) => this.servicios.set(servicios.filter((item) => item.activo)));

    // Se necesitan para rotular las cantidades a granel ("0.750 kg").
    this.unidadesService
      .getUnidades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unidades) => this.unidades.set(unidades));

    void this.configuracionInventario
      .getConfiguracionOnce()
      .then((config) => this.pasoGranelDefecto.set(config.pasoCantidadGranelDefecto))
      .catch(() => undefined);

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
      permitirInventarioNegativo: esReceta && producto.permitirInventarioNegativo === true,
      imagenUrl: producto.imagen?.url || undefined,
      granel: esGranel(producto),
      unidadAbreviatura: this.abreviaturaUnidad(producto.unidadId),
      paso: pasoDe(producto, this.pasoGranelDefecto())
    };
  }

  /** Tarjeta agrupadora: al tocarla se abre el selector de variante. */
  private mapGrupoVariantes(padre: Producto, hijos: Producto[]): CatalogoPosItem {
    const precios = hijos.map((hijo) => Number(hijo.precioVenta ?? 0));
    const stockTotal = hijos.reduce((suma, hijo) => suma + this.stockProducto(hijo.id), 0);

    return {
      id: padre.id ?? '',
      tipo: padre.tipo === 'RECETA' ? 'RECETA' : 'PRODUCTO',
      sku: padre.sku,
      codigoBarras: padre.codigoBarras?.trim() || undefined,
      nombre: padre.nombre,
      precio: precios.length > 0 ? Math.min(...precios) : Number(padre.precioVenta ?? 0),
      costoUnitario: Number(padre.precioCosto ?? 0),
      impuestoPorcentaje: Number.isFinite(padre.ivaPorcentaje)
        ? Math.max(0, Number(padre.ivaPorcentaje))
        : this.config().impuestoPorDefecto,
      stock: stockTotal,
      permitirInventarioNegativo: padre.permitirInventarioNegativo === true,
      imagenUrl: padre.imagen?.url || undefined,
      grupoVariantes: { atributos: padre.atributosVariante ?? [], hijos },
      // Permite encontrar el grupo tecleando "camiseta roja" o el SKU de una variante.
      textoBusqueda: hijos
        .map((hijo) => `${hijo.sku} ${Object.values(hijo.valoresVariante ?? {}).join(' ')}`)
        .join(' '),
      granel: esGranel(padre),
      unidadAbreviatura: this.abreviaturaUnidad(padre.unidadId),
      paso: pasoDe(padre, this.pasoGranelDefecto())
    };
  }

  protected abreviaturaUnidad(unidadId?: string): string {
    if (!unidadId) {
      return 'u';
    }

    return this.unidades().find((unidad) => unidad.id === unidadId)?.abreviatura || 'u';
  }

  /** Las tarjetas con foto solo se pintan si el perfil del almacen lo pide. */
  protected mostrarImagenes(): boolean {
    return this.perfil()?.mostrarImagenes === true;
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

    const porSku = this.catalogoBase().find((item) => item.sku.toLowerCase() === lower);
    if (porSku) {
      return porSku;
    }

    // Cada variante tiene su propio codigo de barras y SKU, pero no figura suelta en el
    // catalogo. Al escanearla se resuelve directo a la variante, sin abrir el selector.
    const variante = this.productos().find(
      (producto) =>
        !!producto.productoPadreId &&
        (producto.codigoBarras?.trim().toLowerCase() === lower || producto.sku.toLowerCase() === lower)
    );

    return variante ? this.mapProductoItem(variante) : null;
  }

  protected agregarDesdeCatalogo(item: CatalogoPosItem): void {
    if (item.tipo === 'SERVICIO') {
      this.agregarServicio(item);
      return;
    }

    // Grupo de variantes: primero se elige la combinacion concreta.
    if (item.grupoVariantes) {
      void this.elegirVariante(item);
      return;
    }

    // Por peso: el cajero digita la cantidad antes de que la linea entre al carrito.
    if (item.granel) {
      void this.agregarGranel(item);
      return;
    }

    if (item.tipo === 'RECETA') {
      this.agregarReceta(item);
      return;
    }

    this.agregarProducto(item);
  }

  /** Abre el selector de talla/color y agrega la variante concreta que se elija. */
  private async elegirVariante(item: CatalogoPosItem): Promise<void> {
    const grupo = item.grupoVariantes;
    if (!grupo) {
      return;
    }

    const permitirExceso = this.config().permitirVentaSinStock;

    const variantes: VarianteSeleccionable[] = grupo.hijos.map((hijo) => {
      const esReceta = hijo.tipo === 'RECETA';
      const stock = esReceta ? this.stockRecetaAproximado(hijo) : this.stockProducto(hijo.id);
      const overrideNegativo = esReceta && hijo.permitirInventarioNegativo === true;

      return {
        id: hijo.id ?? '',
        sku: hijo.sku,
        nombre: hijo.nombre,
        precio: Number(hijo.precioVenta ?? 0),
        stock,
        disponible: permitirExceso || overrideNegativo || stock > 0,
        valores: hijo.valoresVariante ?? {},
        imagenUrl: hijo.imagen?.url || undefined
      };
    });

    const ref = this.dialog.open<
      VarianteSelectorDialogComponent,
      VarianteSelectorDialogData,
      VarianteSeleccionable | null
    >(VarianteSelectorDialogComponent, {
      data: {
        nombrePadre: item.nombre,
        imagenUrl: item.imagenUrl,
        atributos: grupo.atributos,
        variantes
      },
      autoFocus: false
    });

    const elegida = await firstValueFrom(ref.afterClosed());
    if (!elegida) {
      return;
    }

    const hijo = grupo.hijos.find((candidato) => candidato.id === elegida.id);
    if (!hijo) {
      return;
    }

    // Desde aqui la variante es un producto normal: sigue el flujo de siempre.
    this.agregarDesdeCatalogo(this.mapProductoItem(hijo));
  }

  /** Pide la cantidad con el teclado decimal y agrega o reemplaza la linea. */
  private async agregarGranel(item: CatalogoPosItem): Promise<void> {
    if (!item.id) {
      return;
    }

    const itemTipo: VentaItemTipo = item.tipo === 'RECETA' ? 'RECETA' : 'PRODUCTO';
    const stock = Math.max(0, Number(item.stock ?? 0));
    const permitirExceso =
      this.config().permitirVentaSinStock || item.permitirInventarioNegativo === true;

    const cantidad = await this.pedirCantidadGranel({
      nombre: item.nombre,
      unidad: item.unidadAbreviatura ?? 'u',
      precioUnitario: Number(item.precio ?? 0),
      stockDisponible: stock,
      permitirExceso
    });

    if (cantidad === null) {
      return;
    }

    // agregarItem acumula sobre la linea existente; para peso se reemplaza el valor
    // digitado, que es lo que espera el cajero al volver a tocar el producto.
    const existente = this.state
      .carrito()
      .items.find((linea) => linea.productoId === item.id && linea.itemTipo === itemTipo);

    if (existente) {
      this.state.actualizarCantidad(item.id, cantidad, itemTipo);
      return;
    }

    this.state.agregarItem({
      itemTipo,
      productoId: item.id,
      sku: item.sku,
      nombre: item.nombre,
      cantidad,
      precioUnitario: Number(item.precio ?? 0),
      costoUnitario: Number(item.costoUnitario ?? 0),
      descuentoItem: 0,
      ivaPorcentaje: Number.isFinite(item.impuestoPorcentaje)
        ? Math.max(0, item.impuestoPorcentaje)
        : this.config().impuestoPorDefecto,
      stockDisponible: permitirExceso ? Number.MAX_SAFE_INTEGER : stock,
      permitirInventarioNegativo: item.permitirInventarioNegativo === true
    });
  }

  /** Permite corregir la cantidad de una linea ya agregada tocando el numero. */
  protected async editarCantidadLinea(item: CarritoItem): Promise<void> {
    const catalogo = this.catalogoBase().find(
      (candidato) => candidato.id === item.productoId && this.itemTipoDe(candidato) === item.itemTipo
    );

    if (!catalogo?.granel) {
      return;
    }

    const permitirExceso =
      this.config().permitirVentaSinStock || item.permitirInventarioNegativo === true;

    const cantidad = await this.pedirCantidadGranel({
      nombre: item.nombre,
      unidad: catalogo.unidadAbreviatura ?? 'u',
      precioUnitario: Number(item.precioUnitario ?? 0),
      stockDisponible: Math.max(0, Number(item.stockDisponible ?? 0)),
      permitirExceso,
      cantidadInicial: item.cantidad,
      textoConfirmar: 'Actualizar'
    });

    if (cantidad !== null) {
      this.state.actualizarCantidad(item.productoId, cantidad, item.itemTipo);
    }
  }

  private async pedirCantidadGranel(data: CantidadGranelDialogData): Promise<number | null> {
    const ref = this.dialog.open<CantidadGranelDialogComponent, CantidadGranelDialogData, number | null>(
      CantidadGranelDialogComponent,
      { data, autoFocus: false }
    );

    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }

  private itemTipoDe(item: CatalogoPosItem): VentaItemTipo {
    return item.tipo;
  }

  /** Una linea es de peso si su producto de catalogo esta marcado como granel. */
  protected esLineaGranel(item: CarritoItem): boolean {
    return (
      this.catalogoBase().find(
        (candidato) => candidato.id === item.productoId && this.itemTipoDe(candidato) === item.itemTipo
      )?.granel === true
    );
  }

  protected unidadLinea(item: CarritoItem): string {
    return (
      this.catalogoBase().find(
        (candidato) => candidato.id === item.productoId && this.itemTipoDe(candidato) === item.itemTipo
      )?.unidadAbreviatura ?? ''
    );
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

  /** Incremento de la linea: 1 por unidad, o el paso del producto si se vende por peso. */
  private pasoLinea(item: CarritoItem): number {
    const catalogo = this.catalogoBase().find(
      (candidato) => candidato.id === item.productoId && this.itemTipoDe(candidato) === item.itemTipo
    );

    return catalogo?.granel ? (catalogo.paso ?? this.pasoGranelDefecto()) : 1;
  }

  protected incrementar(productoId: string, itemTipo: VentaItemTipo): void {
    const item = this.state.carrito().items.find((current) => current.productoId === productoId && current.itemTipo === itemTipo);
    if (!item) {
      return;
    }

    const siguiente = redondearCantidad(item.cantidad + this.pasoLinea(item));

    if (
      item.itemTipo !== 'SERVICIO' &&
      !this.config().permitirVentaSinStock &&
      item.permitirInventarioNegativo !== true &&
      siguiente > item.stockDisponible
    ) {
      this.snackBar.open('No puedes exceder el stock disponible.', 'Cerrar', { duration: 2000 });
      return;
    }

    this.state.actualizarCantidad(productoId, siguiente, itemTipo);
  }

  protected decrementar(productoId: string, itemTipo: VentaItemTipo): void {
    const item = this.state.carrito().items.find((current) => current.productoId === productoId && current.itemTipo === itemTipo);
    if (!item) {
      return;
    }

    const siguiente = redondearCantidad(item.cantidad - this.pasoLinea(item));

    if (siguiente <= 0) {
      this.state.removerItem(productoId, itemTipo);
      return;
    }

    this.state.actualizarCantidad(productoId, siguiente, itemTipo);
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
    if (!pagos.some((pago) => pago.metodo === 'EFECTIVO')) {
      this.efectivoRecibido.set(null);
    }
  }

  protected etiquetaMetodoPago(metodo: string): string {
    const etiquetas: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      TARJETA_CREDITO: 'Tarjeta de crédito',
      TARJETA_DEBITO: 'Tarjeta de débito',
      TRANSFERENCIA: 'Transferencia',
      QR: 'QR',
      CREDITO_CLIENTE: 'Crédito del cliente'
    };
    return etiquetas[metodo] ?? metodo.replaceAll('_', ' ').toLocaleLowerCase('es');
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
    void this.finalizarCuentaRetenidaActiva();
    this.state.limpiar();
    this.busquedaClienteControl.setValue('');
    this.efectivoRecibido.set(null);
    this.vistaCompacta.set('productos');
  }

  protected mostrarVistaCompacta(vista: VistaPosCompacta): void {
    this.vistaCompacta.set(vista);
  }

  private singularizarEtiquetaCuenta(etiqueta: string): string {
    const limpia = etiqueta.trim() || 'Cuenta';
    const clave = limpia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    if (clave === 'ordenes') {
      return limpia[0] === limpia[0]?.toUpperCase() ? 'Orden' : 'orden';
    }
    if (limpia.length > 4 && /[aeiouáéíóú]s$/i.test(limpia)) {
      return limpia.slice(0, -1);
    }
    if (limpia.length > 4 && /es$/i.test(limpia)) {
      return limpia.slice(0, -2);
    }
    return limpia;
  }

  private pluralizarEtiquetaCuenta(etiqueta: string): string {
    return /[aeiouáéíóú]$/i.test(etiqueta) ? `${etiqueta}s` : `${etiqueta}es`;
  }

  protected ocultarImagenRota(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }

  protected setEfectivoRecibido(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.efectivoRecibido.set(Number.isFinite(raw) && raw > 0 ? this.roundToTwo(raw) : null);
  }

  /** Iguala lo recibido al importe asignado a efectivo, incluso en pagos mixtos. */
  protected efectivoExacto(): void {
    this.efectivoRecibido.set(this.montoPagoEfectivo());
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

    if (!(await this.validarRecetasParaCobro(this.state.carrito().items, sesion.almacenId))) {
      return;
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

      await this.finalizarCuentaRetenidaActiva();
      this.state.limpiar();
      this.busquedaClienteControl.setValue('');
      this.vistaCompacta.set('productos');
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
    const cuentaActiva = this.cuentaRetenidaActiva();
    const ahora = Date.now();
    const cuenta: CuentaAbierta = {
      id: cuentaActiva?.id ?? this.cuentasAbiertasService.crearCuentaId(),
      almacenId,
      etiqueta: cuentaActiva?.etiqueta
        ?? activeTab?.nombre?.trim()
        ?? `${this.etiquetaCuenta()} ${this.cuentasAbiertas().length + 1}`,
      carrito,
      abiertaPor: cuentaActiva?.abiertaPor ?? user.uid,
      abiertaPorNombre: cuentaActiva?.abiertaPorNombre ?? user.displayName ?? 'Sin nombre',
      abiertaEn: cuentaActiva?.abiertaEn ?? ahora,
      actualizadoEn: ahora,
      tomadaPorDispositivo: cuentaActiva?.tomadaPorDispositivo ?? null,
      tomadaPorUsuarioId: cuentaActiva?.tomadaPorUsuarioId ?? null,
      tomadaPorNombre: cuentaActiva?.tomadaPorNombre ?? null,
      tomadaEn: cuentaActiva?.tomadaEn ?? null
    };

    try {
      if (cuentaActiva) {
        const liberada = await this.cuentasAbiertasService.retenerCuentaReclamada(cuenta);
        if (!liberada) {
          this.snackBar.open('La cuenta ya no está asignada a este dispositivo.', 'Cerrar', { duration: 3200 });
          return;
        }
      } else {
        await this.cuentasAbiertasService.guardarCuenta(cuenta);
      }
      this.desvincularCuentaRetenidaLocal();
      this.state.limpiar();
      this.busquedaClienteControl.setValue('');
      this.vistaCompacta.set('productos');
      this.snackBar.open(`${this.etiquetaCuenta()} retenida.`, 'Cerrar', { duration: 2200 });
    } catch {
      this.snackBar.open('No se pudo retener la cuenta.', 'Cerrar', { duration: 2600 });
    }
  }

  /** Reclama atómicamente una cuenta y la mantiene visible como tomada en otras terminales. */
  protected async resumirCuenta(cuenta: CuentaAbierta): Promise<void> {
    if (this.state.carrito().items.length > 0) {
      this.snackBar.open('Limpia o retén la cuenta actual antes de retomar otra.', 'Cerrar', { duration: 2600 });
      return;
    }

    try {
      const user = this.auth.currentUser();
      if (!user) {
        return;
      }
      const resultado = await this.cuentasAbiertasService.reclamarCuenta(
        cuenta.almacenId,
        cuenta.id,
        user.uid,
        user.displayName ?? 'Sin nombre'
      );
      if (resultado.estado === 'OCUPADA') {
        this.snackBar.open(
          `Cuenta tomada por ${resultado.cuenta.tomadaPorNombre || 'otro dispositivo'}.`,
          'Cerrar',
          { duration: 3200 }
        );
        return;
      }
      if (resultado.estado === 'NO_EXISTE') {
        this.snackBar.open('La cuenta ya no está disponible.', 'Cerrar', { duration: 2600 });
        return;
      }

      this.cuentaRetenidaActiva.set(resultado.cuenta);
      this.state.cargarCarrito(resultado.cuenta.carrito);
      this.busquedaClienteControl.setValue(resultado.cuenta.carrito.clienteNombre ?? '');
    } catch {
      this.snackBar.open('No se pudo tomar la cuenta.', 'Cerrar', { duration: 2600 });
    }
  }

  protected async eliminarCuentaAbierta(cuenta: CuentaAbierta, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.cuentaTomadaPorOtro(cuenta)) {
      this.snackBar.open(
        `No puedes eliminarla: está tomada por ${cuenta.tomadaPorNombre || 'otro dispositivo'}.`,
        'Cerrar',
        { duration: 3000 }
      );
      return;
    }
    try {
      const eliminada = await this.cuentasAbiertasService.eliminarCuentaReclamada(cuenta.almacenId, cuenta.id);
      if (!eliminada) {
        this.snackBar.open('La cuenta fue tomada por otro dispositivo.', 'Cerrar', { duration: 2600 });
      }
    } catch {
      this.snackBar.open('No se pudo eliminar la cuenta.', 'Cerrar', { duration: 2400 });
    }
  }

  protected cuentaTomadaPorOtro(cuenta: CuentaAbierta): boolean {
    return this.cuentasAbiertasService.estaTomadaPorOtroDispositivo(cuenta);
  }

  protected cuentaTomadaAqui(cuenta: CuentaAbierta): boolean {
    return this.cuentasAbiertasService.estaTomadaPorEsteDispositivo(cuenta);
  }

  private programarSincronizacionCuentaRetenida(cuenta: CuentaAbierta): void {
    if (this.syncCuentaTimeout) {
      clearTimeout(this.syncCuentaTimeout);
    }
    this.syncCuentaTimeout = setTimeout(() => {
      this.syncCuentaTimeout = null;
      void this.sincronizarCuentaRetenidaAhora(cuenta);
    }, 600);
  }

  private async sincronizarCuentaRetenidaAhora(cuentaInput?: CuentaAbierta): Promise<void> {
    if (this.syncCuentaTimeout) {
      clearTimeout(this.syncCuentaTimeout);
      this.syncCuentaTimeout = null;
    }
    const activa = this.cuentaRetenidaActiva();
    if (!activa) {
      return;
    }
    const cuenta = {
      ...(cuentaInput ?? activa),
      carrito: this.state.carrito()
    };
    try {
      const actualizada = await this.cuentasAbiertasService.actualizarCuentaReclamada(cuenta);
      if (!actualizada && this.cuentaRetenidaActiva()?.id === cuenta.id) {
        this.desvincularCuentaRetenidaLocal();
        this.snackBar.open('La cuenta dejó de estar asignada a este dispositivo.', 'Cerrar', { duration: 3200 });
      }
    } catch {
      // El siguiente cambio o heartbeat reintentará la sincronización.
    }
  }

  private desvincularCuentaRetenidaLocal(): void {
    if (this.syncCuentaTimeout) {
      clearTimeout(this.syncCuentaTimeout);
      this.syncCuentaTimeout = null;
    }
    this.cuentaRetenidaActiva.set(null);
  }

  private async finalizarCuentaRetenidaActiva(): Promise<void> {
    const cuenta = this.cuentaRetenidaActiva();
    this.desvincularCuentaRetenidaLocal();
    if (!cuenta) {
      return;
    }
    try {
      const eliminada = await this.cuentasAbiertasService.eliminarCuentaReclamada(cuenta.almacenId, cuenta.id);
      if (!eliminada) {
        this.snackBar.open('La venta se realizó, pero la cuenta compartida requiere revisión.', 'Cerrar', { duration: 3500 });
      }
    } catch {
      this.snackBar.open('La venta se realizó, pero no se pudo cerrar la cuenta compartida.', 'Cerrar', { duration: 3500 });
    }
  }

  protected abrirCobroPorPartes(): void {
    if (this.state.carrito().items.length === 0) {
      this.snackBar.open('Agrega productos antes de cobrar por partes.', 'Cerrar', { duration: 2200 });
      return;
    }
    if (this.state.carrito().descuentoGlobal > 0) {
      this.snackBar.open(
        'Quita el descuento global antes de cobrar por partes. Los descuentos por artículo sí se conservarán.',
        'Cerrar',
        { duration: 4500 }
      );
      return;
    }
    if (!this.sesionActiva()?.id) {
      this.snackBar.open('No hay una sesión de caja activa.', 'Cerrar', { duration: 2300 });
      return;
    }

    this.comprasParcialesCompletadas.set(0);
    this.mensajeCobroParcial.set('');
    this.resetCobroParcialToken.update((token) => token + 1);
    this.cobroPorPartesActivo.set(true);
  }

  protected salirCobroPorPartes(): void {
    if (this.cobrando()) {
      return;
    }
    this.cobroPorPartesActivo.set(false);
    this.mensajeCobroParcial.set('');
  }

  protected async cobrarParte(request: CobroPorPartesRequest): Promise<void> {
    if (this.cobrando() || request.items.length === 0) {
      return;
    }

    const sesion = this.sesionActiva();
    const user = this.auth.currentUser();
    if (!sesion?.id || !sesion.almacenId || !user) {
      this.snackBar.open('No hay una sesión de caja activa.', 'Cerrar', { duration: 2300 });
      return;
    }

    const saldoActual = new Map(
      this.state.carrito().items.map((item) => [`${item.itemTipo}:${item.productoId}`, item.cantidad])
    );
    const seleccionInvalida = request.items.some((item) => {
      const disponible = saldoActual.get(`${item.itemTipo}:${item.productoId}`) ?? 0;
      return item.cantidad <= 0 || item.cantidad > disponible;
    });
    if (seleccionInvalida) {
      this.snackBar.open('La cuenta cambió. Revisa las cantidades pendientes e intenta nuevamente.', 'Cerrar', { duration: 3200 });
      this.resetCobroParcialToken.update((token) => token + 1);
      return;
    }

    this.cobrando.set(true);
    this.mensajeCobroParcial.set('');

    try {
      if (!(await this.validarRecetasParaCobro(request.items, sesion.almacenId))) {
        return;
      }

      const total = calcularResumenVenta(request.items, 0, this.config().impuestoPorDefecto).total;
      const ventaId = await this.ventasService.confirmarVenta({
        sesionId: sesion.id,
        almacenId: sesion.almacenId,
        vendedorId: user.uid,
        vendedorNombre: user.displayName ?? 'Sin nombre',
        clienteId: request.clienteId,
        clienteNombre: request.clienteNombre,
        items: request.items,
        pagos: [{
          metodo: request.metodoPago,
          monto: total,
          referencia: request.referencia
        }],
        descuentoGlobal: 0,
        impuestoPorcentaje: this.config().impuestoPorDefecto,
        notas: this.state.carrito().notas
      });

      // La venta ya existe: persistir primero el saldo evita repetirla si el SRI falla.
      this.state.descontarItemsCobrados(request.items);
      if (this.state.carrito().items.length === 0) {
        await this.finalizarCuentaRetenidaActiva();
      } else {
        await this.sincronizarCuentaRetenidaAhora();
      }
      this.comprasParcialesCompletadas.update((cantidad) => cantidad + 1);
      this.resetCobroParcialToken.update((token) => token + 1);

      let mensaje = `Compra realizada por ${total.toFixed(2)}.`;
      if (this.perfil()?.facturacionAutomatica) {
        const resultadoFactura = await this.emitirFacturaAuto(ventaId, sesion.almacenId);
        if (resultadoFactura === 'AUTORIZADA') {
          mensaje = `Compra realizada por ${total.toFixed(2)} y factura autorizada.`;
        } else if (resultadoFactura === 'SIN_CONFIG') {
          mensaje = `Compra realizada por ${total.toFixed(2)}. La factura queda pendiente por falta de firma.`;
        } else {
          mensaje = `Compra realizada por ${total.toFixed(2)}. La factura electrónica requiere revisión.`;
        }
      }

      this.mensajeCobroParcial.set(mensaje);
      if (this.state.carrito().items.length === 0) {
        this.cobroPorPartesActivo.set(false);
        this.busquedaClienteControl.setValue('');
        this.efectivoRecibido.set(null);
        this.snackBar.openFromComponent(SuccessSnackbarComponent, {
          data: {
            message: `${this.comprasParcialesCompletadas()} compra(s) realizadas. Cuenta completada.`,
            icon: 'task_alt'
          },
          duration: 3500,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar esta compra.';
      this.snackBar.open(message, 'Cerrar', { duration: 3500 });
    } finally {
      this.cobrando.set(false);
    }
  }

  private async validarRecetasParaCobro(items: CarritoItem[], almacenId: string): Promise<boolean> {
    const recetasConFaltantes: Array<{
      nombre: string;
      faltante: number;
      permite: boolean;
      detalle: string;
    }> = [];

    for (const item of items) {
      if (item.itemTipo !== 'RECETA') {
        continue;
      }

      const permite = item.permitirInventarioNegativo === true || this.config().permitirVentaSinStock;
      const validacion = await this.recetasService.validarRecetaParaVenta(
        item.productoId,
        almacenId,
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
      recetasConFaltantes.push({ nombre: item.nombre, faltante: faltanteRecetas, permite, detalle });
    }

    const recetaNoAutorizada = recetasConFaltantes.find((item) => !item.permite);
    if (recetaNoAutorizada) {
      this.snackBar.open(
        `Receta agotada: ${recetaNoAutorizada.nombre}. ${recetaNoAutorizada.detalle}`,
        'Cerrar',
        { duration: 6000 }
      );
      return false;
    }

    if (recetasConFaltantes.length === 0) {
      return true;
    }

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

    return (await firstValueFrom(dialogRef.afterClosed())) === true;
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

  protected reintentarAlmacenes(): void {
    this.avisoSinAlmacenesMostrado.set(false);
    this.almacenSesionService.recargar();
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

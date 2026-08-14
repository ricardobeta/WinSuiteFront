import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CamposCustomFormComponent } from '../../../../shared/components/campos-custom-form/campos-custom-form.component';
import {
  ImagenArchivoValor,
  SelectorImagenArchivoComponent
} from '../../../../shared/components/selector-imagen-archivo/selector-imagen-archivo.component';
import { TwoDecimalInputDirective } from '../../../../shared/directives/two-decimal-input.directive';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { IMAGEN_PRODUCTO_AYUDA } from '../../../../shared/utils/imagen.util';
import {
  Almacen,
  AtributoVariante,
  Categoria,
  ImagenProducto,
  MetodoCosteo,
  ModoVentaProducto,
  Producto,
  RecetaItem,
  TipoProductoInventario,
  Unidad,
  UsoProducto
} from '../../models/inventario.models';
import {
  MAX_ATRIBUTOS_VARIANTE,
  MAX_COMBINACIONES_VARIANTE,
  claveCombinacion,
  combinacionesVariantes,
  esUsableComoIngrediente,
  etiquetaVariante,
  skuVariante,
  slugAtributo
} from '../../utils/producto.util';
import { AlmacenesService } from '../../services/almacenes.service';
import { CamposInventarioService } from '../../services/campos-inventario.service';
import { CategoriasService } from '../../services/categorias.service';
import { ConfiguracionInventarioService } from '../../services/configuracion-inventario.service';
import { KardexService } from '../../services/kardex.service';
import { ProductosService } from '../../services/productos.service';
import { RecetasService } from '../../services/recetas.service';
import { UnidadesService } from '../../services/unidades.service';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTabsModule,
    CamposCustomFormComponent,
    SelectorImagenArchivoComponent,
    TwoDecimalInputDirective
  ],
  template: `
    <section class="form-page">
      <header class="surface-card header-card">
        <p class="eyebrow">Inventario</p>
        <h2>{{ esEdicion() ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <p>Completa la informacion base y los campos personalizados del producto.</p>
      </header>

      <section class="surface-card form-card">
        <form class="producto-form" [formGroup]="form" (ngSubmit)="guardar()">
          <mat-tab-group
            animationDuration="0ms"
            [selectedIndex]="pestanaActiva()"
            (selectedIndexChange)="pestanaActiva.set($event)"
          >
            <mat-tab>
              <ng-template mat-tab-label>
                General
                @if (erroresDe(camposGeneral) > 0) {
                  <span class="tab-badge">{{ erroresDe(camposGeneral) }}</span>
                }
              </ng-template>

              <section class="tab-body identidad">
                <div class="identidad-imagen">
                  <label class="campo-label">Imagen{{ imagenRequerida() ? ' *' : '' }}</label>
                  <app-selector-imagen-archivo
                    formControlName="imagen"
                    sourceModule="inventario-productos"
                    etiqueta="Imagen del producto"
                    [invalido]="imagenInvalida()"
                    [ayuda]="ayudaImagen()"
                  />
                </div>

                <div class="identidad-campos">
                  <div class="grid-2">
                    <mat-form-field appearance="outline">
                      <mat-label>SKU</mat-label>
                      <input matInput formControlName="sku" readonly />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Codigo de barras</mat-label>
                      <input matInput formControlName="codigoBarras" placeholder="EAN / UPC (opcional)" />
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline">
                    <mat-label>Nombre</mat-label>
                    <input matInput formControlName="nombre" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Descripcion</mat-label>
                    <textarea matInput rows="3" formControlName="descripcion"></textarea>
                  </mat-form-field>

                  <div class="grid-3">
                    <mat-form-field appearance="outline">
                      <mat-label>Tipo de producto</mat-label>
                      <mat-select formControlName="tipo">
                        <mat-option value="SIMPLE">Simple</mat-option>
                        <mat-option value="RECETA">Receta</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Categoria</mat-label>
                      <mat-select formControlName="categoriaId">
                        @for (categoria of categorias(); track categoria.id) {
                          <mat-option [value]="categoria.id">{{ categoria.nombre }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Unidad</mat-label>
                      <mat-select formControlName="unidadId">
                        @for (unidad of unidades(); track unidad.id) {
                          <mat-option [value]="unidad.id">{{ unidad.nombre }} ({{ unidad.abreviatura }})</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <mat-slide-toggle formControlName="activo">Activo</mat-slide-toggle>
                </div>
              </section>
            </mat-tab>

            <mat-tab>
              <ng-template mat-tab-label>
                Venta
                @if (erroresDe(camposVenta) > 0) {
                  <span class="tab-badge">{{ erroresDe(camposVenta) }}</span>
                }
              </ng-template>

              <section class="tab-body">
                <fieldset class="opciones">
                  <legend>Uso del producto</legend>
                  <mat-radio-group formControlName="usoProducto" class="opciones-grupo">
                    <mat-radio-button value="VENTA">
                      <span class="opcion-titulo">Producto de venta</span>
                      <span class="opcion-detalle">Aparece en el POS. Tambien puede usarse como ingrediente de recetas.</span>
                    </mat-radio-button>
                    <mat-radio-button value="INSUMO">
                      <span class="opcion-titulo">Materia prima</span>
                      <span class="opcion-detalle">No aparece en el POS ni en la tienda web. Solo se consume dentro de recetas.</span>
                    </mat-radio-button>
                  </mat-radio-group>
                </fieldset>

                @if (esInsumoSeleccionado()) {
                  <p class="hint hint-info">
                    <mat-icon>info</mat-icon>
                    Las materias primas no se cobran en caja, asi que no necesitan precio de venta ni imagen.
                    Siguen disponibles para recetas, ordenes de compra y kardex.
                  </p>
                } @else {
                  <fieldset class="opciones">
                    <legend>Modo de venta</legend>
                    <mat-radio-group formControlName="modoVenta" class="opciones-grupo">
                      <mat-radio-button value="UNIDAD">
                        <span class="opcion-titulo">Por unidad</span>
                        <span class="opcion-detalle">La caja suma de 1 en 1.</span>
                      </mat-radio-button>
                      <mat-radio-button value="GRANEL">
                        <span class="opcion-titulo">Por peso o medida</span>
                        <span class="opcion-detalle">
                          El cajero digita la cantidad con decimales. El precio se entiende por {{ unidadAbreviatura() }}.
                        </span>
                      </mat-radio-button>
                    </mat-radio-group>

                    @if (sugerirGranel()) {
                      <p class="hint hint-info">
                        <mat-icon>lightbulb</mat-icon>
                        La unidad seleccionada se mide por {{ tipoUnidadTexto() }}. Suele venderse por peso o medida.
                      </p>
                    }
                  </fieldset>

                  <div class="grid-3">
                    <mat-form-field appearance="outline">
                      <mat-label>Precio venta</mat-label>
                      <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioVenta" />
                      @if (esGranelSeleccionado()) {
                        <span matTextSuffix>&nbsp;/ {{ unidadAbreviatura() }}</span>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>IVA %</mat-label>
                      <input matInput type="number" min="0" max="100" formControlName="ivaPorcentaje" />
                    </mat-form-field>

                    @if (esGranelSeleccionado()) {
                      <mat-form-field appearance="outline">
                        <mat-label>Incremento en caja</mat-label>
                        <input matInput type="text" inputmode="decimal" formControlName="pasoCantidad" />
                        <span matTextSuffix>&nbsp;{{ unidadAbreviatura() }}</span>
                        <mat-hint>Cuanto suma o resta cada toque de +/- en el carrito.</mat-hint>
                      </mat-form-field>
                    }
                  </div>
                }
              </section>
            </mat-tab>

            <mat-tab>
              <ng-template mat-tab-label>
                Inventario
                @if (erroresDe(camposInventario) > 0) {
                  <span class="tab-badge">{{ erroresDe(camposInventario) }}</span>
                }
              </ng-template>

              <section class="tab-body">
                <div class="grid-4">
                  <mat-form-field appearance="outline">
                    <mat-label>Metodo costeo</mat-label>
                    <mat-select formControlName="metodoCosteo">
                      @for (metodo of metodosCosteo; track metodo) {
                        <mat-option [value]="metodo">{{ metodo }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Precio costo (opcional)</mat-label>
                    <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioCosto" placeholder="Se calcula por costeo" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Stock minimo</mat-label>
                    <input matInput type="number" min="0" formControlName="stockMinimo" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Stock maximo</mat-label>
                    <input matInput type="number" min="0" formControlName="stockMaximo" />
                  </mat-form-field>
                </div>

                @if (!esEdicion() && !esReceta()) {
                  <section class="custom-section">
                    <h3>Inventario inicial (opcional)</h3>
                    <mat-slide-toggle formControlName="registrarInventarioInicial">Registrar ingreso inicial</mat-slide-toggle>

                    @if (form.controls.registrarInventarioInicial.value) {
                      <div class="grid-3">
                        <mat-form-field appearance="outline">
                          <mat-label>Almacen destino</mat-label>
                          <mat-select formControlName="almacenInicialId">
                            @for (almacen of almacenes(); track almacen.id) {
                              <mat-option [value]="almacen.id">{{ almacen.nombre }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Cantidad inicial</mat-label>
                          <input matInput type="number" min="0" formControlName="cantidadInicial" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Costo unitario inicial</mat-label>
                          <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="costoUnitarioInicial" />
                        </mat-form-field>
                      </div>

                      <mat-form-field appearance="outline">
                        <mat-label>Notas ingreso inicial</mat-label>
                        <textarea matInput rows="2" formControlName="notasInventarioInicial"></textarea>
                      </mat-form-field>
                    }
                  </section>
                }
              </section>
            </mat-tab>

            @if (esReceta()) {
              <mat-tab>
                <ng-template mat-tab-label>
                  Receta
                  @if (erroresDe(camposReceta) > 0) {
                    <span class="tab-badge">{{ erroresDe(camposReceta) }}</span>
                  }
                </ng-template>

                <section class="tab-body">
                  <div class="section-header-row">
                    <h3>Ingredientes de receta</h3>
                    <button mat-stroked-button type="button" (click)="agregarIngrediente()">
                      <mat-icon>add</mat-icon>
                      Agregar ingrediente
                    </button>
                  </div>

                  @if (productosBaseDisponibles().length === 0) {
                    <p class="hint">No hay productos ni subrecetas activas para usar como ingredientes.</p>
                  }

                  @if (ingredientesReceta().length === 0) {
                    <p class="hint">Agrega al menos un ingrediente para definir la receta.</p>
                  } @else {
                    <section class="receta-grid receta-grid-head">
                      <span>Ingrediente</span>
                      <span>Cantidad</span>
                      <span>Unidad</span>
                      <span>Notas</span>
                      <span>Accion</span>
                    </section>

                    @for (group of ingredientesReceta().controls; track $index) {
                      <div class="receta-grid" [formGroup]="group">
                        <mat-form-field appearance="outline">
                          <mat-label>Ingrediente (producto o subreceta)</mat-label>
                          <mat-select formControlName="productoId" (selectionChange)="onIngredienteProductoChange($index)">
                            @for (producto of productosBaseDisponibles(); track producto.id) {
                              <mat-option [value]="producto.id">{{ producto.nombre }} · {{ producto.sku }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Cantidad</mat-label>
                          <input matInput type="number" min="0.0001" step="0.0001" formControlName="cantidad" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Unidad</mat-label>
                          <input matInput [value]="unidadNombre(group.controls.unidadId.value)" readonly />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notas" />
                        </mat-form-field>

                        <button mat-icon-button type="button" color="warn" (click)="removerIngrediente($index)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    }
                  }

                  <mat-slide-toggle formControlName="permitirInventarioNegativo">
                    Permitir inventario negativo con confirmacion en POS
                  </mat-slide-toggle>

                  <mat-form-field appearance="outline">
                    <mat-label>Notas de receta</mat-label>
                    <textarea matInput rows="2" formControlName="recetaNotas"></textarea>
                  </mat-form-field>
                </section>
              </mat-tab>
            }

            @if (puedeTenerVariantes()) {
              <mat-tab>
                <ng-template mat-tab-label>
                  Variantes
                  @if (variantesActivas()) {
                    <span class="tab-badge tab-badge-neutro">{{ combinaciones().length }}</span>
                  }
                </ng-template>

                <section class="tab-body">
                  <mat-slide-toggle
                    [checked]="variantesActivas()"
                    (change)="alternarVariantes($event.checked)"
                  >
                    Este producto tiene variantes
                  </mat-slide-toggle>

                  @if (!variantesActivas()) {
                    <p class="hint">
                      Activa esta opcion para vender el mismo producto en talla, color, sabor u otra
                      caracteristica. Cada combinacion tendra su propio SKU, precio y stock.
                    </p>
                  } @else {
                    <section class="custom-section">
                      <div class="section-header-row">
                        <h3>Ejes de variacion</h3>
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="atributos().length >= maxAtributos"
                          (click)="agregarAtributo()"
                        >
                          <mat-icon>add</mat-icon>
                          Agregar eje
                        </button>
                      </div>

                      @if (atributos().length >= maxAtributos) {
                        <p class="hint">Maximo {{ maxAtributos }} ejes: mas combinaciones son inoperables en una caja.</p>
                      }

                      @for (atributo of atributos(); track atributo.id; let indiceAtributo = $index) {
                        <article class="atributo-fila">
                          <mat-form-field appearance="outline" class="atributo-nombre">
                            <mat-label>Nombre del eje</mat-label>
                            <input
                              matInput
                              [value]="atributo.nombre"
                              placeholder="Talla, Color, Sabor"
                              (change)="renombrarAtributo(indiceAtributo, $event)"
                            />
                          </mat-form-field>

                          <div class="atributo-valores">
                            @for (valor of atributo.valores; track valor) {
                              <span class="valor-chip">
                                {{ valor }}
                                <button type="button" (click)="quitarValor(indiceAtributo, valor)" aria-label="Quitar valor">
                                  <mat-icon>close</mat-icon>
                                </button>
                              </span>
                            }

                            <input
                              class="valor-input"
                              placeholder="Escribe y pulsa Enter"
                              (keydown.enter)="agregarValor(indiceAtributo, $event)"
                              (blur)="agregarValor(indiceAtributo, $event)"
                            />
                          </div>

                          <button mat-icon-button type="button" color="warn" (click)="quitarAtributo(indiceAtributo)">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </article>
                      }
                    </section>

                    @if (combinaciones().length === 0) {
                      <p class="hint">Agrega al menos un valor a cada eje para generar las combinaciones.</p>
                    } @else {
                      <section class="custom-section">
                        <div class="section-header-row">
                          <h3>Combinaciones ({{ variantesSeleccionadas() }} de {{ combinaciones().length }})</h3>
                          <div class="acciones-masivas">
                            <mat-form-field appearance="outline" class="precio-masivo">
                              <mat-label>Precio para todas</mat-label>
                              <input matInput type="text" inputmode="decimal" appTwoDecimalInput [(ngModel)]="precioMasivo" [ngModelOptions]="{ standalone: true }" />
                            </mat-form-field>
                            <button mat-stroked-button type="button" (click)="aplicarPrecioATodas()">Aplicar</button>
                          </div>
                        </div>

                        @if (excedeTopeCombinaciones()) {
                          <p class="hint hint-error">
                            <mat-icon>error_outline</mat-icon>
                            {{ combinaciones().length }} combinaciones superan el tope de {{ maxCombinaciones }}.
                            Reduce los valores de algun eje.
                          </p>
                        }

                        <div class="variantes-tabla">
                          <div class="variante-fila variante-cabecera">
                            <span></span>
                            <span>Variante</span>
                            <span>SKU</span>
                            <span>Cod. barras</span>
                            <span>Precio</span>
                            @if (esReceta()) {
                              <span>Factor receta</span>
                            } @else {
                              <span>Stock inicial</span>
                            }
                          </div>

                          @for (fila of filasVariantes().controls; track fila.value.clave) {
                            <div class="variante-fila" [formGroup]="fila">
                              <mat-slide-toggle formControlName="generar" />
                              <span class="variante-etiqueta">
                                {{ fila.value.etiqueta }}
                                @if (fila.value.existeId) {
                                  <span class="variante-badge">ya creada</span>
                                }
                              </span>
                              <mat-form-field appearance="outline">
                                <input matInput formControlName="sku" />
                              </mat-form-field>
                              <mat-form-field appearance="outline">
                                <input matInput formControlName="codigoBarras" />
                              </mat-form-field>
                              <mat-form-field appearance="outline">
                                <input matInput type="text" inputmode="decimal" appTwoDecimalInput formControlName="precioVenta" />
                              </mat-form-field>
                              @if (esReceta()) {
                                <mat-form-field appearance="outline">
                                  <input matInput type="number" min="0.01" step="0.01" formControlName="factorReceta" />
                                </mat-form-field>
                              } @else {
                                <mat-form-field appearance="outline">
                                  <input matInput type="number" min="0" formControlName="stockInicial" [readonly]="!!fila.value.existeId" />
                                </mat-form-field>
                              }
                            </div>
                          }
                        </div>

                        <p class="hint">
                          Al desmarcar una variante ya creada se desactiva, no se borra: conserva su kardex
                          y sus ventas historicas.
                        </p>
                      </section>
                    }
                  }
                </section>
              </mat-tab>
            }

            @if (camposCustom().length > 0) {
              <mat-tab>
                <ng-template mat-tab-label>
                  Adicional
                  @if (erroresDe(camposAdicional) > 0) {
                    <span class="tab-badge">{{ erroresDe(camposAdicional) }}</span>
                  }
                </ng-template>

                <section class="tab-body">
                  <app-campos-custom-form
                    formControlName="camposPersonalizados"
                    [campos]="camposCustom()"
                  />
                </section>
              </mat-tab>
            }
          </mat-tab-group>

          <div class="actions-row">
            <a mat-button routerLink="/workspace/inventario/productos">Cancelar</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando...' : (esEdicion() ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .form-page { display: grid; gap: 1rem; }
    .header-card, .form-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .producto-form { display: grid; gap: 1rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .custom-section { display: grid; gap: .75rem; border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); padding-top: 1rem; }
    .custom-section h3 { margin: 0; }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; gap: .75rem; }
    .receta-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr auto; gap: .75rem; align-items: center; }
    .receta-grid-head { color: var(--muted-foreground); font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
    .hint { margin: 0; color: var(--muted-foreground); }
    .actions-row { display: flex; justify-content: flex-end; gap: .75rem; }

    .tab-body { display: grid; gap: 1rem; padding: 1.25rem .25rem .25rem; }
    .tab-badge {
      display: inline-grid; place-items: center;
      min-width: 18px; height: 18px; margin-left: .4rem; padding: 0 .3rem;
      border-radius: 999px; font-size: .7rem; font-weight: 600; line-height: 1;
      background: var(--tc-error); color: var(--tc-on-error, #fff);
    }
    .identidad { grid-template-columns: minmax(0, 220px) minmax(0, 1fr); align-items: start; gap: 1.5rem; }
    .identidad-imagen { display: grid; gap: .4rem; }
    .identidad-campos { display: grid; gap: 1rem; }
    .campo-label { font-size: .8rem; color: var(--muted-foreground); }

    .opciones { border: 0; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .opciones legend { padding: 0; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-foreground); }
    .opciones-grupo { display: grid; gap: .5rem; }
    .opciones-grupo mat-radio-button { align-items: flex-start; }
    .opcion-titulo { display: block; font-weight: 600; }
    .opcion-detalle { display: block; font-size: .82rem; color: var(--muted-foreground); }

    .hint-info { display: flex; align-items: flex-start; gap: .4rem; font-size: .85rem; }
    .hint-info mat-icon { font-size: 18px; width: 18px; height: 18px; flex: none; margin-top: .1rem; }
    .hint-error { display: flex; align-items: center; gap: .4rem; color: var(--tc-error); font-size: .85rem; }
    .hint-error mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tab-badge-neutro { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary); }

    .atributo-fila { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr) auto; gap: .75rem; align-items: start; }
    .atributo-nombre { margin: 0; }
    .atributo-valores {
      display: flex; flex-wrap: wrap; align-items: center; gap: .4rem;
      min-height: 56px; padding: .5rem .6rem;
      border-radius: 8px; background: var(--tc-surface-container-low);
    }
    .valor-chip {
      display: inline-flex; align-items: center; gap: .2rem;
      padding: .2rem .3rem .2rem .6rem; border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      color: var(--primary); font-size: .82rem; font-weight: 600;
    }
    .valor-chip button { display: grid; place-items: center; border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
    .valor-chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .valor-input { flex: 1 1 140px; min-width: 120px; border: 0; background: transparent; color: inherit; font: inherit; outline: none; }

    .acciones-masivas { display: flex; align-items: center; gap: .5rem; }
    .precio-masivo { width: 170px; margin-bottom: -1.25rem; }
    /* La matriz no colapsa a una columna: se desplaza dentro de su caja para que
       la fila siga leyendose como fila y la pagina nunca scrollee en horizontal. */
    .variantes-tabla { display: grid; gap: .4rem; overflow-x: auto; }
    .variante-fila { display: grid; grid-template-columns: auto minmax(140px, 1.4fr) minmax(130px, 1.2fr) minmax(130px, 1.2fr) minmax(100px, .9fr) minmax(100px, .9fr); gap: .6rem; align-items: center; min-width: 720px; }
    .variante-cabecera { color: var(--muted-foreground); font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; }
    .variante-fila mat-form-field { margin-bottom: -1.25rem; }
    .variante-etiqueta { font-weight: 600; }
    .variante-badge {
      margin-left: .35rem; padding: .1rem .4rem; border-radius: 999px;
      background: color-mix(in srgb, var(--foreground) 10%, transparent);
      color: var(--muted-foreground); font-size: .68rem; font-weight: 600;
    }

    @media (max-width: 900px) {
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
      .identidad { grid-template-columns: 1fr; }
      .section-header-row { flex-direction: column; align-items: flex-start; }
      .receta-grid { grid-template-columns: 1fr; }
      .actions-row { justify-content: flex-start; }
    }
  `]
})
export class ProductoFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly productosService = inject(ProductosService);
  private readonly configuracionService = inject(ConfiguracionInventarioService);
  private readonly almacenesService = inject(AlmacenesService);
  private readonly camposService = inject(CamposInventarioService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly kardexService = inject(KardexService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly recetasService = inject(RecetasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly guardando = signal(false);
  protected readonly productoId = signal<string | null>(null);
  protected readonly esEdicion = computed(() => !!this.productoId());
  protected readonly metodosCosteo: MetodoCosteo[] = ['FIFO', 'LIFO', 'PROMEDIO'];
  protected readonly camposCustom = signal<CampoPersonalizado[]>([]);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly productosCatalogo = signal<Producto[]>([]);
  protected readonly productoOriginal = signal<Producto | null>(null);
  protected readonly tipoProducto = signal<TipoProductoInventario>('SIMPLE');
  protected readonly esReceta = computed(() => this.tipoProducto() === 'RECETA');
  protected readonly productosBaseDisponibles = computed(() =>
    this.productosCatalogo()
      // Las plantillas de variantes quedan fuera: no tienen stock propio.
      // Los insumos SI entran, que es justamente para lo que existen.
      .filter((producto) => esUsableComoIngrediente(producto))
      .filter((producto) => !!producto.id && producto.id !== this.productoId())
  );
  private skuPrefix = 'PROD-';
  private pasoGranelDefecto = 0.1;

  protected readonly pestanaActiva = signal(0);
  protected readonly usoSeleccionado = signal<UsoProducto>('VENTA');
  protected readonly modoVentaSeleccionado = signal<ModoVentaProducto>('UNIDAD');
  protected readonly unidadSeleccionadaId = signal('');
  protected readonly requerirImagen = signal(false);
  protected readonly imagenTocada = signal(false);

  /** Una variante concreta no puede a su vez desplegarse en mas variantes. */
  protected readonly esVarianteHija = computed(() => !!this.productoOriginal()?.productoPadreId);
  protected readonly esInsumoSeleccionado = computed(() => this.usoSeleccionado() === 'INSUMO');
  protected readonly esGranelSeleccionado = computed(() => this.modoVentaSeleccionado() === 'GRANEL');

  private readonly unidadSeleccionada = computed(() =>
    this.unidades().find((unidad) => unidad.id === this.unidadSeleccionadaId()) ?? null
  );

  protected readonly unidadAbreviatura = computed(() => this.unidadSeleccionada()?.abreviatura ?? 'unidad');

  /** La unidad se mide en magnitud continua, asi que suele venderse fraccionada. */
  private readonly unidadEsFraccionable = computed(() => {
    const tipo = this.unidadSeleccionada()?.tipo;
    return tipo === 'MASA' || tipo === 'VOLUMEN' || tipo === 'LONGITUD';
  });

  protected readonly tipoUnidadTexto = computed(() => {
    switch (this.unidadSeleccionada()?.tipo) {
      case 'MASA':
        return 'peso';
      case 'VOLUMEN':
        return 'volumen';
      case 'LONGITUD':
        return 'longitud';
      default:
        return 'medida';
    }
  });

  /** Sugerencia, no imposicion: hay quien vende botellas de 1 L por unidad. */
  protected readonly sugerirGranel = computed(() => this.unidadEsFraccionable() && !this.esGranelSeleccionado());

  protected readonly imagenRequerida = computed(() => this.requerirImagen() && !this.esInsumoSeleccionado());
  protected readonly imagenInvalida = computed(
    () => this.imagenRequerida() && this.imagenTocada() && !this.form.controls.imagen.value
  );
  protected readonly ayudaImagen = computed(() =>
    this.imagenRequerida()
      ? `Obligatoria para productos de venta. ${IMAGEN_PRODUCTO_AYUDA}`
      : `Opcional, se muestra en las tarjetas del POS. ${IMAGEN_PRODUCTO_AYUDA}`
  );

  /** Agrupacion de controles por pestana, para el badge de errores y el salto al guardar. */
  protected readonly camposGeneral = ['sku', 'codigoBarras', 'nombre', 'descripcion', 'tipo', 'categoriaId', 'unidadId', 'imagen'];
  protected readonly camposVenta = ['usoProducto', 'modoVenta', 'pasoCantidad', 'precioVenta', 'ivaPorcentaje'];
  protected readonly camposInventario = [
    'metodoCosteo',
    'precioCosto',
    'stockMinimo',
    'stockMaximo',
    'almacenInicialId',
    'cantidadInicial',
    'costoUnitarioInicial'
  ];
  protected readonly camposReceta = ['recetaItems', 'recetaNotas'];
  protected readonly camposAdicional = ['camposPersonalizados'];

  // --- Variantes -----------------------------------------------------------
  protected readonly maxAtributos = MAX_ATRIBUTOS_VARIANTE;
  protected readonly maxCombinaciones = MAX_COMBINACIONES_VARIANTE;
  protected readonly variantesActivas = signal(false);
  protected readonly atributos = signal<AtributoVariante[]>([]);
  protected precioMasivo = 0;
  /** Variantes ya existentes en RTDB, indexadas por combinacion. */
  private readonly variantesExistentes = signal<Record<string, Producto>>({});

  /** Solo un producto de venta que no sea ya una variante puede desplegarse. */
  protected readonly puedeTenerVariantes = computed(
    () => !this.esInsumoSeleccionado() && !this.esVarianteHija()
  );

  protected readonly combinaciones = computed(() => combinacionesVariantes(this.atributos()));

  protected readonly excedeTopeCombinaciones = computed(
    () => this.combinaciones().length > MAX_COMBINACIONES_VARIANTE
  );

  protected readonly variantesSeleccionadas = computed(() =>
    this.filasVariantesSignal().filter((fila) => fila.generar).length
  );

  /** Espejo en signal de la FormArray, para que los computed reaccionen. */
  private readonly filasVariantesSignal = signal<Array<{ clave: string; generar: boolean }>>([]);

  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', [Validators.required]],
    codigoBarras: [''],
    nombre: ['', [Validators.required]],
    descripcion: [''],
    tipo: ['SIMPLE' as TipoProductoInventario, [Validators.required]],
    categoriaId: ['', [Validators.required]],
    unidadId: ['', [Validators.required]],
    metodoCosteo: ['PROMEDIO' as MetodoCosteo, [Validators.required]],
    precioCosto: [0, [Validators.min(0)]],
    precioVenta: [0, [Validators.required, Validators.min(0)]],
    ivaPorcentaje: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    stockMaximo: [0, [Validators.min(0)]],
    activo: [true],
    permitirInventarioNegativo: [false],
    usoProducto: ['VENTA' as UsoProducto, [Validators.required]],
    modoVenta: ['UNIDAD' as ModoVentaProducto, [Validators.required]],
    pasoCantidad: [0.1, [Validators.min(0.001)]],
    imagen: this.formBuilder.control<ImagenArchivoValor | null>(null),
    recetaNotas: [''],
    recetaItems: this.formBuilder.array([
    ] as Array<ReturnType<ProductoFormComponent['createIngredienteGroup']>>),
    registrarInventarioInicial: [false],
    almacenInicialId: [''],
    cantidadInicial: [0, [Validators.min(0)]],
    costoUnitarioInicial: [0, [Validators.min(0)]],
    notasInventarioInicial: [''],
    camposPersonalizados: this.formBuilder.control<Record<string, any>>({}),
    variantes: this.formBuilder.array([] as Array<ReturnType<ProductoFormComponent['createVarianteGroup']>>)
  });

  async ngOnInit(): Promise<void> {
    const config = await this.configuracionService.getConfiguracionOnce();
    this.skuPrefix = config.prefijoSKU || 'PROD-';
    this.pasoGranelDefecto = config.pasoCantidadGranelDefecto;
    this.requerirImagen.set(config.requerirImagenProductoVenta === true);
    this.form.patchValue({
      ivaPorcentaje: this.safePercent(config.impuestoPorDefecto),
      pasoCantidad: config.pasoCantidadGranelDefecto
    });
    this.aplicarValidadorImagen();

    this.camposService
      .getCampos('producto')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        this.camposCustom.set(campos.filter((campo) => campo.activo !== false));
      });

    this.categoriasService
      .getCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categorias) => {
        this.categorias.set(categorias.filter((categoria) => categoria.activo !== false));
      });

    this.unidadesService
      .getUnidades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unidades) => {
        this.unidades.set(unidades.filter((unidad) => unidad.activo !== false));
      });

    this.form.controls.unidadId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unidadId) => this.unidadSeleccionadaId.set(unidadId ?? ''));

    this.form.controls.usoProducto.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uso) => {
        const siguiente: UsoProducto = uso === 'INSUMO' ? 'INSUMO' : 'VENTA';
        this.usoSeleccionado.set(siguiente);

        // Una materia prima no se cobra en caja: no tiene sentido su modo de venta.
        if (siguiente === 'INSUMO') {
          this.form.patchValue({ modoVenta: 'UNIDAD' }, { emitEvent: false });
          this.modoVentaSeleccionado.set('UNIDAD');
        }

        this.aplicarValidadorImagen();
      });

    this.form.controls.modoVenta.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modo) => this.modoVentaSeleccionado.set(modo === 'GRANEL' ? 'GRANEL' : 'UNIDAD'));

    // El contador "N de M" vive en un computed, asi que necesita ver los toggles.
    this.form.controls.variantes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sincronizarEspejoVariantes());

    this.productosService
      .getProductos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productos) => {
        this.productosCatalogo.set(productos);

        // El catalogo llega despues del producto que se esta editando, asi que la
        // matriz de variantes se reindexa en cuanto hay datos con que enlazarla.
        const padre = this.productoOriginal();
        if (padre) {
          this.cargarVariantesExistentes(padre);
        }
      });

    this.form.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => {
        const next = tipo ?? 'SIMPLE';
        this.tipoProducto.set(next);

        if (next === 'RECETA') {
          this.form.patchValue({
            registrarInventarioInicial: false,
            cantidadInicial: 0,
            costoUnitarioInicial: 0,
            notasInventarioInicial: ''
          }, { emitEvent: false });
        }

        if (next === 'RECETA' && this.ingredientesReceta().length === 0) {
          this.agregarIngrediente();
        }
      });

    this.almacenesService
      .getAlmacenesActivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((almacenes) => {
        this.almacenes.set(almacenes);

        const defaultAlmacen = almacenes.find((almacen) => almacen.esPorDefecto) ?? almacenes[0];
        if (!this.form.controls.almacenInicialId.value && defaultAlmacen?.id) {
          this.form.patchValue({ almacenInicialId: defaultAlmacen.id }, { emitEvent: false });
        }
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      const tipoParam = this.route.snapshot.queryParamMap.get('tipo');
      const tipoInicial: TipoProductoInventario = tipoParam === 'RECETA' ? 'RECETA' : 'SIMPLE';

      this.form.patchValue({ tipo: tipoInicial }, { emitEvent: true });
      this.tipoProducto.set(tipoInicial);

      if (tipoInicial === 'RECETA' && this.ingredientesReceta().length === 0) {
        this.agregarIngrediente();
      }

      this.form.patchValue({ sku: this.generarSku() });
      return;
    }

    this.productoId.set(id);
    const producto = await this.productosService.getProductoById(id);
    if (!producto) {
      return;
    }

    this.productoOriginal.set(producto);

    this.form.patchValue({
      sku: producto.sku,
      codigoBarras: producto.codigoBarras ?? '',
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      tipo: producto.tipo ?? 'SIMPLE',
      categoriaId: producto.categoriaId,
      unidadId: producto.unidadId,
      metodoCosteo: producto.metodoCosteo,
      precioCosto: producto.precioCosto,
      precioVenta: producto.precioVenta,
      ivaPorcentaje: this.safePercent(producto.ivaPorcentaje),
      stockMinimo: producto.stockMinimo,
      stockMaximo: producto.stockMaximo ?? 0,
      activo: producto.activo,
      permitirInventarioNegativo: producto.permitirInventarioNegativo === true,
      usoProducto: producto.usoProducto === 'INSUMO' ? 'INSUMO' : 'VENTA',
      modoVenta: producto.modoVenta === 'GRANEL' ? 'GRANEL' : 'UNIDAD',
      pasoCantidad: this.safePaso(producto.pasoCantidad),
      imagen: producto.imagen?.url ? producto.imagen : null,
      recetaNotas: producto.recetaNotas ?? '',
      camposPersonalizados: producto.camposPersonalizados ?? {}
    });
    this.tipoProducto.set(producto.tipo ?? 'SIMPLE');
    this.usoSeleccionado.set(producto.usoProducto === 'INSUMO' ? 'INSUMO' : 'VENTA');
    this.modoVentaSeleccionado.set(producto.modoVenta === 'GRANEL' ? 'GRANEL' : 'UNIDAD');
    this.unidadSeleccionadaId.set(producto.unidadId ?? '');
    this.aplicarValidadorImagen();

    this.ingredientesReceta().clear();
    (producto.recetaItems ?? []).forEach((item) => {
      this.ingredientesReceta().push(this.createIngredienteGroup(item));
    });

    this.form.patchValue({
      registrarInventarioInicial: false,
      cantidadInicial: 0,
      costoUnitarioInicial: this.safeNumber(producto.precioCosto),
      notasInventarioInicial: ''
    }, { emitEvent: false });

    if ((producto.tipo ?? 'SIMPLE') === 'RECETA' && this.ingredientesReceta().length === 0) {
      this.agregarIngrediente();
    }

    this.cargarVariantesExistentes(producto);
  }

  /** Indexa las variantes ya creadas por combinacion y reconstruye la matriz. */
  private cargarVariantesExistentes(padre: Producto): void {
    const atributos = padre.atributosVariante ?? [];
    if (atributos.length === 0) {
      return;
    }

    this.atributos.set(atributos);
    this.variantesActivas.set(true);

    const hijos = this.productosCatalogo().filter((producto) => producto.productoPadreId === padre.id);
    const index: Record<string, Producto> = {};

    for (const hijo of hijos) {
      if (hijo.valoresVariante) {
        index[claveCombinacion(hijo.valoresVariante)] = hijo;
      }
    }

    this.variantesExistentes.set(index);
    this.regenerarMatriz();
  }

  protected async guardar(): Promise<void> {
    if (this.guardando()) {
      return;
    }

    this.imagenTocada.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saltarAPrimeraPestanaConError();
      return;
    }

    if (!(await this.confirmarCambioAInsumo())) {
      return;
    }

    this.guardando.set(true);

    try {
      const raw = this.form.getRawValue();
      const recetaItems = this.normalizarRecetaItems(raw.recetaItems);
      await this.validarRecetaPayload(raw.tipo, recetaItems);

      const esInsumoPayload = raw.usoProducto === 'INSUMO';
      const esGranelPayload = !esInsumoPayload && raw.modoVenta === 'GRANEL';

      const payload: Omit<Producto, 'id'> = {
        sku: raw.sku || this.generarSku(),
        codigoBarras: (raw.codigoBarras ?? '').trim(),
        nombre: raw.nombre,
        descripcion: raw.descripcion || '',
        tipo: raw.tipo,
        categoriaId: raw.categoriaId,
        unidadId: raw.unidadId,
        metodoCosteo: raw.metodoCosteo,
        precioCosto: this.safeNumber(raw.precioCosto),
        precioVenta: Number(raw.precioVenta),
        ivaPorcentaje: this.safePercent(raw.ivaPorcentaje),
        stockMinimo: raw.tipo === 'RECETA' ? 0 : Number(raw.stockMinimo),
        stockMaximo: raw.tipo === 'RECETA' ? 0 : Number(raw.stockMaximo || 0),
        activo: raw.activo,
        permitirInventarioNegativo: raw.tipo === 'RECETA' ? raw.permitirInventarioNegativo : false,
        usoProducto: esInsumoPayload ? 'INSUMO' : 'VENTA',
        modoVenta: esGranelPayload ? 'GRANEL' : 'UNIDAD',
        pasoCantidad: esGranelPayload ? this.safePaso(raw.pasoCantidad) : 1,
        imagen: esInsumoPayload ? null : this.normalizarImagen(raw.imagen),
        recetaNotas: raw.tipo === 'RECETA' ? (raw.recetaNotas || '') : '',
        recetaItems: raw.tipo === 'RECETA' ? recetaItems : [],
        camposPersonalizados: raw.camposPersonalizados ?? {}
      };

      const generaVariantes = this.variantesActivas() && this.combinaciones().length > 0;

      if (generaVariantes) {
        if (this.excedeTopeCombinaciones()) {
          throw new Error(`No se pueden generar mas de ${MAX_COMBINACIONES_VARIANTE} combinaciones.`);
        }

        // El padre es solo una plantilla: no lleva stock ni inventario inicial.
        payload.atributosVariante = this.atributos().filter((atributo) => atributo.valores.length > 0);
        payload.stockMinimo = 0;
        payload.stockMaximo = 0;
      } else {
        payload.atributosVariante = [];
      }

      const id = this.productoId();
      if (id) {
        await this.productosService.actualizarProducto(id, payload);
        await this.registrarAuditoriaRecetaSiAplica(id, payload, this.productoOriginal());

        if (generaVariantes) {
          await this.sincronizarVariantes(id, payload);
        }
      } else {
        const nuevoProductoId = await this.productosService.crearProducto(payload);
        await this.registrarAuditoriaRecetaSiAplica(nuevoProductoId, payload, null);

        if (generaVariantes) {
          await this.sincronizarVariantes(nuevoProductoId, payload);
        } else {
          await this.registrarInventarioInicialSiAplica(nuevoProductoId, payload);
        }
      }

      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Producto guardado correctamente.', icon: 'inventory_2' },
        duration: 2400,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/workspace/inventario/productos']);
    } finally {
      this.guardando.set(false);
    }
  }

  private generarSku(): string {
    const prefix = (this.skuPrefix || 'PROD-').trim() || 'PROD-';
    const base = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}${base}-${random}`;
  }

  /** Cantidad de controles invalidos de una pestana, para el badge de la etiqueta. */
  protected erroresDe(campos: string[]): number {
    return campos.filter((campo) => {
      const control = this.form.get(campo);
      return !!control && control.invalid && (control.touched || control.dirty);
    }).length;
  }

  /**
   * Con pestanas, un error escondido deja el boton sin efecto aparente.
   * Al guardar se salta a la primera pestana que lo contenga.
   */
  private saltarAPrimeraPestanaConError(): void {
    const grupos: string[][] = [this.camposGeneral, this.camposVenta, this.camposInventario];

    if (this.esReceta()) {
      grupos.push(this.camposReceta);
    }

    if (this.camposCustom().length > 0) {
      grupos.push(this.camposAdicional);
    }

    const indice = grupos.findIndex((campos) =>
      campos.some((campo) => this.form.get(campo)?.invalid === true)
    );

    if (indice >= 0) {
      this.pestanaActiva.set(indice);
    }

    this.snackBar.open('Revisa los campos marcados antes de guardar.', 'Cerrar', { duration: 3000 });
  }

  /** La imagen solo es obligatoria para productos que se cobran en caja. */
  private aplicarValidadorImagen(): void {
    const control = this.form.controls.imagen;

    if (this.imagenRequerida()) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private normalizarImagen(valor: ImagenArchivoValor | null): ImagenProducto | null {
    if (!valor?.url) {
      return null;
    }

    // RTDB rechaza `undefined`: las claves opcionales ausentes se omiten del objeto.
    const imagen: ImagenProducto = { url: valor.url };

    if (valor.archivoId) {
      imagen.archivoId = valor.archivoId;
    }

    if (valor.storagePath) {
      imagen.storagePath = valor.storagePath;
    }

    return imagen;
  }

  private safePaso(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.pasoGranelDefecto;
  }

  /** Pasar de venta a insumo saca el producto del POS: se avisa antes. */
  private async confirmarCambioAInsumo(): Promise<boolean> {
    const original = this.productoOriginal();
    const eraVenta = !original || original.usoProducto !== 'INSUMO';
    const seraInsumo = this.form.controls.usoProducto.value === 'INSUMO';

    if (!original || !eraVenta || !seraInsumo) {
      return true;
    }

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Convertir en materia prima',
        message:
          `"${original.nombre}" dejara de aparecer en el POS y en la tienda web. ` +
          'Seguira disponible para recetas, ordenes de compra y kardex.',
        confirmText: 'Convertir',
        cancelText: 'Cancelar'
      }
    });

    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  protected ingredientesReceta(): FormArray<ReturnType<ProductoFormComponent['createIngredienteGroup']>> {
    return this.form.controls.recetaItems;
  }

  protected agregarIngrediente(): void {
    this.ingredientesReceta().push(this.createIngredienteGroup());
  }

  protected removerIngrediente(index: number): void {
    this.ingredientesReceta().removeAt(index);
  }

  protected onIngredienteProductoChange(index: number): void {
    const group = this.ingredientesReceta().at(index);
    const productoId = group.controls.productoId.value;
    const producto = this.productosCatalogo().find((item) => item.id === productoId);
    if (!producto) {
      return;
    }

    group.controls.unidadId.setValue(producto.unidadId);
  }

  protected unidadNombre(unidadId: string): string {
    const unidad = this.unidades().find((item) => item.id === unidadId);
    if (!unidad) {
      return 'Sin unidad';
    }

    return `${unidad.nombre} (${unidad.abreviatura})`;
  }

  // --- Variantes: edicion de ejes y matriz ---------------------------------

  protected filasVariantes(): FormArray<ReturnType<ProductoFormComponent['createVarianteGroup']>> {
    return this.form.controls.variantes;
  }

  private createVarianteGroup(datos: {
    clave: string;
    etiqueta: string;
    valores: Record<string, string>;
    existeId: string;
    generar: boolean;
    sku: string;
    codigoBarras: string;
    precioVenta: number;
    stockInicial: number;
    factorReceta: number;
  }) {
    return this.formBuilder.nonNullable.group({
      clave: [datos.clave],
      etiqueta: [datos.etiqueta],
      valores: this.formBuilder.control<Record<string, string>>(datos.valores),
      existeId: [datos.existeId],
      generar: [datos.generar],
      sku: [datos.sku, [Validators.required]],
      codigoBarras: [datos.codigoBarras],
      precioVenta: [datos.precioVenta, [Validators.required, Validators.min(0)]],
      stockInicial: [datos.stockInicial, [Validators.min(0)]],
      factorReceta: [datos.factorReceta, [Validators.min(0.0001)]]
    });
  }

  protected alternarVariantes(activo: boolean): void {
    this.variantesActivas.set(activo);

    if (activo && this.atributos().length === 0) {
      this.agregarAtributo();
      return;
    }

    if (!activo) {
      this.filasVariantes().clear();
      this.sincronizarEspejoVariantes();
    }
  }

  protected agregarAtributo(): void {
    if (this.atributos().length >= MAX_ATRIBUTOS_VARIANTE) {
      return;
    }

    this.atributos.update((actuales) => [
      ...actuales,
      { id: `eje-${actuales.length + 1}`, nombre: '', valores: [] }
    ]);
    this.regenerarMatriz();
  }

  protected quitarAtributo(indice: number): void {
    this.atributos.update((actuales) => actuales.filter((_, i) => i !== indice));
    this.regenerarMatriz();
  }

  protected renombrarAtributo(indice: number, evento: Event): void {
    const nombre = (evento.target as HTMLInputElement).value.trim();
    const slug = slugAtributo(nombre);

    this.atributos.update((actuales) =>
      actuales.map((atributo, i) =>
        i === indice
          ? { ...atributo, nombre, id: slug || `eje-${indice + 1}` }
          : atributo
      )
    );
    this.regenerarMatriz();
  }

  protected agregarValor(indice: number, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valor = input.value.trim();
    input.value = '';

    if (!valor) {
      return;
    }

    this.atributos.update((actuales) =>
      actuales.map((atributo, i) =>
        i === indice && !atributo.valores.includes(valor)
          ? { ...atributo, valores: [...atributo.valores, valor] }
          : atributo
      )
    );
    this.regenerarMatriz();
  }

  protected quitarValor(indice: number, valor: string): void {
    this.atributos.update((actuales) =>
      actuales.map((atributo, i) =>
        i === indice ? { ...atributo, valores: atributo.valores.filter((v) => v !== valor) } : atributo
      )
    );
    this.regenerarMatriz();
  }

  protected aplicarPrecioATodas(): void {
    const precio = Number(this.precioMasivo);
    if (!Number.isFinite(precio) || precio < 0) {
      return;
    }

    this.filasVariantes().controls.forEach((fila) => fila.controls.precioVenta.setValue(precio));
  }

  /**
   * Reconstruye la matriz conservando lo que el usuario ya edito y enlazando
   * cada combinacion con la variante que ya exista en RTDB.
   */
  private regenerarMatriz(): void {
    const combinaciones = this.combinaciones();
    const existentes = this.variantesExistentes();
    const anteriores = new Map(
      this.filasVariantes().controls.map((fila) => [fila.controls.clave.value, fila.getRawValue()])
    );

    const skuBase = this.form.controls.sku.value;
    const precioBase = Number(this.form.controls.precioVenta.value ?? 0);
    const atributos = this.atributos();

    this.filasVariantes().clear();

    for (const valores of combinaciones) {
      const clave = claveCombinacion(valores);
      const previa = anteriores.get(clave);
      const existente = existentes[clave];

      this.filasVariantes().push(
        this.createVarianteGroup({
          clave,
          etiqueta: etiquetaVariante({ valoresVariante: valores }, atributos),
          valores,
          existeId: existente?.id ?? '',
          // Una variante ya creada arranca marcada; desmarcarla la desactiva.
          generar: previa?.generar ?? true,
          sku: previa?.sku || existente?.sku || skuVariante(skuBase, valores, atributos),
          codigoBarras: previa?.codigoBarras || existente?.codigoBarras || '',
          precioVenta: previa?.precioVenta ?? existente?.precioVenta ?? precioBase,
          stockInicial: previa?.stockInicial ?? 0,
          factorReceta: previa?.factorReceta ?? 1
        })
      );
    }

    this.sincronizarEspejoVariantes();
  }

  /**
   * Crea las variantes nuevas, actualiza las existentes y desactiva las desmarcadas.
   * Nunca borra: una variante desmarcada conserva su kardex y sus ventas.
   */
  private async sincronizarVariantes(padreId: string, padre: Omit<Producto, 'id'>): Promise<void> {
    const atributos = padre.atributosVariante ?? [];
    const nuevas: Array<Omit<Producto, 'id'>> = [];
    const stockInicialPendiente: Array<{ indice: number; cantidad: number; costo: number }> = [];
    const actualizaciones: Array<{ id: string; cambios: Partial<Producto> }> = [];

    for (const fila of this.filasVariantes().controls) {
      const datos = fila.getRawValue();

      if (!datos.generar) {
        // Solo tiene sentido desactivar lo que ya existe.
        if (datos.existeId) {
          actualizaciones.push({ id: datos.existeId, cambios: { activo: false } });
        }
        continue;
      }

      const comun: Partial<Producto> = {
        sku: datos.sku.trim(),
        codigoBarras: (datos.codigoBarras ?? '').trim(),
        nombre: `${padre.nombre} · ${datos.etiqueta}`,
        precioVenta: Number(datos.precioVenta) || 0,
        activo: padre.activo,
        productoPadreId: padreId,
        valoresVariante: datos.valores ?? {},
        // Todo lo comercial se hereda del padre para no dejar variantes descoordinadas.
        descripcion: padre.descripcion,
        tipo: padre.tipo,
        categoriaId: padre.categoriaId,
        unidadId: padre.unidadId,
        metodoCosteo: padre.metodoCosteo,
        ivaPorcentaje: padre.ivaPorcentaje,
        usoProducto: padre.usoProducto,
        modoVenta: padre.modoVenta,
        pasoCantidad: padre.pasoCantidad,
        imagen: padre.imagen ?? null,
        permitirInventarioNegativo: padre.permitirInventarioNegativo,
        recetaNotas: padre.recetaNotas,
        recetaItems: this.escalarRecetaItems(padre.recetaItems ?? [], Number(datos.factorReceta) || 1)
      };

      if (datos.existeId) {
        actualizaciones.push({ id: datos.existeId, cambios: comun });
        continue;
      }

      nuevas.push({
        ...(comun as Omit<Producto, 'id'>),
        precioCosto: padre.precioCosto,
        stockMinimo: padre.stockMinimo,
        stockMaximo: padre.stockMaximo ?? 0,
        camposPersonalizados: padre.camposPersonalizados ?? {}
      });

      const cantidad = Number(datos.stockInicial) || 0;
      if (cantidad > 0 && padre.tipo !== 'RECETA') {
        stockInicialPendiente.push({
          indice: nuevas.length - 1,
          cantidad,
          costo: Number(padre.precioCosto) || 0
        });
      }
    }

    if (actualizaciones.length > 0) {
      await this.productosService.actualizarProductosLote(actualizaciones);
    }

    if (nuevas.length === 0) {
      return;
    }

    const idsCreados = await this.productosService.crearProductosLote(nuevas);

    const almacenId = this.form.controls.almacenInicialId.value;
    if (!almacenId) {
      return;
    }

    for (const pendiente of stockInicialPendiente) {
      await this.kardexService.registrarIngresoInicial({
        productoId: idsCreados[pendiente.indice],
        almacenId,
        cantidad: pendiente.cantidad,
        costoUnitario: pendiente.costo,
        notas: 'Ingreso inicial desde generacion de variantes',
        userId: this.authService.currentUser()?.uid ?? 'sistema'
      });
    }
  }

  /**
   * Una variante de receta consume los mismos ingredientes escalados por su factor:
   * la Familiar (x1.5) gasta un 50% mas que la receta base.
   */
  private escalarRecetaItems(items: RecetaItem[], factor: number): RecetaItem[] {
    if (items.length === 0) {
      return [];
    }

    const multiplicador = Number.isFinite(factor) && factor > 0 ? factor : 1;

    return items.map((item) => ({
      ...item,
      cantidad: Math.round(item.cantidad * multiplicador * 10000) / 10000
    }));
  }

  private sincronizarEspejoVariantes(): void {
    this.filasVariantesSignal.set(
      this.filasVariantes().controls.map((fila) => ({
        clave: fila.controls.clave.value,
        generar: fila.controls.generar.value
      }))
    );
  }

  private createIngredienteGroup(item?: Partial<RecetaItem>) {
    return this.formBuilder.nonNullable.group({
      productoId: [item?.productoId ?? '', [Validators.required]],
      cantidad: [this.safeCantidad(item?.cantidad), [Validators.required, Validators.min(0.0001)]],
      unidadId: [item?.unidadId ?? '', [Validators.required]],
      notas: [item?.notas ?? '']
    });
  }

  private safeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private safePercent(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.min(100, Math.max(0, parsed));
  }

  private safeCantidad(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private normalizarRecetaItems(items: Array<{ productoId: string; cantidad: number; unidadId: string; notas: string }>): RecetaItem[] {
    return items
      .map((item) => ({
        productoId: item.productoId,
        cantidad: this.safeCantidad(item.cantidad),
        unidadId: item.unidadId,
        notas: (item.notas ?? '').trim()
      }))
      .filter((item) => item.productoId.trim().length > 0);
  }

  private async validarRecetaPayload(tipo: TipoProductoInventario, items: RecetaItem[]): Promise<void> {
    if (tipo !== 'RECETA') {
      return;
    }

    if (items.length === 0) {
      throw new Error('Una receta debe tener al menos un ingrediente.');
    }

    const ids = new Set<string>();

    for (const item of items) {
      if (ids.has(item.productoId)) {
        throw new Error('No se permite repetir un ingrediente en la receta.');
      }

      ids.add(item.productoId);

      const producto = await this.productosService.getProductoById(item.productoId);
      if (!producto) {
        throw new Error('Uno de los ingredientes seleccionados no existe.');
      }

      const tipoIngrediente = producto.tipo ?? 'SIMPLE';
      if (tipoIngrediente !== 'SIMPLE' && tipoIngrediente !== 'RECETA') {
        throw new Error('Ingrediente invalido. Solo se permiten productos o subrecetas.');
      }

      const recetaActualId = this.productoId();
      if (recetaActualId && item.productoId === recetaActualId) {
        throw new Error('Una receta no puede incluirse a si misma.');
      }

      if (recetaActualId && tipoIngrediente === 'RECETA') {
        const contieneObjetivo = await this.recetaContieneObjetivo(item.productoId, recetaActualId);
        if (contieneObjetivo) {
          throw new Error('La subreceta seleccionada genera una referencia circular.');
        }
      }

      if (producto.unidadId !== item.unidadId) {
        throw new Error(`La unidad del ingrediente ${producto.nombre} no coincide con su configuracion base.`);
      }
    }
  }

  private async recetaContieneObjetivo(recetaId: string, objetivoId: string, visited = new Set<string>()): Promise<boolean> {
    if (recetaId === objetivoId) {
      return true;
    }

    if (visited.has(recetaId)) {
      return false;
    }

    visited.add(recetaId);

    const receta = await this.productosService.getProductoById(recetaId);
    if (!receta || (receta.tipo ?? 'SIMPLE') !== 'RECETA') {
      return false;
    }

    for (const item of receta.recetaItems ?? []) {
      if (item.productoId === objetivoId) {
        return true;
      }

      const ingrediente = await this.productosService.getProductoById(item.productoId);
      if (!ingrediente || (ingrediente.tipo ?? 'SIMPLE') !== 'RECETA') {
        continue;
      }

      const encontrado = await this.recetaContieneObjetivo(item.productoId, objetivoId, visited);
      if (encontrado) {
        return true;
      }
    }

    return false;
  }

  private async registrarAuditoriaRecetaSiAplica(
    recetaId: string,
    payload: Omit<Producto, 'id'>,
    original: Producto | null
  ): Promise<void> {
    const userId = this.authService.currentUser()?.uid ?? 'sistema';
    const eraReceta = (original?.tipo ?? 'SIMPLE') === 'RECETA';
    const esReceta = (payload.tipo ?? 'SIMPLE') === 'RECETA';

    if (!eraReceta && !esReceta) {
      return;
    }

    if (esReceta) {
      await this.recetasService.registrarAuditoriaReceta({
        recetaId,
        accion: original ? 'EDITADA' : 'CREADA',
        cambiosAntes: original ? this.auditPayloadFromProducto(original) : undefined,
        cambiosDespues: this.auditPayloadFromProducto(payload),
        creadoPor: userId
      });

      const beforeItems = JSON.stringify((original?.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      })));
      const afterItems = JSON.stringify((payload.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      })));

      if (beforeItems !== afterItems) {
        await this.recetasService.registrarAuditoriaReceta({
          recetaId,
          accion: 'INGREDIENTES_CAMBIADOS',
          cambiosAntes: { recetaItems: original?.recetaItems ?? [] },
          cambiosDespues: { recetaItems: payload.recetaItems ?? [] },
          creadoPor: userId
        });
      }

      return;
    }

    await this.recetasService.registrarAuditoriaReceta({
      recetaId,
      accion: 'DESHABILITADA',
      cambiosAntes: this.auditPayloadFromProducto(original),
      cambiosDespues: this.auditPayloadFromProducto(payload),
      creadoPor: userId
    });
  }

  private auditPayloadFromProducto(producto: Partial<Producto> | null): Record<string, any> {
    if (!producto) {
      return {};
    }

    return {
      tipo: producto.tipo ?? 'SIMPLE',
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      permitirInventarioNegativo: producto.permitirInventarioNegativo === true,
      recetaNotas: producto.recetaNotas ?? '',
      recetaItems: (producto.recetaItems ?? []).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        unidadId: item.unidadId,
        notas: item.notas ?? ''
      }))
    };
  }

  private async registrarInventarioInicialSiAplica(productoId: string, payload: Omit<Producto, 'id'>): Promise<void> {
    if ((payload.tipo ?? 'SIMPLE') === 'RECETA') {
      return;
    }

    if (!this.form.controls.registrarInventarioInicial.value) {
      return;
    }

    const almacenId = this.form.controls.almacenInicialId.value;
    const cantidad = Number(this.form.controls.cantidadInicial.value ?? 0);
    const costo = Number(this.form.controls.costoUnitarioInicial.value ?? payload.precioCosto ?? 0);

    if (!almacenId) {
      throw new Error('Selecciona un almacen para registrar inventario inicial.');
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error('La cantidad inicial debe ser mayor a cero.');
    }

    if (!Number.isFinite(costo) || costo < 0) {
      throw new Error('El costo unitario inicial no puede ser negativo.');
    }

    await this.kardexService.registrarIngresoInicial({
      productoId,
      almacenId,
      cantidad,
      costoUnitario: costo,
      notas: this.form.controls.notasInventarioInicial.value || 'Ingreso inicial desde alta de producto',
      userId: this.authService.currentUser()?.uid ?? 'sistema'
    });
  }
}

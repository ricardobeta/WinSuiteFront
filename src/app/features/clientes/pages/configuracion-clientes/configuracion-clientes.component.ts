import { CommonModule } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfigScreenContext } from '../../../../core/services/ai-config-copilot.service';
import {
  ConfiguracionClientesService,
  normalizarConfiguracionClientes,
  ordenFormularioPredeterminado
} from '../../../../core/services/configuracion-clientes.service';
import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { ConfigCopilotPanelComponent } from '../../../../shared/components/config-copilot-panel/config-copilot-panel.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  EtiquetaClienteDialogComponent,
  EtiquetaClienteDialogData
} from '../../../../shared/components/etiqueta-cliente-dialog/etiqueta-cliente-dialog.component';
import { EtiquetaClienteChipComponent } from '../../../../shared/components/etiqueta-cliente-chip/etiqueta-cliente-chip.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import {
  CampoFormularioClienteKey,
  CampoPersonalizado,
  ConfiguracionClientes,
  EtiquetaClienteConfig
} from '../../../../shared/models/clientes.models';
import { textoComparableEtiqueta } from '../../../../shared/utils/etiquetas-clientes.utils';

interface ItemOrdenFormulario {
  key: CampoFormularioClienteKey;
  nombre: string;
  detalle: string;
  icono: string;
  personalizado: boolean;
  activo: boolean;
}

const CAMPOS_BASE: Record<string, Omit<ItemOrdenFormulario, 'key'>> = {
  nombreCompleto: { nombre: 'Nombre completo', detalle: 'Campo base · obligatorio', icono: 'badge', personalizado: false, activo: true },
  email: { nombre: 'Correo electrónico', detalle: 'Campo base · obligatorio', icono: 'mail', personalizado: false, activo: true },
  telefono: { nombre: 'Teléfono', detalle: 'Campo base', icono: 'call', personalizado: false, activo: true },
  direccion: { nombre: 'Dirección', detalle: 'Campo base', icono: 'location_on', personalizado: false, activo: true },
  identificacion: { nombre: 'Identificación', detalle: 'Tipo y número · bloque indivisible', icono: 'fingerprint', personalizado: false, activo: true },
  etiquetas: { nombre: 'Etiquetas', detalle: 'Selector desde el catálogo', icono: 'sell', personalizado: false, activo: true }
};

@Component({
  selector: 'app-configuracion-clientes',
  standalone: true,
  imports: [
    CommonModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ConfigCopilotPanelComponent,
    EtiquetaClienteChipComponent
  ],
  template: `
    <section class="config-page" aria-labelledby="clientes-config-title">
      <header class="page-header">
        <div class="page-copy">
          <p class="eyebrow">Clientes</p>
          <h2 id="clientes-config-title">Configuración</h2>
          <p>Adapta cómo tu equipo clasifica y registra la información de cada cliente.</p>
        </div>
        <div class="header-actions">
          <span class="summary-pill"><mat-icon>sell</mat-icon>{{ etiquetasActivas().length }} etiquetas</span>
          <span class="summary-pill"><mat-icon>tune</mat-icon>{{ configuracion().camposPersonalizados.length }} campos</span>
          <app-config-copilot-panel [context]="copilotContext" [ejemplos]="copilotEjemplos" />
        </div>
      </header>

      @if (estadoCarga() === 'loading') {
        <div class="state-panel surface-card" role="status">
          <mat-spinner diameter="36" />
          <div><strong>Cargando configuración</strong><p>Estamos preparando etiquetas y campos.</p></div>
        </div>
      } @else if (estadoCarga() === 'error') {
        <div class="state-panel state-error surface-card" role="alert">
          <mat-icon>cloud_off</mat-icon>
          <div><strong>No pudimos cargar la configuración</strong><p>Revisa tu conexión y vuelve a intentarlo.</p></div>
          <button mat-stroked-button type="button" (click)="cargarConfiguracion()">Reintentar</button>
        </div>
      } @else {
        <div class="config-surface surface-card">
          <mat-tab-group animationDuration="180ms" mat-stretch-tabs="false" aria-label="Áreas de configuración de clientes">
            <mat-tab>
              <ng-template mat-tab-label><mat-icon>sell</mat-icon><span>Etiquetas</span></ng-template>
              <section class="tab-content" aria-labelledby="tags-heading">
                <div class="section-heading">
                  <div><h3 id="tags-heading">Catálogo de etiquetas</h3><p>Crea una clasificación consistente para segmentar a tus clientes.</p></div>
                  <button mat-flat-button color="primary" type="button" (click)="agregarEtiqueta()"><mat-icon>add</mat-icon>Nueva etiqueta</button>
                </div>

                @if (configuracion().catalogoEtiquetas.length > 0) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
                    <mat-label>Buscar etiqueta</mat-label>
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput [value]="busquedaEtiqueta()" (input)="actualizarBusqueda($event)" />
                    @if (busquedaEtiqueta()) {
                      <button mat-icon-button matSuffix type="button" aria-label="Limpiar búsqueda" (click)="busquedaEtiqueta.set('')"><mat-icon>close</mat-icon></button>
                    }
                  </mat-form-field>

                  <div class="tag-list" role="list" aria-label="Etiquetas configuradas">
                    @for (etiqueta of etiquetasFiltradas(); track etiqueta.idEtiqueta) {
                      <article class="tag-row" [class.is-inactive]="!etiqueta.activa" role="listitem">
                        <div class="tag-identity">
                          <app-etiqueta-cliente-chip [valor]="etiqueta.idEtiqueta" [catalogo]="configuracion().catalogoEtiquetas" [mostrarEstado]="false" />
                          <span>
                            @if (etiqueta.origenFormularioId) { Administrada por un formulario de Sitios }
                            @else { {{ etiqueta.activa ? 'Disponible para asignar' : 'Desactivada · se conserva en clientes' }} }
                          </span>
                        </div>
                        <div class="row-actions">
                          <button mat-icon-button type="button" [disabled]="!!etiqueta.origenFormularioId" [attr.aria-label]="'Editar ' + etiqueta.nombre" [matTooltip]="etiqueta.origenFormularioId ? 'Cambia el nombre desde el formulario de Sitios' : 'Editar etiqueta'" (click)="editarEtiqueta(etiqueta)"><mat-icon>edit</mat-icon></button>
                          @if (etiqueta.activa) {
                            <button mat-icon-button type="button" [disabled]="!!etiqueta.origenFormularioId" [attr.aria-label]="'Desactivar ' + etiqueta.nombre" [matTooltip]="etiqueta.origenFormularioId ? 'Desactiva primero la sincronización del formulario' : 'Desactivar etiqueta'" (click)="desactivarEtiqueta(etiqueta)"><mat-icon>visibility_off</mat-icon></button>
                          } @else {
                            <button mat-icon-button type="button" color="primary" [attr.aria-label]="'Reactivar ' + etiqueta.nombre" matTooltip="Reactivar etiqueta" (click)="reactivarEtiqueta(etiqueta)"><mat-icon>refresh</mat-icon></button>
                          }
                        </div>
                      </article>
                    } @empty {
                      <div class="compact-empty"><mat-icon>search_off</mat-icon><p>No hay etiquetas que coincidan con la búsqueda.</p></div>
                    }
                  </div>
                } @else {
                  <div class="empty-state"><mat-icon>new_label</mat-icon><h4>Crea tu primera etiqueta</h4><p>Empieza con categorías útiles como “VIP”, “Mayorista” o “Seguimiento”.</p><button mat-stroked-button type="button" (click)="agregarEtiqueta()">Crear etiqueta</button></div>
                }
              </section>
            </mat-tab>

            <mat-tab>
              <ng-template mat-tab-label><mat-icon>tune</mat-icon><span>Campos personalizados</span></ng-template>
              <section class="tab-content" aria-labelledby="fields-heading">
                <div class="section-heading">
                  <div><h3 id="fields-heading">Información adicional</h3><p>Los campos activos estarán disponibles al crear o editar clientes.</p></div>
                  <button mat-flat-button color="primary" type="button" (click)="agregarCampo()"><mat-icon>add</mat-icon>Agregar campo</button>
                </div>
                @if (configuracion().camposPersonalizados.length > 0) {
                  <div class="table-wrap"><table mat-table [dataSource]="dataSource" class="fields-table">
                    <ng-container matColumnDef="nombreMostrar"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let row"><strong>{{ row.nombreMostrar }}</strong></td></ng-container>
                    <ng-container matColumnDef="tipo"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let row">{{ nombreTipo(row.tipo) }}</td></ng-container>
                    <ng-container matColumnDef="opciones"><th mat-header-cell *matHeaderCellDef>Opciones</th><td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">{{ formatearOpciones(row) }}</td></ng-container>
                    <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="status-list">@if (row.requerido) { <span>Obligatorio</span> }@if (row.visibleEnLista) { <span>En la lista</span> }@if (row.activo === false) { <span class="off">Desactivado</span> }</span></td></ng-container>
                    <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef><span class="visually-hidden">Acciones</span></th><td mat-cell *matCellDef="let row"><div class="row-actions"><button mat-icon-button type="button" [attr.aria-label]="'Editar ' + row.nombreMostrar" matTooltip="Editar campo" (click)="editarCampo(row)"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" type="button" [attr.aria-label]="'Eliminar ' + row.nombreMostrar" matTooltip="Eliminar campo" (click)="eliminarCampo(row)"><mat-icon>delete_outline</mat-icon></button></div></td></ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnasVisibles"></tr><tr mat-row *matRowDef="let row; columns: columnasVisibles"></tr>
                  </table></div>
                  <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons />
                } @else {
                  <div class="empty-state"><mat-icon>playlist_add</mat-icon><h4>Aún no hay campos personalizados</h4><p>Agrega datos como sector, fecha de aniversario o preferencias.</p><button mat-stroked-button type="button" (click)="agregarCampo()">Agregar primer campo</button></div>
                }
              </section>
            </mat-tab>

            <mat-tab>
              <ng-template mat-tab-label><mat-icon>view_agenda</mat-icon><span>Orden del formulario</span></ng-template>
              <section class="tab-content" aria-labelledby="order-heading">
                <div class="section-heading order-heading">
                  <div><h3 id="order-heading">Diseña el recorrido de captura</h3><p>Arrastra los campos para colocarlos en el orden en que tu equipo los necesita.</p></div>
                  <div class="order-actions">
                    <button mat-button type="button" (click)="restablecerOrden()">Restablecer</button>
                    <button mat-flat-button color="primary" type="button" [disabled]="!ordenModificado() || guardandoOrden()" (click)="guardarOrden()">
                      @if (guardandoOrden()) { <mat-spinner diameter="18" /> } @else { <mat-icon>save</mat-icon> }
                      Guardar orden
                    </button>
                  </div>
                </div>

                <div class="order-workbench">
                  <div class="order-editor">
                    <div class="editor-caption"><strong>Campos del formulario</strong><span>{{ itemsOrden().length }} elementos</span></div>
                    <div cdkDropList class="order-list" [cdkDropListData]="ordenBorrador()" (cdkDropListDropped)="soltarCampo($event)">
                      @for (item of itemsOrden(); track item.key; let index = $index) {
                        <article cdkDrag class="order-item" [class.is-inactive]="!item.activo">
                          <div class="drag-placeholder" *cdkDragPlaceholder></div>
                          <button cdkDragHandle type="button" class="drag-handle" [attr.aria-label]="'Arrastrar ' + item.nombre" matTooltip="Arrastrar para mover"><mat-icon>drag_indicator</mat-icon></button>
                          <span class="field-icon"><mat-icon>{{ item.icono }}</mat-icon></span>
                          <div class="field-copy"><strong>{{ item.nombre }}</strong><span>{{ item.detalle }}</span></div>
                          @if (item.personalizado) { <span class="custom-mark">Personalizado</span> }
                          <div class="move-actions">
                            <button mat-icon-button type="button" [disabled]="index === 0" [attr.aria-label]="'Subir ' + item.nombre" (click)="moverCampo(index, -1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                            <button mat-icon-button type="button" [disabled]="index === itemsOrden().length - 1" [attr.aria-label]="'Bajar ' + item.nombre" (click)="moverCampo(index, 1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                          </div>
                        </article>
                      }
                    </div>
                  </div>

                  <aside class="form-preview" aria-label="Vista previa del orden del formulario">
                    <div class="preview-head"><span class="preview-icon"><mat-icon>person_edit</mat-icon></span><div><strong>Vista previa</strong><p>Nuevo cliente</p></div></div>
                    <ol>
                      @for (item of itemsOrdenActivos(); track item.key) {
                        <li><span>{{ $index + 1 }}</span><mat-icon>{{ item.icono }}</mat-icon><strong>{{ item.nombre }}</strong></li>
                      }
                    </ol>
                    <p class="preview-note"><mat-icon>info</mat-icon>La identificación mantiene juntos el tipo y el número.</p>
                  </aside>
                </div>
              </section>
            </mat-tab>
          </mat-tab-group>
        </div>
      }
    </section>
  `,
  styles: [`
    .config-page { display: grid; gap: 1rem; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding: .25rem; }
    .page-header h2 { margin: 0; font-family: var(--tc-font-family-heading); font-size: clamp(1.55rem, 2vw, 2rem); letter-spacing: -.025em; }
    .page-header p { max-width: 68ch; margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem !important; color: var(--primary) !important; font-size: .72rem; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    .header-actions { display: flex; align-items: center; justify-content: flex-end; gap: .55rem; flex-wrap: wrap; }
    .summary-pill { display: inline-flex; min-height: 34px; align-items: center; gap: .35rem; padding: .2rem .7rem; border-radius: 999px; background: var(--tc-surface-container-low); color: var(--muted-foreground); font-size: .78rem; font-weight: 700; white-space: nowrap; }
    .summary-pill mat-icon { width: 17px; height: 17px; color: var(--primary); font-size: 17px; }
    .config-surface { overflow: hidden; padding: .4rem 1.5rem 1.5rem; border-radius: 16px; background: var(--tc-surface-container-lowest); box-shadow: var(--tc-elevation-1); }
    mat-tab-group { --mat-tab-header-divider-color: transparent; }
    :host ::ng-deep .mat-mdc-tab { min-height: 54px; }
    :host ::ng-deep .mat-mdc-tab .mdc-tab__content { gap: .45rem; }
    .tab-content { display: grid; gap: 1.25rem; min-height: 420px; padding: 1.5rem .1rem .2rem; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .section-heading h3 { margin: 0; font-family: var(--tc-font-family-heading); font-size: 1.18rem; letter-spacing: -.015em; }
    .section-heading p { max-width: 70ch; margin: .3rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    .search-field { width: min(420px, 100%); }
    .tag-list { display: grid; gap: .55rem; }
    .tag-row { display: flex; min-height: 66px; align-items: center; justify-content: space-between; gap: 1rem; padding: .65rem .75rem .65rem 1rem; border-radius: 13px; background: var(--tc-surface-container-low); transition: background-color 160ms ease-out, opacity 160ms ease-out; }
    .tag-row:hover { background: color-mix(in srgb, var(--tc-surface-container-highest) 68%, var(--tc-surface-container-low)); }
    .tag-row.is-inactive { opacity: .72; }
    .tag-identity { display: flex; min-width: 0; align-items: center; gap: .85rem; }
    .tag-identity > span { color: var(--muted-foreground); font-size: .78rem; }
    .row-actions, .move-actions, .order-actions { display: flex; align-items: center; gap: .15rem; }
    .row-actions button, .move-actions button { width: 44px; height: 44px; }
    .table-wrap { overflow: auto; border-radius: 12px; }
    .fields-table { width: 100%; min-width: 760px; }
    .fields-table th { color: var(--muted-foreground); font-size: .72rem; font-weight: 750; letter-spacing: .035em; text-transform: uppercase; }
    .fields-table tbody tr { background: var(--tc-surface-container-lowest); }
    .fields-table tbody tr:hover { background: var(--tc-surface-container-low); }
    .options-cell { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-list { display: inline-flex; gap: .35rem; flex-wrap: wrap; }
    .status-list span, .custom-mark { padding: .14rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-size: .7rem; font-weight: 700; white-space: nowrap; }
    .status-list .off { background: var(--tc-surface-container-highest); color: var(--muted-foreground); }
    .empty-state, .compact-empty { display: grid; justify-items: center; gap: .6rem; padding: 3rem 1rem; border-radius: 14px; background: var(--tc-surface-container-low); text-align: center; }
    .empty-state mat-icon, .compact-empty mat-icon { width: 42px; height: 42px; color: var(--muted-foreground); font-size: 42px; }
    .empty-state h4, .empty-state p, .compact-empty p { margin: 0; }
    .empty-state p, .compact-empty p { max-width: 56ch; color: var(--muted-foreground); }
    .state-panel { display: flex; min-height: 130px; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; border-radius: 16px; }
    .state-panel strong { display: block; }.state-panel p { margin: .2rem 0 0; color: var(--muted-foreground); }
    .state-error { justify-content: flex-start; }.state-error > mat-icon { width: 34px; height: 34px; color: var(--tc-error); font-size: 34px; }.state-error button { margin-left: auto; }
    .order-heading { align-items: end; }
    .order-actions button[mat-flat-button] { min-width: 144px; }
    .order-actions mat-spinner { display: inline-block; margin-right: .35rem; }
    .order-workbench { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .7fr); gap: 1.25rem; align-items: start; }
    .order-editor, .form-preview { border-radius: 15px; background: var(--tc-surface-container-low); }
    .order-editor { padding: .75rem; }
    .editor-caption { display: flex; align-items: center; justify-content: space-between; padding: .3rem .35rem .8rem; }
    .editor-caption span { color: var(--muted-foreground); font-size: .76rem; }
    .order-list { display: grid; gap: .48rem; }
    .order-item { display: grid; min-height: 64px; grid-template-columns: 44px 38px minmax(0, 1fr) auto 88px; align-items: center; gap: .45rem; padding: .35rem .4rem; border-radius: 12px; background: var(--tc-surface-container-lowest); box-shadow: 0 6px 18px rgb(45 51 53 / 4%); }
    .order-item.is-inactive { opacity: .6; }
    .drag-handle { display: grid; width: 44px; height: 44px; padding: 0; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--muted-foreground); cursor: grab; }
    .drag-handle:active { cursor: grabbing; }.drag-handle:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent); }
    .field-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
    .field-icon mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .field-copy { display: grid; min-width: 0; gap: .15rem; }.field-copy strong, .field-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.field-copy span { color: var(--muted-foreground); font-size: .75rem; }
    .custom-mark { margin-right: .2rem; }
    .drag-placeholder { min-height: 64px; border-radius: 12px; background: color-mix(in srgb, var(--primary) 12%, var(--tc-surface-container-low)); }
    .cdk-drag-preview { border-radius: 12px; box-shadow: 0 18px 42px rgb(45 51 53 / 18%); }
    .cdk-drag-animating { transition: transform 180ms cubic-bezier(.2,.8,.2,1); }
    .order-list.cdk-drop-list-dragging .order-item:not(.cdk-drag-placeholder) { transition: transform 180ms cubic-bezier(.2,.8,.2,1); }
    .form-preview { position: sticky; top: 1rem; overflow: hidden; padding: 1rem; }
    .preview-head { display: flex; align-items: center; gap: .7rem; padding: .2rem .1rem .9rem; }.preview-head p { margin: .1rem 0 0; color: var(--muted-foreground); font-size: .76rem; }
    .preview-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; background: var(--tc-primary-container); color: var(--tc-on-primary-container); }
    .form-preview ol { display: grid; gap: .4rem; margin: 0; padding: 0; list-style: none; }
    .form-preview li { display: grid; min-height: 42px; grid-template-columns: 24px 24px minmax(0, 1fr); align-items: center; gap: .45rem; padding: .35rem .5rem; border-radius: 10px; background: var(--tc-surface-container-lowest); font-size: .79rem; }
    .form-preview li > span { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: var(--tc-surface-container-highest); color: var(--muted-foreground); font-size: .68rem; font-weight: 700; }
    .form-preview li mat-icon { width: 17px; height: 17px; color: var(--primary); font-size: 17px; }
    .preview-note { display: flex; align-items: flex-start; gap: .4rem; margin: .8rem 0 0; color: var(--muted-foreground); font-size: .73rem; line-height: 1.4; }.preview-note mat-icon { width: 16px; height: 16px; flex: 0 0 16px; font-size: 16px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
    @media (max-width: 980px) { .page-header { align-items: start; flex-direction: column; }.header-actions { justify-content: flex-start; }.order-workbench { grid-template-columns: 1fr; }.form-preview { position: static; }.order-heading { align-items: start; flex-direction: column; } }
    @media (max-width: 720px) { .config-surface { padding: .25rem .85rem 1rem; }.section-heading { align-items: stretch; flex-direction: column; }.section-heading > button { width: 100%; }.summary-pill { display: none; }.tag-row { align-items: flex-start; }.tag-identity { align-items: flex-start; flex-direction: column; gap: .35rem; }.order-item { grid-template-columns: 44px 34px minmax(0, 1fr) 88px; }.custom-mark { display: none; }.order-actions { width: 100%; justify-content: space-between; }.move-actions { grid-column: 4; }.tab-content { padding-top: 1rem; } }
  `]
})
export class ConfiguracionClientesComponent implements OnInit, AfterViewInit {
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  @ViewChild(MatPaginator) protected paginator?: MatPaginator;

  protected readonly dataSource = new MatTableDataSource<CampoPersonalizado>([]);
  protected readonly configuracion = signal<ConfiguracionClientes>(normalizarConfiguracionClientes(null));
  protected readonly estadoCarga = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busquedaEtiqueta = signal('');
  protected readonly ordenBorrador = signal<CampoFormularioClienteKey[]>([]);
  protected readonly ordenModificado = signal(false);
  protected readonly guardandoOrden = signal(false);
  protected readonly columnasVisibles = ['nombreMostrar', 'tipo', 'opciones', 'estado', 'acciones'];

  protected readonly etiquetasActivas = computed(() => this.configuracion().catalogoEtiquetas.filter((item) => item.activa));
  protected readonly etiquetasFiltradas = computed(() => {
    const query = textoComparableEtiqueta(this.busquedaEtiqueta());
    return [...this.configuracion().catalogoEtiquetas]
      .filter((item) => !query || textoComparableEtiqueta(item.nombre).includes(query))
      .sort((a, b) => Number(b.activa) - Number(a.activa) || a.nombre.localeCompare(b.nombre, 'es'));
  });
  protected readonly itemsOrden = computed(() => this.ordenBorrador().flatMap((key) => {
    const item = this.resolverItemOrden(key);
    return item ? [item] : [];
  }));
  protected readonly itemsOrdenActivos = computed(() => this.itemsOrden().filter((item) => item.activo));

  protected readonly copilotContext: ConfigScreenContext = {
    route: '/workspace/customers/configuracion', module: 'Clientes', page: 'Configuracion', screenKey: 'clientes.configuracion'
  };
  protected readonly copilotEjemplos = [
    'Quiero saber por qué canal llegó cada cliente',
    'Agrega la fecha de aniversario del cliente',
    'Necesito guardar notas internas de cada cliente'
  ];

  ngOnInit(): void { this.cargarConfiguracion(); }
  ngAfterViewInit(): void { if (this.paginator) this.dataSource.paginator = this.paginator; }

  protected cargarConfiguracion(): void {
    this.estadoCarga.set('loading');
    this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (configuracion) => {
        this.configuracion.set(configuracion);
        this.dataSource.data = configuracion.camposPersonalizados;
        if (this.paginator) this.dataSource.paginator = this.paginator;
        this.ordenBorrador.set(this.ordenModificado()
          ? normalizarConfiguracionClientes({
              ...configuracion,
              ordenFormulario: this.ordenBorrador()
            }).ordenFormulario
          : [...configuracion.ordenFormulario]);
        this.estadoCarga.set('ready');
      },
      error: () => this.estadoCarga.set('error')
    });
  }

  protected actualizarBusqueda(event: Event): void { this.busquedaEtiqueta.set((event.target as HTMLInputElement).value); }

  protected agregarEtiqueta(): void {
    this.abrirDialogoEtiqueta();
  }

  protected editarEtiqueta(etiqueta: EtiquetaClienteConfig): void {
    if (etiqueta.origenFormularioId) return;
    this.abrirDialogoEtiqueta(etiqueta);
  }

  protected desactivarEtiqueta(etiqueta: EtiquetaClienteConfig): void {
    if (etiqueta.origenFormularioId) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Desactivar etiqueta',
        message: `“${etiqueta.nombre}” dejará de estar disponible para nuevas asignaciones, pero seguirá visible en los clientes que ya la tienen.`,
        confirmText: 'Desactivar'
      }
    }).afterClosed().subscribe((confirmado) => {
      if (confirmado) this.ejecutar(
        this.configuracionService.cambiarEstadoEtiqueta(etiqueta.idEtiqueta, false),
        'Etiqueta desactivada.', 'visibility_off');
    });
  }

  protected reactivarEtiqueta(etiqueta: EtiquetaClienteConfig): void {
    this.ejecutar(this.configuracionService.cambiarEstadoEtiqueta(etiqueta.idEtiqueta, true), 'Etiqueta reactivada.', 'refresh');
  }

  protected agregarCampo(): void {
    this.dialog.open(AgregarCampoDialogComponent, { width: '760px', maxWidth: '95vw' }).afterClosed()
      .subscribe((campo: CampoPersonalizado | undefined) => {
        if (campo) this.ejecutar(this.configuracionService.agregarCampo(campo), 'Campo personalizado agregado.', 'playlist_add');
      });
  }

  protected editarCampo(campo: CampoPersonalizado): void {
    this.dialog.open(AgregarCampoDialogComponent, { width: '760px', maxWidth: '95vw', data: campo }).afterClosed()
      .subscribe((editado: CampoPersonalizado | undefined) => {
        if (editado) this.ejecutar(this.configuracionService.actualizarCampo(editado), 'Campo personalizado actualizado.', 'edit');
      });
  }

  protected eliminarCampo(campo: CampoPersonalizado): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: { title: 'Eliminar campo', message: `¿Deseas eliminar el campo “${campo.nombreMostrar}”? Los valores guardados dejarán de mostrarse.`, confirmText: 'Eliminar' }
    }).afterClosed().subscribe((confirmado) => {
      if (confirmado) this.ejecutar(this.configuracionService.eliminarCampo(campo.idCampo), 'Campo eliminado correctamente.', 'delete');
    });
  }

  protected soltarCampo(event: CdkDragDrop<CampoFormularioClienteKey[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const orden = [...this.ordenBorrador()];
    moveItemInArray(orden, event.previousIndex, event.currentIndex);
    this.ordenBorrador.set(orden);
    this.ordenModificado.set(true);
    const item = this.resolverItemOrden(orden[event.currentIndex]);
    void this.liveAnnouncer.announce(`${item?.nombre ?? 'Campo'} movido a la posición ${event.currentIndex + 1}.`);
  }

  protected moverCampo(index: number, delta: -1 | 1): void {
    const destino = index + delta;
    if (destino < 0 || destino >= this.ordenBorrador().length) return;
    const orden = [...this.ordenBorrador()];
    const nombre = this.resolverItemOrden(orden[index])?.nombre ?? 'Campo';
    moveItemInArray(orden, index, destino);
    this.ordenBorrador.set(orden);
    this.ordenModificado.set(true);
    void this.liveAnnouncer.announce(`${nombre} movido a la posición ${destino + 1}.`);
  }

  protected restablecerOrden(): void {
    this.ordenBorrador.set(ordenFormularioPredeterminado(this.configuracion().camposPersonalizados));
    this.ordenModificado.set(true);
    void this.liveAnnouncer.announce('Se restauró el orden predeterminado. Guarda para aplicar el cambio.');
  }

  protected async guardarOrden(): Promise<void> {
    if (!this.ordenModificado() || this.guardandoOrden()) return;
    this.guardandoOrden.set(true);
    try {
      await this.configuracionService.guardarOrdenFormulario(this.ordenBorrador());
      this.ordenModificado.set(false);
      this.mostrarExito('Orden del formulario guardado.', 'check_circle');
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.guardandoOrden.set(false);
    }
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => opcion.valor).join(' · ') || '—';
  }

  protected nombreTipo(tipo: CampoPersonalizado['tipo']): string {
    return ({ texto: 'Texto', textarea: 'Texto largo', booleano: 'Sí / No', lista_simple: 'Lista simple', lista_multiple: 'Lista múltiple', catalogo: 'Catálogo', fecha: 'Fecha' })[tipo];
  }

  private abrirDialogoEtiqueta(etiqueta?: EtiquetaClienteConfig): void {
    this.dialog.open(EtiquetaClienteDialogComponent, {
      width: '560px', maxWidth: '95vw',
      data: { etiqueta, existentes: this.configuracion().catalogoEtiquetas } satisfies EtiquetaClienteDialogData
    }).afterClosed().subscribe((resultado: EtiquetaClienteConfig | undefined) => {
      if (!resultado) return;
      const operacion = etiqueta
        ? this.configuracionService.actualizarEtiqueta(resultado)
        : this.configuracionService.agregarEtiqueta(resultado);
      this.ejecutar(operacion, etiqueta ? 'Etiqueta actualizada.' : 'Etiqueta creada.', etiqueta ? 'edit' : 'new_label');
    });
  }

  private resolverItemOrden(key: CampoFormularioClienteKey): ItemOrdenFormulario | null {
    const base = CAMPOS_BASE[key];
    if (base) return { key, ...base };
    if (!key.startsWith('custom:')) return null;
    const campo = this.configuracion().camposPersonalizados.find((item) => item.idCampo === key.slice(7));
    if (!campo) return null;
    return {
      key,
      nombre: campo.nombreMostrar,
      detalle: `${this.nombreTipo(campo.tipo)}${campo.requerido ? ' · obligatorio' : ''}${campo.activo === false ? ' · desactivado' : ''}`,
      icono: this.iconoTipo(campo.tipo),
      personalizado: true,
      activo: campo.activo !== false
    };
  }

  private iconoTipo(tipo: CampoPersonalizado['tipo']): string {
    return ({ texto: 'short_text', textarea: 'notes', booleano: 'toggle_on', lista_simple: 'arrow_drop_down_circle', lista_multiple: 'checklist', catalogo: 'menu_book', fecha: 'event' })[tipo];
  }

  private ejecutar(promesa: Promise<void>, mensaje: string, icono: string): void {
    void promesa.then(() => this.mostrarExito(mensaje, icono)).catch((error) => this.mostrarError(error));
  }

  private mostrarExito(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon }, duration: 2600, horizontalPosition: 'end', verticalPosition: 'top'
    });
  }

  private mostrarError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el cambio. Inténtalo nuevamente.';
    this.snackBar.open(message, 'Cerrar', { duration: 5000, horizontalPosition: 'end', verticalPosition: 'top' });
  }
}

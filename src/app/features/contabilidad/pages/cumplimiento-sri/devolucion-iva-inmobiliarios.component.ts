import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfiguracionEmpresaContable } from '../../models/contabilidad.models';
import {
  ComprobanteCandidato,
  ExpedienteDevolucionIva,
  LineaElegible,
  ProyectoInmobiliario,
  ProyectoInmobiliarioInput,
  VistaPreviaDevolucionIva
} from '../../models/cumplimiento-sri.models';
import { CODIGOS_SUSTENTO } from '../../models/compras.models';
import { ConfiguracionContableService } from '../../services/configuracion-contable.service';
import { CumplimientoSriApiService } from '../../services/cumplimiento-sri-api.service';
import { candidateIsSelected, toggleCandidateSelection } from '../../services/cumplimiento-sri-selection.util';
import { ProyectoInmobiliarioDialogComponent } from './proyecto-inmobiliario-dialog.component';

/**
 * THESIS: Un expediente fiscal guiado debe sentirse verificable, no burocrático.
 * OWN-WORLD: Continúa Tactile Clarity con superficies cálidas, tinta verde y densidad operativa.
 * COMPOSITION: Barra de progreso persistente; cada paso concentra una sola decisión contable.
 * TYPOGRAPHY: Titulares compactos, etiquetas técnicas pequeñas y cifras tabulares dominantes.
 * DEPTH: Jerarquía por tono y borde; sombra reservada para el papel oficial del preview.
 */
@Component({
  selector: 'app-devolucion-iva-inmobiliarios',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
    MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <section class="wizard-page">
      <header class="wizard-header">
        <div class="title-row">
          <a mat-icon-button routerLink="/workspace/contabilidad/cumplimiento-sri" aria-label="Volver a Cumplimiento SRI"><mat-icon>arrow_back</mat-icon></a>
          <div>
            <p class="eyebrow">Cumplimiento SRI · Devolución de IVA</p>
            <h2>Proyectos inmobiliarios</h2>
            <p>Listado de adquisiciones locales para anexar a la solicitud mensual.</p>
          </div>
        </div>
        @if (expediente()) {
          <div class="draft-state"><span class="state-dot"></span>{{ saving() ? 'Guardando…' : 'Borrador guardado' }} · rev. {{ expediente()!.revision }}</div>
        }
      </header>

      <nav class="step-rail" aria-label="Progreso del expediente">
        @for (item of steps; track item.number) {
          <button type="button" class="step-item" [class.active]="step() === item.number" [class.done]="step() > item.number"
            [disabled]="item.number > maxStep()" (click)="goTo(item.number)">
            <span class="step-number">@if (step() > item.number) { <mat-icon>check</mat-icon> } @else { {{ item.number }} }</span>
            <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
          </button>
        }
      </nav>

      @if (error()) {
        <div class="alert error-alert" role="alert"><mat-icon>error_outline</mat-icon><span>{{ error() }}</span><button mat-icon-button (click)="error.set('')" aria-label="Cerrar"><mat-icon>close</mat-icon></button></div>
      }

      @if (step() === 1) {
        <section class="step-layout">
          <article class="surface-card step-card">
            <div class="step-heading"><span>01</span><div><h3>Proyecto y período fiscal</h3><p>El SRI requiere un listado independiente por cada proyecto y mes.</p></div></div>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Período fiscal</mat-label>
                <input matInput type="month" [formControl]="periodo" (change)="contextChanged()" />
                <mat-hint>Mes de emisión de los comprobantes.</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Proyecto calificado</mat-label>
                <mat-select [formControl]="proyectoId" (selectionChange)="contextChanged()">
                  @for (project of projects(); track project.id) { <mat-option [value]="project.id">{{ project.nombre }}</mat-option> }
                </mat-select>
                @if (!projects().length) { <mat-hint>Crea el primer proyecto para continuar.</mat-hint> }
              </mat-form-field>
            </div>
            <div class="project-actions">
              <button mat-stroked-button color="primary" type="button" (click)="openProjectDialog()" [disabled]="!canWrite()"><mat-icon>add</mat-icon> Nuevo proyecto</button>
              <button mat-button type="button" (click)="openProjectDialog(selectedProject())" [disabled]="!selectedProject() || !canWrite()"><mat-icon>edit</mat-icon> Editar seleccionado</button>
            </div>

            @if (selectedProject(); as project) {
              <div class="project-summary">
                <div><small>Registro asignado</small><strong>{{ project.numeroRegistro }}</strong></div>
                <div><small>Tipo</small><strong>{{ project.tipoProyecto === 'VIVIENDA_PROPIA' ? 'Vivienda propia' : 'Promotor inmobiliario' }}</strong></div>
                <div><small>Costo referencial</small><strong>{{ project.costoTotalReferencial | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></div>
              </div>
            }
          </article>

          <aside class="surface-card identity-card">
            <div class="identity-icon"><mat-icon>domain</mat-icon></div>
            <p class="eyebrow">Datos del contribuyente</p>
            <h3>{{ company()?.razonSocial || 'Configuración pendiente' }}</h3>
            <p class="ruc">RUC {{ company()?.ruc || '—' }}</p>
            <p class="support">Estos datos provienen de la configuración contable y se imprimen en la cabecera del Excel.</p>
            @if (!company()?.razonSocial || !validRuc()) {
              <a mat-stroked-button routerLink="/workspace/contabilidad/configuracion"><mat-icon>settings</mat-icon> Completar configuración</a>
            } @else {
              <span class="verified"><mat-icon>verified</mat-icon> Identidad lista para exportar</span>
            }
          </aside>
        </section>
        <footer class="wizard-actions"><span></span><button mat-flat-button color="primary" (click)="startDraft()" [disabled]="busy() || !periodo.value || !proyectoId.value || !validRuc() || !canWrite()">Consultar compras <mat-icon>arrow_forward</mat-icon></button></footer>
      }

      @if (step() === 2) {
        <section class="surface-card selection-card">
          <div class="step-heading compact"><span>02</span><div><h3>Compras elegibles del período</h3><p>La selección se conserva al cambiar filtros o cargar más resultados.</p></div><div class="selection-counter"><strong>{{ selectedInvoiceCount() }}</strong><small>comprobantes seleccionados</small></div></div>
          <div class="filters">
            <mat-form-field appearance="outline" class="provider-filter"><mat-icon matPrefix>search</mat-icon><mat-label>Proveedor o RUC</mat-label><input matInput [formControl]="proveedor" (keyup.enter)="searchCandidates()" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Sustento tributario</mat-label><mat-select [formControl]="sustento"><mat-option value="">Todos</mat-option>@for (item of sustentos; track item.codigo) { <mat-option [value]="item.codigo">{{ item.codigo }} · {{ item.descripcion }}</mat-option> }</mat-select></mat-form-field>
            <button mat-flat-button color="primary" class="filter-button" (click)="searchCandidates()" [disabled]="loadingCandidates()"><mat-icon>filter_alt</mat-icon> Aplicar</button>
          </div>
          <div class="selection-note"><mat-icon>info</mat-icon> Solo aparecen facturas y notas de crédito locales registradas, con IVA mayor a 0% e ítems consistentes.</div>

          <div class="table-scroll">
            <table class="candidate-table">
              <thead><tr><th class="select-cell">Elegir</th><th>Emisión / documento</th><th>Proveedor</th><th>Sustento</th><th>IVA por tarifa</th><th>Estado</th></tr></thead>
              <tbody>
                @for (candidate of candidates(); track candidate.id) {
                  <tr [class.disabled-row]="!candidate.elegible">
                    <td class="select-cell"><mat-checkbox [checked]="isCandidateSelected(candidate)" [disabled]="!candidate.elegible" (change)="toggleCandidate(candidate)" [attr.aria-label]="'Seleccionar ' + candidate.secuencial" /></td>
                    <td><strong>{{ candidate.fechaEmision | date:'dd/MM/yyyy' }}</strong><span class="subline">{{ candidate.tipoComprobante === '04' ? 'NC' : 'FAC' }} {{ candidate.establecimiento }}-{{ candidate.puntoEmision }}-{{ candidate.secuencial }}</span></td>
                    <td><strong>{{ candidate.proveedorNombre }}</strong><span class="subline mono">{{ candidate.proveedorRuc }}</span></td>
                    <td><span class="code-chip">{{ candidate.codSustento || '—' }}</span></td>
                    <td><div class="tax-groups">@for (group of candidate.gruposIva; track group.tarifa) { <span>{{ group.tarifa | number:'1.0-2' }}% · {{ group.ivaFuente | currency:'USD':'symbol-narrow':'1.2-2' }}</span> }</div></td>
                    <td>
                      @if (!candidate.elegible) { <span class="status blocked" [matTooltip]="candidate.motivoBloqueo"><mat-icon>block</mat-icon> Revisar compra</span> }
                      @else if (candidate.advertencias.length) { <span class="status warning" [matTooltip]="candidate.advertencias.join(' ')"><mat-icon>warning_amber</mat-icon> Ya exportada</span> }
                      @else { <span class="status eligible"><mat-icon>check_circle</mat-icon> Elegible</span> }
                    </td>
                  </tr>
                  @if (!candidate.elegible) { <tr class="reason-row"><td></td><td colspan="5">{{ candidate.motivoBloqueo }} <a [routerLink]="['/workspace/contabilidad/compras', candidate.id, 'editar']">Abrir compra</a></td></tr> }
                } @empty {
                  <tr><td colspan="6"><div class="empty-table">@if (loadingCandidates()) { <mat-spinner diameter="30" /> Consultando compras… } @else { <mat-icon>search_off</mat-icon> No hay comprobantes para estos filtros. }</div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="table-footer"><span>{{ candidates().length }} de {{ totalCandidates() }} resultados cargados</span>@if (hasMore()) { <button mat-stroked-button (click)="loadMore()" [disabled]="loadingCandidates()">Cargar más</button> }</div>
        </section>
        <footer class="wizard-actions"><button mat-button (click)="step.set(1)"><mat-icon>arrow_back</mat-icon> Proyecto</button><button mat-flat-button color="primary" (click)="goReview()" [disabled]="!selectedLines().length || saving()">Revisar montos <mat-icon>arrow_forward</mat-icon></button></footer>
      }

      @if (step() === 3) {
        <section class="surface-card review-card">
          <div class="step-heading compact"><span>03</span><div><h3>Montos elegibles por tarifa</h3><p>Puedes reducir la base y el IVA. WinSuite nunca permitirá superar el valor fuente.</p></div></div>
          <div class="alert neutral"><mat-icon>calculate</mat-icon><span>Las notas de crédito se editan como magnitudes positivas; se aplicarán con signo negativo en el preview y el Excel.</span></div>
          <div class="table-scroll">
            <table class="review-table">
              <thead><tr><th>Comprobante</th><th>Proveedor</th><th>Tarifa</th><th>Base fuente</th><th>Base elegible</th><th>IVA fuente</th><th>IVA elegible</th><th></th></tr></thead>
              <tbody>
                @for (line of selectedLines(); track lineKey(line)) {
                  @let candidate = candidateFor(line.facturaId);
                  @let group = sourceGroup(line);
                  <tr>
                    <td><strong>{{ candidate?.tipoComprobante === '04' ? 'NC' : 'FAC' }} {{ candidate ? candidate.establecimiento + '-' + candidate.puntoEmision + '-' + candidate.secuencial : line.facturaId }}</strong></td>
                    <td>{{ candidate?.proveedorNombre || 'Comprobante guardado' }}</td>
                    <td><span class="rate-chip">{{ line.tarifa | number:'1.0-2' }}%</span></td>
                    <td class="number">{{ group?.baseFuente | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td><div class="money-input"><span>$</span><input type="number" min="0.01" [max]="group?.baseFuente" step="0.01" [value]="line.baseElegible" (change)="updateAmount(line, 'base', $event)" aria-label="Base elegible" /></div></td>
                    <td class="number">{{ group?.ivaFuente | currency:'USD':'symbol-narrow':'1.2-2' }}</td>
                    <td><div class="money-input"><span>$</span><input type="number" min="0.01" [max]="group?.ivaFuente" step="0.01" [value]="line.ivaElegible" (change)="updateAmount(line, 'iva', $event)" aria-label="IVA elegible" /></div></td>
                    <td><button mat-icon-button type="button" (click)="removeLine(line)" aria-label="Quitar línea"><mat-icon>close</mat-icon></button></td>
                  </tr>
                }
              </tbody>
              <tfoot><tr><td colspan="4">Totales elegibles</td><td class="number">{{ totalBase() | currency:'USD':'symbol-narrow':'1.2-2' }}</td><td></td><td class="number emphasis">{{ totalIva() | currency:'USD':'symbol-narrow':'1.2-2' }}</td><td></td></tr></tfoot>
            </table>
          </div>
        </section>
        <footer class="wizard-actions"><button mat-button (click)="step.set(2)"><mat-icon>arrow_back</mat-icon> Compras</button><button mat-flat-button color="primary" (click)="buildPreview()" [disabled]="!selectedLines().length || busy()">Generar vista previa <mat-icon>visibility</mat-icon></button></footer>
      }

      @if (step() === 4 && preview(); as document) {
        <section class="preview-stage">
          <div class="preview-toolbar"><div><p class="eyebrow">Vista canónica</p><h3>Hoja 1 · Adquisiciones</h3></div><div class="zoom-controls" aria-label="Escala de la vista previa"><button mat-icon-button (click)="zoomPreview(-0.1)" aria-label="Reducir vista"><mat-icon>remove</mat-icon></button><span>{{ previewScale() * 100 | number:'1.0-0' }}%</span><button mat-icon-button (click)="zoomPreview(0.1)" aria-label="Ampliar vista"><mat-icon>add</mat-icon></button><span class="zoom-hint"><mat-icon>pinch</mat-icon> Desplaza para revisar toda la hoja</span></div></div>
          @for (warning of document.advertencias; track warning) { <div class="alert warning-alert"><mat-icon>warning_amber</mat-icon><span>{{ warning }}</span></div> }
          <div class="paper-viewport">
            <article class="official-sheet" [style.zoom]="previewScale()">
              <header class="sheet-title"><div class="sri-wordmark">SRI</div><div><strong>LISTADO DE ADQUISICIONES LOCALES O IMPORTACIONES DE BIENES Y SERVICIOS PARA LA CONSTRUCCIÓN DE PROYECTOS INMOBILIARIOS</strong><span>ANEXO A LA SOLICITUD DE DEVOLUCIÓN DEL IVA</span><span>SOCIEDADES O PERSONAS NATURALES QUE DESARROLLAN PROYECTOS INMOBILIARIOS</span></div></header>
              <dl class="sheet-fields"><div><dt>RAZÓN SOCIAL / NOMBRE:</dt><dd>{{ document.razonSocial }}</dd></div><div><dt>RUC O CÉDULA DE CIUDADANÍA:</dt><dd>{{ document.ruc }}</dd></div><div><dt>PERÍODO FISCAL SOLICITADO:</dt><dd>AÑO {{ document.anio }} · MES {{ document.mes | number:'2.0-0' }}</dd></div><div><dt>NOMBRE DEL PROYECTO CALIFICADO:</dt><dd>{{ document.proyecto.nombre }}</dd></div><div><dt>NÚMERO DE REGISTRO ASIGNADO:</dt><dd>{{ document.proyecto.numeroRegistro }}</dd></div><div><dt>COSTO TOTAL REFERENCIAL:</dt><dd>{{ document.proyecto.costoTotalReferencial | currency:'USD':'symbol-narrow':'1.2-2' }}</dd></div></dl>
              <h4>DETALLE DE LOS COMPROBANTES DE VENTA SOLICITADOS</h4>
              <table class="sheet-table"><thead><tr><th>No.</th><th>Fecha de emisión</th><th>RUC proveedor</th><th>Serie</th><th>Secuencial</th><th>Autorización</th><th>Tipo</th><th>Base imponible</th><th>% IVA</th><th>IVA pagado</th><th>Reembolso</th></tr></thead><tbody>@for (row of document.lineas; track row.numero) { <tr><td>{{ row.numero }}</td><td>{{ row.fechaEmision }}</td><td>{{ row.proveedorRuc }}</td><td>{{ row.serie }}</td><td>{{ row.secuencial }}</td><td class="authorization">{{ row.autorizacion }}</td><td>{{ row.tipoComprobante }}</td><td class="number">{{ row.baseImponible | number:'1.2-2' }}</td><td>{{ row.tarifaIva | number:'1.0-2' }}</td><td class="number">{{ row.ivaPagado | number:'1.2-2' }}</td><td>NO</td></tr> }</tbody><tfoot><tr><td colspan="7">TOTAL</td><td class="number">{{ document.totalBase | number:'1.2-2' }}</td><td></td><td class="number">{{ document.totalIva | number:'1.2-2' }}</td><td></td></tr></tfoot></table>
              <p class="sheet-disclaimer">“La información suministrada en esta ficha, es de completa responsabilidad del sujeto pasivo.”</p>
            </article>
          </div>
          <section class="export-confirmation">
            <mat-checkbox [formControl]="responsibility">Confirmo que revisé los comprobantes y que la información es responsabilidad del sujeto pasivo.</mat-checkbox>
            <div class="export-summary"><span>IVA de esta versión <strong>{{ document.totalIva | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></span><span>Acumulado estimado WinSuite <strong>{{ document.ivaAcumuladoEstimado | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></span><span>Límite referencial <strong>{{ document.limiteReferencial | currency:'USD':'symbol-narrow':'1.2-2' }}</strong></span></div>
          </section>
        </section>
        <footer class="wizard-actions"><button mat-button (click)="step.set(3)"><mat-icon>arrow_back</mat-icon> Ajustar montos</button><button mat-flat-button color="primary" (click)="download()" [disabled]="!responsibility.value || busy()"><mat-icon>download</mat-icon> Descargar Excel .xls</button></footer>
      }

      @if (busy() && step() !== 2) { <div class="busy-overlay" aria-live="polite"><mat-spinner diameter="36" /><span>Procesando expediente…</span></div> }
    </section>
  `,
  styles: [`
    .wizard-page { position: relative; display: grid; gap: 20px; padding-bottom: 34px; color: var(--app-text-primary, #23342f); }
    .wizard-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .title-row { display: flex; align-items: flex-start; gap: 10px; }
    .title-row h2 { margin: 4px 0; font-size: clamp(1.7rem, 3vw, 2.35rem); letter-spacing: -.035em; }
    .title-row p:last-child { margin: 0; color: var(--app-text-secondary); }
    .eyebrow { margin: 0; color: #1d7567; font-size: .73rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .draft-state { display: flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid #d6e3df; border-radius: 999px; background: #f8fbfa; color: #50645f; font-size: .78rem; white-space: nowrap; }
    .state-dot { width: 7px; height: 7px; border-radius: 50%; background: #2e8a73; box-shadow: 0 0 0 3px #dff2ed; }
    .step-rail { display: grid; grid-template-columns: repeat(4, 1fr); overflow: hidden; border: 1px solid var(--app-border, #dce5e2); border-radius: 16px; background: var(--app-surface, #fff); }
    .step-item { position: relative; display: flex; align-items: center; gap: 11px; min-height: 72px; padding: 12px 16px; border: 0; border-right: 1px solid var(--app-border, #dce5e2); background: transparent; color: #6d7c78; text-align: left; cursor: pointer; }
    .step-item:last-child { border-right: 0; } .step-item:disabled { cursor: default; opacity: .55; }
    .step-item.active { background: #edf7f4; color: #154f45; box-shadow: inset 0 -3px #1d7567; } .step-item.done { color: #287263; }
    .step-number { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border: 1px solid currentColor; border-radius: 9px; font-weight: 800; }
    .step-number mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .step-item strong, .step-item small { display: block; } .step-item strong { font-size: .86rem; } .step-item small { margin-top: 2px; font-size: .7rem; opacity: .78; }
    .surface-card { border: 1px solid var(--app-border, #dce5e2); border-radius: 18px; background: var(--app-surface, #fff); box-shadow: 0 8px 24px rgba(28, 54, 47, .05); }
    .step-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .75fr); gap: 20px; }
    .step-card, .identity-card, .selection-card, .review-card { padding: 26px; }
    .step-heading { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px; }
    .step-heading > span { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto; border-radius: 11px; background: #dff2ed; color: #17685b; font-size: .78rem; font-weight: 900; }
    .step-heading h3 { margin: 0; font-size: 1.2rem; } .step-heading p { margin: 5px 0 0; color: var(--app-text-secondary); }
    .step-heading.compact { align-items: center; } .selection-counter { display: grid; min-width: 155px; margin-left: auto; padding-left: 20px; border-left: 1px solid var(--app-border); text-align: right; }
    .selection-counter strong { color: #17685b; font-size: 1.45rem; } .selection-counter small { color: var(--app-text-secondary); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .project-actions { display: flex; gap: 8px; margin-top: 6px; }
    .project-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 22px; padding: 18px; border-radius: 14px; background: #f3f7f6; }
    .project-summary div { display: grid; gap: 5px; } .project-summary small { color: var(--app-text-secondary); } .project-summary strong { font-size: .9rem; }
    .identity-card { background: linear-gradient(150deg, #f7fbfa, #eef6f3); }
    .identity-icon { display: grid; place-items: center; width: 50px; height: 50px; margin-bottom: 24px; border-radius: 14px; background: #173f38; color: #fff; }
    .identity-card h3 { margin: 8px 0 4px; } .identity-card .ruc { margin: 0; font-family: ui-monospace, monospace; color: #4d625d; }
    .support { margin: 20px 0; color: var(--app-text-secondary); line-height: 1.55; }
    .verified { display: flex; align-items: center; gap: 7px; color: #1d7567; font-size: .82rem; font-weight: 700; }
    .wizard-actions { display: flex; justify-content: space-between; align-items: center; min-height: 52px; } .wizard-actions button { min-height: 44px; }
    .alert { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 9px 14px; border: 1px solid #d8e4e0; border-radius: 12px; background: #f5f9f8; color: #3d5650; }
    .alert mat-icon { flex: 0 0 auto; } .alert button { margin-left: auto; } .error-alert { border-color: #efc8c2; background: #fff5f3; color: #943a32; } .warning-alert { margin-bottom: 10px; border-color: #ead49b; background: #fff9e9; color: #72550b; }
    .filters { display: grid; grid-template-columns: minmax(250px, 1.4fr) minmax(220px, 1fr) auto; align-items: start; gap: 12px; } .filter-button { min-height: 56px; }
    .selection-note { display: flex; align-items: center; gap: 8px; margin: -2px 0 18px; color: #657872; font-size: .8rem; } .selection-note mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .table-scroll { overflow-x: auto; border: 1px solid var(--app-border, #dfe7e4); border-radius: 13px; }
    table { width: 100%; border-collapse: collapse; } th { background: #f1f5f4; color: #566a65; font-size: .72rem; letter-spacing: .035em; text-align: left; text-transform: uppercase; }
    th, td { padding: 13px 12px; border-bottom: 1px solid #e5ebe9; vertical-align: middle; } tbody tr:last-child td { border-bottom: 0; }
    .candidate-table { min-width: 940px; } .select-cell { width: 62px; text-align: center; } .subline { display: block; margin-top: 3px; color: #6d7d79; font-size: .76rem; } .mono { font-family: ui-monospace, monospace; }
    .code-chip, .rate-chip { display: inline-flex; padding: 5px 8px; border-radius: 8px; background: #edf3f1; color: #34534c; font-size: .76rem; font-weight: 800; }
    .tax-groups { display: flex; flex-wrap: wrap; gap: 5px; } .tax-groups span { white-space: nowrap; font-size: .78rem; }
    .status { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; font-size: .76rem; font-weight: 700; } .status mat-icon { width: 17px; height: 17px; font-size: 17px; } .eligible { color: #23725f; } .warning { color: #91650a; } .blocked { color: #a0473c; }
    .disabled-row { background: #fafafa; color: #76817e; } .reason-row td { padding-top: 0; color: #98473e; font-size: .78rem; } .reason-row a { color: #17685b; font-weight: 700; }
    .empty-table { display: flex; justify-content: center; align-items: center; gap: 12px; min-height: 130px; color: var(--app-text-secondary); }
    .table-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; color: var(--app-text-secondary); font-size: .8rem; }
    .review-table { min-width: 1080px; } .number { text-align: right; font-variant-numeric: tabular-nums; } .emphasis { color: #17685b; font-weight: 900; }
    .money-input { display: flex; align-items: center; width: 130px; min-height: 40px; border: 1px solid #bac9c5; border-radius: 9px; background: #fff; } .money-input span { padding-left: 10px; color: #63736f; } .money-input input { width: 100%; padding: 8px; border: 0; outline: 0; background: transparent; font: inherit; text-align: right; }
    .review-table tfoot td { border-top: 2px solid #b9ccc6; border-bottom: 0; background: #f3f8f6; font-weight: 800; }
    .preview-stage { display: grid; gap: 12px; } .preview-toolbar { display: flex; justify-content: space-between; align-items: center; } .preview-toolbar h3 { margin: 4px 0 0; } .zoom-controls, .zoom-hint { display: flex; align-items: center; gap: 6px; color: var(--app-text-secondary); font-size: .78rem; } .zoom-controls > button { width: 44px; height: 44px; } .zoom-controls > span:first-of-type { min-width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
    .paper-viewport { overflow-x: auto; padding: 20px; border-radius: 18px; background: #dfe6e3; }
    .official-sheet { min-width: 1120px; padding: 26px 32px 40px; background: #fff; color: #111; box-shadow: 0 12px 34px rgba(26, 44, 39, .18); font-family: Arial, sans-serif; }
    .sheet-title { display: grid; grid-template-columns: 110px 1fr; align-items: start; text-align: center; font-size: 12px; line-height: 1.4; } .sheet-title span { display: block; font-weight: 700; }
    .sri-wordmark { color: #173b8f; font-size: 38px; font-weight: 1000; font-style: italic; text-align: left; }
    .sheet-fields { margin: 24px 0; } .sheet-fields div { display: grid; grid-template-columns: 285px 1fr; min-height: 29px; align-items: end; } .sheet-fields dt { font-size: 11px; font-weight: 800; } .sheet-fields dd { margin: 0; padding: 0 6px 3px; border-bottom: 1px solid #222; font-size: 11px; }
    .official-sheet h4 { margin: 18px 0 8px; font-size: 11px; text-decoration: underline; }
    .sheet-table { font-size: 9px; } .sheet-table th { background: #d7d7d7; color: #111; text-align: center; text-transform: none; } .sheet-table th, .sheet-table td { padding: 7px 5px; border: 1px solid #222; } .sheet-table .authorization { max-width: 180px; overflow-wrap: anywhere; } .sheet-table tfoot td { font-weight: 800; }
    .sheet-disclaimer { margin: 32px 10px 0; font-size: 12px; font-style: italic; font-weight: 700; }
    .export-confirmation { display: grid; gap: 16px; padding: 20px 22px; border: 1px solid #cfddd9; border-radius: 16px; background: #fff; }
    .export-summary { display: flex; flex-wrap: wrap; gap: 10px 24px; padding-top: 14px; border-top: 1px solid #e2e9e7; color: #52645f; font-size: .82rem; } .export-summary strong { margin-left: 5px; color: #203d36; }
    .busy-overlay { position: fixed; z-index: 1000; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px; background: rgba(247, 250, 249, .78); backdrop-filter: blur(2px); color: #31534b; }
    @media (max-width: 920px) { .step-layout { grid-template-columns: 1fr; } .step-rail { grid-template-columns: repeat(2, 1fr); } .step-item:nth-child(2) { border-right: 0; } .step-item:nth-child(-n+2) { border-bottom: 1px solid var(--app-border); } .filters { grid-template-columns: 1fr 1fr; } .filter-button { grid-column: 1 / -1; } }
    @media (max-width: 640px) { .wizard-header { align-items: stretch; flex-direction: column; } .draft-state { align-self: flex-start; } .step-item small { display: none; } .form-grid, .project-summary, .filters { grid-template-columns: 1fr; } .selection-counter { display: none; } .step-card, .identity-card, .selection-card, .review-card { padding: 20px; } .preview-toolbar { align-items: flex-start; flex-direction: column; gap: 8px; } }
  `]
})
export class DevolucionIvaInmobiliariosComponent implements OnInit {
  private readonly api = inject(CumplimientoSriApiService);
  private readonly config = inject(ConfiguracionContableService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly authorization = inject(AuthorizationService);
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight: Promise<boolean> | null = null;
  private persistedLinesKey = '[]';

  readonly steps = [
    { number: 1, label: 'Proyecto', hint: 'Período e identidad' },
    { number: 2, label: 'Compras', hint: 'Buscar y seleccionar' },
    { number: 3, label: 'Montos', hint: 'Revisar por tarifa' },
    { number: 4, label: 'Vista previa', hint: 'Confirmar y exportar' }
  ];
  readonly sustentos = CODIGOS_SUSTENTO;
  readonly periodo = new FormControl(this.currentPeriod(), { nonNullable: true });
  readonly proyectoId = new FormControl('', { nonNullable: true });
  readonly proveedor = new FormControl('', { nonNullable: true });
  readonly sustento = new FormControl('', { nonNullable: true });
  readonly responsibility = new FormControl(false, { nonNullable: true });

  readonly step = signal(1);
  readonly maxStep = signal(1);
  readonly projects = signal<ProyectoInmobiliario[]>([]);
  readonly company = signal<ConfiguracionEmpresaContable | null>(null);
  readonly expediente = signal<ExpedienteDevolucionIva | null>(null);
  readonly candidates = signal<ComprobanteCandidato[]>([]);
  readonly candidateCache = signal<Record<string, ComprobanteCandidato>>({});
  readonly selectedLines = signal<LineaElegible[]>([]);
  readonly preview = signal<VistaPreviaDevolucionIva | null>(null);
  readonly loadingCandidates = signal(false);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly hasMore = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly totalCandidates = signal(0);
  readonly previewScale = signal(1);

  private readonly projectValue = toSignal(this.proyectoId.valueChanges, { initialValue: this.proyectoId.value });

  readonly selectedProject = computed(() => this.projects().find((item) => item.id === this.projectValue()) ?? null);
  readonly selectedInvoiceCount = computed(() => new Set(this.selectedLines().map((line) => line.facturaId)).size);
  readonly totalBase = computed(() => this.selectedLines().reduce((sum, line) => sum + Number(line.baseElegible || 0), 0));
  readonly totalIva = computed(() => this.selectedLines().reduce((sum, line) => sum + Number(line.ivaElegible || 0), 0));
  readonly validRuc = computed(() => /^\d{13}$/.test(this.company()?.ruc ?? '') && !!this.company()?.razonSocial?.trim());
  readonly canWrite = computed(() => this.authorization.canAccess('contabilidad_sri', 'create') && this.authorization.canAccess('contabilidad_sri', 'update'));

  async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined' && window.innerWidth < 700) this.previewScale.set(0.65);
    this.busy.set(true);
    try {
      const [projects, company] = await Promise.all([this.api.listarProyectos(), this.config.getEmpresaOnce()]);
      this.projects.set(projects);
      this.company.set(company);
      if (projects.length === 1) this.proyectoId.setValue(projects[0].id);
    } catch (error) {
      this.handle(error);
    } finally {
      this.busy.set(false);
    }
  }

  async openProjectDialog(project: ProyectoInmobiliario | null = null): Promise<void> {
    const input = await firstValueFrom(this.dialog.open(ProyectoInmobiliarioDialogComponent, { width: '680px', maxWidth: '94vw', data: project }).afterClosed());
    if (!input) return;
    this.busy.set(true);
    try {
      const saved = project ? await this.api.actualizarProyecto(project.id, input as ProyectoInmobiliarioInput) : await this.api.crearProyecto(input as ProyectoInmobiliarioInput);
      this.projects.update((items) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      this.proyectoId.setValue(saved.id);
      this.contextChanged();
      this.snack.open('Proyecto inmobiliario guardado.', 'Cerrar', { duration: 3000 });
    } catch (error) { this.handle(error); } finally { this.busy.set(false); }
  }

  async startDraft(): Promise<void> {
    if (!this.proyectoId.value || !this.periodo.value || !this.validRuc()) return;
    this.busy.set(true); this.error.set('');
    try {
      const draft = await this.api.obtenerOCrearExpediente(this.proyectoId.value, this.periodo.value);
      this.expediente.set(draft);
      this.selectedLines.set(draft.lineas ?? []);
      this.persistedLinesKey = this.linesKey(draft.lineas ?? []);
      if (draft.lineas?.length) {
        const restored = await this.api.obtenerCandidatos(draft.periodo, [...new Set(draft.lineas.map((line) => line.facturaId))]);
        this.cacheCandidates(restored);
        if (restored.length < new Set(draft.lineas.map((line) => line.facturaId)).size) {
          this.error.set('Uno o más comprobantes del borrador cambiaron o dejaron de estar registrados. Revisa la selección antes de exportar.');
        }
      }
      this.maxStep.set(draft.lineas?.length ? 3 : 2);
      this.step.set(2);
      await this.searchCandidates();
    } catch (error) { this.handle(error); } finally { this.busy.set(false); }
  }

  async searchCandidates(): Promise<void> {
    this.candidates.set([]); this.nextCursor.set(null); this.hasMore.set(false);
    await this.loadCandidates(null, false);
  }

  async loadMore(): Promise<void> { await this.loadCandidates(this.nextCursor(), true); }

  toggleCandidate(candidate: ComprobanteCandidato): void {
    if (!candidate.elegible) return;
    this.selectedLines.set(toggleCandidateSelection(this.selectedLines(), candidate));
    this.preview.set(null);
    this.scheduleAutosave();
  }

  isCandidateSelected(candidate: ComprobanteCandidato): boolean {
    return candidateIsSelected(this.selectedLines(), candidate);
  }

  async goReview(): Promise<void> {
    if (!this.selectedLines().length) return;
    if (await this.saveDraft(false)) { this.maxStep.set(Math.max(this.maxStep(), 3)); this.step.set(3); }
  }

  async buildPreview(): Promise<void> {
    if (!await this.saveDraft(false)) return;
    const draft = this.expediente();
    if (!draft) return;
    this.busy.set(true); this.error.set('');
    try {
      this.preview.set(await this.api.previsualizar(draft.id));
      this.responsibility.setValue(false);
      this.maxStep.set(4); this.step.set(4);
    } catch (error) { this.handle(error); } finally { this.busy.set(false); }
  }

  async download(): Promise<void> {
    const draft = this.expediente();
    if (!draft || !this.responsibility.value) return;
    this.busy.set(true); this.error.set('');
    try {
      const response = await this.api.exportar(draft.id);
      const disposition = response.headers.get('content-disposition') ?? '';
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const simple = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : (simple ?? `SRI_Devolucion_IVA_${this.periodo.value}.xls`);
      const url = URL.createObjectURL(response.body ?? new Blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const refreshed = await this.api.obtenerOCrearExpediente(draft.proyectoId, draft.periodo);
      this.expediente.set(refreshed);
      this.snack.open(`Excel generado · versión ${response.headers.get('x-document-version') ?? refreshed.exportaciones.length}`, 'Cerrar', { duration: 5000 });
    } catch (error) { this.handle(error); } finally { this.busy.set(false); }
  }

  updateAmount(line: LineaElegible, field: 'base' | 'iva', event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const source = this.sourceGroup(line);
    if (!source || !Number.isFinite(raw)) return;
    const max = field === 'base' ? source.baseFuente : source.ivaFuente;
    const value = Math.max(0.01, Math.min(raw, max));
    this.selectedLines.update((items) => items.map((item) => {
      if (this.lineKey(item) !== this.lineKey(line)) return item;
      if (field === 'base') return { ...item, baseElegible: value, ivaElegible: Math.min(source.ivaFuente, Number((value * item.tarifa / 100).toFixed(2))) };
      return { ...item, ivaElegible: value, baseElegible: Math.min(source.baseFuente, Number((value * 100 / item.tarifa).toFixed(2))) };
    }));
    this.preview.set(null);
    this.scheduleAutosave();
  }

  removeLine(line: LineaElegible): void {
    this.selectedLines.update((items) => items.filter((item) => this.lineKey(item) !== this.lineKey(line)));
    this.preview.set(null);
    this.scheduleAutosave();
  }
  lineKey(line: LineaElegible): string { return `${line.facturaId}|${Number(line.tarifa)}`; }
  candidateFor(id: string): ComprobanteCandidato | null { return this.candidateCache()[id] ?? null; }
  sourceGroup(line: LineaElegible) { return this.candidateFor(line.facturaId)?.gruposIva.find((group) => Number(group.tarifa) === Number(line.tarifa)) ?? null; }
  zoomPreview(delta: number): void { this.previewScale.update((value) => Math.max(0.5, Math.min(1.2, Number((value + delta).toFixed(2))))); }
  contextChanged(): void {
    const draft = this.expediente();
    if (!draft || (draft.proyectoId === this.proyectoId.value && draft.periodo === this.periodo.value)) return;
    if (this.autosaveTimer) { clearTimeout(this.autosaveTimer); this.autosaveTimer = null; }
    this.expediente.set(null); this.selectedLines.set([]); this.preview.set(null); this.candidates.set([]);
    this.candidateCache.set({}); this.maxStep.set(1); this.step.set(1); this.persistedLinesKey = '[]';
    this.error.set('Cambió el proyecto o período. Consulta las compras para recuperar el borrador correspondiente.');
  }
  goTo(target: number): void {
    if (target > this.maxStep()) return;
    if (target === 4 && !this.preview()) {
      void this.buildPreview();
      return;
    }
    this.step.set(target);
  }

  private async loadCandidates(cursor: string | null, append: boolean): Promise<void> {
    if (!this.periodo.value) return;
    this.loadingCandidates.set(true); this.error.set('');
    try {
      const page = await this.api.listarCandidatos({ periodo: this.periodo.value, proveedor: this.proveedor.value, sustento: this.sustento.value, cursor, limit: 30 });
      this.cacheCandidates(page.items);
      this.candidates.set(append ? [...this.candidates(), ...page.items] : page.items);
      this.nextCursor.set(page.nextCursor); this.hasMore.set(page.hasMore); this.totalCandidates.set(page.totalFiltrado);
    } catch (error) { this.handle(error); } finally { this.loadingCandidates.set(false); }
  }

  private cacheCandidates(items: ComprobanteCandidato[]): void {
    this.candidateCache.update((cache) => ({ ...cache, ...Object.fromEntries(items.map((item) => [item.id, item])) }));
  }

  private async saveDraft(silent: boolean): Promise<boolean> {
    if (this.autosaveTimer) { clearTimeout(this.autosaveTimer); this.autosaveTimer = null; }
    if (this.saveInFlight) {
      const previousSucceeded = await this.saveInFlight;
      if (!previousSucceeded) return false;
      return this.linesKey(this.selectedLines()) === this.persistedLinesKey || this.saveDraft(silent);
    }
    const draft = this.expediente();
    if (!draft) return false;
    const snapshot = this.selectedLines().map((line) => ({ ...line }));
    const snapshotKey = this.linesKey(snapshot);
    this.saving.set(true);
    const operation = (async (): Promise<boolean> => {
      try {
        const saved = await this.api.guardarExpediente(draft.id, draft.revision, snapshot);
        if (this.expediente()?.id !== draft.id) return true;
        this.expediente.set(saved);
        this.persistedLinesKey = snapshotKey;
        if (this.linesKey(this.selectedLines()) === snapshotKey) this.selectedLines.set(saved.lineas ?? []);
        return true;
      } catch (error) {
        if (!silent) this.handle(error); else this.error.set(this.message(error));
        return false;
      }
    })();
    this.saveInFlight = operation;
    try { return await operation; }
    finally { this.saveInFlight = null; this.saving.set(false); }
  }

  private scheduleAutosave(): void {
    if (!this.expediente()) return;
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => { this.autosaveTimer = null; void this.saveDraft(true); }, 500);
  }

  private linesKey(lines: readonly LineaElegible[]): string {
    return JSON.stringify([...lines].sort((a, b) => this.lineKey(a).localeCompare(this.lineKey(b))));
  }

  private handle(error: unknown): void { this.error.set(this.message(error)); }
  private message(error: unknown): string { const value = error as { error?: { error?: string }; message?: string }; return value.error?.error ?? value.message ?? 'No se pudo completar la operación.'; }
  private currentPeriod(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
}

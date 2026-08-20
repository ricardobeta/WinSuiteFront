import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormulariosService } from '../../services/formularios.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';
import { TableColumnDefinition } from '../../../../shared/models/table-preferences.models';

/** Respuestas recibidas de un formulario prehecho (form_submissions/{t}/{formularioId}). */
@Component({
  selector: 'app-respuestas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, DataTableFrameComponent],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <a mat-icon-button routerLink="../.." aria-label="Volver a formularios">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="titulos">
          <h2>Respuestas · {{ nombreFormulario() }}</h2>
          <p class="nota">
            {{ respuestas().length }} respuestas cargadas ·
            {{ integracionActiva() ? 'Sincronización con Clientes activa' : (mostrarSincronizacion() ? 'Sincronización desactivada · historial visible' : 'Solo respuestas') }}
          </p>
        </div>
        <button
          mat-stroked-button
          [disabled]="respuestas().length === 0"
          (click)="exportarCsv()"
        >
          <mat-icon>download</mat-icon> Exportar CSV
        </button>
        <button mat-stroked-button type="button" [disabled]="cargando()" (click)="recargar()">
          <mat-icon>refresh</mat-icon> Actualizar
        </button>
      </header>

      @if (mostrarSincronizacion()) {
        <section class="resumen-sync" aria-label="Resumen de sincronización de las respuestas cargadas">
          <div><span class="estado-dot pendiente"></span><strong>{{ conteosSync().pendiente }}</strong><small>Pendientes</small></div>
          <div><span class="estado-dot creado"></span><strong>{{ conteosSync().creado }}</strong><small>Fichas creadas</small></div>
          <div><span class="estado-dot duplicado"></span><strong>{{ conteosSync().duplicado }}</strong><small>No sincronizados</small></div>
          <div><span class="estado-dot error"></span><strong>{{ conteosSync().error }}</strong><small>Con error</small></div>
        </section>
      } @else {
        <div class="solo-respuestas"><mat-icon>inbox</mat-icon><span>Este formulario guarda respuestas sin crear clientes.</span></div>
      }

      @if (errorCarga()) {
        <div class="estado-carga error-carga" role="alert">
          <mat-icon>cloud_off</mat-icon>
          <div><strong>No pudimos cargar las respuestas</strong><span>{{ errorCarga() }}</span></div>
          <button mat-stroked-button type="button" (click)="recargar()">Reintentar</button>
        </div>
      }

      @if (cargando() && respuestas().length === 0) {
        <div class="estado-carga" aria-live="polite"><mat-icon>sync</mat-icon><span>Cargando respuestas...</span></div>
      } @else if (respuestas().length === 0 && !errorCarga()) {
        <div class="vacio">
          <mat-icon>inbox</mat-icon>
          <p>Aun no hay respuestas. Publica tu sitio con el bloque Formulario para recibirlas.</p>
        </div>
      } @else if (respuestas().length > 0) {
        <app-data-table-frame
          tableModule="sitio-web"
          [tableId]="tablePreferenceId()"
          [columns]="columnDefinitions()"
          [showSearch]="false"
          [showPaginator]="false"
        >
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th data-column-id="fecha">Fecha</th>
                @for (columna of columnas(); track columna) {
                  <th [attr.data-column-id]="fieldColumnId(columna)">{{ columna }}</th>
                }
                @if (mostrarSincronizacion()) { <th data-column-id="clienteSync">Clientes</th> }
                <th data-column-id="sitio">Sitio</th>
              </tr>
            </thead>
            <tbody>
              @for (respuesta of respuestas(); track respuesta.id) {
                <tr>
                  <td class="fecha" data-column-id="fecha">{{ respuesta.creadoEn | date: 'dd/MM/yy HH:mm' }}</td>
                  @for (columna of columnas(); track columna) {
                    <td [attr.data-column-id]="fieldColumnId(columna)">{{ respuesta.valores[columna] }}</td>
                  }
                  @if (mostrarSincronizacion()) {
                    <td data-column-id="clienteSync" class="sync-cell">
                      @switch (respuesta.clienteSync?.estado) {
                        @case ('creado') {
                          <span class="sync-pill creado"><mat-icon>check_circle</mat-icon>Ficha creada · pendiente de completar</span>
                          @if (respuesta.clienteSync?.clienteId) {
                            <a [routerLink]="['/workspace/customers/lista']" [queryParams]="{ clienteId: respuesta.clienteSync?.clienteId }">Completar ficha</a>
                          }
                        }
                        @case ('duplicado') {
                          <span class="sync-pill duplicado"><mat-icon>person_search</mat-icon>No sincronizado</span>
                          <small>{{ respuesta.clienteSync?.mensaje }}</small>
                          @if (respuesta.clienteSync?.clienteId) {
                            <a [routerLink]="['/workspace/customers/lista']" [queryParams]="{ clienteId: respuesta.clienteSync?.clienteId }">Ver cliente existente</a>
                          }
                        }
                        @case ('error') {
                          <span class="sync-pill error"><mat-icon>error</mat-icon>Error</span>
                          <small>{{ respuesta.clienteSync?.mensaje }}</small>
                        }
                        @case ('pendiente') { <span class="sync-pill pendiente"><mat-icon>sync</mat-icon>Pendiente</span> }
                        @default { <span class="sync-pill solo"><mat-icon>inbox</mat-icon>Solo respuesta</span> }
                      }
                    </td>
                  }
                  <td class="sitio" data-column-id="sitio">{{ respuesta.sitioId }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        </app-data-table-frame>
        @if (hayMas()) {
          <button mat-stroked-button type="button" [disabled]="cargando()" (click)="cargarMas()">
            {{ cargando() ? 'Cargando...' : 'Cargar más respuestas' }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    .pagina {
      padding: 24px;
      max-width: 1100px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .titulos {
      flex: 1;
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .nota {
      margin: 2px 0 0;
      opacity: 0.6;
      font-size: 0.85rem;
    }
    .resumen-sync {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      gap: 8px;
      padding: 10px;
      border-radius: var(--tc-radius-lg, 16px);
      background: var(--tc-surface-container-low);
    }
    .resumen-sync > div {
      min-height: 64px;
      display: grid;
      grid-template-columns: 10px auto;
      grid-template-rows: auto auto;
      align-content: center;
      column-gap: 9px;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--tc-surface-container-lowest);
    }
    .resumen-sync strong { font-size: 1.15rem; line-height: 1; }
    .resumen-sync small { grid-column: 2; color: var(--tc-on-surface-variant); }
    .estado-dot { width: 9px; height: 9px; border-radius: 50%; align-self: center; grid-row: 1 / 3; }
    .estado-dot.pendiente { background: var(--tc-warning); }
    .estado-dot.creado { background: var(--tc-success); }
    .estado-dot.duplicado { background: var(--tc-tertiary); }
    .estado-dot.error { background: var(--tc-error); }
    .solo-respuestas {
      min-height: 48px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 14px;
      border-radius: 12px;
      background: var(--tc-surface-container-low);
      color: var(--tc-on-surface-variant);
    }
    .solo-respuestas mat-icon { color: var(--tc-primary); }
    .estado-carga {
      min-height: 64px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--tc-surface-container-low);
      color: var(--tc-on-surface-variant);
    }
    .estado-carga div { flex: 1; display: grid; gap: 2px; }
    .estado-carga span { display: block; }
    .error-carga { background: var(--tc-error-container); color: var(--tc-on-error-container); }
    .vacio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 64px 24px;
      opacity: 0.55;
      text-align: center;
    }
    .tabla-scroll {
      overflow-x: auto;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      border: 1px solid var(--tc-ghost-border);
      border-radius: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }
    th,
    td {
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--tc-ghost-border);
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
      background: var(--tc-surface-container-low);
    }
    .fecha,
    .sitio {
      opacity: 0.7;
      font-size: 0.8rem;
    }
    .sync-cell { min-width: 210px; white-space: normal; }
    .sync-cell small { display: block; max-width: 32ch; margin-top: 5px; color: var(--tc-on-surface-variant); }
    .sync-cell a { min-height: 44px; display: inline-flex; align-items: center; margin-top: 5px; color: var(--tc-primary); font-weight: 700; }
    .sync-pill {
      width: fit-content;
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: .75rem;
      font-weight: 700;
    }
    .sync-pill mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .sync-pill.pendiente { background: var(--tc-warning-container); color: var(--tc-on-warning-container); }
    .sync-pill.creado { background: var(--tc-success-container); color: var(--tc-on-success-container); }
    .sync-pill.duplicado { background: var(--tc-tertiary-container); color: var(--tc-on-tertiary-container); }
    .sync-pill.error { background: var(--tc-error-container); color: var(--tc-on-error-container); }
    .sync-pill.solo { background: var(--tc-surface-container-highest); color: var(--tc-on-surface-variant); }
    @media (max-width: 760px) {
      .cabecera { align-items: flex-start; flex-wrap: wrap; }
      .resumen-sync { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
    }
  `,
})
export class RespuestasPageComponent {
  private readonly formulariosService = inject(FormulariosService);
  private readonly destroyRef = inject(DestroyRef);

  /** Route params (withComponentInputBinding). */
  readonly formId = input.required<string>();

  readonly respuestas = signal<import('@winsuite/bloques').FormSubmission[]>([]);
  readonly cargando = signal(false);
  readonly errorCarga = signal<string | null>(null);
  readonly hayMas = signal(false);
  private readonly cursor = signal<string | null>(null);

  private readonly formularios = toSignal(this.formulariosService.getFormularios(), {
    initialValue: [],
  });

  constructor() {
    toObservable(this.formId)
      .pipe(takeUntilDestroyed())
      .subscribe((formId) => void this.cargar(formId, true));
    const intervalo = globalThis.setInterval(() => {
      if (!this.cargando() && this.conteosSync().pendiente > 0) this.recargar();
    }, 10_000);
    this.destroyRef.onDestroy(() => globalThis.clearInterval(intervalo));
  }

  recargar(): void {
    void this.cargar(this.formId(), true);
  }

  cargarMas(): void {
    void this.cargar(this.formId(), false);
  }

  private async cargar(formId: string, reiniciar: boolean): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const page = await this.formulariosService.getRespuestasPage(
        formId,
        25,
        reiniciar ? null : this.cursor(),
      );
      this.respuestas.update((actuales) => reiniciar ? page.items : [...actuales, ...page.items]);
      this.cursor.set(page.nextCursor);
      this.hayMas.set(page.hasMore);
    } catch (error) {
      this.errorCarga.set(error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  readonly nombreFormulario = computed(
    () => this.formularios().find((f) => f.formularioId === this.formId())?.nombre ?? '...',
  );
  readonly integracionActiva = computed(() =>
    this.formularios().find((f) => f.formularioId === this.formId())?.integracionClientes?.habilitada === true,
  );
  readonly mostrarSincronizacion = computed(() =>
    this.integracionActiva() || this.respuestas().some((respuesta) => !!respuesta.clienteSync),
  );
  readonly conteosSync = computed(() => {
    const conteos = { pendiente: 0, creado: 0, duplicado: 0, error: 0 };
    for (const respuesta of this.respuestas()) {
      const estado = respuesta.clienteSync?.estado;
      if (estado) conteos[estado]++;
    }
    return conteos;
  });

  /** Columnas: campos actuales del formulario + claves extra vistas en respuestas viejas. */
  readonly columnas = computed(() => {
    const definicion = this.formularios().find((f) => f.formularioId === this.formId());
    const columnas = definicion?.campos.map((campo) => campo.id) ?? [];
    for (const respuesta of this.respuestas()) {
      for (const clave of Object.keys(respuesta.valores ?? {})) {
        if (!columnas.includes(clave)) columnas.push(clave);
      }
    }
    return columnas;
  });
  readonly tablePreferenceId = computed(() => {
    const safeFormId = this.formId().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return `respuestas-${safeFormId || 'formulario'}`.slice(0, 120);
  });
  readonly columnDefinitions = computed<TableColumnDefinition[]>(() => [
    { id: 'fecha', label: 'Fecha' },
    ...this.columnas().map((column) => ({ id: this.fieldColumnId(column), label: column })),
    ...(this.mostrarSincronizacion() ? [{ id: 'clienteSync', label: 'Clientes' }] : []),
    { id: 'sitio', label: 'Sitio' }
  ]);

  fieldColumnId(column: string): string {
    return `field:${column}`.slice(0, 128);
  }

  exportarCsv(): void {
    const columnas = this.columnas();
    const escapar = (valor: unknown): string => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['fecha', ...columnas, 'sitio'].map(escapar).join(';'),
      ...this.respuestas().map((respuesta) =>
        [
          new Date(respuesta.creadoEn).toISOString(),
          ...columnas.map((columna) => respuesta.valores?.[columna] ?? ''),
          respuesta.sitioId,
        ]
          .map(escapar)
          .join(';'),
      ),
    ];
    // BOM para que Excel abra el UTF-8 con tildes correctas.
    const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `respuestas-${this.formId()}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormulariosService } from '../../services/formularios.service';

/** Respuestas recibidas de un formulario prehecho (form_submissions/{t}/{formularioId}). */
@Component({
  selector: 'app-respuestas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <a mat-icon-button routerLink="../.." aria-label="Volver a formularios">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="titulos">
          <h2>Respuestas · {{ nombreFormulario() }}</h2>
          <p class="nota">{{ respuestas().length }} respuestas recibidas</p>
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

      @if (respuestas().length === 0) {
        <div class="vacio">
          <mat-icon>inbox</mat-icon>
          <p>Aun no hay respuestas. Publica tu sitio con el bloque Formulario para recibirlas.</p>
        </div>
      } @else {
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                @for (columna of columnas(); track columna) {
                  <th>{{ columna }}</th>
                }
                <th>Sitio</th>
              </tr>
            </thead>
            <tbody>
              @for (respuesta of respuestas(); track respuesta.id) {
                <tr>
                  <td class="fecha">{{ respuesta.creadoEn | date: 'dd/MM/yy HH:mm' }}</td>
                  @for (columna of columnas(); track columna) {
                    <td>{{ respuesta.valores[columna] }}</td>
                  }
                  <td class="sitio">{{ respuesta.sitioId }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.08);
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
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
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
    }
    .fecha,
    .sitio {
      opacity: 0.7;
      font-size: 0.8rem;
    }
  `,
})
export class RespuestasPageComponent {
  private readonly formulariosService = inject(FormulariosService);

  /** Route params (withComponentInputBinding). */
  readonly formId = input.required<string>();

  readonly respuestas = signal<import('@winsuite/bloques').FormSubmission[]>([]);
  readonly cargando = signal(false);
  readonly hayMas = signal(false);
  private readonly cursor = signal<string | null>(null);

  private readonly formularios = toSignal(this.formulariosService.getFormularios(), {
    initialValue: [],
  });

  constructor() {
    toObservable(this.formId)
      .pipe(takeUntilDestroyed())
      .subscribe((formId) => void this.cargar(formId, true));
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
    try {
      const page = await this.formulariosService.getRespuestasPage(
        formId,
        25,
        reiniciar ? null : this.cursor(),
      );
      this.respuestas.update((actuales) => reiniciar ? page.items : [...actuales, ...page.items]);
      this.cursor.set(page.nextCursor);
      this.hayMas.set(page.hasMore);
    } finally {
      this.cargando.set(false);
    }
  }

  readonly nombreFormulario = computed(
    () => this.formularios().find((f) => f.formularioId === this.formId())?.nombre ?? '...',
  );

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

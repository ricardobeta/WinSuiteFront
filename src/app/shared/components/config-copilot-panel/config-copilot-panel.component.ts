import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';

import {
  AiConfigCopilotService,
  ConfigActionOutcome,
  ConfigApplyResponse,
  ConfigChatTurn,
  ConfigPlanAction,
  ConfigPlanResponse,
  ConfigScreenContext
} from '../../../core/services/ai-config-copilot.service';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogData,
  ArchivoSelectorDialogResult
} from '../archivo-selector-dialog/archivo-selector-dialog.component';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  avisos?: string[];
}

/**
 * Descripcion del documento del que esta pantalla sabe partir. El panel es generico: los
 * textos concretos los pone la pantalla que lo monta.
 *
 * Extiende los datos del selector de Archivos porque el copiloto NO tiene selector propio:
 * reutiliza el del modulo Archivos, que ya sabe buscar entre lo subido, filtrar por extension,
 * subir uno nuevo y controlar la cuota.
 */
export interface ConfigDocumentoImportable extends ArchivoSelectorDialogData {
  /** Texto del boton, por ejemplo "Importar el PDF del RUC". */
  etiqueta: string;
}

const PENSANDO = [
  'Revisando tu configuración actual…',
  'Comparando con lo que suele usar tu tipo de negocio…',
  'Preparando las acciones propuestas…'
];

/**
 * Panel del Copiloto de Configuración. Es genérico: cualquier pantalla de ajustes lo monta
 * pasando su propio contexto con el screenKey correspondiente.
 *
 * El copiloto nunca aplica nada por su cuenta. Propone un plan, el usuario desmarca lo que
 * no quiera y solo entonces se envía a aplicar. Por eso hay dos estados de carga distintos.
 *
 * La geometría replica la del copiloto global (panel flotante fijo) a propósito: así no
 * altera el layout de la pantalla que se está configurando.
 */
@Component({
  selector: 'app-config-copilot-panel',
  templateUrl: './config-copilot-panel.component.html',
  styleUrl: './config-copilot-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigCopilotPanelComponent {
  readonly context = input.required<ConfigScreenContext>();
  /** Ejemplos que se ofrecen cuando la conversación está vacía. */
  readonly ejemplos = input<string[]>([]);
  /** Si la pantalla admite partir de un documento, su descripción. Si no, null. */
  readonly documento = input<ConfigDocumentoImportable | null>(null);
  /** Se emite tras aplicar, para que la pantalla anfitriona reaccione si lo necesita. */
  readonly aplicado = output<ConfigApplyResponse>();

  private readonly copilot = inject(AiConfigCopilotService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isOpen = signal(false);
  protected readonly isSending = signal(false);
  protected readonly isApplying = signal(false);
  protected readonly draft = signal('');
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly plan = signal<ConfigPlanAction[]>([]);
  protected readonly descartadas = signal<ReadonlySet<string>>(new Set());
  protected readonly resultados = signal<ConfigActionOutcome[]>([]);
  protected readonly detalleAbierto = signal<ReadonlySet<string>>(new Set());
  protected readonly pensando = signal(PENSANDO[0]);

  protected readonly seleccionadas = computed(() =>
    this.plan().filter((accion) => !this.descartadas().has(accion.id))
  );
  protected readonly hayAccionesDeRiesgo = computed(() =>
    this.seleccionadas().some((accion) => accion.riesgo === 'ALTO')
  );
  protected readonly puedeAplicar = computed(
    () => this.seleccionadas().length > 0 && !this.isApplying() && !this.isSending()
  );

  private rotacion?: ReturnType<typeof setInterval>;

  constructor() {
    this.destroyRef.onDestroy(() => this.detenerRotacion());
  }

  protected toggle(): void {
    this.isOpen.update((abierto) => !abierto);
  }

  protected updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected useExample(pregunta: string): void {
    this.draft.set(pregunta);
    this.send();
  }

  protected send(): void {
    const pregunta = this.draft().trim();
    if (!pregunta || this.isSending() || this.isApplying()) {
      return;
    }
    const historial = this.historial();
    this.messages.update((items) => [...items, { role: 'user', text: pregunta }]);
    this.draft.set('');
    // Una pregunta nueva reemplaza el plan anterior: mantener acciones de una conversación
    // previa llevaría a aplicar algo que el usuario ya no está viendo en pantalla.
    this.limpiarPlan();
    this.isSending.set(true);
    this.iniciarRotacion();

    this.copilot
      .ask(pregunta, this.context(), historial)
      .pipe(
        finalize(() => {
          this.isSending.set(false);
          this.detenerRotacion();
        })
      )
      .subscribe({
        next: (respuesta) => this.registrarPlan(respuesta),
        error: (error: HttpErrorResponse) =>
          this.messages.update((items) => [
            ...items,
            { role: 'assistant', text: this.mensajeDeError(error) }
          ])
      });
  }

  private registrarPlan(respuesta: ConfigPlanResponse): void {
    this.messages.update((items) => [
      ...items,
      {
        role: 'assistant',
        text: respuesta.text,
        sources: respuesta.usedSources,
        avisos: respuesta.avisos
      }
    ]);
    this.plan.set(respuesta.plan);
  }

  /**
   * Importar un documento es otra forma de producir el mismo plan: se renderiza igual y pasa por
   * la misma confirmacion. Los bytes no se reenvian, solo el archivoId del documento ya subido.
   */
  protected importarDocumento(): void {
    const documento = this.documento();
    if (!documento || this.isSending() || this.isApplying()) {
      return;
    }

    this.dialog
      .open<ArchivoSelectorDialogComponent, ArchivoSelectorDialogData, ArchivoSelectorDialogResult | null>(
        ArchivoSelectorDialogComponent,
        { maxWidth: '96vw', data: documento }
      )
      .afterClosed()
      .subscribe((resultado) => {
        const archivo = resultado?.archivo;
        if (!archivo) {
          return;
        }
        this.messages.update((items) => [
          ...items,
          { role: 'user', text: `${documento.etiqueta}: ${archivo.name}` }
        ]);
        this.limpiarPlan();
        this.isSending.set(true);
        this.iniciarRotacion();

        this.copilot
          .importarDocumento(this.context(), archivo.id)
          .pipe(
            finalize(() => {
              this.isSending.set(false);
              this.detenerRotacion();
            })
          )
          .subscribe({
            next: (respuesta) => this.registrarPlan(respuesta),
            error: (error: HttpErrorResponse) =>
              this.messages.update((items) => [
                ...items,
                { role: 'assistant', text: this.mensajeDeError(error) }
              ])
          });
      });
  }

  protected alternarAccion(id: string): void {
    this.descartadas.update((actual) => {
      const siguiente = new Set(actual);
      if (!siguiente.delete(id)) {
        siguiente.add(id);
      }
      return siguiente;
    });
  }

  protected alternarDetalle(id: string): void {
    this.detalleAbierto.update((actual) => {
      const siguiente = new Set(actual);
      if (!siguiente.delete(id)) {
        siguiente.add(id);
      }
      return siguiente;
    });
  }

  protected estaSeleccionada(id: string): boolean {
    return !this.descartadas().has(id);
  }

  protected descartarPlan(): void {
    this.limpiarPlan();
  }

  protected aplicar(): void {
    const acciones = this.seleccionadas();
    if (!acciones.length || this.isApplying()) {
      return;
    }
    this.isApplying.set(true);

    this.copilot
      .apply(
        this.context(),
        acciones.map((accion) => ({
          id: accion.id,
          tipo: accion.tipo,
          payload: accion.payload,
          // Solo se envían dependencias que siguen en el plan: si el usuario desmarcó
          // la categoría padre, la hija debe fallar en el servidor, no colarse.
          dependeDe: accion.dependeDe.filter((id) => acciones.some((otra) => otra.id === id))
        }))
      )
      .pipe(finalize(() => this.isApplying.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.resultados.set(respuesta.resultados);
          this.plan.set([]);
          this.descartadas.set(new Set());
          this.messages.update((items) => [
            ...items,
            { role: 'assistant', text: this.resumenDeAplicacion(respuesta) }
          ]);
          this.aplicado.emit(respuesta);
        },
        error: (error: HttpErrorResponse) =>
          this.messages.update((items) => [
            ...items,
            { role: 'assistant', text: this.mensajeDeError(error) }
          ])
      });
  }

  protected iconoDeEstado(estado: ConfigActionOutcome['estado']): string {
    switch (estado) {
      case 'APLICADA':
        return 'check_circle';
      case 'OMITIDA':
        return 'skip_next';
      default:
        return 'error';
    }
  }

  private limpiarPlan(): void {
    this.plan.set([]);
    this.descartadas.set(new Set());
    this.resultados.set([]);
    this.detalleAbierto.set(new Set());
  }

  /** Solo turnos de texto: el backend descarta cualquier otra cosa que llegue del cliente. */
  private historial(): ConfigChatTurn[] {
    return this.messages().map((mensaje) => ({ role: mensaje.role, content: mensaje.text }));
  }

  private resumenDeAplicacion(respuesta: ConfigApplyResponse): string {
    const partes: string[] = [];
    if (respuesta.aplicadas) partes.push(`${respuesta.aplicadas} aplicadas`);
    if (respuesta.omitidas) partes.push(`${respuesta.omitidas} omitidas porque ya existían`);
    if (respuesta.rechazadas) partes.push(`${respuesta.rechazadas} rechazadas`);
    if (respuesta.fallidas) partes.push(`${respuesta.fallidas} con error`);
    return partes.length ? `Listo: ${partes.join(', ')}.` : 'No hubo cambios que aplicar.';
  }

  private mensajeDeError(error: HttpErrorResponse): string {
    return (
      error.error?.error ??
      'No pude completar la operación en este momento. Revisa la configuración de IA e intenta nuevamente.'
    );
  }

  private iniciarRotacion(): void {
    let indice = 0;
    this.pensando.set(PENSANDO[0]);
    this.rotacion = setInterval(() => {
      indice = (indice + 1) % PENSANDO.length;
      this.pensando.set(PENSANDO[indice]);
    }, 2600);
  }

  private detenerRotacion(): void {
    if (this.rotacion) {
      clearInterval(this.rotacion);
      this.rotacion = undefined;
    }
  }
}

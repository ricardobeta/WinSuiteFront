import { FlowGraph, FlowNode } from '../../models/asistente-ventas.models';

export interface SimMessage {
  from: 'bot' | 'user';
  text: string;
  options?: string[];
}

/**
 * Simulador en cliente del motor de flujos. Replica el comportamiento del backend
 * (`WhatsAppApplicationService`) para previsualizar un flujo sin enviar WhatsApp real.
 */
export class FlowSimulator {
  private currentNodeId: string | null = null;
  private waiting = false;

  constructor(private readonly graph: FlowGraph) {}

  get isWaiting(): boolean {
    return this.waiting;
  }

  private node(id: string | null): FlowNode | undefined {
    return this.graph.nodes.find((node) => node.id === id);
  }

  private firstNext(sourceId: string, handle?: string): string | null {
    const edges = this.graph.edges
      .filter((edge) => edge.source === sourceId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (handle !== undefined) {
      const branch = edges.find((edge) => (edge.sourceHandle ?? '') === handle);
      if (branch) return branch.target;
    }
    const general = edges.find((edge) => !edge.sourceHandle);
    return general?.target ?? edges[0]?.target ?? null;
  }

  /** Arranca el flujo con el mensaje inicial del usuario (evalúa keywords del trigger). */
  start(inbound: string): SimMessage[] {
    const trigger = this.graph.nodes.find((node) => node.type === 'trigger');
    if (!trigger) {
      return [{ from: 'bot', text: '⚠️ El flujo no tiene nodo de inicio.' }];
    }
    const keywords = trigger.data.keywords ?? [];
    const matches = keywords.length === 0 || keywords.some((kw) => inbound.toLowerCase().includes(kw.toLowerCase()));
    if (!matches) {
      return [{ from: 'bot', text: '🤖 (Sin coincidencia de palabras de inicio — aquí respondería la IA de respaldo.)' }];
    }
    return this.run(this.firstNext(trigger.id));
  }

  /** Continúa el flujo con la respuesta del usuario al nodo que esperaba. */
  reply(inbound: string): SimMessage[] {
    if (!this.waiting || !this.currentNodeId) {
      return this.start(inbound);
    }
    const node = this.node(this.currentNodeId);
    this.waiting = false;
    if (!node) return [];

    if (node.type === 'buttons' || node.type === 'list') {
      const option = (node.data.options ?? []).find(
        (opt) => opt.label.toLowerCase() === inbound.toLowerCase() || opt.id.toLowerCase() === inbound.toLowerCase()
      );
      return this.run(this.firstNext(node.id, option?.id));
    }
    if (node.type === 'ai') {
      const out: SimMessage[] = [{ from: 'bot', text: '🤖 (Respuesta generada por IA sobre la base de conocimiento.)' }];
      return [...out, ...this.run(this.firstNext(node.id))];
    }
    // question u otros: continúa por la salida general.
    return this.run(this.firstNext(node.id));
  }

  private run(startId: string | null): SimMessage[] {
    const messages: SimMessage[] = [];
    let cursor = startId;
    const guard = new Set<string>();

    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      const node = this.node(cursor);
      if (!node) break;

      switch (node.type) {
        case 'end':
          messages.push({ from: 'bot', text: '— Fin de la conversación —' });
          this.currentNodeId = cursor;
          return messages;
        case 'text':
          messages.push({ from: 'bot', text: node.data.text || '(mensaje vacío)' });
          break;
        case 'buttons':
        case 'list':
          messages.push({
            from: 'bot',
            text: node.data.text || '(mensaje vacío)',
            options: (node.data.options ?? []).map((opt) => opt.label)
          });
          this.currentNodeId = cursor;
          this.waiting = true;
          return messages;
        case 'question':
          messages.push({ from: 'bot', text: node.data.text || '(pregunta vacía)' });
          this.currentNodeId = cursor;
          this.waiting = true;
          return messages;
        case 'ai':
          messages.push({ from: 'bot', text: '🤖 (El nodo de IA responderá según la conversación y el conocimiento de la empresa.)' });
          this.currentNodeId = cursor;
          this.waiting = true;
          return messages;
        case 'delay':
          messages.push({ from: 'bot', text: `⏳ (Espera de ${node.data.delaySeconds ?? 0}s)` });
          break;
        case 'action':
          messages.push({ from: 'bot', text: `⚙️ (Acción: ${node.data.actionType ?? 'sin definir'})` });
          break;
        case 'condition':
          messages.push({ from: 'bot', text: '🔀 (Se evalúa la condición y se toma la primera rama en la simulación.)' });
          cursor = this.firstNext(node.id);
          continue;
      }
      cursor = this.firstNext(node.id);
    }
    this.currentNodeId = cursor;
    return messages;
  }
}

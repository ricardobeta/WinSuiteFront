import { FlowGraph, FlowIssue, FlowNode } from '../../models/asistente-ventas.models';
import { FLOW_NODE_CATALOG } from './flow-node-catalog';

/** Separa el id de conector de Foblex (`nodeId::handle`) en sus partes. */
const HANDLE_SEP = '::';

export function inputConnectorId(nodeId: string): string {
  return `${nodeId}${HANDLE_SEP}in`;
}

export function outputConnectorId(nodeId: string, handle?: string | null): string {
  return `${nodeId}${HANDLE_SEP}${handle && handle.length ? handle : 'out'}`;
}

export interface ParsedConnector {
  nodeId: string;
  /** `undefined` para la salida general (`out`), o el id de opción/rama. */
  handle?: string;
}

export function parseConnectorId(connectorId: string): ParsedConnector {
  const index = connectorId.indexOf(HANDLE_SEP);
  if (index < 0) {
    return { nodeId: connectorId };
  }
  const nodeId = connectorId.slice(0, index);
  const handle = connectorId.slice(index + HANDLE_SEP.length);
  return { nodeId, handle: handle === 'out' ? undefined : handle };
}

/** Salidas (handles) que expone un nodo: una por opción en nodos con ramas, una general en el resto. */
export function outputHandles(node: FlowNode): { id?: string; label: string }[] {
  const meta = FLOW_NODE_CATALOG[node.type];
  if (meta.type === 'end') {
    return [];
  }
  if (meta.hasBranches) {
    const options = (node.data.options ?? []).map((option) => ({ id: option.id, label: option.label }));
    if (node.type === 'condition') {
      return [...options, { id: 'else', label: 'Si no' }];
    }
    return options;
  }
  return [{ id: undefined, label: '' }];
}

/** Valida el grafo y devuelve la lista de problemas para el panel del builder. */
export function validateGraph(graph: FlowGraph): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const triggers = nodes.filter((node) => node.type === 'trigger');
  if (triggers.length === 0) {
    issues.push({ nodeId: null, severity: 'error', message: 'El flujo necesita un nodo de Inicio.' });
  }
  if (triggers.length > 1) {
    issues.push({ nodeId: null, severity: 'error', message: 'Sólo puede haber un nodo de Inicio.' });
  }
  triggers.forEach((trigger) => {
    if (!(trigger.data.keywords ?? []).some((keyword) => keyword.trim().length)) {
      issues.push({ nodeId: trigger.id, severity: 'error', message: 'Define al menos una palabra de inicio.' });
    }
  });

  const hasIncoming = new Set(edges.map((edge) => edge.target));
  const hasOutgoing = new Set(edges.map((edge) => edge.source));

  for (const node of nodes) {
    const meta = FLOW_NODE_CATALOG[node.type];

    // Nodos huérfanos (sin entrada), salvo el trigger.
    if (node.type !== 'trigger' && !hasIncoming.has(node.id)) {
      issues.push({ nodeId: node.id, severity: 'warning', message: `"${node.label}" no está conectado a nada.` });
    }

    // Nodos sin salida (salvo end y los que esperan respuesta pueden quedar sin salida temporalmente).
    if (node.type !== 'end' && !meta.hasBranches && !hasOutgoing.has(node.id)) {
      issues.push({ nodeId: node.id, severity: 'warning', message: `"${node.label}" no continúa a ningún nodo.` });
    }

    // Texto vacío en nodos de mensaje.
    if ((node.type === 'text' || node.type === 'buttons' || node.type === 'list' || node.type === 'question') && !(node.data.text ?? '').trim()) {
      issues.push({ nodeId: node.id, severity: 'warning', message: `"${node.label}" no tiene mensaje.` });
    }

    // Opciones sin destino en nodos con ramas.
    if (meta.hasBranches) {
      for (const handle of outputHandles(node)) {
        const connected = edges.some((edge) => edge.source === node.id && (edge.sourceHandle ?? '') === (handle.id ?? ''));
        if (!connected && handle.id !== 'else') {
          issues.push({ nodeId: node.id, severity: 'warning', message: `La opción "${handle.label}" de "${node.label}" no lleva a ningún nodo.` });
        }
      }
    }

    // Nodo IA sin prompt.
    if (node.type === 'ai' && !(node.data.aiPrompt ?? '').trim()) {
      issues.push({ nodeId: node.id, severity: 'warning', message: `El nodo de IA "${node.label}" no tiene instrucciones.` });
    }
  }

  return issues;
}

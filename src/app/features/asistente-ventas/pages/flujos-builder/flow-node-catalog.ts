import { FlowNodeData, FlowNodeType } from '../../models/asistente-ventas.models';

export interface FlowNodeMeta {
  type: FlowNodeType;
  label: string;
  icon: string;
  /** Color base del nodo (usado para acento e icono). */
  color: string;
  description: string;
  /** true si el nodo detiene el flujo esperando respuesta del contacto. */
  waitsForReply: boolean;
  /** true si el nodo expone una salida por cada opción (buttons/list/condition). */
  hasBranches: boolean;
}

export const FLOW_NODE_CATALOG: Record<FlowNodeType, FlowNodeMeta> = {
  trigger: {
    type: 'trigger',
    label: 'Inicio',
    icon: 'bolt',
    color: '#16a34a',
    description: 'Palabras que activan el flujo',
    waitsForReply: false,
    hasBranches: false
  },
  text: {
    type: 'text',
    label: 'Mensaje',
    icon: 'chat',
    color: '#2563eb',
    description: 'Envía un mensaje de texto',
    waitsForReply: false,
    hasBranches: false
  },
  buttons: {
    type: 'buttons',
    label: 'Botones',
    icon: 'smart_button',
    color: '#7c3aed',
    description: 'Hasta 3 botones de respuesta rápida',
    waitsForReply: true,
    hasBranches: true
  },
  list: {
    type: 'list',
    label: 'Lista',
    icon: 'format_list_bulleted',
    color: '#9333ea',
    description: 'Menú de opciones en lista',
    waitsForReply: true,
    hasBranches: true
  },
  question: {
    type: 'question',
    label: 'Pregunta',
    icon: 'help',
    color: '#0891b2',
    description: 'Pregunta abierta y guarda la respuesta',
    waitsForReply: true,
    hasBranches: false
  },
  ai: {
    type: 'ai',
    label: 'IA',
    icon: 'auto_awesome',
    color: '#db2777',
    description: 'Responde con IA usando la base de conocimiento',
    waitsForReply: true,
    hasBranches: false
  },
  condition: {
    type: 'condition',
    label: 'Condición',
    icon: 'call_split',
    color: '#d97706',
    description: 'Ramifica según una variable capturada',
    waitsForReply: false,
    hasBranches: true
  },
  action: {
    type: 'action',
    label: 'Acción',
    icon: 'bolt',
    color: '#0d9488',
    description: 'Crea un lead, etiqueta o llama a una API',
    waitsForReply: false,
    hasBranches: false
  },
  delay: {
    type: 'delay',
    label: 'Espera',
    icon: 'schedule',
    color: '#64748b',
    description: 'Pausa el flujo unos segundos',
    waitsForReply: false,
    hasBranches: false
  },
  end: {
    type: 'end',
    label: 'Fin',
    icon: 'flag',
    color: '#dc2626',
    description: 'Termina la conversación',
    waitsForReply: false,
    hasBranches: false
  }
};

/** Orden de la paleta lateral. `trigger` no está: sólo puede existir uno, creado por defecto. */
export const PALETTE_NODE_TYPES: FlowNodeType[] = [
  'text',
  'buttons',
  'list',
  'question',
  'ai',
  'condition',
  'action',
  'delay',
  'end'
];

/** Datos por defecto al crear un nodo nuevo del tipo indicado. */
export function defaultNodeData(type: FlowNodeType, nodeId: string): FlowNodeData {
  switch (type) {
    case 'trigger':
      return { keywords: ['hola'] };
    case 'buttons':
      return {
        text: 'Elige una opción',
        options: [
          { id: `${nodeId}-op1`, label: 'Opción 1' },
          { id: `${nodeId}-op2`, label: 'Opción 2' }
        ]
      };
    case 'list':
      return {
        text: 'Selecciona una opción',
        buttonText: 'Ver opciones',
        options: [
          { id: `${nodeId}-op1`, label: 'Opción 1' },
          { id: `${nodeId}-op2`, label: 'Opción 2' }
        ]
      };
    case 'question':
      return { text: '¿Cuál es tu nombre?', captureVariable: 'nombre' };
    case 'ai':
      return {
        text: '',
        aiPrompt: 'Responde de forma breve y amable como asesor de ventas.',
        aiUseRag: true,
        captureVariable: ''
      };
    case 'condition':
      return {
        options: [
          { id: `${nodeId}-c1`, label: 'Es cliente', variable: 'es_cliente', operator: 'equals', value: 'si' }
        ]
      };
    case 'action':
      return { actionType: 'create_lead', actionConfig: {} };
    case 'delay':
      return { delaySeconds: 3 };
    default:
      return { text: '' };
  }
}

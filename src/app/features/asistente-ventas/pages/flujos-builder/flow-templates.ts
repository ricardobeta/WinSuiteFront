import { FlowGraph } from '../../models/asistente-ventas.models';

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  build: () => FlowGraph;
}

/** Plantillas de flujo listas para usar como punto de partida. */
export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'blank',
    name: 'En blanco',
    description: 'Sólo el nodo de inicio',
    icon: 'add',
    build: () => ({
      nodes: [{ id: 'trigger-1', type: 'trigger', label: 'Inicio', x: 80, y: 200, data: { keywords: ['hola'] } }],
      edges: []
    })
  },
  {
    id: 'welcome',
    name: 'Bienvenida',
    description: 'Saludo + menú de botones ventas/soporte',
    icon: 'waving_hand',
    build: () => ({
      nodes: [
        { id: 'trigger-1', type: 'trigger', label: 'Inicio', x: 60, y: 200, data: { keywords: ['hola', 'inicio', 'buenas'] } },
        { id: 'text-1', type: 'text', label: 'Bienvenida', x: 360, y: 200, data: { text: '¡Hola! Gracias por escribirnos 👋 ¿En qué te ayudamos?' } },
        {
          id: 'buttons-1',
          type: 'buttons',
          label: 'Menú',
          x: 660,
          y: 200,
          data: {
            text: 'Elige una opción',
            options: [
              { id: 'ventas', label: 'Ventas' },
              { id: 'soporte', label: 'Soporte' }
            ]
          }
        },
        { id: 'text-ventas', type: 'text', label: 'Ventas', x: 980, y: 100, data: { text: 'Un asesor de ventas te atenderá enseguida.' } },
        { id: 'text-soporte', type: 'text', label: 'Soporte', x: 980, y: 320, data: { text: 'Cuéntanos tu problema y te ayudamos.' } }
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'text-1', order: 0 },
        { id: 'e2', source: 'text-1', target: 'buttons-1', order: 1 },
        { id: 'e3', source: 'buttons-1', target: 'text-ventas', sourceHandle: 'ventas', order: 2 },
        { id: 'e4', source: 'buttons-1', target: 'text-soporte', sourceHandle: 'soporte', order: 3 }
      ]
    })
  },
  {
    id: 'catalog',
    name: 'Catálogo',
    description: 'Muestra productos y captura interés',
    icon: 'storefront',
    build: () => ({
      nodes: [
        { id: 'trigger-1', type: 'trigger', label: 'Inicio', x: 60, y: 200, data: { keywords: ['catalogo', 'productos', 'precios'] } },
        {
          id: 'list-1',
          type: 'list',
          label: 'Categorías',
          x: 360,
          y: 200,
          data: {
            text: '¿Qué categoría te interesa?',
            buttonText: 'Ver categorías',
            options: [
              { id: 'cat-a', label: 'Ofertas' },
              { id: 'cat-b', label: 'Novedades' }
            ]
          }
        },
        { id: 'ai-1', type: 'ai', label: 'Asesor IA', x: 700, y: 200, data: { aiPrompt: 'Recomienda productos según el interés del cliente usando el catálogo.', aiUseRag: true } },
        { id: 'end-1', type: 'end', label: 'Fin', x: 1020, y: 200, data: {} }
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'list-1', order: 0 },
        { id: 'e2', source: 'list-1', target: 'ai-1', sourceHandle: 'cat-a', order: 1 },
        { id: 'e3', source: 'list-1', target: 'ai-1', sourceHandle: 'cat-b', order: 2 },
        { id: 'e4', source: 'ai-1', target: 'end-1', order: 3 }
      ]
    })
  },
  {
    id: 'appointment',
    name: 'Agendar cita',
    description: 'Captura datos y crea un lead',
    icon: 'event',
    build: () => ({
      nodes: [
        { id: 'trigger-1', type: 'trigger', label: 'Inicio', x: 60, y: 200, data: { keywords: ['cita', 'agendar', 'reservar'] } },
        { id: 'q-nombre', type: 'question', label: 'Nombre', x: 340, y: 200, data: { text: '¿Cuál es tu nombre?', captureVariable: 'nombre' } },
        { id: 'q-fecha', type: 'question', label: 'Fecha', x: 620, y: 200, data: { text: '¿Qué día te viene bien?', captureVariable: 'fecha' } },
        { id: 'action-1', type: 'action', label: 'Crear lead', x: 900, y: 200, data: { actionType: 'create_lead', actionConfig: {} } },
        { id: 'text-ok', type: 'text', label: 'Confirmación', x: 1180, y: 200, data: { text: '¡Listo! Te confirmamos la cita en breve.' } }
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'q-nombre', order: 0 },
        { id: 'e2', source: 'q-nombre', target: 'q-fecha', order: 1 },
        { id: 'e3', source: 'q-fecha', target: 'action-1', order: 2 },
        { id: 'e4', source: 'action-1', target: 'text-ok', order: 3 }
      ]
    })
  },
  {
    id: 'faq',
    name: 'Preguntas frecuentes (IA)',
    description: 'Responde dudas con IA + base de conocimiento',
    icon: 'quiz',
    build: () => ({
      nodes: [
        { id: 'trigger-1', type: 'trigger', label: 'Inicio', x: 80, y: 200, data: { keywords: ['ayuda', 'pregunta', 'duda'] } },
        { id: 'ai-1', type: 'ai', label: 'IA + Conocimiento', x: 400, y: 200, data: { aiPrompt: 'Responde la duda del cliente usando únicamente la base de conocimiento de la empresa.', aiUseRag: true } }
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'ai-1', order: 0 }]
    })
  }
];

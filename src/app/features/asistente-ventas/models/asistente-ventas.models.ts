export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  displayName: string;
  businessAccountId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  wabaId?: string | null;
  connectedAt?: number | null;
  tokenExpiresAt?: number | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface TemplateButton {
  type: TemplateButtonType;
  text: string;
  value?: string;
}

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  instanceId: string;
  name: string;
  category: string;
  language: string;
  body: string;
  status: string;
  headerType?: 'NONE' | 'TEXT' | 'IMAGE';
  headerText?: string;
  footerText?: string;
  /** JSON serializado de TemplateButton[]. */
  buttonsJson?: string;
  /** Ejemplos de variables separados por '|'. */
  example?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FlowDefinition {
  id: string;
  tenantId: string;
  instanceId: string;
  name: string;
  version: string;
  status: string;
  graphJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface FunnelDefinition {
  id: string;
  tenantId: string;
  flowId: string;
  name: string;
  status: string;
  stagesJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface FunnelStage {
  id: string;
  name: string;
  nodeIds: string[];
}

export interface StageMetric {
  stageId: string;
  name: string;
  reached: number;
  conversion: number;
}

export interface FunnelMetrics {
  flowId: string;
  stages: StageMetric[];
}

export interface ConversationMessage {
  id: string;
  tenantId: string;
  instanceId: string;
  conversationId: string;
  direction: string;
  fromPhone: string | null;
  toPhone: string | null;
  type: string;
  body: string;
  status: string;
  providerMessageId: string;
  createdAt: number;
}

export interface ConversationSummary {
  conversationId: string;
  instanceId: string;
  contactPhone: string;
  lastMessage: string;
  lastDirection: string;
  status: string;
  updatedAt: number;
}

export interface AiConfigView {
  provider: string;
  model: string | null;
  systemPrompt: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  chunkCount: number;
}

export interface KnowledgeItem {
  id: string;
  source: string;
  text: string;
}

/** Tipo de fuente personalizado de la base de conocimiento (persistido por tenant en Firebase). */
export interface SourceTypeDto {
  value: string;
  label: string;
  icon: string;
  hint: string;
}

export interface AiAnswer {
  text: string;
  usedSources: string[];
  inputTokens: number;
  outputTokens: number;
}

export type FlowNodeType =
  | 'trigger'
  | 'text'
  | 'buttons'
  | 'list'
  | 'question'
  | 'ai'
  | 'condition'
  | 'action'
  | 'delay'
  | 'end';

export interface FlowOption {
  id: string;
  label: string;
  /** Sólo para nodos `condition`: rama evaluada por variable/operador/valor. */
  variable?: string;
  operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'exists';
  value?: string;
}

export interface FlowNodeData {
  text?: string;
  keyword?: string;
  keywords?: string[];
  buttonText?: string;
  options?: FlowOption[];
  /** Nombre de variable donde se guarda la respuesta del contacto (question / ai). */
  captureVariable?: string;
  /** Configuración del nodo IA. */
  aiPrompt?: string;
  aiPersona?: string;
  aiUseRag?: boolean;
  /** Configuración del nodo Acción. */
  actionType?: 'create_lead' | 'add_tag' | 'http' | 'handoff';
  actionConfig?: Record<string, string>;
  /** Segundos de espera para el nodo Delay. */
  delaySeconds?: number;
}

/** Resultado de validación de un flujo, mostrado en el panel de problemas del builder. */
export interface FlowIssue {
  nodeId: string | null;
  severity: 'error' | 'warning';
  message: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  x: number;
  y: number;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  order?: number;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

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

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  instanceId: string;
  name: string;
  category: string;
  language: string;
  body: string;
  status: string;
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

export type FlowNodeType = 'trigger' | 'text' | 'buttons' | 'list' | 'question' | 'end';

export interface FlowOption {
  id: string;
  label: string;
}

export interface FlowNodeData {
  text?: string;
  keyword?: string;
  keywords?: string[];
  buttonText?: string;
  options?: FlowOption[];
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

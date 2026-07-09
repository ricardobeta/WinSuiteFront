export type AuditAction =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'aprobar'
  | 'reversar'
  | 'importar'
  | 'generar'
  | 'publicar'
  | 'configurar';

export type AuditOrigin = 'frontend' | 'backend' | 'sistema';

export interface AuditActor {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
}

export interface AuditTarget {
  module: string;
  entityType: string;
  entityId: string;
  label?: string | null;
}

export interface AuditMetadata {
  creadoPor?: string | null;
  creadoEn?: number;
  actualizadoPor?: string | null;
  actualizadoEn?: number;
  ultimaAccion?: string | null;
}

export interface AuditEvent {
  id?: string;
  tenantId: string;
  timestamp: number;
  userId: string;
  actor: AuditActor;
  action: AuditAction;
  origin: AuditOrigin;
  module: string;
  entityType: string;
  entityId: string;
  target: AuditTarget;
  summary: string;
  changesBefore?: Record<string, unknown> | null;
  changesAfter?: Record<string, unknown> | null;
}

export interface RecordAuditInput {
  action: AuditAction;
  target: AuditTarget;
  summary?: string;
  origin?: AuditOrigin;
  changesBefore?: Record<string, unknown> | null;
  changesAfter?: Record<string, unknown> | null;
}

export type SriJobStatus = 'queued' | 'running' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled' | 'config_saved';
export type SriFrecuencia = 'diaria' | 'semanal' | 'mensual';

export interface SriScheduleRequest {
  activa: boolean;
  frecuencia: SriFrecuencia;
  diaSemana?: number | null;
  diaMes?: number | null;
}

export interface SriConfigRequest {
  ruc: string;
  usuario?: string | null;
  password: string;
  programacion: SriScheduleRequest;
}

export interface SriDownloadRequest {
  fechaInicio: string;
  fechaFin: string;
}

export interface SriDownloadJob {
  id: string;
  tenantId: string;
  status: SriJobStatus;
  tipo: string;
  modo: 'manual' | 'scheduled' | 'config';
  fechaInicio?: string | null;
  fechaFin?: string | null;
  createdAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  totalEncontradas: number;
  xmlGuardados: number;
  pdfGuardados: number;
  duplicados: number;
  omitidosCuota: number;
  errores: string[];
  advertencias: string[];
  metadata?: Record<string, unknown>;
}

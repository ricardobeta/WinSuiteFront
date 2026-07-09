export type SriJobStatus = 'queued' | 'running' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled' | 'config_saved';

export interface SriConnectionCheck {
  worker: string;
  spring: string;
  springDetail?: string;
  ready: boolean;
  credencialesConfiguradas?: boolean;
}

// Credenciales SRI que se guardan SOLO en el worker local (no en el cloud).
export interface SriWorkerConfigRequest {
  ruc: string;
  usuario?: string | null;
  password: string;
}

// Peticion al worker local (localhost) para correr una descarga.
// Las credenciales NO viajan aqui: el worker las lee de su almacen local.
export interface SriWorkerRunRequest {
  jobId: string;
  tenantId: string;
  anio?: number;
  mes?: number;
  dia?: number | null;
  descargarXml?: boolean;
  descargarPdf?: boolean;
}

export interface SriDownloadRequest {
  fechaInicio: string;
  fechaFin: string;
  // Modo explicito hacia el worker: anio+mes con dia=null => mes completo
  // (el webscraping selecciona "Todos" del dia = 1 solo captcha). Con dia => ese dia.
  anio?: number;
  mes?: number;
  dia?: number | null;
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

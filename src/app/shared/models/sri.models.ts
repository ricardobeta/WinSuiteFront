export type SriJobStatus = 'queued' | 'running' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled' | 'config_saved';

// Tipos de comprobante del SRI (value = <option> del select cmbTipoComprobante).
// El worker usa el value para seleccionar el tipo y el nombre para almacenar cada
// documento con su nombre respectivo.
export interface SriTipoComprobante {
  value: string;
  label: string;
}

export const SRI_TIPOS_COMPROBANTE: readonly SriTipoComprobante[] = [
  { value: '1', label: 'Factura' },
  { value: '2', label: 'Liquidación de compra de bienes y prestación de servicios' },
  { value: '3', label: 'Notas de Crédito' },
  { value: '4', label: 'Notas de Débito' },
  { value: '6', label: 'Comprobante de Retención' }
] as const;

export const SRI_TIPO_COMPROBANTE_DEFAULT = '1';

export interface SriConnectionCheck {
  worker: string;
  // Version del agente local reportada por el worker (para el control de version).
  version?: string;
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
  // Tipo de comprobante a descargar (value del select del SRI). Default '1' (Factura).
  tipoComprobante?: string;
}

export interface SriDownloadRequest {
  fechaInicio: string;
  fechaFin: string;
  // Modo explicito hacia el worker: anio+mes con dia=null => mes completo
  // (el webscraping selecciona "Todos" del dia = 1 solo captcha). Con dia => ese dia.
  anio?: number;
  mes?: number;
  dia?: number | null;
  // Tipo de comprobante a descargar (value del select del SRI). Default '1' (Factura).
  tipoComprobante?: string;
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

export type TipoProyectoInmobiliario = 'PROMOTOR_INMOBILIARIO' | 'VIVIENDA_PROPIA';
export type EstadoExpedienteSri = 'BORRADOR' | 'GENERADO';

export interface ProyectoInmobiliario {
  id: string;
  nombre: string;
  numeroRegistro: string;
  costoTotalReferencial: number;
  tipoProyecto: TipoProyectoInmobiliario;
  activo: boolean;
  creadoEn: number;
  actualizadoEn: number;
  creadoPor: string;
  actualizadoPor: string;
}

export interface ProyectoInmobiliarioInput {
  nombre: string;
  numeroRegistro: string;
  costoTotalReferencial: number;
  tipoProyecto: TipoProyectoInmobiliario;
  activo?: boolean;
}

export interface GrupoIva {
  tarifa: number;
  baseFuente: number;
  ivaFuente: number;
}

export interface ComprobanteCandidato {
  id: string;
  fechaEmision: number;
  proveedorRuc: string;
  proveedorNombre: string;
  codSustento: string;
  tipoComprobante: '01' | '04';
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  autorizacion: string;
  gruposIva: GrupoIva[];
  sourceFingerprint: string;
  elegible: boolean;
  motivoBloqueo: string;
  advertencias: string[];
}

export interface CandidatosPage {
  items: ComprobanteCandidato[];
  nextCursor: string | null;
  hasMore: boolean;
  totalFiltrado: number;
}

export interface LineaElegible {
  facturaId: string;
  tarifa: number;
  baseElegible: number;
  ivaElegible: number;
  sourceFingerprint: string;
}

export interface ExpedienteDevolucionIva {
  id: string;
  proyectoId: string;
  periodo: string;
  estado: EstadoExpedienteSri;
  revision: number;
  lineas: LineaElegible[];
  exportaciones: ExportacionSri[];
  creadoEn: number;
  actualizadoEn: number;
}

export interface VistaPreviaLinea {
  numero: number;
  facturaId: string;
  fechaEmision: string;
  proveedorRuc: string;
  proveedorNombre: string;
  serie: string;
  secuencial: string;
  autorizacion: string;
  tipoComprobante: string;
  baseImponible: number;
  tarifaIva: number;
  ivaPagado: number;
  reembolso: 'NO';
}

export interface VistaPreviaDevolucionIva {
  expedienteId: string;
  revision: number;
  razonSocial: string;
  ruc: string;
  periodo: string;
  anio: number;
  mes: number;
  proyecto: ProyectoInmobiliario;
  lineas: VistaPreviaLinea[];
  totalBase: number;
  totalIva: number;
  ivaAcumuladoEstimado: number;
  limiteReferencial: number;
  superaLimite: boolean;
  advertencias: string[];
}

export interface ExportacionSri {
  version: number;
  generadoEn: number;
  generadoPor: string;
  nombreArchivo: string;
  templateVersion: string;
  totalBase: number;
  totalIva: number;
  numeroLineas: number;
  snapshot: VistaPreviaDevolucionIva;
  archivo?: ArchivoExportacionSri;
}

export type EstadoArchivoExportacionSri = 'DISPONIBLE' | 'ELIMINADO' | 'NO_ARCHIVADO';

export interface ArchivoExportacionSri {
  estado: EstadoArchivoExportacionSri;
  archivoId: string;
  tamanoBytes: number;
  sha256: string;
  almacenadoEn: number;
}

export interface ExportacionRecienteSri {
  expedienteId: string;
  proyectoId: string;
  proyectoNombre: string;
  periodo: string;
  version: number;
  generadoEn: number;
  nombreArchivo: string;
  totalIva: number;
  numeroLineas: number;
  archivo?: ArchivoExportacionSri;
}

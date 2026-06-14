export type CatalogoFacturacionNombre =
  | 'FormaPago'
  | 'TipoIdentificacion'
  | 'Ambiente'
  | 'CodigoPorcentajeIva';

export interface CatalogoEntry {
  code: string;
  value: string;
}

export interface FirmaDigitalConfig {
  id: string;
  tenantId?: string;
  nombreArchivo: string;
  nombreComercial?: string;
  url: string;
  contrasena?: string;
  ruc?: string;
  razonSocial?: string;
}

/**
 * Establecimiento (establecimientos de facturación)
 * Representa una sucursal o punto de negocio que puede emitir facturas.
 * Un establecimiento está asociado a uno o varios almacenes.
 */
export interface EstablecimientoConfig {
  id: string;
  codigo: string;  // 3 dígitos para SRI (001, 002, etc.)
  nombre: string;
  direccion?: string;
  // Lista de almacenes donde se puede facturar con este establecimiento
  almacenIds?: string[];
  activo?: boolean;
}

/**
 * Punto de Emisión (terminal de venta POS)
 * Representa un punto de venta físico o lógico desde el cual se emiten facturas.
 * Un punto de emisión pertenece a un establecimiento.
 */
export interface PuntoEmisionConfig {
  id: string;
  codigo: string;  // 3 dígitos para SRI (001, 002, etc.)
  descripcion: string;
  firmaId: string;
  // Establecimiento al que pertenece este punto
  establecimientoId: string;
  activo?: boolean;
}

/**
 * Configuración de Facturación
 * Contiene los catálogos activos, ambiente, y la nueva estructura de
 * establecimientos y puntos de emisión.
 */
export interface ConfiguracionFacturacion {
  formaPagoActivos: string[];
  tipoIdentificacionActivos: string[];
  ambienteActivo: string | null;
  codigoPorcentajeIvaActivos: string[];
  // Nueva estructura: lista de establecimientos y puntos de emisión separados
  establecimientos: EstablecimientoConfig[];
  puntosEmision: PuntoEmisionConfig[];
  // Compatibilidad: mantener el listado antiguo para migración transitoria
  puntosEmisionLegacy?: PuntoEmisionConfig[];
  actualizadoEn?: number;
}

export interface CatalogosFacturacion {
  formaPago: CatalogoEntry[];
  tipoIdentificacion: CatalogoEntry[];
  ambiente: CatalogoEntry[];
  codigoPorcentajeIva: CatalogoEntry[];
}
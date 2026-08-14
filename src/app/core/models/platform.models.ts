import { TenantApiResponse } from './auth.models';

/** Sentinela de "sin limite" que comparte el backend en cualquier campo numerico de un plan. */
export const SIN_LIMITE = -1;

/** Recursos medibles. Las claves coinciden con el enum PlatformResource del backend. */
export type RecursoPlataforma =
  | 'aiTokens'
  | 'facturasSri'
  | 'descargasSri'
  | 'storageBytes'
  | 'sitesMediaBytes'
  | 'sitiosEcommerce'
  | 'sitiosLanding'
  | 'colaboradores';

export interface LimitesPlan {
  storageBytes?: number | null;
  sitesMediaBytes?: number | null;
  sitiosEcommerce?: number | null;
  sitiosLanding?: number | null;
  aiTokensMes?: number | null;
  facturasSriMes?: number | null;
  descargasSriMes?: number | null;
  colaboradores?: number | null;
  sriWorkerHabilitado?: boolean | null;
}

export interface PlanEmpresa {
  id: string;
  nombre: string;
  descripcion?: string;
  precioMensual?: number | null;
  precioAnual?: number | null;
  moneda?: string;
  activo: boolean;
  orden: number;
  visiblePublico: boolean;
  modulos: string[];
  limites: LimitesPlan;
  createdAt?: number;
  updatedAt?: number;
}

export interface PlanCuenta {
  id: string;
  nombre: string;
  descripcion?: string;
  precioMensual?: number | null;
  moneda?: string;
  activo: boolean;
  orden: number;
  visiblePublico: boolean;
  maxEmpresasPropias?: number | null;
  maxEmpresasVinculadas?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export type AplicaAddon = 'empresa' | 'cuenta';
export type TipoAddon = 'limite' | 'modulo';

export interface ComplementoPlataforma {
  id: string;
  nombre: string;
  descripcion?: string;
  aplicaA: AplicaAddon;
  tipo: TipoAddon;
  recurso?: string | null;
  cantidad?: number | null;
  moduloId?: string | null;
  precio?: number | null;
  moneda?: string;
  activo: boolean;
  orden: number;
}

export type EstadoSuscripcion = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface SuscripcionEmpresa {
  tenantId: string;
  planId: string;
  estado: EstadoSuscripcion;
  cicloInicio?: number | null;
  cicloFin?: number | null;
  limitesOverride?: LimitesPlan | null;
  modulosExtra?: string[] | null;
  notas?: string | null;
  updatedBy?: string;
  updatedAt?: number;
}

export interface PlanEfectivo {
  planId: string;
  planNombre: string;
  estado: EstadoSuscripcion;
  cicloInicio?: number | null;
  cicloFin?: number | null;
  limites: LimitesPlan;
  modulos: string[];
}

export interface ConsumoEmpresa {
  periodo: string;
  mensual: Partial<Record<RecursoPlataforma, number>>;
  acumulado: Partial<Record<RecursoPlataforma, number>>;
  bolsa: Partial<Record<RecursoPlataforma, number>>;
}

export interface EmpresaFila {
  tenantId: string;
  name: string;
  businessName?: string;
  email?: string;
  ownerId: string;
  status: string;
  planId: string;
  planNombre: string;
  estadoSuscripcion: EstadoSuscripcion;
  createdAt?: number;
}

export interface EmpresaDetalle {
  empresa: TenantApiResponse;
  suscripcion: SuscripcionEmpresa | null;
  planEfectivo: PlanEfectivo;
  uso: ConsumoEmpresa;
  ownerEmail?: string | null;
  colaboradoresActivos: number;
  miembros: MiembroEmpresa[];
}

/** Cuenta vinculada a una empresa, tal como consta en tenant_users. */
export interface MiembroEmpresa {
  userId: string;
  email?: string | null;
  nombre?: string | null;
  rol: string;
  activo: boolean;
  propietario: boolean;
  joinedAt?: number | null;
}

export interface CuentaFila {
  userId: string;
  email?: string | null;
  nombre?: string | null;
  planId: string;
  planNombre: string;
  maxEmpresasPropias: number;
  maxEmpresasVinculadas: number;
  empresasPropias: number;
  empresasVinculadas: number;
  empresas: EmpresaDeCuenta[];
}

/** Empresa a la que pertenece una cuenta, con el rol que tiene en ella. */
export interface EmpresaDeCuenta {
  tenantId: string;
  nombre: string;
  rol: string;
  propietario: boolean;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export type MetodoPago = 'payphone' | 'transferencia' | 'qr';

export type EstadoOrden =
  | 'PENDIENTE_PAGO'
  | 'PENDIENTE_VERIFICACION'
  | 'APLICANDO'
  | 'PAGADA'
  | 'RECHAZADA'
  | 'ANULADA';

export interface LineaOrden {
  tipo: 'plan' | 'addon';
  refId: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCentavos: number;
  subtotalCentavos: number;
  recurso?: string | null;
  unidades?: number | null;
  moduloId?: string | null;
}

export interface OrdenCompra {
  id: string;
  tenantId: string;
  tenantNombre?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  metodoPago: MetodoPago;
  estado: EstadoOrden;
  items: LineaOrden[];
  moneda: string;
  totalCentavos: number;
  createdAt?: number | null;
  updatedAt?: number | null;
  aplicadaEn?: number | null;
  payphoneTransactionId?: string | null;
  payphoneAutorizacion?: string | null;
  comprobanteUrl?: string | null;
  comprobanteNombre?: string | null;
  comprobanteSubidoEn?: number | null;
  referenciaPago?: string | null;
  revisadaPor?: string | null;
  revisadaEn?: number | null;
  motivoRechazo?: string | null;
  notas?: string | null;
}

export interface CuentaBancaria {
  banco?: string;
  tipo?: string;
  numero?: string;
  titular?: string;
  identificacion?: string;
  correo?: string;
}

/** Lo que el cliente necesita para pagar; el token de Payphone solo llega si esta habilitado. */
export interface MetodosPago {
  payphoneHabilitado: boolean;
  payphoneToken?: string | null;
  payphoneStoreId?: string | null;
  transferenciaHabilitada: boolean;
  transferenciaInstrucciones?: string | null;
  cuentas: CuentaBancaria[];
  qrHabilitado: boolean;
  qrImagenUrl?: string | null;
  qrInstrucciones?: string | null;
}

/** Ajustes de cobro que edita el super administrador. */
export interface AjustesPago {
  payphoneHabilitado: boolean;
  transferenciaHabilitada: boolean;
  transferenciaInstrucciones?: string | null;
  cuentas: CuentaBancaria[];
  qrHabilitado: boolean;
  qrImagenUrl?: string | null;
  qrInstrucciones?: string | null;
  updatedBy?: string | null;
  updatedAt?: number | null;
}

export interface CrearOrden {
  metodoPago: MetodoPago;
  planId?: string | null;
  complementos?: { addonId: string; cantidad: number }[];
}

export interface ConfirmacionPago {
  aprobada: boolean;
  orden: OrdenCompra;
  mensaje?: string | null;
}

/** Etiqueta legible de cada estado de orden, compartida por el cliente y el panel. */
export const ESTADOS_ORDEN: Record<EstadoOrden, string> = {
  PENDIENTE_PAGO: 'Esperando pago',
  PENDIENTE_VERIFICACION: 'Por verificar',
  APLICANDO: 'A medias',
  PAGADA: 'Pagada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
};

export interface ActualizarSuscripcionEmpresa {
  planId: string;
  estado: EstadoSuscripcion;
  cicloInicio?: number | null;
  cicloFin?: number | null;
  limitesOverride?: LimitesPlan | null;
  modulosExtra?: string[];
  notas?: string | null;
}

export interface ActualizarSuscripcionCuenta {
  planId: string;
  estado: EstadoSuscripcion;
  maxEmpresasPropiasOverride?: number | null;
  maxEmpresasVinculadasOverride?: number | null;
  notas?: string | null;
}

export interface AjusteBolsa {
  recurso: RecursoPlataforma;
  delta: number;
  motivo?: string;
}

/** Etiqueta y unidad de cada recurso, para pintar limites y consumo de forma legible. */
export const RECURSOS_META: Record<RecursoPlataforma, { label: string; unidad: 'bytes' | 'cantidad' }> = {
  aiTokens: { label: 'Tokens de IA', unidad: 'cantidad' },
  facturasSri: { label: 'Facturas emitidas al SRI', unidad: 'cantidad' },
  descargasSri: { label: 'Descargas automaticas del SRI', unidad: 'cantidad' },
  storageBytes: { label: 'Espacio de archivos', unidad: 'bytes' },
  sitesMediaBytes: { label: 'Imagenes publicas de sitios', unidad: 'bytes' },
  sitiosEcommerce: { label: 'Sitios ecommerce', unidad: 'cantidad' },
  sitiosLanding: { label: 'Landing pages', unidad: 'cantidad' },
  colaboradores: { label: 'Colaboradores', unidad: 'cantidad' },
};

/** Campo de LimitesPlan que fija el tope de cada recurso. */
export const LIMITE_DE_RECURSO: Record<RecursoPlataforma, keyof LimitesPlan> = {
  aiTokens: 'aiTokensMes',
  facturasSri: 'facturasSriMes',
  descargasSri: 'descargasSriMes',
  storageBytes: 'storageBytes',
  sitesMediaBytes: 'sitesMediaBytes',
  sitiosEcommerce: 'sitiosEcommerce',
  sitiosLanding: 'sitiosLanding',
  colaboradores: 'colaboradores',
};

/** Recursos que se cuentan contra el ciclo mensual; el resto son topes concurrentes. */
export const RECURSOS_MENSUALES: RecursoPlataforma[] = ['aiTokens', 'facturasSri', 'descargasSri'];

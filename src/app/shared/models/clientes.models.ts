export type TipoIdentificacion = 'cedula' | 'ruc' | 'pasaporte' | 'otro';

export type TipoCampo =
  | 'texto'
  | 'textarea'
  | 'booleano'
  | 'lista_simple'
  | 'lista_multiple'
  | 'catalogo'
  | 'fecha';

export interface OpcionLista {
  clave: string;
  valor: string;
}

export interface CampoPersonalizado {
  idCampo: string;
  nombreMostrar: string;
  tipo: TipoCampo;
  requerido?: boolean;
  opciones?: OpcionLista[];
  orden?: number;
  visibleEnLista?: boolean;
  activo?: boolean;
}

export const COLORES_ETIQUETA_CLIENTE = ['teal', 'blue', 'violet', 'amber', 'rose', 'slate'] as const;

export type ColorEtiquetaCliente = typeof COLORES_ETIQUETA_CLIENTE[number];

export interface EtiquetaClienteConfig {
  idEtiqueta: string;
  nombre: string;
  color: ColorEtiquetaCliente;
  activa: boolean;
  /** La etiqueta se administra desde un formulario mientras su integracion este activa. */
  origenFormularioId?: string;
}

export const CAMPOS_BASE_CLIENTE = [
  'nombreCompleto',
  'email',
  'telefono',
  'direccion',
  'identificacion',
  'etiquetas'
] as const;

export type CampoBaseCliente = typeof CAMPOS_BASE_CLIENTE[number];
export type CampoFormularioClienteKey = CampoBaseCliente | `custom:${string}`;

export interface ConfiguracionClientes {
  camposPersonalizados: CampoPersonalizado[];
  catalogoEtiquetas: EtiquetaClienteConfig[];
  ordenFormulario: CampoFormularioClienteKey[];
}

export interface Cliente {
  id?: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  direccion: string;
  identificacion: string;
  tipoDeIdentificacion: TipoIdentificacion;
  etiquetas: string[];
  camposPersonalizados?: Record<string, any>;
  /** Las altas automaticas requieren una revision humana antes de usarse en ventas. */
  fichaIncompleta?: boolean;
  origenCreacion?: {
    tipo: 'formulario_sitio';
    sitioId: string;
    formularioId: string;
    respuestaId: string;
  };
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface ClienteDialogData {
  cliente?: Cliente;
  identificacion?: string;
  tipoDeIdentificacion?: TipoIdentificacion;
  camposPersonalizados?: CampoPersonalizado[];
  modo?: 'crear' | 'editar' | 'popup';
}

export interface ClienteDialogResult {
  cliente: Cliente;
}

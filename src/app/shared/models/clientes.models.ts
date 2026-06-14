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

export interface ConfiguracionClientes {
  camposPersonalizados: CampoPersonalizado[];
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
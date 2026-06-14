export interface Servicio {
  id?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  impuestoPorcentaje: number;
  activo: boolean;
  creadoEn?: number;
  actualizadoEn?: number;
}

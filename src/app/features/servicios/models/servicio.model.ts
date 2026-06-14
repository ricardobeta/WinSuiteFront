export interface Servicio {
  id?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

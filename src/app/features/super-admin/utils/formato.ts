import { LIMITE_DE_RECURSO, LimitesPlan, RECURSOS_META, RecursoPlataforma, SIN_LIMITE } from '../../../core/models/platform.models';

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Formatea bytes en la unidad mas legible. -1 se muestra como "Sin limite". */
export function formatearBytes(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  if (valor === SIN_LIMITE) return 'Sin limite';
  if (valor === 0) return '0 B';
  const indice = Math.min(Math.floor(Math.log(valor) / Math.log(1024)), UNIDADES.length - 1);
  const escalado = valor / Math.pow(1024, indice);
  return `${escalado >= 10 || indice === 0 ? Math.round(escalado) : escalado.toFixed(1)} ${UNIDADES[indice]}`;
}

export function formatearCantidad(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  if (valor === SIN_LIMITE) return 'Sin limite';
  return valor.toLocaleString('es-EC');
}

/** Formatea un valor segun la unidad del recurso al que pertenece. */
export function formatearRecurso(recurso: RecursoPlataforma, valor: number | null | undefined): string {
  return RECURSOS_META[recurso].unidad === 'bytes' ? formatearBytes(valor) : formatearCantidad(valor);
}

export function limiteDe(limites: LimitesPlan | null | undefined, recurso: RecursoPlataforma): number | null {
  if (!limites) return null;
  const valor = limites[LIMITE_DE_RECURSO[recurso]];
  return typeof valor === 'number' ? valor : null;
}

/**
 * Porcentaje consumido de un recurso, acotado a 100. Devuelve null cuando no hay tope, para
 * que la interfaz muestre el consumo sin barra de progreso.
 */
export function porcentajeConsumo(consumido: number, limite: number | null): number | null {
  if (limite === null || limite === SIN_LIMITE || limite <= 0) return null;
  return Math.min(100, Math.round((consumido / limite) * 100));
}

/** Convierte megabytes escritos por el super administrador en bytes para guardar. */
export function megabytesABytes(mb: number | null | undefined): number | null {
  if (mb === null || mb === undefined) return null;
  return mb === SIN_LIMITE ? SIN_LIMITE : Math.round(mb * 1024 * 1024);
}

export function bytesAMegabytes(bytes: number | null | undefined): number | null {
  if (bytes === null || bytes === undefined) return null;
  return bytes === SIN_LIMITE ? SIN_LIMITE : Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

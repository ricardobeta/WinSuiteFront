/**
 * Busqueda paginada con filtro multi-campo sobre Realtime Database.
 *
 * RTDB solo admite un `orderByChild` por consulta, asi que los listados de contabilidad
 * ordenan por fecha dentro del periodo y no pueden filtrar por estado, origen o texto
 * en la propia query. Filtrar solo la pagina cargada dejaba la pagina 1 vacia cuando la
 * coincidencia caia en la pagina 2.
 *
 * Este helper encadena las paginas que ya devuelven los servicios (`getXxxPage`) aplicando
 * el predicado en cliente hasta llenar la pagina o agotar el periodo, de modo que los
 * resultados siempre empiezan en la pagina 1 y solo se leen los registros necesarios.
 */

/** Tope duro que aplican los servicios RTDB de contabilidad: `Math.min(limit, 100)`. */
export const TOPE_CHUNK_RTDB = 100;

/**
 * Red anti-runaway, no un tope de experiencia: un click en Buscar recorre el periodo
 * completo. Solo si un periodo es absurdamente grande se corta y se ofrece continuar.
 */
export const MAX_ESCANEO_SEGURIDAD = 20000;

/** Pagina cruda tal como la devuelven los servicios de contabilidad. */
export interface ChunkPage<T, C> {
  items: T[];
  nextCursor: C | null;
  hasMore: boolean;
}

export interface PaginaFiltrada<T, C> {
  items: T[];
  nextCursor: C | null;
  hasMore: boolean;
  /** Registros realmente leidos de RTDB en esta llamada (alimenta el texto de progreso). */
  escaneados: number;
  /** Lecturas realizadas. Con 1 no se muestra progreso: la busqueda fue instantanea. */
  chunks: number;
  /** true = se toco el techo de seguridad con la pagina incompleta; se puede continuar. */
  truncado: boolean;
}

export interface OpcionesBuscarPaginado<T, C> {
  /** Una pagina cruda del servicio. Se le pasa el limite ya acotado. */
  fetchChunk: (cursor: C | null, limit: number) => Promise<ChunkPage<T, C>>;
  /** Punto de corte derivable de cualquier item; null si el item no es cursorizable. */
  cursorDe: (item: T) => C | null;
  pageSize: number;
  cursorInicial?: C | null;
  /** null o ausente = sin filtros: ruta rapida de una sola lectura. */
  predicado?: ((item: T) => boolean) | null;
  chunkSize?: number;
  maxEscaneo?: number;
  onProgreso?: (progreso: { escaneados: number; encontrados: number; chunks: number }) => void;
  signal?: AbortSignal;
}

/** Se lanza cuando el usuario relanza la busqueda y el escaneo anterior queda obsoleto. */
export class BusquedaAbortadaError extends Error {
  constructor() {
    super('Busqueda abortada');
    this.name = 'BusquedaAbortadaError';
  }
}

function abortarSiHaceFalta(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new BusquedaAbortadaError();
  }
}

export async function buscarPaginado<T, C>(
  opts: OpcionesBuscarPaginado<T, C>
): Promise<PaginaFiltrada<T, C>> {
  const pageSize = Math.max(1, Math.trunc(opts.pageSize));
  const topeChunk = Math.max(1, Math.min(opts.chunkSize ?? TOPE_CHUNK_RTDB, TOPE_CHUNK_RTDB));
  const maxEscaneo = Math.max(pageSize, opts.maxEscaneo ?? MAX_ESCANEO_SEGURIDAD);
  const predicado = opts.predicado ?? null;

  abortarSiHaceFalta(opts.signal);

  // Sin filtros la busqueda cuesta exactamente lo mismo que antes de este helper:
  // una unica lectura del tamano de la pagina. Cero regresion en el caso comun.
  if (!predicado) {
    const page = await opts.fetchChunk(opts.cursorInicial ?? null, pageSize);
    abortarSiHaceFalta(opts.signal);
    return {
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      escaneados: page.items.length,
      chunks: 1,
      truncado: false
    };
  }

  const encontrados: T[] = [];
  let cursor = opts.cursorInicial ?? null;
  let cursorUltimoEscaneado: C | null = null;
  let escaneados = 0;
  let chunks = 0;
  let periodoAgotado = false;

  while (encontrados.length < pageSize && escaneados < maxEscaneo) {
    abortarSiHaceFalta(opts.signal);

    // El primer chunk pide justo el tamano de la pagina: si el filtro es poco selectivo
    // se llena a la primera y el coste iguala al de no filtrar. Solo cuando hace falta
    // seguir escaneando se pasa al tope de 100, que es la lectura mas eficiente por query.
    const limit = Math.min(chunks === 0 ? pageSize : topeChunk, maxEscaneo - escaneados);
    const page = await opts.fetchChunk(cursor, limit);
    abortarSiHaceFalta(opts.signal);

    chunks++;
    escaneados += page.items.length;
    for (const item of page.items) {
      if (predicado(item)) {
        encontrados.push(item);
      }
    }

    const ultimo = page.items.at(-1);
    cursorUltimoEscaneado =
      page.nextCursor ?? (ultimo ? opts.cursorDe(ultimo) : cursorUltimoEscaneado);

    opts.onProgreso?.({ escaneados, encontrados: encontrados.length, chunks });

    if (!page.hasMore || !page.nextCursor) {
      periodoAgotado = true;
      break;
    }
    cursor = page.nextCursor;
  }

  // El chunk aporto mas coincidencias de las que caben en la pagina. No se descarta
  // ninguna: se corta en pageSize y el cursor sale del ultimo item MOSTRADO, de forma
  // que la siguiente pagina arranca justo donde esta termino.
  if (encontrados.length > pageSize) {
    const visibles = encontrados.slice(0, pageSize);
    const corte = opts.cursorDe(visibles[visibles.length - 1]);
    if (corte !== null) {
      return {
        items: visibles,
        nextCursor: corte,
        hasMore: true,
        escaneados,
        chunks,
        truncado: false
      };
    }
    // Item sin identificador: antes desbordar la pagina que perder coincidencias.
    return {
      items: encontrados,
      nextCursor: cursorUltimoEscaneado,
      hasMore: !periodoAgotado,
      escaneados,
      chunks,
      truncado: false
    };
  }

  if (periodoAgotado) {
    return { items: encontrados, nextCursor: null, hasMore: false, escaneados, chunks, truncado: false };
  }

  // Pagina exacta o techo alcanzado: se continua desde el fin del chunk, no desde el
  // ultimo match, para no volver a escanear los no coincidentes ya descartados.
  return {
    items: encontrados,
    nextCursor: cursorUltimoEscaneado,
    hasMore: true,
    escaneados,
    chunks,
    truncado: encontrados.length < pageSize
  };
}

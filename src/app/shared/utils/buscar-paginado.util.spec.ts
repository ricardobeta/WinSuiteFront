import { describe, expect, it } from 'vitest';

import { BusquedaAbortadaError, ChunkPage, buscarPaginado } from './buscar-paginado.util';

interface Registro {
  id: string;
  valor: string;
  grupo: 'A' | 'B';
}

interface Cursor {
  value: string;
  key: string;
}

const cursorDe = (registro: Registro): Cursor => ({ value: registro.valor, key: registro.id });

const comparar = (a: Cursor, b: Cursor): number => {
  if (a.value !== b.value) return a.value < b.value ? -1 : 1;
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return 0;
};

/**
 * Crea `total` registros ordenables. `grupoDe` decide el grupo por indice,
 * lo que permite construir distribuciones concretas (los mas nuevos son los indices altos).
 */
function crearRegistros(total: number, grupoDe: (indice: number) => 'A' | 'B'): Registro[] {
  return Array.from({ length: total }, (_, indice) => ({
    id: `k${String(indice).padStart(4, '0')}`,
    valor: `v${String(indice).padStart(4, '0')}`,
    grupo: grupoDe(indice)
  }));
}

interface Espia {
  llamadas: { cursor: Cursor | null; limit: number }[];
}

/**
 * Reproduce fielmente la semantica de los servicios de contabilidad:
 * `orderByChild + startAt(periodo) + endAt(cursor inclusivo) + limitToLast(limit + (cursor ? 2 : 1))`,
 * descarte del hijo del cursor, `shift()` del sobrante y `reverse()` para devolver
 * los mas recientes primero. Si el helper funciona contra esto, funciona contra RTDB.
 */
function crearFetchChunk(registros: Registro[], espia?: Espia) {
  const ascendente = [...registros].sort((a, b) => comparar(cursorDe(a), cursorDe(b)));

  return async (cursor: Cursor | null, limit: number): Promise<ChunkPage<Registro, Cursor>> => {
    espia?.llamadas.push({ cursor, limit });

    const acotado = Math.max(1, Math.min(limit, 100));
    const aPedir = acotado + (cursor ? 2 : 1);
    const rango = cursor
      ? ascendente.filter((registro) => comparar(cursorDe(registro), cursor) <= 0)
      : ascendente;

    const items = rango
      .slice(Math.max(0, rango.length - aPedir))
      .filter((registro) => registro.id !== cursor?.key);

    const hasMore = items.length > acotado;
    if (hasMore) {
      items.shift();
    }
    items.reverse();
    const ultimo = items.at(-1);

    return { items, nextCursor: hasMore && ultimo ? cursorDe(ultimo) : null, hasMore };
  };
}

const esGrupoA = (registro: Registro): boolean => registro.grupo === 'A';

describe('buscarPaginado', () => {
  it('sin predicado hace una sola lectura del tamano de la pagina', async () => {
    const espia: Espia = { llamadas: [] };
    const registros = crearRegistros(300, () => 'A');

    const pagina = await buscarPaginado<Registro, Cursor>({
      fetchChunk: crearFetchChunk(registros, espia),
      cursorDe,
      pageSize: 50
    });

    expect(espia.llamadas).toHaveLength(1);
    expect(espia.llamadas[0].limit).toBe(50);
    expect(pagina.items).toHaveLength(50);
    expect(pagina.chunks).toBe(1);
    expect(pagina.hasMore).toBe(true);
    expect(pagina.truncado).toBe(false);
  });

  it('con un predicado poco selectivo tampoco encadena lecturas extra', async () => {
    const espia: Espia = { llamadas: [] };
    const registros = crearRegistros(300, () => 'A');

    const pagina = await buscarPaginado<Registro, Cursor>({
      fetchChunk: crearFetchChunk(registros, espia),
      cursorDe,
      predicado: esGrupoA,
      pageSize: 50
    });

    expect(espia.llamadas).toHaveLength(1);
    expect(espia.llamadas[0].limit).toBe(50);
    expect(pagina.items).toHaveLength(50);
    expect(pagina.escaneados).toBe(50);
  });

  it('trunca el chunk desbordado sin perder coincidencias y corta en el ultimo item mostrado', async () => {
    // Los 10 mas recientes son B, el resto A: el primer chunk no aporta nada
    // y el segundo (de 100) devuelve muchas mas coincidencias de las que caben.
    const registros = crearRegistros(200, (indice) => (indice >= 190 ? 'B' : 'A'));

    const pagina = await buscarPaginado<Registro, Cursor>({
      fetchChunk: crearFetchChunk(registros),
      cursorDe,
      predicado: esGrupoA,
      pageSize: 10
    });

    expect(pagina.items).toHaveLength(10);
    expect(pagina.chunks).toBe(2);
    expect(pagina.hasMore).toBe(true);
    expect(pagina.truncado).toBe(false);
    expect(pagina.nextCursor).toEqual(cursorDe(pagina.items[9]));
    // Los mas recientes del grupo A, en orden descendente.
    expect(pagina.items.map((registro) => registro.id)).toEqual([
      'k0189', 'k0188', 'k0187', 'k0186', 'k0185',
      'k0184', 'k0183', 'k0182', 'k0181', 'k0180'
    ]);
  });

  it('encadena paginas con un filtro selectivo sin huecos ni duplicados', async () => {
    const registros = crearRegistros(250, (indice) => (indice % 7 === 0 ? 'A' : 'B'));
    const fetchChunk = crearFetchChunk(registros);
    const esperado = registros.filter(esGrupoA).map((registro) => registro.id).reverse();

    const obtenido: string[] = [];
    let cursor: Cursor | null = null;
    let hasMore = true;
    let vueltas = 0;

    while (hasMore && vueltas < 50) {
      const pagina: Awaited<ReturnType<typeof buscarPaginado<Registro, Cursor>>> =
        await buscarPaginado<Registro, Cursor>({
          fetchChunk,
          cursorDe,
          predicado: esGrupoA,
          pageSize: 5,
          cursorInicial: cursor
        });
      obtenido.push(...pagina.items.map((registro) => registro.id));
      cursor = pagina.nextCursor;
      hasMore = pagina.hasMore;
      vueltas++;
    }

    expect(hasMore).toBe(false);
    expect(obtenido).toEqual(esperado);
    expect(new Set(obtenido).size).toBe(obtenido.length);
  });

  it('marca truncado al agotar el presupuesto y permite continuar sin reiniciar', async () => {
    // Solo los 3 registros mas antiguos coinciden: el presupuesto se agota antes de llegar.
    const registros = crearRegistros(300, (indice) => (indice < 3 ? 'A' : 'B'));
    const fetchChunk = crearFetchChunk(registros);

    const primera = await buscarPaginado<Registro, Cursor>({
      fetchChunk,
      cursorDe,
      predicado: esGrupoA,
      pageSize: 5,
      maxEscaneo: 60
    });

    expect(primera.items).toHaveLength(0);
    expect(primera.escaneados).toBe(60);
    expect(primera.truncado).toBe(true);
    expect(primera.hasMore).toBe(true);
    expect(primera.nextCursor).not.toBeNull();

    const segunda = await buscarPaginado<Registro, Cursor>({
      fetchChunk,
      cursorDe,
      predicado: esGrupoA,
      pageSize: 5,
      cursorInicial: primera.nextCursor
    });

    expect(segunda.truncado).toBe(false);
    expect(segunda.hasMore).toBe(false);
    expect(segunda.nextCursor).toBeNull();
    expect(segunda.items.map((registro) => registro.id)).toEqual(['k0002', 'k0001', 'k0000']);
  });

  it('cierra la busqueda al agotar el periodo sin coincidencias', async () => {
    const registros = crearRegistros(40, () => 'B');

    const pagina = await buscarPaginado<Registro, Cursor>({
      fetchChunk: crearFetchChunk(registros),
      cursorDe,
      predicado: esGrupoA,
      pageSize: 50
    });

    expect(pagina.items).toEqual([]);
    expect(pagina.hasMore).toBe(false);
    expect(pagina.nextCursor).toBeNull();
    expect(pagina.truncado).toBe(false);
    expect(pagina.escaneados).toBe(40);
  });

  it('informa el progreso solo mientras encadena chunks', async () => {
    const registros = crearRegistros(300, (indice) => (indice < 5 ? 'A' : 'B'));
    const progresos: number[] = [];

    await buscarPaginado<Registro, Cursor>({
      fetchChunk: crearFetchChunk(registros),
      cursorDe,
      predicado: esGrupoA,
      pageSize: 10,
      onProgreso: ({ escaneados }) => progresos.push(escaneados)
    });

    expect(progresos.length).toBeGreaterThan(1);
    expect(progresos).toEqual([...progresos].sort((a, b) => a - b));
    expect(progresos.at(-1)).toBe(300);
  });

  it('aborta el escaneo en curso y deja de pedir chunks', async () => {
    const registros = crearRegistros(300, (indice) => (indice < 2 ? 'A' : 'B'));
    const espia: Espia = { llamadas: [] };
    const base = crearFetchChunk(registros, espia);
    const controlador = new AbortController();

    await expect(
      buscarPaginado<Registro, Cursor>({
        fetchChunk: async (cursor, limit) => {
          const pagina = await base(cursor, limit);
          controlador.abort();
          return pagina;
        },
        cursorDe,
        predicado: esGrupoA,
        pageSize: 10,
        signal: controlador.signal
      })
    ).rejects.toBeInstanceOf(BusquedaAbortadaError);

    expect(espia.llamadas).toHaveLength(1);
  });
});

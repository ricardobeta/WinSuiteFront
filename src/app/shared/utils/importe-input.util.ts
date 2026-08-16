/**
 * Lectura de un importe tecleado a mano en un `<input type="text" inputmode="decimal">`.
 *
 * Los importes nunca van en `type="number"`: el teclado numerico del movil pierde el punto
 * decimal y el binding borra el separador recien escrito. Se acepta la coma como separador
 * —es la tecla que trae el teclado numerico— y el signo negativo, porque un saldo bancario
 * puede estar en sobregiro.
 */
export function parseImporte(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const limpio = valor.trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
  if (!limpio || limpio === '-' || limpio === '.') {
    return null;
  }
  const numero = Number.parseFloat(limpio);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}

/** Texto para precargar un input de importe; vacio cuando no hay dato. */
export function formatImporte(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

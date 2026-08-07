/** Marcas diacriticas combinantes que deja `normalize('NFD')` al separar las tildes. */
const DIACRITICOS = /[̀-ͯ]/g;

/**
 * Normalizacion de texto para busquedas: minusculas y sin tildes.
 * Los contadores teclean "credito" o "numero", no "crédito" ni "número",
 * asi que el filtro tiene que ignorar los acentos en ambos lados de la comparacion.
 */
export function normalizarTexto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor)
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLocaleLowerCase('es')
    .trim();
}

/**
 * Une varios campos en un unico texto normalizado listo para `includes()`.
 * Ignora nulos y cadenas vacias para no dejar separadores sueltos.
 */
export function haystack(...partes: (string | number | null | undefined)[]): string {
  return normalizarTexto(
    partes.filter((parte) => parte !== null && parte !== undefined && parte !== '').join(' ')
  );
}

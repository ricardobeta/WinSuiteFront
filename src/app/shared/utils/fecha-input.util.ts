/**
 * Utilidades para adaptar entre el string ISO `yyyy-MM-dd` (usado por modelos/filtros) y el objeto
 * `Date` que requiere el datepicker de Angular Material. Permiten migrar los `<input type="date">`
 * nativos a `matDatepicker` sin cambiar el tipo de los modelos subyacentes.
 */

/** Convierte un ISO `yyyy-MM-dd` a Date local (medianoche). Devuelve null si está vacío o es inválido. */
export function isoADate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const partes = iso.split('-').map((p) => Number(p));
  if (partes.length === 3 && partes.every((n) => Number.isFinite(n))) {
    return new Date(partes[0], partes[1] - 1, partes[2]);
  }
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Convierte un Date a ISO `yyyy-MM-dd` local. Devuelve '' si es null/ inválido. */
export function dateAIso(fecha: Date | null | undefined): string {
  if (!fecha || Number.isNaN(fecha.getTime())) {
    return '';
  }
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

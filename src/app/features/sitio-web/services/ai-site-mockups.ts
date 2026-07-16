/**
 * Imagenes de muestra para disenos IA sin imagenes del usuario.
 * Fotos reales: picsum.photos con seed estable (mismo blueprint => mismas fotos,
 * refinar no "baraja" las imagenes). Graficos tintados: placehold.co con la paleta del tema.
 */

export function mockupFoto(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function mockupTinte(bg: string, fg: string, text: string, w: number, h: number): string {
  const clean = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : 'e2e8f0';
  return `https://placehold.co/${w}x${h}/${clean(bg)}/${clean(fg)}?text=${encodeURIComponent(text.slice(0, 30))}`;
}

/** Seed estable y seguro derivado del hint de la IA + posicion de la seccion. */
export function semillaSeccion(hint: string | undefined, paginaId: string, indiceSeccion: number, extra?: number): string {
  const base = slugSeguro(hint) || 'foto';
  return `${base}-${slugSeguro(paginaId) || 'pagina'}-${indiceSeccion}${extra != null ? `-${extra}` : ''}`;
}

/** Sanea el imageHint de la IA para uso en URLs (sin esquemas, ni caracteres raros). */
function slugSeguro(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

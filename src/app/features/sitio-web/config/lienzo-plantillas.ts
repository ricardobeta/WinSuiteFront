/**
 * Plantillas seguras del bloque 'lienzo' para la generacion con IA.
 * La IA solo elige una plantilla y rellena slots de contenido; las coordenadas
 * (desktop + overrides movil) viven aqui y garantizan un layout presentable.
 */

export type LienzoPlantillaId =
  | 'hero-collage'
  | 'banner-oferta'
  | 'tarjeta-flotante'
  | 'collage-tres'
  | 'cita-destacada';

export type LienzoSlotId = 'titulo' | 'subtitulo' | 'cta' | 'imagen1' | 'imagen2' | 'imagen3';

export interface LienzoSlotPosicion {
  x: number;
  y: number;
  w: number;
  h?: number;
}

export interface LienzoSlotDef {
  slot: LienzoSlotId;
  pos: LienzoSlotPosicion;
  movil: LienzoSlotPosicion;
  zIndex: number;
  /** Solo slots de texto. */
  tamanoPx?: number;
  negrita?: boolean;
  cursiva?: boolean;
  alineacion?: 'izquierda' | 'centro';
}

export interface LienzoPlantilla {
  altura: number;
  alturaMovil: number;
  /** El slot imageIndex se usa como imagen de fondo de la seccion (con velo). */
  fondoImagen?: boolean;
  /** Aplica un degradado del tema como fondo de la seccion. */
  fondoGradiente?: boolean;
  /** Texto en blanco (para fondos con imagen o degradado). */
  textoClaro?: boolean;
  elementos: LienzoSlotDef[];
}

export const LIENZO_PLANTILLAS: Record<LienzoPlantillaId, LienzoPlantilla> = {
  'hero-collage': {
    altura: 520,
    alturaMovil: 460,
    fondoImagen: true,
    textoClaro: true,
    elementos: [
      { slot: 'titulo', pos: { x: 8, y: 24, w: 56 }, movil: { x: 6, y: 18, w: 88 }, zIndex: 2, tamanoPx: 44, negrita: true },
      { slot: 'subtitulo', pos: { x: 8, y: 48, w: 46 }, movil: { x: 6, y: 44, w: 88 }, zIndex: 2, tamanoPx: 20 },
      { slot: 'cta', pos: { x: 8, y: 68, w: 24 }, movil: { x: 6, y: 70, w: 62 }, zIndex: 2 },
    ],
  },
  'banner-oferta': {
    altura: 260,
    alturaMovil: 320,
    fondoGradiente: true,
    textoClaro: true,
    elementos: [
      { slot: 'titulo', pos: { x: 6, y: 26, w: 58 }, movil: { x: 6, y: 14, w: 88 }, zIndex: 2, tamanoPx: 34, negrita: true },
      { slot: 'subtitulo', pos: { x: 6, y: 60, w: 54 }, movil: { x: 6, y: 44, w: 88 }, zIndex: 2, tamanoPx: 16 },
      { slot: 'cta', pos: { x: 70, y: 38, w: 24 }, movil: { x: 6, y: 72, w: 70 }, zIndex: 2 },
    ],
  },
  'tarjeta-flotante': {
    altura: 480,
    alturaMovil: 620,
    elementos: [
      { slot: 'imagen1', pos: { x: 52, y: 8, w: 42, h: 84 }, movil: { x: 10, y: 4, w: 80, h: 34 }, zIndex: 1 },
      { slot: 'titulo', pos: { x: 6, y: 22, w: 40 }, movil: { x: 8, y: 44, w: 84 }, zIndex: 2, tamanoPx: 32, negrita: true },
      { slot: 'subtitulo', pos: { x: 6, y: 44, w: 40 }, movil: { x: 8, y: 62, w: 84 }, zIndex: 2, tamanoPx: 18 },
      { slot: 'cta', pos: { x: 6, y: 68, w: 24 }, movil: { x: 8, y: 84, w: 62 }, zIndex: 2 },
    ],
  },
  'collage-tres': {
    altura: 520,
    alturaMovil: 640,
    elementos: [
      { slot: 'imagen1', pos: { x: 4, y: 10, w: 32, h: 58 }, movil: { x: 4, y: 4, w: 56, h: 26 }, zIndex: 1 },
      { slot: 'imagen2', pos: { x: 32, y: 28, w: 34, h: 60 }, movil: { x: 38, y: 24, w: 56, h: 26 }, zIndex: 2 },
      { slot: 'imagen3', pos: { x: 62, y: 12, w: 32, h: 58 }, movil: { x: 12, y: 46, w: 56, h: 26 }, zIndex: 1 },
      { slot: 'titulo', pos: { x: 8, y: 82, w: 84 }, movil: { x: 6, y: 80, w: 88 }, zIndex: 3, tamanoPx: 30, negrita: true, alineacion: 'centro' },
    ],
  },
  'cita-destacada': {
    altura: 320,
    alturaMovil: 380,
    elementos: [
      { slot: 'titulo', pos: { x: 10, y: 26, w: 80 }, movil: { x: 6, y: 20, w: 88 }, zIndex: 1, tamanoPx: 30, cursiva: true, alineacion: 'centro' },
      { slot: 'subtitulo', pos: { x: 10, y: 66, w: 80 }, movil: { x: 6, y: 66, w: 88 }, zIndex: 1, tamanoPx: 16, alineacion: 'centro' },
    ],
  },
};

export function esPlantillaLienzo(value: string | undefined): value is LienzoPlantillaId {
  return !!value && value in LIENZO_PLANTILLAS;
}

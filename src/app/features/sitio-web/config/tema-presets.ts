import { TemaSitio } from '@winsuite/bloques';

export interface TemaPreset {
  nombre: string;
  tema: Omit<TemaSitio, 'logoUrl'>;
}

/** Temas listos para aplicar con un click (compartidos por panel-tema y el chat IA). */
export const TEMA_PRESETS: TemaPreset[] = [
  {
    nombre: 'Clasico',
    tema: {
      colorPrimario: '#2563eb',
      colorAcento: '#f59e0b',
      colorFondo: '#ffffff',
      colorTexto: '#1f2937',
      fuenteTitulos: 'poppins',
      fuenteCuerpo: 'inter',
      radioEsquinas: 'suave',
    },
  },
  {
    nombre: 'Natural',
    tema: {
      colorPrimario: '#059669',
      colorAcento: '#d97706',
      colorFondo: '#f8faf7',
      colorTexto: '#1c2b24',
      fuenteTitulos: 'montserrat',
      fuenteCuerpo: 'system',
      radioEsquinas: 'redondo',
    },
  },
  {
    nombre: 'Elegante',
    tema: {
      colorPrimario: '#111827',
      colorAcento: '#b45309',
      colorFondo: '#faf7f2',
      colorTexto: '#27272a',
      fuenteTitulos: 'playfair',
      fuenteCuerpo: 'inter',
      radioEsquinas: 'recto',
    },
  },
  {
    nombre: 'Vibrante',
    tema: {
      colorPrimario: '#db2777',
      colorAcento: '#7c3aed',
      colorFondo: '#ffffff',
      colorTexto: '#18181b',
      fuenteTitulos: 'poppins',
      fuenteCuerpo: 'roboto',
      radioEsquinas: 'redondo',
    },
  },
  {
    nombre: 'Oscuro',
    tema: {
      colorPrimario: '#38bdf8',
      colorAcento: '#facc15',
      colorFondo: '#0f172a',
      colorTexto: '#e2e8f0',
      fuenteTitulos: 'montserrat',
      fuenteCuerpo: 'inter',
      radioEsquinas: 'suave',
    },
  },
];

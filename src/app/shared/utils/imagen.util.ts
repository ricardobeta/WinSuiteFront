/**
 * Redimensionado de imagenes en el navegador antes de subirlas.
 *
 * Es obligatorio para las fotos de producto: una foto de celular sin comprimir pesa
 * 3-5 MB, mientras que el tope por imagen de producto es 1 MB y la cuota del plan se
 * reparte entre todo el catalogo. Comprimida a 800 px en WebP ronda los 80 KB.
 */

/**
 * Tope por imagen de producto, tanto en inventario como en la copia publica de la tienda.
 * Es mas estricto que ARCHIVO_MAX_FILE_BYTES (2 MB) a proposito: un catalogo son cientos
 * de imagenes contra la misma cuota, y en el POS se pintan decenas a la vez.
 */
export const IMAGEN_PRODUCTO_MAX_BYTES = 1024 * 1024;

/** Texto de ayuda unico, para que todas las pantallas digan lo mismo. */
export const IMAGEN_PRODUCTO_AYUDA =
  'Se convierte a WebP y se reduce a 800 px al subirla. Maximo 1 MB.';

export interface RedimensionarImagenOpciones {
  /** Lado maximo en pixeles. Se mantiene la proporcion original. */
  maxLado?: number;
  /** Calidad de 0 a 1 para los formatos con perdida. */
  calidad?: number;
  /** Formato de salida. WebP cae a JPEG si el navegador no lo soporta. */
  tipo?: 'image/webp' | 'image/jpeg';
  /**
   * Peso maximo del resultado. Si al primer intento no cabe, se reintenta bajando
   * calidad y lado antes de rendirse, en vez de rechazar una foto recuperable.
   */
  maxBytes?: number;
}

const DEFAULTS: Required<Omit<RedimensionarImagenOpciones, 'maxBytes'>> = {
  maxLado: 800,
  calidad: 0.8,
  tipo: 'image/webp'
};

/**
 * Escalones de reintento cuando la imagen no cabe en `maxBytes`.
 * Cada paso baja calidad y resolucion; el ultimo prioriza que entre sobre que luzca.
 */
const REINTENTOS: Array<{ factorLado: number; calidad: number }> = [
  { factorLado: 1, calidad: 0.65 },
  { factorLado: 0.75, calidad: 0.6 },
  { factorLado: 0.6, calidad: 0.5 }
];

/** Tipos que sabemos redimensionar. El resto se devuelve intacto. */
const TIPOS_SOPORTADOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function esImagenRedimensionable(file: File): boolean {
  return TIPOS_SOPORTADOS.includes((file.type || '').toLowerCase());
}

/**
 * Devuelve un `File` reducido listo para subir.
 * Si el archivo no es una imagen soportada, o si el resultado no pesa menos que
 * el original, devuelve el archivo original sin tocar.
 */
export async function redimensionarImagen(file: File, opciones: RedimensionarImagenOpciones = {}): Promise<File> {
  if (!esImagenRedimensionable(file)) {
    return file;
  }

  const config = { ...DEFAULTS, ...opciones };

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await cargarImagen(file);
  } catch {
    // Un archivo corrupto o un navegador sin soporte no debe romper el alta del producto:
    // se sube el original y la validacion de tamano de quien llama hara de reja.
    return file;
  }

  try {
    const intentos = [
      { factorLado: 1, calidad: config.calidad },
      ...(opciones.maxBytes ? REINTENTOS : [])
    ];

    let mejor: Blob | null = null;

    for (const intento of intentos) {
      const blob = await dibujar(bitmap, config.maxLado * intento.factorLado, config.tipo, intento.calidad);
      if (!blob) {
        break;
      }

      // Se queda con el mas liviano por si ningun intento llega a caber.
      if (!mejor || blob.size < mejor.size) {
        mejor = blob;
      }

      if (!opciones.maxBytes || blob.size <= opciones.maxBytes) {
        break;
      }
    }

    if (!mejor || mejor.size >= file.size) {
      return file;
    }

    return new File([mejor], renombrar(file.name, mejor.type), {
      type: mejor.type,
      lastModified: Date.now()
    });
  } finally {
    if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) {
      bitmap.close();
    }
  }
}

/** Pinta el bitmap escalado a `maxLado` y lo codifica en el formato pedido. */
async function dibujar(
  bitmap: ImageBitmap | HTMLImageElement,
  maxLado: number,
  tipo: string,
  calidad: number
): Promise<Blob | null> {
  const { width, height } = escalar(bitmap.width, bitmap.height, Math.max(1, Math.round(maxLado)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const contexto = canvas.getContext('2d');
  if (!contexto) {
    return null;
  }

  contexto.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  return aBlob(canvas, tipo, calidad);
}

async function cargarImagen(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

function escalar(ancho: number, alto: number, maxLado: number): { width: number; height: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= maxLado) {
    return { width: ancho, height: alto };
  }

  const factor = maxLado / mayor;
  return {
    width: Math.max(1, Math.round(ancho * factor)),
    height: Math.max(1, Math.round(alto * factor))
  };
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        // Safari antiguo ignora WebP y devuelve null o un PNG: se reintenta en JPEG.
        if (!blob || (tipo === 'image/webp' && blob.type !== 'image/webp')) {
          canvas.toBlob((fallback) => resolve(fallback), 'image/jpeg', calidad);
          return;
        }
        resolve(blob);
      },
      tipo,
      calidad
    );
  });
}

function renombrar(nombre: string, tipo: string): string {
  const extension = tipo === 'image/webp' ? 'webp' : 'jpg';
  const base = nombre.replace(/\.[^.]+$/, '') || 'imagen';
  return `${base}.${extension}`;
}

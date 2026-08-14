import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  IMAGEN_PRODUCTO_MAX_BYTES,
  esImagenRedimensionable,
  redimensionarImagen
} from './imagen.util';

function archivo(nombre: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

/**
 * Simula el pipeline de canvas: cada llamada a `toBlob` devuelve el siguiente tamano
 * de la cola, para poder comprobar los reintentos de compresion.
 */
function simularCanvas(tamanos: number[]): { llamadas: () => number } {
  let indice = 0;

  vi.stubGlobal('createImageBitmap', async () => ({ width: 2400, height: 1600, close: () => undefined }));

  vi.spyOn(document, 'createElement').mockImplementation((etiqueta: string) => {
    if (etiqueta !== 'canvas') {
      return Object.create(HTMLElement.prototype);
    }

    return {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (cb: (blob: Blob | null) => void, tipo: string) => {
        const size = tamanos[Math.min(indice, tamanos.length - 1)];
        indice += 1;
        // Blob real: `new File([blob])` mide el contenido, no una propiedad `size` falsa.
        cb(new Blob([new Uint8Array(size)], { type: tipo }));
      }
    } as unknown as HTMLElement;
  });

  return { llamadas: () => indice };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('esImagenRedimensionable', () => {
  it('acepta los formatos de imagen soportados', () => {
    expect(esImagenRedimensionable(archivo('a.webp', 'image/webp', 10))).toBe(true);
    expect(esImagenRedimensionable(archivo('a.jpg', 'image/jpeg', 10))).toBe(true);
    expect(esImagenRedimensionable(archivo('a.png', 'image/png', 10))).toBe(true);
  });

  it('ignora lo que no sabe redimensionar', () => {
    expect(esImagenRedimensionable(archivo('a.pdf', 'application/pdf', 10))).toBe(false);
    expect(esImagenRedimensionable(archivo('a.svg', 'image/svg+xml', 10))).toBe(false);
  });
});

describe('redimensionarImagen', () => {
  it('devuelve intacto lo que no es imagen soportada', async () => {
    const original = archivo('factura.pdf', 'application/pdf', 5000);
    await expect(redimensionarImagen(original)).resolves.toBe(original);
  });

  it('no reintenta cuando el primer intento ya cabe', async () => {
    const canvas = simularCanvas([80_000]);
    const salida = await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 4_000_000), {
      maxBytes: IMAGEN_PRODUCTO_MAX_BYTES
    });

    expect(canvas.llamadas()).toBe(1);
    expect(salida.size).toBe(80_000);
    expect(salida.name).toBe('foto.webp');
  });

  it('baja calidad y resolucion hasta caber en el tope', async () => {
    const canvas = simularCanvas([1_800_000, 1_300_000, 900_000]);
    const salida = await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 6_000_000), {
      maxBytes: IMAGEN_PRODUCTO_MAX_BYTES
    });

    expect(canvas.llamadas()).toBe(3);
    expect(salida.size).toBe(900_000);
    expect(salida.size).toBeLessThanOrEqual(IMAGEN_PRODUCTO_MAX_BYTES);
  });

  it('si ningun intento cabe devuelve el mas liviano, para que quien llama decida', async () => {
    simularCanvas([3_000_000, 2_400_000, 2_000_000, 1_900_000]);
    const salida = await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 9_000_000), {
      maxBytes: IMAGEN_PRODUCTO_MAX_BYTES
    });

    expect(salida.size).toBe(1_900_000);
    expect(salida.size).toBeGreaterThan(IMAGEN_PRODUCTO_MAX_BYTES);
  });

  it('sin maxBytes comprime una sola vez', async () => {
    const canvas = simularCanvas([1_500_000]);
    await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 4_000_000));

    expect(canvas.llamadas()).toBe(1);
  });

  it('no engorda el archivo: si el resultado pesa mas, devuelve el original', async () => {
    simularCanvas([500_000]);
    const original = archivo('mini.webp', 'image/webp', 40_000);

    await expect(redimensionarImagen(original, { maxBytes: IMAGEN_PRODUCTO_MAX_BYTES })).resolves.toBe(original);
  });
});

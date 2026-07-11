import { describe, expect, it } from 'vitest';
import { paginaDocSchema } from '@winsuite/bloques';
import { PLANTILLAS_SITIO } from './plantillas';

describe('plantillas profesionales de sitios', () => {
  const profesionales = PLANTILLAS_SITIO.filter((plantilla) => plantilla.id !== 'en-blanco');

  it('ofrece las seis plantillas acordadas', () => {
    expect(profesionales).toHaveLength(6);
  });

  it('genera páginas válidas para el contrato compartido', () => {
    for (const plantilla of PLANTILLAS_SITIO) {
      const contenido = plantilla.crearContenido();
      for (const pagina of Object.values(contenido.paginas)) {
        expect(paginaDocSchema.safeParse(pagina).success, plantilla.id).toBe(true);
      }
    }
  });

  it('crea copias independientes con identificadores nuevos', () => {
    for (const plantilla of profesionales) {
      const primera = plantilla.crearContenido().paginas['home'].bloques.map((bloque) => bloque.id);
      const segunda = plantilla.crearContenido().paginas['home'].bloques.map((bloque) => bloque.id);
      expect(primera).not.toEqual(segunda);
    }
  });
});

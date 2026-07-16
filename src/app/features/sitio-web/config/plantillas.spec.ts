import { describe, expect, it } from 'vitest';
import { paginaDocSchema } from '@winsuite/bloques';
import { PLANTILLAS_SITIO } from './plantillas';

describe('plantillas profesionales de sitios', () => {
  const profesionales = PLANTILLAS_SITIO.filter((plantilla) => plantilla.id !== 'en-blanco');

  it('ofrece las diecisiete plantillas profesionales', () => {
    expect(profesionales).toHaveLength(17);
  });

  it('genera páginas válidas para el contrato compartido', () => {
    for (const plantilla of PLANTILLAS_SITIO) {
      const contenido = plantilla.crearContenido();
      for (const pagina of Object.values(contenido.paginas)) {
        const parsed = paginaDocSchema.safeParse(pagina);
        expect(parsed.success, `${plantilla.id}: ${JSON.stringify(parsed.success ? '' : parsed.error.issues)}`).toBe(true);
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

  it('las plantillas nuevas llevan categoría y etiquetas para el RAG', () => {
    const etiquetadas = profesionales.filter((p) => !['tienda-basica', 'landing-promo'].includes(p.id));
    for (const plantilla of etiquetadas) {
      expect(plantilla.categoria, plantilla.id).toBeTruthy();
      expect(plantilla.etiquetas?.length ?? 0, plantilla.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('toda imagen de plantilla es una URL https de muestra', () => {
    for (const plantilla of PLANTILLAS_SITIO) {
      const json = JSON.stringify(plantilla.crearContenido());
      const urls = json.match(/"url":"([^"]+)"/g) ?? [];
      for (const raw of urls) {
        expect(raw.includes('"url":"https://'), `${plantilla.id}: ${raw}`).toBe(true);
      }
    }
  });

  it('planes-servicio llena cada plan con precio, periodo y características', () => {
    const plantilla = PLANTILLAS_SITIO.find((p) => p.id === 'planes-servicio');
    expect(plantilla).toBeTruthy();
    const bloques = plantilla!.crearContenido().paginas['home'].bloques;
    const planes = bloques.find((b) => b.tipo === 'planes');
    expect(planes?.tipo).toBe('planes');
    if (planes?.tipo === 'planes') {
      expect(planes.planes).toHaveLength(3);
      for (const plan of planes.planes) {
        expect(plan.precio, plan.nombre).toBeGreaterThan(0);
        expect(plan.periodo, plan.nombre).toBeTruthy();
        expect(plan.caracteristicas.length, plan.nombre).toBeGreaterThanOrEqual(4);
      }
      expect(planes.planes[1].destacado).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ContenidoSitio } from '@winsuite/bloques';
import { AiSiteEditApplierService } from './ai-site-edit-applier.service';

function content(): ContenidoSitio {
  return {
    tema: {
      colorPrimario: '#2563eb', colorAcento: '#f59e0b', colorFondo: '#ffffff',
      colorTexto: '#1f2937', fuenteTitulos: 'poppins', fuenteCuerpo: 'inter', radioEsquinas: 'suave',
    },
    paginas: {
      home: {
        schemaVersion: 2, id: 'home', slug: '', titulo: 'Inicio', actualizadoEn: 1,
        bloques: [
          { id: 'hero-1', tipo: 'hero', visible: true, titulo: 'Titulo manual', subtitulo: 'Subtitulo manual', alineacion: 'centro', estilos: { fondo: '#ffffff', paddingY: 'amplio' } },
          { id: 'texto-manual', tipo: 'texto', visible: true, contenido: 'Bloque agregado por el usuario', alineacion: 'centro' },
          { id: '__zona-pago', tipo: 'sistema-pago', visible: true },
        ],
      },
    },
  };
}

describe('AiSiteEditApplierService', () => {
  it('cambia solo el campo pedido y conserva ediciones manuales', () => {
    const original = content();
    const updated = new AiSiteEditApplierService().apply(original, [{
      op: 'patch-block', pageId: 'home', blockId: 'hero-1',
      patch: { estilos: { fondo: '#f97316' } },
    }]);

    const hero = updated.paginas['home'].bloques[0];
    expect(hero.tipo === 'hero' && hero.titulo).toBe('Titulo manual');
    expect(hero.estilos).toEqual({ fondo: '#f97316', paddingY: 'amplio' });
    expect(updated.paginas['home'].bloques[1]).toEqual(original.paginas['home'].bloques[1]);
    expect(original.paginas['home'].bloques[0].estilos?.fondo).toBe('#ffffff');
  });

  it('aplica una alternancia exacta sin cambiar el tema', () => {
    const updated = new AiSiteEditApplierService().apply(content(), [
      { op: 'patch-block', pageId: 'home', blockId: 'hero-1', patch: { estilos: { fondo: '#f97316' } } },
      { op: 'patch-block', pageId: 'home', blockId: 'texto-manual', patch: { estilos: { fondo: '#ffffff' } } },
    ]);
    expect(updated.paginas['home'].bloques.map(block => block.estilos?.fondo).slice(0, 2))
      .toEqual(['#f97316', '#ffffff']);
    expect(updated.tema.colorPrimario).toBe('#2563eb');
  });

  it('rechaza eliminar una zona funcional', () => {
    expect(() => new AiSiteEditApplierService().apply(content(), [{
      op: 'delete-block', pageId: 'home', blockId: '__zona-pago',
    }])).toThrow(/zona funcional/i);
  });
});

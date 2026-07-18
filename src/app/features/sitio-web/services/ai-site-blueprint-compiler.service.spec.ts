import { describe, expect, it } from 'vitest';
import { Bloque, contenidoSitioSchema } from '@winsuite/bloques';
import { AiSiteBlueprintCompilerService } from './ai-site-blueprint-compiler.service';
import { AiSiteBlueprint, AiSiteBlueprintSection } from './ai-site-generator.service';
import { LIENZO_PLANTILLAS, LienzoPlantillaId } from '../config/lienzo-plantillas';

const blueprint: AiSiteBlueprint = {
  concept: 'Una experiencia cercana para descubrir productos locales.',
  theme: {
    primary: '#2563eb', accent: '#f59e0b', background: '#ffffff', text: '#1f2937',
    headingFont: 'poppins', bodyFont: 'inter', cornerStyle: 'suave',
  },
  pages: [{
    title: 'Inicio', slug: '', sections: [
      { type: 'hero', title: 'Hecho para ti', text: 'Descubre una propuesta diferente.', ctaText: 'Conocer más', divider: 'wave', imageIndex: 0 },
      { type: 'features', title: 'Por qué elegirnos', items: [{ title: 'Calidad', text: 'Cuidamos cada detalle.' }] },
      { type: 'contact', title: 'Conversemos' },
    ],
  }],
};

const images = ['/media/uno.jpg', '/media/dos.jpg', '/media/tres.jpg'];
const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function withSections(sections: AiSiteBlueprintSection[]): AiSiteBlueprint {
  return { ...blueprint, pages: [{ title: 'Inicio', slug: '', sections }] };
}

/** header y footer los inyecta el compilador; el cuerpo va entre ambos. */
function bodyBlocks(sections: AiSiteBlueprintSection[], ecommerce = true, imgs: string[] = images): Bloque[] {
  const contenido = new AiSiteBlueprintCompilerService().compile(withSections(sections), imgs, ecommerce);
  return contenido.paginas['home'].bloques.slice(1, -1);
}

describe('AiSiteBlueprintCompilerService', () => {
  const containsUndefined = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(containsUndefined);
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>)
        .some(item => item === undefined || containsUndefined(item));
    }
    return false;
  };

  it('compila el plano IA al esquema real de Sites', () => {
    const content = new AiSiteBlueprintCompilerService().compile(
      blueprint,
      ['https://example.com/hero.webp'],
      false,
    );
    expect(contenidoSitioSchema.safeParse(content).success).toBe(true);
    expect(content.paginas['home'].bloques.some(block => block.tipo === 'hero')).toBe(true);
    expect(containsUndefined(content)).toBe(false);
  });

  it('activa carrito en encabezados ecommerce', () => {
    const content = new AiSiteBlueprintCompilerService().compile(blueprint, [], true);
    const header = content.paginas['home'].bloques.find(block => block.tipo === 'header');
    expect(header?.tipo === 'header' && header.mostrarCarrito).toBe(true);
  });

  it('aplica anclas, navegacion interna y estilos exactos sin alterar el tema', () => {
    const content = new AiSiteBlueprintCompilerService().compile(withSections([
      {
        type: 'hero', anchor: 'presentacion', title: 'Hola', text: 'Bienvenido',
        style: {
          background: '#f97316',
          title: { color: '#ffffff', font: 'montserrat', sizePx: 56, bold: true, align: 'center' },
          text: { color: '#fff7ed', font: 'inter', sizePx: 20 },
          button: { background: '#ffffff', color: '#9a3412', font: 'poppins', bold: true },
        },
      },
      { type: 'features', anchor: 'beneficios', title: 'Beneficios', style: { background: '#ffffff' } },
      { type: 'cta', anchor: 'contacto', title: 'Hablemos', style: { background: '#f97316' } },
    ]), [], false);

    expect(content.tema.colorPrimario).toBe('#2563eb');
    const [header, hero, beneficios, contacto] = content.paginas['home'].bloques;
    expect(header.tipo).toBe('header');
    if (header.tipo === 'header') {
      expect(header.enlaces.map(enlace => enlace.ancla)).toEqual(['presentacion', 'beneficios', 'contacto']);
    }
    expect(hero.ancla).toBe('presentacion');
    expect(hero.estilos?.fondo).toBe('#f97316');
    expect(hero.estilos?.fondoGradiente).toBeUndefined();
    expect(hero.estilosTexto?.['titulo']).toMatchObject({
      color: '#ffffff', fuente: 'montserrat', tamanoPx: 56, negrita: true, alineacion: 'centro',
    });
    if (hero.tipo === 'hero') {
      expect(hero.cta?.colorFondo).toBe('#ffffff');
      expect(hero.cta?.colorTexto).toBe('#9a3412');
    }
    expect(beneficios.estilos?.fondo).toBe('#ffffff');
    expect(contacto.estilos?.fondo).toBe('#f97316');
  });

  it('compila el mapa moderno y omite correos invalidos del modelo', () => {
    const [mapa] = bodyBlocks([{
      type: 'map', title: 'Visitanos', text: 'Te esperamos', address: 'Av. Principal 123',
      phone: '+593 99 999 9999', hours: 'Lunes a viernes', email: 'correo-invalido',
    }], false);
    expect(mapa.tipo).toBe('mapa');
    if (mapa.tipo === 'mapa') {
      expect(mapa.variante).toBe('tarjeta');
      expect(mapa.direccion).toBe('Av. Principal 123');
      expect(mapa.horario).toBe('Lunes a viernes');
      expect(mapa.email).toBeUndefined();
    }
  });

  it('rechaza con un mensaje claro un plano sin paginas', () => {
    expect(() => new AiSiteBlueprintCompilerService().compile(
      { ...blueprint, pages: undefined } as unknown as AiSiteBlueprint,
      [],
      false,
    )).toThrow(/no se encontraron paginas validas/i);
  });

  it('tolera items e imagenes ausentes en la respuesta HTTP', () => {
    const malformed = {
      ...blueprint,
      pages: [{ ...blueprint.pages[0], sections: [{ type: 'features', items: undefined }] }],
    } as AiSiteBlueprint;
    const content = new AiSiteBlueprintCompilerService().compile(
      malformed,
      undefined as unknown as string[],
      false,
    );
    expect(contenidoSitioSchema.safeParse(content).success).toBe(true);
  });

  it('compila un blueprint con TODOS los tipos nuevos y pasa el schema zod', () => {
    const sections: AiSiteBlueprintSection[] = [
      { type: 'hero', title: 'Hola', text: 'Bienvenido' },
      { type: 'carousel', imageIndexes: [0, 1, 2] },
      { type: 'image', imageIndex: 0, title: 'Foto principal' },
      { type: 'video', videoId: 'dQw4w9WgXcQ' },
      { type: 'button', ctaText: 'Comprar', ctaLink: '/pago' },
      { type: 'columns', columns: [{ title: 'Col A', text: 'Texto', imageIndex: 1, ctaText: 'Ver', ctaLink: '#a' }, { title: 'Col B', text: 'Texto' }] },
      { type: 'countdown', title: 'Oferta', text: 'Termino la oferta', countdownDate: futureDate },
      { type: 'spacer', heightPx: 60, variant: 'linea' },
      { type: 'html', html: '<div><b>Widget</b><script>console.log(1)</script></div>', heightPx: 200 },
      { type: 'products' },
      { type: 'paycta', ctaText: 'Pagar ahora' },
      { type: 'canvas', canvas: { template: 'hero-collage', slots: { titulo: 'Portada', subtitulo: 'Sub', ctaText: 'Ir', imageIndex: 0 } } },
    ];
    const contenido = new AiSiteBlueprintCompilerService().compile(withSections(sections), images, true);
    expect(contenidoSitioSchema.safeParse(contenido).success).toBe(true);
    const tipos = contenido.paginas['home'].bloques.map(b => b.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      'header', 'hero', 'carrusel', 'imagen', 'video', 'boton', 'columnas',
      'countdown', 'espaciador', 'html', 'productos', 'pago', 'lienzo', 'footer',
    ]));
  });

  it('compila cada plantilla de lienzo con elementos posicionados', () => {
    (Object.keys(LIENZO_PLANTILLAS) as LienzoPlantillaId[]).forEach(template => {
      const blocks = bodyBlocks([{
        type: 'canvas', title: 'Titulo', text: 'Texto', ctaText: 'Ir', ctaLink: '#x',
        canvas: { template, slots: { imageIndexes: [0, 1, 2] } },
      }]);
      expect(blocks.length, template).toBe(1);
      const lienzo = blocks[0];
      expect(lienzo.tipo, template).toBe('lienzo');
      if (lienzo.tipo === 'lienzo') {
        expect(lienzo.elementos.length, template).toBeGreaterThan(0);
        expect(lienzo.altura, template).toBe(LIENZO_PLANTILLAS[template].altura);
      }
    });
  });

  it('descarta html con recursos externos o etiquetas bloqueadas', () => {
    const blocks = bodyBlocks([
      { type: 'text', title: 'Relleno', text: 'x' },
      { type: 'html', html: '<img src="https://evil.com/x.png">' },
      { type: 'html', html: '<iframe src="/x"></iframe>' },
    ]);
    expect(blocks.every(b => b.tipo !== 'html')).toBe(true);
  });

  it('degrada paycta a cta cuando el sitio es landing', () => {
    const blocks = bodyBlocks([{ type: 'paycta', title: 'Paga', ctaText: 'Ir' }], false);
    expect(blocks[0].tipo).toBe('cta');
  });

  it('carousel degrada a imagen con una sola foto y usa mockups sin fotos', () => {
    const conUna = bodyBlocks([{ type: 'carousel', title: 'Solo una' }], false, ['/media/uno.jpg']);
    expect(conUna[0].tipo).toBe('imagen');
    // Sin imagenes del usuario ya no degrada: se arma con fotos de muestra.
    const sinImagenes = bodyBlocks([{ type: 'carousel', title: 'Ninguna', text: 'x' }], false, []);
    expect(sinImagenes[0].tipo).toBe('carrusel');
    if (sinImagenes[0].tipo === 'carrusel') {
      expect(sinImagenes[0].slides.every(s => s.imagenUrl.includes('picsum.photos'))).toBe(true);
    }
  });

  it('degrada un tipo desconocido a bloque texto en vez de romper', () => {
    const blocks = bodyBlocks([{ type: 'marquesina' as AiSiteBlueprintSection['type'], title: 'Hola', text: 'x' }]);
    expect(blocks[0].tipo).toBe('texto');
  });

  it('usa icono, foto y precios de los items enriquecidos', () => {
    const blocks = bodyBlocks([
      { type: 'features', items: [{ title: 'Rapido', text: 'Entrega', icon: '🚀' }] },
      { type: 'team', items: [{ title: 'Ana', text: 'CEO', imageIndex: 2 }] },
      { type: 'plans', items: [{ title: 'Pro', text: 'Todo', price: 25, period: '/mes', features: ['Soporte', 'Reportes'] }] },
    ]);
    const features = blocks[0];
    if (features.tipo === 'caracteristicas') expect(features.items[0].icono).toBe('🚀');
    const team = blocks[1];
    if (team.tipo === 'equipo') expect(team.items[0].fotoUrl).toBe('/media/tres.jpg');
    const plans = blocks[2];
    if (plans.tipo === 'planes') {
      expect(plans.planes[0].precio).toBe(25);
      expect(plans.planes[0].periodo).toBe('/mes');
      expect(plans.planes[0].caracteristicas).toEqual(['Soporte', 'Reportes']);
    }
  });

  it('clampa countdown a futuro y espaciador al rango del schema', () => {
    const blocks = bodyBlocks([
      { type: 'countdown', title: 'Ya paso', text: 'Fin', countdownDate: '2020-01-01' },
      { type: 'spacer', heightPx: 900 },
    ]);
    const countdown = blocks[0];
    if (countdown.tipo === 'countdown') expect(countdown.fecha).toBeGreaterThan(Date.now());
    const spacer = blocks[1];
    if (spacer.tipo === 'espaciador') expect(spacer.altura).toBe(300);
  });

  it('descarta video con id invalido', () => {
    const blocks = bodyBlocks([
      { type: 'text', title: 'Relleno', text: 'x' },
      { type: 'video', videoId: 'https://youtube.com/watch?v=x' },
    ]);
    expect(blocks.every(b => b.tipo !== 'video')).toBe(true);
  });

  it('sin imagenes del usuario inyecta mockups deterministas y validos', () => {
    const sections: AiSiteBlueprintSection[] = [
      { type: 'hero', title: 'Hola', imageHint: 'comida gourmet' },
      { type: 'gallery', title: 'Galeria', imageHint: 'platos' },
      { type: 'carousel', imageHint: 'ambiente' },
      { type: 'image', title: 'Destacada', imageHint: 'local' },
      { type: 'team', items: [{ title: 'Ana', text: 'Chef' }] },
      { type: 'logos', title: 'Marcas' },
    ];
    const compilar = () => new AiSiteBlueprintCompilerService().compile(withSections(sections), [], false);
    const primero = compilar();
    const json = JSON.stringify(primero);
    expect(contenidoSitioSchema.safeParse(primero).success).toBe(true);
    expect(json).toContain('picsum.photos');
    expect(json).toContain('placehold.co');
    expect(json).toContain('comida-gourmet');
    // Determinismo: recompilar produce exactamente las mismas URLs.
    const urls = (contenido: unknown) => (JSON.stringify(contenido).match(/https:[^"]+/g) ?? []).sort();
    expect(urls(compilar())).toEqual(urls(primero));
    // Los tipos visuales ya no degradan a texto.
    const tipos = primero.paginas['home'].bloques.map(b => b.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['galeria', 'carrusel', 'imagen', 'equipo', 'logos']));
  });

  it('con imagenes del usuario NO inyecta mockups', () => {
    const contenido = new AiSiteBlueprintCompilerService().compile(
      withSections([{ type: 'gallery', title: 'Galeria', imageHint: 'platos' }]),
      images,
      false,
    );
    const json = JSON.stringify(contenido);
    expect(json).not.toContain('picsum.photos');
    expect(json).not.toContain('placehold.co');
  });

  it('imageHint malicioso produce seeds seguros', () => {
    const contenido = new AiSiteBlueprintCompilerService().compile(
      withSections([{ type: 'image', title: 'X', imageHint: 'Café  del Valle!!' }]),
      [],
      false,
    );
    const json = JSON.stringify(contenido);
    expect(json).toContain('cafe-del-valle');
    expect(json).not.toContain('!!');
  });

  it('usa el formulario real creado cuando llega el map de formularios', () => {
    const formularios = new Map([['home:0', 'f-real-123']]);
    const contenido = new AiSiteBlueprintCompilerService().compile(
      withSections([{ type: 'contact', title: 'Reserva', form: { name: 'Reservas', fields: [{ label: 'Nombre', type: 'texto', required: true }], successMessage: 'Gracias' } }]),
      [],
      false,
      formularios,
    );
    const bloque = contenido.paginas['home'].bloques[1];
    expect(bloque.tipo).toBe('formulario');
    if (bloque.tipo === 'formulario') {
      expect(bloque.formularioId).toBe('f-real-123');
      expect(bloque.campos).toBeUndefined();
      expect(bloque.mensajeExito).toBe('Gracias');
    }
  });

  it('sin map de formularios conserva el fallback legacy contacto-ia', () => {
    const contenido = new AiSiteBlueprintCompilerService().compile(
      withSections([{ type: 'contact', title: 'Contacto' }]),
      [],
      false,
    );
    const bloque = contenido.paginas['home'].bloques[1];
    if (bloque.tipo === 'formulario') {
      expect(bloque.formularioId).toBe('contacto-ia');
      expect(bloque.campos?.length).toBeGreaterThan(0);
    }
  });
});

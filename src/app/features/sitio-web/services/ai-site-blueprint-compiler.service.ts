import { Injectable } from '@angular/core';
import {
  Bloque,
  BloqueLienzo,
  ContenidoSitio,
  DivisorBloque,
  ElementoColumna,
  ElementoLienzo,
  EstilosBloque,
  FuenteId,
  PaginaDoc,
  TemaSitio,
  contenidoSitioSchema,
  slugify,
} from '@winsuite/bloques';
import { nuevoIdBloque } from '../config/bloques-catalogo';
import { LIENZO_PLANTILLAS, LienzoSlotDef, esPlantillaLienzo } from '../config/lienzo-plantillas';
import { mockupFoto, mockupTinte, semillaSeccion } from './ai-site-mockups';
import { AiSiteBlueprint, AiSiteBlueprintSection } from './ai-site-generator.service';

/** Misma blocklist que el backend: defensa en profundidad antes del iframe sandbox. */
const HTML_BLOCKLIST: RegExp[] = [
  /<script[^>]*\ssrc\s*=/i,
  /<(iframe|object|embed|form|link|meta|base)\b/i,
  /javascript\s*:/i,
  /https?:\/\//i,
];

/** Contexto por seccion: posicion (para seeds estables) y formularios reales creados. */
interface BlockContext {
  pageId: string;
  index: number;
  /** true = el usuario no adjunto imagenes: usar imagenes de muestra. */
  mockups: boolean;
  /** pageId:index -> formularioId real creado en sitios_formularios. */
  formularios?: Map<string, string>;
}

@Injectable({ providedIn: 'root' })
export class AiSiteBlueprintCompilerService {
  compile(
    blueprint: AiSiteBlueprint,
    images: string[],
    ecommerce: boolean,
    formularios?: Map<string, string>,
  ): ContenidoSitio {
    const sourcePages = Array.isArray(blueprint?.pages) ? blueprint.pages.slice(0, 5) : [];
    const sourceImages = Array.isArray(images) ? images : [];
    if (!sourcePages.length) {
      throw new Error('La IA devolvio un diseno incompleto: no se encontraron paginas validas. Intenta nuevamente.');
    }
    if (sourcePages.some(page => !page || typeof page.title !== 'string' || !Array.isArray(page.sections)
      || page.sections.some(section => !section || typeof section !== 'object'))) {
      throw new Error('La IA devolvio un diseno incompleto: una pagina no contiene secciones validas. Intenta nuevamente.');
    }

    const theme = this.theme(blueprint?.theme);
    const mockups = sourceImages.length === 0;
    const pages: Record<string, PaginaDoc> = {};
    sourcePages.forEach((page, index) => {
      const id = index === 0 ? 'home' : (slugify(page.slug || page.title) || `pagina-${index + 1}`);
      const links = sourcePages.map((item, itemIndex) => ({
        texto: item.title,
        paginaId: itemIndex === 0 ? 'home' : (slugify(item.slug || item.title) || `pagina-${itemIndex + 1}`),
      }));
      const body = page.sections.slice(0, 12)
        .map((section, sectionIndex) => this.block(section, sourceImages, theme, ecommerce,
          { pageId: id, index: sectionIndex, mockups, formularios }))
        .filter((block): block is Bloque => !!block);
      const blocks: Bloque[] = [
        { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: links, mostrarCarrito: ecommerce, estilos: { paddingY: 'compacto' } },
        ...body,
        { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: typeof blueprint?.concept === 'string' ? blueprint.concept.trim() : 'Conoce mas sobre nuestra propuesta.', redes: [], estilos: { paddingY: 'normal', fondo: theme.colorTexto }, estilosTexto: { texto: { color: theme.colorFondo } } },
      ];
      pages[id] = { schemaVersion: 2, id, slug: index === 0 ? '' : id, titulo: page.title, bloques: blocks, actualizadoEn: Date.now() };
    });
    // Firebase RTDB rechaza cualquier propiedad undefined, incluso si esta
    // profundamente anidada en un bloque generado por IA.
    const result = JSON.parse(JSON.stringify({ tema: theme, paginas: pages })) as ContenidoSitio;
    return contenidoSitioSchema.parse(result) as ContenidoSitio;
  }

  private block(
    section: AiSiteBlueprintSection,
    images: string[],
    theme: TemaSitio,
    ecommerce: boolean,
    ctx: BlockContext,
  ): Bloque | null {
    const id = nuevoIdBloque();
    const title = typeof section.title === 'string' ? section.title.trim().slice(0, 200) || 'Conoce nuestra propuesta' : 'Conoce nuestra propuesta';
    const text = typeof section.text === 'string' ? section.text.trim().slice(0, 1000) || 'Creamos una experiencia pensada para nuestros clientes.' : 'Creamos una experiencia pensada para nuestros clientes.';
    const foto = (w: number, h: number, extra?: number) =>
      mockupFoto(semillaSeccion(section.imageHint, ctx.pageId, ctx.index, extra), w, h);
    const image = this.imageAt(images, section.imageIndex)
      ?? (ctx.mockups && section.imageHint ? foto(1200, 900) : undefined);
    const fondo = this.fondoDeSeccion(section.background, theme);
    let divider: DivisorBloque | undefined = this.divider(section.divider, theme.colorFondo);
    // Si la seccion tiene fondo gradiente y un divisor, el divisor continua el gradiente.
    if (divider && fondo?.fondoGradiente) {
      divider = { ...divider, gradiente: fondo.fondoGradiente };
    }
    const base = {
      id,
      visible: true,
      estilos: {
        paddingY: 'amplio' as const,
        ...(divider ? { divisorAbajo: divider } : {}),
        ...(fondo?.fondo ? { fondo: fondo.fondo } : {}),
        ...(fondo?.fondoGradiente ? { fondoGradiente: fondo.fondoGradiente } : {}),
      },
    };
    const items = Array.isArray(section?.items)
      ? section.items.filter(item => item && typeof item === 'object').slice(0, 8)
      : [];
    switch (section.type) {
      case 'hero': return { ...base, tipo: 'hero', variante: section.variant === 'card' ? 'tarjeta' : image ? 'partido' : 'centrado', titulo: title, subtitulo: text, imagenUrl: image, imagenLado: 'derecha', alineacion: image ? 'izquierda' : 'centro', cta: { texto: section.ctaText || 'Conocer mas', enlace: this.link(section.ctaLink), variante: 'primario' }, estilos: { ...base.estilos, fondoGradiente: image ? undefined : { desde: theme.colorPrimario, hasta: theme.colorAcento, angulo: 135 } }, estilosTexto: image ? undefined : { titulo: { color: '#ffffff' }, subtitulo: { color: '#ffffff' } } };
      case 'features': return { ...base, tipo: 'caracteristicas', titulo: title, columnas: 3, items: (items.length ? items : [{ title: 'Calidad', text }, { title: 'Confianza', text }, { title: 'Cercania', text }]).map((x, i) => ({ icono: (typeof x.icon === 'string' && x.icon.trim() ? x.icon.trim().slice(0, 8) : ['✨', '✓', '★', '⚡'][i % 4]), titulo: x.title || `Beneficio ${i + 1}`, texto: x.text })) };
      case 'products': return { ...base, tipo: 'productos', titulo: title, origen: { modo: 'seleccion', productoIds: [] }, columnas: 3, mostrarPrecio: true, ordenar: 'nombre', variante: section.variant === 'list' ? 'lista' : 'tarjetas' };
      case 'testimonials': return { ...base, tipo: 'testimonios', titulo: title, variante: 'tarjetas', items: (items.length ? items : [{ title: 'Cliente', text: 'Agrega aqui una experiencia real de un cliente.' }]).map(x => ({ nombre: x.title || 'Cliente', texto: x.text || text, avatarUrl: this.imageAt(images, x.imageIndex), estrellas: 5 })) };
      case 'gallery': {
        const urls = this.pickImages(images, section.imageIndexes, 8);
        const finales = urls.length ? urls : ctx.mockups ? [0, 1, 2, 3, 4, 5].map(i => foto(800, 600, i)) : [];
        return finales.length
          ? { ...base, tipo: 'galeria', variante: 'mosaico', imagenes: finales.map((url, i) => ({ url, alt: `${title} ${i + 1}` })), columnas: 3 }
          : { ...base, tipo: 'texto', contenido: `${title}\n${text}`, alineacion: 'centro' };
      }
      case 'text': return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro', estilosTexto: { contenido: { tamanoPx: 18 } } };
      case 'cta': return { ...base, tipo: 'cta', titulo: title, texto: text, textoBoton: section.ctaText || 'Contactar', enlace: this.link(section.ctaLink) };
      case 'faq': return { ...base, tipo: 'faq', titulo: title, items: (items.length ? items : [{ title: '¿Como podemos ayudarte?', text }]).map(x => ({ pregunta: x.title || 'Pregunta frecuente', respuesta: x.text || text })) };
      case 'statistics': return { ...base, tipo: 'estadisticas', items: (items.length ? items : [{ value: '100%', title: 'Compromiso' }]).map(x => ({ valor: (x.value || '100%').slice(0, 20), etiqueta: x.title || x.text || 'Resultado' })) };
      case 'team': return { ...base, tipo: 'equipo', titulo: title, columnas: 3, items: (items.length ? items : [{ title: 'Nuestro equipo', text: 'Especialistas a tu servicio' }]).map((x, i) => ({ nombre: x.title || `Integrante ${i + 1}`, cargo: x.text, fotoUrl: this.imageAt(images, x.imageIndex) ?? (ctx.mockups ? foto(600, 600, i) : images[i]) })) };
      case 'plans': return { ...base, tipo: 'planes', titulo: title, orientacion: 'vertical', columnas: 3, planes: (items.length ? items : [{ title: 'Plan recomendado', text }]).map((x, i) => ({ id: `${id}-${i}`, nombre: x.title || `Plan ${i + 1}`, precio: typeof x.price === 'number' && x.price >= 0 ? x.price : undefined, periodo: typeof x.period === 'string' ? x.period.slice(0, 30) : undefined, descripcion: x.text, caracteristicas: (Array.isArray(x.features) && x.features.length ? x.features : [x.value || 'Personalizable']).slice(0, 12).map(f => String(f).slice(0, 200)), ctaTexto: section.ctaText || 'Solicitar', ctaEnlace: this.link(section.ctaLink), destacado: i === 1 })) };
      case 'payment': return { ...base, tipo: 'metodos-pago', titulo: title, metodos: ['efectivo', 'transferencia', 'tarjeta'], nota: text, cta: { texto: section.ctaText || 'Ver formas de pago', enlace: '/pago', variante: 'primario' } };
      case 'contact': {
        // Formulario real creado por la "tool" del chat; fallback legacy con campos inline.
        const formularioId = ctx.formularios?.get(`${ctx.pageId}:${ctx.index}`);
        if (formularioId) {
          return { ...base, tipo: 'formulario', variante: 'tarjeta', formularioId, titulo: title, textoBoton: section.ctaText || 'Enviar', mensajeExito: section.form?.successMessage?.slice(0, 1000) || 'Gracias. Recibimos tu informacion.' };
        }
        return { ...base, tipo: 'formulario', variante: 'tarjeta', formularioId: 'contacto-ia', titulo: title, campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'email', tipo: 'email', etiqueta: 'Correo', requerido: true }, { id: 'mensaje', tipo: 'textarea', etiqueta: '¿Como podemos ayudarte?', requerido: true }], textoBoton: section.ctaText || 'Enviar', mensajeExito: 'Gracias. Recibimos tu informacion.' };
      }
      case 'map': return { ...base, tipo: 'mapa', lat: -0.1807, lng: -78.4678, zoom: 13, direccion: text.slice(0, 200) };
      case 'logos': {
        const urls = this.pickImages(images, section.imageIndexes, 6);
        const finales = urls.length ? urls
          : ctx.mockups ? [1, 2, 3, 4, 5].map(i => mockupTinte('#e2e8f0', theme.colorTexto, `Marca ${i}`, 320, 160)) : [];
        return finales.length
          ? { ...base, tipo: 'logos', titulo: title, imagenes: finales.map((url, i) => ({ url, alt: `Marca ${i + 1}` })), gris: true }
          : null;
      }
      case 'carousel': {
        const picked = this.pickImages(images, section.imageIndexes, 12);
        const urls = picked.length ? picked : ctx.mockups ? [0, 1, 2].map(i => foto(1400, 700, i)) : [];
        if (urls.length >= 2) {
          return { ...base, tipo: 'carrusel', slides: urls.map((url, i) => ({ imagenUrl: url, titulo: items[i]?.title ? String(items[i].title).slice(0, 200) : undefined })), autoplayMs: 5000 };
        }
        if (urls.length === 1) return { ...base, tipo: 'imagen', url: urls[0], alt: title };
        return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro' };
      }
      case 'image': {
        const url = this.imageAt(images, section.imageIndex) ?? images[0] ?? (ctx.mockups ? foto(1400, 700) : undefined);
        return url ? { ...base, tipo: 'imagen', url, alt: title } : null;
      }
      case 'video': return /^[A-Za-z0-9_-]{5,20}$/.test(section.videoId ?? '') ? { ...base, tipo: 'video', proveedor: 'youtube', videoId: section.videoId as string } : null;
      case 'button': return { ...base, tipo: 'boton', texto: (section.ctaText || 'Conocer mas').slice(0, 200), enlace: this.link(section.ctaLink), variante: 'primario', alineacion: 'centro', estilos: { paddingY: 'compacto' } };
      case 'columns': {
        const cols = Array.isArray(section.columns) ? section.columns.filter(c => c && typeof c === 'object').slice(0, 4) : [];
        if (!cols.length) return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro' };
        return {
          ...base, tipo: 'columnas', alineacionVertical: 'arriba', columnas: cols.map((col, i) => {
            const colId = `${id}-col-${i}`;
            const elementos: ElementoColumna[] = [];
            const colImage = this.imageAt(images, col.imageIndex) ?? (ctx.mockups ? foto(700, 500, i) : undefined);
            if (colImage) elementos.push({ id: `${colId}-img`, tipo: 'imagen', url: colImage, alt: (col.title || `Columna ${i + 1}`).slice(0, 200) });
            const contenido = [col.title, col.text].filter(v => typeof v === 'string' && v.trim()).join('\n\n').slice(0, 8000);
            if (contenido) elementos.push({ id: `${colId}-txt`, tipo: 'texto', contenido });
            if (col.ctaText) elementos.push({ id: `${colId}-btn`, tipo: 'boton', texto: col.ctaText.slice(0, 200), enlace: this.link(col.ctaLink), variante: 'secundario' });
            if (!elementos.length) elementos.push({ id: `${colId}-txt`, tipo: 'texto', contenido: text });
            return { id: colId, elementos };
          }),
        };
      }
      case 'paycta': return ecommerce
        ? { ...base, tipo: 'pago', titulo: title, texto: text, textoBoton: (section.ctaText || 'Pagar ahora').slice(0, 200) }
        : { ...base, tipo: 'cta', titulo: title, texto: text, textoBoton: section.ctaText || 'Contactar', enlace: this.link(section.ctaLink) };
      case 'countdown': {
        const parsed = Date.parse(section.countdownDate ?? '');
        const fecha = Number.isFinite(parsed) && parsed > Date.now() ? parsed : Date.now() + 7 * 24 * 60 * 60 * 1000;
        return { ...base, tipo: 'countdown', titulo: title, fecha, mensajeFin: text.slice(0, 200) };
      }
      case 'spacer': return { ...base, tipo: 'espaciador', altura: this.clampInt(section.heightPx, 8, 300, 48), linea: section.variant === 'linea', estilos: { paddingY: 'compacto' } };
      case 'html': {
        const codigo = this.sanitizeHtml(section.html);
        return codigo ? { ...base, tipo: 'html', codigo, altura: this.clampInt(section.heightPx, 40, 2000, 320) } : null;
      }
      case 'canvas': return this.lienzoDesdePlantilla(section, images, theme, base, title, text, ctx);
      default: return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro' };
    }
  }

  /**
   * La IA nunca emite coordenadas: elige una plantilla y rellena slots; las
   * posiciones desktop/movil viven en LIENZO_PLANTILLAS.
   */
  private lienzoDesdePlantilla(
    section: AiSiteBlueprintSection,
    images: string[],
    theme: TemaSitio,
    base: { id: string; visible: boolean; estilos?: EstilosBloque },
    title: string,
    text: string,
    ctx: BlockContext,
  ): Bloque | null {
    const canvas = section.canvas;
    if (!canvas || !esPlantillaLienzo(canvas.template)) {
      return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro' } as Bloque;
    }
    const plantilla = LIENZO_PLANTILLAS[canvas.template];
    const slots = canvas.slots ?? {};
    const slotImages = this.pickImages(images, slots.imageIndexes ?? section.imageIndexes, 3);
    const mockup = (extra?: number) => ctx.mockups
      ? mockupFoto(semillaSeccion(section.imageHint, ctx.pageId, ctx.index, extra), 900, 700)
      : undefined;
    const fallbackImage = this.imageAt(images, slots.imageIndex ?? section.imageIndex)
      ?? slotImages[0] ?? images[0] ?? mockup();
    const textoColor = plantilla.textoClaro ? '#ffffff' : undefined;
    let imageCursor = 0;

    const elementos: ElementoLienzo[] = [];
    plantilla.elementos.forEach((def, index) => {
      const elemento = this.elementoDeSlot(def, `${base.id}-el-${index}`, {
        titulo: (slots.titulo || title).slice(0, 8000),
        subtitulo: (slots.subtitulo || text).slice(0, 8000),
        ctaText: (slots.ctaText || section.ctaText || '').slice(0, 200),
        ctaLink: this.link(slots.ctaLink || section.ctaLink),
        imagen: () => {
          const cursor = imageCursor++;
          return slotImages[cursor] ?? mockup(cursor) ?? fallbackImage;
        },
        alt: title,
        textoColor,
      });
      if (elemento) elementos.push(elemento);
    });
    if (!elementos.length) {
      return { ...base, tipo: 'texto', contenido: `${title}\n\n${text}`, alineacion: 'centro' } as Bloque;
    }

    const estilos = { ...(base.estilos ?? {}) } as NonNullable<BloqueLienzo['estilos']>;
    if (plantilla.fondoImagen && fallbackImage) {
      estilos.fondoImagenUrl = fallbackImage;
      estilos.fondoVelo = true;
    } else if (plantilla.fondoGradiente || plantilla.fondoImagen) {
      estilos.fondoGradiente = { desde: theme.colorPrimario, hasta: theme.colorAcento, angulo: 135 };
    }
    return {
      ...base,
      tipo: 'lienzo',
      altura: plantilla.altura,
      alturaMovil: plantilla.alturaMovil,
      elementos,
      estilos,
    };
  }

  private elementoDeSlot(
    def: LienzoSlotDef,
    id: string,
    content: {
      titulo: string;
      subtitulo: string;
      ctaText: string;
      ctaLink: string;
      imagen: () => string | undefined;
      alt: string;
      textoColor?: string;
    },
  ): ElementoLienzo | null {
    const pos = { x: def.pos.x, y: def.pos.y, w: def.pos.w, h: def.pos.h, responsive: { movil: def.movil }, zIndex: def.zIndex };
    const estiloTexto = (def.tamanoPx || def.negrita || def.cursiva || content.textoColor)
      ? { tamanoPx: def.tamanoPx, negrita: def.negrita, cursiva: def.cursiva, color: content.textoColor }
      : undefined;
    switch (def.slot) {
      case 'titulo':
        return content.titulo ? { id, tipo: 'texto', contenido: content.titulo, alineacion: def.alineacion, estiloTexto, ...pos } : null;
      case 'subtitulo':
        return content.subtitulo ? { id, tipo: 'texto', contenido: content.subtitulo, alineacion: def.alineacion, estiloTexto, ...pos } : null;
      case 'cta':
        return content.ctaText ? { id, tipo: 'boton', texto: content.ctaText, enlace: content.ctaLink, variante: 'primario', ...pos } : null;
      case 'imagen1':
      case 'imagen2':
      case 'imagen3': {
        const url = content.imagen();
        return url ? { id, tipo: 'imagen', url, alt: content.alt.slice(0, 200), ...pos } : null;
      }
    }
  }

  /** Re-aplica en cliente la blocklist del backend; vacio o bloqueado = se descarta el bloque. */
  private sanitizeHtml(html: string | undefined): string | null {
    if (typeof html !== 'string' || !html.trim()) return null;
    const trimmed = html.trim().slice(0, 20000);
    return HTML_BLOCKLIST.some(pattern => pattern.test(trimmed)) ? null : trimmed;
  }

  private pickImages(images: string[], indexes: number[] | undefined, max: number): string[] {
    const picked = Array.isArray(indexes)
      ? indexes.map(index => this.imageAt(images, index)).filter((url): url is string => !!url)
      : [];
    return (picked.length ? picked : images).slice(0, max);
  }

  private imageAt(images: string[], index: number | undefined): string | undefined {
    return Number.isInteger(index) && (index as number) >= 0 && (index as number) < images.length
      ? images[index as number]
      : undefined;
  }

  private clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  private theme(raw: AiSiteBlueprint['theme']): TemaSitio {
    const color = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
    const fonts: FuenteId[] = ['system', 'inter', 'poppins', 'montserrat', 'playfair', 'roboto'];
    const font = (value: string, fallback: FuenteId): FuenteId => fonts.includes(value as FuenteId) ? value as FuenteId : fallback;
    return { colorPrimario: color(raw?.primary, '#2563eb'), colorAcento: color(raw?.accent, '#f59e0b'), colorFondo: color(raw?.background, '#ffffff'), colorTexto: color(raw?.text, '#1f2937'), fuenteTitulos: font(raw?.headingFont, 'poppins'), fuenteCuerpo: font(raw?.bodyFont, 'inter'), radioEsquinas: ['recto', 'suave', 'redondo'].includes(raw?.cornerStyle) ? raw.cornerStyle as TemaSitio['radioEsquinas'] : 'suave' };
  }

  private divider(value: string | undefined, color: string) {
    const map = { wave: 'onda', diagonal: 'diagonal', curve: 'curva' } as const;
    const type = map[value as keyof typeof map];
    return type ? { tipo: type, color, altura: 64 } : undefined;
  }

  /**
   * Fondo de seccion pedido por la IA. Solo tintes/degradados CLAROS: el texto oscuro
   * del tema sigue siendo legible sin recolorear cada campo. Los fondos fuertes con
   * texto blanco quedan reservados a hero y cta, que ya los manejan.
   */
  private fondoDeSeccion(
    background: string | undefined,
    theme: TemaSitio,
  ): { fondo?: string; fondoGradiente?: { desde: string; hasta: string; angulo: number } } | undefined {
    switch (background) {
      case 'suave':
        return { fondo: this.mezclarConBlanco(theme.colorPrimario, 0.93) };
      case 'suave-acento':
        return { fondo: this.mezclarConBlanco(theme.colorAcento, 0.93) };
      case 'degradado':
        return { fondoGradiente: { desde: '#ffffff', hasta: this.mezclarConBlanco(theme.colorPrimario, 0.86), angulo: 160 } };
      case 'degradado-acento':
        return { fondoGradiente: { desde: this.mezclarConBlanco(theme.colorPrimario, 0.9), hasta: this.mezclarConBlanco(theme.colorAcento, 0.86), angulo: 160 } };
      default:
        return undefined;
    }
  }

  /** Aclara un hex mezclandolo con blanco (pct 0..1 de blanco). */
  private mezclarConBlanco(hex: string, pct: number): string {
    const limpio = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '2563eb';
    const canal = (i: number) => {
      const c = parseInt(limpio.slice(i, i + 2), 16);
      const mezcla = Math.round(c + (255 - c) * pct);
      return mezcla.toString(16).padStart(2, '0');
    };
    return `#${canal(0)}${canal(2)}${canal(4)}`;
  }
  private link(value?: string): string {
    return typeof value === 'string' && (value.startsWith('/') || value.startsWith('#')) ? value : '#contacto';
  }
}

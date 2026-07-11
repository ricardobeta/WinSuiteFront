import { ContenidoSitio, PaginaDoc, TemaSitio, TipoSitio } from '@winsuite/bloques';
import { nuevoIdBloque } from './bloques-catalogo';

/**
 * Plantillas prediseñadas del wizard "Crear sitio". Cada una fabrica un ContenidoSitio
 * completo (tema + paginas) listo para editar. Se iran agregando mas con el tiempo.
 */
export interface PlantillaSitio {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoSitio;
  /** Color representativo para la card del wizard. */
  colorPreview: string;
  colorSecundario?: string;
  categoria?: string;
  icono?: string;
  etiquetas?: string[];
  crearContenido: () => ContenidoSitio;
}

function pagina(
  id: string,
  slug: string,
  titulo: string,
  bloques: PaginaDoc['bloques'],
): PaginaDoc {
  return { schemaVersion: 1, id, slug, titulo, bloques, actualizadoEn: Date.now() };
}

const temaBase: TemaSitio = {
  colorPrimario: '#2563eb',
  colorAcento: '#f59e0b',
  colorFondo: '#ffffff',
  colorTexto: '#1f2937',
  fuenteTitulos: 'poppins',
  fuenteCuerpo: 'inter',
  radioEsquinas: 'suave',
};

export const PLANTILLAS_SITIO: PlantillaSitio[] = [
  {
    id: 'tienda-basica',
    nombre: 'Tienda basica',
    descripcion: 'Ecommerce listo: banner, productos, metodos de pago y contacto.',
    tipo: 'ecommerce',
    colorPreview: '#2563eb',
    crearContenido: () => ({
      tema: { ...temaBase },
      paginas: {
        home: pagina('home', '', 'Inicio', [
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'header',
            mostrarLogo: true,
            enlaces: [],
            mostrarCarrito: true,
            estilos: { paddingY: 'compacto' },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'hero',
            titulo: 'Bienvenido a tu tienda',
            subtitulo: 'Los mejores productos, al mejor precio.',
            alineacion: 'centro',
            cta: { texto: 'Ver productos', enlace: '#' },
            estilos: { fondoGradiente: { desde: '#2563eb', hasta: '#06b6d4', angulo: 135 } },
            estilosTexto: { titulo: { color: '#ffffff' }, subtitulo: { color: '#ffffff' } },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'productos',
            titulo: 'Nuestros productos',
            origen: { modo: 'seleccion', productoIds: [] },
            columnas: 3,
            mostrarPrecio: true,
            ordenar: 'nombre',
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'metodos-pago',
            titulo: 'Metodos de pago',
            metodos: ['efectivo', 'transferencia'],
            estilos: { anchoBloque: 'mitad' },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'pago',
            titulo: 'Paga en linea',
            texto: 'Tarjeta, transferencia o QR: tu eliges.',
            textoBoton: 'Pagar ahora',
            estilos: { anchoBloque: 'mitad' },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'footer',
            texto: '© Mi negocio. Todos los derechos reservados.',
            redes: [],
            estilos: { paddingY: 'compacto' },
          },
        ]),
      },
    }),
  },
  {
    id: 'landing-promo',
    nombre: 'Landing de promocion',
    descripcion: 'Landing de marketing: hero, beneficios, testimonios y formulario de leads.',
    tipo: 'landing',
    colorPreview: '#059669',
    crearContenido: () => ({
      tema: { ...temaBase, colorPrimario: '#059669', fuenteTitulos: 'montserrat' },
      paginas: {
        home: pagina('home', '', 'Inicio', [
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'hero',
            titulo: 'Tu promocion aqui',
            subtitulo: 'Explica en una frase por que es irresistible.',
            alineacion: 'centro',
            cta: { texto: 'Quiero saber mas', enlace: '#' },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'texto',
            contenido:
              'Cuenta los beneficios de tu producto o servicio.\nUno por linea funciona muy bien.',
            alineacion: 'centro',
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'testimonios',
            titulo: 'Clientes satisfechos',
            items: [
              { nombre: 'Maria G.', texto: 'Super recomendado, cambio mi negocio.', estrellas: 5 },
            ],
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'formulario',
            // Placeholder: el usuario elige un formulario prehecho en el panel.
            formularioId: 'leads',
            titulo: 'Dejanos tus datos',
            campos: [
              { id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true },
              { id: 'telefono', tipo: 'telefono', etiqueta: 'Telefono', requerido: true },
            ],
            textoBoton: 'Enviar',
            mensajeExito: 'Gracias, te contactaremos pronto.',
            estilos: { fondoGradiente: { desde: '#ecfdf5', hasta: '#ffffff', angulo: 180 } },
          },
          {
            id: nuevoIdBloque(),
            visible: true,
            tipo: 'footer',
            texto: '© Mi negocio.',
            redes: [],
            estilos: { paddingY: 'compacto' },
          },
        ]),
      },
    }),
  },
  {
    id: 'servicios-profesionales',
    nombre: 'Servicios profesionales',
    descripcion: 'Presencia corporativa elegante con propuesta de valor, servicios y contacto.',
    tipo: 'landing',
    categoria: 'Servicios', icono: 'business_center', colorPreview: '#0f172a', colorSecundario: '#38bdf8',
    etiquetas: ['Corporativo', 'Consultoría'],
    crearContenido: () => ({
      tema: { ...temaBase, colorPrimario: '#0284c7', colorAcento: '#0f172a', fuenteTitulos: 'montserrat' },
      paginas: { home: pagina('home', '', 'Inicio', [
        { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
        { id: nuevoIdBloque(), visible: true, tipo: 'lienzo', altura: 500, cuadricula: { activa: true, tamano: 20, ajustar: true }, elementos: [
          { id: nuevoIdBloque(), tipo: 'texto', contenido: 'Estrategia clara. Resultados medibles.', x: 7, y: 18, w: 52, estiloTexto: { tamanoPx: 56, negrita: true, color: '#0f172a' } },
          { id: nuevoIdBloque(), tipo: 'texto', contenido: 'Acompañamos a empresas que quieren crecer con procesos simples y decisiones inteligentes.', x: 7, y: 48, w: 45, estiloTexto: { tamanoPx: 20, color: '#475569' } },
          { id: nuevoIdBloque(), tipo: 'boton', texto: 'Agenda una conversación', enlace: '#contacto', variante: 'primario', x: 7, y: 70, w: 24 },
          { id: nuevoIdBloque(), tipo: 'imagen', url: 'https://placehold.co/720x760/0f172a/ffffff?text=Tu+equipo', alt: 'Equipo profesional', x: 65, y: 8, w: 29, h: 82, mantenerProporcion: false },
        ] },
        { id: nuevoIdBloque(), visible: true, tipo: 'texto', contenido: 'Diagnóstico · Estrategia · Implementación · Seguimiento', alineacion: 'centro', estilos: { fondo: '#f0f9ff', paddingY: 'amplio' } },
        { id: nuevoIdBloque(), visible: true, tipo: 'formulario', formularioId: 'contacto', titulo: 'Hablemos de tu próximo paso', textoBoton: 'Solicitar asesoría', mensajeExito: 'Gracias. Nos pondremos en contacto contigo.', campos: [] },
        { id: nuevoIdBloque(), visible: true, tipo: 'footer', texto: '© Servicios profesionales', redes: [], estilos: { paddingY: 'compacto' } },
      ]) },
    }),
  },
  {
    id: 'restaurante-autoral',
    nombre: 'Restaurante de autor',
    descripcion: 'Carta visual, historia del restaurante y llamados a reservar o pedir.',
    tipo: 'ecommerce', categoria: 'Gastronomía', icono: 'restaurant', colorPreview: '#431407', colorSecundario: '#f59e0b',
    etiquetas: ['Restaurante', 'Menú'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#9a3412', colorAcento: '#f59e0b', colorFondo: '#fffbeb', fuenteTitulos: 'playfair' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Sabores que cuentan una historia', subtitulo: 'Ingredientes locales, cocina honesta y momentos para recordar.', alineacion: 'centro', cta: { texto: 'Ver el menú', enlace: '#menu' }, estilos: { fondoGradiente: { desde: '#431407', hasta: '#9a3412', angulo: 135 }, paddingY: 'amplio' }, estilosTexto: { titulo: { color: '#fff' }, subtitulo: { color: '#ffedd5' } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Favoritos de la casa', origen: { modo: 'seleccion', productoIds: [] }, columnas: 3, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'galeria', imagenes: [{ url: 'https://placehold.co/700x700/7c2d12/fff?text=Plato+1' }, { url: 'https://placehold.co/700x700/f59e0b/431407?text=Plato+2' }, { url: 'https://placehold.co/700x700/431407/fff?text=Ambiente' }], columnas: 3 },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', texto: '© Restaurante · Reservas y pedidos', redes: [] },
    ]) } }),
  },
  {
    id: 'portafolio-creativo',
    nombre: 'Portafolio creativo',
    descripcion: 'Presentación editorial para profesionales, estudios y agencias creativas.',
    tipo: 'landing', categoria: 'Portafolio', icono: 'palette', colorPreview: '#312e81', colorSecundario: '#f472b6',
    etiquetas: ['Creativo', 'Agencia'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#4f46e5', colorAcento: '#ec4899', fuenteTitulos: 'poppins' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'lienzo', altura: 560, cuadricula: { activa: true, tamano: 18, ajustar: true }, elementos: [
        { id: nuevoIdBloque(), tipo: 'texto', contenido: 'Diseñamos ideas que se sienten.', x: 7, y: 12, w: 58, estiloTexto: { tamanoPx: 64, negrita: true, color: '#1e1b4b' }, zIndex: 2 },
        { id: nuevoIdBloque(), tipo: 'imagen', url: 'https://placehold.co/900x620/312e81/f472b6?text=Proyecto', alt: 'Proyecto destacado', x: 48, y: 45, w: 46, h: 45 },
        { id: nuevoIdBloque(), tipo: 'texto', contenido: 'Identidad · Web · Contenido', x: 8, y: 72, w: 34, estiloTexto: { tamanoPx: 18, negrita: true, color: '#4f46e5' } },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'galeria', imagenes: [{ url: 'https://placehold.co/700x520/e0e7ff/312e81?text=Proyecto+A' }, { url: 'https://placehold.co/700x520/fce7f3/831843?text=Proyecto+B' }, { url: 'https://placehold.co/700x520/dcfce7/14532d?text=Proyecto+C' }], columnas: 3 },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', titulo: 'Clientes que vuelven', items: [{ nombre: 'Equipo Andino', texto: 'Entendieron la esencia de nuestra marca.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', texto: '© Estudio creativo', redes: [] },
    ]) } }),
  },
  {
    id: 'catalogo-whatsapp',
    nombre: 'Catálogo con WhatsApp',
    descripcion: 'Vitrina comercial limpia para mostrar productos y cerrar ventas por contacto.',
    tipo: 'ecommerce', categoria: 'Catálogo', icono: 'storefront', colorPreview: '#064e3b', colorSecundario: '#34d399',
    etiquetas: ['Productos', 'WhatsApp'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#059669', colorAcento: '#f59e0b', fuenteTitulos: 'montserrat' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Encuentra justo lo que buscas', subtitulo: 'Explora el catálogo y escríbenos para recibir atención personalizada.', alineacion: 'izquierda', cta: { texto: 'Explorar productos', enlace: '#catalogo' }, estilos: { fondoGradiente: { desde: '#ecfdf5', hasta: '#d1fae5', angulo: 120 }, paddingY: 'amplio' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Catálogo destacado', origen: { modo: 'seleccion', productoIds: [] }, columnas: 4, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'metodos-pago', titulo: 'Compra con confianza', metodos: ['efectivo', 'transferencia'], nota: 'Confirma disponibilidad y entrega con nuestro equipo.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', texto: '© Tu catálogo', redes: [{ tipo: 'whatsapp', url: 'https://wa.me/' }] },
    ]) } }),
  },
  {
    id: 'en-blanco',
    nombre: 'Desde cero',
    descripcion: 'Pagina vacia para construir a tu manera.',
    tipo: 'landing',
    colorPreview: '#6b7280',
    crearContenido: () => ({
      tema: { ...temaBase },
      paginas: { home: pagina('home', '', 'Inicio', []) },
    }),
  },
];

export function plantillasPorTipo(tipo: TipoSitio): PlantillaSitio[] {
  // "Desde cero" sirve para ambos tipos.
  return PLANTILLAS_SITIO.filter((p) => p.tipo === tipo || p.id === 'en-blanco');
}

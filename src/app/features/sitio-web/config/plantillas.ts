import { ContenidoSitio, PaginaDoc, TemaSitio, TipoSitio } from '@winsuite/bloques';
import { mockupFoto, mockupTinte } from '../services/ai-site-mockups';
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
    id: 'boutique-moda',
    nombre: 'Boutique de moda',
    descripcion: 'Estética editorial para colecciones de ropa y accesorios con conversión.',
    tipo: 'ecommerce', categoria: 'Moda', icono: 'checkroom', colorPreview: '#1c1917', colorSecundario: '#b45309',
    etiquetas: ['Moda', 'Elegante', 'Colección', 'Premium'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#1c1917', colorAcento: '#b45309', colorFondo: '#faf7f2', colorTexto: '#292524', fuenteTitulos: 'playfair', radioEsquinas: 'recto' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'partido', titulo: 'La nueva colección ya está aquí', subtitulo: 'Piezas atemporales, hechas para durar y combinarse contigo.', imagenUrl: mockupFoto('boutique-moda-hero', 1200, 900), imagenLado: 'derecha', alineacion: 'izquierda', cta: { texto: 'Ver colección', enlace: '#coleccion' }, estilos: { paddingY: 'amplio' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Comprar aquí es fácil', columnas: 3, items: [{ icono: '🚚', titulo: 'Envíos a todo el país', texto: 'Recibe tu pedido en 24-72 horas.' }, { icono: '🔁', titulo: 'Cambios sencillos', texto: 'Tienes 15 días para cambiar tu talla.' }, { icono: '🔒', titulo: 'Pago seguro', texto: 'Tarjeta, transferencia o contra entrega.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Colección destacada', origen: { modo: 'seleccion', productoIds: [] }, columnas: 4, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'carrusel', slides: [{ imagenUrl: mockupFoto('boutique-moda-look-1', 1400, 700), titulo: 'Lookbook primavera' }, { imagenUrl: mockupFoto('boutique-moda-look-2', 1400, 700), titulo: 'Básicos con carácter' }, { imagenUrl: mockupFoto('boutique-moda-look-3', 1400, 700), titulo: 'Accesorios que suman' }], autoplayMs: 5000 },
      { id: nuevoIdBloque(), visible: true, tipo: 'countdown', titulo: 'La oferta de temporada termina pronto', fecha: Date.now() + 30 * 24 * 60 * 60 * 1000, mensajeFin: 'La oferta terminó, pero la colección sigue disponible.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', variante: 'cita', items: [{ nombre: 'Valeria M.', texto: 'La calidad se siente desde que abres el paquete. Volveré por más.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'metodos-pago', titulo: 'Formas de pago', metodos: ['efectivo', 'transferencia', 'tarjeta'], estilos: { anchoBloque: 'mitad' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'pago', titulo: 'Compra en línea', texto: 'Asegura tus piezas favoritas en minutos.', textoBoton: 'Pagar ahora', estilos: { anchoBloque: 'mitad' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Boutique · Moda con intención.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'tech-store',
    nombre: 'Tienda de tecnología',
    descripcion: 'Vitrina oscura para gadgets con garantía, specs y compra en línea.',
    tipo: 'ecommerce', categoria: 'Tecnología', icono: 'devices', colorPreview: '#0b1120', colorSecundario: '#38bdf8',
    etiquetas: ['Gadgets', 'Oscuro', 'Garantía', 'Envíos'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#38bdf8', colorAcento: '#a78bfa', colorFondo: '#0b1120', colorTexto: '#e2e8f0', fuenteTitulos: 'montserrat' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Tecnología original, sin vueltas', subtitulo: 'Los últimos gadgets con garantía real y envío en 24 horas.', alineacion: 'centro', cta: { texto: 'Ver ofertas', enlace: '#productos' }, estilos: { fondoGradiente: { desde: '#0b1120', hasta: '#312e81', angulo: 135 }, paddingY: 'amplio' }, estilosTexto: { titulo: { color: '#ffffff' }, subtitulo: { color: '#c7d2fe' } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '+500', etiqueta: 'productos disponibles' }, { valor: '24h', etiqueta: 'envío en ciudad' }, { valor: '12 meses', etiqueta: 'de garantía' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Lo más vendido', origen: { modo: 'seleccion', productoIds: [] }, columnas: 3, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Por qué comprar aquí', columnas: 3, items: [{ icono: '🛠️', titulo: 'Soporte técnico', texto: 'Te ayudamos antes y después de comprar.' }, { icono: '✅', titulo: 'Productos originales', texto: 'Distribuidores autorizados.' }, { icono: '💳', titulo: 'Paga en cuotas', texto: 'Difiere con tu tarjeta favorita.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Preguntas frecuentes', items: [{ pregunta: '¿Los productos tienen garantía?', respuesta: 'Sí, todos incluyen 12 meses de garantía directa.' }, { pregunta: '¿Puedo devolver un producto?', respuesta: 'Tienes 7 días para devoluciones sin uso.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'pago', titulo: 'Compra segura en línea', texto: 'Tarjeta, transferencia o QR.', textoBoton: 'Ir a pagar' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Tech Store · Tecnología con garantía.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'mercado-organico',
    nombre: 'Mercado orgánico',
    descripcion: 'Productos frescos y locales con entrega a domicilio y compra directa.',
    tipo: 'ecommerce', categoria: 'Alimentos', icono: 'eco', colorPreview: '#15803d', colorSecundario: '#ea580c',
    etiquetas: ['Orgánico', 'Local', 'Delivery', 'Fresco'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#15803d', colorAcento: '#ea580c', colorTexto: '#1a2e05', fuenteTitulos: 'montserrat', radioEsquinas: 'redondo' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'partido', titulo: 'Del campo a tu mesa', subtitulo: 'Frutas, verduras y despensa orgánica de productores locales.', imagenUrl: mockupFoto('mercado-organico-hero', 1200, 900), imagenLado: 'derecha', alineacion: 'izquierda', cta: { texto: 'Hacer mi pedido', enlace: '#productos' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Fresco de verdad', columnas: 3, items: [{ icono: '🥬', titulo: 'Cosecha del día', texto: 'Seleccionamos cada mañana.' }, { icono: '🧑‍🌾', titulo: 'Productores locales', texto: 'Comercio justo con el campo.' }, { icono: '🛵', titulo: 'Entrega a domicilio', texto: 'Recibe el mismo día en tu zona.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Canasta de la semana', origen: { modo: 'seleccion', productoIds: [] }, columnas: 4, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '+40', etiqueta: 'productores aliados' }, { valor: '+2000', etiqueta: 'entregas realizadas' }, { valor: '100%', etiqueta: 'orgánico certificado' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', titulo: 'Familias que ya piden', items: [{ nombre: 'Carolina T.', texto: 'Todo llega fresco y la diferencia se nota en el sabor.', estrellas: 5 }, { nombre: 'Andrés P.', texto: 'Pedir cada semana es facilísimo.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Entregas', items: [{ pregunta: '¿En qué zonas entregan?', respuesta: 'Cubrimos toda la ciudad; consulta tu sector al hacer el pedido.' }, { pregunta: '¿Cuándo llega mi pedido?', respuesta: 'Pedidos antes de las 11h se entregan el mismo día.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'metodos-pago', titulo: 'Paga como prefieras', metodos: ['efectivo', 'transferencia', 'tarjeta'], estilos: { anchoBloque: 'mitad' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'pago', titulo: 'Pedido en línea', texto: 'Arma tu canasta y paga en minutos.', textoBoton: 'Pagar pedido', estilos: { anchoBloque: 'mitad' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Mercado orgánico · Comida real.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'belleza-spa',
    nombre: 'Belleza y spa',
    descripcion: 'Cosmética y tratamientos con reservas de cita y venta en línea.',
    tipo: 'ecommerce', categoria: 'Belleza', icono: 'spa', colorPreview: '#047857', colorSecundario: '#b45309',
    etiquetas: ['Spa', 'Cosmética', 'Bienestar', 'Reservas'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#047857', colorAcento: '#b45309', colorFondo: '#f0fdf4', colorTexto: '#14532d', fuenteTitulos: 'playfair', radioEsquinas: 'redondo' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: true, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'tarjeta', titulo: 'Un ritual para volver a ti', subtitulo: 'Tratamientos y cosmética natural que cuidan tu piel y tu calma.', imagenUrl: mockupFoto('belleza-spa-hero', 1400, 800), alineacion: 'centro', cta: { texto: 'Reservar mi cita', enlace: '#reserva' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'texto', contenido: 'Creemos en la belleza que nace del descanso.\nCada tratamiento combina técnicas profesionales con ingredientes naturales.', alineacion: 'centro', estilosTexto: { contenido: { tamanoPx: 18 } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'productos', titulo: 'Nuestra línea de cuidado', origen: { modo: 'seleccion', productoIds: [] }, columnas: 3, mostrarPrecio: true, ordenar: 'nombre' },
      { id: nuevoIdBloque(), visible: true, tipo: 'galeria', variante: 'mosaico', imagenes: [{ url: mockupFoto('belleza-spa-g1', 800, 600), alt: 'Cabina de tratamiento' }, { url: mockupFoto('belleza-spa-g2', 800, 600), alt: 'Productos naturales' }, { url: mockupFoto('belleza-spa-g3', 800, 600), alt: 'Ambiente del spa' }], columnas: 3 },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', items: [{ nombre: 'Daniela R.', texto: 'Salí renovada. El mejor plan del mes.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'reserva-spa', titulo: 'Reserva tu cita', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'tratamiento', tipo: 'seleccion', etiqueta: 'Tratamiento', requerido: true, opciones: ['Facial', 'Masaje relajante', 'Manicure spa'] }, { id: 'fecha', tipo: 'texto', etiqueta: 'Fecha deseada', requerido: false }], textoBoton: 'Reservar', mensajeExito: 'Gracias, confirmaremos tu cita por teléfono.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'pago', titulo: 'Compra en línea', texto: 'Tu rutina de cuidado, a un click.', textoBoton: 'Pagar ahora' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Spa & Belleza · Bienestar real.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'cafeteria-brunch',
    nombre: 'Cafetería y brunch',
    descripcion: 'Ambiente cálido, carta visual y reservas de mesa para tu café.',
    tipo: 'landing', categoria: 'Gastronomía', icono: 'coffee', colorPreview: '#78350f', colorSecundario: '#d97706',
    etiquetas: ['Cafetería', 'Brunch', 'Acogedor', 'Reservas'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#78350f', colorAcento: '#d97706', colorFondo: '#fffbeb', colorTexto: '#451a03', fuenteTitulos: 'playfair', fuenteCuerpo: 'montserrat' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'partido', titulo: 'Café de origen, brunch de casa', subtitulo: 'Un rincón para desayunar rico, trabajar tranquilo o quedarte conversando.', imagenUrl: mockupFoto('cafeteria-brunch-hero', 1200, 900), imagenLado: 'derecha', alineacion: 'izquierda', cta: { texto: 'Reservar mesa', enlace: '#reserva' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'columnas', alineacionVertical: 'arriba', columnas: [
        { id: 'col-desayunos', elementos: [{ id: 'col-desayunos-img', tipo: 'imagen', url: mockupFoto('cafeteria-desayunos', 700, 500), alt: 'Desayunos' }, { id: 'col-desayunos-txt', tipo: 'texto', contenido: 'Desayunos\n\nClásicos y de la casa, con pan artesanal.' }] },
        { id: 'col-brunch', elementos: [{ id: 'col-brunch-img', tipo: 'imagen', url: mockupFoto('cafeteria-brunch-col', 700, 500), alt: 'Brunch' }, { id: 'col-brunch-txt', tipo: 'texto', contenido: 'Brunch de fin de semana\n\nDulce y salado hasta las 14h.' }] },
        { id: 'col-cafe', elementos: [{ id: 'col-cafe-img', tipo: 'imagen', url: mockupFoto('cafeteria-cafe', 700, 500), alt: 'Café de origen' }, { id: 'col-cafe-txt', tipo: 'texto', contenido: 'Café de origen\n\nTostado local, métodos y espresso.' }] },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'galeria', variante: 'mosaico', imagenes: [{ url: mockupFoto('cafeteria-g1', 800, 600) }, { url: mockupFoto('cafeteria-g2', 800, 600) }, { url: mockupFoto('cafeteria-g3', 800, 600) }, { url: mockupFoto('cafeteria-g4', 800, 600) }], columnas: 3 },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', variante: 'compacto', titulo: 'Lo que dicen nuestros clientes', items: [{ nombre: 'Pau S.', texto: 'El mejor flat white de la zona.', estrellas: 5 }, { nombre: 'Jorge L.', texto: 'El brunch de los sábados es un ritual.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'mapa', lat: -0.1807, lng: -78.4678, zoom: 15, direccion: 'Encuéntranos en el corazón del barrio.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'cta', titulo: '¿Plan de brunch este fin de semana?', texto: 'Reserva tu mesa y llega directo a disfrutar.', textoBoton: 'Reservar mesa', enlace: '#reserva' },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'reserva-mesa', titulo: 'Reserva tu mesa', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'fecha', tipo: 'texto', etiqueta: 'Fecha y hora', requerido: true }, { id: 'personas', tipo: 'seleccion', etiqueta: 'Número de personas', requerido: true, opciones: ['2', '3-4', '5-6', 'Grupo grande'] }], textoBoton: 'Reservar', mensajeExito: 'Gracias, confirmaremos tu reserva por WhatsApp.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Cafetería · Hecho con café y cariño.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'fitness-studio',
    nombre: 'Estudio fitness',
    descripcion: 'Energía pura: membresías con precios, coaches y clase de prueba.',
    tipo: 'landing', categoria: 'Deporte', icono: 'fitness_center', colorPreview: '#0f172a', colorSecundario: '#f97316',
    etiquetas: ['Gimnasio', 'Planes', 'Energía', 'Oscuro'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#f97316', colorAcento: '#22d3ee', colorFondo: '#0f172a', colorTexto: '#e2e8f0', fuenteTitulos: 'montserrat', radioEsquinas: 'recto' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Entrena con propósito', subtitulo: 'Clases dirigidas, coaches certificados y una comunidad que empuja contigo.', alineacion: 'centro', cta: { texto: 'Agenda tu clase de prueba', enlace: '#prueba' }, estilos: { fondoGradiente: { desde: '#0f172a', hasta: '#7c2d12', angulo: 135 }, paddingY: 'amplio' }, estilosTexto: { titulo: { color: '#ffffff' }, subtitulo: { color: '#fed7aa' } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '+350', etiqueta: 'miembros activos' }, { valor: '40', etiqueta: 'clases por semana' }, { valor: '8', etiqueta: 'coaches certificados' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'planes', titulo: 'Elige tu membresía', orientacion: 'vertical', columnas: 3, planes: [
        { id: 'plan-basico', nombre: 'Básico', precio: 29.9, periodo: '/mes', caracteristicas: ['Acceso a sala de pesas', 'Horario de 6h a 22h', 'App de seguimiento'], ctaTexto: 'Empezar' },
        { id: 'plan-full', nombre: 'Full', precio: 44.9, periodo: '/mes', caracteristicas: ['Todo lo del plan Básico', 'Clases grupales ilimitadas', 'Evaluación física mensual', 'Invita a un amigo al mes'], ctaTexto: 'Empezar', destacado: true },
        { id: 'plan-elite', nombre: 'Elite', precio: 69.9, periodo: '/mes', caracteristicas: ['Todo lo del plan Full', '2 sesiones personal training', 'Plan nutricional', 'Casillero premium'], ctaTexto: 'Empezar' },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'equipo', titulo: 'Tu equipo de coaches', columnas: 3, items: [{ nombre: 'Coach Marcela', cargo: 'Funcional y HIIT', fotoUrl: mockupFoto('fitness-coach-1', 600, 600) }, { nombre: 'Coach David', cargo: 'Fuerza', fotoUrl: mockupFoto('fitness-coach-2', 600, 600) }, { nombre: 'Coach Sofía', cargo: 'Yoga y movilidad', fotoUrl: mockupFoto('fitness-coach-3', 600, 600) }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'countdown', titulo: 'Promo de inscripción: 0 matrícula', fecha: Date.now() + 14 * 24 * 60 * 60 * 1000, mensajeFin: 'La promo terminó, pero tu primera clase sigue siendo gratis.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Preguntas frecuentes', items: [{ pregunta: '¿Necesito experiencia previa?', respuesta: 'No: cada clase se adapta a tu nivel.' }, { pregunta: '¿Puedo congelar mi membresía?', respuesta: 'Sí, hasta 30 días al año sin costo.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'clase-prueba', titulo: 'Agenda tu clase de prueba', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'horario', tipo: 'seleccion', etiqueta: 'Horario preferido', requerido: true, opciones: ['Mañana', 'Tarde', 'Noche'] }], textoBoton: 'Agendar', mensajeExito: '¡Listo! Te esperamos en tu primera clase.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Studio Fitness · Más fuerte cada semana.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'clinica-salud',
    nombre: 'Clínica de salud',
    descripcion: 'Confianza profesional: especialidades, doctores y agendamiento de citas.',
    tipo: 'landing', categoria: 'Salud', icono: 'medical_services', colorPreview: '#0e7490', colorSecundario: '#14b8a6',
    etiquetas: ['Clínica', 'Confianza', 'Citas', 'Profesional'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#0e7490', colorAcento: '#14b8a6', colorTexto: '#134e4a' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'partido', titulo: 'Tu salud, en buenas manos', subtitulo: 'Atención médica cercana, moderna y sin esperas innecesarias.', imagenUrl: mockupFoto('clinica-salud-hero', 1200, 900), imagenLado: 'derecha', alineacion: 'izquierda', cta: { texto: 'Agendar cita', enlace: '#cita' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Especialidades', columnas: 3, items: [{ icono: '🩺', titulo: 'Medicina general', texto: 'Chequeos y seguimiento continuo.' }, { icono: '🦷', titulo: 'Odontología', texto: 'Prevención y estética dental.' }, { icono: '🧒', titulo: 'Pediatría', texto: 'Cuidado cercano para los más pequeños.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'equipo', titulo: 'Nuestros especialistas', columnas: 3, items: [{ nombre: 'Dra. Elena Ruiz', cargo: 'Medicina general', fotoUrl: mockupFoto('clinica-doc-1', 600, 600) }, { nombre: 'Dr. Marco Vera', cargo: 'Odontología', fotoUrl: mockupFoto('clinica-doc-2', 600, 600) }, { nombre: 'Dra. Paula León', cargo: 'Pediatría', fotoUrl: mockupFoto('clinica-doc-3', 600, 600) }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', titulo: 'Pacientes que confían', items: [{ nombre: 'Rosa M.', texto: 'Puntuales, claros y muy humanos.', estrellas: 5 }, { nombre: 'Luis A.', texto: 'Agendar la cita fue cosa de un minuto.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Antes de tu visita', items: [{ pregunta: '¿Trabajan con seguros médicos?', respuesta: 'Sí, con las principales aseguradoras del país.' }, { pregunta: '¿Cuál es el horario de atención?', respuesta: 'Lunes a sábado de 8h a 19h.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'mapa', lat: -0.1807, lng: -78.4678, zoom: 15, direccion: 'Av. Principal y calle Salud, consultorios 2do piso.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'cita-medica', titulo: 'Agenda tu cita', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'especialidad', tipo: 'seleccion', etiqueta: 'Especialidad', requerido: true, opciones: ['Medicina general', 'Odontología', 'Pediatría'] }, { id: 'fecha', tipo: 'texto', etiqueta: 'Fecha deseada', requerido: false }], textoBoton: 'Agendar cita', mensajeExito: 'Gracias, confirmaremos tu cita a la brevedad.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Clínica · Salud cercana.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'inmobiliaria-premium',
    nombre: 'Inmobiliaria premium',
    descripcion: 'Portafolio de propiedades con captación de compradores y vendedores.',
    tipo: 'landing', categoria: 'Bienes raíces', icono: 'apartment', colorPreview: '#0f172a', colorSecundario: '#ca8a04',
    etiquetas: ['Propiedades', 'Corporativo', 'Tasación'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#0f172a', colorAcento: '#ca8a04', colorTexto: '#1e293b', fuenteTitulos: 'montserrat', radioEsquinas: 'recto' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', variante: 'partido', titulo: 'Propiedades que valen la pena', subtitulo: 'Compra, vende o alquila con un equipo que conoce el mercado.', imagenUrl: mockupFoto('inmobiliaria-hero', 1200, 800), imagenLado: 'derecha', alineacion: 'izquierda', cta: { texto: 'Solicitar tasación gratis', enlace: '#tasacion' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '+320', etiqueta: 'propiedades vendidas' }, { valor: '15', etiqueta: 'años de experiencia' }, { valor: '98%', etiqueta: 'clientes satisfechos' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'galeria', variante: 'grilla', imagenes: [{ url: mockupFoto('inmueble-1', 800, 600), alt: 'Departamento moderno' }, { url: mockupFoto('inmueble-2', 800, 600), alt: 'Casa con jardín' }, { url: mockupFoto('inmueble-3', 800, 600), alt: 'Oficina corporativa' }, { url: mockupFoto('inmueble-4', 800, 600), alt: 'Suite amoblada' }, { url: mockupFoto('inmueble-5', 800, 600), alt: 'Penthouse' }, { url: mockupFoto('inmueble-6', 800, 600), alt: 'Local comercial' }], columnas: 3 },
      { id: nuevoIdBloque(), visible: true, tipo: 'columnas', alineacionVertical: 'arriba', columnas: [
        { id: 'col-comprar', elementos: [{ id: 'col-comprar-txt', tipo: 'texto', contenido: 'Comprar\n\nTe acompañamos desde la búsqueda hasta las llaves.' }, { id: 'col-comprar-btn', tipo: 'boton', texto: 'Ver propiedades', enlace: '#propiedades', variante: 'secundario' }] },
        { id: 'col-vender', elementos: [{ id: 'col-vender-txt', tipo: 'texto', contenido: 'Vender\n\nTasación real y difusión profesional de tu propiedad.' }, { id: 'col-vender-btn', tipo: 'boton', texto: 'Tasar mi propiedad', enlace: '#tasacion', variante: 'secundario' }] },
        { id: 'col-alquilar', elementos: [{ id: 'col-alquilar-txt', tipo: 'texto', contenido: 'Alquilar\n\nContratos claros e inquilinos verificados.' }, { id: 'col-alquilar-btn', tipo: 'boton', texto: 'Quiero alquilar', enlace: '#tasacion', variante: 'secundario' }] },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', variante: 'cita', items: [{ nombre: 'Familia Cordero', texto: 'Vendieron nuestra casa en 5 semanas al precio justo.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'logos', titulo: 'Aliados de confianza', imagenes: [{ url: mockupTinte('#e2e8f0', '#0f172a', 'Banco Uno', 320, 160), alt: 'Banco Uno' }, { url: mockupTinte('#e2e8f0', '#0f172a', 'Aseguradora', 320, 160), alt: 'Aseguradora' }, { url: mockupTinte('#e2e8f0', '#0f172a', 'Notaria', 320, 160), alt: 'Notaría' }, { url: mockupTinte('#e2e8f0', '#0f172a', 'Constructora', 320, 160), alt: 'Constructora' }], gris: true },
      { id: nuevoIdBloque(), visible: true, tipo: 'cta', titulo: '¿Cuánto vale tu propiedad hoy?', texto: 'Solicita una tasación profesional sin costo ni compromiso.', textoBoton: 'Solicitar tasación gratis', enlace: '#tasacion' },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'tasacion', titulo: 'Cuéntanos de tu propiedad', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'operacion', tipo: 'seleccion', etiqueta: 'Qué deseas hacer', requerido: true, opciones: ['Comprar', 'Vender', 'Alquilar'] }, { id: 'sector', tipo: 'texto', etiqueta: 'Sector', requerido: false }], textoBoton: 'Enviar', mensajeExito: 'Gracias, un asesor te contactará hoy mismo.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Inmobiliaria · Decisiones con respaldo.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'academia-online',
    nombre: 'Academia online',
    descripcion: 'Cursos con precios, instructores y cuenta regresiva a la próxima cohorte.',
    tipo: 'landing', categoria: 'Educación', icono: 'school', colorPreview: '#6d28d9', colorSecundario: '#f59e0b',
    etiquetas: ['Cursos', 'Cohortes', 'Instructores'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#6d28d9', colorAcento: '#f59e0b' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Aprende haciendo, con mentores reales', subtitulo: 'Programas en vivo, proyectos prácticos y una comunidad que no te suelta.', alineacion: 'centro', cta: { texto: 'Inscribirme ahora', enlace: '#inscripcion' }, estilos: { fondoGradiente: { desde: '#6d28d9', hasta: '#4f46e5', angulo: 135 }, paddingY: 'amplio' }, estilosTexto: { titulo: { color: '#ffffff' }, subtitulo: { color: '#ede9fe' } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Así aprendes aquí', columnas: 3, items: [{ icono: '🎯', titulo: 'Metodología práctica', texto: 'Proyectos reales desde la semana 1.' }, { icono: '🧑‍🏫', titulo: 'Mentores expertos', texto: 'Feedback directo de profesionales.' }, { icono: '📜', titulo: 'Certificado', texto: 'Acredita tus nuevas habilidades.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'planes', titulo: 'Próximos programas', orientacion: 'vertical', columnas: 3, planes: [
        { id: 'curso-marketing', nombre: 'Marketing digital', precio: 149, periodo: 'único', caracteristicas: ['8 semanas en vivo', 'Proyecto final real', 'Bolsa de talento'], ctaTexto: 'Inscribirme' },
        { id: 'curso-datos', nombre: 'Análisis de datos', precio: 199, periodo: 'único', caracteristicas: ['10 semanas en vivo', 'Portafolio con 3 proyectos', 'Mentoría 1:1', 'Certificado'], ctaTexto: 'Inscribirme', destacado: true },
        { id: 'curso-diseno', nombre: 'Diseño UX', precio: 179, periodo: 'único', caracteristicas: ['9 semanas en vivo', 'Casos de estudio reales', 'Revisión de portafolio'], ctaTexto: 'Inscribirme' },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'equipo', titulo: 'Instructores', columnas: 3, items: [{ nombre: 'Camila O.', cargo: 'Marketing digital', fotoUrl: mockupFoto('academia-prof-1', 600, 600) }, { nombre: 'Rafael G.', cargo: 'Análisis de datos', fotoUrl: mockupFoto('academia-prof-2', 600, 600) }, { nombre: 'Inés B.', cargo: 'Diseño UX', fotoUrl: mockupFoto('academia-prof-3', 600, 600) }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', titulo: 'Egresados', items: [{ nombre: 'Diego F.', texto: 'Conseguí trabajo antes de terminar el curso.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'countdown', titulo: 'La próxima cohorte inicia pronto', fecha: Date.now() + 21 * 24 * 60 * 60 * 1000, mensajeFin: 'Cohorte iniciada: escríbenos para reservar la siguiente.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Dudas frecuentes', items: [{ pregunta: '¿Las clases quedan grabadas?', respuesta: 'Sí, tienes acceso de por vida a las grabaciones.' }, { pregunta: '¿Puedo pagar en cuotas?', respuesta: 'Sí, hasta 3 cuotas sin interés.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'inscripcion', titulo: 'Reserva tu cupo', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'correo', tipo: 'email', etiqueta: 'Correo', requerido: true }, { id: 'curso', tipo: 'seleccion', etiqueta: 'Programa de interés', requerido: true, opciones: ['Marketing digital', 'Análisis de datos', 'Diseño UX'] }], textoBoton: 'Reservar cupo', mensajeExito: '¡Cupo reservado! Te enviaremos los detalles por correo.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Academia · Aprende haciendo.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'saas-startup',
    nombre: 'SaaS startup',
    descripcion: 'Landing de producto digital: hero creativo, prueba social y planes.',
    tipo: 'landing', categoria: 'Tecnología', icono: 'rocket_launch', colorPreview: '#4f46e5', colorSecundario: '#06b6d4',
    etiquetas: ['SaaS', 'Producto', 'Planes', 'B2B'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#4f46e5', colorAcento: '#06b6d4', colorTexto: '#111827' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'lienzo', altura: 520, alturaMovil: 640, elementos: [
        { id: 'saas-hero-titulo', tipo: 'texto', contenido: 'Tu operación, en piloto automático', x: 6, y: 16, w: 52, estiloTexto: { tamanoPx: 52, negrita: true, color: '#111827' }, zIndex: 2, responsive: { movil: { x: 6, y: 6, w: 88 } } },
        { id: 'saas-hero-sub', tipo: 'texto', contenido: 'Automatiza tareas repetitivas y toma decisiones con datos en tiempo real.', x: 6, y: 46, w: 44, estiloTexto: { tamanoPx: 19, color: '#4b5563' }, zIndex: 2, responsive: { movil: { x: 6, y: 34, w: 88 } } },
        { id: 'saas-hero-cta', tipo: 'boton', texto: 'Empieza gratis', enlace: '#planes', variante: 'primario', x: 6, y: 68, w: 22, zIndex: 2, responsive: { movil: { x: 6, y: 56, w: 60 } } },
        { id: 'saas-hero-img', tipo: 'imagen', url: mockupTinte('#4f46e5', '#ffffff', 'Tu producto', 900, 640), alt: 'Vista del producto', x: 58, y: 10, w: 38, h: 80, responsive: { movil: { x: 8, y: 68, w: 84, h: 28 } } },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'logos', titulo: 'Confían en nosotros', imagenes: [{ url: mockupTinte('#eef2ff', '#4f46e5', 'Empresa A', 320, 160) }, { url: mockupTinte('#eef2ff', '#4f46e5', 'Empresa B', 320, 160) }, { url: mockupTinte('#eef2ff', '#4f46e5', 'Empresa C', 320, 160) }, { url: mockupTinte('#eef2ff', '#4f46e5', 'Empresa D', 320, 160) }, { url: mockupTinte('#eef2ff', '#4f46e5', 'Empresa E', 320, 160) }], gris: true },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Todo lo que tu equipo necesita', columnas: 3, items: [{ icono: '⚙️', titulo: 'Automatizaciones', texto: 'Flujos que trabajan mientras duermes.' }, { icono: '📊', titulo: 'Reportes en vivo', texto: 'Métricas claras para decidir rápido.' }, { icono: '🔌', titulo: 'Integraciones', texto: 'Conecta tus herramientas favoritas.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '99.9%', etiqueta: 'uptime garantizado' }, { valor: '+1200', etiqueta: 'equipos activos' }, { valor: '4.8/5', etiqueta: 'satisfacción' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'planes', titulo: 'Planes que crecen contigo', orientacion: 'vertical', columnas: 3, planes: [
        { id: 'saas-free', nombre: 'Starter', precio: 0, periodo: '/mes', caracteristicas: ['Hasta 3 usuarios', 'Automatizaciones básicas', 'Soporte por correo'], ctaTexto: 'Empezar gratis' },
        { id: 'saas-pro', nombre: 'Pro', precio: 29, periodo: '/mes', caracteristicas: ['Usuarios ilimitados', 'Automatizaciones avanzadas', 'Reportes personalizados', 'Soporte prioritario'], ctaTexto: 'Probar Pro', destacado: true },
        { id: 'saas-business', nombre: 'Business', precio: 79, periodo: '/mes', caracteristicas: ['Todo lo de Pro', 'SSO y permisos avanzados', 'SLA dedicado', 'Onboarding guiado'], ctaTexto: 'Hablar con ventas' },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Preguntas frecuentes', items: [{ pregunta: '¿Puedo cancelar cuando quiera?', respuesta: 'Sí, sin permanencias ni letras pequeñas.' }, { pregunta: '¿Mis datos están seguros?', respuesta: 'Ciframos todo en tránsito y en reposo.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'cta', titulo: 'Empieza gratis hoy', texto: 'Configura tu cuenta en menos de 5 minutos.', textoBoton: 'Crear cuenta', enlace: '#planes' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© SaaS · Software que trabaja por ti.', redes: [], estilos: { paddingY: 'compacto' } },
    ]) } }),
  },
  {
    id: 'planes-servicio',
    nombre: 'Servicios por planes',
    descripcion: 'Comparativa de planes con precios reales, ideal para internet, TV o suscripciones.',
    tipo: 'landing', categoria: 'Suscripciones', icono: 'wifi', colorPreview: '#1d4ed8', colorSecundario: '#f59e0b',
    etiquetas: ['Internet', 'Planes', 'Suscripción', 'Comparativa'],
    crearContenido: () => ({ tema: { ...temaBase, colorPrimario: '#1d4ed8', colorAcento: '#f59e0b', colorFondo: '#f8fafc', colorTexto: '#0f172a', fuenteTitulos: 'montserrat' }, paginas: { home: pagina('home', '', 'Inicio', [
      { id: nuevoIdBloque(), visible: true, tipo: 'header', mostrarLogo: true, enlaces: [], mostrarCarrito: false, estilos: { paddingY: 'compacto' } },
      { id: nuevoIdBloque(), visible: true, tipo: 'hero', titulo: 'Elige tu plan ideal', subtitulo: 'Internet rápido y estable, con instalación gratis y soporte de verdad.', alineacion: 'centro', cta: { texto: 'Ver planes', enlace: '#planes' }, estilos: { fondoGradiente: { desde: '#1d4ed8', hasta: '#0ea5e9', angulo: 135 }, paddingY: 'amplio' }, estilosTexto: { titulo: { color: '#ffffff' }, subtitulo: { color: '#dbeafe' } } },
      { id: nuevoIdBloque(), visible: true, tipo: 'planes', titulo: 'Planes para cada hogar', orientacion: 'vertical', columnas: 3, planes: [
        { id: 'plan-basico', nombre: 'Básico', precio: 19.9, periodo: '/mes', descripcion: 'Para navegar y redes sociales.', caracteristicas: ['100 Mbps de velocidad', 'Wifi incluido', 'Instalación gratis', 'Soporte 24/7'], ctaTexto: 'Contratar' },
        { id: 'plan-hogar', nombre: 'Hogar', precio: 27.9, periodo: '/mes', descripcion: 'El favorito de las familias.', caracteristicas: ['300 Mbps de velocidad', 'Router wifi 6', 'Streaming sin cortes', 'Instalación gratis', 'Soporte 24/7'], ctaTexto: 'Contratar', destacado: true },
        { id: 'plan-gamer', nombre: 'Gamer', precio: 39.9, periodo: '/mes', descripcion: 'Baja latencia para jugar y transmitir.', caracteristicas: ['600 Mbps simétricos', 'Ping optimizado', 'IP pública opcional', 'Router wifi 6', 'Soporte prioritario'], ctaTexto: 'Contratar' },
      ] },
      { id: nuevoIdBloque(), visible: true, tipo: 'caracteristicas', titulo: 'Sin letra pequeña', columnas: 3, items: [{ icono: '🛠️', titulo: 'Instalación gratis', texto: 'Agendamos en menos de 48 horas.' }, { icono: '📞', titulo: 'Soporte 24/7', texto: 'Personas reales, todos los días.' }, { icono: '🔓', titulo: 'Sin permanencia', texto: 'Quédate porque quieres, no por contrato.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'estadisticas', items: [{ valor: '+8000', etiqueta: 'hogares conectados' }, { valor: '35', etiqueta: 'sectores con cobertura' }, { valor: '99.6%', etiqueta: 'de disponibilidad' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'testimonios', titulo: 'Clientes conectados', items: [{ nombre: 'Karla V.', texto: 'El plan Hogar nos cambió el teletrabajo.', estrellas: 5 }, { nombre: 'Mateo R.', texto: 'Juego en línea sin lag. Cumplen lo que ofrecen.', estrellas: 5 }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'faq', titulo: 'Antes de contratar', items: [{ pregunta: '¿Cómo sé si hay cobertura en mi sector?', respuesta: 'Déjanos tu dirección en el formulario y te confirmamos en minutos.' }, { pregunta: '¿Cuánto tarda la instalación?', respuesta: 'Máximo 48 horas después de confirmar cobertura.' }, { pregunta: '¿Qué formas de pago aceptan?', respuesta: 'Tarjeta, transferencia y débito automático.' }] },
      { id: nuevoIdBloque(), visible: true, tipo: 'mapa', lat: -0.1807, lng: -78.4678, zoom: 12, direccion: 'Consulta la cobertura de tu sector.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'cta', titulo: '¿Listo para conectarte mejor?', texto: 'Verifica tu cobertura y agenda tu instalación gratis.', textoBoton: 'Verificar cobertura', enlace: '#cobertura' },
      { id: nuevoIdBloque(), visible: true, tipo: 'formulario', variante: 'tarjeta', formularioId: 'cobertura', titulo: 'Verifica tu cobertura', campos: [{ id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true }, { id: 'telefono', tipo: 'telefono', etiqueta: 'Teléfono', requerido: true }, { id: 'direccion', tipo: 'texto', etiqueta: 'Dirección', requerido: true }, { id: 'plan', tipo: 'seleccion', etiqueta: 'Plan de interés', requerido: true, opciones: ['Básico 100 Mbps', 'Hogar 300 Mbps', 'Gamer 600 Mbps'] }], textoBoton: 'Verificar', mensajeExito: '¡Gracias! Te confirmamos la cobertura enseguida.' },
      { id: nuevoIdBloque(), visible: true, tipo: 'footer', variante: 'columnas', texto: '© Tu proveedor · Conexión que cumple.', redes: [], estilos: { paddingY: 'compacto' } },
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

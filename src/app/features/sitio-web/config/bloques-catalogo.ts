import { Bloque, TipoBloque } from '@winsuite/bloques';

export type CategoriaBloque = 'estructura' | 'contenido' | 'comercio' | 'avanzado';

export const CATEGORIAS_BLOQUES: { id: CategoriaBloque; nombre: string }[] = [
  { id: 'estructura', nombre: 'Estructura' },
  { id: 'contenido', nombre: 'Contenido' },
  { id: 'comercio', nombre: 'Comercio' },
  { id: 'avanzado', nombre: 'Avanzado' },
];

/**
 * Catalogo de bloques disponibles en la paleta del editor (patron DASHBOARD_WIDGETS).
 * `crearPorDefecto` fabrica la instancia inicial al soltar/agregar el bloque.
 * NOTA: el bloque 'columnas' salio de la paleta (redundante con bloques lado a lado +
 * pizarron); el renderer y los schemas lo siguen soportando para sitios existentes.
 */
export interface DefinicionBloque {
  tipo: TipoBloque;
  nombre: string;
  icono: string;
  descripcion: string;
  categoria: CategoriaBloque;
  /** Solo disponible en sitios tipo ecommerce. */
  soloEcommerce?: boolean;
  crearPorDefecto: (id: string) => Bloque;
}

export const BLOQUES_CATALOGO: DefinicionBloque[] = [
  {
    tipo: 'header',
    categoria: 'estructura',
    nombre: 'Encabezado',
    icono: 'web_asset',
    descripcion: 'Logo, navegacion y carrito.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'header',
      mostrarLogo: true,
      enlaces: [],
      mostrarCarrito: false,
      estilos: { paddingY: 'compacto' },
    }),
  },
  {
    tipo: 'hero',
    categoria: 'estructura',
    nombre: 'Banner principal',
    icono: 'panorama',
    descripcion: 'Titulo grande con imagen de fondo y boton.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'hero',
      titulo: 'Tu titulo aqui',
      subtitulo: 'Describe tu propuesta de valor en una frase.',
      alineacion: 'centro',
      cta: {
        texto: 'Conocer más', enlace: '#', variante: 'primario',
        colorFondo: '#f59e0b', colorTexto: '#ffffff',
      },
    }),
  },
  {
    tipo: 'carrusel',
    categoria: 'contenido',
    nombre: 'Carrusel',
    icono: 'view_carousel',
    descripcion: 'Imagenes rotativas con titulo y enlace.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'carrusel',
      slides: [{ imagenUrl: 'https://placehold.co/1200x500?text=Slide+1', titulo: 'Slide 1' }],
      autoplayMs: 5000,
    }),
  },
  {
    tipo: 'productos',
    categoria: 'comercio',
    nombre: 'Productos',
    icono: 'shopping_bag',
    descripcion: 'Vitrina de productos del inventario.',
    soloEcommerce: true,
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'productos',
      titulo: 'Nuestros productos',
      origen: { modo: 'seleccion', productoIds: [] },
      columnas: 3,
      mostrarPrecio: true,
      ordenar: 'nombre',
    }),
  },
  {
    tipo: 'lienzo',
    categoria: 'estructura',
    nombre: 'Pizarron',
    icono: 'gesture',
    descripcion: 'Lienzo libre: arrastra textos, imagenes y botones a cualquier posicion.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'lienzo',
      altura: 420,
      elementos: [
        {
          id: `${id}-e1`,
          tipo: 'texto',
          contenido: 'Tu titulo libre',
          x: 8,
          y: 12,
          w: 45,
          estiloTexto: { tamano: '2xl', negrita: true },
        },
        {
          id: `${id}-e2`,
          tipo: 'texto',
          contenido: 'Arrastra cada elemento desde su manija azul a donde quieras.',
          x: 8,
          y: 34,
          w: 40,
        },
        {
          id: `${id}-e3`,
          tipo: 'boton',
          texto: 'Comprar ahora',
          enlace: '#',
          variante: 'primario',
          x: 8,
          y: 58,
          w: 22,
        },
        {
          id: `${id}-e4`,
          tipo: 'imagen',
          url: 'https://placehold.co/600x400?text=Imagen',
          alt: 'Imagen',
          x: 55,
          y: 10,
          w: 38,
        },
      ],
    }),
  },
  {
    tipo: 'texto',
    categoria: 'contenido',
    nombre: 'Texto',
    icono: 'notes',
    descripcion: 'Parrafo de texto libre.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'texto',
      contenido: 'Escribe aqui tu contenido...',
      alineacion: 'izquierda',
    }),
  },
  {
    tipo: 'imagen',
    categoria: 'contenido',
    nombre: 'Imagen',
    icono: 'image',
    descripcion: 'Imagen a lo ancho del contenido.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'imagen',
      url: 'https://placehold.co/1080x480?text=Imagen',
      alt: 'Imagen',
    }),
  },
  {
    tipo: 'galeria',
    categoria: 'contenido',
    nombre: 'Galeria',
    icono: 'grid_view',
    descripcion: 'Cuadricula de imagenes.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'galeria',
      imagenes: [
        { url: 'https://placehold.co/600x600?text=1' },
        { url: 'https://placehold.co/600x600?text=2' },
        { url: 'https://placehold.co/600x600?text=3' },
      ],
      columnas: 3,
    }),
  },
  {
    tipo: 'video',
    categoria: 'contenido',
    nombre: 'Video',
    icono: 'smart_display',
    descripcion: 'Video de YouTube incrustado.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'video',
      proveedor: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    }),
  },
  {
    tipo: 'boton',
    categoria: 'contenido',
    nombre: 'Boton',
    icono: 'smart_button',
    descripcion: 'Boton de llamada a la accion.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'boton',
      texto: 'Contactanos',
      enlace: '#',
      variante: 'primario',
      alineacion: 'centro',
      estilos: { paddingY: 'compacto' },
    }),
  },
  {
    tipo: 'testimonios',
    categoria: 'contenido',
    nombre: 'Testimonios',
    icono: 'reviews',
    descripcion: 'Comentarios de clientes con estrellas.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'testimonios',
      titulo: 'Lo que dicen nuestros clientes',
      items: [
        {
          nombre: 'Cliente feliz',
          texto: 'Excelente servicio y productos de calidad.',
          estrellas: 5,
        },
      ],
    }),
  },
  {
    tipo: 'metodos-pago',
    categoria: 'comercio',
    nombre: 'Metodos de pago',
    icono: 'payments',
    descripcion: 'Formas de pago que aceptas.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'metodos-pago',
      titulo: 'Metodos de pago',
      metodos: ['efectivo', 'transferencia'],
      cta: {
        texto: 'Pagar ahora', enlace: '/pago', variante: 'primario',
        colorFondo: '#f59e0b', colorTexto: '#ffffff',
      },
    }),
  },
  {
    tipo: 'formulario',
    categoria: 'comercio',
    nombre: 'Formulario',
    icono: 'list_alt',
    descripcion: 'Muestra uno de tus formularios prehechos (pestaña Formularios).',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'formulario',
      formularioId: id, // placeholder: el usuario elige un formulario prehecho en el panel
      titulo: 'Contactanos',
      textoBoton: 'Enviar',
      mensajeExito: 'Gracias, te contactaremos pronto.',
    }),
  },
  {
    tipo: 'mapa',
    categoria: 'contenido',
    nombre: 'Mapa y contacto',
    icono: 'location_on',
    descripcion: 'Ubicacion, direccion y horario.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'mapa',
      lat: -0.1807,
      lng: -78.4678,
      zoom: 15,
      direccion: 'Quito, Ecuador',
    }),
  },
  {
    tipo: 'footer',
    categoria: 'estructura',
    nombre: 'Pie de pagina',
    icono: 'call_to_action',
    descripcion: 'Texto legal y redes sociales.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'footer',
      texto: '© Mi negocio. Todos los derechos reservados.',
      redes: [],
      estilos: { paddingY: 'compacto' },
    }),
  },
  {
    tipo: 'planes',
    categoria: 'comercio',
    nombre: 'Planes / Precios',
    icono: 'workspace_premium',
    descripcion: 'Tabla de planes con precio, caracteristicas y boton por plan.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'planes',
      titulo: 'Nuestros planes',
      orientacion: 'vertical',
      columnas: 3,
      planes: [
        {
          id: `${id}-p1`,
          nombre: 'Basico',
          precio: 9.99,
          periodo: '/mes',
          descripcion: 'Para empezar.',
          caracteristicas: ['Caracteristica 1', 'Caracteristica 2'],
          ctaTexto: 'Elegir plan',
          ctaEnlace: '#',
        },
        {
          id: `${id}-p2`,
          nombre: 'Pro',
          precio: 19.99,
          periodo: '/mes',
          descripcion: 'El favorito de nuestros clientes.',
          caracteristicas: ['Todo lo del Basico', 'Caracteristica 3', 'Caracteristica 4'],
          ctaTexto: 'Elegir plan',
          ctaEnlace: '#',
          destacado: true,
        },
        {
          id: `${id}-p3`,
          nombre: 'Empresa',
          periodo: 'a convenir',
          descripcion: 'Para equipos grandes.',
          caracteristicas: ['Todo lo del Pro', 'Soporte dedicado'],
          ctaTexto: 'Contactanos',
          ctaEnlace: '#',
        },
      ],
    }),
  },
  {
    tipo: 'pago',
    categoria: 'comercio',
    nombre: 'Boton de pago',
    icono: 'point_of_sale',
    descripcion: 'Lleva a tu pagina de pago (configura los metodos en la pestaña Pagos).',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'pago',
      titulo: 'Paga en linea',
      texto: 'Elige tu metodo de pago preferido: tarjeta, transferencia o QR.',
      textoBoton: 'Pagar ahora',
    }),
  },
  {
    tipo: 'html',
    categoria: 'avanzado',
    nombre: 'HTML / JS',
    icono: 'code',
    descripcion: 'Incrusta codigo de terceros: contadores, cuentas regresivas, widgets.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'html',
      codigo:
        '<div style="font-family: sans-serif; text-align: center; padding: 20px;">Pega aqui tu codigo HTML/JS</div>',
      altura: 200,
    }),
  },
];

export function definicionDeBloque(tipo: TipoBloque): DefinicionBloque | undefined {
  return BLOQUES_CATALOGO.find((definicion) => definicion.tipo === tipo);
}

export function nuevoIdBloque(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

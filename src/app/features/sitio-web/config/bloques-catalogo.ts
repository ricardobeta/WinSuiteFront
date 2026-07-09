import { Bloque, TipoBloque } from '@winsuite/bloques';

/**
 * Catalogo de bloques disponibles en la paleta del editor (patron DASHBOARD_WIDGETS).
 * `crearPorDefecto` fabrica la instancia inicial al soltar/agregar el bloque.
 */
export interface DefinicionBloque {
  tipo: TipoBloque;
  nombre: string;
  icono: string;
  descripcion: string;
  /** Solo disponible en sitios tipo ecommerce. */
  soloEcommerce?: boolean;
  crearPorDefecto: (id: string) => Bloque;
}

export const BLOQUES_CATALOGO: DefinicionBloque[] = [
  {
    tipo: 'header',
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
      cta: { texto: 'Conocer mas', enlace: '#' },
    }),
  },
  {
    tipo: 'carrusel',
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
    tipo: 'columnas',
    nombre: 'Columnas',
    icono: 'view_column',
    descripcion: 'Seccion con 2-4 columnas: combina textos, imagenes y botones a tu gusto.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'columnas',
      columnas: [
        {
          id: `${id}-c1`,
          elementos: [
            { id: `${id}-e1`, tipo: 'texto', contenido: 'Escribe aqui tu contenido...' },
            {
              id: `${id}-e2`,
              tipo: 'boton',
              texto: 'Saber mas',
              enlace: '#',
              variante: 'primario',
            },
          ],
        },
        {
          id: `${id}-c2`,
          elementos: [
            {
              id: `${id}-e3`,
              tipo: 'imagen',
              url: 'https://placehold.co/600x400?text=Imagen',
              alt: 'Imagen',
            },
          ],
        },
      ],
      alineacionVertical: 'centro',
    }),
  },
  {
    tipo: 'lienzo',
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
    nombre: 'Metodos de pago',
    icono: 'payments',
    descripcion: 'Formas de pago que aceptas.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'metodos-pago',
      titulo: 'Metodos de pago',
      metodos: ['efectivo', 'transferencia'],
    }),
  },
  {
    tipo: 'formulario',
    nombre: 'Formulario',
    icono: 'list_alt',
    descripcion: 'Formulario personalizado de contacto o leads.',
    crearPorDefecto: (id) => ({
      id,
      visible: true,
      tipo: 'formulario',
      formularioId: id,
      titulo: 'Contactanos',
      campos: [
        { id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true },
        { id: 'telefono', tipo: 'telefono', etiqueta: 'Telefono', requerido: true },
        { id: 'mensaje', tipo: 'textarea', etiqueta: 'Mensaje', requerido: false },
      ],
      textoBoton: 'Enviar',
      mensajeExito: 'Gracias, te contactaremos pronto.',
    }),
  },
  {
    tipo: 'mapa',
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
];

export function definicionDeBloque(tipo: TipoBloque): DefinicionBloque | undefined {
  return BLOQUES_CATALOGO.find((definicion) => definicion.tipo === tipo);
}

export function nuevoIdBloque(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

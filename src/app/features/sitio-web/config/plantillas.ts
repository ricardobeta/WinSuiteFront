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

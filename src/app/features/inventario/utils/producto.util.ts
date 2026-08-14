import { normalizarTexto } from '../../../shared/utils/texto.util';
import { AtributoVariante, ModoVentaProducto, Producto, UsoProducto } from '../models/inventario.models';

/**
 * Reglas de clasificacion de producto compartidas por inventario, POS, recetas y compras.
 * Toda superficie que decida "esto se vende" o "esto se compra" debe usar estas funciones
 * para que no diverjan los criterios.
 *
 * Ejes independientes:
 * - `tipo`        SIMPLE | RECETA   -> como se compone el producto.
 * - `usoProducto` VENTA  | INSUMO   -> si se vende en caja o solo alimenta recetas.
 * - variantes                        -> plantilla (padre) vs variante concreta (hijo).
 */

/** Maximo de ejes de variacion. Mas de tres es inoperable en una caja. */
export const MAX_ATRIBUTOS_VARIANTE = 3;

/** Tope de combinaciones generables de una sola vez. */
export const MAX_COMBINACIONES_VARIANTE = 100;

export function usoDe(producto: Pick<Producto, 'usoProducto'>): UsoProducto {
  return producto.usoProducto === 'INSUMO' ? 'INSUMO' : 'VENTA';
}

export function modoVentaDe(producto: Pick<Producto, 'modoVenta'>): ModoVentaProducto {
  return producto.modoVenta === 'GRANEL' ? 'GRANEL' : 'UNIDAD';
}

/** Materia prima: solo se consume dentro de recetas. */
export function esInsumo(producto: Pick<Producto, 'usoProducto'>): boolean {
  return usoDe(producto) === 'INSUMO';
}

/** Producto padre que solo agrupa variantes. No tiene stock ni se vende directo. */
export function esPlantillaVariantes(producto: Pick<Producto, 'atributosVariante'>): boolean {
  return (producto.atributosVariante?.length ?? 0) > 0;
}

/** Variante concreta: es un producto normal en stock, kardex, costeo y recetas. */
export function esVariante(producto: Pick<Producto, 'productoPadreId'>): boolean {
  return !!producto.productoPadreId;
}

/** Se vende por peso o medida, con cantidad decimal. */
export function esGranel(producto: Pick<Producto, 'modoVenta'>): boolean {
  return modoVentaDe(producto) === 'GRANEL';
}

/** Aparece como tarjeta comprable en el POS. */
export function esVendibleEnPos(producto: Producto): boolean {
  return producto.activo !== false && !esInsumo(producto) && !esPlantillaVariantes(producto);
}

/**
 * Puede seleccionarse como ingrediente de una receta.
 * Los insumos SI entran; las plantillas no, porque no tienen stock propio.
 */
export function esUsableComoIngrediente(producto: Producto): boolean {
  return producto.activo !== false && !esPlantillaVariantes(producto);
}

/** Puede seleccionarse en una orden de compra o factura de compra. */
export function esComprable(producto: Producto): boolean {
  return producto.activo !== false && !esPlantillaVariantes(producto);
}

/** Incremento que aplican los botones +/- del carrito. */
export function pasoDe(producto: Pick<Producto, 'modoVenta' | 'pasoCantidad'>, pasoGranelDefecto = 0.1): number {
  const paso = Number(producto.pasoCantidad);
  if (Number.isFinite(paso) && paso > 0) {
    return paso;
  }

  return esGranel(producto) ? pasoGranelDefecto : 1;
}

/** Etiqueta corta de la combinacion: 'M / Rojo'. */
export function etiquetaVariante(
  producto: Pick<Producto, 'valoresVariante'>,
  atributos?: AtributoVariante[]
): string {
  const valores = producto.valoresVariante;
  if (!valores) {
    return '';
  }

  // Respeta el orden declarado en el padre; si no se conoce, usa el de las claves.
  const claves = atributos?.length ? atributos.map((atributo) => atributo.id) : Object.keys(valores);

  return claves
    .map((clave) => valores[clave])
    .filter((valor): valor is string => !!valor && valor.trim().length > 0)
    .join(' / ');
}

/** Nombre completo para carrito, ticket y factura: 'Camiseta Logo · M / Rojo'. */
export function nombreConVariante(producto: Producto, atributos?: AtributoVariante[]): string {
  const etiqueta = etiquetaVariante(producto, atributos);
  return etiqueta ? `${producto.nombre} · ${etiqueta}` : producto.nombre;
}

/**
 * Producto cartesiano de los valores de cada atributo, en orden estable.
 * `[{talla:[S,M]}, {color:[Rojo,Azul]}]` -> S/Rojo, S/Azul, M/Rojo, M/Azul.
 */
export function combinacionesVariantes(atributos: AtributoVariante[]): Record<string, string>[] {
  const ejes = (atributos ?? []).filter((atributo) => atributo.id && atributo.valores?.length);
  if (ejes.length === 0) {
    return [];
  }

  return ejes.reduce<Record<string, string>[]>(
    (acumulado, atributo) =>
      acumulado.flatMap((combinacion) =>
        atributo.valores.map((valor) => ({ ...combinacion, [atributo.id]: valor }))
      ),
    [{}]
  );
}

/** Clave estable de una combinacion, para comparar contra variantes ya existentes. */
export function claveCombinacion(valores: Record<string, string>): string {
  return Object.keys(valores)
    .sort()
    .map((clave) => `${clave}=${valores[clave]}`)
    .join('|');
}

/** Slug de atributo a partir del nombre visible: 'Talla de camisa' -> 'talla-de-camisa'. */
export function slugAtributo(nombre: string): string {
  return normalizarTexto(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** SKU sugerido de una variante: 'CAM-001' + {talla:'M', color:'Rojo'} -> 'CAM-001-M-ROJ'. */
export function skuVariante(
  skuBase: string,
  valores: Record<string, string>,
  atributos?: AtributoVariante[]
): string {
  const claves = atributos?.length ? atributos.map((atributo) => atributo.id) : Object.keys(valores);

  const sufijos = claves
    .map((clave) => valores[clave])
    .filter((valor): valor is string => !!valor)
    .map((valor) =>
      normalizarTexto(valor)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 3)
    )
    .filter((sufijo) => sufijo.length > 0);

  const base = (skuBase ?? '').trim().replace(/-+$/g, '');
  return [base, ...sufijos].filter((parte) => parte.length > 0).join('-');
}

/** Redondeo de cantidades de venta. Tres decimales cubren gramos y mililitros. */
export function redondearCantidad(valor: number, decimales = 3): number {
  const factor = 10 ** decimales;
  return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
}

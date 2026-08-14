import { describe, expect, it } from 'vitest';

import { AtributoVariante, Producto } from '../models/inventario.models';
import {
  claveCombinacion,
  combinacionesVariantes,
  esComprable,
  esGranel,
  esInsumo,
  esPlantillaVariantes,
  esUsableComoIngrediente,
  esVariante,
  esVendibleEnPos,
  etiquetaVariante,
  nombreConVariante,
  pasoDe,
  redondearCantidad,
  skuVariante,
  slugAtributo
} from './producto.util';

function crearProducto(overrides: Partial<Producto> = {}): Producto {
  return {
    sku: 'PROD-1',
    nombre: 'Producto',
    categoriaId: 'cat-1',
    unidadId: 'uni-1',
    metodoCosteo: 'PROMEDIO',
    precioCosto: 1,
    precioVenta: 2,
    ivaPorcentaje: 15,
    stockMinimo: 0,
    activo: true,
    ...overrides
  };
}

const ATRIBUTOS: AtributoVariante[] = [
  { id: 'talla', nombre: 'Talla', valores: ['S', 'M'] },
  { id: 'color', nombre: 'Color', valores: ['Rojo', 'Azul'] }
];

describe('clasificacion de producto', () => {
  it('trata la ausencia de usoProducto como producto de venta', () => {
    const producto = crearProducto();
    expect(esInsumo(producto)).toBe(false);
    expect(esVendibleEnPos(producto)).toBe(true);
  });

  it('excluye los insumos del POS pero los mantiene como ingredientes y comprables', () => {
    const insumo = crearProducto({ usoProducto: 'INSUMO' });
    expect(esVendibleEnPos(insumo)).toBe(false);
    expect(esUsableComoIngrediente(insumo)).toBe(true);
    expect(esComprable(insumo)).toBe(true);
  });

  it('excluye la plantilla de variantes del POS, de recetas y de compras', () => {
    const plantilla = crearProducto({ atributosVariante: ATRIBUTOS });
    expect(esPlantillaVariantes(plantilla)).toBe(true);
    expect(esVendibleEnPos(plantilla)).toBe(false);
    expect(esUsableComoIngrediente(plantilla)).toBe(false);
    expect(esComprable(plantilla)).toBe(false);
  });

  it('trata la variante concreta como un producto normal', () => {
    const hijo = crearProducto({ productoPadreId: 'padre-1', valoresVariante: { talla: 'M' } });
    expect(esVariante(hijo)).toBe(true);
    expect(esVendibleEnPos(hijo)).toBe(true);
    expect(esUsableComoIngrediente(hijo)).toBe(true);
  });

  it('excluye del POS cualquier producto inactivo', () => {
    expect(esVendibleEnPos(crearProducto({ activo: false }))).toBe(false);
  });

  it('una subreceta puede ser RECETA e INSUMO a la vez', () => {
    const salsaMadre = crearProducto({ tipo: 'RECETA', usoProducto: 'INSUMO' });
    expect(esVendibleEnPos(salsaMadre)).toBe(false);
    expect(esUsableComoIngrediente(salsaMadre)).toBe(true);
  });
});

describe('modo de venta', () => {
  it('usa paso 1 por unidad y el paso configurado a granel', () => {
    expect(esGranel(crearProducto())).toBe(false);
    expect(pasoDe(crearProducto())).toBe(1);
    expect(pasoDe(crearProducto({ modoVenta: 'GRANEL' }), 0.25)).toBe(0.25);
    expect(pasoDe(crearProducto({ modoVenta: 'GRANEL', pasoCantidad: 0.5 }), 0.1)).toBe(0.5);
  });

  it('ignora pasos invalidos y cae al valor por defecto', () => {
    expect(pasoDe(crearProducto({ modoVenta: 'GRANEL', pasoCantidad: 0 }), 0.1)).toBe(0.1);
    expect(pasoDe(crearProducto({ pasoCantidad: Number.NaN }))).toBe(1);
  });

  it('redondea cantidades a tres decimales', () => {
    expect(redondearCantidad(0.1 + 0.2)).toBe(0.3);
    expect(redondearCantidad(1.23456)).toBe(1.235);
  });
});

describe('combinaciones de variantes', () => {
  it('devuelve vacio sin atributos utiles', () => {
    expect(combinacionesVariantes([])).toEqual([]);
    expect(combinacionesVariantes([{ id: 'talla', nombre: 'Talla', valores: [] }])).toEqual([]);
  });

  it('genera el producto cartesiano en orden estable', () => {
    expect(combinacionesVariantes(ATRIBUTOS)).toEqual([
      { talla: 'S', color: 'Rojo' },
      { talla: 'S', color: 'Azul' },
      { talla: 'M', color: 'Rojo' },
      { talla: 'M', color: 'Azul' }
    ]);
  });

  it('soporta un solo eje y tres ejes', () => {
    expect(combinacionesVariantes([ATRIBUTOS[0]])).toHaveLength(2);
    expect(
      combinacionesVariantes([...ATRIBUTOS, { id: 'sabor', nombre: 'Sabor', valores: ['A', 'B', 'C'] }])
    ).toHaveLength(12);
  });

  it('produce una clave estable sin importar el orden de las claves', () => {
    expect(claveCombinacion({ talla: 'M', color: 'Rojo' })).toBe(claveCombinacion({ color: 'Rojo', talla: 'M' }));
  });
});

describe('etiquetas y SKU de variante', () => {
  it('arma la etiqueta respetando el orden declarado en el padre', () => {
    const hijo = crearProducto({ valoresVariante: { color: 'Rojo', talla: 'M' } });
    expect(etiquetaVariante(hijo, ATRIBUTOS)).toBe('M / Rojo');
  });

  it('devuelve el nombre a secas cuando no hay variante', () => {
    const simple = crearProducto({ nombre: 'Camiseta Logo' });
    expect(etiquetaVariante(simple)).toBe('');
    expect(nombreConVariante(simple)).toBe('Camiseta Logo');
  });

  it('compone el nombre completo para ticket y factura', () => {
    const hijo = crearProducto({ nombre: 'Camiseta Logo', valoresVariante: { talla: 'M', color: 'Rojo' } });
    expect(nombreConVariante(hijo, ATRIBUTOS)).toBe('Camiseta Logo · M / Rojo');
  });

  it('genera SKU sin tildes ni caracteres invalidos', () => {
    expect(skuVariante('CAM-001', { talla: 'M', color: 'Rojo' }, ATRIBUTOS)).toBe('CAM-001-M-ROJ');
    expect(skuVariante('CAM-', { talla: 'Único' }, [{ id: 'talla', nombre: 'Talla', valores: ['Único'] }])).toBe(
      'CAM-UNI'
    );
  });

  it('slugifica el nombre del atributo', () => {
    expect(slugAtributo('Talla de camisa')).toBe('talla-de-camisa');
    expect(slugAtributo('Tamaño')).toBe('tamano');
    expect(slugAtributo('  ')).toBe('');
  });
});

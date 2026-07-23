import { CarritoItem } from '../models/ventas.models';
import { VentasPosStateService } from './ventas-pos-state.service';

function item(
  productoId: string,
  cantidad: number,
  itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'
): CarritoItem {
  return {
    itemTipo,
    productoId,
    sku: productoId,
    nombre: productoId,
    cantidad,
    precioUnitario: 10,
    costoUnitario: 4,
    descuentoItem: 0,
    ivaPorcentaje: 12,
    stockDisponible: 20
  };
}

describe('VentasPosStateService', () => {
  beforeEach(() => localStorage.clear());

  it('resta en una sola operación lo cobrado y elimina las líneas agotadas', () => {
    const service = new VentasPosStateService();
    service.agregarItem(item('producto-1', 5));
    service.agregarItem(item('producto-1', 2, 'RECETA'));

    service.descontarItemsCobrados([
      item('producto-1', 2),
      item('producto-1', 2, 'RECETA')
    ]);

    expect(service.carrito().items).toEqual([
      expect.objectContaining({
        productoId: 'producto-1',
        itemTipo: 'PRODUCTO',
        cantidad: 3
      })
    ]);

    const guardadas = JSON.parse(localStorage.getItem('winsuite.pos.tabs') ?? '[]');
    expect(guardadas[0].carrito.items[0].cantidad).toBe(3);
  });

  it('nunca deja cantidades negativas aunque reciba una resta mayor', () => {
    const service = new VentasPosStateService();
    service.agregarItem(item('producto-2', 1));

    service.descontarItemsCobrados([item('producto-2', 4)]);

    expect(service.carrito().items).toEqual([]);
  });
});

import { CarritoItem } from '../models/ventas.models';
import { calcularResumenVenta } from './ventas-calculos.util';

function item(overrides: Partial<CarritoItem> = {}): CarritoItem {
  return {
    itemTipo: 'PRODUCTO',
    productoId: 'producto-1',
    sku: 'SKU-1',
    nombre: 'Producto',
    cantidad: 2,
    precioUnitario: 10,
    costoUnitario: 4,
    descuentoItem: 10,
    ivaPorcentaje: 12,
    stockDisponible: 10,
    ...overrides
  };
}

describe('calcularResumenVenta', () => {
  it('conserva descuentos por artículo e IVA en una compra parcial', () => {
    const resumen = calcularResumenVenta([item()], 0, 15);

    expect(resumen.subtotalBruto).toBe(20);
    expect(resumen.descuentoItems).toBe(2);
    expect(resumen.subtotalNetoItems).toBe(18);
    expect(resumen.impuesto).toBe(2.16);
    expect(resumen.desgloseIva).toEqual([
      { tarifa: 12, baseImponible: 18, impuesto: 2.16, total: 20.16 }
    ]);
    expect(resumen.total).toBe(20.16);
  });

  it('mantiene el cálculo del descuento global para el cobro normal', () => {
    const resumen = calcularResumenVenta([
      item({ cantidad: 1, descuentoItem: 0 }),
      item({
        productoId: 'servicio-1',
        itemTipo: 'SERVICIO',
        cantidad: 1,
        precioUnitario: 20,
        descuentoItem: 0,
        ivaPorcentaje: 0
      })
    ], 10, 12);

    expect(resumen.subtotalBruto).toBe(30);
    expect(resumen.descuentoGlobal).toBe(3);
    expect(resumen.impuesto).toBe(1.08);
    expect(resumen.desgloseIva).toEqual([
      { tarifa: 0, baseImponible: 18, impuesto: 0, total: 18 },
      { tarifa: 12, baseImponible: 9, impuesto: 1.08, total: 10.08 }
    ]);
    expect(resumen.total).toBe(28.08);
  });

  it('agrupa cualquier cantidad de tarifas de IVA y ordena el desglose', () => {
    const resumen = calcularResumenVenta([
      item({ productoId: 'iva-15-a', cantidad: 1, descuentoItem: 0, ivaPorcentaje: 15 }),
      item({ productoId: 'iva-5', cantidad: 1, precioUnitario: 20, descuentoItem: 0, ivaPorcentaje: 5 }),
      item({ productoId: 'iva-15-b', cantidad: 1, precioUnitario: 30, descuentoItem: 10, ivaPorcentaje: 15 }),
      item({ productoId: 'iva-0', cantidad: 1, precioUnitario: 4, descuentoItem: 0, ivaPorcentaje: 0 })
    ], 0, 12);

    expect(resumen.desgloseIva).toEqual([
      { tarifa: 0, baseImponible: 4, impuesto: 0, total: 4 },
      { tarifa: 5, baseImponible: 20, impuesto: 1, total: 21 },
      { tarifa: 15, baseImponible: 37, impuesto: 5.55, total: 42.55 }
    ]);
    expect(resumen.impuesto).toBe(6.55);
    expect(resumen.total).toBe(67.55);
  });
});

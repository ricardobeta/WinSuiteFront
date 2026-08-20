import { KardexEntry, MetodoCosteo } from '../models/inventario.models';
import {
  calcularCostoProducto,
  calcularCostoSalidaDesdeMovimientos
} from './costos-calculo.util';

describe('costos-calculo', () => {
  const fecha = (dia: number) => Date.UTC(2026, 0, dia, 12);

  function movimiento(overrides: Partial<KardexEntry>): KardexEntry {
    const cantidad = overrides.cantidad ?? 1;
    const costoUnitario = overrides.costoUnitario ?? 1;
    return {
      id: overrides.id ?? `mov-${Math.random()}`,
      almacenId: 'principal',
      tipo: 'ENTRADA',
      motivo: 'COMPRA',
      cantidad,
      costoUnitario,
      costoTotal: Math.abs(cantidad) * costoUnitario,
      saldoCantidad: 0,
      referenciaId: '',
      referenciaTipo: 'MANUAL',
      creadoPor: 'test',
      creadoEn: fecha(1),
      ...overrides
    };
  }

  function analizar(movimientos: KardexEntry[], metodo: MetodoCosteo = 'FIFO') {
    return calcularCostoProducto({
      productoId: 'p1',
      producto: 'Producto de prueba',
      sku: 'SKU-1',
      movimientos,
      metodo
    }).row;
  }

  it('valoriza correctamente FIFO', () => {
    const row = analizar([
      movimiento({ id: '1', cantidad: 10, costoUnitario: 10, creadoEn: fecha(1) }),
      movimiento({ id: '2', cantidad: 10, costoUnitario: 20, creadoEn: fecha(2) }),
      movimiento({ id: '3', tipo: 'SALIDA', motivo: 'VENTA', cantidad: 12, creadoEn: fecha(3) })
    ]);

    expect(row.costoSalidas).toBe(140);
    expect(row.costoVentas).toBe(140);
    expect(row.saldoFinal).toBe(8);
    expect(row.costoPromedio).toBe(20);
    expect(row.valorTotal).toBe(160);
    expect(row.diferenciaConciliacion).toBe(0);
  });

  it('valoriza correctamente LIFO como escenario comparativo', () => {
    const row = analizar([
      movimiento({ id: '1', cantidad: 10, costoUnitario: 10, creadoEn: fecha(1) }),
      movimiento({ id: '2', cantidad: 10, costoUnitario: 20, creadoEn: fecha(2) }),
      movimiento({ id: '3', tipo: 'SALIDA', motivo: 'VENTA', cantidad: 12, creadoEn: fecha(3) })
    ], 'LIFO');

    expect(row.costoSalidas).toBe(220);
    expect(row.saldoFinal).toBe(8);
    expect(row.costoPromedio).toBe(10);
    expect(row.valorTotal).toBe(80);
  });

  it('mantiene el promedio movil despues de cada entrada y salida', () => {
    const row = analizar([
      movimiento({ id: '1', cantidad: 10, costoUnitario: 10, creadoEn: fecha(1) }),
      movimiento({ id: '2', cantidad: 10, costoUnitario: 20, creadoEn: fecha(2) }),
      movimiento({ id: '3', tipo: 'SALIDA', motivo: 'VENTA', cantidad: 10, creadoEn: fecha(3) }),
      movimiento({ id: '4', cantidad: 10, costoUnitario: 30, creadoEn: fecha(4) })
    ], 'PROMEDIO');

    expect(row.costoSalidas).toBe(150);
    expect(row.saldoFinal).toBe(20);
    expect(row.costoPromedio).toBe(22.5);
    expect(row.valorTotal).toBe(450);
  });

  it('trata un ajuste negativo como salida con cantidad positiva', () => {
    const row = analizar([
      movimiento({ id: '1', cantidad: 10, costoUnitario: 5, creadoEn: fecha(1) }),
      movimiento({ id: '2', tipo: 'AJUSTE', motivo: 'AJUSTE_INVENTARIO', cantidad: -2, creadoEn: fecha(2) })
    ]);

    expect(row.salidas).toBe(2);
    expect(row.costoSalidas).toBe(10);
    expect(row.saldoFinal).toBe(8);
    expect(row.valorTotal).toBe(40);
  });

  it('excluye traslados internos del costo consolidado', () => {
    const row = analizar([
      movimiento({ id: '1', cantidad: 10, costoUnitario: 5, creadoEn: fecha(1) }),
      movimiento({ id: '2', tipo: 'TRASLADO', motivo: 'TRASLADO_SALIDA', cantidad: 4, creadoEn: fecha(2) }),
      movimiento({ id: '3', tipo: 'TRASLADO', motivo: 'TRASLADO_ENTRADA', cantidad: 4, creadoEn: fecha(3) })
    ]);

    expect(row.entradas).toBe(10);
    expect(row.salidas).toBe(0);
    expect(row.saldoFinal).toBe(10);
    expect(row.valorTotal).toBe(50);
  });

  it('calcula apertura previa al periodo y concilia el cierre', () => {
    const result = calcularCostoProducto({
      productoId: 'p1',
      producto: 'Producto',
      sku: 'SKU',
      metodo: 'FIFO',
      fechaDesde: fecha(2),
      fechaHasta: fecha(3),
      movimientos: [
        movimiento({ id: '1', cantidad: 10, costoUnitario: 5, creadoEn: fecha(1) }),
        movimiento({ id: '2', tipo: 'SALIDA', motivo: 'VENTA', cantidad: 4, creadoEn: fecha(2) })
      ]
    });

    expect(result.row.saldoInicial).toBe(10);
    expect(result.row.valorInicial).toBe(50);
    expect(result.row.salidas).toBe(4);
    expect(result.row.valorTotal).toBe(30);
    expect(result.row.diferenciaConciliacion).toBe(0);
  });

  it('marca diferencias contra el stock registrado y salidas sin costo', () => {
    const result = calcularCostoProducto({
      productoId: 'p1',
      producto: 'Producto',
      sku: 'SKU',
      metodo: 'FIFO',
      saldoRegistrado: 1,
      movimientos: [movimiento({ tipo: 'SALIDA', motivo: 'VENTA', cantidad: 3 })]
    });

    expect(result.row.cantidadSinCosto).toBe(3);
    expect(result.row.diferenciaStock).toBe(4);
    expect(result.row.estado).toBe('REVISAR');
  });

  it('estima el costo unitario de una nueva salida sin mutar los movimientos', () => {
    const movimientos = [
      movimiento({ id: '1', cantidad: 5, costoUnitario: 4, creadoEn: fecha(1) }),
      movimiento({ id: '2', cantidad: 5, costoUnitario: 8, creadoEn: fecha(2) })
    ];

    expect(calcularCostoSalidaDesdeMovimientos(movimientos, 6, 'FIFO')).toBe(4.666667);
    expect(movimientos[0].cantidad).toBe(5);
  });
});
